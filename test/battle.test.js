import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSave } from '../server/save.js';
import { createBattle, submit, autoAction, needsAction, validActions } from '../server/battle.js';
import { rng, species, speciesData, effectiveness } from '../server/creatures.js';

const { roster } = parseSave(readFileSync(new URL('./fixtures/export.json', import.meta.url), 'utf8'));

test('species are deterministic and sprited by dex number', () => {
  const e = (finalID) => ({ finalID, baseID: 403, rarity: 'common', stage: 2, chainLen: 3 });
  assert.deepEqual(species(e(405)), species(e(405)));
  // The sprite is the species' own dex number.
  assert.equal(species(e(405)).sprite, '405');
  for (const f of roster) assert.match(species(f).sprite, /^[0-9]+$/);
  assert.equal(effectiveness('brasa', 'brote'), 1.5);
  assert.equal(effectiveness('brote', 'brasa'), 0.67);
  assert.equal(effectiveness(null, 'brasa'), 1);
});

test('name, sprite, element and stats come straight from PokeAPI', () => {
  const e = (finalID, extra = {}) => ({ finalID, baseID: finalID, rarity: 'common', ...extra });
  // Element and stats are the species' own (attack/special and defense/special averaged).
  assert.equal(speciesData(4).element, 'brasa');
  const sp = species(e(4, { stage: 0, chainLen: 3 }));
  assert.equal(sp.element, 'brasa');
  assert.deepEqual(sp.stats, { hp: 39, atk: 56, def: 47, spd: 65 });
  // Real PokeAPI name and dex-number sprite.
  assert.equal(sp.name, speciesData(4).name);
  assert.equal(sp.sprite, '4');
  // Normal/flying counts as its second type.
  assert.equal(speciesData(16).element, 'chispa');
  // A species PokeAPI doesn't know keeps working with rarity-based stats and a placeholder name.
  const unknown = species(e(4999));
  assert.equal(speciesData(4999), null);
  assert.ok(unknown.name && unknown.stats.hp > 0);
  assert.equal(unknown.sprite, '4999');
});

function play(seed, levelCap = null) {
  const b = createBattle({
    id: 't',
    levelCap,
    random: rng(seed),
    sides: [
      { trainerId: 'a', name: 'A', entries: roster.slice(0, 3) },
      { trainerId: 'b', name: 'B', entries: roster.slice(1, 4) },
    ],
  });
  let guard = 0;
  while (b.status === 'active' && guard++ < 500) {
    for (const s of [0, 1]) if (needsAction(b, s)) submit(b, s, autoAction(b, s));
  }
  return b;
}

test('battles always finish with a winner', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const b = play(seed, seed % 2 ? 50 : null);
    assert.equal(b.status, 'finished', `seed ${seed}`);
    assert.ok(b.winner === 0 || b.winner === 1);
    assert.ok(b.turn < 60, `seed ${seed} took ${b.turn} turns`);
  }
});

test('rejects invalid actions and waits for both sides', () => {
  const b = play(0);
  const fresh = createBattle({ id: 'x', random: rng(3), sides: [{ trainerId: 'a', name: 'A', entries: roster }, { trainerId: 'b', name: 'B', entries: roster }] });
  assert.throws(() => submit(fresh, 0, { type: 'move', move: 9 }));
  assert.throws(() => submit(fresh, 0, { type: 'switch', to: 0 }));
  assert.equal(submit(fresh, 0, { type: 'move', move: 0 }), null);
  assert.deepEqual(validActions(fresh, 0), []);
  const ev = submit(fresh, 1, { type: 'switch', to: 1 });
  assert.equal(ev[0].t, 'turn');
  assert.equal(ev[1].t, 'switch'); // switches happen before moves
  assert.ok(b);
});

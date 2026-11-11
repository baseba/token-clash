import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSave } from '../server/save.js';
import { createBattle, submit, autoAction, needsAction, validActions } from '../server/battle.js';
import { rng, species, speciesData, tuxemonFor, effectiveness } from '../server/creatures.js';

const { roster } = parseSave(readFileSync(new URL('./fixtures/export.json', import.meta.url), 'utf8'));

const catalog = JSON.parse(readFileSync(new URL('../server/tuxemon.json', import.meta.url), 'utf8'));

test('species are deterministic Tuxemon, one line per chain', () => {
  const e = (finalID, stage) => ({ finalID, baseID: 403, rarity: 'common', stage, chainLen: 3 });
  assert.deepEqual(species(e(405, 2)), species(e(405, 2)));
  const line = [0, 1, 2].map((i) => tuxemonFor(e(403 + i, i)).slug);
  assert.ok(catalog.lines.some((l) => l.join() === line.join()), `${line} is a real evolution line`);
  for (const slug of line) assert.ok(catalog.species[slug].name);
  // Neighbouring chains land on different lines.
  const firsts = [1, 4, 7, 10, 13, 16].map((b) => tuxemonFor({ finalID: b, baseID: b, stage: 0, chainLen: 3 }).slug);
  assert.equal(new Set(firsts).size, firsts.length);
  // Old stored entries without chain info still resolve.
  assert.ok(tuxemonFor({ finalID: 3, baseID: 1 }).slug);
  for (const f of roster) assert.match(species(f).sprite, /^[a-z0-9_-]+$/);
  assert.equal(effectiveness('brasa', 'brote'), 1.5);
  assert.equal(effectiveness('brote', 'brasa'), 0.67);
  assert.equal(effectiveness(null, 'brasa'), 1);
});

test('battle data comes from PokeAPI, looks from Tuxemon', () => {
  const e = (finalID, baseID, extra = {}) => ({ finalID, baseID, rarity: 'common', ...extra });
  // Element and stats are the species' own (attack/special and defense/special averaged).
  assert.equal(speciesData(4).element, 'brasa');
  const sp = species(e(4, 4, { stage: 0, chainLen: 3 }));
  assert.equal(sp.element, 'brasa');
  assert.deepEqual(sp.stats, { hp: 39, atk: 56, def: 47, spd: 65 });
  // Normal/flying counts as its second type.
  assert.equal(speciesData(16).element, 'chispa');
  // Name and sprite still come from Tuxemon, of the same element when there are enough lines.
  const tux = tuxemonFor(e(1, 1, { stage: 0, chainLen: 3 }));
  assert.equal(sp.name, tuxemonFor(e(4, 4, { stage: 0, chainLen: 3 })).name);
  assert.equal(tux.element, 'brote');
  assert.ok(catalog.species[tux.slug]);
  // Entries stored without the chain get it from PokeAPI.
  assert.equal(tuxemonFor(e(405, 403)).slug, tuxemonFor(e(405, 403, { stage: 2, chainLen: 3 })).slug);
  assert.equal(tuxemonFor(e(134, 133)).slug, tuxemonFor(e(134, 133, { stage: 1, chainLen: 2 })).slug);
  // A species PokeAPI doesn't know keeps working with rarity-based stats.
  const unknown = species(e(4999, 4999));
  assert.equal(speciesData(4999), null);
  assert.ok(unknown.name && unknown.stats.hp > 0);
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

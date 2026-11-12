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
  // Real type chart, with the product over a defender's two types and immunities.
  assert.equal(effectiveness('fire', ['grass']), 2);
  assert.equal(effectiveness('fire', ['water']), 0.5);
  assert.equal(effectiveness('fire', ['grass', 'steel']), 4); // doble super efectivo
  assert.equal(effectiveness('ground', ['flying']), 0); // inmune
  assert.equal(effectiveness(null, ['fire']), 1);
});

test('name, sprite, types and stats come straight from PokeAPI', () => {
  const e = (finalID, extra = {}) => ({ finalID, baseID: finalID, rarity: 'common', ...extra });
  // Real types and the six real base stats.
  assert.deepEqual(speciesData(4).types, ['fire']);
  const sp = species(e(4, { stage: 0, chainLen: 3 }));
  assert.deepEqual(sp.types, ['fire']);
  assert.deepEqual(sp.stats, { hp: 39, atk: 52, def: 43, satk: 60, sdef: 50, spd: 65 });
  // Real PokeAPI name and dex-number sprite.
  assert.equal(sp.name, speciesData(4).name);
  assert.equal(sp.sprite, '4');
  // Dual-type species keep both types, in PokeAPI slot order.
  assert.deepEqual(speciesData(1).types, ['grass', 'poison']);
  assert.deepEqual(speciesData(16).types, ['normal', 'flying']);
  // Damaging moves carry the species' own types (STAB), and there are four moves.
  const moves = sp.moves;
  assert.equal(moves.length, 4);
  assert.equal(moves[0].type, 'fire');
  // A species PokeAPI doesn't know keeps working with rarity-based stats and the Normal type.
  const unknown = species(e(4999));
  assert.equal(speciesData(4999), null);
  assert.ok(unknown.name && unknown.stats.hp > 0);
  assert.deepEqual(unknown.types, ['normal']);
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

test('events say who acts first and why, and whom a switch replaces', () => {
  const b = createBattle({ id: 'o', random: rng(7), sides: [{ trainerId: 'a', name: 'A', entries: roster }, { trainerId: 'b', name: 'B', entries: roster.slice(1) }] });
  submit(b, 0, { type: 'move', move: 0 });
  const ev = submit(b, 1, { type: 'move', move: 0 });
  const moves = ev.filter((e) => e.t === 'move');
  assert.ok(['priority', 'speed', 'tie'].includes(moves[0].why));
  assert.equal(moves[1]?.why, undefined);
  for (const e of ev.filter((x) => x.t === 'damage')) assert.notEqual(e.side, ev[ev.indexOf(e) - 1].side); // damage lands on the other side

  const c = createBattle({ id: 's', random: rng(2), sides: [{ trainerId: 'a', name: 'A', entries: roster }, { trainerId: 'b', name: 'B', entries: roster }] });
  submit(c, 0, { type: 'switch', to: 1 });
  const sw = submit(c, 1, { type: 'switch', to: 2 }).filter((e) => e.t === 'switch');
  assert.equal(sw[0].from, c.sides[0].team[0].name);
  assert.equal(sw[0].forced, false);
  assert.equal(sw[1].name, c.sides[1].team[2].name);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSave } from '../server/save.js';
import { createBattle, submit, autoAction, needsAction, validActions } from '../server/battle.js';
import { rng, species, speciesData, effectiveness, learnedMoves, defaultMoveset, validMoveset, movesetFor, buildFighter, moveData, statsFor } from '../server/creatures.js';

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

test('moves come from what the Pokémon has learned: the latest four by default, any four the player picks', () => {
  const charmander = { id: 'c', finalID: 4, level: 30, rarity: 'common', ivs: { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 } };
  const pool = learnedMoves(charmander);
  const learnset = speciesData(4).learnset.filter(([, lvl]) => lvl <= 30).map(([id]) => id);
  assert.deepEqual(new Set(pool), new Set(learnset));
  assert.ok(!pool.includes('flamethrower'));
  const def = defaultMoveset(charmander);
  assert.equal(def.length, 4);
  assert.deepEqual(def, pool.filter((id) => moveData(id).supported).slice(-4));

  assert.ok(validMoveset(charmander, ['ember', 'scratch']));
  assert.ok(!validMoveset(charmander, ['flamethrower']));
  assert.ok(!validMoveset(charmander, ['ember', 'ember']));
  assert.ok(!validMoveset(charmander, ['ember', 'scratch', 'growl', 'smokescreen', 'dragon-rage']));
  assert.deepEqual(movesetFor({ ...charmander, moveset: ['ember', 'scratch'] }), ['ember', 'scratch']);
  assert.deepEqual(movesetFor({ ...charmander, moveset: ['flamethrower'] }), def);
  assert.ok(learnedMoves({ ...charmander, learned: ['flamethrower'] }).includes('flamethrower'));

  const f = buildFighter({ ...charmander, moveset: ['ember', 'growl'] });
  assert.deepEqual(f.moves.map((m) => [m.key, m.name, m.pp]), [['ember', 'Ascuas', 25], ['growl', 'Gruñido', 40]]);
});

test('stats follow the real formula, with the nature boosting one stat and lowering another', () => {
  const iv = { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 };
  const base = [78, 84, 78, 109, 85, 100];
  const neutral = statsFor(base, iv, 50);
  assert.deepEqual(neutral, { hp: 153, atk: 104, def: 98, satk: 129, sdef: 105, spd: 120 });
  const modest = statsFor(base, iv, 50, 'modest');
  assert.equal(modest.satk, Math.floor(129 * 1.1));
  assert.equal(modest.atk, Math.floor(104 * 0.9));
});

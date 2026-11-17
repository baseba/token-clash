import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit } from './battle.js';
import { rng } from '../../catalog/domain/creatures.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
let n = 0;
const mon = (finalID, moves, extra: any = {}): any => ({ id: `m${n++}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, learned: moves, moveset: moves, ...extra });
const battle = (a, b) => {
  const made = createBattle({ id: 'x', random: rng(1), sides: [{ trainerId: 'a', name: 'A', entries: [a] }, { trainerId: 'b', name: 'B', entries: [b] }] });
  for (const side of made.sides) side.team[0].stats.hp = side.team[0].hp = 100_000;
  made.sides[1].team[0].stats.spd = 1;
  return made;
};
const active = (b, s) => b.sides[s].team[b.sides[s].active];
const idx = (b, s, key) => active(b, s).moves.findIndex((m) => m.key === key);
const turn = (b, k0, k1) => {
  submit(b, 0, { type: 'move', move: idx(b, 0, k0) });
  return submit(b, 1, { type: 'move', move: idx(b, 1, k1) }) ?? [];
};
const hit = (ev, side) => ev.some((e) => e.t === 'damage' && e.side === side);
const failed = (ev, side) => ev.some((e) => e.t === 'nothing' && e.side === side);

test('Levitón makes the user immune to Ground moves for 5 turns, and fails if it is already up', () => {
  const b = battle(mon(81, ['magnet-rise', 'thunder-shock']), mon(51, ['earthquake']));
  const hits = [1, 2, 3, 4, 5, 6].map((t) => hit(turn(b, t === 1 ? 'magnet-rise' : 'thunder-shock', 'earthquake'), 0));
  assert.deepEqual(hits, [false, false, false, false, false, true]);
  const again = battle(mon(81, ['magnet-rise']), mon(51, ['earthquake']));
  turn(again, 'magnet-rise', 'earthquake');
  assert.ok(failed(turn(again, 'magnet-rise', 'earthquake'), 0));
});

test('Gravedad, Antiaéreo and Mil Flechas bring a levitating Pokémon down', () => {
  const gravity = battle(mon(81, ['magnet-rise', 'thunder-shock']), mon(51, ['gravity', 'earthquake']));
  turn(gravity, 'magnet-rise', 'gravity');
  assert.ok(hit(turn(gravity, 'thunder-shock', 'earthquake'), 0));
  const smack = battle(mon(81, ['magnet-rise', 'thunder-shock']), mon(51, ['smack-down', 'earthquake']));
  turn(smack, 'magnet-rise', 'smack-down');
  assert.equal(active(smack, 0).volatiles.magnetRise, undefined);
  assert.ok(hit(turn(smack, 'thunder-shock', 'earthquake'), 0));
  const arrows = battle(mon(81, ['magnet-rise', 'thunder-shock']), mon(718, ['thousand-arrows']));
  turn(arrows, 'magnet-rise', 'thousand-arrows');
  assert.ok(hit(turn(arrows, 'thunder-shock', 'thousand-arrows'), 0));
});

test('Telequinesis lifts the rival for 3 turns, and fails on Pokémon that live underground', () => {
  const b = battle(mon(65, ['telekinesis', 'earthquake']), mon(143, ['splash']));
  active(b, 0).stats.spd = 1;
  active(b, 1).stats.spd = 100;
  turn(b, 'telekinesis', 'splash');
  assert.deepEqual([2, 3, 4].map(() => hit(turn(b, 'earthquake', 'splash'), 1)), [false, false, true]);
  assert.ok(failed(turn(battle(mon(65, ['telekinesis']), mon(51, ['splash'])), 'telekinesis', 'splash'), 0));
});

test('Respiro grounds a Flying type for the turn it heals, and only then', () => {
  const healed = battle(mon(18, ['roost', 'splash']), mon(51, ['earthquake']));
  active(healed, 0).hp = 50_000;
  assert.ok(hit(turn(healed, 'roost', 'earthquake'), 0));
  assert.ok(!hit(turn(healed, 'splash', 'earthquake'), 0));
  const full = battle(mon(18, ['roost']), mon(51, ['earthquake']));
  const ev = turn(full, 'roost', 'earthquake');
  assert.ok(failed(ev, 0));
  assert.ok(!hit(ev, 0));
});

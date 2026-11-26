import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit } from './battle.js';
import { rng } from '../../shared/domain/random.js';
import { moveData } from './moves.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
let n = 0;
const mon = (finalID, moves, extra: any = {}): any => ({ id: `m${n++}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, learned: moves, moveset: moves, ...extra });
const battle = (a, b) => createBattle({ id: 'x', random: rng(1), sides: [{ trainerId: 'a', name: 'A', entries: [a] }, { trainerId: 'b', name: 'B', entries: [b] }] });
const active = (b, s) => b.sides[s].team[b.sides[s].active];
const idx = (b, s, key) => active(b, s).moves.findIndex((m) => m.key === key);
const turn = (b, key, target?) => {
  submit(b, 0, { type: 'move', move: idx(b, 0, key), ...(target ? { target } : {}) });
  return submit(b, 1, { type: 'move', move: idx(b, 1, 'splash') }) ?? [];
};
const healed = (ev, side) => ev.some((e) => e.t === 'heal' && e.side === side);
const raised = (ev, side) => ev.some((e) => e.t === 'boost' && e.side === side && e.by > 0);

const user = (moves) => mon(36, moves, { abilityChoice: 'magic-guard' });
const rival = () => mon(143, ['splash'], { abilityChoice: 'thick-fat' });

test('support moves can be aimed at either Pokémon on the field', () => {
  const aimable = ['heal-pulse', 'floral-healing', 'purify', 'decorate', 'aromatic-mist', 'coaching', 'acupressure', 'pollen-puff'];
  for (const id of aimable) assert.ok(moveData(id).aimable, id);
  for (const id of ['tackle', 'toxic', 'swords-dance', 'bide']) assert.equal(moveData(id).aimable, undefined, id);
});

test('Pulso Cura and Cura Floral heal whoever the trainer picks', () => {
  for (const id of ['heal-pulse', 'floral-healing']) {
    const b = battle(user([id]), rival());
    active(b, 0).hp = 1;
    active(b, 1).hp = 1;
    assert.ok(healed(turn(b, id, 'self'), 0), `${id} on the user`);
    assert.ok(healed(turn(b, id, 'foe'), 1), `${id} on the rival`);
  }
});

test('without a target, a support move goes where it would help: the user', () => {
  const b = battle(user(['heal-pulse']), rival());
  active(b, 0).hp = 1;
  active(b, 1).hp = 1;
  const ev = turn(b, 'heal-pulse');
  assert.ok(healed(ev, 0));
  assert.ok(!healed(ev, 1));
});

test('stat support raises the picked Pokémon', () => {
  for (const id of ['coaching', 'decorate', 'aromatic-mist', 'acupressure']) {
    assert.ok(raised(turn(battle(user([id]), rival()), id, 'self'), 0), `${id} on the user`);
    assert.ok(raised(turn(battle(user([id]), rival()), id, 'foe'), 1), `${id} on the rival`);
  }
});

test('Purificación on the user cures its own status and heals it', () => {
  const b = battle(user(['purify']), rival());
  const me = active(b, 0);
  me.status = 'psn';
  me.hp = 1;
  const ev = turn(b, 'purify', 'self');
  assert.equal(me.status, null);
  assert.ok(healed(ev, 0));
});

test('Poder Polen hurts the rival, or heals the user when aimed at it', () => {
  const b = battle(user(['pollen-puff']), rival());
  active(b, 0).hp = 1;
  const self = turn(b, 'pollen-puff', 'self');
  assert.ok(healed(self, 0));
  assert.ok(!self.some((e) => e.t === 'damage'));
  assert.ok(turn(b, 'pollen-puff').some((e) => e.t === 'damage' && e.side === 1));
});

test('a target on a move that can\'t be aimed is ignored', () => {
  const b = battle(user(['tackle']), rival());
  assert.ok(turn(b, 'tackle', 'self').some((e) => e.t === 'damage' && e.side === 1));
});

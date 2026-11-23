import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit } from './battle.js';
import { rng } from '../../catalog/domain/creatures.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
let count = 0;
const mon = (finalID: number, moves: string[], extra: Record<string, unknown> = {}): any => ({ id: `m${count++}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, learned: moves, moveset: moves, ...extra });
const battle = (a: any, b: any, seed = 1) => createBattle({ id: 'x', random: rng(seed), sides: [{ trainerId: 'a', name: 'A', entries: [a] }, { trainerId: 'b', name: 'B', entries: [b] }] });
const active = (b: any, side: number) => b.sides[side].team[b.sides[side].active];
const turn = (b: any, mine: string, theirs: string) => {
  submit(b, 0, { type: 'move', move: active(b, 0).moves.findIndex((move: any) => move.key === mine) });
  return submit(b, 1, { type: 'move', move: active(b, 1).moves.findIndex((move: any) => move.key === theirs) }) ?? [];
};
const dealt = (events: any[], side: number) => events.filter((event) => event.side === side && event.t === 'damage').reduce((sum, event) => sum + event.amount, 0);
const snorlax = (extra = {}) => mon(143, ['splash'], { abilityChoice: 'thick-fat', ...extra });

test('a battle with no items has no item in it', () => {
  const b = battle(mon(6, ['flamethrower']), snorlax());
  assert.equal('item' in active(b, 0), false);
});

test('a type booster and a Life Orb make attacks stronger; the Orb costs a tenth of its HP each time', () => {
  const plain = dealt(turn(battle(mon(6, ['flamethrower']), snorlax(), 3), 'flamethrower', 'splash'), 1);
  const charcoal = dealt(turn(battle(mon(6, ['flamethrower'], { heldItem: 'charcoal' }), snorlax(), 3), 'flamethrower', 'splash'), 1);
  const orb = battle(mon(6, ['flamethrower'], { heldItem: 'life-orb' }), snorlax(), 3);
  const events = turn(orb, 'flamethrower', 'splash');
  assert.ok(charcoal > plain && dealt(events, 1) > charcoal, `${plain} ${charcoal} ${dealt(events, 1)}`);
  assert.ok(events.some((event: any) => event.t === 'item' && event.side === 0));
  assert.equal(active(orb, 0).hp, active(orb, 0).stats.hp - Math.floor(active(orb, 0).stats.hp / 10));
});

test('Leftovers heal at the end of the turn; a Sitrus Berry heals once at half HP and is gone', () => {
  const b = battle(mon(6, ['splash']), snorlax({ heldItem: 'leftovers' }));
  active(b, 1).hp = 100;
  turn(b, 'splash', 'splash');
  assert.equal(active(b, 1).hp, 100 + Math.floor(active(b, 1).stats.hp / 16));
  const berry = battle(mon(68, ['tackle']), snorlax({ heldItem: 'sitrus-berry' }));
  const target = active(berry, 1);
  target.hp = Math.floor(target.stats.hp / 2) + 10;
  const events = turn(berry, 'tackle', 'splash');
  assert.ok(events.some((event: any) => event.t === 'item' && event.usedUp));
  assert.equal(target.item, null);
});

test('a Focus Sash keeps a Pokémon at full HP standing with 1 HP, once', () => {
  const b = battle(mon(68, ['close-combat']), mon(10, ['splash'], { heldItem: 'focus-sash', battleLevel: 20 }));
  turn(b, 'close-combat', 'splash');
  assert.equal(active(b, 1).hp, 1);
  assert.equal(active(b, 1).item, null);
});

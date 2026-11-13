import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit } from '../server/battle.js';
import { rng, buildFighter } from '../server/creatures.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
let n = 0;
const mon = (finalID, ability, moves, extra = {}) => ({ id: `m${n++}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, abilityChoice: ability, learned: moves, moveset: moves, ...extra });
const battle = (a, b, seed = 1) => createBattle({ id: 'x', random: rng(seed), sides: [{ trainerId: 'a', name: 'A', entries: [a].flat() }, { trainerId: 'b', name: 'B', entries: [b].flat() }] });
const idx = (b, s, k) => b.sides[s].team[b.sides[s].active].moves.findIndex((m) => m.key === k);
const turn = (b, k0, k1) => {
  submit(b, 0, { type: 'move', move: idx(b, 0, k0) });
  return submit(b, 1, { type: 'move', move: idx(b, 1, k1) }) ?? [];
};
const active = (b, s) => b.sides[s].team[b.sides[s].active];
const damageOn = (ev, s) => ev.filter((e) => e.t === 'damage' && e.side === s).reduce((sum, e) => sum + e.amount, 0);
const shedinja = () => mon(292, 'wonder-guard', ['growl']);

test('Superguarda: Shedinja tiene 1 PS y solo lo dañan los supereficaces o el daño indirecto', () => {
  assert.equal(buildFighter(shedinja()).stats.hp, 1);
  const neutral = battle(mon(68, 'guts', ['body-slam']), shedinja());
  assert.equal(damageOn(turn(neutral, 'body-slam', 'growl'), 1), 0);
  assert.equal(active(neutral, 1).hp, 1);
  const fire = battle(mon(6, 'blaze', ['flamethrower']), shedinja());
  turn(fire, 'flamethrower', 'growl');
  assert.equal(active(fire, 1).hp, 0);
  const sand = battle(mon(248, 'sand-stream', ['crunch']), shedinja());
  turn(sand, 'crunch', 'growl');
  assert.equal(active(sand, 1).hp, 0);
});

test('Robustez aguanta con 1 PS un golpe que lo debilitaría desde PS completos', () => {
  const b = battle(mon(68, 'no-guard', ['close-combat'], { level: 100 }), mon(74, 'sturdy', ['growl'], { level: 5 }));
  turn(b, 'close-combat', 'growl');
  assert.equal(active(b, 1).hp, 1);
});

test('Pararrayos absorbe la electricidad aunque el Pokémon sea de tipo Tierra', () => {
  const b = battle(mon(26, 'static', ['thunderbolt']), mon(112, 'lightning-rod', ['growl']));
  const ev = turn(b, 'thunderbolt', 'growl');
  assert.equal(damageOn(ev, 1), 0);
  assert.equal(active(b, 1).boosts.satk, 1);
});

test('Impulso sube la Velocidad al final del primer turno de quien abre la pelea', () => {
  const b = battle(mon(291, 'speed-boost', ['scratch']), mon(143, 'thick-fat', ['growl']));
  turn(b, 'scratch', 'growl');
  assert.equal(active(b, 0).boosts.spd, 1);
});

test('Ventosas impide que lo arrastren fuera del combate', () => {
  for (let seed = 1; seed < 20; seed++) {
    const b = battle(mon(149, 'inner-focus', ['dragon-tail'], { level: 70 }), [mon(224, 'suction-cups', ['growl']), mon(143, 'thick-fat', ['growl'])], seed);
    const ev = turn(b, 'dragon-tail', 'growl');
    if (!damageOn(ev, 1)) continue;
    assert.equal(b.sides[1].active, 0);
    assert.ok(!ev.some((e) => e.t === 'dragged'));
    return;
  }
  assert.fail('Cola Dragón nunca conectó');
});

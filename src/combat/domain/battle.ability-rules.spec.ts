import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit, validActions, forcedAction } from './battle.js';
import { rng } from '../../catalog/domain/creatures.js';
import { buildFighter } from './fighter.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
let n = 0;
const mon = (finalID, ability, moves, extra: any = {}): any => ({ id: `m${n++}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, abilityChoice: ability, learned: moves, moveset: moves, ...extra });
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

test('Herbívoro también absorbe los movimientos de estado de tipo Planta', () => {
  const b = battle(mon(286, 'effect-spore', ['spore']), mon(626, 'sap-sipper', ['growl']));
  turn(b, 'spore', 'growl');
  assert.equal(active(b, 1).status, null);
  assert.equal(active(b, 1).boosts.atk, 1);
});

const moveOptions = (b, s) => validActions(b, s).filter((a) => a.type === 'move').map((a) => active(b, s).moves[a.move]?.key);

test('Último Recurso no se puede elegir hasta usar los demás movimientos', () => {
  const b = battle(mon(133, 'run-away', ['last-resort', 'tackle']), mon(143, 'thick-fat', ['splash']));
  assert.deepEqual(moveOptions(b, 0), ['tackle']);
  turn(b, 'tackle', 'splash');
  assert.deepEqual(moveOptions(b, 0), ['last-resort', 'tackle']);
});

test('Ronquido solo se puede elegir dormido', () => {
  const b = battle(mon(143, 'thick-fat', ['snore', 'tackle']), mon(133, 'run-away', ['splash']));
  assert.deepEqual(moveOptions(b, 0), ['tackle']);
  active(b, 0).status = 'slp';
  assert.deepEqual(moveOptions(b, 0), ['snore', 'tackle']);
});

test('un Pokémon atrapado en Enfado no tiene nada que elegir: el movimiento se juega solo', () => {
  const b = battle(mon(149, 'inner-focus', ['outrage', 'tackle']), mon(143, 'thick-fat', ['splash']));
  turn(b, 'outrage', 'splash');
  assert.deepEqual(forcedAction(b, 0), { type: 'move', move: 0 });
  assert.equal(forcedAction(b, 1), null);
});

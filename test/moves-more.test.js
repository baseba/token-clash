import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit, validActions, publicState } from '../server/battle.js';
import { rng } from '../server/creatures.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
let n = 0;
const mon = (finalID, moves, extra = {}) => ({ id: `m${n++}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, learned: moves, moveset: moves, ...extra });
const battle = (a, b, seed = 1) => createBattle({ id: 'x', random: rng(seed), sides: [{ trainerId: 'a', name: 'A', entries: [a].flat() }, { trainerId: 'b', name: 'B', entries: [b].flat() }] });
const active = (b, s) => b.sides[s].team[b.sides[s].active];
const idx = (b, s, key) => active(b, s).moves.findIndex((m) => m.key === key);
const act = (b, s, x) => (typeof x === 'string' ? { type: 'move', move: idx(b, s, x) } : x);
const turn = (b, x0, x1) => {
  submit(b, 0, act(b, 0, x0));
  return submit(b, 1, act(b, 1, x1)) ?? [];
};
const has = (ev, pred) => ev.some(pred);
const dmgOn = (ev, s) => ev.filter((e) => e.t === 'damage' && e.side === s).reduce((sum, e) => sum + e.amount, 0);
const snorlax = (moves = ['tackle', 'growl'], extra) => mon(143, moves, { abilityChoice: 'thick-fat', ...extra });

test('Protección bloquea el ataque y fallar seguido es probable', () => {
  const b = battle(mon(25, ['protect', 'thunder-shock'], { abilityChoice: 'static' }), snorlax());
  const ev = turn(b, 'protect', 'tackle');
  assert.ok(has(ev, (e) => e.t === 'protected' && e.side === 0));
  assert.equal(dmgOn(ev, 0), 0);
  let failures = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const c = battle(mon(25, ['protect'], { abilityChoice: 'static' }), snorlax(), seed);
    turn(c, 'protect', 'growl');
    if (has(turn(c, 'protect', 'growl'), (e) => e.t === 'nothing' && e.side === 0)) failures++;
  }
  assert.ok(failures > 10 && failures < 30, `${failures}`);
});

test('Sustituto recibe los golpes y bloquea los movimientos de estado', () => {
  const b = battle(snorlax(['substitute', 'tackle']), mon(25, ['thunder-wave', 'thunder-shock'], { abilityChoice: 'static' }));
  turn(b, 'substitute', 'thunder-wave');
  const f = active(b, 0);
  assert.equal(f.hp, f.stats.hp - Math.floor(f.stats.hp / 4));
  assert.ok(f.vol.substitute > 0);
  const hp = f.hp;
  const ev = turn(b, 'tackle', 'thunder-shock');
  assert.ok(has(ev, (e) => e.t === 'subDamage' && e.side === 0));
  assert.equal(active(b, 0).hp, hp);
});

test('Púas y Trampa Rocas dañan al entrar, según el tipo', () => {
  const b = battle(snorlax(['spikes', 'stealth-rock']), [snorlax(['growl']), mon(6, ['growl'], { abilityChoice: 'blaze' })]);
  turn(b, 'spikes', 'growl');
  turn(b, 'stealth-rock', 'growl');
  const ev = turn(b, 'spikes', { type: 'switch', to: 1 });
  const charizard = active(b, 1);
  assert.equal(charizard.speciesName, 'Charizard');
  assert.ok(has(ev, (e) => e.t === 'hurt' && e.cause === 'stealthrock' && e.amount === Math.floor(charizard.stats.hp / 2)));
  assert.ok(!has(ev, (e) => e.t === 'hurt' && e.cause === 'spikes'));
  assert.deepEqual(publicState(b).sides[1].hazards, { spikes: 2, stealthrock: true, stickyweb: false });
});

test('Relevo pasa las mejoras de stats al que entra', () => {
  const b = battle([mon(123, ['swords-dance', 'baton-pass'], { abilityChoice: 'swarm' }), snorlax()], snorlax(['growl', 'tackle']));
  turn(b, 'swords-dance', 'growl');
  turn(b, 'baton-pass', 'tackle');
  assert.equal(active(b, 0).speciesName, 'Snorlax');
  assert.equal(active(b, 0).boosts.atk, 1);
});

test('Espacio Raro hace que el más lento actúe primero', () => {
  const b = battle(snorlax(['trick-room', 'tackle']), mon(101, ['tackle'], { abilityChoice: 'static' }));
  turn(b, 'trick-room', 'tackle');
  const ev = turn(b, 'tackle', 'tackle');
  const order = ev.filter((e) => e.t === 'move').map((e) => e.side);
  assert.deepEqual(order, [0, 1]);
});

test('Mofa impide los movimientos de estado y Otra Vez obliga a repetir', () => {
  const b = battle(mon(248, ['taunt', 'encore'], { abilityChoice: 'sand-stream' }), snorlax(['growl', 'tackle']));
  turn(b, 'taunt', 'growl');
  assert.ok(!validActions(b, 1).some((a) => a.type === 'move' && active(b, 1).moves[a.move].key === 'growl'));
  const c = battle(mon(248, ['encore', 'crunch'], { abilityChoice: 'sand-stream', level: 30 }), snorlax(['growl', 'tackle'], { level: 60 }));
  turn(c, 'crunch', 'growl');
  turn(c, 'encore', 'tackle');
  assert.deepEqual(validActions(c, 1).filter((a) => a.type === 'move'), [{ type: 'move', move: idx(c, 1, 'tackle') }]);
});

test('Contraataque devuelve el doble del daño físico recibido', () => {
  const b = battle(mon(202, ['counter'], { abilityChoice: 'shadow-tag' }), snorlax());
  const ev = turn(b, 'counter', 'tackle');
  const taken = dmgOn(ev, 0);
  assert.ok(taken > 0);
  assert.equal(dmgOn(ev, 1), taken * 2);
});

test('Superdiente quita la mitad de los PS actuales', () => {
  const b = battle(mon(20, ['super-fang'], { abilityChoice: 'guts' }), snorlax());
  const before = active(b, 1).hp;
  turn(b, 'super-fang', 'growl');
  assert.equal(active(b, 1).hp, before - Math.floor(before / 2));
});

test('Premonición golpea dos turnos después y Deseo cura al turno siguiente', () => {
  const b = battle(mon(65, ['future-sight', 'wish'], { abilityChoice: 'synchronize' }), snorlax(['growl']));
  turn(b, 'future-sight', 'growl');
  assert.ok(!has(turn(b, 'wish', 'growl'), (e) => e.t === 'futureHit'));
  active(b, 0).hp = 10;
  const ev = turn(b, 'wish', 'growl');
  assert.ok(has(ev, (e) => e.t === 'futureHit' && e.side === 1));
  assert.ok(has(ev, (e) => e.t === 'wish' && e.side === 0));
  assert.ok(active(b, 0).hp > 10);
});

test('Canto Mortal debilita a los dos en 3 turnos', () => {
  const b = battle(mon(91, ['perish-song', 'withdraw'], { abilityChoice: 'shell-armor' }), snorlax(['growl']));
  turn(b, 'perish-song', 'growl');
  turn(b, 'withdraw', 'growl');
  turn(b, 'withdraw', 'growl');
  turn(b, 'withdraw', 'growl');
  assert.equal(b.status, 'finished');
  assert.equal(b.winner, null);
});

test('Metrónomo y Sonámbulo llaman a otro movimiento', () => {
  const b = battle(mon(35, ['metronome'], { abilityChoice: 'magic-guard' }), snorlax(['growl']));
  const ev = turn(b, 'metronome', 'growl');
  assert.ok(has(ev, (e) => e.t === 'move' && e.side === 0 && e.called));
  const c = battle(snorlax(['sleep-talk', 'body-slam']), mon(25, ['growl'], { abilityChoice: 'static' }));
  active(c, 0).status = 'slp';
  active(c, 0).statusTurns = 3;
  assert.ok(has(turn(c, 'sleep-talk', 'growl'), (e) => e.t === 'move' && e.side === 0 && e.key === 'body-slam' && e.called));
});

test('Patada Baja depende del peso del rival', () => {
  const light = battle(mon(68, ['low-kick'], { abilityChoice: 'guts' }), mon(25, ['growl'], { abilityChoice: 'static' }));
  const heavy = battle(mon(68, ['low-kick'], { abilityChoice: 'guts' }), snorlax(['growl']));
  turn(light, 'low-kick', 'growl');
  turn(heavy, 'low-kick', 'growl');
  assert.equal(light.sides[0].team[0].vol.lastMove, 'low-kick');
});

test('Remolino arrastra al rival, salvo que tenga Arraigo', () => {
  const b = battle(mon(16, ['whirlwind'], { abilityChoice: 'keen-eye' }), [snorlax(['growl', 'ingrain']), mon(25, ['growl'], { abilityChoice: 'static' })]);
  assert.ok(has(turn(b, 'whirlwind', 'growl'), (e) => e.t === 'dragged' && e.side === 1));
  assert.equal(b.sides[1].active, 1);
  const c = battle(mon(16, ['whirlwind'], { abilityChoice: 'keen-eye' }), [snorlax(['growl', 'ingrain']), mon(25, ['growl'], { abilityChoice: 'static' })]);
  turn(c, 'whirlwind', 'ingrain');
  assert.equal(c.sides[1].active, 0);
  assert.ok(active(c, 1).vol.ingrain);
});

test('Transformación copia tipos, stats y movimientos del rival', () => {
  const b = battle(mon(132, ['transform'], { abilityChoice: 'limber' }), mon(6, ['flamethrower', 'growl'], { abilityChoice: 'blaze' }));
  turn(b, 'transform', 'growl');
  assert.deepEqual(active(b, 0).types, active(b, 1).types);
  assert.equal(active(b, 0).moves[0].key, 'flamethrower');
});

test('Campana Cura cura a todo el equipo', () => {
  const b = battle([mon(113, ['heal-bell'], { abilityChoice: 'natural-cure' }), snorlax()], snorlax(['growl']));
  b.sides[0].team[0].status = 'par';
  b.sides[0].team[1].status = 'brn';
  turn(b, 'heal-bell', 'growl');
  assert.equal(b.sides[0].team[0].status, null);
  assert.equal(b.sides[0].team[1].status, null);
});

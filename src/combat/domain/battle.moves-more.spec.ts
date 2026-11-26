import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit, validActions, publicState } from './battle.js';
import { rng } from '../../shared/domain/random.js';
import { MOVE_RULES } from './rules/move-rules.js';
import { moveData } from './moves.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
let n = 0;
const mon = (finalID, moves, extra: any = {}): any => ({ id: `m${n++}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, learned: moves, moveset: moves, ...extra });
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
const snorlax = (moves = ['tackle', 'growl'], extra?) => mon(143, moves, { abilityChoice: 'thick-fat', ...extra });

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
  assert.ok(f.volatiles.substitute > 0);
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
  const c = battle(mon(248, ['encore', 'crunch'], { abilityChoice: 'sand-stream' }), snorlax(['growl', 'tackle']));
  active(c, 0).stats.spd = 1;
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
  assert.equal(light.sides[0].team[0].volatiles.lastMove, 'low-kick');
});

test('Remolino arrastra al rival, salvo que tenga Arraigo', () => {
  const b = battle(mon(16, ['whirlwind'], { abilityChoice: 'keen-eye' }), [snorlax(['growl', 'ingrain']), mon(25, ['growl'], { abilityChoice: 'static' })]);
  assert.ok(has(turn(b, 'whirlwind', 'growl'), (e) => e.t === 'dragged' && e.side === 1));
  assert.equal(b.sides[1].active, 1);
  const c = battle(mon(16, ['whirlwind'], { abilityChoice: 'keen-eye' }), [snorlax(['growl', 'ingrain']), mon(25, ['growl'], { abilityChoice: 'static' })]);
  turn(c, 'whirlwind', 'ingrain');
  assert.equal(c.sides[1].active, 0);
  assert.ok(active(c, 1).volatiles.ingrain);
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

test('Rayo Solar carga un turno sin atacar y golpea al siguiente', () => {
  const b = battle(mon(3, ['solar-beam', 'tackle'], { abilityChoice: 'overgrow' }), snorlax(['growl']));
  const first = turn(b, 'solar-beam', 'growl');
  assert.ok(has(first, (e) => e.t === 'charging' && e.side === 0 && e.key === 'solar-beam'));
  assert.ok(!has(first, (e) => e.t === 'move' && e.side === 0));
  assert.equal(dmgOn(first, 1), 0);
  assert.deepEqual(validActions(b, 0), [{ type: 'move', move: idx(b, 0, 'solar-beam') }]);
  assert.ok(dmgOn(turn(b, 'solar-beam', 'growl'), 1) > 0);
});

test('Excavar esquiva los golpes mientras carga, salvo Terremoto', () => {
  const b = battle(mon(50, ['dig'], { abilityChoice: 'sand-veil' }), snorlax(['tackle']));
  const ev = turn(b, 'dig', 'tackle');
  assert.ok(has(ev, (e) => e.t === 'charging' && e.hidden));
  assert.ok(has(ev, (e) => e.t === 'miss' && e.side === 1));
  assert.equal(dmgOn(ev, 0), 0);
  const c = battle(mon(50, ['dig'], { abilityChoice: 'sand-veil' }), snorlax(['earthquake']));
  assert.ok(dmgOn(turn(c, 'dig', 'earthquake'), 0) > 0);
});

const dealtTo = (ev, s) => ev.filter((e) => e.t === 'damage' && e.side === s);
const failedFor = (ev, s, reason) => has(ev, (e) => e.t === 'nothing' && e.side === s && e.reason === reason);
const moveSlot = (b, s, key) => validActions(b, s).some((a) => a.type === 'move' && active(b, s).moves[a.move].key === key);

test('Mano Rápida solo funciona si el rival iba a usar un ataque con prioridad, y lo hace retroceder', () => {
  const quiet = battle(snorlax(['upper-hand']), snorlax(['growl', 'quick-attack']));
  assert.ok(failedFor(turn(quiet, 'upper-hand', 'growl'), 0, 'upperHand'));
  const rushed = battle(snorlax(['upper-hand']), snorlax(['growl', 'quick-attack']));
  const ev = turn(rushed, 'upper-hand', 'quick-attack');
  assert.equal(dealtTo(ev, 1).length, 1);
  assert.equal(dealtTo(ev, 0).length, 0, 'the foe flinched');
});

test('Poltergeist falla si el rival no lleva objeto', () => {
  const machamp = () => mon(68, ['growl'], { abilityChoice: 'guts' });
  const empty = battle(snorlax(['poltergeist']), machamp());
  assert.ok(failedFor(turn(empty, 'poltergeist', 'growl'), 0, 'noItem'));
  const holding = battle(snorlax(['poltergeist']), machamp());
  active(holding, 1).item = 'leftovers';
  let landed = 0;
  for (let i = 0; i < 5 && !landed; i++) landed = dealtTo(turn(holding, 'poltergeist', 'growl'), 1).length;
  assert.equal(landed, 1);
});

test('Liofilización es supereficaz contra el tipo Agua', () => {
  const water = battle(snorlax(['freeze-dry']), mon(134, ['growl'], { abilityChoice: 'water-absorb' }));
  assert.equal(dealtTo(turn(water, 'freeze-dry', 'growl'), 1)[0].eff, 2);
  const gyarados = battle(snorlax(['freeze-dry']), mon(130, ['growl'], { abilityChoice: 'intimidate' }));
  assert.equal(dealtTo(turn(gyarados, 'freeze-dry', 'growl'), 1)[0].eff, 4);
});

test('Alquitranazo baja la Velocidad y duplica el daño del Fuego', () => {
  const b = battle(snorlax(['tar-shot', 'flamethrower']), snorlax(['growl']));
  turn(b, 'tar-shot', 'growl');
  assert.equal(active(b, 1).boosts.spd, -1);
  assert.ok(active(b, 1).volatiles.tarShot);
  assert.equal(dealtTo(turn(b, 'flamethrower', 'growl'), 1)[0].eff, 2);
});

test('Triple Axel sube de poder en cada golpe y Presión Ruda depende de los PS del rival', () => {
  const axel = MOVE_RULES['triple-axel'];
  assert.deepEqual([0, 1, 2].map((hit) => axel.hitPower(null, null, hit)), [20, 40, 60]);
  const press = MOVE_RULES['hard-press'];
  const at = (hp: number): any => ({ hp, stats: { hp: 100 } });
  assert.equal(press.power(null, null, at(100), null), 100);
  assert.equal(press.power(null, null, at(25), null), 25);
  assert.equal(press.power(null, null, at(0), null), 1);
  assert.ok(moveData('hard-press').supported);
});

test('Ráfaga Escamas tira la precisión en cada uno de sus 10 golpes', () => {
  const hitCounts = new Set<number>();
  for (let seed = 1; seed <= 20; seed++) {
    const b = battle(snorlax(['population-bomb']), mon(213, ['growl'], { abilityChoice: 'sturdy' }), seed);
    hitCounts.add(dealtTo(turn(b, 'population-bomb', 'growl'), 1).length);
  }
  assert.ok(hitCounts.has(10), [...hitCounts].join());
  assert.ok([...hitCounts].some((count) => count > 0 && count < 10), [...hitCounts].join());
});

test('Desahogo duplica su poder si al usuario le bajaron una característica en el turno', () => {
  const calm = battle(snorlax(['lash-out']), snorlax(['splash']), 3);
  active(calm, 1).stats.spd = 999;
  const provoked = battle(snorlax(['lash-out']), snorlax(['growl']), 3);
  active(provoked, 1).stats.spd = 999;
  const calmDamage = dmgOn(turn(calm, 'lash-out', 'splash'), 1);
  const provokedDamage = dmgOn(turn(provoked, 'lash-out', 'growl'), 1);
  assert.ok(provokedDamage > calmDamage * 1.2, `${provokedDamage} vs ${calmDamage}`);
});

test('Lluvia de Púas duplica su poder contra un rival envenenado', () => {
  const clean = battle(snorlax(['barb-barrage']), snorlax(['splash']), 4);
  const poisoned = battle(snorlax(['barb-barrage']), snorlax(['splash']), 4);
  active(poisoned, 1).status = 'psn';
  assert.ok(dmgOn(turn(poisoned, 'barb-barrage', 'splash'), 1) > dmgOn(turn(clean, 'barb-barrage', 'splash'), 1) * 1.5);
});

test('Meteoimpacto ignora la habilidad del rival', () => {
  const guarded = battle(snorlax(['iron-head']), mon(292, ['growl'], { abilityChoice: 'wonder-guard' }));
  assert.equal(dealtTo(turn(guarded, 'iron-head', 'growl'), 1).length, 0, 'Wonder Guard blocks a neutral hit');
  const broken = battle(snorlax(['sunsteel-strike']), mon(292, ['growl'], { abilityChoice: 'wonder-guard' }));
  assert.equal(dealtTo(turn(broken, 'sunsteel-strike', 'growl'), 1).length, 1);
});

test('Fitoimpulso tiene prioridad en el Campo de Hierba', () => {
  const plain = battle(snorlax(['grassy-glide']), snorlax(['tackle']));
  active(plain, 0).stats.spd = 1;
  assert.deepEqual(turn(plain, 'grassy-glide', 'tackle').filter((e) => e.t === 'move').map((e) => e.side), [1, 0]);
  const grassy = battle(snorlax(['grassy-glide']), snorlax(['tackle']));
  active(grassy, 0).stats.spd = 1;
  grassy.field.terrain = 'grassy';
  grassy.field.terrainTurns = 5;
  assert.deepEqual(turn(grassy, 'grassy-glide', 'tackle').filter((e) => e.t === 'move').map((e) => e.side), [0, 1]);
});

test('Electrorrayo y Rayo Meteórico suben el Ataque Especial al cargar, y Electrorrayo no carga con lluvia', () => {
  const dry = battle(snorlax(['electro-shot']), snorlax(['splash']));
  const charging = turn(dry, 'electro-shot', 'splash');
  assert.ok(has(charging, (e) => e.t === 'charging' && e.side === 0));
  assert.equal(active(dry, 0).boosts.satk, 1);
  const rainy = battle(snorlax(['electro-shot']), snorlax(['splash']));
  rainy.field.weather = 'rain';
  rainy.field.weatherTurns = 5;
  const ev = turn(rainy, 'electro-shot', 'splash');
  assert.ok(!has(ev, (e) => e.t === 'charging'));
  assert.equal(dealtTo(ev, 1).length, 1);
  assert.equal(active(rainy, 0).boosts.satk, 1);
  const meteor = battle(snorlax(['meteor-beam']), snorlax(['splash']));
  turn(meteor, 'meteor-beam', 'splash');
  assert.equal(active(meteor, 0).boosts.satk, 1);
});

test('Garra Nociva a veces envenena, paraliza o duerme', () => {
  const statuses = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    const b = battle(snorlax(['dire-claw']), snorlax(['splash']), seed);
    turn(b, 'dire-claw', 'splash');
    statuses.add(active(b, 1).status);
  }
  for (const status of ['psn', 'par', 'slp', null]) assert.ok(statuses.has(status), `${status}`);
});

test('Hacha de Piedra deja Trampa Rocas en el lado del rival', () => {
  const b = battle(snorlax(['stone-axe']), snorlax(['splash']));
  const ev = turn(b, 'stone-axe', 'splash');
  if (dealtTo(ev, 1).length) assert.equal(b.sides[1].hazards.stealthrock, true);
  const sure = battle(snorlax(['stone-axe']), snorlax(['splash']), 7);
  for (let i = 0; i < 4 && !sure.sides[1].hazards.stealthrock; i++) turn(sure, 'stone-axe', 'splash');
  assert.equal(sure.sides[1].hazards.stealthrock, true);
});

test('Envidia Ardiente quema y Voz Cautivadora confunde al rival que subió características en el turno', () => {
  const cases: [string, (fighter: any) => boolean][] = [['burning-jealousy', (fighter) => fighter.status === 'brn'], ['alluring-voice', (fighter) => !!fighter.volatiles.confusion]];
  for (const [move, check] of cases) {
    const idle = battle(snorlax([move]), snorlax(['splash', 'swords-dance']));
    active(idle, 1).stats.spd = 999;
    turn(idle, move, 'splash');
    assert.ok(!check(active(idle, 1)), `${move} without a boost`);
    const boosted = battle(snorlax([move]), snorlax(['splash', 'swords-dance']));
    active(boosted, 1).stats.spd = 999;
    turn(boosted, move, 'swords-dance');
    assert.ok(check(active(boosted, 1)), `${move} after a boost`);
  }
});

test('Golpe Mordaza impide los movimientos de sonido por dos turnos', () => {
  const b = battle(snorlax(['throat-chop', 'splash']), snorlax(['hyper-voice', 'tackle']));
  turn(b, 'throat-chop', 'tackle');
  assert.ok(!moveSlot(b, 1, 'hyper-voice'));
  turn(b, 'splash', 'tackle');
  turn(b, 'splash', 'tackle');
  assert.ok(moveSlot(b, 1, 'hyper-voice'));
});

test('Ruido Psíquico impide curarse por dos turnos', () => {
  const b = battle(snorlax(['psychic-noise']), snorlax(['recover', 'tackle']));
  turn(b, 'psychic-noise', 'tackle');
  assert.deepEqual(active(b, 1).volatiles.healBlock, { turns: 1 });
  assert.ok(!moveSlot(b, 1, 'recover'));
});

test('Núcleo Castigo anula la habilidad del rival que ya se movió', () => {
  const first = battle(snorlax(['core-enforcer']), snorlax(['splash']));
  active(first, 0).stats.spd = 999;
  turn(first, 'core-enforcer', 'splash');
  assert.ok(!active(first, 1).volatiles.gastroAcid);
  const second = battle(snorlax(['core-enforcer']), snorlax(['splash']));
  active(second, 0).stats.spd = 1;
  turn(second, 'core-enforcer', 'splash');
  assert.ok(active(second, 1).volatiles.gastroAcid);
});

test('Bomba Caramelo baja la Velocidad del rival al final de tres turnos', () => {
  const b = battle(snorlax(['syrup-bomb', 'splash']), snorlax(['splash']));
  for (let i = 0; i < 4 && !active(b, 1).volatiles.syrupBomb; i++) turn(b, 'syrup-bomb', 'splash');
  const start = active(b, 1).boosts.spd;
  turn(b, 'splash', 'splash');
  turn(b, 'splash', 'splash');
  turn(b, 'splash', 'splash');
  assert.ok(active(b, 1).boosts.spd < start);
  assert.equal(active(b, 1).volatiles.syrupBomb, undefined);
});

test('Patinaje Helado borra el campo, Aria Burbuja cura la quemadura y Puño Plasma electrifica los ataques Normales', () => {
  const spinner = battle(snorlax(['ice-spinner']), snorlax(['splash']));
  spinner.field.terrain = 'psychic';
  spinner.field.terrainTurns = 5;
  turn(spinner, 'ice-spinner', 'splash');
  assert.equal(spinner.field.terrain, null);
  const aria = battle(snorlax(['sparkling-aria']), snorlax(['splash']));
  active(aria, 1).status = 'brn';
  turn(aria, 'sparkling-aria', 'splash');
  assert.equal(active(aria, 1).status, null);
  const fists = battle(snorlax(['plasma-fists']), snorlax(['tackle']));
  active(fists, 0).stats.spd = 999;
  const ev = turn(fists, 'plasma-fists', 'tackle');
  assert.ok(has(ev, (e) => e.t === 'fieldStart' && e.kind === 'iondeluge'));
  assert.ok(has(ev, (e) => e.t === 'move' && e.side === 1 && e.key === 'tackle' && e.type === 'electric'), 'the foe Tackle turns Electric');
  assert.ok(has(ev, (e) => e.t === 'fieldEnd' && e.kind === 'iondeluge'));
});

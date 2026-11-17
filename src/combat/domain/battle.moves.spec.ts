import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit, validActions, publicState } from './battle.js';
import { rng } from '../../catalog/domain/creatures.js';
import { moveData } from './moves.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
// Fixtures carry only the fields the rules read.
const mon = (id, finalID, moves, extra: any = {}): any => ({ id, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, learned: moves, moveset: moves, ...extra });
const battle = (a, b, seed = 1) => createBattle({ id: 'x', random: rng(seed), sides: [{ trainerId: 'a', name: 'A', entries: [a].flat() }, { trainerId: 'b', name: 'B', entries: [b].flat() }] });
const idx = (b, s, key) => b.sides[s].team[b.sides[s].active].moves.findIndex((m) => m.key === key);
const canPick = (b, s, key) => validActions(b, s).some((a) => a.type === 'move' && a.move === idx(b, s, key));
const turn = (b, k0, k1) => {
  const a0 = typeof k0 === 'string' ? { type: 'move', move: idx(b, 0, k0) } : k0;
  const a1 = typeof k1 === 'string' ? { type: 'move', move: idx(b, 1, k1) } : k1;
  submit(b, 0, a0);
  return submit(b, 1, a1) ?? [];
};
const failed = (ev, side, reason) => ev.some((e) => e.t === 'nothing' && e.side === side && e.reason === reason);
const hitOn = (ev, side) => ev.filter((e) => e.t === 'damage' && e.side === side);

const attacker = (moves, extra?) => mon('atk', 68, moves, { abilityChoice: 'guts', ...extra });
const wall = (moves = ['growl', 'tackle', 'swords-dance'], extra?) => mon('def', 143, moves, { abilityChoice: 'thick-fat', level: 60, ...extra });

test('only moves that need items or a double battle stay unselectable', () => {
  for (const id of ['belch', 'trick', 'fling', 'recycle', 'helping-hand', 'follow-me', 'ally-switch', 'magic-room', 'embargo']) assert.equal(moveData(id).supported, false, id);
  for (const id of ['future-sight', 'doom-desire', 'rollout', 'ice-ball', 'uproar', 'rage', 'protect', 'substitute', 'spikes', 'baton-pass', 'metronome', 'sleep-talk', 'transform', 'counter', 'trick-room']) assert.equal(moveData(id).supported, true, id);
});

test('Sorpresa and Escaramuza only work on the first action after entering', () => {
  const b = battle([mon('p', 57, ['fake-out', 'karate-chop']), mon('q', 68, ['tackle'])], wall());
  const first = turn(b, 'fake-out', 'growl');
  assert.equal(hitOn(first, 1).length, 1);
  assert.ok(first.some((e) => e.t === 'cant' && e.reason === 'flinch' && e.side === 1));
  assert.ok(!canPick(b, 0, 'fake-out'));
  turn(b, 'karate-chop', 'growl');
  turn(b, { type: 'switch', to: 1 }, 'growl');
  turn(b, { type: 'switch', to: 0 }, 'growl');
  assert.equal(hitOn(turn(b, 'fake-out', 'growl'), 1).length, 1);
  const fi = battle(mon('v', 127, ['first-impression']), wall());
  assert.equal(hitOn(turn(fi, 'first-impression', 'growl'), 1).length, 1);
  assert.ok(!canPick(fi, 0, 'first-impression'));
});

test('Golpe Bajo only works if the rival is about to attack', () => {
  const b = battle(mon('a', 359, ['sucker-punch']), wall());
  assert.ok(failed(turn(b, 'sucker-punch', 'growl'), 0, 'suckerPunch'));
  assert.equal(hitOn(turn(b, 'sucker-punch', 'tackle'), 1).length, 1);
});

test('Puño Certero fails if the user is hit first', () => {
  const b = battle(attacker(['focus-punch']), wall());
  const hit = turn(b, 'focus-punch', 'tackle');
  assert.ok(hit.some((e) => e.t === 'focus' && e.side === 0));
  assert.ok(failed(hit, 0, 'lostFocus'));
  assert.equal(hitOn(turn(b, 'focus-punch', 'growl'), 1).length, 1);
});

test('Comesueños needs a sleeping rival and Ronquido a sleeping user', () => {
  const b = battle(mon('g', 94, ['dream-eater', 'snore']), wall());
  assert.ok(failed(turn(b, 'dream-eater', 'growl'), 0, 'notAsleep'));
  assert.ok(!canPick(b, 0, 'snore'));
  b.sides[1].team[0].status = 'slp';
  b.sides[1].team[0].statusTurns = 3;
  assert.equal(hitOn(turn(b, 'dream-eater', 'growl'), 1).length, 1);
  b.sides[0].team[0].status = 'slp';
  b.sides[0].team[0].statusTurns = 3;
  assert.equal(hitOn(turn(b, 'snore', 'growl'), 1).length, 1);
});

test('Último Recurso needs every other move used first', () => {
  const b = battle(mon('e', 133, ['last-resort', 'tackle']), wall());
  assert.ok(!canPick(b, 0, 'last-resort'));
  turn(b, 'tackle', 'growl');
  assert.equal(hitOn(turn(b, 'last-resort', 'growl'), 1).length, 1);
});

function damageWith(user, foe, key, setup: (b: any) => unknown = () => {}, seed = 3) {
  const b = battle(user, foe, seed);
  setup(b);
  return hitOn(turn(b, key, 'growl'), 1)[0]?.amount ?? 0;
}

test('power that depends on the battle: Erupción, Imagen, Infortunio, Acróbata', () => {
  const typhlosion = mon('t', 157, ['eruption'], { abilityChoice: 'blaze' });
  const full = damageWith(typhlosion, wall(), 'eruption');
  const half = damageWith(typhlosion, wall(), 'eruption', (b) => (b.sides[0].team[0].hp = Math.floor(b.sides[0].team[0].stats.hp / 2)));
  assert.ok(half < full * 0.6 && half > full * 0.35, `${half} vs ${full}`);

  const plain = damageWith(attacker(['facade']), wall(), 'facade');
  const burned = damageWith(attacker(['facade'], { abilityChoice: 'no-guard' }), wall(), 'facade', (b) => (b.sides[0].team[0].status = 'brn'));
  assert.ok(burned > plain * 1.7, `${burned} vs ${plain}`);

  const gengar = mon('g', 94, ['hex']);
  const slowbro = mon('s', 80, ['growl'], { abilityChoice: 'oblivious', level: 60 });
  const calm = damageWith(gengar, slowbro, 'hex');
  const statused = damageWith(gengar, slowbro, 'hex', (b) => (b.sides[1].team[0].status = 'par'));
  assert.ok(statused > calm * 1.7, `${statused} vs ${calm}`);

  assert.ok(damageWith(mon('h', 237, ['acrobatics']), wall(), 'acrobatics') > damageWith(mon('h', 237, ['aerial-ace']), wall(), 'aerial-ace') * 1.5);
});

test('Falsotortazo always leaves the rival with at least 1 HP', () => {
  const b = battle(mon('s', 212, ['false-swipe'], { level: 100 }), mon('c', 10, ['string-shot'], { level: 5 }));
  turn(b, 'false-swipe', 'string-shot');
  assert.equal(b.sides[1].team[0].hp, 1);
});

test('Patada Salto Alta hurts the user when it does not connect', () => {
  const b = battle(mon('h', 106, ['high-jump-kick'], { abilityChoice: 'limber' }), mon('g', 94, ['growl']));
  const ev = turn(b, 'high-jump-kick', 'growl');
  assert.ok(ev.some((e) => e.t === 'immune'));
  assert.ok(ev.some((e) => e.t === 'hurt' && e.side === 0 && e.cause === 'crash'));
});

test('Enfado locks the user for 2 or 3 turns and then confuses it', () => {
  const b = battle(mon('d', 149, ['outrage', 'dragon-dance'], { level: 30 }), wall(undefined, { level: 100 }));
  turn(b, 'outrage', 'growl');
  assert.deepEqual(validActions(b, 0), [{ type: 'move', move: idx(b, 0, 'outrage') }]);
  let confused = false;
  for (let i = 0; i < 3 && !confused; i++) {
    const forced = validActions(b, 0)[0] as { type: 'move'; move: number };
    if (forced.move !== idx(b, 0, 'outrage') || validActions(b, 0).length > 1) break;
    confused = turn(b, forced, 'growl').some((e) => e.t === 'volatile' && e.kind === 'confusion' && e.side === 0);
  }
  assert.ok(confused);
  assert.ok(validActions(b, 0).length > 1);
});

test('Atadura traps the rival and hurts it 1/8 each turn', () => {
  const b = battle([mon('a', 24, ['wrap']), mon('z', 41, ['bite'])], [wall(), mon('w2', 25, ['growl'])]);
  const ev = turn(b, 'wrap', 'growl');
  assert.ok(ev.some((e) => e.t === 'volatile' && e.kind === 'bound' && e.side === 1));
  assert.ok(ev.some((e) => e.t === 'hurt' && e.side === 1 && e.cause === 'bound'));
  assert.ok(!validActions(b, 1).some((a) => a.type === 'switch'));
  assert.ok(publicState(b).sides[1].team[0].volatiles.bound);
});

test('Ida y Vuelta switches the user out, and Cola Dragón drags the rival out', () => {
  const b = battle([mon('s', 123, ['u-turn']), mon('z', 41, ['bite'])], [wall(), mon('w2', 25, ['growl'])]);
  const ev = turn(b, 'u-turn', 'growl');
  assert.equal(b.sides[0].active, 1);
  assert.equal(b.phase, 'choose');
  const out = ev.findIndex((e) => e.t === 'switchOut' && e.side === 0);
  const foeMove = ev.findIndex((e) => e.t === 'move' && e.side === 1);
  assert.ok(out > 0 && out < foeMove);
  assert.ok(ev.some((e) => e.t === 'boost' && e.side === 0 && e.stat === 'atk' && ev.indexOf(e) > foeMove));
  assert.equal(b.sides[0].team[1].boosts.atk, -1);
  assert.equal(b.sides[0].team[0].boosts.atk, 0);

  const pick = battle([mon('s', 123, ['u-turn']), mon('z', 41, ['bite']), mon('y', 25, ['growl'])], [wall(), mon('w2', 25, ['growl'])]);
  const first = turn(pick, 'u-turn', 'tackle');
  assert.equal(pick.phase, 'switchout');
  assert.deepEqual(validActions(pick, 0), [{ type: 'switch', to: 1 }, { type: 'switch', to: 2 }]);
  assert.ok(!first.some((e) => e.t === 'move' && e.side === 1));
  const rest = submit(pick, 0, { type: 'switch', to: 2 });
  assert.equal(pick.sides[0].active, 2);
  assert.ok(rest.some((e) => e.t === 'move' && e.side === 1));
  assert.ok(rest.some((e) => e.t === 'damage' && e.side === 0));
  assert.equal(pick.sides[0].team[0].hp, pick.sides[0].team[0].stats.hp);
  assert.equal(pick.phase, 'choose');

  let dragged = false;
  for (let seed = 1; seed < 20 && !dragged; seed++) {
    const d = battle(mon('d', 149, ['dragon-tail'], { level: 70 }), [wall(), mon('w2', 25, ['growl'])], seed);
    const ev = turn(d, 'dragon-tail', 'growl');
    if (!hitOn(ev, 1).length) continue;
    assert.ok(ev.some((e) => e.t === 'dragged' && e.side === 1));
    assert.equal(d.sides[1].active, 1);
    dragged = true;
  }
  assert.ok(dragged);
});

test('Meteorobola takes the type of the weather, Plancha uses the Defense, Llama Final removes Fire', () => {
  const b = battle(mon('c', 351, ['weather-ball', 'rain-dance']), wall());
  turn(b, 'rain-dance', 'growl');
  assert.ok(turn(b, 'weather-ball', 'growl').some((e) => e.t === 'move' && e.type === 'water'));

  const shuckle = (moves) => mon('s', 213, moves, { abilityChoice: 'sturdy' });
  assert.ok(damageWith(shuckle(['body-press']), wall(), 'body-press') > damageWith(shuckle(['cross-chop']), wall(), 'cross-chop') * 2);

  const fire = battle(mon('f', 6, ['burn-up'], { level: 30 }), wall(undefined, { level: 100 }));
  turn(fire, 'burn-up', 'growl');
  assert.ok(!fire.sides[0].team[0].types.includes('fire'));
  assert.ok(!canPick(fire, 0, 'burn-up'));
});

test('the AI does not pick a move that is sure to fail', async () => {
  const { scoreMove } = await import('./ai.js');
  const b = battle(mon('p', 57, ['fake-out', 'karate-chop']), wall());
  assert.ok(scoreMove(b, 0, idx(b, 0, 'fake-out')) > 0);
  turn(b, 'karate-chop', 'growl');
  assert.equal(scoreMove(b, 0, idx(b, 0, 'fake-out')), 0);
});

test('Impresionar makes the foe flinch about 30% of the time, but only when it hits first', () => {
  const flinches = (fast, slow, user) => {
    let count = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const b = battle(mon('a', fast, user === 0 ? ['astonish'] : ['tackle']), mon('b', slow, user === 1 ? ['astonish'] : ['tackle']), seed);
      const events = turn(b, user === 0 ? 'astonish' : 'tackle', user === 1 ? 'astonish' : 'tackle');
      if (events.some((e) => e.t === 'cant' && e.reason === 'flinch')) count++;
    }
    return count;
  };
  const faster = flinches(94, 80, 0);
  assert.ok(faster > 35 && faster < 90, `${faster}/200`);
  assert.equal(flinches(94, 80, 1), 0);
});

test('spectators see both whole teams, while a player only sees the foes that came out', () => {
  const b = battle([mon('a', 25, ['tackle']), mon('b', 1, ['tackle'])], [mon('c', 4, ['tackle']), mon('d', 7, ['tackle'])]);
  const asPlayer = publicState(b, 0).sides[1].team;
  assert.equal(asPlayer[0].hidden, undefined);
  assert.equal(asPlayer[1].hidden, true);
  const asSpectator = publicState(b, null).sides;
  assert.ok(asSpectator.every((side) => side.team.every((f) => !f.hidden && f.name)));
});

test('Present with its rival already fainted reports no target instead of throwing', () => {
  for (let seed = 1; seed <= 30; seed++) {
    const b = battle([mon('e', 101, ['explosion']), mon('q', 68, ['tackle'])], mon('d', 225, ['present'], { level: 70 }), seed);
    const events = turn(b, 'explosion', 'present');
    assert.ok(events.some((e) => e.t === 'notarget' && e.side === 1), `seed ${seed}`);
  }
});

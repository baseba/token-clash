import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit, publicState } from '../server/battle.js';
import { rng, moveData } from '../server/creatures.js';

const IV = { hp: 15, atk: 15, def: 15, spd: 15 };
const mon = (id, finalID, moves, extra = {}) => ({ id, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, learned: moves, moveset: moves, ...extra });
const attacker = (extra) => mon('atk', 68, ['body-slam', 'flamethrower', 'brick-break', 'defog'], { abilityChoice: 'guts', ...extra });
const defender = (extra) => mon('def', 122, ['reflect', 'light-screen', 'aurora-veil', 'growl'], { abilityChoice: 'soundproof', ...extra });

function battle(seed, a = attacker(), d = defender()) {
  return createBattle({ id: 'x', random: rng(seed), sides: [{ trainerId: 'a', name: 'A', entries: [a] }, { trainerId: 'b', name: 'B', entries: [d] }] });
}

const moveIdx = (b, s, key) => b.sides[s].team[0].moves.findIndex((m) => m.key === key);
const play = (b, k0, k1) => {
  submit(b, 0, { type: 'move', move: moveIdx(b, 0, k0) });
  return submit(b, 1, { type: 'move', move: moveIdx(b, 1, k1) });
};
const hitOnDefender = (events) => events.find((e) => e.t === 'damage' && e.side === 1);

function compare(screens, key, { a, d } = {}) {
  const pairs = [];
  for (let seed = 1; pairs.length < 15; seed++) {
    const plain = battle(seed, a, d);
    const shielded = battle(seed, a, d);
    shielded.sides[1].screens = { ...screens };
    const before = hitOnDefender(play(plain, key, 'growl'));
    const after = hitOnDefender(play(shielded, key, 'growl'));
    if (before && after && !before.crit && !after.crit) pairs.push([before.amount, after.amount]);
  }
  return pairs;
}
const halved = (pairs) => pairs.every(([full, half]) => Math.abs(half - full / 2) <= 1);
const untouched = (pairs) => pairs.every(([full, other]) => full === other);

test('the barrier moves work in Token Clash', () => {
  for (const id of ['reflect', 'light-screen', 'aurora-veil', 'defog']) assert.ok(moveData(id).supported, id);
});

test('Reflejo halves physical damage and leaves special damage alone', () => {
  assert.ok(halved(compare({ reflect: 5 }, 'body-slam')));
  assert.ok(untouched(compare({ reflect: 5 }, 'flamethrower')));
});

test('Pantalla de Luz halves special damage and leaves physical damage alone', () => {
  assert.ok(halved(compare({ lightscreen: 5 }, 'flamethrower')));
  assert.ok(untouched(compare({ lightscreen: 5 }, 'body-slam')));
});

test('Velo Aurora halves both kinds and does not stack with Reflejo', () => {
  assert.ok(halved(compare({ auroraveil: 5 }, 'body-slam')));
  assert.ok(halved(compare({ auroraveil: 5 }, 'flamethrower')));
  assert.ok(halved(compare({ auroraveil: 5, reflect: 5 }, 'body-slam')));
});

test('Allanamiento ignores the barriers', () => {
  assert.ok(untouched(compare({ reflect: 5 }, 'body-slam', { a: attacker({ finalID: 41, baseID: 41, abilityChoice: 'infiltrator' }) })));
});

test('a critical hit goes through the barrier', () => {
  let checked = 0;
  for (let seed = 1; checked < 3 && seed < 3000; seed++) {
    const plain = battle(seed);
    const shielded = battle(seed);
    shielded.sides[1].screens = { reflect: 5 };
    const before = hitOnDefender(play(plain, 'body-slam', 'growl'));
    const after = hitOnDefender(play(shielded, 'body-slam', 'growl'));
    if (!before?.crit || !after?.crit) continue;
    assert.equal(after.amount, before.amount);
    checked++;
  }
  assert.equal(checked, 3);
});

test('a barrier lasts five turns, counting the one it went up, and cannot be stacked', () => {
  const b = battle(7, attacker(), defender({ level: 100 }));
  const first = play(b, 'body-slam', 'reflect');
  assert.ok(first.some((e) => e.t === 'screen' && e.side === 1 && e.screen === 'reflect'));
  assert.equal(publicState(b).sides[1].screens.reflect, 4);
  const again = play(b, 'body-slam', 'reflect');
  assert.ok(again.some((e) => e.t === 'nothing' && e.side === 1));
  let endedOn = null;
  for (let turn = 3; turn <= 6 && endedOn === null; turn++) {
    const ev = play(b, 'body-slam', 'growl');
    if (ev.some((e) => e.t === 'screenEnd' && e.screen === 'reflect' && e.cause === 'time')) endedOn = turn;
  }
  assert.equal(endedOn, 5);
  assert.deepEqual(publicState(b).sides[1].screens, {});
});

test('Velo Aurora only works under hail or snow', () => {
  const dry = battle(3);
  assert.ok(play(dry, 'body-slam', 'aurora-veil').some((e) => e.t === 'nothing' && e.side === 1));
  const snowy = battle(3);
  snowy.field.weather = 'snow';
  snowy.field.weatherTurns = 5;
  assert.ok(play(snowy, 'body-slam', 'aurora-veil').some((e) => e.t === 'screen' && e.screen === 'auroraveil'));
});

test('Demolición breaks the barriers before hitting at full power', () => {
  const b = battle(11);
  b.sides[1].screens = { reflect: 5, lightscreen: 5 };
  const ev = play(b, 'brick-break', 'growl');
  const broke = ev.findIndex((e) => e.t === 'screenEnd' && e.cause === 'broken');
  assert.ok(broke >= 0);
  assert.ok(ev.findIndex((e) => e.t === 'damage' && e.side === 1) > broke);
  assert.deepEqual(b.sides[1].screens, {});
});

test('Despejar blows away the rival barriers and lowers its evasion', () => {
  const b = battle(5);
  b.sides[1].screens = { reflect: 5 };
  b.sides[0].screens = { lightscreen: 5 };
  const ev = play(b, 'defog', 'growl');
  assert.ok(ev.some((e) => e.t === 'screenEnd' && e.side === 1 && e.cause === 'defog'));
  assert.ok(ev.some((e) => e.t === 'boost' && e.side === 1 && e.stat === 'eva' && e.by === -1));
  assert.deepEqual(b.sides[1].screens, {});
  assert.equal(b.sides[0].screens.lightscreen > 0, true);
});

test('Antibarrera removes every barrier when it enters', () => {
  const lead = defender({ id: 'lead' });
  const rime = mon('rime', 866, ['growl'], { abilityChoice: 'screen-cleaner' });
  const b = createBattle({ id: 'x', random: rng(2), sides: [{ trainerId: 'a', name: 'A', entries: [lead, rime] }, { trainerId: 'b', name: 'B', entries: [defender()] }] });
  b.sides[0].screens = { reflect: 5 };
  b.sides[1].screens = { lightscreen: 3 };
  submit(b, 0, { type: 'switch', to: 1 });
  const ev = submit(b, 1, { type: 'move', move: moveIdx(b, 1, 'growl') });
  assert.equal(ev.filter((e) => e.t === 'screenEnd' && e.cause === 'cleaner').length, 2);
  assert.deepEqual([b.sides[0].screens, b.sides[1].screens], [{}, {}]);
});

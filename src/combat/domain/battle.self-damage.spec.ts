import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit, STRUGGLE_MOVE } from './battle.js';
import { rng } from '../../shared/domain/random.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
let n = 0;
const mon = (finalID, moves, extra: any = {}): any => ({ id: `m${n++}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV, learned: moves, moveset: moves, ...extra });
const battle = (a, b, seed = 1) => createBattle({ id: 'x', random: rng(seed), sides: [{ trainerId: 'a', name: 'A', entries: [a].flat() }, { trainerId: 'b', name: 'B', entries: [b].flat() }] });
const active = (b, s) => b.sides[s].team[b.sides[s].active];
const idx = (b, s, key) => active(b, s).moves.findIndex((m) => m.key === key);
const turn = (b, k0, k1) => {
  submit(b, 0, { type: 'move', move: typeof k0 === 'number' ? k0 : idx(b, 0, k0) });
  return submit(b, 1, { type: 'move', move: idx(b, 1, k1) }) ?? [];
};
const selfHurt = (ev) => ev.filter((e) => e.t === 'hurt' && e.side === 0).map((e) => [e.cause, e.amount]);
const fainted = (ev, side) => ev.some((e) => e.t === 'faint' && e.side === side);
const dealt = (ev) => ev.filter((e) => e.side === 1 && (e.t === 'damage' || e.t === 'subDamage')).reduce((sum, e) => sum + e.amount, 0);

const snorlax = (moves = ['splash'], extra?) => mon(143, moves, { abilityChoice: 'thick-fat', ...extra });
const clefable = (moves) => mon(36, moves, { abilityChoice: 'magic-guard' });

test('recoil is the share of the damage dealt, rounded like the games', () => {
  for (const [move, share, user] of [['double-edge', 33 / 100, 128], ['take-down', 1 / 4, 128], ['head-smash', 1 / 2, 76], ['volt-tackle', 33 / 100, 26], ['wood-hammer', 33 / 100, 389], ['submission', 1 / 4, 68]] as const) {
    const ev = turn(battle(mon(user, [move]), snorlax()), move, 'splash');
    assert.deepEqual(selfHurt(ev), [['recoil', Math.round(dealt(ev) * share)]], move);
  }
});

test('recoil counts the damage a substitute takes, and can knock out the user', () => {
  const b = battle(mon(128, ['double-edge', 'splash']), snorlax(['substitute', 'splash']));
  turn(b, 'splash', 'substitute');
  const ev = turn(b, 'double-edge', 'splash');
  assert.deepEqual(selfHurt(ev), [['recoil', Math.round(dealt(ev) * 33 / 100)]]);
  const last = battle(mon(128, ['double-edge']), snorlax());
  active(last, 0).hp = 1;
  assert.ok(fainted(turn(last, 'double-edge', 'splash'), 0));
  assert.equal(last.status, 'finished');
});

test('Cabeza Roca and Muro Mágico stop recoil, and there is none without damage', () => {
  assert.deepEqual(selfHurt(turn(battle(mon(76, ['double-edge'], { abilityChoice: 'rock-head' }), snorlax()), 'double-edge', 'splash')), []);
  assert.deepEqual(selfHurt(turn(battle(clefable(['double-edge']), snorlax()), 'double-edge', 'splash')), []);
  assert.deepEqual(selfHurt(turn(battle(mon(128, ['double-edge']), snorlax(['protect'])), 'double-edge', 'protect')), []);
  assert.deepEqual(selfHurt(turn(battle(mon(128, ['double-edge']), mon(94, ['splash'])), 'double-edge', 'splash')), []);
});

test('Cabeza Sorpresa and Metaláser cost half the max HP even when blocked, but not under Humedad', () => {
  for (const [move, user] of [['mind-blown', 6], ['steel-beam', 376]] as const) {
    const b = battle(mon(user, [move]), snorlax(['protect']));
    assert.deepEqual(selfHurt(turn(b, move, 'protect')), [['recoil', Math.round(active(b, 0).stats.hp / 2)]], move);
    const rockHead = battle(mon(user, [move], { abilityChoice: 'rock-head' }), snorlax());
    assert.equal(selfHurt(turn(rockHead, move, 'splash')).length, 1, `${move} with Cabeza Roca`);
    assert.deepEqual(selfHurt(turn(battle(clefable([move]), snorlax()), move, 'splash')), [], `${move} with Muro Mágico`);
  }
  assert.deepEqual(selfHurt(turn(battle(mon(6, ['mind-blown']), mon(195, ['splash'], { abilityChoice: 'damp' })), 'mind-blown', 'splash')), []);
});

test('a kick that fails or is blocked costs half the max HP, unless the user has Muro Mágico', () => {
  for (const move of ['high-jump-kick', 'jump-kick', 'axe-kick']) {
    const b = battle(mon(106, [move]), mon(94, ['splash']));
    assert.deepEqual(selfHurt(turn(b, move, 'splash')), [['crash', Math.floor(active(b, 0).stats.hp / 2)]], move);
    assert.equal(selfHurt(turn(battle(mon(106, [move]), snorlax(['protect'])), move, 'protect')).length, 1, `${move} into Protección`);
  }
  assert.deepEqual(selfHurt(turn(battle(clefable(['high-jump-kick']), mon(94, ['splash'])), 'high-jump-kick', 'splash')), []);
});

test('Explosión and Autodestrucción always knock out the user, except under Humedad', () => {
  for (const move of ['explosion', 'self-destruct', 'misty-explosion']) {
    for (const foe of [snorlax(['protect']), mon(94, ['protect'])]) assert.ok(fainted(turn(battle([mon(76, [move]), snorlax()], foe), move, 'protect'), 0), move);
    const damp = turn(battle([mon(76, [move]), snorlax()], mon(195, ['splash'], { abilityChoice: 'damp' })), move, 'splash');
    assert.ok(!fainted(damp, 0), `${move} under Humedad`);
  }
});

test('Legado only knocks out the user when it reaches the rival', () => {
  assert.ok(fainted(turn(battle([mon(94, ['memento']), snorlax()], snorlax()), 'memento', 'splash'), 0));
  assert.ok(!fainted(turn(battle([mon(94, ['memento']), snorlax()], snorlax(['protect'])), 'memento', 'protect'), 0));
  const sub = battle([mon(94, ['memento', 'splash']), snorlax()], snorlax(['substitute', 'splash']));
  turn(sub, 'splash', 'substitute');
  assert.ok(!fainted(turn(sub, 'memento', 'splash'), 0));
  const evasive = battle([mon(94, ['memento']), snorlax()], snorlax());
  active(evasive, 1).boosts.eva = 6;
  const missed = turn(evasive, 'memento', 'splash');
  assert.ok(missed.some((e) => e.t === 'miss'));
  assert.ok(!fainted(missed, 0));
});

test('Sacrificio deals the user\'s HP and knocks it out only if it hits', () => {
  const b = battle([mon(68, ['final-gambit']), snorlax()], snorlax());
  const hp = active(b, 0).hp;
  const ev = turn(b, 'final-gambit', 'splash');
  assert.equal(dealt(ev), hp);
  assert.ok(fainted(ev, 0));
  assert.ok(!fainted(turn(battle([mon(68, ['final-gambit']), snorlax()], mon(94, ['splash'])), 'final-gambit', 'splash'), 0));
});

test('HP costs ignore Muro Mágico, as in the games', () => {
  const drum = battle(clefable(['belly-drum']), snorlax());
  assert.deepEqual(selfHurt(turn(drum, 'belly-drum', 'splash')), [['cost', Math.floor(active(drum, 0).stats.hp / 2)]]);
  const sub = battle(clefable(['substitute']), snorlax());
  assert.deepEqual(selfHurt(turn(sub, 'substitute', 'splash')), [['cost', Math.floor(active(sub, 0).stats.hp / 4)]]);
  const split = battle(clefable(['pain-split']), snorlax());
  active(split, 1).hp = 10;
  turn(split, 'pain-split', 'splash');
  assert.ok(active(split, 0).hp < active(split, 0).stats.hp);
});

test('Sustituto fails for a Pokémon with 1 max HP', () => {
  const b = battle(mon(292, ['substitute'], { abilityChoice: 'wonder-guard' }), snorlax());
  const ev = turn(b, 'substitute', 'splash');
  assert.deepEqual(selfHurt(ev), []);
  assert.equal(active(b, 0).volatiles.substitute, undefined);
  assert.equal(active(b, 0).hp, 1);
});

test('Cola Sustituta needs more than half the max HP, rounded up', () => {
  const b = battle([mon(930, ['shed-tail']), snorlax()], snorlax());
  const user = active(b, 0);
  user.stats.hp = 287;
  user.hp = 144;
  const ev = turn(b, 'shed-tail', 'splash');
  assert.deepEqual(selfHurt(ev), []);
  assert.equal(user.hp, 144);
});

test('Filetear and Alma Estruendo only cost HP when a stat goes up', () => {
  const fillet = battle(mon(978, ['fillet-away']), snorlax());
  Object.assign(active(fillet, 0).boosts, { atk: 6, satk: 6, spd: 6 });
  assert.deepEqual(selfHurt(turn(fillet, 'fillet-away', 'splash')), []);
  const soul = battle(mon(784, ['clangorous-soul']), snorlax());
  const max = active(soul, 0).stats.hp;
  const ev = turn(soul, 'clangorous-soul', 'splash');
  assert.deepEqual(selfHurt(ev), [['cost', Math.floor((max * 33) / 100)]]);
  assert.ok(ev.findIndex((e) => e.t === 'boost' && e.side === 0) < ev.findIndex((e) => e.t === 'hurt' && e.side === 0));
});

test('Forcejeo costs a quarter of the max HP, through Cabeza Roca but not Muro Mágico', () => {
  const b = battle(mon(76, ['tackle'], { abilityChoice: 'rock-head' }), snorlax());
  active(b, 0).pp.tackle = 0;
  assert.deepEqual(selfHurt(turn(b, STRUGGLE_MOVE, 'splash')), [['recoil', Math.round(active(b, 0).stats.hp / 4)]]);
  const guarded = battle(clefable(['tackle']), snorlax());
  active(guarded, 0).pp.tackle = 0;
  assert.deepEqual(selfHurt(turn(guarded, STRUGGLE_MOVE, 'splash')), []);
});

test('Explosión hits with 250 power, Autodestrucción with 200, and Explosión Bruma gets ×1.5 on Campo de Niebla', () => {
  const blast = (move, user, seed, setup: (b: any) => void = () => {}) => {
    const b = battle([mon(user, [move]), snorlax()], snorlax(), seed);
    active(b, 1).stats.hp = active(b, 1).hp = 100_000;
    setup(b);
    return dealt(turn(b, move, 'splash'));
  };
  for (const seed of [1, 2, 3]) {
    const ratio = blast('explosion', 76, seed) / blast('self-destruct', 76, seed);
    assert.ok(ratio > 1.22 && ratio < 1.28, `seed ${seed}: ${ratio}`);
    const misty = blast('misty-explosion', 36, seed, (b) => Object.assign(b.field, { terrain: 'misty', terrainTurns: 5 })) / blast('misty-explosion', 36, seed);
    assert.ok(misty > 1.47 && misty < 1.53, `seed ${seed}: ${misty}`);
  }
});

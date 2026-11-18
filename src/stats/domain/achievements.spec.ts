import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyBlocker, isUnlocked, lookBlocker, recordOf, spriteProgress, UNLOCKS } from './achievements.js';
import { DOWNLOADED_SPRITES, isShopTrainer, STARTER_SPRITES, TRAINER_SPRITES } from '../../catalog/domain/trainer-sprites.js';

const IV = { hp: 15, atk: 15, def: 15, satk: 15, sdef: 15, spd: 15 };
const entry = (finalID: number, extra: any = {}): any => ({ id: `e${finalID}-${extra.shiny ? 's' : 'n'}`, finalID, baseID: finalID, rarity: 'common', shiny: false, level: 50, ivs: IV, ...extra });
const GROUND = [27, 50, 74, 95, 104, 111, 194, 207, 231, 246, 259, 290, 322, 328, 339];
const record = ({ roster = [], wins = 0, losses = 0, challenges = [], tournaments = [], rankedFirst = false, team = [], totalTokens = 0 }: any = {}) =>
  recordOf({ trainer: { id: 'me', roster, wins, losses, totalTokens }, team, challenges, tournaments, rankedFirst });
const duel = (n: number, winnerId: string, extra: any = {}): any => ({ id: `c${n}`, hostId: 'me', guestId: 'rival', hostTeam: [], status: 'finished', mode: 'team', createdAt: n, finishedAt: n, winnerId, ...extra });

test('every trainer sprite is either earned with an achievement or sold, and every original is earned', () => {
  for (const key of TRAINER_SPRITES) assert.equal([UNLOCKS.has(key), isShopTrainer(key)].filter(Boolean).length, 1, key);
  for (const key of DOWNLOADED_SPRITES) assert.ok(UNLOCKS.has(key), key);
  const newcomer = record({ roster: [entry(25)] });
  for (const key of STARTER_SPRITES) assert.ok(isUnlocked(newcomer, key), `${key} comes with the first Pokémon`);
});

test('class trainers ask for what they are about, harder the rarer they are', () => {
  const water = [7, 54, 60, 72, 79].map((id) => entry(id));
  assert.ok(!isUnlocked(record({ roster: water.slice(0, 2) }), 'fisherman'));
  assert.ok(isUnlocked(record({ roster: water.slice(0, 3) }), 'fisherman'), 'a common one: 3 of its type');
  assert.ok(!isUnlocked(record({ roster: water.slice(0, 4) }), 'scuba_diver_m'));
  assert.ok(isUnlocked(record({ roster: water }), 'scuba_diver_m'), 'a rare one: 5 of its type');
  assert.ok(isUnlocked(record({ roster: [entry(110)] }), 'rocket_grunt_m'), 'a Weezing is enough for a Rocket grunt');
  assert.ok(!isUnlocked(record({ roster: [entry(109)] }), 'rocket_grunt_m'), 'only fully evolved ones count');
  const grunt = spriteProgress(record()).find((p) => p.key === 'rocket_grunt_m')!;
  assert.match(grunt.goals[0].hint!, /Weezing/);
  assert.doesNotMatch(grunt.goals[0].hint!, /Koffing/);
  assert.equal(grunt.rarity, 'common');
  assert.ok(isUnlocked(record({ roster: [entry(6)] }), 'player_m'), 'an evolved starter for the protagonist');
  assert.ok(!isUnlocked(record({ roster: [entry(6)] }), 'nate'), 'Nate wants Unova starters');
  assert.ok(isUnlocked(record({ roster: [entry(497), entry(500)] }), 'nate'));
});

test('a leader with a signature Pokémon can also be unlocked with it and half their type', () => {
  const brock = UNLOCKS.get('brock')!;
  assert.equal(brock.ways.length, 2);
  assert.ok(isUnlocked(record({ roster: [entry(208), entry(76), entry(141)] }), 'brock'), 'Steelix (Onix fully evolved) and half the rock types');
  assert.ok(!isUnlocked(record({ roster: [entry(95), entry(76)] }), 'brock'), 'an Onix is not fully evolved, and 2 rock types are not 3');
  assert.equal(UNLOCKS.get('viola')!.ways.length, 1, 'Vivillon is not in the game yet, so no second way');
});

test('gym leaders of a type unlock with 3, 6, 10 and 15 species of it (the last with a shiny of the type)', () => {
  const ground = (n: number, shiny = false) => record({ roster: GROUND.slice(0, n).map((id, i) => entry(id, { shiny: shiny && i === 0 })) });
  assert.ok(!isUnlocked(ground(2), 'giovanni'));
  assert.ok(isUnlocked(ground(3), 'giovanni'));
  assert.ok(!isUnlocked(ground(5), 'clay'));
  assert.ok(isUnlocked(ground(6), 'clay'));
  const roster = record({ roster: [74, 75, 76, 95, 111, 112, 138, 140, 142, 185, 246, 299, 304, 337, 338].map((id) => entry(id)) });
  assert.ok(isUnlocked(roster, 'roark'));
  assert.ok(!isUnlocked(roster, 'gordie'), 'the last one also needs a shiny');
  assert.ok(isUnlocked(record({ roster: [74, 75, 76, 95, 111, 112, 138, 140, 142, 185, 246, 299, 304, 337, 338].map((id, i) => entry(id, { shiny: i === 0 })) }), 'gordie'));
});

test('a species counts once, however many copies the collection has', () => {
  const copies = record({ roster: [entry(27), entry(27, { shiny: true }), entry(50)] });
  assert.equal(copies.speciesByType.ground, 2);
  assert.ok(!isUnlocked(copies, 'giovanni'));
});

test('the Elite Four need their type and wins against people', () => {
  const roster = GROUND.slice(0, 12).map((id) => entry(id));
  assert.ok(!isUnlocked(record({ roster, wins: 9 }), 'bertha'));
  assert.ok(isUnlocked(record({ roster, wins: 10 }), 'bertha'));
});

test('champions come from the Pokédex, tournaments and the ranking; Red has two ways', () => {
  const kanto = record({ roster: Array.from({ length: 75 }, (_, i) => entry(i + 1)) });
  assert.ok(kanto.dexByRegion.kanto >= 75);
  assert.ok(isUnlocked(kanto, 'blue'));
  const crown = (size: number): any => ({ id: `t${size}`, status: 'finished', size, champion: 0, seats: [{ id: 'me' }] });
  assert.ok(isUnlocked(record({ tournaments: [crown(4)] }), 'iris'));
  assert.ok(!isUnlocked(record({ tournaments: [crown(4)] }), 'kieran'));
  assert.ok(isUnlocked(record({ tournaments: [crown(16)] }), 'kieran'));
  assert.ok(!isUnlocked(record({ rankedFirst: true, wins: 29 }), 'red'));
  assert.ok(isUnlocked(record({ rankedFirst: true, wins: 30 }), 'red'));
});

test('Leon needs 10 wins in a row against people; AI and tournament battles do not break or count', () => {
  const run = Array.from({ length: 10 }, (_, i) => duel(i, 'me'));
  assert.equal(record({ challenges: run }).bestStreak, 10);
  const broken = [...run.slice(0, 5), duel(4.5, 'rival'), ...run.slice(5)];
  assert.equal(record({ challenges: broken }).bestStreak, 5);
  const withAi = [...run.slice(0, 5), duel(4.5, 'rival', { ai: 'hard', guestId: 'ai:hard' }), ...run.slice(5)];
  assert.ok(isUnlocked(record({ challenges: withAi }), 'leon'));
});

test('villains unlock by beating the AI: a harder level also counts for the easier ones', () => {
  const beat = (ai: string, mode = 'team') => record({ challenges: [duel(1, 'me', { ai, mode, guestId: `ai:${ai}` })] });
  assert.ok(!isUnlocked(beat('mid'), 'archer'));
  assert.ok(isUnlocked(beat('hard'), 'archer'));
  assert.ok(!isUnlocked(beat('hard'), 'maxie'));
  assert.ok(isUnlocked(beat('skynet'), 'maxie'));
  assert.ok(isUnlocked(beat('skynet'), 'ghetsis'));
  assert.ok(isUnlocked(beat('easy', 'random'), 'cheryl'));
  assert.ok(!isUnlocked(beat('easy', 'random'), 'giacomo'));
  assert.ok(!isUnlocked(beat('easy'), 'cheryl'));
});

test('specials: shinies, tokens, a team without repeated types, flawless and low-level wins', () => {
  assert.ok(isUnlocked(record({ roster: [entry(25, { shiny: true })] }), 'collector'));
  assert.ok(isUnlocked(record({ totalTokens: 1_000_000_000 }), 'rich_f'));
  assert.ok(isUnlocked(record({ totalTokens: 10_000_000_000 }), 'rose'));
  const team = [25, 4, 7, 1, 74, 92].map((id) => entry(id));
  assert.ok(!record({ team }).diverseTeam, 'Bulbasaur and Gastly share Poison');
  assert.ok(record({ team: [25, 4, 7, 152, 74, 92].map((id) => entry(id)) }).diverseTeam);
  const final = (hp: number[]) => ({ winner: 0, sides: [{ team: hp.map((h, i) => ({ uid: `u${i}`, hp: h })) }, { team: [] }] });
  assert.ok(isUnlocked(record({ challenges: [duel(1, 'me', { final: final([10, 20, 30]) })] }), 'emmet'));
  assert.ok(!isUnlocked(record({ challenges: [duel(1, 'me', { final: final([10, 0, 30]) })] }), 'emmet'));
  const lowTeam = [0, 1, 2].map((i) => ({ ...entry(25), id: `u${i}`, level: 20 }));
  assert.ok(isUnlocked(record({ challenges: [duel(1, 'me', { hostTeam: lowTeam, final: final([1, 1, 1]) })] }), 'marnie'));
});

test('a recolor on sale unlocks when it is bought, and asks to unlock the original first', () => {
  assert.ok(!isUnlocked(record(), 'leon_shadow'));
  const bought = recordOf({ trainer: { id: 'me', roster: [], wins: 0, losses: 0, owned: ['trainer:leon_shadow'] }, team: [], challenges: [], tournaments: [], rankedFirst: false });
  assert.ok(isUnlocked(bought, 'leon_shadow'));
  const shadow = spriteProgress(record()).find((p) => p.key === 'leon_shadow')!;
  assert.equal(shadow.group, 'shop');
  assert.equal(shadow.goals[0].text, 'Desbloquear a Leon');
});

test('a locked sprite shows the way closest to done', () => {
  const progress = spriteProgress(record({ roster: [entry(27)] })).find((p) => p.key === 'giovanni')!;
  assert.equal(progress.unlocked, false);
  assert.equal(progress.group, 'gym');
  assert.deepEqual(progress.goals.map((g) => [g.have, g.need]), [[1, 3]]);
});

test('a recolored trainer needs its original first, plus what its colors are about', () => {
  const champion = { rankedFirst: true, wins: 30 };
  assert.ok(!isUnlocked(record({ roster: [entry(9), entry(6)] }), 'red_blue'), 'Red is not unlocked yet');
  assert.ok(!isUnlocked(record({ roster: [entry(6)], ...champion }), 'red_blue'));
  assert.ok(isUnlocked(record({ roster: [entry(9)], ...champion }), 'red_blue'), 'Red Azul is Blastoise');
  assert.ok(!isUnlocked(record({ roster: [entry(9)], ...champion }), 'red_charizard'));
  assert.ok(isUnlocked(record({ roster: [entry(6)], ...champion }), 'red_charizard'), 'Red Charizard is Charizard');
  const beatVeryHard = [duel(1, 'me', { ai: 'veryhard', guestId: 'ai:veryhard' })];
  for (const [key, id] of [['maxie_aqua', 382], ['archie_magma', 383]] as const) {
    assert.ok(!isUnlocked(record({ roster: [entry(id)] }), key), key);
    assert.ok(isUnlocked(record({ roster: [entry(id)], challenges: beatVeryHard }), key), key);
  }
  const johto = Array.from({ length: 75 }, (_, i) => entry(152 + i));
  assert.ok(!isUnlocked(record({ roster: johto }), 'lance_emerald'));
  assert.ok(isUnlocked(record({ roster: [...johto, entry(384)] }), 'lance_emerald'));
  const lance = spriteProgress(record()).find((p) => p.key === 'lance_emerald')!;
  assert.equal(lance.group, 'champion');
  assert.deepEqual(lance.goals.map((g) => [g.text, g.need]), [['Desbloquear a Lance', 1], ['Tener a Rayquaza en tu colección', 1]]);
});

test('each partner variant asks for its trainer\'s signature Pokémon on top of the trainer', () => {
  const kanto = Array.from({ length: 75 }, (_, i) => entry(i + 1));
  assert.ok(isUnlocked(record({ roster: kanto }), 'blue'));
  assert.ok(isUnlocked(record({ roster: kanto }), 'blue_red'), 'Charizard (#6) is in the first 75');
  const sinnoh = Array.from({ length: 100 }, (_, i) => entry(387 + i)).filter((e) => e.finalID !== 445);
  assert.ok(!isUnlocked(record({ roster: sinnoh }), 'cynthia_garchomp'));
  assert.ok(isUnlocked(record({ roster: [...sinnoh, entry(445), entry(486)] }), 'cynthia_garchomp'));
});

test('a shop variant of a locked trainer shows both steps: the original first, then buying it', () => {
  const variant = spriteProgress(record()).find((p) => p.key.startsWith('cynthia__') && p.group === 'shop')!;
  assert.deepEqual(variant.goals.map((g) => [g.have, g.need]), [[0, 1], [0, 1]]);
  assert.match(variant.goals[0].text, /Cynthia/);
});

test('an earned color variant asks for its original and Pokémon of the type its color stands for', () => {
  const progress = spriteProgress(record());
  const cynthia = progress.find((p) => p.key.startsWith('cynthia__') && p.group === 'variant')!;
  assert.deepEqual(cynthia.goals.map((g) => g.need), [1, 12], 'the champion first, then 12 of the type: a harder original asks for more');
  assert.equal(cynthia.goals[0].text, 'Desbloquear a Cynthia');
  const gym = progress.find((p) => p.key.startsWith('brock__') && p.group === 'variant');
  if (gym) assert.deepEqual(gym.goals.map((g) => g.need), [1, 8]);
  const common = progress.find((p) => p.key.startsWith('fisherman__') && p.group === 'variant');
  if (common) assert.deepEqual(common.goals.map((g) => g.need), [1, 5]);
});

test('a trainer with several ways to unlock lists all of them, not only the closest', () => {
  const cyrus = spriteProgress(record()).find((p) => p.key === 'cyrus')!;
  assert.ok(cyrus.ways.length >= 2);
  assert.ok(cyrus.ways.some((way) => JSON.stringify(way) === JSON.stringify(cyrus.goals)), 'the closest way is one of them');
});

test('the shop sells a color variant only once its original trainer is unlocked', () => {
  const irisCrown = { id: 't4', status: 'finished', size: 4, champion: 0, seats: [{ id: 'me' }] };
  assert.equal(buyBlocker(record(), 'trainer:iris__sapphire'), 'Primero desbloquea al entrenador original.');
  assert.equal(buyBlocker(record({ tournaments: [irisCrown] }), 'trainer:iris__sapphire'), null);
  assert.equal(buyBlocker(record(), 'ball:gb'), null, 'an item with no original is never blocked here');
  assert.equal(buyBlocker(record(), 'ball:nope'), null, 'an unknown item is left for the purchase itself to reject as not found');
});

test('a look is blocked while locked, with a message that says how to get it', () => {
  const ground = record({ roster: GROUND.slice(0, 3).map((id) => entry(id)) });
  assert.equal(lookBlocker(record(), undefined, 'giovanni'), 'Todavía no desbloqueas a ese entrenador.');
  assert.equal(lookBlocker(record(), undefined, 'jacinthe_holo'), 'Ese entrenador se compra en tu perfil.');
  assert.equal(lookBlocker(ground, undefined, 'giovanni'), null);
  assert.equal(lookBlocker(record(), null, 'hiker'), null, 'starters are always free');
});

test('the look a player already wears is never blocked, even if it is locked for them now', () => {
  assert.equal(lookBlocker(record(), 'giovanni', 'giovanni'), null);
  assert.equal(lookBlocker(record(), 'jacinthe_holo', 'jacinthe_holo'), null);
  assert.equal(lookBlocker(record(), 'jacinthe_holo', 'giovanni'), 'Todavía no desbloqueas a ese entrenador.');
});

test('an original never asks for the same Pokémon one of its recolors is named after', () => {
  for (const [key, unlock] of UNLOCKS) {
    if (unlock.group === 'variant') continue;
    const asked = new Set(unlock.ways.flat().map((rule) => rule(record()).text).filter((text) => text.startsWith('Tener a ')));
    for (const [other, recolor] of UNLOCKS) {
      if (other === key || !other.startsWith(`${key}_`)) continue;
      for (const text of recolor.ways.flat().map((rule) => rule(record()).text)) assert.ok(!asked.has(text), `${key} and ${other} both ask: ${text}`);
    }
  }
});

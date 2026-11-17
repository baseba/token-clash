import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isUnlocked, recordOf, spriteProgress, UNLOCKS } from './achievements.js';
import { STARTER_SPRITES, TRAINER_SPRITES } from '../../catalog/domain/trainer-sprites.js';

const IV = { hp: 15, atk: 15, def: 15, satk: 15, sdef: 15, spd: 15 };
const entry = (finalID: number, extra: any = {}): any => ({ id: `e${finalID}-${extra.shiny ? 's' : 'n'}`, finalID, baseID: finalID, rarity: 'common', shiny: false, level: 50, ivs: IV, ...extra });
const GROUND = [27, 50, 74, 95, 104, 111, 194, 207, 231, 246, 259, 290, 322, 328, 339];
const record = ({ roster = [], wins = 0, losses = 0, challenges = [], tournaments = [], rankedFirst = false, team = [], totalTokens = 0 }: any = {}) =>
  recordOf({ trainer: { id: 'me', roster, wins, losses, totalTokens }, team, challenges, tournaments, rankedFirst });
const duel = (n: number, winnerId: string, extra: any = {}): any => ({ id: `c${n}`, hostId: 'me', guestId: 'rival', hostTeam: [], status: 'finished', mode: 'team', createdAt: n, finishedAt: n, winnerId, ...extra });

test('every trainer sprite is either a starter or has a way to unlock it', () => {
  for (const key of TRAINER_SPRITES) assert.ok(STARTER_SPRITES.includes(key) !== UNLOCKS.has(key), key);
  assert.ok(STARTER_SPRITES.includes('player_m') && STARTER_SPRITES.includes('hiker'));
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

test('a locked sprite shows the way closest to done', () => {
  const progress = spriteProgress(record({ roster: [entry(27)] })).find((p) => p.key === 'giovanni')!;
  assert.equal(progress.unlocked, false);
  assert.equal(progress.group, 'gym');
  assert.deepEqual(progress.goals.map((g) => [g.have, g.need]), [[1, 3]]);
});

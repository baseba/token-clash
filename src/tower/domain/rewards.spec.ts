import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveOrigins, rng, speciesData, speciesIdByName } from '../../catalog/domain/creatures.js';
import { moveData } from '../../combat/domain/moves.js';
import { levelMovesUpTo } from './growth.js';
import { BRACE_EVS, cordEvolution, evsAfter, idealNature, ivsAfter, MAX_IV, MOVE_REWARDS, MUSHROOM_REACH, REWARD_KINDS, REWARD_TIERS, WEIGHTS_IVS, REWARDS_PER_REST, restRewards, stoneEvolution, TIER_ORDER, TWIST_REWARDS, vitaminRoom, type RestContext, type Reward } from './rewards.js';

const NO_EVS = { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 };
const target = (uid: string, name: string, known: string[] = [], level = 10, final = name) => ({
  uid,
  speciesId: speciesIdByName(name) as number,
  finalId: speciesIdByName(final) as number,
  level,
  known,
  abilities: [],
  evs: { ...NO_EVS },
  ivs: { hp: 31, atk: 10, def: 31, satk: 31, sdef: 31, spd: 31 },
  nature: null as string | null,
  shiny: false,
});
const plain: RestContext = { floor: 3, boss: false, cap: 20, minTier: 'common', recruitable: true };

test('a rest offers three different rewards, each saying why it fits every party member', () => {
  for (let seed = 0; seed < 20; seed++) {
    const party = [target('a', 'Charmander'), target('b', 'Squirtle')];
    const rewards = restRewards(party, plain, rng(seed));
    assert.equal(rewards.length, REWARDS_PER_REST);
    assert.equal(new Set(rewards.map((reward) => reward.kind)).size, REWARDS_PER_REST);
    for (const reward of rewards) if (reward.kind !== 'egg') assert.deepEqual(Object.keys(reward.reasons).sort(), ['a', 'b']);
  }
});

test('a boss or a tough room promises a rare reward, a hideout an epic one, and a calm room only common ones', () => {
  const party = [target('a', 'Charmander', [], 10, 'Charizard'), target('b', 'Abra', [], 10, 'Alakazam')];
  for (let seed = 0; seed < 30; seed++) {
    const best = (context: RestContext) => Math.max(...restRewards(party, context, rng(seed)).map((reward) => TIER_ORDER.indexOf(reward.tier)));
    assert.ok(best({ ...plain, minTier: 'rare' }) >= 1, `${seed}`);
    assert.ok(restRewards(party, { ...plain, maxTier: 'common' }, rng(seed)).every((reward) => reward.tier === 'common'));
    assert.ok(best({ ...plain, minTier: 'epic' }) >= 1);
  }
  assert.equal(REWARD_TIERS.patch, 'epic');
});

test('a machine or a tutor only fits the Pokémon that can learn its move, and never one it knows', () => {
  for (let seed = 0; seed < 30; seed++) {
    const party = [target('a', 'Charmander', ['flamethrower']), target('b', 'Squirtle')];
    for (const reward of restRewards(party, plain, rng(seed))) {
      if (!MOVE_REWARDS.includes(reward.kind) || reward.kind === 'mushroom') continue;
      assert.ok(reward.fits.length, `${seed}`);
      for (const uid of reward.fits) {
        const mon = party.find((member) => member.uid === uid)!;
        assert.ok(moveOrigins({ finalID: mon.speciesId }).has(reward.move as string));
        assert.ok(!mon.known.includes(reward.move as string));
      }
    }
  }
});

test('Rare Candies give more levels after a boss', () => {
  const candy = (boss: boolean) => {
    for (let seed = 0; seed < 80; seed++) {
      const found = restRewards([target('a', 'Pikachu')], { ...plain, boss, floor: 5 }, rng(seed)).find((reward) => reward.kind === 'candy');
      if (found) return found.levels ?? 0;
    }
    return 0;
  };
  assert.ok(candy(true) > candy(false));
});

test('candies only go to the Pokémon below the level cap, and none are offered when everyone is at it', () => {
  for (let seed = 0; seed < 30; seed++) {
    const rewards = restRewards([target('low', 'Pikachu', [], 8), target('top', 'Eevee', [], 20)], plain, rng(seed));
    const candy = rewards.find((reward) => reward.kind === 'candy');
    if (candy) assert.deepEqual(candy.fits, ['low']);
    assert.ok(!restRewards([target('top', 'Eevee', [], 20)], plain, rng(seed)).some((reward) => reward.kind === 'candy' || reward.kind === 'expCandy'));
  }
});

test('a vitamin adds 32 EVs, never past 252 in a stat or 510 in all', () => {
  assert.equal(vitaminRoom({ ...NO_EVS }, 'atk'), 32);
  assert.equal(vitaminRoom({ ...NO_EVS, atk: 240 }, 'atk'), 12);
  assert.equal(vitaminRoom({ ...NO_EVS, atk: 252, spd: 252, hp: 4 }, 'def'), 2);
  assert.equal(vitaminRoom({ ...NO_EVS, atk: 252, spd: 252, hp: 6 }, 'def'), 0);
});

test('a stone evolves a Pokémon whose next form has no level, once it is near its fair level', () => {
  assert.equal(stoneEvolution({ speciesId: speciesIdByName('Kadabra') as number, finalId: speciesIdByName('Alakazam') as number, level: 34 }), speciesIdByName('Alakazam'));
  assert.equal(stoneEvolution({ speciesId: speciesIdByName('Kadabra') as number, finalId: speciesIdByName('Alakazam') as number, level: 12 }), null);
  assert.equal(stoneEvolution({ speciesId: speciesIdByName('Charmander') as number, finalId: speciesIdByName('Charizard') as number, level: 30 }), null, 'a level evolution comes by leveling');
});

test('a Bottle Cap only fits whoever has that IV below 31, and a Gold one whoever has any', () => {
  const perfect = { ...target('p', 'Squirtle'), ivs: { hp: MAX_IV, atk: MAX_IV, def: MAX_IV, satk: MAX_IV, sdef: MAX_IV, spd: MAX_IV } };
  const party = [target('a', 'Charmander'), perfect];
  for (let seed = 0; seed < 60; seed++)
    for (const reward of restRewards(party, { ...plain, ...TWIST_REWARDS.caps, minTier: 'rare' }, rng(seed))) {
      if (reward.kind === 'goldCap') assert.deepEqual(reward.fits, ['a']);
      if (reward.kind === 'bottleCap') assert.deepEqual(reward.fits, reward.stat === 'atk' ? ['a'] : []);
    }
});

test('rumours change the rewards: more of the favoured kinds, one more offer, sweeter candies', () => {
  const party = [target('a', 'Charmander'), target('b', 'Squirtle')];
  const count = (context: RestContext, kinds: string[]) => Array.from({ length: 80 }, (_, seed) => restRewards(party, context, rng(seed)).filter((reward) => kinds.includes(reward.kind)).length).reduce((a, b) => a + b, 0);
  assert.ok(count({ ...plain, ...TWIST_REWARDS.tutors }, ['tm', 'tutor']) > count(plain, ['tm', 'tutor']));
  assert.equal(restRewards(party, { ...plain, ...TWIST_REWARDS.market }, rng(1)).length, REWARDS_PER_REST + 1);
  const candy = Array.from({ length: 40 }, (_, seed) => restRewards(party, { ...plain, ...TWIST_REWARDS.sweet }, rng(seed))).flat().find((reward) => reward.kind === 'candy');
  assert.equal(candy?.levels, 3);
});

const offered = (party: ReturnType<typeof target>[], context: RestContext, seeds = 120): Reward[] => Array.from({ length: seeds }, (_, seed) => restRewards(party, context, rng(seed))).flat();

test('a powerful machine is epic and 90 power or more; a plain one is under 90 or a status move', () => {
  const party = [target('a', 'Charmander', [], 30, 'Charizard'), target('b', 'Squirtle', [], 30, 'Blastoise')];
  const rewards = offered(party, { ...plain, floor: 30, minTier: 'rare' });
  const powerTms = rewards.filter((reward) => reward.kind === 'powerTm');
  assert.ok(powerTms.length);
  assert.ok(powerTms.every((reward) => reward.tier === 'epic' && (moveData(reward.move as string)?.power ?? 0) >= 90));
  assert.ok(rewards.filter((reward) => reward.kind === 'tm').every((reward) => (moveData(reward.move as string)?.power ?? 0) < 90));
});

test('a Mushroom teaches a level move it would learn within the next 10 levels', () => {
  const party = [target('a', 'Bulbasaur', [], 12)];
  const mushrooms = offered(party, plain).filter((reward) => reward.kind === 'mushroom');
  assert.ok(mushrooms.length);
  for (const reward of mushrooms) assert.ok(levelMovesUpTo(party[0].speciesId, 12 + MUSHROOM_REACH).includes(reward.move as string), reward.move);
});

test('a Wing is for the whole party: it fits everyone with room for its EVs', () => {
  const full = { ...target('full', 'Squirtle'), evs: { hp: 252, atk: 252, def: 6, satk: 0, sdef: 0, spd: 0 } };
  const wings = offered([target('a', 'Charmander'), target('b', 'Pikachu'), full], plain).filter((reward) => reward.kind === 'feather');
  assert.ok(wings.length);
  for (const reward of wings) assert.deepEqual(reward.fits, ['a', 'b']);
});

test('higher floors offer rarer rewards, and one more from floor 25', () => {
  const party = [target('a', 'Charmander', [], 30, 'Charizard'), target('b', 'Abra', [], 30, 'Alakazam')];
  const epics = (floor: number) => offered(party, { ...plain, floor, cap: 40 }).filter((reward) => reward.tier === 'epic').length;
  assert.ok(epics(40) > epics(3));
  assert.equal(restRewards(party, { ...plain, floor: 25 }, rng(1)).length, REWARDS_PER_REST + 1);
});

test('there are rewards of every family in every tier, and a long climb sees most of them', () => {
  for (const tier of TIER_ORDER) assert.ok(REWARD_KINDS.filter((kind) => REWARD_TIERS[kind] === tier).length >= 9, tier);
  const party = [target('a', 'Charmander', [], 18, 'Charizard'), target('b', 'Abra', [], 15, 'Alakazam'), target('c', 'Machop', [], 20, 'Machamp')];
  const seen = new Set(offered(party, { ...plain, floor: 20, cap: 25 }, 300).map((reward) => reward.kind));
  assert.ok(seen.size >= REWARD_KINDS.length - 2, `${REWARD_KINDS.filter((kind) => !seen.has(kind))}`);
});

test('the move families teach what their name says', () => {
  const party = [target('a', 'Charmander', [], 30, 'Charizard'), target('b', 'Squirtle', [], 30, 'Blastoise'), target('c', 'Pikachu', [], 30)];
  const rewards = offered(party, { ...plain, floor: 30, cap: 40 }, 300);
  const typesOf = (uid: string) => speciesData(party.find((member) => member.uid === uid)!.speciesId)?.types ?? [];
  for (const reward of rewards) {
    const move = moveData(reward.move as string);
    if (reward.kind === 'memory' || reward.kind === 'gem') assert.ok(reward.fits.every((uid) => !typesOf(uid).includes(move?.type as string)), `${reward.kind} ${reward.move}`);
    if (reward.kind === 'gem') assert.ok((move?.power ?? 0) <= 75, reward.move);
    if (reward.kind === 'teraShard') assert.ok(reward.fits.every((uid) => typesOf(uid).includes(move?.type as string)) && (move?.power ?? 0) >= 80, reward.move);
    if (reward.kind === 'quickClaw') assert.ok((move?.priority ?? 0) > 0, reward.move);
    if (reward.kind === 'supportTm') assert.equal(move?.category, 'status', reward.move);
  }
});

test('EV and IV rewards stay inside the limits', () => {
  const brace = evsAfter('machoBrace', { ...NO_EVS, atk: 250 }, speciesIdByName('Machop') as number, undefined);
  assert.deepEqual(brace, { hp: BRACE_EVS, atk: 252, def: BRACE_EVS, satk: BRACE_EVS, sdef: BRACE_EVS, spd: BRACE_EVS });
  assert.deepEqual(evsAfter('vitaminBag', { ...NO_EVS }, speciesIdByName('Abra') as number, undefined), { ...NO_EVS, satk: 32, spd: 32 });
  assert.equal(Object.values(evsAfter('machoBrace', { ...NO_EVS, hp: 252, atk: 252 }, 1, undefined)).reduce((sum, value) => sum + value, 0), 510);
  assert.deepEqual(ivsAfter('weights', { hp: 29, atk: 0, def: 31, satk: 10, sdef: 31, spd: 31 }, undefined), { hp: 31, atk: WEIGHTS_IVS, def: 31, satk: 10 + WEIGHTS_IVS, sdef: 31, spd: 31 });
});

test('an ideal Mint gives each one the nature its stats want, and fits only who does not have it', () => {
  assert.equal(idealNature(speciesIdByName('Machop') as number), 'adamant');
  assert.equal(idealNature(speciesIdByName('Abra') as number), 'timid');
  const party = [{ ...target('a', 'Machop'), nature: 'adamant' }, { ...target('b', 'Abra'), nature: 'brave' }];
  for (const reward of offered(party, plain).filter((offer) => offer.kind === 'idealMint')) {
    assert.deepEqual(reward.fits, ['b']);
    assert.equal(reward.natures?.b, 'timid');
  }
});

test('a Linking Cord evolves by level only up to 5 levels early', () => {
  const charmander = speciesIdByName('Charmander') as number;
  const charizard = speciesIdByName('Charizard') as number;
  assert.equal(cordEvolution({ speciesId: charmander, finalId: charizard, level: 11 }), speciesIdByName('Charmeleon'));
  assert.equal(cordEvolution({ speciesId: charmander, finalId: charizard, level: 8 }), null);
  assert.equal(cordEvolution({ speciesId: speciesIdByName('Kadabra') as number, finalId: speciesIdByName('Alakazam') as number, level: 40 }), null, 'a trade evolution takes a stone');
});

test('a Shiny Charm only fits who is not shiny yet', () => {
  const party = [target('a', 'Pikachu'), { ...target('b', 'Eevee'), shiny: true }];
  for (const reward of offered(party, { ...plain, minTier: 'rare' }).filter((offer) => offer.kind === 'shinyCharm')) assert.deepEqual(reward.fits, ['a']);
});

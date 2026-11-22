import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveOrigins, rng, speciesIdByName } from '../../catalog/domain/creatures.js';
import { MAX_IV, REWARD_TIERS, REWARDS_PER_REST, restRewards, stoneEvolution, TIER_ORDER, TWIST_REWARDS, vitaminRoom, type RestContext } from './rewards.js';

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
      if (reward.kind !== 'tm' && reward.kind !== 'tutor') continue;
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

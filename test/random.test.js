import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSave } from '../server/save.js';
import { rng, learnedMoves, moveData, abilityOptions, validMoveset, abilityFor, movesetFor, usableAbility, buildFighter, MOVES_PER_FIGHTER } from '../server/creatures.js';
import { randomParty, randomize, randomAbility, shuffled } from '../server/random.js';
import { PARTY_SIZE } from '../server/preview.js';

const { roster } = parseSave(readFileSync(new URL('./fixtures/export.json', import.meta.url), 'utf8'));

const bigRoster = [1, 4, 7, 25, 52, 68, 94, 122, 143, 6, 9, 3].map((finalID, i) => ({ id: `mon-${i}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 } }));

test('shuffled keeps every item once and leaves the input alone', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  const out = shuffled(items, rng('s'));
  assert.deepEqual([...out].sort(), items);
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7]);
});

test('a random party has six distinct mons from the roster', () => {
  const party = randomParty(bigRoster, rng('party'));
  assert.equal(party.length, PARTY_SIZE);
  assert.equal(new Set(party.map((e) => e.id)).size, PARTY_SIZE);
  const ids = new Set(bigRoster.map((e) => e.id));
  assert.ok(party.every((e) => ids.has(e.id)));
});

test('a random party never repeats a species', () => {
  const twins = [...roster, ...roster.map((e) => ({ ...e, id: `${e.id}-twin` }))];
  for (let seed = 0; seed < 20; seed++) {
    const party = randomParty(twins, rng(seed));
    assert.equal(new Set(party.map((e) => e.finalID)).size, party.length);
    assert.equal(party.length, roster.length);
  }
});

test('a random party takes the shiny or the plain one of a species, never both', () => {
  const both = [...roster, ...roster.map((e) => ({ ...e, id: `${e.id}-twin`, shiny: !e.shiny }))];
  const variants = new Set();
  for (let seed = 0; seed < 40; seed++) {
    const party = randomParty(both, rng(seed));
    assert.equal(new Set(party.map((e) => e.finalID)).size, party.length);
    for (const e of party) variants.add(`${e.finalID}:${!!e.shiny}`);
  }
  assert.equal(variants.size, roster.length * 2);
});

test('a small roster gives every mon it has, without repeats', () => {
  const party = randomParty(roster, rng('small'));
  assert.equal(party.length, roster.length);
  assert.equal(new Set(party.map((e) => e.id)).size, roster.length);
});

test('random moves and ability are legal for each species', () => {
  for (let seed = 0; seed < 20; seed++) {
    for (const e of randomParty(bigRoster, rng(seed))) {
      const usable = learnedMoves(e).filter((id) => moveData(id).supported);
      if (usable.length) {
        assert.ok(validMoveset(e, e.moveset));
        assert.equal(e.moveset.length, Math.min(MOVES_PER_FIGHTER, usable.length));
      }
      const options = abilityOptions(e).map((a) => a.key);
      if (options.length) {
        assert.ok(options.includes(e.abilityChoice));
        assert.equal(abilityFor(e), e.abilityChoice);
      }
    }
  }
});

test('randomize ignores the trainer edits and does not touch the original', () => {
  const original = { ...roster[0], moveset: ['not-a-move'], abilityChoice: 'not-an-ability' };
  const out = randomize(original, rng('r'));
  assert.notEqual(out.moveset?.[0], 'not-a-move');
  assert.notEqual(out.abilityChoice, 'not-an-ability');
  assert.deepEqual(original.moveset, ['not-a-move']);
});

const pikachu = (extra) => ({ id: 'pika', finalID: 25, baseID: 25, rarity: 'rare', level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 }, ...extra });

test('a saved move that does not work is swapped for another learned one at random', () => {
  const e = pikachu({ learned: ['fling'], moveset: ['thunderbolt', 'fling', 'quick-attack'] });
  const moves = movesetFor(e);
  assert.equal(moves.length, 3);
  assert.equal(moves[0], 'thunderbolt');
  assert.equal(moves[2], 'quick-attack');
  assert.ok(!moves.includes('fling'));
  assert.ok(validMoveset(e, moves));
  assert.deepEqual(movesetFor(e), moves);
});

test('with no other move to learn it is left with fewer moves', () => {
  const e = pikachu({ level: 1, learned: ['fling'], moveset: ['growl', 'fling', 'thunder-shock'] });
  assert.deepEqual(movesetFor(e), ['growl', 'thunder-shock']);
});

test('valid saved moves are kept as they are', () => {
  const e = pikachu({ moveset: ['thunderbolt', 'agility'] });
  assert.deepEqual(movesetFor(e), ['thunderbolt', 'agility']);
});

test('a saved ability with no effect is swapped for another of the species that works', () => {
  const meowth = { id: 'm', finalID: 52, baseID: 52, rarity: 'common', level: 20, ivs: {}, ability: 'pickup' };
  assert.ok(!usableAbility('pickup'));
  const got = abilityFor(meowth);
  assert.ok(usableAbility(got));
  assert.ok(abilityOptions(meowth).some((a) => a.key === got));
});

test('a species whose abilities all lack an effect fights without ability', () => {
  const dedenne = { id: 'd', finalID: 702, baseID: 702, rarity: 'rare', level: 30, ivs: { hp: 1, atk: 1, def: 1, spd: 1 }, ability: 'cheek-pouch' };
  assert.equal(abilityFor(dedenne), null);
  assert.equal(buildFighter(dedenne).ability, null);
  assert.equal(randomAbility(dedenne, rng(1)), null);
});

test('random battles never roll a move or ability without effect', () => {
  for (let seed = 0; seed < 30; seed++) {
    for (const e of randomParty(bigRoster, rng(seed))) {
      const f = buildFighter(e);
      assert.ok(f.moves.every((m) => m.supported));
      assert.ok(f.ability === null || usableAbility(f.ability));
    }
  }
});

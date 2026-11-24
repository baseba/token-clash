import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speciesData, speciesIdByName } from '../../catalog/domain/creatures.js';
import { DEX_LIMIT } from '../../catalog/domain/pokedex.js';
import { baseStatTotal } from './growth.js';
import { standInFor, towerSpecies } from './species-pool.js';

const id = (name: string): number => speciesIdByName(name) as number;
const typesOf = (speciesId: number): string[] => speciesData(speciesId)?.types ?? [];

test('the Tower draws from generations 1 to 5, counting as final a species whose evolution came later', () => {
  const pool = towerSpecies();
  assert.ok(pool.every((speciesId) => speciesId >= 1 && speciesId <= DEX_LIMIT));
  for (const name of ['Primeape', 'Bisharp', 'Ursaring', 'Scizor']) assert.ok(pool.includes(id(name)), name);
  assert.ok(!pool.includes(id('Pikachu')), 'a species that still evolves within generation 5 is not final');
});

test('a Pokémon of generations 1 to 5 stays itself', () => {
  assert.equal(standInFor(id('Gengar'), 'seed'), id('Gengar'));
});

test('a later Pokémon is replaced by one of generations 1 to 5 of its types, about as strong and never a legend', () => {
  const tinkaton = id('Tinkaton');
  for (let seed = 0; seed < 20; seed++) {
    const standIn = standInFor(tinkaton, `${seed}`);
    assert.ok(standIn <= DEX_LIMIT);
    assert.ok(typesOf(standIn).some((type) => typesOf(tinkaton).includes(type)));
  }
  const baxcalibur = id('Baxcalibur');
  for (let seed = 0; seed < 20; seed++) {
    const standIn = standInFor(baxcalibur, `${seed}`);
    assert.ok(baseStatTotal(standIn) <= baseStatTotal(baxcalibur) + 30, speciesData(standIn)?.name);
    assert.ok(![id('Kyurem'), id('Latias'), id('Latios')].includes(standIn), speciesData(standIn)?.name);
  }
});

test("a leader's stand-in always has the leader's type", () => {
  const heliolisk = id('Heliolisk');
  for (let seed = 0; seed < 20; seed++) assert.ok(typesOf(standInFor(heliolisk, `${seed}`, 'electric')).includes('electric'));
});

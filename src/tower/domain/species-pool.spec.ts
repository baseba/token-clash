import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speciesIdByName } from '../../catalog/domain/creatures.js';
import { DEX_LIMIT } from '../../catalog/domain/pokedex.js';
import { towerSpecies } from './species-pool.js';

const id = (name: string): number => speciesIdByName(name) as number;

test('the Tower draws final species from every generation, so a species that evolves later is not final', () => {
  const pool = towerSpecies();
  assert.ok(pool.every((speciesId) => speciesId >= 1 && speciesId <= DEX_LIMIT));
  for (const name of ['Scizor', 'Kingambit', 'Annihilape', 'Ursaluna', 'Tinkaton', 'Greninja', 'Decidueye', 'Dragapult']) assert.ok(pool.includes(id(name)), name);
  for (const name of ['Pikachu', 'Bisharp', 'Primeape', 'Ursaring']) assert.ok(!pool.includes(id(name)), `${name} still evolves`);
});

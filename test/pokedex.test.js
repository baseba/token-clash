import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pokedexOf } from '../server/pokedex.js';
import { family } from '../server/creatures.js';

test('owning a Raichu registers its whole line, and a shiny one makes the line shiny', () => {
  const dex = pokedexOf([{ finalID: 26, level: 40, shiny: true }, { finalID: 26, level: 12 }, { finalID: 133, level: 20 }]);
  assert.deepEqual(dex.entries.map((e) => [e.id, e.owned, e.shiny]), [[25, 0, true], [26, 2, true], [133, 1, false], [172, 0, true]]);
  const raichu = dex.entries.find((e) => e.id === 26);
  assert.deepEqual(raichu.levels, [40, 12]);
  assert.equal(raichu.genus, 'Pokémon Ratón');
  assert.ok(raichu.entry.length > 20);
  assert.equal(raichu.height, 0.8);
  assert.deepEqual(raichu.abilities.map((a) => a.hidden), [false, true]);
  assert.equal(dex.registered, 4);
  assert.equal(dex.shinies, 3);
  assert.equal(dex.total, 649);
  assert.equal(dex.generations.length, 5);
});

test('species after the fifth generation stay out of the Pokédex', () => {
  const dex = pokedexOf([{ finalID: 700, level: 30 }, { finalID: 25, level: 30 }]);
  assert.deepEqual(dex.entries.map((e) => e.id), [25, 133, 172]);
  const eevee = pokedexOf([{ finalID: 133, level: 10 }]).entries[0];
  assert.ok(eevee.family.every((f) => f.id <= 649));
});

test('the family shows the whole tree but only names what you registered', () => {
  const eevee = pokedexOf([{ finalID: 136, level: 30 }]).entries.find((e) => e.id === 133);
  const names = new Map(eevee.family.map((f) => [f.id, f.name]));
  assert.equal(names.get(136), 'Flareon');
  assert.equal(names.get(134), null);
  assert.equal(family(25).map((f) => f.id).join(), '172,25,26');
});

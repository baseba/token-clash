import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pokedexOf } from './pokedex.js';
import { family } from './creatures.js';

test('owning a Raichu registers its whole line, and a shiny one makes the line shiny', () => {
  const dex = pokedexOf(<any[]>[{ finalID: 26, level: 40, shiny: true }, { finalID: 26, level: 12 }, { finalID: 133, level: 20 }]);
  assert.deepEqual(dex.entries.map((e) => [e.id, e.owned, e.shiny]), [[25, 0, true], [26, 2, true], [133, 1, false], [172, 0, true]]);
  const raichu = dex.entries.find((e) => e.id === 26);
  assert.deepEqual(raichu.levels, [40, 12]);
  assert.equal(raichu.genus, 'Pokémon Ratón');
  assert.ok(raichu.entry.length > 20);
  assert.equal(raichu.height, 0.8);
  assert.deepEqual(raichu.abilities.map((a) => a.hidden), [false, true]);
  assert.equal(dex.registered, 4);
  assert.equal(dex.shinies, 3);
  assert.equal(dex.total, 1025);
  assert.equal(dex.generations.length, 9);
});

test('species of every generation enter the Pokédex, and the family shows their later evolutions', () => {
  const dex = pokedexOf(<any[]>[{ finalID: 700, level: 30 }, { finalID: 25, level: 30 }, { finalID: 959, level: 50 }]);
  assert.deepEqual(dex.entries.map((e) => e.id), [25, 133, 172, 700, 957, 958, 959]);
  assert.deepEqual(dex.generations.at(-1), [906, 1025]);
  const eevee = pokedexOf(<any[]>[{ finalID: 133, level: 10 }]).entries[0];
  assert.ok(eevee.family.some((f) => f.id === 700), 'Sylveon is part of the Eevee family');
});

test('the family shows the whole tree but only names what you registered', () => {
  const eevee = pokedexOf(<any[]>[{ finalID: 136, level: 30 }]).entries.find((e) => e.id === 133);
  const names = new Map(eevee.family.map((f) => [f.id, f.name]));
  assert.equal(names.get(136), 'Flareon');
  assert.equal(names.get(134), null);
  assert.equal(family(25).map((f) => f.id).join(), '172,25,26');
});

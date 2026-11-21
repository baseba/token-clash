import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speciesIdByName } from '../../catalog/domain/creatures.js';
import { alwaysDamages } from '../../combat/domain/random-party.js';
import { evolutionLevel, expForLevel, expYield, formAtLevel, levelForExp, levelMovesUpTo, movesAtLevel } from './growth.js';

const id = (name: string) => speciesIdByName(name) as number;

test('experience follows the medium-fast curve, level³', () => {
  assert.equal(expForLevel(10), 1000);
  assert.equal(levelForExp(999), 9);
  assert.equal(levelForExp(1000), 10);
  assert.equal(levelForExp(expForLevel(100) * 2), 100);
});

test('a Pokémon below its rival learns faster than one above it, and a boss gives more', () => {
  const rival = { speciesId: id('Geodude'), level: 20 };
  assert.ok(expYield(rival, 15, false) > expYield(rival, 25, false));
  assert.ok(expYield(rival, 20, true) > expYield(rival, 20, false));
});

test('it evolves at the level of its species, towards the form you raised', () => {
  assert.equal(formAtLevel(id('Charizard'), 15), id('Charmander'));
  assert.equal(formAtLevel(id('Charizard'), 16), id('Charmeleon'));
  assert.equal(formAtLevel(id('Charizard'), 36), id('Charizard'));
  assert.equal(formAtLevel(id('Charmeleon'), 60), id('Charmeleon'));
});

test('a stone, trade or friendship evolution happens at the level a level evolution of its strength has', () => {
  const at = (name: string) => evolutionLevel(id(name)) as number;
  assert.ok(Math.abs(at('Alakazam') - at('Gengar')) <= 2, 'two trade evolutions of the same strength, at about the same level');
  assert.ok(Math.abs(at('Machamp') - at('Golem')) <= 3);
  assert.ok(at('Vaporeon') >= 30 && at('Vaporeon') === at('Jolteon'), 'Eevee does not evolve early into a 525 Pokémon');
  assert.ok(at('Arcanine') > at('Ninetales'), 'the stronger form waits longer');
  assert.ok(at('Raichu') >= at('Pikachu') + 6, 'always some levels after the previous form');
  assert.equal(formAtLevel(id('Vaporeon'), at('Vaporeon') - 1), id('Eevee'));
  assert.equal(formAtLevel(id('Vaporeon'), at('Vaporeon')), id('Vaporeon'));
  assert.equal(evolutionLevel(id('Charmander')), null);
});

test('it knows the latest moves learned by level, keeps the chosen ones it has, and always one that hits', () => {
  const learned = levelMovesUpTo(id('Charmander'), 20);
  const moves = movesAtLevel(id('Charmander'), 20, ['scratch']);
  assert.equal(moves[0], 'scratch');
  assert.ok(moves.length <= 4 && moves.every((move) => learned.includes(move)));
  assert.ok(movesAtLevel(id('Magikarp'), 5).some(alwaysDamages));
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lineage, lineageLearnset, learnedMoves, validMoveset } from '../server/creatures.js';

test('a species carries its whole pre-evolution line', () => {
  assert.deepEqual(lineage(26), [26, 25, 172]);
  assert.deepEqual(lineage(136), [136, 133]);
  assert.deepEqual(lineage(172), [172]);
});

test('Raichu can use the moves Pichu and Pikachu learned up to its level', () => {
  const raichu = { finalID: 26, level: 50 };
  const moves = learnedMoves(raichu);
  for (const key of ['thunderbolt', 'charm', 'sweet-kiss', 'nasty-plot', 'thunder', 'agility']) assert.ok(moves.includes(key), key);
  assert.ok(validMoveset(raichu, ['thunder', 'nasty-plot', 'charm', 'thunderbolt']));
  assert.ok(!learnedMoves({ finalID: 26, level: 5 }).includes('thunder'));
});

test('each move keeps the earliest level in the line and the closest species that teaches it', () => {
  const learnset = lineageLearnset(26);
  assert.equal(learnset.get('thunderbolt').from, 26);
  assert.equal(learnset.get('charm').from, 172);
  assert.equal(learnset.get('thunder').from, 25);
  const charizard = lineageLearnset(6);
  assert.deepEqual(charizard.get('dragon-rage'), { level: 16, from: 6 });
});

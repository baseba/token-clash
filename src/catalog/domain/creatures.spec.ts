import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_MOVE_IDS, lineage, lineageLearnset, learnedMoves, moveEntry, moveOrigins, type MajorStatus, type Weather } from './creatures.js';

test('a species carries its whole pre-evolution line', () => {
  assert.deepEqual(lineage(26), [26, 25, 172]);
  assert.deepEqual(lineage(136), [136, 133]);
  assert.deepEqual(lineage(172), [172]);
});

test('Raichu can use every move Pichu and Pikachu learn, whatever its level', () => {
  const raichu = { finalID: 26, level: 5 };
  const moves = learnedMoves(raichu);
  for (const key of ['thunderbolt', 'charm', 'sweet-kiss', 'nasty-plot', 'thunder', 'agility']) assert.ok(moves.includes(key), key);
  assert.ok(!moves.includes('hydro-pump'));
});

test('each move says where it comes from: level first, then TM/HM, tutor, egg and other means', () => {
  const origins = moveOrigins({ finalID: 26, level: 5 });
  assert.equal(origins.get('thunder-shock').origin, 'level');
  assert.equal(origins.get('fling').origin, 'machine');
  assert.equal(origins.get('iron-tail').origin, 'tutor');
  assert.equal(origins.get('thunder-punch').origin, 'tutor');
  assert.equal(origins.get('wish').origin, 'egg');
  assert.equal(origins.get('volt-tackle').origin, 'other');
});

test('each move keeps the earliest level in the line and the closest species that teaches it', () => {
  const learnset = lineageLearnset(26);
  assert.equal(learnset.get('thunderbolt').from, 26);
  assert.equal(learnset.get('charm').from, 172);
  assert.equal(learnset.get('thunder').from, 25);
  const charizard = lineageLearnset(6);
  assert.deepEqual(charizard.get('dragon-rage'), { level: 16, from: 6 });
});

test('movedex.json only names the statuses and weathers the engine knows', () => {
  const statuses: Record<MajorStatus, true> = { brn: true, par: true, psn: true, tox: true, slp: true, frz: true };
  const weathers: Record<Weather, true> = { sun: true, rain: true, sand: true, hail: true, snow: true, harshsun: true, heavyrain: true, winds: true };
  for (const id of ALL_MOVE_IDS()) {
    const move = moveEntry(id)!;
    for (const status of [move.status, ...(move.secondary ?? []).map((s) => s.status)]) if (status) assert.ok(status in statuses, `${id}: ${status}`);
    if (move.weather) assert.ok(move.weather in weathers, `${id}: ${move.weather}`);
  }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSave, SaveError } from '../server/save.js';

const text = readFileSync(new URL('./fixtures/export.json', import.meta.url), 'utf8');

test('reads an export: finished + active, skips released', () => {
  const { roster, totalTokens } = parseSave(text);
  assert.equal(roster.length, 4);
  assert.equal(totalTokens, 17100000000);
  const lux = roster[0];
  assert.deepEqual({ finalID: lux.finalID, shiny: lux.shiny, level: lux.level }, { finalID: 405, shiny: true, level: 100 });
  assert.deepEqual(lux.ivs, { hp: 31, atk: 23, def: 31, satk: 9, sdef: 13, spd: 27 });
  assert.deepEqual([lux.stage, lux.chainLen], [2, 3]);
  const active = roster.find((e) => e.active);
  assert.equal(active.finalID, 432);
  assert.deepEqual([active.stage, active.chainLen], [1, 2]);
  assert.equal(active.level, 92);
  const old = roster.find((e) => e.finalID === 144);
  assert.equal(old.level, 100); // no profile: finished means full level
  assert.ok(old.ivs.hp >= 8 && old.ivs.hp <= 23);
});

test('reads the raw live state file too', () => {
  const raw = JSON.stringify(JSON.parse(text).state);
  assert.equal(parseSave(raw).roster.length, 4);
});

test('drops personal fields', () => {
  const s = JSON.stringify(parseSave(text));
  assert.ok(!s.includes('Mac de prueba'));
});

test('keeps the ability and gender from the profile', () => {
  const { roster } = parseSave(text);
  assert.deepEqual([roster[0].ability, roster[0].abilitySlot, roster[0].gender], ['rivalry', 1, 'male']);
  assert.deepEqual([roster[1].ability, roster[1].gender], [null, null]);
});

test('rejects junk', () => {
  assert.throws(() => parseSave('nope'), SaveError);
  assert.throws(() => parseSave('{"format":"other"}'), SaveError);
  assert.throws(() => parseSave('{"dex":[]}'), SaveError);
  assert.throws(() => parseSave('{"dex":[{"finalID":"x"}]}'), SaveError);
});

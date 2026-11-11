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
  assert.deepEqual(lux.ivs, { hp: 31, atk: 16, def: 22, spd: 27 });
  const active = roster.find((e) => e.active);
  assert.equal(active.finalID, 432);
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
  assert.ok(!s.includes('rivalry'));
});

test('rejects junk', () => {
  assert.throws(() => parseSave('nope'), SaveError);
  assert.throws(() => parseSave('{"format":"other"}'), SaveError);
  assert.throws(() => parseSave('{"dex":[]}'), SaveError);
  assert.throws(() => parseSave('{"dex":[{"finalID":"x"}]}'), SaveError);
});

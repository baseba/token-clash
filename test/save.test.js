import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSave, SaveError, firstOfEachSpecies, uniqueSpecies, uniqueVariants, carryTeam } from '../server/save.js';

const text = readFileSync(new URL('./fixtures/export.json', import.meta.url), 'utf8');

test('reads an export: finished + active, skips released', () => {
  const { roster, totalTokens } = parseSave(text);
  assert.equal(roster.length, 4);
  assert.equal(totalTokens, 17100000000);
  assert.deepEqual(roster.map((e) => e.finalID), [3, 144, 405, 432]);
  const lux = roster.find((e) => e.finalID === 405);
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
  const lux = roster.find((e) => e.finalID === 405);
  const venusaur = roster.find((e) => e.finalID === 3);
  assert.deepEqual([lux.ability, lux.abilitySlot, lux.gender], ['rivalry', 1, 'male']);
  assert.deepEqual([venusaur.ability, venusaur.gender], [null, null]);
});

test('rejects junk', () => {
  assert.throws(() => parseSave('nope'), SaveError);
  assert.throws(() => parseSave('{"format":"other"}'), SaveError);
  assert.throws(() => parseSave('{"dex":[]}'), SaveError);
  assert.throws(() => parseSave('{"dex":[{"finalID":"x"}]}'), SaveError);
});

test('keeps only the first caught of each species, ordered by Pokédex number', () => {
  const c = (id, finalID, caught, order) => ({ e: { id, finalID }, caught, order });
  const kept = firstOfEachSpecies([c('late', 25, Date.parse('2026-10-05'), 0), c('bulba', 1, Date.parse('2026-10-09'), 1), c('early', 25, Date.parse('2026-10-01'), 2), c('raising', 25, Infinity, 3), c('nodate-a', 7, Infinity, 4), c('nodate-b', 7, Infinity, 5)]);
  assert.deepEqual(kept.map((e) => e.id), ['bulba', 'nodate-a', 'early']);

  const twice = JSON.parse(text);
  twice.state.dex.push({ ...twice.state.dex[0], id: '99999999-2222-3333-4444-555555555555', caughtAt: '2026-11-01T00:00:00Z', profile: undefined });
  const { roster } = parseSave(JSON.stringify(twice));
  assert.equal(roster.filter((e) => e.finalID === 405).length, 1);
  assert.equal(roster.find((e) => e.finalID === 405).id, '0b51abcf-fbf7-4712-b832-2a93dd76cc7b');
});

test('a stored roster keeps only the first of each species', () => {
  const roster = [{ id: 'pika-1', finalID: 25 }, { id: 'bulba', finalID: 1 }, { id: 'pika-2', finalID: 25 }, { id: 'pika-3', finalID: 25 }];
  assert.deepEqual(uniqueSpecies(roster).map((e) => e.id), ['pika-1', 'bulba']);
});

test('a team slot held by a dropped repeat goes to the one that stays', () => {
  const before = [{ id: 'pika-1', finalID: 25 }, { id: 'bulba', finalID: 1 }, { id: 'pika-2', finalID: 25 }, { id: 'gone', finalID: 7 }];
  const after = uniqueSpecies(before).filter((e) => e.id !== 'gone');
  assert.deepEqual(carryTeam(['pika-2', 'bulba', 'gone'], before, after), ['pika-1', 'bulba']);
  assert.deepEqual(carryTeam(['pika-1', 'pika-2'], before, after), ['pika-1']);
});

test('a shiny and a plain one of the same species both stay in the collection', () => {
  const c = (id, finalID, shiny, caught, order) => ({ e: { id, finalID, shiny }, caught, order });
  const kept = firstOfEachSpecies([c('plain-late', 25, false, 5, 0), c('shiny-late', 25, true, 6, 1), c('plain-early', 25, false, 1, 2), c('shiny-early', 25, true, 2, 3)]);
  assert.deepEqual(kept.map((e) => e.id), ['plain-early', 'shiny-early']);
  const stored = [{ id: 'p1', finalID: 25 }, { id: 's1', finalID: 25, shiny: true }, { id: 'p2', finalID: 25 }, { id: 's2', finalID: 25, shiny: true }];
  assert.deepEqual(uniqueVariants(stored).map((e) => e.id), ['p1', 's1']);
});

test('a team never carries the shiny and the plain one of a species together', () => {
  const roster = [{ id: 'p1', finalID: 25 }, { id: 's1', finalID: 25, shiny: true }, { id: 'b', finalID: 1 }];
  assert.deepEqual(carryTeam(['s1', 'b', 'p1'], roster, roster), ['s1', 'b']);
});

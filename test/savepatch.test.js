import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { patchSave } from '../public/savepatch.js';
import { parseSave } from '../server/save.js';

const text = readFileSync(new URL('./fixtures/export.json', import.meta.url), 'utf8');
const LUX = '0B51ABCF-FBF7-4712-B832-2A93DD76CC7B';

test('only the edited fields change; everything else stays byte for byte', () => {
  const { text: out, applied, missing } = patchSave(text, [{ id: LUX.toLowerCase(), ability: { name: 'intimidate', slot: 2, hidden: false }, currentMoves: [{ name: 'spark', level: 1 }, { name: 'crunch', level: 42 }] }, { id: 'nope' }]);
  assert.deepEqual([applied, missing], [[LUX.toLowerCase()], ['nope']]);
  assert.ok(out.includes('"seed":8913987956299312698'));
  const lux = JSON.parse(out).state.dex[0].profile;
  assert.equal(lux.abilityName, 'intimidate');
  assert.equal(lux.abilitySlot, 2);
  assert.deepEqual(lux.currentMoves, ['spark', 'crunch']);
  assert.deepEqual(lux.moves.map((m) => m.name), ['crunch', 'spark']);
  const restore = (s) => s.replace(/"abilityName":"[^"]*","abilitySlot":\d+/, '').replace(/,"abilityIsHidden":(true|false)/, '');
  assert.equal(out.length - text.length > 0, true);
  assert.ok(restore(out).includes('"ivs":{"hp":31,"attack":23'));
});

test('replaced moves stay among the learned ones, and reading it back keeps them all', () => {
  const first = patchSave(text, [{ id: LUX, currentMoves: [{ name: 'spark', level: 1 }, { name: 'bite', level: 1 }] }]).text;
  const second = patchSave(first, [{ id: LUX, currentMoves: [{ name: 'thunder-fang', level: 1 }] }]).text;
  const lux = JSON.parse(second).state.dex[0].profile;
  assert.deepEqual(lux.currentMoves, ['thunder-fang']);
  assert.deepEqual(lux.moves.map((m) => m.name).sort(), ['bite', 'crunch', 'spark', 'thunder-fang']);
  const entry = parseSave(second).roster.find((e) => e.finalID === 405);
  assert.deepEqual(entry.moveset, ['thunder-fang']);
  assert.deepEqual(new Set(entry.learned), new Set(['bite', 'crunch', 'spark', 'thunder-fang']));
});

test('a live state file without envelope comes out ready to import, and profiles without moves get them', () => {
  const raw = JSON.stringify(JSON.parse(text).state);
  const active = 'CCCCCCCC-0000-0000-0000-000000000001';
  const out = JSON.parse(patchSave(raw, [{ id: active, currentMoves: [{ name: 'scratch', level: 1 }] }]).text);
  assert.equal(out.format, 'poketokenbar.save');
  assert.deepEqual(out.state.active.profile.currentMoves, ['scratch']);
  assert.deepEqual(out.state.active.profile.moves, [{ name: 'scratch', learnedAtLevel: 1 }]);
});

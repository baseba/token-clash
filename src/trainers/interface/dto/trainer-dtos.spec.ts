// The trainers' DTOs on their own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImportSaveDto } from './import-save.dto.js';
import { BuyDto, EquipDto } from './shop.dto.js';
import { UpdateMonDto } from './update-mon.dto.js';
import { UpdateProfileDto } from './update-profile.dto.js';

test('a missing save keeps its own message, written for the player', () => {
  const missing = ImportSaveDto.safeParse({ name: 'Ana' });
  assert.equal(missing.success, false);
  assert.equal(missing.error!.issues[0].message, 'Falta el archivo.');
  assert.deepEqual(ImportSaveDto.parse({ save: '{}' }), { save: '{}' });
});

test('the profile and a Pokémon take only the expected shapes', () => {
  assert.equal(UpdateProfileDto.safeParse({ team: 'abc' }).success, false);
  assert.equal(UpdateProfileDto.safeParse({ nickname: { id: 'x' } }).success, false);
  assert.equal(UpdateProfileDto.parse({ nickname: null }).nickname, null);
  assert.equal(UpdateMonDto.safeParse({ moves: 'tackle' }).success, false);
  assert.deepEqual(UpdateMonDto.parse({ ability: 'static' }), { ability: 'static' });
});

test('a purchase names one item', () => {
  assert.deepEqual(BuyDto.parse({ item: 'ball:gb' }), { item: 'ball:gb' });
  assert.equal(BuyDto.safeParse({}).success, false);
  assert.equal(BuyDto.safeParse({ item: 42 }).success, false);
});

test('equipping takes a known kind and an item key, or null to take it off', () => {
  assert.deepEqual(EquipDto.parse({ kind: 'ball', key: 'gb' }), { kind: 'ball', key: 'gb' });
  assert.deepEqual(EquipDto.parse({ kind: 'frame', key: null }), { kind: 'frame', key: null });
  assert.equal(EquipDto.safeParse({ kind: 'trainer', key: 'red' }).success, false, 'trainers are a look, not equipment');
  assert.equal(EquipDto.safeParse({ kind: 'ball' }).success, false, 'taking an item off is an explicit null');
});

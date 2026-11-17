// The trainers' DTOs on their own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ImportSaveDto } from './import-save.dto.js';
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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ChooseLookDto } from './choose-look.dto.js';

test('choosing a look names one trainer sprite', () => {
  assert.deepEqual(ChooseLookDto.parse({ avatar: 'hiker' }), { avatar: 'hiker' });
  assert.equal(ChooseLookDto.safeParse({}).success, false);
  assert.equal(ChooseLookDto.safeParse({ avatar: null }).success, false);
});

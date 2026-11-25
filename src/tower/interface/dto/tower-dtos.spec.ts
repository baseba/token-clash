import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DraftDto, EditMonDto, NewClimbDto, RecruitDto, RewardDto, RoomDto } from './tower.dto.js';

test('a climb without length is endless, and only the offered lengths exist', () => {
  assert.deepEqual(NewClimbDto.parse({ difficulty: 'mid' }), { difficulty: 'mid', length: null });
  assert.equal(NewClimbDto.parse({ difficulty: 'hard', length: 25 }).length, 25);
  assert.equal(NewClimbDto.safeParse({ difficulty: 'hard', length: 7 }).success, false);
  assert.equal(NewClimbDto.safeParse({ length: 10 }).success, false);
});

test('the draft, the reward, the recruit and the editor reject empty or oversized choices', () => {
  assert.equal(DraftDto.safeParse({ offers: [] }).success, false);
  assert.deepEqual(RewardDto.parse({ reward: 'r', uid: 'u' }), { reward: 'r', uid: 'u', replace: null, ability: null, nature: null });
  assert.equal(RewardDto.safeParse({ reward: 'r' }).success, false);
  assert.deepEqual(RecruitDto.parse({ offer: 'o' }), { offer: 'o', release: null });
  assert.equal(EditMonDto.safeParse({ moves: ['a', 'b', 'c', 'd', 'e'] }).success, false);
  assert.equal(EditMonDto.safeParse({ moves: [] }).success, false);
});

test('a way is one of the rooms the Tower has', () => {
  assert.deepEqual(RoomDto.parse({ room: 'tough' }), { room: 'tough', release: null });
  assert.equal(RoomDto.parse({ room: 'deal', release: 'u1' }).release, 'u1');
  assert.equal(RoomDto.safeParse({ room: 'casino' }).success, false);
});

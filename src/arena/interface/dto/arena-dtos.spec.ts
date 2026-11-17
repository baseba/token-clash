// The arena's DTOs on their own: the defaults the home screen relies on, and what they reject.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryQueryDto } from './history-query.dto.js';
import { NewChallengeDto } from './new-challenge.dto.js';
import { NewTournamentDto } from './new-tournament.dto.js';
import { AddAisDto, SetReadyDto } from './tournament-actions.dto.js';

test('an empty "new battle" is a public team battle at each own level', () => {
  assert.deepEqual(NewChallengeDto.parse({}), { mode: 'team', levelCap: null, visibility: 'public' });
  assert.deepEqual(NewChallengeDto.parse({ mode: 'random', levelCap: 50, ai: 'hard' }), { mode: 'random', levelCap: 50, visibility: 'public', ai: 'hard' });
});

test('values outside the allowed ones are rejected instead of silently replaced', () => {
  assert.equal(NewChallengeDto.safeParse({ mode: 'chaos' }).success, false);
  assert.equal(NewChallengeDto.safeParse({ levelCap: 100 }).success, false);
  assert.equal(NewChallengeDto.safeParse([]).success, false);
  assert.equal(NewTournamentDto.safeParse({ size: 5 }).success, false);
  assert.equal(NewTournamentDto.parse({}).size, 8);
  assert.equal(AddAisDto.safeParse({ level: 'hard', count: 0 }).success, false);
});

test('a tournament ready with no body means ready', () => {
  assert.deepEqual(SetReadyDto.parse({}), { ready: true });
  assert.deepEqual(SetReadyDto.parse({ ready: false }), { ready: false });
});

test('query values arrive as text and become numbers', () => {
  assert.deepEqual(HistoryQueryDto.parse({}), { offset: 0, limit: 30 });
  assert.deepEqual(HistoryQueryDto.parse({ offset: '30', limit: '10' }), { offset: 30, limit: 10 });
  assert.equal(HistoryQueryDto.safeParse({ limit: '500' }).success, false);
});

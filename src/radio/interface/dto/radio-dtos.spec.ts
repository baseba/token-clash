// The radio's DTOs on their own: what they accept and what they turn down before the domain sees it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OpenStationDto, StationQueueDto } from './station.dto.js';

test('a station name is any text: the Station rules its length and characters, not the DTO', () => {
  assert.deepEqual(OpenStationDto.parse({ name: '😀'.repeat(40) }), { name: '😀'.repeat(40) });
  for (const body of [{}, { name: 7 }, { name: null }]) assert.equal(OpenStationDto.safeParse(body).success, false, JSON.stringify(body));
});

test('a queue lists radio songs only, at most 30', () => {
  assert.deepEqual(StationQueueDto.parse({ queue: ['battle_kanto_gym', 'bw/victory_gym', 'battle_kanto_gym'], playing: null }).queue, ['battle_kanto_gym', 'bw/victory_gym', 'battle_kanto_gym']);
  assert.deepEqual(StationQueueDto.parse({ queue: [], playing: null }).queue, []);
  assert.equal(StationQueueDto.safeParse({ queue: ['not_a_song'], playing: null }).success, false);
  assert.equal(StationQueueDto.safeParse({ queue: Array(31).fill('title'), playing: null }).success, false);
  assert.equal(StationQueueDto.safeParse({ playing: null }).success, false);
});

test('a queue says when the song the DJ saw on air started, or null if none was', () => {
  assert.equal(StationQueueDto.parse({ queue: [], playing: 1_700_000_000_000 }).playing, 1_700_000_000_000);
  assert.equal(StationQueueDto.parse({ queue: [], playing: null }).playing, null);
  for (const playing of [undefined, '1700000000000', 1.5]) assert.equal(StationQueueDto.safeParse({ queue: [], playing }).success, false, String(playing));
});

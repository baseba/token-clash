import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stationToDomain } from './radio.mapper.js';
import type { StationRow } from './radio.schema.js';

const row = (changes: Partial<StationRow>): StationRow => ({
  ownerId: 'ana',
  name: 'Radio',
  openedAt: 0,
  queue: [],
  nowPlayingTrack: 'title',
  nowPlayingStartedAt: 1_000,
  nowPlayingEndsAt: 2_000,
  ...changes,
});

test('a saved station loads without the songs that left the radio', () => {
  const station = stationToDomain(row({ queue: ['removed_song', 'town', 'another_removed_song'] }));
  assert.deepEqual(station.queue, ['town']);
  assert.deepEqual(station.nowPlaying, { track: 'title', startedAt: 1_000, endsAt: 2_000 });
});

test('a song on air that left the radio takes the station off air until its queue starts', () => {
  const station = stationToDomain(row({ queue: ['town'], nowPlayingTrack: 'removed_song' }));
  assert.equal(station.nowPlaying, null);
  assert.deepEqual(station.queue, ['town']);
});

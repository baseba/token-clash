import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RADIO_TRACK_IDS, radioTrackDuration } from './radio-tracks.js';

test('every radio song has a measured length, between a few seconds and a few minutes', () => {
  assert.equal(new Set(RADIO_TRACK_IDS).size, RADIO_TRACK_IDS.length);
  assert.ok(RADIO_TRACK_IDS.includes('bw/victory_gym'));
  for (const id of RADIO_TRACK_IDS) {
    const duration = radioTrackDuration(id);
    assert.ok(Number.isInteger(duration) && duration >= 5_000 && duration <= 10 * 60_000, `${id}: ${duration} ms`);
  }
});

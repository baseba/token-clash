import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RADIO_KINDS, RADIO_REGIONS, RADIO_TRACKS, radioTrack } from '../../public/radio.js';
import { MUSIC_TRACKS, trackFor } from '../../public/music.js';

test('every radio song has a region, a kind and a title, and is downloaded with the rest of the music', () => {
  const ids = RADIO_TRACKS.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const t of RADIO_TRACKS) {
    assert.ok(RADIO_REGIONS[t.region], t.id);
    assert.ok(RADIO_KINDS[t.kind], t.id);
    assert.ok(t.title, t.id);
    assert.ok(MUSIC_TRACKS.includes(t.id), t.id);
  }
  assert.equal(radioTrack('battle_kanto_gym').kind, 'battle');
  assert.equal(radioTrack('title').kind, 'other');
  assert.equal(radioTrack('nope'), null);
});

test('the radio plays its song in place of any screen, and the profile has its own theme', () => {
  assert.equal(trackFor('radio:bw/victory_gym'), 'bw/victory_gym');
  assert.equal(trackFor('radio:not-a-song'), null);
  assert.equal(trackFor('tab:profile'), 'title');
});

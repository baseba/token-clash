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

const FRAME_BYTES = 417;
const frames = (count, { xingFrames = null, id3 = 0 } = {}) => {
  const bytes = new Uint8Array(id3 + FRAME_BYTES * count);
  if (id3) bytes.set([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, (id3 - 10) >> 7, (id3 - 10) & 0x7f]);
  for (let i = 0; i < count; i++) bytes.set([0xff, 0xfb, 0x90, 0x00], id3 + i * FRAME_BYTES);
  if (xingFrames != null) {
    bytes.set([...'Xing'].map((char) => char.charCodeAt(0)), id3 + 36);
    bytes.set([0, 0, 0, 1, xingFrames >>> 24, (xingFrames >>> 16) & 0xff, (xingFrames >>> 8) & 0xff, xingFrames & 0xff], id3 + 40);
  }
  return bytes;
};

test('an mp3 lasts its frames times their samples, read from its Xing tag or counted one by one', async () => {
  const { mp3Duration } = await import('../../scripts/sync-radio.js');
  assert.deepEqual(mp3Duration(frames(100)), { ms: Math.round((100 * 1152 * 1000) / 44100), frames: 100, taggedFrames: null, walkedFrames: 100, sampleRate: 44100, samplesPerFrame: 1152 });
  const tagged = mp3Duration(frames(101, { xingFrames: 100, id3: 300 }));
  assert.equal(tagged.taggedFrames, 100);
  assert.equal(tagged.walkedFrames, 100, 'the tag frame holds no audio');
  assert.equal(tagged.ms, 2612);
  assert.equal(mp3Duration(frames(5, { xingFrames: 9000 })).ms, Math.round((9000 * 1152 * 1000) / 44100), 'the tag wins over a walk cut short');
  assert.throws(() => mp3Duration(new Uint8Array(2000)), /frames MPEG/);
});

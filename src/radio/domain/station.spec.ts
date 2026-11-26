import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../../shared/domain/errors.js';
import { STATION_QUEUE_MAX } from './radio-tracks.js';
import { Station } from './station.js';

const LENGTHS: Record<string, number> = { intro: 60_000, gym: 100_000, champion: 150_000 };
const durationOf = (track: string) => LENGTHS[track];

const T0 = 1_000_000;

function rejects(action: () => void, kind: DomainError['kind'], message: RegExp) {
  assert.throws(action, (error: unknown) => error instanceof DomainError && error.kind === kind && message.test(error.message));
}

test('a new station is silent until its DJ queues something', () => {
  const station = Station.open('ana', '  Radio Kanto  ', T0);
  assert.equal(station.name, 'Radio Kanto');
  assert.equal(station.nowPlaying, null);
  assert.deepEqual(station.queue, []);
  assert.equal(station.advance(T0 + 3_600_000, durationOf), false);
  assert.equal(station.nextChangeAt, null);
});

test('a name is required, trimmed, cleaned of control characters and at most 40 characters long', () => {
  rejects(() => Station.open('ana', '   ', T0), 'invalid', /nombre/);
  rejects(() => Station.open('ana', '‮\u0007', T0), 'invalid', /nombre/);
  rejects(() => Station.open('ana', 'x'.repeat(41), T0), 'invalid', /40/);
  const station = Station.open('ana', 'Radio‮ Johto', T0);
  assert.equal(station.name, 'Radio Johto');
  station.rename('ñ'.repeat(40));
  assert.equal(station.name, 'ñ'.repeat(40));
  rejects(() => station.rename(''), 'invalid', /nombre/);
  assert.equal(station.name, 'ñ'.repeat(40));
});

test('a name counts each emoji once and keeps joined emoji whole, but drops bidi controls', () => {
  const station = Station.open('ana', '😀'.repeat(40), T0);
  assert.equal(station.name, '😀'.repeat(40));
  rejects(() => station.rename('😀'.repeat(41)), 'invalid', /40/);
  station.rename('Radio 👨\u200D👩\u200D👧');
  assert.equal(station.name, 'Radio 👨\u200D👩\u200D👧');
  station.rename('\u2067Radio\u200F \u202AKanto\u2069\u200E');
  assert.equal(station.name, 'Radio Kanto');
});

test('the first queued song starts at once, and the rest wait their turn', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro', 'gym'], null, T0 + 5_000, durationOf);
  assert.deepEqual(station.nowPlaying, { track: 'intro', startedAt: T0 + 5_000, endsAt: T0 + 65_000 });
  assert.deepEqual(station.queue, ['gym']);
  assert.equal(station.nextChangeAt, T0 + 65_000);
});

test('each song plays once through, then the next one starts when it ended', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro', 'gym', 'champion'], null, T0, durationOf);
  assert.equal(station.advance(T0 + 59_999, durationOf), false);
  assert.equal(station.nowPlaying?.track, 'intro');
  assert.equal(station.advance(T0 + 60_000, durationOf), true);
  assert.deepEqual(station.nowPlaying, { track: 'gym', startedAt: T0 + 60_000, endsAt: T0 + 160_000 });
  assert.equal(station.advance(T0 + 60_000, durationOf), false, 'advancing twice to the same time changes nothing');
});

test('after a long gap nobody listened to, the station lands on the song it would be playing', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro', 'gym', 'champion'], null, T0, durationOf);
  assert.equal(station.advance(T0 + 200_000, durationOf), true);
  assert.deepEqual(station.nowPlaying, { track: 'champion', startedAt: T0 + 160_000, endsAt: T0 + 310_000 });
  assert.deepEqual(station.queue, []);
});

test('with an empty queue the last song stays on air, looping, as long as nobody adds another', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro'], null, T0, durationOf);
  assert.equal(station.advance(T0 + 3_600_000, durationOf), false);
  assert.deepEqual(station.nowPlaying, { track: 'intro', startedAt: T0, endsAt: T0 + 60_000 });
  assert.equal(station.nextChangeAt, null);
});

test('a song queued while the last one loops starts now, not when the loop began', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro'], null, T0, durationOf);
  station.setQueue(['gym', 'champion'], T0, T0 + 500_000, durationOf);
  assert.deepEqual(station.nowPlaying, { track: 'gym', startedAt: T0 + 500_000, endsAt: T0 + 600_000 });
  assert.deepEqual(station.queue, ['champion']);
});

test('a new queue while a song plays its first pass waits for it to end', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro', 'gym'], null, T0, durationOf);
  station.setQueue(['champion'], T0, T0 + 30_000, durationOf);
  assert.deepEqual(station.nowPlaying, { track: 'intro', startedAt: T0, endsAt: T0 + 60_000 });
  assert.deepEqual(station.queue, ['champion']);
  station.setQueue([], T0, T0 + 40_000, durationOf);
  assert.equal(station.nextChangeAt, null, 'an emptied queue leaves the song on air to loop');
});

test('the old queue plays up to the moment the new one arrives', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro', 'gym'], null, T0, durationOf);
  station.setQueue(['champion'], T0 + 60_000, T0 + 70_000, durationOf);
  assert.deepEqual(station.nowPlaying, { track: 'gym', startedAt: T0 + 60_000, endsAt: T0 + 160_000 });
  assert.deepEqual(station.queue, ['champion']);
});

test('the queue holds at most 30 songs', () => {
  const station = Station.open('ana', 'Radio', T0);
  rejects(() => station.setQueue(Array(STATION_QUEUE_MAX + 1).fill('gym'), null, T0, durationOf), 'invalid', /30/);
  assert.equal(station.nowPlaying, null);
  station.setQueue(Array(STATION_QUEUE_MAX).fill('gym'), null, T0, durationOf);
  assert.equal(station.queue.length, STATION_QUEUE_MAX - 1);
});

test('skipping starts the next queued song now', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro', 'gym', 'champion'], null, T0, durationOf);
  station.skip(T0 + 10_000, durationOf);
  assert.deepEqual(station.nowPlaying, { track: 'gym', startedAt: T0 + 10_000, endsAt: T0 + 110_000 });
  assert.deepEqual(station.queue, ['champion']);
});

test('skipping with an empty queue is refused and leaves the song on air', () => {
  const station = Station.open('ana', 'Radio', T0);
  rejects(() => station.skip(T0, durationOf), 'conflict', /cola/);
  station.setQueue(['intro'], null, T0, durationOf);
  rejects(() => station.skip(T0 + 10_000, durationOf), 'conflict', /cola/);
  assert.deepEqual(station.nowPlaying, { track: 'intro', startedAt: T0, endsAt: T0 + 60_000 });
});

test('songs waiting with nothing on air start at the next advance', () => {
  const station = Station.restore({ ownerId: 'ana', name: 'Radio', openedAt: T0, queue: ['gym', 'intro'], nowPlaying: null });
  assert.equal(station.advance(T0 + 5_000, durationOf), true);
  assert.deepEqual(station.nowPlaying, { track: 'gym', startedAt: T0 + 5_000, endsAt: T0 + 105_000 });
  assert.deepEqual(station.queue, ['intro']);
});

test('a queue edited from a copy older than the song on air is refused, so played songs do not play again', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro', 'gym', 'champion'], null, T0, durationOf);
  rejects(() => station.setQueue(['gym', 'champion', 'intro'], T0, T0 + 70_000, durationOf), 'conflict', /cambió de canción/);
  assert.deepEqual(station.nowPlaying, { track: 'gym', startedAt: T0 + 60_000, endsAt: T0 + 160_000 });
  assert.deepEqual(station.queue, ['champion']);
  rejects(() => station.setQueue([], null, T0 + 70_000, durationOf), 'conflict', /cambió de canción/);
});

test('the last song looping keeps its start, so an edit made during the loop is taken', () => {
  const station = Station.open('ana', 'Radio', T0);
  station.setQueue(['intro'], null, T0, durationOf);
  station.setQueue([], T0, T0 + 3_600_000, durationOf);
  station.setQueue(['gym'], T0, T0 + 7_200_000, durationOf);
  assert.deepEqual(station.nowPlaying, { track: 'gym', startedAt: T0 + 7_200_000, endsAt: T0 + 7_300_000 });
});

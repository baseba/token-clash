import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stationPosition } from '../../public/music.js';
import { createStationFeed } from '../../public/radio-station.js';

const SONG = { duration: 100, loopStart: 20 };

test('a station song starts where the server clock says it is, whatever the local clock reads', () => {
  assert.equal(stationPosition({ startedAt: 1_000_000, serverNow: 1_000_000, sinceFrameMs: 0 }, SONG), 0);
  assert.equal(stationPosition({ startedAt: 1_000_000, serverNow: 1_030_000, sinceFrameMs: 0 }, SONG), 30);
  assert.equal(stationPosition({ startedAt: 1_000_000, serverNow: 1_030_000, sinceFrameMs: 2_500 }, SONG), 32.5, 'counts the time since the frame arrived, loading included');
  assert.equal(stationPosition({ startedAt: 1_000_000, serverNow: 999_000, sinceFrameMs: 0 }, SONG), 0, 'never before the start');
});

test('past its end the last song is looping, so the position falls inside the loop', () => {
  assert.equal(stationPosition({ startedAt: 0, serverNow: 100_000, sinceFrameMs: 0 }, SONG), 20, 'the loop starts again at its loop point');
  assert.equal(stationPosition({ startedAt: 0, serverNow: 130_000, sinceFrameMs: 0 }, SONG), 50);
  assert.equal(stationPosition({ startedAt: 0, serverNow: 100_000 + 80_000 * 3 + 5_000, sinceFrameMs: 0 }, SONG), 25, 'three loops later');
  assert.equal(stationPosition({ startedAt: 0, serverNow: 130_000, sinceFrameMs: 0 }, { duration: 100, loopStart: 0 }), 30, 'a song without loop point loops whole');
});

// A WebSocket stand-in the test opens, answers and drops by hand.
function fakeSockets() {
  const opened = [];
  const open = () => {
    const socket = {
      readyState: 0,
      sent: [],
      send: (text) => socket.sent.push(JSON.parse(text)),
      close: () => {
        socket.readyState = 3;
        socket.onclose?.();
      },
      connect: () => {
        socket.readyState = 1;
        socket.onopen?.();
      },
      receive: (frame) => socket.onmessage?.({ data: JSON.stringify(frame) }),
      drop: () => {
        socket.readyState = 3;
        socket.onclose?.();
      },
    };
    opened.push(socket);
    return socket;
  };
  return { opened, open };
}

function memoryStorage(initial = {}) {
  const items = new Map(Object.entries(initial));
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => (value == null ? items.delete(key) : items.set(key, value)) };
}

const frameOf = (ownerId, name = 'Radio') => ({ t: 'radio', stationId: ownerId, station: { ownerId, name, ownerName: 'Ana', nowPlaying: null, queue: [], listeners: 1 }, now: 0 });

test('a tuned station is remembered, tuned in again after a reload, and after the socket drops', () => {
  const { opened, open } = fakeSockets();
  const storage = memoryStorage();
  const frames = [];
  const retries = [];
  const feed = createStationFeed({ open, storage, onFrame: (frame) => frames.push(frame), retryIn: (ms, retry) => retries.push({ ms, retry }) });
  assert.equal(opened.length, 0, 'no socket while nothing is tuned');

  feed.tune('ana');
  assert.equal(storage.items.get('tc_station'), 'ana');
  opened[0].connect();
  assert.deepEqual(opened[0].sent, [{ t: 'radio', station: 'ana' }]);
  opened[0].receive(frameOf('ana', 'Radio Kanto'));
  assert.equal(feed.station.name, 'Radio Kanto');
  assert.equal(frames.length, 1);

  opened[0].drop();
  assert.equal(retries[0].ms, 1000);
  retries[0].retry();
  opened[1].connect();
  assert.deepEqual(opened[1].sent, [{ t: 'radio', station: 'ana' }], 'tunes in again on the new socket');

  const reloaded = createStationFeed({ open, storage, onFrame: () => {} });
  assert.equal(reloaded.tuned, 'ana');
  opened[2].connect();
  assert.deepEqual(opened[2].sent, [{ t: 'radio', station: 'ana' }]);
});

test('switching stations reuses the socket; frames of the station left behind are ignored', () => {
  const { opened, open } = fakeSockets();
  const frames = [];
  const feed = createStationFeed({ open, storage: memoryStorage({ tc_station: 'ana' }), onFrame: (frame) => frames.push(frame) });
  opened[0].connect();
  feed.tune('beto');
  assert.deepEqual(opened[0].sent, [{ t: 'radio', station: 'ana' }, { t: 'radio', station: 'beto' }]);
  opened[0].receive(frameOf('ana'));
  assert.equal(frames.length, 0);
  opened[0].receive(frameOf('beto'));
  assert.equal(feed.station.ownerId, 'beto');
  assert.equal(opened.length, 1);
});

test('tuning out, or the station closing, forgets it and closes the socket for good', () => {
  const { opened, open } = fakeSockets();
  const storage = memoryStorage({ tc_station: 'ana' });
  const frames = [];
  const retries = [];
  const feed = createStationFeed({ open, storage, onFrame: (frame) => frames.push(frame), retryIn: (ms, retry) => retries.push(retry) });
  opened[0].connect();
  opened[0].receive({ t: 'radio', stationId: 'ana', station: null, now: 0 });
  assert.equal(feed.tuned, null);
  assert.equal(storage.items.has('tc_station'), false);
  assert.equal(opened[0].readyState, 3);
  assert.deepEqual(frames.at(-1), { t: 'radio', stationId: 'ana', station: null, now: 0 });

  feed.tune('beto');
  opened[1].connect();
  feed.tune(null);
  assert.equal(frames.at(-1), null);
  assert.equal(opened[1].readyState, 3);
  assert.equal(retries.length, 0, 'a socket closed on purpose is not reopened');
});

test('a late answer that the station left behind is gone does not forget the station tuned to since', () => {
  const { opened, open } = fakeSockets();
  const storage = memoryStorage({ tc_station: 'ana' });
  const frames = [];
  const feed = createStationFeed({ open, storage, onFrame: (frame) => frames.push(frame) });
  opened[0].connect();
  feed.tune('beto');
  opened[0].receive({ t: 'radio', stationId: 'ana', station: null, now: 0 });
  assert.equal(feed.tuned, 'beto');
  assert.equal(storage.items.get('tc_station'), 'beto');
  assert.equal(opened[0].readyState, 1);
  assert.equal(frames.length, 0);
  opened[0].receive({ t: 'radio', stationId: 'beto', station: null, now: 0 });
  assert.equal(feed.tuned, null, 'the station tuned to closing is still forgotten');
});

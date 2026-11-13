import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openRooms, matchFor, visibilityOf, joinBlocker, HOST_GRACE_MS } from '../server/lobby.js';

const now = 1_000_000;
const room = (id, extra = {}) => ({ id, hostId: `h-${id}`, status: 'open', mode: 'team', levelCap: null, visibility: 'public', createdAt: now - HOST_GRACE_MS - 1, ...extra });

test('only public open rooms with a host still waiting are listed, oldest first', () => {
  const challenges = {
    a: room('a', { createdAt: now - HOST_GRACE_MS - 5 }),
    b: room('b', { createdAt: now - 1000 }),
    c: room('c', { visibility: 'private', createdAt: now - 10 }),
    d: room('d', { status: 'active' }),
    e: room('e'),
    f: room('f', { ai: 'hard', createdAt: now - 10 }),
    g: room('g', { createdAt: now - HOST_GRACE_MS - 9 }),
  };
  const waiting = new Set(['a', 'g']);
  const list = openRooms(challenges, { now, hostWaiting: (c) => waiting.has(c.id) });
  assert.deepEqual(list.map((c) => c.id), ['g', 'a', 'b']);
});

test('rooms made before visibility existed stay private', () => {
  assert.equal(visibilityOf({}), 'private');
});

test('a public search joins a rival room with the same mode and level, never its own', () => {
  const rooms = [room('mine', { hostId: 'me' }), room('nv50', { levelCap: 50 }), room('dice', { mode: 'random' }), room('match')];
  const found = matchFor(rooms, { trainerId: 'me', mode: 'team', levelCap: null });
  assert.equal(found.rival.id, 'match');
  assert.equal(found.own.id, 'mine');
  assert.deepEqual(matchFor(rooms, { trainerId: 'me', mode: 'random', levelCap: 50 }), { own: null, rival: null });
});

test('joining explains why a room is no longer available', () => {
  const why = (c, extra = {}) => joinBlocker(c, { trainerId: 'me', now, ...extra })?.error ?? null;
  assert.match(why(undefined), /ya no existe/);
  assert.match(why(room('a', { hostId: 'me' })), /tu propia sala/);
  assert.match(why(room('a', { status: 'active', guestId: 'otro' })), /Llegaste tarde/);
  assert.match(why(room('a', { status: 'active', guestId: 'me' })), /Ya estás/);
  assert.match(why(room('a', { status: 'cancelled' })), /cerró esta sala/);
  assert.match(why(room('a', { status: 'finished' })), /terminó/);
  assert.match(why(room('a', { status: 'abandoned' })), /se cortó/);
  assert.match(why(room('a')), /ya no está en la sala/);
  assert.equal(why(room('a'), { hostWaiting: () => true }), null);
  assert.equal(why(room('a', { visibility: 'private' })), null);
  assert.equal(joinBlocker(room('a', { status: 'active' }), { trainerId: 'x', now }).status, 409);
});

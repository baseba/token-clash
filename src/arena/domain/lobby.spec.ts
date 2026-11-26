import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Challenge } from './challenge.js';
import { openRooms, openTournaments, matchFor, joinBlocker, HOST_GRACE_MS } from './lobby.js';
import { Tournament } from './tournament.js';

const now = 1_000_000;
const room = (id, extra = {}): any => ({ id, hostId: `h-${id}`, status: 'open', mode: 'team', visibility: 'public', createdAt: now - HOST_GRACE_MS - 1, ...extra });

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

test('a public search joins a rival room with the same mode, never its own', () => {
  const rooms = [room('mine', { hostId: 'me' }), room('dice', { mode: 'random' }), room('match')];
  const found = matchFor(rooms, { trainerId: 'me', mode: 'team' });
  assert.equal(found.rival.id, 'match');
  assert.equal(found.own.id, 'mine');
});

test('joining explains why a room is no longer available', () => {
  const why = (c, extra = {}) => joinBlocker(c && Challenge.restore(c), { trainerId: 'me', now, ...extra })?.message ?? null;
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
  assert.equal(joinBlocker(Challenge.restore(room('a', { status: 'active' })), { trainerId: 'x', now }).kind, 'conflict');
});

test('only public open tournaments with free seats and a host still around are listed, oldest first', () => {
  const tournament = (id: string, extra = {}) =>
    Tournament.restore({ id, hostId: `h-${id}`, mode: 'team', size: 4, visibility: 'public', status: 'open', createdAt: now - HOST_GRACE_MS - 1, seats: [{ id: `h-${id}`, name: id, ai: null, ready: false }], ...extra });
  const fourSeats = ['a', 'b', 'c', 'd'].map((id) => ({ id, name: id, ai: null, ready: false }));
  const tournaments = [
    tournament('a', { createdAt: now - HOST_GRACE_MS - 5 }),
    tournament('b', { createdAt: now - 1000 }),
    tournament('c', { visibility: 'private', createdAt: now - 10 }),
    tournament('d', { status: 'running', createdAt: now - 10 }),
    tournament('e'),
    tournament('f', { seats: fourSeats, createdAt: now - 10 }),
    tournament('g', { createdAt: now - HOST_GRACE_MS - 9 }),
  ];
  const around = new Set(['a', 'g']);
  const list = openTournaments(tournaments, { now, hostWaiting: (listed) => around.has(listed.id) });
  assert.deepEqual(list.map((listed) => listed.id), ['g', 'a', 'b']);
});

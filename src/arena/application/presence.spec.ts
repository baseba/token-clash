import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../../catalog/domain/creatures.js';
import { buildAiTeam } from '../../combat/domain/ai.js';
import { createBattle } from '../../combat/domain/battle.js';
import { Challenge } from '../domain/challenge.js';
import type { ClientConnection } from './connection.js';
import { Presence, tournamentWatchKey, watchKey, type BattlePhase, type Room } from './presence.js';

const challenge = (id: string) => Challenge.open({ id, host: { id: 'ana', name: 'Ana' }, hostTeam: [], mode: 'team', visibility: 'private', at: 1 });

const tournamentMatch = (id: string, tournamentId: string) =>
  Challenge.tournamentMatch({
    id,
    host: { id: 'ana', name: 'Ana', team: [], ai: null },
    guest: { id: 'beto', name: 'Beto', team: [], ai: null },
    mode: 'team',
    tournamentId,
    round: 1,
    match: 1,
    at: 1,
  });

const nowhere = () => false;

const connection = (trainerId: string): ClientConnection => ({
  trainerId,
  roomId: null,
  tourId: null,
  open: true,
  send: () => {},
  signIn: () => {},
  enterRoom: nowhere,
  follow: nowhere,
});

function inBattle(room: Room, startedAt: number): BattlePhase {
  const entries = buildAiTeam({ difficulty: 'easy', random: rng(room.challenge.id) }).slice(0, 3);
  const battle = createBattle({ id: room.challenge.id, sides: [{ trainerId: 'ana', name: 'Ana', entries }, { trainerId: 'beto', name: 'Beto', entries }], random: rng('battle') });
  const phase: BattlePhase = { kind: 'battle', battle, startedAt, deadline: null, jevAsked: new Set() };
  room.phase = phase;
  return phase;
}

test('a room is found by its challenge and heard by everyone inside until it is dropped empty', () => {
  const presence = new Presence();
  const duel = challenge('c1');
  assert.equal(presence.findRoom('c1'), undefined);
  assert.deepEqual(presence.roomAudience('c1'), []);
  const room = presence.room(duel);
  const ana = connection('ana');
  room.sockets.add(ana);
  assert.equal(presence.findRoom('c1'), room);
  assert.deepEqual(presence.roomAudience('c1'), [ana]);
  presence.dropIfEmpty(room);
  assert.equal(presence.findRoom('c1'), room, 'a room with someone inside stays');
  room.sockets.delete(ana);
  presence.dropIfEmpty(room);
  assert.equal(presence.findRoom('c1'), undefined);
  assert.notEqual(presence.room(duel), room, 'the challenge gets a fresh room');
});

test('dropping a room that was already replaced leaves the new room of that challenge alone', () => {
  const presence = new Presence();
  const duel = challenge('c1');
  const stale = presence.room(duel);
  presence.dropIfEmpty(stale);
  const fresh = presence.room(duel);
  presence.dropIfEmpty(stale);
  assert.equal(presence.findRoom('c1'), fresh);
});

test('the battles open to watch are the active ones whose players allowed watchers, newest first', () => {
  const presence = new Presence();
  const rooms = Object.fromEntries(['older', 'newer', 'closed', 'finished', 'waiting'].map((id) => [id, presence.room(challenge(id))]));
  inBattle(rooms.older, 1);
  inBattle(rooms.newer, 2);
  inBattle(rooms.closed, 3);
  inBattle(rooms.finished, 4).battle.status = 'finished';
  for (const id of ['older', 'newer', 'finished', 'waiting']) presence.allowWatchers(watchKey(rooms[id].challenge));
  assert.deepEqual(presence.battlesOpenToWatch().map((room) => room.challenge.id), ['newer', 'older']);
});

test('a tournament battle is open to watch once its tournament is, not by its own challenge', () => {
  const presence = new Presence();
  const match = presence.room(tournamentMatch('m1', 't1'));
  inBattle(match, 5);
  presence.allowWatchers(`c:${match.challenge.id}`);
  assert.deepEqual(presence.battlesOpenToWatch(), []);
  presence.allowWatchers(tournamentWatchKey('t1'));
  assert.deepEqual(presence.battlesOpenToWatch().map((room) => room.challenge.id), ['m1']);
});

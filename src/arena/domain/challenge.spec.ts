import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DomainError } from '../../shared/domain/errors.js';
import { AI_NAMES, aiName, Challenge, isHumanDuel, ROOM_MAX_AGE_MS } from './challenge.js';

const ana = { id: 'ana', name: 'Ana' };
const beto = { id: 'beto', name: 'Beto' };
const open = () => Challenge.open({ id: 'c1', host: ana, hostTeam: [], mode: 'team', visibility: 'private', at: 1 });
const seated = () => {
  const challenge = open();
  challenge.join(beto, { guestTeam: [] });
  return challenge;
};
const kindOf = (run: () => void) => {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return error.kind;
    throw error;
  }
  return null;
};
const result = { winnerId: 'ana', turns: 3, final: { winner: 0, sides: [] }, at: 2 };

test('a rival joins an open room; nobody joins it twice', () => {
  const challenge = seated();
  assert.equal(challenge.status, 'active');
  assert.equal(challenge.guestId, 'beto');
  assert.equal(kindOf(() => challenge.join({ id: 'caro', name: 'Caro' }, { guestTeam: [] })), 'conflict');
  assert.equal(kindOf(() => open().join(ana, { guestTeam: [] })), 'invalid');
});

test('the host closes a waiting room or a ready check, nobody else and never later', () => {
  const waiting = open();
  assert.equal(kindOf(() => waiting.cancel('beto', { readyCheck: false })), 'forbidden');
  assert.equal(kindOf(() => waiting.cancel(undefined, { readyCheck: false })), 'forbidden');
  waiting.cancel('ana', { readyCheck: false });
  assert.equal(waiting.status, 'cancelled');
  assert.equal(kindOf(() => waiting.cancel('ana', { readyCheck: false })), 'forbidden');

  assert.equal(kindOf(() => seated().cancel('ana', { readyCheck: false })), 'forbidden', 'the countdown already started');
  const checking = seated();
  checking.cancel('ana', { readyCheck: true });
  assert.equal(checking.status, 'cancelled');
});

test('a tournament match is never closed by hand', () => {
  const match = Challenge.tournamentMatch({
    id: 'm1',
    host: { ...ana, team: [], ai: null },
    guest: { ...beto, team: [], ai: null },
    mode: 'team',
    tournamentId: 'T1',
    round: 0,
    match: 0,
    at: 1,
  });
  assert.equal(kindOf(() => match.cancel('ana', { readyCheck: true })), 'forbidden');
});

test('a guest who leaves the ready check reopens the room; a random room forgets the rolled team', () => {
  const challenge = Challenge.open({ id: 'c2', host: ana, hostTeam: [], mode: 'random', visibility: 'public', at: 1 });
  challenge.join(beto, { hostTeam: [{ id: 'x' } as any], guestTeam: [] });
  challenge.reopen();
  assert.deepEqual([challenge.status, challenge.guestId, challenge.hostTeam], ['open', undefined, []]);
  assert.equal(kindOf(() => challenge.reopen()), 'conflict');
});

test('only a battle in course finishes or is cut by a restart', () => {
  assert.equal(kindOf(() => open().finish(result)), 'conflict');
  assert.equal(kindOf(() => open().abandon()), 'conflict');
  const finished = seated();
  finished.finish(result);
  assert.deepEqual([finished.status, finished.winnerId, finished.turns], ['finished', 'ana', 3]);
  assert.equal(kindOf(() => finished.abandon()), 'conflict');
  const cut = seated();
  cut.abandon();
  assert.equal(cut.status, 'abandoned');
});

test('only a 1v1 between people is a human duel', () => {
  assert.equal(isHumanDuel(seated()), true);
  assert.equal(isHumanDuel({ ai: 'hard' }), false);
  assert.equal(isHumanDuel({ ai: null, tournamentId: 'T1' }), false);
});

test('a room that never started its battle closes itself after 20 minutes', () => {
  const waiting = open();
  assert.equal(waiting.expire(ROOM_MAX_AGE_MS, { readyCheck: false }), false);
  assert.equal(waiting.expire(1 + ROOM_MAX_AGE_MS, { readyCheck: false }), true);
  assert.equal(waiting.status, 'expired');
  assert.equal(kindOf(() => waiting.join(beto, { guestTeam: [] })), 'gone');
  const checking = seated();
  assert.equal(checking.expire(1 + ROOM_MAX_AGE_MS, { readyCheck: true }), true);
});

test('a room already fighting, finished or of a tournament never expires', () => {
  const fighting = seated();
  assert.equal(fighting.expire(10 * ROOM_MAX_AGE_MS, { readyCheck: false }), false);
  assert.equal(fighting.status, 'active');
  const done = seated();
  done.finish(result);
  assert.equal(done.expire(10 * ROOM_MAX_AGE_MS, { readyCheck: false }), false);
});

test('a battle against the AI names its AI unless it already has a name', () => {
  const againstAi = (name?: string) =>
    Challenge.againstAi({ id: 'c2', host: ana, hostTeam: [], ai: { id: 'ai:hard', level: 'hard', ...(name ? { name } : {}) }, aiTeam: [], mode: 'team', at: 1 });
  assert.match(againstAi().guestName!, / ai - difícil$/);
  assert.equal(againstAi('Líder Brock').guestName, 'Líder Brock');
  assert.equal(againstAi().ai, 'hard');
});

test('AI names come from the list, carry the difficulty and never repeat a name already taken', () => {
  const taken = [];
  for (let i = 0; i < AI_NAMES.length; i++) {
    const { base, name } = aiName('veryhard', taken);
    assert.ok(AI_NAMES.includes(base));
    assert.ok(!taken.includes(base));
    assert.equal(name, `${base} - muy difícil`);
    taken.push(base);
  }
  assert.equal(new Set(taken).size, AI_NAMES.length);
  assert.equal(aiName('easy', [], () => 0).name, 'crubio ai - fácil');
});

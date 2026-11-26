import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_NAMES, aiName, reachedRound, addSeat, removeSeat, setReady, nextAiId, createBracket, nextMatch, recordWinner, roundName, matchNumber, totalMatches, tournamentMatchFor, Tournament } from './tournament.js';
import { aiLevelOf } from '../../combat/domain/ai.js';
import { DomainError } from '../../shared/domain/errors.js';

const tournament = (size = 4, extra = {}): any => ({ id: 't', hostId: 'h', mode: 'team', size, seats: [{ id: 'h', name: 'Host', ai: null, ready: false }], ...extra });
const lobby = () => {
  const created = Tournament.create({ id: 't', host: { id: 'h', name: 'Host' }, mode: 'team', size: 4, visibility: 'private', at: 0 });
  created.join({ id: 'p', name: 'Pía' });
  return created;
};
const inSeatOrder = () => 0.99;
const fullOfAis = (size: number) => {
  const filled = Tournament.create({ id: 't', host: { id: 'h', name: 'Host' }, mode: 'team', size, visibility: 'private', at: 0 });
  filled.addAis('h', 'easy', size - 1);
  filled.setReady('h', true);
  return filled;
};
const startNow = (random: () => number = inSeatOrder) => ({ at: 0, firstMatchAt: 0, random });
const refusal = (run: () => void) => {
  try {
    run();
  } catch (error) {
    if (error instanceof DomainError) return [error.kind, error.message];
    throw error;
  }
  return null;
};

test('AIs sit down ready, humans have to press ready, and the room starts only when full', () => {
  const filling = Tournament.restore(tournament(4, { status: 'open' }));
  addSeat(filling, { id: 'p', name: 'Pía', ai: null });
  addSeat(filling, { ...nextAiId(filling, 'hard'), name: 'IA', ai: 'hard' });
  addSeat(filling, { id: nextAiId(filling, 'hard').id, name: 'IA 2', ai: 'hard' });
  assert.deepEqual(filling.seats.map((s) => [s.id, s.ready]), [['h', false], ['p', false], ['ai:hard#1', true], ['ai:hard#2', true]]);
  assert.throws(() => addSeat(filling, { id: 'x', name: 'X' } as any), /lleno/);
  setReady(filling, 'h', true);
  assert.equal(filling.startIfReady(startNow()), false);
  removeSeat(filling, 3);
  setReady(filling, 'p', true);
  assert.equal(filling.startIfReady(startNow()), false);
  assert.throws(() => removeSeat(filling, 0), /no se puede quitar/);
  assert.throws(() => addSeat(filling, { id: 'p', name: 'Pía' } as any), /Ya estás/);
  addSeat(filling, { id: nextAiId(filling, 'hard').id, name: 'IA 3', ai: 'hard' });
  assert.equal(filling.startIfReady(startNow()), true);
  assert.equal(filling.status, 'running');
  assert.equal(filling.startIfReady(startNow()), false);
});

test('several AIs of the same level keep their level but get distinct ids', () => {
  assert.equal(aiLevelOf('ai:veryhard#3'), 'veryhard');
  assert.equal(aiLevelOf('ai:easy'), 'easy');
});

test('the bracket plays round by round and the last winner is the champion', () => {
  const seq = [0.1, 0.7, 0.3, 0.9, 0.5, 0.2, 0.8];
  const drawn = fullOfAis(8);
  drawn.startIfReady({ at: 5, firstMatchAt: 9, random: () => seq.shift()! });
  const order = drawn.bracket![0].flatMap((m) => [m.a, m.b]);
  assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(order, [3, 5, 7, 2, 6, 1, 4, 0]);
  assert.deepEqual([drawn.startedAt, drawn.drawAt, drawn.nextAt], [5, 5, 9]);
  const bracket = createBracket([0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(bracket.map((r) => r.length), [4, 2, 1]);
  assert.equal(totalMatches(bracket), 7);
  assert.deepEqual([0, 1, 2].map((r) => roundName(8, r)), ['Cuartos de final', 'Semifinal', 'Final']);
  assert.equal(roundName(16, 0), 'Octavos de final');
  const winners = [1, 2, 5, 7, 1, 7, 7];
  let champion = null;
  winners.forEach((w, i) => {
    const at = nextMatch(bracket);
    assert.equal(matchNumber(bracket, at), i + 1);
    champion = recordWinner(bracket, at, w);
  });
  assert.equal(champion, 7);
  assert.equal(nextMatch(bracket), null);
  assert.deepEqual(bracket[1].map((m) => [m.a, m.b]), [[1, 2], [5, 7]]);
  assert.throws(() => recordWinner(createBracket([0, 1, 2, 3]), { round: 0, index: 0 }, 3), /no jugó/);
});

test('a public tournament search joins one with the same settings and free seats', () => {
  const full = tournament(4, { id: 'full', hostId: 'a', seats: [1, 2, 3, 4].map((i) => ({ id: `s${i}` })) });
  const other = tournament(8, { id: 'eight', hostId: 'b', seats: [{ id: 'b' }] });
  const fit = tournament(4, { id: 'fit', hostId: 'c', seats: [{ id: 'c' }] });
  const mine = tournament(4, { id: 'mine', hostId: 'me', seats: [{ id: 'me' }] });
  const found = tournamentMatchFor([full, other, fit, mine], { trainerId: 'me', mode: 'team', size: 4 });
  assert.equal(found.rival.id, 'fit');
  assert.equal(found.own.id, 'mine');
  assert.equal(found.seated, null);
});

test('AI names come from the list, carry the difficulty and never repeat inside a tournament', () => {
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

test('how far each seat got in the bracket', () => {
  const bracket = createBracket([0, 1, 2, 3]);
  recordWinner(bracket, { round: 0, index: 0 }, 1);
  recordWinner(bracket, { round: 0, index: 1 }, 2);
  assert.equal(reachedRound(bracket, 0), 0);
  assert.equal(reachedRound(bracket, 2), 1);
});

test('a match waits for its players and for everyone following the tournament to reach the room', async () => {
  const { pendingArrivals } = await import('./tournament.js');
  assert.deepEqual(pendingArrivals({ players: ['ana'], followers: ['ana', 'beto', 'caro'], present: ['beto'] }), ['ana', 'caro']);
  assert.deepEqual(pendingArrivals({ players: ['ana'], followers: [], present: ['ana'] }), []);
  assert.deepEqual(pendingArrivals({ players: [], followers: ['beto'], present: [] }), ['beto']);
});

test('an AI-only battle waits for viewers still playing the previous turn', async () => {
  const { viewersBehind } = await import('./tournament.js');
  assert.equal(viewersBehind([3, 2], 3), true);
  assert.equal(viewersBehind([3, undefined], 3), true);
  assert.equal(viewersBehind([3, 4], 3), false);
  assert.equal(viewersBehind([], 3), false);
});

test('the match being played is named by its place in the bracket and its room, without the seats', () => {
  const started = fullOfAis(4);
  started.startIfReady(startNow());
  const next = started.startNextMatch('room1')!;
  assert.equal(next.a.id, 'h');
  assert.deepEqual(started.current, { round: 0, index: 0, challengeId: 'room1' });
  assert.equal(started.bracket![0][0].challengeId, 'room1');
  assert.equal(started.nextAt, null);
});

test('no match starts while the tournament is not running or once every match has a winner', () => {
  const lobbyOnly = fullOfAis(4);
  assert.equal(lobbyOnly.startNextMatch('room1'), null);
  assert.equal(lobbyOnly.current, undefined);
  const abandoned = fullOfAis(4);
  abandoned.startIfReady(startNow());
  abandoned.startNextMatch('room1');
  abandoned.abandon();
  assert.equal(abandoned.startNextMatch('room2'), null);
  assert.deepEqual(abandoned.current, { round: 0, index: 0, challengeId: 'room1' });
  assert.equal(abandoned.bracket![0][1].challengeId, null);
  const decided = fullOfAis(4);
  decided.startIfReady(startNow());
  decided.startNextMatch('room1');
  recordWinner(decided.bracket!, { round: 0, index: 0 }, 0);
  recordWinner(decided.bracket!, { round: 0, index: 1 }, 2);
  recordWinner(decided.bracket!, { round: 1, index: 0 }, 0);
  assert.equal(decided.status, 'running');
  assert.equal(decided.startNextMatch('room2'), null);
  assert.deepEqual(decided.current, { round: 0, index: 0, challengeId: 'room1' });
});

test('a cancelled lobby never starts, even with every seat full and ready', () => {
  const cancelled = lobby();
  cancelled.addAis('h', 'easy', 2);
  cancelled.setReady('h', true);
  cancelled.setReady('p', true);
  cancelled.close('h');
  assert.equal(cancelled.startIfReady(startNow()), false);
  assert.equal(cancelled.status, 'cancelled');
  assert.equal(cancelled.bracket, undefined);
});

test('only the host closes the tournament, kicks a seat or adds AIs', () => {
  const open = lobby();
  assert.deepEqual(refusal(() => open.close('p')), ['forbidden', 'Solo el dueño puede cerrar el torneo.']);
  assert.deepEqual(refusal(() => open.kick('p', 1)), ['forbidden', 'Solo el dueño puede quitar jugadores.']);
  assert.deepEqual(refusal(() => open.addAis('p', 'easy', 1)), ['forbidden', 'Solo el dueño puede agregar IAs.']);
  assert.equal(open.seats.length, 2);
  assert.equal(open.status, 'open');
  open.kick('h', 1);
  open.addAis('h', 'easy', 1);
  assert.deepEqual(open.seats.map((seat) => seat.id), ['h', 'ai:easy#1']);
  open.close('h');
  assert.equal(open.status, 'cancelled');
});

test('seats change only while the lobby is open', () => {
  const closed = lobby();
  closed.close('h');
  const lobbyActions = (target: Tournament) => [
    refusal(() => target.leave('p')),
    refusal(() => target.setReady('p', true)),
    refusal(() => target.kick('h', 1)),
    refusal(() => target.addAis('h', 'easy', 1)),
    refusal(() => target.close('h')),
  ];
  assert.deepEqual(lobbyActions(closed), Array(5).fill(['conflict', 'Este torneo se cerró.']));
  const running = lobby();
  running.addAis('h', 'easy', 2);
  running.setReady('h', true);
  running.setReady('p', true);
  running.startIfReady(startNow());
  assert.deepEqual(lobbyActions(running), Array(5).fill(['conflict', 'El torneo ya partió.']));
  assert.equal(running.seats.length, 4);
});

test('someone who is not the host hears that first, even after the tournament started or closed', () => {
  const running = lobby();
  running.addAis('h', 'easy', 2);
  running.setReady('h', true);
  running.setReady('p', true);
  running.startIfReady(startNow());
  assert.equal(refusal(() => running.close('p'))?.[0], 'forbidden');
  assert.equal(refusal(() => running.kick('p', 1))?.[0], 'forbidden');
  assert.equal(refusal(() => running.addAis('p', 'easy', 1))?.[0], 'forbidden');
  const closed = lobby();
  closed.close('h');
  assert.deepEqual([refusal(() => closed.close('p')), refusal(() => closed.kick('p', 1)), refusal(() => closed.addAis('p', 'easy', 1))].map((refused) => refused?.[0]), ['forbidden', 'forbidden', 'forbidden']);
});

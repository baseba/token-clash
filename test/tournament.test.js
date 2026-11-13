import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AI_NAMES, aiName, reachedRound, addSeat, removeSeat, setReady, allReady, nextAiId, shuffledOrder, createBracket, nextMatch, recordWinner, roundName, matchNumber, totalMatches, tournamentMatchFor } from '../server/tournament.js';
import { aiLevelOf } from '../server/ai.js';

const tournament = (size = 4, extra = {}) => ({ id: 't', hostId: 'h', mode: 'team', levelCap: null, size, seats: [{ id: 'h', name: 'Host', ai: null, ready: false }], ...extra });

test('AIs sit down ready, humans have to press ready, and the room starts only when full', () => {
  const t = tournament();
  addSeat(t, { id: 'p', name: 'Pía', ai: null });
  addSeat(t, { ...nextAiId(t, 'hard'), name: 'IA', ai: 'hard' });
  addSeat(t, { id: nextAiId(t, 'hard').id, name: 'IA 2', ai: 'hard' });
  assert.deepEqual(t.seats.map((s) => [s.id, s.ready]), [['h', false], ['p', false], ['ai:hard#1', true], ['ai:hard#2', true]]);
  assert.throws(() => addSeat(t, { id: 'x', name: 'X' }), /lleno/);
  setReady(t, 'h', true);
  assert.equal(allReady(t), false);
  setReady(t, 'p', true);
  assert.equal(allReady(t), true);
  removeSeat(t, 3);
  assert.equal(allReady(t), false);
  assert.throws(() => removeSeat(t, 0), /no se puede quitar/);
  assert.throws(() => addSeat(t, { id: 'p', name: 'Pía' }), /Ya estás/);
});

test('several AIs of the same level keep their level but get distinct ids', () => {
  assert.equal(aiLevelOf('ai:veryhard#3'), 'veryhard');
  assert.equal(aiLevelOf('ai:easy'), 'easy');
});

test('the bracket plays round by round and the last winner is the champion', () => {
  const seq = [0.1, 0.7, 0.3, 0.9, 0.5, 0.2, 0.8];
  const order = shuffledOrder(8, () => seq.shift());
  assert.deepEqual([...order].sort(), [0, 1, 2, 3, 4, 5, 6, 7]);
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
  const found = tournamentMatchFor([full, other, fit, mine], { trainerId: 'me', mode: 'team', levelCap: null, size: 4 });
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

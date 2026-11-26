import { test } from 'node:test';
import assert from 'node:assert/strict';
import { eloRatings, INITIAL_ELO, type RatedDuel } from './elo.js';

const duel = (id: string, first: string, second: string, winnerId: string | null, finishedAt: number): RatedDuel => ({ id, players: [first, second], winnerId, finishedAt });

test('between two new players the winner gains 16 points and the loser drops 16', () => {
  const ratings = eloRatings([duel('d1', 'ana', 'beto', 'ana', 1)]);
  assert.equal(ratings.get('ana'), 1016);
  assert.equal(ratings.get('beto'), 984);
});

test('a draw between equal players leaves both where they were', () => {
  const ratings = eloRatings([duel('d1', 'ana', 'beto', null, 1)]);
  assert.equal(ratings.get('ana'), INITIAL_ELO);
  assert.equal(ratings.get('beto'), INITIAL_ELO);
});

test('beating a stronger rival gains more than beating a weaker one', () => {
  const history = [duel('d1', 'ana', 'beto', 'ana', 1), duel('d2', 'ana', 'beto', 'ana', 2)];
  const before = eloRatings(history);
  const upset = eloRatings([...history, duel('d3', 'caro', 'ana', 'caro', 3)]);
  const easyWin = eloRatings([...history, duel('d3', 'caro', 'beto', 'caro', 3)]);
  assert.ok(before.get('ana')! > INITIAL_ELO && before.get('beto')! < INITIAL_ELO);
  assert.ok(upset.get('caro')! - INITIAL_ELO > easyWin.get('caro')! - INITIAL_ELO);
});

test('duels count in the order they finished, whatever order they come in', () => {
  const lossThenWin = [duel('d2', 'ana', 'caro', 'ana', 20), duel('d1', 'ana', 'beto', 'beto', 10)];
  const winThenLoss = [duel('d1', 'ana', 'caro', 'ana', 10), duel('d2', 'ana', 'beto', 'beto', 20)];
  assert.deepEqual(eloRatings(lossThenWin), eloRatings([...lossThenWin].reverse()));
  assert.notEqual(eloRatings(lossThenWin).get('ana'), eloRatings(winThenLoss).get('ana'));
});

test('a player who never fought a rated duel has no rating', () => {
  const ratings = eloRatings([duel('d1', 'ana', 'beto', 'ana', 1)]);
  assert.equal(ratings.has('zoe'), false);
  assert.equal(eloRatings([]).size, 0);
});

test('what one player gains the other loses', () => {
  const ratings = eloRatings([duel('d1', 'ana', 'beto', 'ana', 1), duel('d2', 'beto', 'ana', 'beto', 2), duel('d3', 'ana', 'beto', null, 3), duel('d4', 'beto', 'ana', 'beto', 4)]);
  const total = ratings.get('ana')! + ratings.get('beto')!;
  assert.ok(Math.abs(total - 2 * INITIAL_ELO) <= 1, `total ${total}`);
});

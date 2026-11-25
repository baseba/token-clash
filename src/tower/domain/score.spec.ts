import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng } from '../../catalog/domain/creatures.js';
import { floorAt } from './floors.js';
import { foeTeam } from './foe-team.js';
import { DIFFICULTY_MULTIPLIER, floorScore, teamPoints, totalPoints } from './score.js';

const scoreOf = (floor: number, difficulty: 'easy' | 'mid' | 'hard' | 'veryhard', room: 'trainer' | 'calm' | 'tough' | null = null) => {
  const at = floorAt(floor, 25, difficulty, 's', room);
  return floorScore(at, foeTeam(at, difficulty, rng(floor)), difficulty);
};

test('a floor is worth its kind plus the rival team, times the way and the difficulty', () => {
  const score = scoreOf(3, 'mid', 'trainer');
  assert.equal(score.base, 100);
  assert.equal(score.multiplier, 1);
  assert.equal(score.points, score.base + score.team);
  assert.ok(score.rival);
});

test('harder difficulties, tougher ways, bosses and later floors give more points', () => {
  assert.ok(DIFFICULTY_MULTIPLIER.skynet > DIFFICULTY_MULTIPLIER.hard && DIFFICULTY_MULTIPLIER.hard > DIFFICULTY_MULTIPLIER.easy);
  assert.ok(scoreOf(9, 'hard').points > scoreOf(9, 'easy').points);
  assert.ok(scoreOf(9, 'mid', 'tough').points > scoreOf(9, 'mid', 'trainer').points);
  assert.ok(scoreOf(9, 'mid', 'calm').points < scoreOf(9, 'mid', 'trainer').points);
  assert.ok(scoreOf(10, 'mid').points > scoreOf(9, 'mid').points, 'a gym beats a route');
  assert.ok(scoreOf(19, 'mid').points > scoreOf(4, 'mid').points);
});

test('a stronger or higher-level team is worth more, and a climb adds up its floors', () => {
  assert.ok(teamPoints([{ finalID: 6, level: 50 }]) > teamPoints([{ finalID: 4, level: 50 }]));
  assert.ok(teamPoints([{ finalID: 4, level: 50 }]) > teamPoints([{ finalID: 4, level: 10 }]));
  const log = [scoreOf(1, 'mid'), scoreOf(2, 'mid')];
  assert.equal(totalPoints(log), log[0].points + log[1].points);
});

test('a league of veterans pays more for every floor', () => {
  const floor = floorAt(3, 25, 'mid', 's', 'trainer');
  const team = [{ finalID: 6, level: 20 }];
  assert.ok(floorScore(floor, team, 'mid', 'veterans').points > floorScore(floor, team, 'mid').points);
});

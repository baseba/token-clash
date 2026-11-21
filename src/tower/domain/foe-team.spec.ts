import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, speciesData } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { floorAt } from './floors.js';
import { baseStatTotal } from './growth.js';
import { foeTeam } from './foe-team.js';

test('a floor team has its size and level, the ace on top, every member at the form of its level', () => {
  const floor = floorAt(12, 25, 'mid', 's');
  const team = foeTeam(floor, 'mid', rng(1));
  assert.equal(team.length, floor.teamSize);
  assert.equal(team.at(-1)?.battleLevel, floor.level);
  assert.ok(team.every((mon) => (mon.battleLevel ?? 0) <= floor.level && (mon.battleLevel ?? 0) >= floor.level - 2));
  assert.ok(team.every((mon) => mon.moveset?.length));
});

test('a gym leader brings Pokémon of its type', () => {
  const floor = floorAt(5, 25, 'mid', 's');
  for (let seed = 0; seed < 10; seed++) {
    const team = foeTeam(floor, 'mid', rng(seed));
    assert.ok(team.every((mon) => speciesData(mon.finalID)?.types.includes(floor.type as string)), `${seed}`);
  }
});

test('the first floors have no Ghosts nor legendaries: early moves could not touch them', () => {
  for (let floorNumber = 1; floorNumber <= 4; floorNumber++) {
    for (let seed = 0; seed < 15; seed++) {
      const team = foeTeam(floorAt(floorNumber, 25, 'hard', 's'), 'hard', rng(seed));
      for (const mon of team) {
        const data = speciesData(mon.finalID);
        assert.ok(!data?.types.includes('ghost'), `${floorNumber}:${seed} ${data?.name}`);
        assert.ok(data!.stats.reduce((sum, stat) => sum + stat, 0) < 580, `${floorNumber}:${seed} ${data?.name}`);
      }
    }
  }
});

test('the hard difficulties train their Pokémon; the easy ones do not', () => {
  assert.ok(foeTeam(floorAt(15, 25, 'hard', 's'), 'hard', rng(1)).every((mon) => mon.natureChoice && mon.evs));
  assert.ok(foeTeam(floorAt(15, 25, 'easy', 's'), 'easy', rng(1)).every((mon) => !mon.natureChoice && !mon.evs));
  assert.ok(foeTeam(floorAt(14, 25, 'easy', 's', 'tough'), 'easy', rng(1)).every((mon) => mon.natureChoice && mon.evs), 'a tough room is always trained');
});

test('a team never brings the same form twice, and a calm rival brings weaker species than a tough one', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    for (const floor of [4, 9, 14]) {
      const teamOf = (room: 'calm' | 'tough') => foeTeam(floorAt(floor, 25, 'mid', seed, room), 'mid', rng(`${seed}:${floor}`));
      for (const team of [teamOf('calm'), teamOf('tough')]) assert.equal(new Set(team.map((mon) => mon.finalID)).size, team.length, `${seed} ${floor}`);
      const power = (team: RosterEntry[]) => team.reduce((sum, mon) => sum + baseStatTotal(mon.finalID), 0) / team.length;
      assert.ok(power(teamOf('tough')) > power(teamOf('calm')), `${seed} ${floor}`);
    }
  }
});

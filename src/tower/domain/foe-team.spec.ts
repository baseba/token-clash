import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveOrigins, rng, speciesData } from '../../catalog/domain/creatures.js';
import { moveData } from '../../combat/domain/moves.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { fitToParty, floorAt, levelCap } from './floors.js';
import { baseStatTotal, evolutionPath } from './growth.js';
import { foePicks, foeTeam } from './foe-team.js';

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

const partyWith = (iv: number, evs: number) => Array.from({ length: 3 }, () => ({
  ivs: { hp: iv, atk: iv, def: iv, satk: iv, sdef: iv, spd: iv },
  evs: { hp: 0, atk: evs / 2, def: 0, satk: 0, sdef: 0, spd: evs / 2 },
}));

test('a rival has IVs around your party and, trained, about as many EVs as yours', () => {
  const floor = floorAt(15, 25, 'hard', 's');
  const total = (evs: object | undefined) => Object.values(evs ?? {}).reduce((sum: number, value: number) => sum + value, 0);
  for (let seed = 0; seed < 10; seed++) {
    const team = foeTeam(floor, 'hard', rng(seed), partyWith(12, 64));
    for (const mon of team) {
      assert.deepEqual(mon.battleIvs, mon.ivs);
      assert.ok(Object.values(mon.ivs).every((iv) => iv >= 12 - 3 + 2 && iv <= 12 + 3 + 2), `${seed} ${JSON.stringify(mon.ivs)}`);
      assert.equal(total(mon.evs), 64);
    }
    assert.ok(foeTeam(floor, 'hard', rng(seed), partyWith(12, 0)).every((mon) => total(mon.evs) === 0), 'no EVs of yours, none of theirs');
  }
  const easy = foeTeam(floorAt(14, 25, 'easy', 's'), 'easy', rng(1), partyWith(20, 0));
  assert.ok(easy.every((mon) => Object.values(mon.ivs).every((iv) => iv <= 20 - 6 + 3)));
});

test('the first floors bring only level moves; later rivals also know taught moves, stronger the higher they are', () => {
  const taught = (floorNumber: number, seed: number) => {
    const floor = floorAt(floorNumber, 50, 'hard', 's');
    return foeTeam(floor, 'hard', rng(seed)).flatMap((mon) => {
      const origins = moveOrigins({ finalID: mon.finalID });
      return (mon.moveset ?? []).filter((id) => origins.get(id)?.origin !== 'level').map((id) => ({ id, level: mon.battleLevel ?? 0 }));
    });
  };
  for (let seed = 0; seed < 8; seed++) assert.deepEqual(taught(1, seed), [], `${seed}`);
  const late = Array.from({ length: 8 }, (_, seed) => taught(30, seed)).flat();
  assert.ok(late.length > 0);
  for (const move of [...late, ...Array.from({ length: 8 }, (_, seed) => taught(12, seed)).flat()]) assert.ok((moveData(move.id)?.power ?? 0) <= 45 + move.level * 1.2, move.id);
});

test('a rival is a draw, not the best of its theme: many species come across seeds, and few of them again once you met them', () => {
  const floor = floorAt(18, 50, 'hard', 's', 'tough');
  const lines = Array.from({ length: 20 }, (_, seed) => foeTeam(floor, 'hard', rng(seed)).map((mon) => evolutionPath(mon.finalID)[0]));
  assert.ok(new Set(lines.flat()).size >= floor.teamSize * 2 + 2, `${new Set(lines.flat()).size}`);
  const met = lines[0];
  const again = Array.from({ length: 20 }, (_, seed) => foeTeam(floor, 'hard', rng(seed), [], met)).flat().filter((mon) => met.includes(evolutionPath(mon.finalID)[0])).length;
  const before = lines.flat().filter((line) => met.includes(line)).length;
  assert.ok(again < before / 2, `${again} vs ${before}`);
});

test('a themed class brings at most two of its own species and fills up with others of their types', () => {
  for (let seed = 0; seed < 10; seed++) {
    const floor = floorAt(20, 50, 'mid', `g${seed}`, 'hideout');
    if (!floor.species.length) continue;
    const own = floor.species.map((id) => evolutionPath(id)[0]);
    const team = foeTeam(floor, 'mid', rng(seed));
    assert.ok(team.filter((mon) => own.includes(evolutionPath(mon.finalID)[0])).length <= 2, `${seed}`);
    assert.equal(team.length, floor.teamSize);
  }
});

test('the draw does not narrow with difficulty, but a harder rival picks the best three of it; a leader always brings its ace', () => {
  const route = floorAt(19, 50, 'mid', 's');
  const lines = (difficulty: 'easy' | 'skynet') => new Set(Array.from({ length: 20 }, (_, seed) => foeTeam(route, difficulty, rng(seed)).map((mon) => evolutionPath(mon.finalID)[0])).flat()).size;
  assert.ok(lines('skynet') >= lines('easy') - 3, `${lines('skynet')} vs ${lines('easy')}`);
  const team = foeTeam(route, 'mid', rng(1));
  const worth = (index: number) => baseStatTotal(team[index].finalID) * (team[index].battleLevel ?? 0);
  const strongest = team.map((_, index) => index).sort((a, b) => worth(b) - worth(a)).slice(0, 3).sort().join();
  const picked = (difficulty: 'easy' | 'skynet') => Array.from({ length: 40 }, (_, seed) => foePicks(route, team, difficulty, rng(seed), 3).sort().join());
  assert.ok(picked('skynet').filter((three) => three === strongest).length > picked('easy').filter((three) => three === strongest).length);
  assert.ok(new Set(picked('easy')).size > 2, 'an easy rival mixes its three');
  const gym = floorAt(25, 50, 'veryhard', 's');
  const gymTeam = foeTeam(gym, 'veryhard', rng(1));
  assert.ok(Array.from({ length: 20 }, (_, seed) => foePicks(gym, gymTeam, 'easy', rng(seed), 3)).every((three) => three.length === 3 && new Set(three).size === 3 && three.includes(gymTeam.length - 1)));
});

test('later rivals hold items: a gym leader\'s ace first, whole teams of the last bosses, and never on easy', () => {
  assert.ok(foeTeam(floorAt(3, 50, 'hard', 's'), 'hard', rng(1)).every((mon) => !mon.heldItem));
  const gym = foeTeam(floorAt(10, 50, 'hard', 's'), 'hard', rng(1));
  assert.ok(gym.at(-1)?.heldItem && gym.slice(0, -1).every((mon) => !mon.heldItem));
  assert.ok(foeTeam(floorAt(30, 50, 'hard', 's'), 'hard', rng(1)).every((mon) => mon.heldItem));
  assert.ok(foeTeam(floorAt(30, 50, 'easy', 's'), 'easy', rng(1)).every((mon) => !mon.heldItem));
});

test('a team always finishes drawing, even when its theme has fewer distinct forms than it wants (Drayden on floor 35 hung the server)', () => {
  const floor = fitToParty(floorAt(35, 50, 'mid', 's2'), [levelCap(35), levelCap(35), levelCap(35) - 1]);
  const team = foeTeam(floor, 'mid', rng('s2:35:null'));
  assert.ok(team.length >= 3 && team.length <= floor.teamSize);
  assert.equal(new Set(team.map((mon) => mon.finalID)).size, team.length);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHAMPIONS, ELITE_FOUR, GYM_LEADERS, VILLAINS } from '../../catalog/domain/trainer-sprites.js';
import { TYPE_SCENES } from '../../catalog/domain/tower-cast.js';
import { floorAt, floorKind, foeLevel, levelCap, roomsAt, teamSize } from './floors.js';

const kinds = (length: number | null, upTo: number) => Array.from({ length: upTo }, (_, i) => floorKind(i + 1, length));
const baseOf = (floor: number, length: number | null, seed: string) => floorAt(floor, length, 'mid', seed).foe?.base;

test('a climb of 25 has a gym every 5 floors, then the Elite Four and the champion', () => {
  const layout = kinds(25, 25);
  assert.deepEqual([5, 10, 15, 20].map((floor) => layout[floor - 1]), ['gym', 'gym', 'gym', 'gym']);
  assert.deepEqual(layout.slice(20, 24), ['elite', 'elite', 'elite', 'elite']);
  assert.equal(layout[24], 'champion');
  assert.equal(layout.filter((kind) => kind === 'trainer').length, 16);
});

test('a climb of 10 ends with the champion and has no Elite Four', () => {
  const layout = kinds(10, 10);
  assert.equal(layout[4], 'gym');
  assert.equal(layout[9], 'champion');
  assert.ok(!layout.includes('elite'));
});

test('leaders, Elite Four and champions come from every region and never repeat in a climb', () => {
  const gymFloors = Array.from({ length: 20 }, (_, i) => (i + 1) * 5).filter((floor) => floorKind(floor, null) === 'gym');
  const gyms = gymFloors.map((floor) => baseOf(floor, null, 's'));
  assert.equal(new Set(gyms).size, gyms.length);
  const leaders = new Set(Object.values(GYM_LEADERS).flat());
  assert.ok(gyms.every((key) => leaders.has(key as string)));
  const champions = [25, 50, 75].map((floor) => baseOf(floor, null, 's'));
  assert.equal(new Set(champions).size, 3);
  assert.ok(champions.every((key) => CHAMPIONS.includes(key as string)));
  const elite = [21, 22, 23, 24].map((floor) => floorAt(floor, 25, 'mid', 's'));
  assert.equal(new Set(elite.map((floor) => floor.foe?.base)).size, 4);
  assert.ok(elite.every((floor) => floor.type === ELITE_FOUR[floor.foe?.base as string]));
});

test('a boss fights on a scene of its type, to its region\'s music, with its ace', () => {
  for (const floor of [5, 10, 15, 20]) {
    const gym = floorAt(floor, 25, 'mid', 'x');
    assert.ok(TYPE_SCENES[gym.type as string].includes(gym.scene), `${gym.foe?.base} ${gym.scene}`);
    assert.match(gym.music, /^battle_/);
    assert.equal(gym.foe?.title, 'Líder');
  }
  assert.ok(floorAt(25, 25, 'mid', 'x').signature);
});

test('every battle is 3 against 3 from the first floor; later rivals bring more to choose from', () => {
  assert.equal(teamSize(1, 'trainer'), 3);
  assert.ok(teamSize(30, 'trainer') > 3 && teamSize(30, 'trainer') <= 6);
  assert.equal(teamSize(25, 'champion'), 6);
});

test('plain floors offer a trainer and one or two other ways; bosses offer none', () => {
  for (let floor = 1; floor < 25; floor++) {
    const rooms = roomsAt(floor, 25, 's');
    if (floorKind(floor, 25) !== 'trainer') assert.deepEqual(rooms, []);
    else {
      assert.equal(rooms[0], 'trainer');
      assert.ok(rooms.length >= 2 && rooms.length <= 3 && new Set(rooms).size === rooms.length);
      if (floor <= 2) assert.ok(!rooms.includes('hideout') && !rooms.includes('deal'), 'no hideouts while warming up');
    }
  }
});

test('a hideout is fought against a villain team', () => {
  const villains = new Set([...VILLAINS.admin, ...VILLAINS.boss]);
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f']) {
    const floor = floorAt(12, 25, 'mid', seed, 'hideout');
    assert.ok(floor.foe && (villains.has(floor.foe.base) || floor.foe.base.includes('_grunt')), floor.foe?.base);
    assert.equal(floor.music, 'battle_rocket_grunt');
  }
});

test('a room with no battle has no rival', () => {
  assert.equal(floorAt(3, 25, 'mid', 's', 'rest').foe, null);
});

test('the same climb always meets the same trainers, and another climb others', () => {
  const route = (seed: string) => Array.from({ length: 4 }, (_, i) => floorAt(i + 1, 25, 'mid', seed)).map((floor) => `${floor.foe?.key}:${floor.foe?.name}`);
  assert.deepEqual(route('a'), route('a'));
  assert.notDeepEqual(route('a'), route('b'));
});

test('rivals start a level over your party and pull further ahead every few floors; bosses and difficulty add more', () => {
  assert.equal(foeLevel(1, 'trainer', 'mid'), levelCap(1) + 1, 'from the first floor');
  assert.ok(foeLevel(1, 'trainer', 'easy') <= levelCap(1));
  const gap = (floor: number) => foeLevel(floor, 'trainer', 'mid') - levelCap(floor);
  assert.ok(gap(13) > gap(1) && gap(37) > gap(13));
  assert.ok(foeLevel(5, 'gym', 'mid') > foeLevel(5, 'trainer', 'mid'));
  assert.ok(foeLevel(25, 'champion', 'mid') > foeLevel(24, 'elite', 'mid'));
  assert.ok(foeLevel(10, 'trainer', 'veryhard') > foeLevel(10, 'trainer', 'mid'));
});

test('each way of a floor is its own rival: a tough one stronger, trained and with one more Pokémon, a calm one weaker', () => {
  for (const seed of ['a', 'b', 'c', 'd']) {
    const plain = floorAt(9, 25, 'mid', seed, 'trainer');
    const tough = floorAt(9, 25, 'mid', seed, 'tough');
    const calm = floorAt(9, 25, 'mid', seed, 'calm');
    assert.notEqual(tough.foe?.base, plain.foe?.base, seed);
    assert.notEqual(calm.foe?.base, plain.foe?.base, seed);
    assert.equal(tough.level, plain.level + 2);
    assert.equal(calm.level, plain.level - 2);
    assert.ok(tough.trained && !calm.trained);
    assert.equal(tough.teamSize, plain.teamSize + 1);
    assert.equal(calm.teamSize, 3);
    assert.deepEqual([calm.strength, plain.strength, tough.strength], ['weak', 'normal', 'strong']);
  }
});

test('route trainers never repeat the theme of the floor below, and no Ghost theme before level 15', () => {
  for (const seed of ['a', 'b', 'c', 'd', 'e']) {
    for (let floor = 2; floor < 25; floor++) {
      const here = floorAt(floor, null, 'mid', seed);
      const below = floorAt(floor - 1, null, 'mid', seed);
      if (here.kind !== 'trainer' || below.kind !== 'trainer') continue;
      assert.notDeepEqual([...here.types].sort(), [...below.types].sort(), `${seed} ${floor}`);
      for (const room of ['trainer', 'calm', 'tough'] as const) {
        const way = floorAt(floor, null, 'mid', seed, room);
        if (way.level < 15) assert.ok(!way.types.includes('ghost'), `${seed} ${floor} ${room}`);
      }
    }
  }
});

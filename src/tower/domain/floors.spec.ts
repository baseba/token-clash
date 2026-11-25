import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RoomKind, TwistKey } from '../../catalog/domain/tower-cast.js';
import { CHAMPIONS, ELITE_FOUR, GYM_LEADERS, VILLAINS } from '../../catalog/domain/trainer-sprites.js';
import { CLASS_LINES } from '../../catalog/domain/tower-lines.js';
import { NAMES, START_LEVEL, TYPE_SCENES } from '../../catalog/domain/tower-cast.js';
import { fitToParty, floorAt, floorKind, foeLevel, levelCap, detoursOffered, roomsAt, stretchStart, teamSize } from './floors.js';

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

test('rumours change the ways: a breeze brings more calm routes, a black market more dark deals, a breeding season more dens', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => `rumour${i}`);
  const count = (twist: TwistKey | null, room: RoomKind) => seeds.reduce((sum, seed) => sum + [4, 6, 8, 12].filter((floor) => roomsAt(floor, 25, seed, {}, twist).includes(room)).length, 0);
  assert.ok(count('breeze', 'calm') > count(null, 'calm'));
  assert.ok(count('blackMarket', 'deal') > count(null, 'deal'));
  assert.ok(count('breeding', 'den') > count(null, 'den'));
});

test('in a league of veterans every route rival comes trained', () => {
  for (const seed of ['a', 'b', 'c', 'd'])
    for (let floor = 1; floor < 25; floor++)
      for (const room of roomsAt(floor, 25, seed)) {
        const drawn = floorAt(floor, 25, 'easy', seed, room, {}, 'veterans');
        if (drawn.foe) assert.ok(drawn.trained, `${seed} ${floor} ${room}`);
      }
});

test('plain floors offer a trainer and one or two other ways; bosses offer none', () => {
  for (let floor = 1; floor < 25; floor++) {
    const rooms = roomsAt(floor, 25, 's');
    if (floorKind(floor, 25) !== 'trainer') assert.deepEqual(rooms, []);
    else {
      assert.equal(rooms[0], 'trainer');
      assert.ok(rooms.length >= 3 && rooms.length <= 5 && new Set(rooms).size === rooms.length);
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

test('like Emerald Rogue, route rivals stay under your level cap and bosses fight right at it', () => {
  for (let floor = 1; floor <= 49; floor++) {
    const kind = floorKind(floor, null);
    const level = foeLevel(floor, kind, 'mid');
    if (kind === 'trainer') assert.ok(level < levelCap(floor), `${floor}`);
    else assert.ok(level >= levelCap(floor) && level <= levelCap(floor) + 1, `${floor}`);
  }
  assert.equal(foeLevel(5, 'gym', 'mid'), levelCap(5));
  assert.equal(foeLevel(25, 'champion', 'mid'), levelCap(25) + 1);
  assert.ok(foeLevel(1, 'trainer', 'mid') <= 4, 'the first floor is gentle');
  assert.equal(foeLevel(10, 'trainer', 'veryhard'), foeLevel(10, 'trainer', 'mid') + 1);
  assert.equal(foeLevel(10, 'trainer', 'easy'), foeLevel(10, 'trainer', 'mid') - 1);
});

test('a stretch between bosses starts at the level of the last boss', () => {
  assert.equal(stretchStart(3), START_LEVEL - 2);
  assert.equal(stretchStart(7), levelCap(5));
  assert.equal(stretchStart(10), levelCap(5));
  assert.equal(stretchStart(11), levelCap(10));
});
test('each way of a floor is its own rival: a tough one stronger, trained and with one more Pokémon, a calm one weaker', () => {
  for (const seed of ['a', 'b', 'c', 'd']) {
    const plain = floorAt(9, 25, 'mid', seed, 'trainer');
    const tough = floorAt(9, 25, 'mid', seed, 'tough');
    const calm = floorAt(9, 25, 'mid', seed, 'calm');
    assert.notEqual(tough.foe?.base, plain.foe?.base, seed);
    assert.notEqual(calm.foe?.base, plain.foe?.base, seed);
    assert.ok(calm.level < plain.level && plain.level < tough.level, seed);
    assert.equal(calm.level, Math.max(stretchStart(9), levelCap(9) - 4));
    assert.equal(tough.level, levelCap(9), 'a tough rival fights at your cap');
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

test('a woman trainer gets a woman\'s name and her lines agree with her; a pair gets two names', () => {
  const women = ['beauty', 'parasol_lady', 'maid', 'aroma_lady', 'swimmer_f'];
  for (let seed = 0; seed < 300; seed++) {
    const floor = floorAt(1 + (seed % 20), null, 'mid', `w${seed}`);
    if (!floor.foe || floor.kind !== 'trainer') continue;
    const text = `${floor.lines.hello} ${floor.lines.lose}`;
    assert.ok(!text.includes('{o}'), text);
    if (women.includes(floor.foe.base)) assert.ok(NAMES.f.includes(floor.foe.name), `${floor.foe.base}: ${floor.foe.name}`);
    if (['twins', 'young_couple', 'hooligans'].includes(floor.foe.base)) assert.match(floor.foe.name, / y /);
  }
});

test('names change from floor to floor, and lines vary within a climb', () => {
  const floors = Array.from({ length: 12 }, (_, i) => floorAt(i + 1, null, 'mid', 'names')).filter((floor) => floor.kind === 'trainer');
  const names = floors.map((floor) => floor.foe?.name);
  assert.equal(new Set(names).size, names.length);
  assert.ok(new Set(floors.map((floor) => floor.lines.hello)).size >= floors.length - 1);
});

test('rumours: wild routes always offer a tough way, a night climb turns every scene to night', () => {
  for (let floor = 3; floor < 20; floor++) if (floor % 5) assert.ok(roomsAt(floor, 25, 'wild', {}, 'wild').includes('tough'), String(floor));
  for (let floor = 1; floor < 10; floor++) {
    const scene = floorAt(floor, 25, 'mid', 'n', null, {}, 'night').scene;
    assert.match(scene, /-night$|underwater/, scene);
  }
});

test('a rival is never above your strongest Pokémon, and a boss or a villain leader at most one over', () => {
  const tough = floorAt(14, 25, 'veryhard', 's', 'tough');
  assert.equal(fitToParty(tough, [20, 20, 26]).level, 26);
  assert.equal(fitToParty(tough, [40, 40, 40]).level, tough.level, 'a party at the cap meets the curve');
  const trainer = floorAt(14, 25, 'veryhard', 's');
  assert.equal(fitToParty(trainer, [18, 20, 21]).level, 21);
  const gym = floorAt(15, 25, 'veryhard', 's');
  assert.equal(fitToParty(gym, [20, 25]).level, 26);
});

test('a villain leader fights a level over its grunts with one more Pokémon, and seasoned or rookie trainers show up on their ways', () => {
  const hideouts = Array.from({ length: 40 }, (_, seed) => floorAt(18, 50, 'mid', `h${seed}`, 'hideout'));
  const leader = hideouts.find((floor) => floor.signature !== null);
  const grunt = hideouts.find((floor) => floor.signature === null);
  assert.ok(leader && grunt);
  assert.equal(grunt.level, levelCap(18));
  assert.equal(leader.level, levelCap(18) + 1);
  assert.equal(leader.teamSize, Math.min(6, grunt.teamSize + 1));
  const bases = (room: 'tough' | 'calm') => new Set(Array.from({ length: 60 }, (_, seed) => floorAt(12, 50, 'mid', `m${seed}`, room).foe?.base));
  assert.ok(['ace_trainer', 'veteran', 'rival', 'player'].some((base) => [...bases('tough')].some((key) => key?.startsWith(base))));
  assert.ok(['youngster', 'school_kid', 'preschooler', 'nursery_aide'].some((base) => [...bases('calm')].some((key) => key?.startsWith(base))));
});

test('a plain floor offers three to five ways, and every count shows up', () => {
  const counts = new Set<number>();
  for (const seed of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) for (let floor = 1; floor < 25; floor++) if (floorKind(floor, 25) === 'trainer') counts.add(roomsAt(floor, 25, seed).length);
  assert.deepEqual([...counts].sort(), [3, 4, 5]);
});

test('after a detour the next two plain floors offer only routes, as drawn, a boss in between not counting', () => {
  assert.ok(detoursOffered(3, 25, null));
  assert.ok(!detoursOffered(2, 25, 1) && !detoursOffered(3, 25, 1));
  assert.ok(detoursOffered(4, 25, 1));
  assert.ok(!detoursOffered(6, 25, 4) && !detoursOffered(7, 25, 4), 'the gym on floor 5 is not a plain floor');
  assert.ok(detoursOffered(8, 25, 4));
  const offers = new Set<string>();
  for (const seed of Array.from({ length: 40 }, (_, i) => `detour${i}`))
    for (const twist of [null, 'market', 'migration', 'night', 'wild'] as const) {
      const rooms = roomsAt(4, 25, seed, {}, twist, 3);
      assert.equal(rooms[0], 'trainer');
      assert.ok(rooms.length >= 2 && rooms.every((room) => ['trainer', 'tough', 'calm'].includes(room)), `${seed} ${twist}: ${rooms}`);
      if (twist === 'wild') assert.ok(rooms.includes('tough'));
      offers.add([...rooms].sort().join());
    }
  assert.deepEqual([...offers].sort(), ['calm,tough,trainer', 'calm,trainer', 'tough,trainer'], 'not always the same three');
});

test('every route trainer has a voice of its own, and the classes met most three lines or more', () => {
  const met = new Map<string, number>();
  let battles = 0;
  for (const seed of Array.from({ length: 40 }, (_, i) => `voices${i}`))
    for (let floor = 1; floor <= 50; floor++)
      for (const room of roomsAt(floor, 50, seed)) {
        const drawn = floorAt(floor, 50, 'mid', seed, room);
        if (!drawn.foe || room === 'hideout') continue;
        assert.ok(drawn.lines.hello && drawn.lines.lose && drawn.lines.win, drawn.foe.base);
        const base = drawn.foe.base.replace(/_(m|f)(_\d+)?$|_\d+$/, '');
        met.set(base, (met.get(base) ?? 0) + 1);
        battles++;
      }
  for (const [base, count] of met) {
    assert.ok((CLASS_LINES[base]?.length ?? 0) >= 2, `${base} has a voice`);
    if (count / battles >= 0.014) assert.ok(CLASS_LINES[base].length >= 3, `${base} is met often`);
  }
});

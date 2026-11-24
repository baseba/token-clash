import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BOSS_LINES, CLASS_LINES, LAB_SCENE, MUSIC, NAMES, REGIONS, ROOMS, ROUTE_SCENES, sceneMusic, STOP_PEOPLE, TWIST_KEYS, TWISTS, TYPE_LINES, TYPE_SCENES, VILLAIN_LINES } from '../../public/tower-cast.js';
import { MUSIC_TRACKS } from '../../public/music.js';
import { CHAMPIONS, DOWNLOADED_SPRITES, ELITE_FOUR, GYM_LEADERS } from '../../public/trainer-sprites.js';

const backgrounds = [...readFileSync(new URL('../../public/backgrounds.js', import.meta.url), 'utf8').matchAll(/file: '([a-z0-9-]+)'/g)].map((m) => m[1]);
const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

test('every floor of the Tower is one of our battle backgrounds, with a track we sync for the battle and for the map', () => {
  for (const scene of [LAB_SCENE, ...ROUTE_SCENES, ...Object.values(TYPE_SCENES).flat()]) {
    assert.ok(backgrounds.includes(scene), scene);
    assert.ok(MUSIC_TRACKS.includes(sceneMusic(scene)), scene);
  }
  const tracks = [MUSIC.route, MUSIC.lateRoute, MUSIC.hideout, ...Object.values(MUSIC.gym), ...Object.values(MUSIC.elite), ...Object.values(MUSIC.champion)];
  for (const track of tracks) assert.ok(MUSIC_TRACKS.includes(track), track);
});

test('every type has scenes and a voice, and every boss belongs to a region', () => {
  for (const type of TYPES) {
    assert.ok(TYPE_SCENES[type]?.length, type);
    assert.ok(TYPE_LINES[type]?.length >= 2, type);
    for (const line of TYPE_LINES[type]) assert.equal(line.length, 2, type);
  }
  const regional = new Set(Object.values(REGIONS).flat());
  const bosses = [...Object.values(GYM_LEADERS).flat(), ...Object.keys(ELITE_FOUR), ...CHAMPIONS];
  for (const key of bosses) assert.ok(regional.has(key), key);
  for (const key of Object.keys(BOSS_LINES)) assert.ok(DOWNLOADED_SPRITES.includes(key), key);
  assert.ok(NAMES.m.length >= 40 && NAMES.f.length >= 40);
  assert.equal(new Set(NAMES.m).size, NAMES.m.length);
  assert.equal(new Set(NAMES.f).size, NAMES.f.length);
  for (const lines of [...Object.values(CLASS_LINES), ...Object.values(VILLAIN_LINES)]) for (const line of lines) assert.equal(line.length, 2);
  for (const person of Object.values(STOP_PEOPLE)) assert.ok(person.speaker && person.lines.length);
  for (const key of TWIST_KEYS) assert.ok(TWISTS[key].name && TWISTS[key].text);
  assert.ok(ROOMS.trainer.battle && !ROOMS.rest.battle);
});

test('overworld frames: four groups of four, walking steps between idle frames', async () => {
  const { frameIndex } = await import('../../public/overworld.js');
  assert.equal(frameIndex('down', 0, false), 4);
  assert.deepEqual([0, 1, 2, 3].map((step) => frameIndex('up', step, true)), [1, 0, 2, 0]);
  assert.deepEqual([0, 1, 2, 3].map((step) => frameIndex('right', step, true)), [13, 12, 14, 12]);
});

test('a crossroads has one exit per way, each on an edge of the map and none twice', async () => {
  const { COLS, ROWS, PATH_ROW, forkExits } = await import('../../public/tower-tiles.js');
  for (const count of [1, 2, 3, 4, 5]) {
    const exits = forkExits(count);
    assert.equal(exits.length, count);
    assert.equal(new Set(exits.map((exit) => `${exit.side}:${exit.col}`)).size, count);
    for (const exit of exits) {
      if (exit.side === 'up') assert.ok(exit.row === 0 && exit.col > 0 && exit.col < COLS - 1);
      else assert.ok(exit.row === PATH_ROW && exit.col === (exit.side === 'left' ? 0 : COLS - 1));
    }
    assert.ok(exits.every((exit) => exit.row >= 0 && exit.row < ROWS));
  }
});

test('every scene of a floor draws a map from the atlas, its way clear from the bottom edge to the exits and its other sides closed', async () => {
  const { ATLAS_KEYS, COLS, ROWS, PATH_ROW, T, floorWays, forkExits, mapLayout, sceneLook, tintPixels } = await import('../../public/tower-tiles.js');
  const blocking = new Set([...T.ledge, T.rock, ...T.caveBoulder, ...T.forestTrunks, ...T.forestCanopy, ...T.treeBottom, ...T.smallTree, T.sea, T.tall]);
  const clear = (grid, scene, cells) => { for (const [row, col] of cells) assert.ok(!blocking.has(grid[row][col]), `${scene} ${row}:${col}`); };
  const column = (col, from, to) => Array.from({ length: to - from + 1 }, (_, i) => [from + i, col]);
  const row = (at, from, to) => Array.from({ length: to - from + 1 }, (_, i) => [at, from + i]);
  for (const scene of ['lab', ...backgrounds]) {
    const layouts = [...[1, 2, 3, 4, 5].map((forks) => ({ forks })), ...Array.from({ length: 12 }, (_, i) => floorWays(`seed-${i}`))];
    for (const layout of layouts) {
      const grid = mapLayout({ scene, seed: 's', ...layout });
      assert.equal(grid.length, ROWS);
      for (const keys of grid) {
        assert.equal(keys.length, COLS);
        for (const key of keys) assert.ok(ATLAS_KEYS.includes(key), `${scene}: ${key}`);
      }
      if (scene === 'lab') continue;
      if (layout.forks) {
        const exits = forkExits(layout.forks);
        const cols = exits.map((exit) => exit.col);
        clear(grid, scene, [...column(8, PATH_ROW, ROWS - 1), ...row(PATH_ROW, Math.min(8, ...cols), Math.max(8, ...cols))]);
        for (const exit of exits.filter((exit) => exit.side === 'up')) clear(grid, scene, column(exit.col, 0, PATH_ROW));
        if (!exits.some((exit) => exit.side === 'left')) assert.ok(blocking.has(grid[PATH_ROW][0]), `${scene} ${layout.forks} closed on the left`);
        if (!exits.some((exit) => exit.side === 'right')) assert.ok(blocking.has(grid[PATH_ROW][COLS - 1]), `${scene} ${layout.forks} closed on the right`);
      } else {
        const { from, upTo } = layout;
        clear(grid, scene, [...column(from, PATH_ROW, ROWS - 1), ...row(PATH_ROW, Math.min(from, upTo), Math.max(from, upTo)), ...column(upTo, 0, PATH_ROW), [PATH_ROW - 1, layout.aside]]);
        assert.ok(blocking.has(grid[PATH_ROW][0]) && blocking.has(grid[PATH_ROW][COLS - 1]), `${scene} closed on both sides`);
      }
    }
    assert.ok(Array.isArray(sceneLook(scene).tints));
  }
  const pixel = new Uint8ClampedArray([100, 200, 100, 255]);
  tintPixels(pixel, ['night']);
  assert.ok(pixel[2] > pixel[0], 'night is bluish');
});

test('a floor is crossed from the bottom edge to the top one, and the beaten rival steps aside onto the way', async () => {
  const { COLS, floorWays } = await import('../../public/tower-tiles.js');
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const { from, upTo, aside } = floorWays(`floor-${i}`);
    assert.ok(from >= 3 && from <= COLS - 4 && upTo >= 3 && upTo <= COLS - 4, `${from} ${upTo}`);
    assert.equal(Math.abs(aside - upTo), 1);
    seen.add(`${from}>${upTo}`);
  }
  assert.ok(seen.size >= 20, `${seen.size} ways`);
  assert.deepEqual(floorWays('same'), floorWays('same'));
});

test('a map starts where you left the one before: the same column below, or the side opposite to the one you left a crossroads by', async () => {
  const { COLS, PATH_ROW, T, floorWays, mapLayout } = await import('../../public/tower-tiles.js');
  const blocking = new Set([T.rock, ...T.forestTrunks, ...T.forestCanopy, ...T.treeBottom, ...T.smallTree, T.sea, ...T.caveBoulder]);
  for (let i = 0; i < 40; i++) {
    for (const from of [4, 8, 11]) {
      const ways = floorWays(`floor-${i}`, from);
      assert.equal(ways.from, from);
      assert.ok(ways.upTo >= 3 && ways.upTo <= COLS - 4);
    }
    for (const from of ['left', 'right']) {
      const ways = floorWays(`floor-${i}`, from);
      assert.ok(from === 'left' ? ways.upTo > 8 : ways.upTo < 8, `${from} ${ways.upTo}`);
      for (const scene of ['path', 'lake', 'beach', 'ocean', 'cave', 'desert', 'tall-grass']) {
        const grid = mapLayout({ scene, seed: `s${i}`, from, upTo: ways.upTo });
        const open = from === 'left' ? 0 : COLS - 1;
        const closed = from === 'left' ? COLS - 1 : 0;
        assert.ok(!blocking.has(grid[PATH_ROW][open]), `${scene} open on the ${from}`);
        assert.ok(blocking.has(grid[PATH_ROW][closed]), `${scene} closed on the other side`);
      }
    }
  }
  assert.deepEqual(floorWays('same'), floorWays('same', null));
});

test('each way with no battle has a map of its own, crossed from where you came in to its way out', async () => {
  const { ATLAS_KEYS, COLS, PATH_ROW, ROWS, T, ZONES, mapLayout, sceneLook, zoneWays } = await import('../../public/tower-tiles.js');
  for (const zone of ZONES) {
    assert.equal(sceneLook(`zone-${zone}`).zone, zone);
    for (const from of [null, 3, 8, 12, 'left', 'right']) {
      const ways = zoneWays(zone, `seed-${zone}`, from);
      if (from != null) assert.equal(ways.from, from);
      const grid = mapLayout({ scene: `zone-${zone}`, seed: `seed-${zone}`, from });
      assert.equal(grid.length, ROWS);
      for (const keys of grid) for (const key of keys) assert.ok(ATLAS_KEYS.includes(key), `${zone}: ${key}`);
      const shown = grid.flat();
      if (zone === 'rest') {
        assert.ok(shown.includes(T.pokeCenter[3][1]));
        assert.equal(grid[ways.door.row][ways.door.col], T.pokeCenter[3][1]);
      }
      if (zone === 'den') assert.equal(grid[ways.door.row][ways.door.col], T.burrow);
      if (zone === 'deal') assert.ok(shown.includes(T.fence.l) && shown.includes(T.pond.tl));
      if (zone !== 'hideout') {
        assert.ok(ways.spot.col >= 0 && ways.spot.col < COLS);
        assert.ok(ways.upTo >= 2 && ways.upTo <= COLS - 3);
      }
      assert.ok(grid[PATH_ROW].length === COLS);
    }
  }
});

test('a walker moves a map pixel at a time and takes one step per tile, the feet alternating across walks', async () => {
  const { walkPose } = await import('../../public/overworld.js');
  const opts = { tileMs: 200, pixels: 16 };
  assert.deepEqual(walkPose(0, 2, 0, opts), { along: 0, stride: 1, done: false });
  assert.equal(walkPose(150, 2, 0, opts).stride, 0, 'it stands for the second half of a tile');
  assert.equal(walkPose(250, 2, 0, opts).stride, 2, 'the next tile is the other foot');
  assert.equal(walkPose(25, 2, 0, opts).along, 2 / 16, 'snapped to the map’s pixels');
  assert.equal(walkPose(0, 1, 1, opts).stride, 2, 'a new walk carries on with the foot it left');
  assert.deepEqual(walkPose(999, 2, 0, opts), { along: 2, stride: 0, done: true });
});

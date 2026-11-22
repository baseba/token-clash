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

test('the map forks into as many lanes as ways, inside the map, between the tree borders', async () => {
  const { ROWS, exitRows } = await import('../../public/tower-tiles.js');
  for (const count of [1, 2, 3]) {
    const exits = exitRows(count);
    assert.equal(exits.length, count);
    assert.equal(new Set(exits).size, count);
    assert.ok(exits.every((row) => row >= 1 && row < ROWS - 1));
  }
});

test('every scene of a floor draws a map from the atlas, with its lanes and the path clear', async () => {
  const { ATLAS_KEYS, COLS, ROWS, T, exitRows, mapLayout, sceneLook, tintPixels } = await import('../../public/tower-tiles.js');
  const separators = new Set([...T.ledge, T.rock, T.caveBoulder[1]]);
  for (const scene of ['lab', ...backgrounds]) {
    for (const forks of [0, 1, 2, 3]) {
      const grid = mapLayout({ scene, seed: 's', forks });
      assert.equal(grid.length, ROWS);
      for (const row of grid) {
        assert.equal(row.length, COLS);
        for (const key of row) assert.ok(ATLAS_KEYS.includes(key), `${scene}: ${key}`);
      }
      if (scene === 'lab') continue;
      for (const lane of exitRows(forks)) assert.ok(!separators.has(grid[lane][COLS - 1]), `${scene} lane ${lane}`);
    }
    assert.ok(Array.isArray(sceneLook(scene).tints));
  }
  const pixel = new Uint8ClampedArray([100, 200, 100, 255]);
  tintPixels(pixel, ['night']);
  assert.ok(pixel[2] > pixel[0], 'night is bluish');
});

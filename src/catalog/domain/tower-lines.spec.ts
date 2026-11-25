import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOSS_LINES } from './boss-lines.js';
import { CLASS_LINES, PAIR_LINES, ROOM_LINES, TYPE_LINES, VILLAIN_LINES, type Line } from './tower-lines.js';
import { CHAMPIONS, DOWNLOADED_SPRITES, ELITE_FOUR, GYM_LEADERS, VILLAINS } from './trainer-sprites.js';

const TYPES = ['normal', 'fire', 'water', 'grass', 'electric', 'ice', 'fighting', 'poison', 'ground', 'flying', 'psychic', 'bug', 'rock', 'ghost', 'dragon', 'dark', 'steel', 'fairy'];

const assertLines = (lines: readonly Line[] | undefined, least: number, who: string) => {
  assert.ok(lines && lines.length >= least, `${who} has ${lines?.length ?? 0} lines`);
  for (const line of lines) {
    assert.equal(line.length, 3, who);
    for (const text of line) assert.ok(text.trim(), who);
  }
  assert.equal(new Set(lines.map(([hello]) => hello)).size, lines.length, `${who} repeats a line`);
};

test('every line says hello, loses and wins, and the voices met most have three or more', () => {
  for (const type of TYPES) assertLines(TYPE_LINES[type], 4, type);
  for (const room of ['tough', 'calm'] as const) assertLines(ROOM_LINES[room], 3, room);
  assertLines(PAIR_LINES, 3, 'pair');
  for (const [team, lines] of Object.entries(VILLAIN_LINES)) assertLines(lines, 3, team);
  for (const [key, lines] of Object.entries(CLASS_LINES)) assertLines(lines, 2, key);
  for (const [key, lines] of Object.entries(BOSS_LINES)) assertLines(lines, 2, key);
});

test('every boss and every villain leader has a voice of its own, and a sprite', () => {
  const bosses = [...Object.values(GYM_LEADERS).flat(), ...Object.keys(ELITE_FOUR), ...CHAMPIONS, ...VILLAINS.admin, ...VILLAINS.boss, ...VILLAINS.legend, ...VILLAINS.star];
  for (const key of bosses) assert.ok(BOSS_LINES[key], key);
  for (const key of Object.keys(BOSS_LINES)) assert.ok(DOWNLOADED_SPRITES.includes(key), key);
});

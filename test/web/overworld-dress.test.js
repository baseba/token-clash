import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dressMap, dressPiece } from '../../scripts/overworld-dress.mjs';
import { oklchOf } from '../../scripts/sprite-rotate.mjs';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const key = (hex) => parseInt(hex.slice(1), 16);

function sprite(width, height, rects) {
  const rgba = Buffer.alloc(width * height * 4);
  for (const [x0, y0, x1, y1, hex] of rects)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([...rgb(hex), 255], (y * width + x) * 4);
  return { width, height, rgba };
}

const SKIN = '#ffc594';
const SKIN_SHADE = '#de9473';

function figure(width, { hair, shirt, trousers }) {
  const unit = width / 16;
  return sprite(width, width, [
    [4 * unit, 0, 12 * unit, 3 * unit, hair[0]],
    [5 * unit, 1 * unit, 11 * unit, 2 * unit, hair[1]],
    [5 * unit, 3 * unit, 11 * unit, 5 * unit, SKIN],
    [5 * unit, 5 * unit, 11 * unit, 6 * unit, SKIN_SHADE],
    [3 * unit, 6 * unit, 13 * unit, 10 * unit, shirt[0]],
    [4 * unit, 7 * unit, 12 * unit, 9 * unit, shirt[1]],
    [4 * unit, 10 * unit, 12 * unit, 16 * unit, trousers[0]],
    [5 * unit, 11 * unit, 11 * unit, 15 * unit, trousers[1]],
  ]);
}

test('a borrowed map sprite takes the colours of the same pieces of its trainer, its skin untouched', () => {
  const battle = figure(64, { hair: ['#4a3020', '#6a4830'], shirt: ['#1f5a2a', '#3f8a4a'], trousers: ['#2a2a40', '#45456a'] });
  const overworld = figure(32, { hair: ['#c89020', '#f0c040'], shirt: ['#a02020', '#e04040'], trousers: ['#c0c0c8', '#f0f0f8'] });
  const map = new Map(dressMap(battle, overworld, new Set([key(SKIN), key(SKIN_SHADE)])));
  const shirt = oklchOf(rgb(map.get('#e04040')));
  assert.ok(Math.abs(shirt[2] - oklchOf(rgb('#3f8a4a'))[2]) < 25, 'the red shirt turns green');
  assert.ok(oklchOf(rgb(map.get('#f0c040')))[0] < oklchOf(rgb('#f0c040'))[0] - 0.2, 'the blond hair goes dark brown');
  assert.ok(!map.has(SKIN) && !map.has(SKIN_SHADE));
});

test('a dressed piece keeps the light steps between its tones', () => {
  const colors = ['#a02020', '#e04040'].map((hex) => ({ hex, count: 10, oklch: oklchOf(rgb(hex)) }));
  const [[, dark], [, light]] = dressPiece(colors, { light: 0.3, chroma: 0.02, hue: null });
  const gap = oklchOf(rgb(light))[0] - oklchOf(rgb(dark))[0];
  assert.ok(Math.abs(gap - (colors[1].oklch[0] - colors[0].oklch[0])) < 0.03);
  assert.ok(oklchOf(rgb(dark))[1] <= 0.03, 'a grey target leaves it grey');
});

test('a cap and a uniform of one colour are dressed as one garment, and what the trainer holds dresses nothing', () => {
  const battle = sprite(64, 64, [
    [20, 0, 44, 8, '#29633a'],
    [22, 2, 42, 6, '#5a9c4a'],
    [22, 8, 42, 16, SKIN],
    [16, 16, 48, 64, '#29633a'],
    [20, 20, 44, 60, '#5a9c4a'],
    [16, 16, 20, 24, '#313152'],
    [44, 16, 48, 24, '#5a5a63'],
    [0, 30, 6, 44, '#217384'],
    [1, 32, 5, 42, '#84ded6'],
  ]);
  const overworld = sprite(32, 32, [
    [10, 0, 22, 6, '#6a52bd'],
    [11, 6, 21, 11, SKIN],
    [11, 11, 21, 12, SKIN_SHADE],
    [9, 12, 23, 32, '#413962'],
    [12, 14, 20, 30, '#a48bee'],
  ]);
  const map = new Map(dressMap(battle, overworld, new Set([key(SKIN), key(SKIN_SHADE)])));
  const green = oklchOf(rgb('#5a9c4a'))[2];
  for (const hex of ['#6a52bd', '#413962', '#a48bee']) assert.ok(Math.abs(oklchOf(rgb(map.get(hex)))[2] - green) < 25, `${hex} turns green`);
});

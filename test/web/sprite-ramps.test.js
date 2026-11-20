import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { paletteOf } from '../../scripts/plan-trainer-variants.mjs';
import { lumaOf, paintRamp, rampsOf, recolorProblems } from '../../scripts/sprite-ramps.mjs';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function sprite(width, height, rects) {
  const rgba = Buffer.alloc(width * height * 4);
  for (const [x0, y0, x1, y1, hex] of rects)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([...rgb(hex), 255], (y * width + x) * 4);
  return { width, height, rgba };
}

const NAVY = '#1c2350';
const BLUE = '#3462b0';
const CYAN = '#7ec8e8';
const GREEN_DARK = '#1f5a2a';
const GREEN = '#3fa356';
const WHITE = '#ffffff';
const BLACK = '#000000';

const jacketAndScarf = () =>
  sprite(30, 20, [
    [0, 0, 30, 20, BLACK],
    [1, 1, 15, 19, BLUE],
    [1, 12, 15, 19, NAVY],
    [1, 1, 15, 4, CYAN],
    [15, 1, 29, 19, GREEN],
    [15, 12, 29, 19, GREEN_DARK],
    [13, 4, 17, 8, WHITE],
  ]);

const keyOf = (hex) => parseInt(hex.slice(1), 16);

test('a hue-shifted ramp is one material: the cool shadow and the cyan shine join the blue base', () => {
  const { ramps } = rampsOf(paletteOf(jacketAndScarf()));
  const blue = ramps.find((ramp) => ramp.keys.has(keyOf(BLUE)));
  assert.ok(blue.keys.has(keyOf(NAVY)) && blue.keys.has(keyOf(CYAN)), 'shadow and highlight stay with their base');
  assert.ok(!blue.keys.has(keyOf(GREEN)), 'the scarf is another material');
});

test('the black outline and a white shine shared by two materials are left alone', () => {
  const { shared } = rampsOf(paletteOf(jacketAndScarf()));
  assert.ok(shared.has(keyOf(BLACK)));
  assert.ok(shared.has(keyOf(WHITE)));
});

test('a painted ramp keeps every shade, in the same light order, without merging any two', () => {
  const colors = paletteOf(jacketAndScarf());
  const { ramps, shared } = rampsOf(colors);
  const blue = ramps.find((ramp) => ramp.keys.has(keyOf(BLUE)));
  const map = paintRamp(blue, { hue: 350, sat: 1, light: 1 });
  assert.equal(map.length, blue.colors.length);
  const lumas = blue.colors.map((entry) => lumaOf(rgb(map.find(([from]) => keyOf(from) === keyOf(`#${entry.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`))[1])));
  for (let i = 1; i < lumas.length; i++) assert.ok(lumas[i] > lumas[i - 1], 'darker stays darker');
  assert.deepEqual(recolorProblems(colors, ramps, shared, map), []);
});

test('a recolor that paints half a ramp, a shared color or merges shades is flagged', () => {
  const colors = paletteOf(jacketAndScarf());
  const { ramps, shared } = rampsOf(colors);
  const problems = recolorProblems(colors, ramps, shared, [[BLUE, '#a01020'], [NAVY, '#a01020'], [WHITE, '#ffcccc']]);
  assert.ok(problems.some((p) => p.startsWith('merges')));
  assert.ok(problems.some((p) => p.startsWith('paints only part')));
  assert.ok(problems.some((p) => p.startsWith('paints the shared')));
});

const TRAINERS = new URL('../../public/trainers/', import.meta.url);
test('every generated trainer recolor follows the sprite rules', { skip: existsSync(TRAINERS) ? false : 'needs the trainer sprites in public/trainers: run npm run trainers' }, async () => {
  const { decodePng } = await import('../../scripts/sync-trainers.js');
  const { GENERATED_VARIANTS } = await import('../../public/trainer-variants.js');
  const cache = new Map();
  for (const variant of GENERATED_VARIANTS) {
    if (!cache.has(variant.base)) {
      const colors = paletteOf(decodePng(readFileSync(new URL(`${variant.base}.png`, TRAINERS))));
      cache.set(variant.base, { colors, ...rampsOf(colors) });
    }
    const { colors, ramps, shared } = cache.get(variant.base);
    assert.deepEqual(recolorProblems(colors, ramps, shared, variant.map), [], variant.key);
  }
});

test('a trainer variant paints two materials when it can: the outfit and the hair', async () => {
  const { colorRegions } = await import('../../scripts/plan-trainer-variants.mjs');
  const trainer = sprite(20, 40, [
    [4, 0, 16, 8, '#7a3fb0'],
    [4, 6, 16, 8, '#4a2270'],
    [6, 8, 14, 13, '#ffd6bd'],
    [2, 13, 18, 40, '#3462b0'],
    [2, 30, 18, 40, '#1c2350'],
  ]);
  const [outfit, hair] = colorRegions(trainer);
  assert.ok(outfit.keys.has(keyOf('#3462b0')), 'the jacket is the outfit');
  assert.ok(hair?.keys.has(keyOf('#7a3fb0')), 'the hair is painted too');
  assert.ok(!outfit.keys.has(keyOf('#ffd6bd')) && !hair.keys.has(keyOf('#ffd6bd')), 'skin stays');
});

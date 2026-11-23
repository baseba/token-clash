import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteOf } from '../../scripts/plan-trainer-variants.mjs';
import { rampsOf, recolorProblems } from '../../scripts/sprite-ramps.mjs';

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

test('a recolor that paints half a ramp, a shared color or merges shades is flagged', () => {
  const colors = paletteOf(jacketAndScarf());
  const { ramps, shared } = rampsOf(colors);
  const problems = recolorProblems(colors, ramps, shared, [[BLUE, '#a01020'], [NAVY, '#a01020'], [WHITE, '#ffcccc']]);
  assert.ok(problems.some((p) => p.startsWith('merges')));
  assert.ok(problems.some((p) => p.startsWith('paints only part')));
  assert.ok(problems.some((p) => p.startsWith('paints the shared')));
});

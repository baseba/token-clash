import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paletteOf } from '../../scripts/plan-trainer-variants.mjs';
import { familiesOf, oklchOf, pokemonColorsOf, rgbOfOklch, rotateVariant } from '../../scripts/sprite-rotate.mjs';
import { recolorByMap } from '../../scripts/sync-trainers.js';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function sprite(width, height, rects) {
  const rgba = Buffer.alloc(width * height * 4);
  for (const [x0, y0, x1, y1, hex] of rects)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([...rgb(hex), 255], (y * width + x) * 4);
  return { width, height, rgba };
}

const BLACK = '#000000';
const HAIR = '#5a3a2a';
const SKIN = '#ffd6bd';
const SKIN_SHADOW = '#dea57b';
const JACKET = '#3462b0';
const JACKET_SHADOW = '#1c2f6a';
const JACKET_SHINE = '#7ea8e8';
const COAT = '#f4f4f4';
const COAT_SHADOW = '#c8c8d0';

const trainer = () =>
  sprite(24, 48, [
    [0, 0, 24, 48, BLACK],
    [6, 1, 18, 6, HAIR],
    [7, 6, 17, 14, SKIN],
    [7, 12, 17, 14, SKIN_SHADOW],
    [3, 14, 21, 30, JACKET],
    [3, 26, 21, 30, JACKET_SHADOW],
    [3, 14, 21, 16, JACKET_SHINE],
    [5, 30, 19, 47, COAT],
    [5, 42, 19, 47, COAT_SHADOW],
  ]);

const crimson = { hue: 355, sat: 1, light: 1 };

test('a color goes to OKLCH and back to the same color', () => {
  for (const hex of [JACKET, SKIN, COAT, '#e65a42', '#0089d3']) {
    const [lightness, chroma, hue] = oklchOf(rgb(hex));
    const back = rgbOfOklch(lightness, chroma, hue);
    rgb(hex).forEach((channel, i) => assert.ok(Math.abs(channel - back[i]) <= 1, `${hex} → ${back}`));
  }
});

test('a recolor turns the tint of each tone and keeps its light, leaving the outline and the skin alone', () => {
  const analysis = familiesOf(paletteOf(trainer()));
  const { map } = rotateVariant(analysis, crimson);
  const painted = new Map(map.filter((entry) => entry.length === 2));
  assert.ok(painted.has(JACKET) && painted.has(JACKET_SHADOW) && painted.has(JACKET_SHINE), 'the jacket turns with its shadow and shine');
  assert.ok(!painted.has(BLACK), 'the outline stays');
  assert.ok(!painted.has(SKIN) && !painted.has(SKIN_SHADOW), 'the skin stays');
  for (const hex of [JACKET, JACKET_SHADOW, JACKET_SHINE]) {
    const [fromLight, , fromHue] = oklchOf(rgb(hex));
    const [toLight, , toHue] = oklchOf(rgb(painted.get(hex)));
    assert.ok(Math.abs(fromLight - toLight) < 0.01, `${hex} keeps its light`);
    assert.ok(Math.abs(fromHue - toHue) > 60, `${hex} changes its tint`);
  }
});

test('a big white piece of clothing is tinted so the change shows, keeping it the lightest tone', () => {
  const analysis = familiesOf(paletteOf(trainer()));
  const { map } = rotateVariant(analysis, crimson);
  const painted = new Map(map.filter((entry) => entry.length === 2));
  assert.ok(painted.has(COAT), 'the white coat takes color');
  const [lightness, chroma] = oklchOf(rgb(painted.get(COAT)));
  assert.ok(chroma > 0.04, `the white shows the color: ${chroma}`);
  assert.ok(lightness > oklchOf(rgb(painted.get(JACKET_SHINE)))[0], 'the coat stays lighter than the jacket shine');
});

test('a Pokémon palette puts its vivid color before its blacks and greys', () => {
  const darkrai = sprite(20, 20, [
    [0, 0, 20, 20, '#3a3838'],
    [0, 0, 20, 4, '#a1a7ae'],
    [7, 7, 13, 13, '#a0242b'],
  ]);
  const [first, second] = pokemonColorsOf(darkrai);
  assert.equal(first.neutral, false, 'the red comes first');
  assert.equal(second.neutral, true);
});

test('a skin shadow strip under a recolored cap follows the cap, while the same tone on the face stays skin', () => {
  const CAP = '#c54242';
  const SHADE = '#7b4242';
  const image = sprite(8, 8, [
    [0, 0, 8, 2, CAP],
    [0, 2, 4, 3, SHADE],
    [4, 2, 8, 3, SKIN],
    [0, 3, 8, 8, SKIN],
    [5, 5, 7, 7, SHADE],
  ]);
  const out = recolorByMap(image, [[CAP, '#4262c5'], [SHADE, '#42427b', 'shade'], [SKIN, SKIN, 'skin']]);
  const at = (x, y) => [...out.rgba.subarray((y * 8 + x) * 4, (y * 8 + x) * 4 + 3)];
  assert.deepEqual(at(1, 2), rgb('#42427b'), 'the strip under the cap is the cap shadow');
  assert.deepEqual(at(5, 5), rgb(SHADE), 'the shadow on the face stays');
});

test('brown hair that only brushes the face is not skin, so it turns with its own family', () => {
  const HAIR_LIGHT = '#bd6b52';
  const HAIR_DARK = '#844a29';
  const image = sprite(24, 48, [
    [0, 0, 24, 48, BLACK],
    [4, 1, 20, 10, HAIR_LIGHT],
    [4, 6, 20, 10, HAIR_DARK],
    [8, 10, 16, 18, SKIN],
    [8, 16, 16, 18, SKIN_SHADOW],
    [3, 18, 21, 46, JACKET],
  ]);
  const { kept, families } = familiesOf(paletteOf(image));
  const skin = kept.skin.map((tone) => tone.hex);
  assert.ok(skin.includes(SKIN) && skin.includes(SKIN_SHADOW), `the face is skin: ${skin}`);
  assert.ok(!skin.includes(HAIR_LIGHT) && !skin.includes(HAIR_DARK), `the hair is not skin: ${skin}`);
  const hair = families.find((family) => family.colors.some((color) => color.hex === HAIR_LIGHT));
  assert.equal(hair.unsure, false, 'the hair can be recolored');
});

test('a block of skin shadow tone inside a recolored piece of clothing follows the clothing', () => {
  const CAP = '#c54242';
  const SHADE = '#7b4242';
  const image = sprite(12, 12, [
    [0, 0, 12, 8, CAP],
    [3, 2, 9, 6, SHADE],
    [0, 8, 12, 12, SKIN],
  ]);
  const out = recolorByMap(image, [[CAP, '#4262c5'], [SHADE, '#42427b', 'shade'], [SKIN, SKIN, 'skin']]);
  const at = (x, y) => [...out.rgba.subarray((y * 12 + x) * 4, (y * 12 + x) * 4 + 3)];
  assert.deepEqual(at(5, 4), rgb('#42427b'), 'the block inside the cap is painted');
});

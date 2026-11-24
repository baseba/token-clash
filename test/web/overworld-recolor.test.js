import { test } from 'node:test';
import assert from 'node:assert/strict';
import { battlePlans, overworldVariant, sharedSkinTones } from '../../scripts/overworld-recolor.mjs';
import { oklchOf } from '../../scripts/sprite-rotate.mjs';

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const key = (hex) => parseInt(hex.slice(1), 16);

function sprite(width, height, rects) {
  const rgba = Buffer.alloc(width * height * 4);
  for (const [x0, y0, x1, y1, hex] of rects)
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([...rgb(hex), 255], (y * width + x) * 4);
  return { width, height, rgba };
}

const OUTLINE = '#000000';
const CAP = '#c53939';
const CAP_LIGHT = '#ff6a4a';
const SKIN = '#ffc594';
const SKIN_SHADE = '#de9473';
const DARK_RED = '#943929';
const SHIRT = '#3462b0';
const SHIRT_LIGHT = '#5a8ad8';

function trainer(width) {
  const unit = width / 16;
  return sprite(width, width, [
    [0, 0, width, width, OUTLINE],
    [4 * unit, 1 * unit, 12 * unit, 3 * unit, CAP_LIGHT],
    [4 * unit, 3 * unit, 12 * unit, 5 * unit, CAP],
    [5 * unit, 5 * unit, 11 * unit, 7 * unit, SKIN],
    [5 * unit, 7 * unit, 11 * unit, 8 * unit, SKIN_SHADE],
    [3 * unit, 8 * unit, 13 * unit, 11 * unit, SHIRT_LIGHT],
    [3 * unit, 11 * unit, 13 * unit, 14 * unit, SHIRT],
  ]);
}

test('the skin tones the official map sprites share seed the skin, not the colours many of them wear', () => {
  const sheets = Array.from({ length: 10 }, (_, i) => sprite(8, 8, [[0, 0, 8, 2, SKIN], [0, 2, 8, 4, CAP], [0, 4, 8, 6, DARK_RED], [0, 6, 8, 8, i ? SHIRT : SKIN_SHADE]]));
  const tones = sharedSkinTones(sheets);
  assert.ok(tones.has(key(SKIN)));
  assert.ok(tones.has(key(SKIN_SHADE)), 'one sheet in ten is enough');
  assert.ok(!tones.has(key(CAP)), 'a red cap is not skin');
  assert.ok(!tones.has(key(DARK_RED)), 'a dark warm tone is more often hair than skin');
  assert.ok(!tones.has(key(SHIRT)));
});

test('a variant counts the coloured tones of a battle family it repainted and the hue it turned them to', () => {
  const family = (hexes) => ({ colors: hexes.map((hex) => ({ hex, count: 10, oklch: oklchOf(rgb(hex)) })), weight: hexes.length * 10, chroma: 0.1, neutral: false });
  const jacket = family([SHIRT, SHIRT_LIGHT, '#9a9a9a']);
  const hair = family(['#5a3a2a']);
  const plans = battlePlans({ families: [jacket, hair], opaque: 40 }, [[SHIRT, '#b03434'], [SHIRT_LIGHT, '#d85a5a']]);
  assert.equal(plans.length, 1, 'the grey in the jacket does not turn, so two of its blues are all of it');
  assert.equal(plans[0].family, jacket);
  assert.ok(Math.abs(plans[0].hue - oklchOf(rgb('#b03434'))[2]) < 15);
  const coat = family(['#2a8a4a', '#40b060', '#80d090']);
  assert.equal(battlePlans({ families: [coat], opaque: 30 }, [['#2a8a4a', '#8a2a4a']]).length, 0, 'one tone of three is not a repaint');
});

test('a map sprite takes the hue its battle sprite got on the same clothes, and its skin stays', () => {
  const map = [[SHIRT, '#2f8a3a'], [SHIRT_LIGHT, '#55b862']];
  const { map: repaint, problems } = overworldVariant(trainer(64), trainer(32), map, new Set([key(SKIN), key(SKIN_SHADE)]));
  assert.deepEqual(problems, []);
  const painted = new Map(repaint.filter((entry) => entry.length === 2));
  assert.ok(painted.has(SHIRT) && painted.has(SHIRT_LIGHT));
  assert.ok(Math.abs(oklchOf(rgb(painted.get(SHIRT)))[2] - oklchOf(rgb('#2f8a3a'))[2]) < 20);
  assert.ok(Math.abs(oklchOf(rgb(painted.get(SHIRT)))[0] - oklchOf(rgb(SHIRT))[0]) < 0.02, 'each tone keeps its light');
  for (const tone of [SKIN, SKIN_SHADE, CAP, CAP_LIGHT, OUTLINE]) assert.ok(!painted.has(tone), tone);
});

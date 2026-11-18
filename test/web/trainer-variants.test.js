import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recolorTrainer } from '../../scripts/sync-trainers.js';
import { DOWNLOADED_SPRITES, SHOP_TRAINERS, SPECIALS, TRAINER_SPRITES, TRAINER_VARIANTS } from '../../public/trainer-sprites.js';

const image = (pixels) => ({ width: pixels.length, height: 1, rgba: Buffer.from(pixels.flat()) });

test('a variant recolors only the hues it names and keeps skin, greys and transparency', () => {
  const red = [200, 40, 40, 255];
  const skin = [222, 165, 123, 255];
  const grey = [120, 120, 120, 255];
  const clear = [200, 40, 40, 0];
  const out = recolorTrainer(image([red, skin, grey, clear]), [{ from: [330, 10], hue: 215 }]);
  const [r, g, b] = out.rgba.subarray(0, 3);
  assert.ok(b > r && b > g, 'red became blue');
  assert.deepEqual([...out.rgba.subarray(4, 12)], [...skin, ...grey]);
  assert.deepEqual([...out.rgba.subarray(12, 16)], clear);
});

test('every variant has a downloaded base and is either earned or sold', () => {
  for (const variant of TRAINER_VARIANTS) {
    assert.ok(DOWNLOADED_SPRITES.includes(variant.base), variant.key);
    assert.ok(TRAINER_SPRITES.includes(variant.key), variant.key);
    assert.ok((SPECIALS.includes(variant.key) || !!variant.earn) !== variant.key in SHOP_TRAINERS, variant.key);
  }
});

test('every trainer has at least one color variant, and story characters have three or four', async () => {
  const { CHAMPIONS, VILLAINS } = await import('../../public/trainer-sprites.js');
  const count = (base) => TRAINER_VARIANTS.filter((variant) => variant.base === base).length;
  for (const base of DOWNLOADED_SPRITES) assert.ok(count(base) >= 1, base);
  for (const base of [...CHAMPIONS, ...VILLAINS.boss, ...VILLAINS.legend]) assert.ok(count(base) >= 4, base);
  for (const base of [...VILLAINS.star, 'player_m', 'player_f', 'rival_m', 'rival_f', 'nate', 'rosa', 'hugh']) assert.ok(count(base) >= 3, base);
  assert.equal(new Set(TRAINER_VARIANTS.map((variant) => variant.key)).size, TRAINER_VARIANTS.length);
});

test('a variant of a hard trainer costs more and needs the original first; one of a free trainer does not', async () => {
  const { VARIANT_REQUIRES } = await import('../../public/trainer-sprites.js');
  const { shopItemOf } = await import('../../public/shop.js');
  const champion = TRAINER_VARIANTS.find((variant) => variant.base === 'cynthia' && !variant.name && !variant.earn);
  assert.equal(VARIANT_REQUIRES[champion.key], 'cynthia');
  assert.equal(shopItemOf('trainer', champion.key).rarity, 'mythic');
  const { STARTER_SPRITES } = await import('../../public/trainer-sprites.js');
  const free = TRAINER_VARIANTS.find((variant) => STARTER_SPRITES.includes(variant.base) && !variant.name && !variant.earn);
  assert.equal(VARIANT_REQUIRES[free.key], undefined);
  assert.equal(shopItemOf('trainer', free.key).rarity, 'common');
  const sold = TRAINER_VARIANTS.filter((variant) => variant.key in SHOP_TRAINERS).length;
  assert.ok(sold * 2 <= TRAINER_VARIANTS.length, 'at most half the variants are sold');
});

test('skin of every tone is protected, while vivid orange clothes are not', async () => {
  const { isSkin, hsl } = await import('../../scripts/plan-trainer-variants.mjs');
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (const skin of ['#ffd6bd', '#dea57b', '#c78e6a', '#845a3a', '#55371d', '#764a40', '#a36947', '#efbdad']) assert.ok(isSkin(hsl(rgb(skin))), skin);
  for (const cloth of ['#f7a53a', '#bd7b19', '#cf2b1a', '#3faee6', '#843131']) assert.ok(!isSkin(hsl(rgb(cloth))), cloth);
});

test('a generated variant recolors exactly the colors in its map, shades included', async () => {
  const { recolorByMap } = await import('../../scripts/sync-trainers.js');
  const out = recolorByMap(image([[200, 40, 40, 255], [120, 20, 20, 255], [222, 165, 123, 255]]), [['#c82828', '#2850c8'], ['#781414', '#142878']]);
  assert.deepEqual([...out.rgba], [40, 80, 200, 255, 20, 40, 120, 255, 222, 165, 123, 255]);
});

test('generated variants use many different colors instead of repeating a few', async () => {
  const { GENERATED_VARIANTS, VARIANT_COLOR_NAMES } = await import('../../public/trainer-variants.js');
  const uses = {};
  for (const variant of GENERATED_VARIANTS) uses[variant.color] = (uses[variant.color] ?? 0) + 1;
  assert.ok(Object.keys(VARIANT_COLOR_NAMES).length >= 16);
  assert.ok(Math.max(...Object.values(uses)) <= GENERATED_VARIANTS.length * 0.12, JSON.stringify(uses));
});

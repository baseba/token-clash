import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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
    assert.ok((SPECIALS.includes(variant.key) || !!variant.earn || !!variant.pokemon) !== variant.key in SHOP_TRAINERS, variant.key);
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

test('a recolor on sale costs a tier above its original and always needs the original first', async () => {
  const { VARIANT_REQUIRES } = await import('../../public/trainer-sprites.js');
  const { shopItemOf } = await import('../../public/shop.js');
  const champion = TRAINER_VARIANTS.find((variant) => variant.base === 'cynthia' && !variant.name && !variant.earn);
  assert.equal(VARIANT_REQUIRES[champion.key], 'cynthia');
  assert.equal(shopItemOf('trainer', champion.key).rarity, 'mythic');
  const fisherman = TRAINER_VARIANTS.find((variant) => variant.base === 'fisherman' && variant.key in SHOP_TRAINERS);
  assert.equal(VARIANT_REQUIRES[fisherman.key], 'fisherman');
  assert.equal(shopItemOf('trainer', fisherman.key).rarity, 'rare');
  for (const key of Object.keys(SHOP_TRAINERS)) assert.ok(VARIANT_REQUIRES[key], key);
  for (const base of DOWNLOADED_SPRITES) assert.ok(TRAINER_VARIANTS.some((variant) => variant.base === base && variant.key in SHOP_TRAINERS), `${base} has a recolor on sale`);
  for (const base of DOWNLOADED_SPRITES) assert.ok(!(base in SHOP_TRAINERS), `${base} is earned, not sold`);
});

test('skin of every tone is protected, while vivid orange clothes are not', async () => {
  const { isSkin, hsl } = await import('../../scripts/plan-trainer-variants.mjs');
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (const skin of ['#ffd6bd', '#dea57b', '#c78e6a', '#845a3a', '#55371d', '#764a40', '#a36947', '#efbdad', '#efb57b']) assert.ok(isSkin(hsl(rgb(skin))), skin);
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

const TRAINERS = new URL('../../public/trainers/', import.meta.url);
test('every generated variant changes its colors visibly instead of landing on a near shade', { skip: existsSync(TRAINERS) ? false : 'needs the trainer sprites in public/trainers: run npm run trainers' }, async () => {
  const { decodePng } = await import('../../scripts/sync-trainers.js');
  const { GENERATED_VARIANTS } = await import('../../public/trainer-variants.js');
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const counts = new Map();
  for (const variant of GENERATED_VARIANTS) {
    if (!counts.has(variant.base)) {
      const image = decodePng(readFileSync(new URL(`${variant.base}.png`, TRAINERS)));
      const count = new Map();
      for (let i = 0; i < image.width * image.height; i++) if (image.rgba[i * 4 + 3]) count.set(image.rgba.readUIntBE(i * 4, 3), (count.get(image.rgba.readUIntBE(i * 4, 3)) ?? 0) + 1);
      counts.set(variant.base, count);
    }
    let weight = 0;
    let change = 0;
    for (const [from, to] of variant.map) {
      const n = counts.get(variant.base).get(parseInt(from.slice(1), 16)) ?? 0;
      const [a, b] = [rgb(from), rgb(to)];
      change += n * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      weight += n;
    }
    assert.ok(change / weight >= 38, `${variant.key}: ${Math.round(change / weight)}`);
  }
});

test('every recolor on sale of a trainer that is not free needs the original first, handmade ones too', async () => {
  const { SHOP_TRAINERS, STARTER_SPRITES, TRAINER_VARIANTS, VARIANT_REQUIRES } = await import('../../public/trainer-sprites.js');
  assert.equal(VARIANT_REQUIRES.leon_shadow, 'leon');
  for (const variant of TRAINER_VARIANTS.filter((v) => v.key in SHOP_TRAINERS)) assert.equal(VARIANT_REQUIRES[variant.key], variant.base, variant.key);
});

test('the avatar centers on the head even when an arm is raised higher than it', async () => {
  const { faceOf } = await import('../../scripts/sync-trainers.js');
  const width = 40;
  const height = 60;
  const rgba = Buffer.alloc(width * height * 4);
  const paint = (x0, y0, x1, y1, color) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([...color, 255], (y * width + x) * 4);
  };
  paint(4, 0, 6, 30, [60, 60, 200]);
  paint(22, 6, 32, 16, [222, 165, 123]);
  paint(18, 16, 36, 60, [60, 60, 200]);
  const face = faceOf({ width, height, rgba });
  assert.ok(Math.abs(face.x * width - 27) < 3, `centered on the head, not the arm: ${face.x * width}`);
  assert.ok(face.y * height > 6 && face.y * height < 18, `at head height: ${face.y * height}`);
});

test('every legendary and mythical Pokémon of the game unlocks a recolor of a related trainer', async () => {
  const LEGENDS = [144, 145, 146, 150, 151, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381, 382, 383, 384, 385, 386, 480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493, 494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649];
  const withPokemon = new Set(TRAINER_VARIANTS.filter((variant) => variant.pokemon).map((variant) => variant.pokemon));
  for (const id of LEGENDS) assert.ok(withPokemon.has(id), `#${id}`);
});

test('every recolor themed on a Pokémon has a shiny version painted with that Pokémon\'s shiny colors', async () => {
  const { POKEMON_VARIANT_MAPS } = await import('../../public/trainer-variants.js');
  const themed = TRAINER_VARIANTS.filter((variant) => variant.pokemon && !variant.shiny);
  for (const variant of themed) {
    const shiny = TRAINER_VARIANTS.find((other) => other.key === `${variant.key}_shiny`);
    assert.ok(shiny, variant.key);
    assert.equal(shiny.base, variant.base);
    assert.equal(shiny.pokemon, variant.pokemon);
    assert.ok(POKEMON_VARIANT_MAPS[shiny.key]?.length, `${shiny.key} has a map`);
    assert.notDeepEqual(POKEMON_VARIANT_MAPS[shiny.key], POKEMON_VARIANT_MAPS[variant.key], shiny.key);
  }
});

test('the ♂ and ♀ versions of a trainer share the same recolors, earned or sold the same way', async () => {
  const { MALE_OF } = await import('../../public/trainer-sprites.js');
  assert.equal(MALE_OF.ace_trainer_f, 'ace_trainer_m');
  assert.equal(MALE_OF.player_f_alternate, 'player_m_alternate');
  assert.ok(!('clerk_m_2' in MALE_OF) && !Object.values(MALE_OF).includes('clerk_m_2'), 'a trainer without a partner stays alone');
  const colorsOf = (base) => TRAINER_VARIANTS.filter((variant) => variant.base === base && variant.color).map((variant) => [variant.color, !!variant.earn, variant.key in SHOP_TRAINERS]).sort();
  for (const [female, male] of Object.entries(MALE_OF)) assert.deepEqual(colorsOf(female), colorsOf(male), `${male} / ${female}`);
});

test('only tiny light spots by the face count as eye whites, never a light collar or shoulders', async () => {
  const { eyeWhites } = await import('../../scripts/sync-trainers.js');
  const width = 20;
  const height = 20;
  const rgba = Buffer.alloc(width * height * 4);
  const paint = (x0, y0, x1, y1, color) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([...color, 255], (y * width + x) * 4);
  };
  paint(0, 0, width, height, [222, 165, 123]);
  paint(8, 8, 10, 9, [250, 250, 250]);
  paint(2, 11, 18, 14, [240, 240, 240]);
  const kept = eyeWhites({ width, height, rgba }, { x: 0.45, y: 0.45, h: 0.5 });
  assert.deepEqual([...kept].sort((a, b) => a - b), [8 * width + 8, 8 * width + 9]);
});

test('a head piece is recolored whole: the hair or cap colors that touch recolored ones join the map, with their shine, and skin does not', async () => {
  const { completeHeadPieces } = await import('../../scripts/plan-trainer-variants.mjs');
  const width = 12;
  const height = 24;
  const rgba = Buffer.alloc(width * height * 4);
  const paint = (x0, y0, x1, y1, color) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) rgba.set([...color, 255], (y * width + x) * 4);
  };
  paint(0, 0, width, 5, [173, 82, 107]);
  for (let x = 0; x < width; x += 2) paint(x, 1, x + 1, 4, [107, 33, 58]);
  paint(4, 0, 6, 1, [255, 255, 255]);
  paint(2, 5, 10, 9, [255, 214, 189]);
  paint(0, 9, width, height, [107, 33, 58]);
  const map = completeHeadPieces({ width, height, rgba }, [['#6b213a', '#1a6a50']]);
  const added = new Map(map.slice(1));
  assert.ok(added.has('#ad526b'), 'the hair shade beside the recolored strands joins');
  assert.ok(!added.has('#ffd6bd'), 'skin stays');
  assert.ok(added.has('#ffffff'), 'the white shine on the hair is its lightest shade and joins it');
  const brightness = (hexText) => [1, 3, 5].reduce((sum, i) => sum + parseInt(hexText.slice(i, i + 2), 16), 0);
  assert.ok(brightness(added.get('#ad526b')) > brightness('#1a6a50'), 'the lighter hair shade stays lighter than the recolored dark one');
});

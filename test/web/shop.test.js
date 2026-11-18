import { test } from 'node:test';
import assert from 'node:assert/strict';
import { crc32 } from 'node:zlib';
import { BALL_GROUPS, BALL_VARIANTS, CUSTOM_BALLS, SHOP_ITEMS } from '../../public/shop.js';
import { customBallColors, recolorPalette, tintColor, variantColors } from '../../scripts/sync-battle-anims.js';

const chunk = (type, data) => {
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
  return Buffer.concat([head, Buffer.from(type), data, crc]);
};
const png = (palette) => Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('PLTE', Buffer.from(palette)), chunk('IEND', Buffer.alloc(0))]);

test('a custom ball only changes the palette slots of its colors, and the PNG stays valid', () => {
  const base = png(Array.from({ length: 8 * 3 }, (_, i) => i));
  const out = recolorPalette(base, [[2, '#0f5c45'], [7, '#ffffff']]);
  const plte = out.subarray(16, 16 + 24);
  assert.deepEqual([...plte.subarray(6, 9)], [0x0f, 0x5c, 0x45]);
  assert.deepEqual([...plte.subarray(21, 24)], [255, 255, 255]);
  assert.deepEqual([...plte.subarray(0, 6)], [0, 1, 2, 3, 4, 5]);
  assert.equal(out.readUInt32BE(16 + 24), crc32(out.subarray(12, 16 + 24)));
});

test('custom balls recolor the top of both frames, and the bottom only when they say so', () => {
  const mint = CUSTOM_BALLS.find((b) => b.key === 'mt');
  assert.deepEqual(customBallColors(mint, 'closed').map(([i]) => i), [2, 4, 5, 6]);
  const gold = CUSTOM_BALLS.find((b) => b.key === 'au');
  assert.deepEqual(customBallColors(gold, 'open').map(([i]) => i), [5, 5, 6, 6, 7, 4]);
});

test('a variant keeps the light and shade of each pixel and only moves the hue of its groups', () => {
  assert.equal(tintColor([0xff, 0x00, 0x00], { hue: 120 }), '#00ff00');
  assert.equal(tintColor([0x80, 0x00, 0x00], { hue: 240 }), '#000080');
  assert.equal(tintColor([0xff, 0x00, 0x00], { sat: 0 }), '#808080');
  const palette = Array.from({ length: 11 }, () => [0x40, 0x9b, 0xf4]);
  const ruby = BALL_VARIANTS.find((v) => v.key === 'ur');
  assert.deepEqual(variantColors(ruby, 'closed', palette).map(([i]) => i), [5, 6, 7, 8]);
  const emerald = BALL_VARIANTS.find((v) => v.key === 'ge');
  assert.deepEqual(variantColors(emerald, 'closed', palette).map(([i]) => i), [2, 3, 4, 6, 7, 8, 9]);
  for (const variant of BALL_VARIANTS) assert.ok(BALL_GROUPS[variant.base], variant.key);
  const gold = BALL_VARIANTS.find((v) => v.key === 'md');
  assert.deepEqual(variantColors(gold, 'open', palette), [[4, '#a8740f'], [6, '#e6b422'], [7, '#fff8e1'], [5, '#c9b98a']]);
});

test('the shop sells at least twice as many balls, windows and frames as at first, each with a unique id', () => {
  const count = (kind) => SHOP_ITEMS.filter((i) => i.kind === kind).length;
  assert.ok(count('ball') >= 10 && count('window') >= 10 && count('frame') >= 10);
  assert.equal(new Set(SHOP_ITEMS.map((i) => i.id)).size, SHOP_ITEMS.length);
  for (const ball of [...CUSTOM_BALLS, ...BALL_VARIANTS]) assert.match(ball.key, /^[a-z]{2}$/);
  assert.ok(count('ball') >= 20);
});

test('every Ball on sale has an opening effect themed on it, as rich as its rarity', async () => {
  const { ballFx, BALL_FX_KEYS } = await import('../../public/ball-fx.js');
  const balls = SHOP_ITEMS.filter((item) => item.kind === 'ball');
  assert.deepEqual([...BALL_FX_KEYS].sort(), balls.map((ball) => ball.key).sort());
  for (const ball of balls) assert.equal(ballFx(ball.key).rarity, ball.rarity, ball.key);
  assert.ok(ballFx('md').tier > ballFx('gb').tier);
  assert.equal(ballFx('pb'), null, 'the free Poké Ball keeps the PokeRogue sparkles');
});

test('every Ball on sale sounds like its theme, with sounds PokeRogue has upstream', async () => {
  const { readFileSync } = await import('node:fs');
  const { ballSounds } = await import('../../public/ball-fx.js');
  const { moveSounds } = JSON.parse(readFileSync(new URL('../../public/upstream/pokerogue.json', import.meta.url), 'utf8'));
  for (const ball of SHOP_ITEMS.filter((item) => item.kind === 'ball')) {
    const sounds = ballSounds(ball.key);
    assert.ok(sounds.length, ball.key);
    for (const { sound } of sounds) assert.equal(typeof moveSounds[sound], 'string', `${ball.key}: ${sound}`);
  }
  assert.ok(ballSounds('md').length > ballSounds('gb').length, 'the mythic Ball sounds richer');
  assert.deepEqual(ballSounds('pb'), []);
});

test('the AI throws a random Ball: the free one, a common or a rare, never rarer', async () => {
  const { aiBallFor, AI_BALLS, DEFAULT_BALL } = await import('../../public/shop.js');
  assert.ok(AI_BALLS.includes(DEFAULT_BALL));
  const rarity = Object.fromEntries(SHOP_ITEMS.filter((item) => item.kind === 'ball').map((item) => [item.key, item.rarity]));
  for (const ball of AI_BALLS.filter((key) => key !== DEFAULT_BALL)) assert.ok(['common', 'rare'].includes(rarity[ball]), ball);
  assert.equal(aiBallFor(0), AI_BALLS[0]);
  assert.equal(aiBallFor(0.9999), AI_BALLS.at(-1));
  assert.equal(new Set(Array.from({ length: 200 }, (_, i) => aiBallFor(i / 200))).size, AI_BALLS.length);
});

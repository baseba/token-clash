import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { assetName, compactAnim, compactFrame, missingAssets, resourcesOf } from '../../scripts/sync-battle-anims.js';
import { animLength, causeAnim, sheetColumns, hpTweenMs, chargeAnim, conditionAnim, moveLands, pickVariant, placeEntry, statusAnim, TARGET_GRAPHIC, TARGET_TARGET, TARGET_USER, terrainAnim, weatherAnim } from '../../public/battle-anims.js';
import { animSoundFor, moveSfxCues, sampleFor, SOUNDS } from '../../public/music.js';

const sound = (frameIndex, resourceName, volume = 100, pitch = 100) => ({ frameIndex, resourceName, volume, pitch, eventType: 'AnimTimedSoundEvent' });
const frame = (target, x, y, focus, extra = {}) => ({ target, x, y, zoomX: 100, zoomY: 100, visible: true, opacity: 255, focus, graphicFrame: 0, ...extra });

test('frames compact to fixed arrays, with PokeRogue defaults for missing fields', () => {
  assert.deepEqual(compactFrame(frame(2, 82.5, -132, 1, { graphicFrame: 50, blendType: 1, tone: [0, 0, 0, 0] })), [2, 82.5, -132, 100, 100, 0, 0, 1, 1, 50, 255, 0, 1, 0]);
  assert.deepEqual(compactFrame({ target: 0 }), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  assert.deepEqual(compactFrame({ target: 1, tone: [-60, -60, -60, 0], mirror: true }).slice(-1), [[-60, -60, -60, 0]]);
});

test('an animation keeps its sheet, background events and sound cues at 50 ms per frame, by their keys', () => {
  const thunderbolt = {
    graphic: 'PRAS- Electric',
    frames: [[frame(0, 0, 0, 2)], [frame(0, 0, 0, 2)]],
    frameTimedEvents: {
      0: [{ frameIndex: 0, resourceName: 'PRAS- Black BG', bgX: 0, bgY: 0, opacity: 0, duration: 5, eventType: 'AnimTimedAddBgEvent' }],
      1: [sound(1, 'PRSFX- Thunderbolt2.wav', 70)],
      14: [sound(14, 'PRSFX- Thunderbolt1.wav', 100, 120), sound(14, '')],
    },
  };
  const [side] = compactAnim(thunderbolt);
  assert.equal(side.graphic, 'pras-electric');
  assert.deepEqual(side.bg, [[0, 'add', 'pras-black-bg', 0, 0, 0, 5]]);
  assert.deepEqual(side.sounds, [[50, 'prsfx-thunderbolt2.wav', 0.7, 1], [700, 'prsfx-thunderbolt1.wav', 1, 1.2]]);
  assert.deepEqual(resourcesOf(thunderbolt), { graphics: ['PRAS- Electric', 'PRAS- Black BG'], sounds: ['PRSFX- Thunderbolt2.wav', 'PRSFX- Thunderbolt1.wav'] });
});

test('the opponent version is kept only when it differs', () => {
  const a = { graphic: 'X', frames: [[frame(2, 0, 0, 1)]], frameTimedEvents: {} };
  const b = { graphic: 'X', frames: [[frame(2, 10, 0, 1)]], frameTimedEvents: {} };
  assert.equal(compactAnim([a, a]).length, 1);
  assert.equal(compactAnim([a, b]).length, 2);
  assert.deepEqual(pickVariant(compactAnim([a, b]), false).swapped, true);
  assert.deepEqual(pickVariant(compactAnim([a, b]), true).swapped, false);
  assert.deepEqual(pickVariant(compactAnim([a, a]), false).swapped, false);
  assert.equal(pickVariant(null, true), null);
});

test('asset keys are url-safe and a sheet has one column per 96 pixels of width', () => {
  assert.equal(assetName('PRSFX- Thunderbolt2.wav'), 'prsfx-thunderbolt2.wav');
  assert.equal(assetName('PRAS- Black BG'), 'pras-black-bg');
  assert.equal(assetName('!'), '!', 'a name with no letters still has a key');
  assert.equal(sheetColumns(480), 5);
  assert.equal(sheetColumns(500), 5);
  assert.equal(sheetColumns(40), 1);
});

test('the build fails on an animation that names a file the manifest cannot place', () => {
  const anim = [{ graphic: 'pras-fire', frames: [], bg: [[0, 'add', 'pras-black-bg', 0, 0, 0, 5], [3, 'update', null, 1, 1, 1, 1]], sounds: [[0, 'prsfx-ember.wav', 1, 1]] }];
  const manifest = { graphics: { 'pras-fire': 'images/battle_anims/PRAS- Fire.png', 'pras-black-bg': 'images/battle_anims/PRAS- Black BG.png' }, moveSounds: { 'prsfx-ember.wav': 'audio/battle_anims/PRSFX- Ember.wav' } };
  assert.deepEqual(missingAssets(anim, manifest), []);
  assert.deepEqual(missingAssets(anim, { ...manifest, moveSounds: {} }), ['prsfx-ember.wav']);
  assert.deepEqual(missingAssets(anim, { moveSounds: manifest.moveSounds }), ['pras-fire', 'pras-black-bg']);
});

test('entries are placed on our field from the user, the target, the line between them or the screen', () => {
  const geo = { user: { x: 100, y: 300 }, target: { x: 500, y: 100 }, scale: 2, width: 640, height: 360 };
  const at = (focus, x, y, kind = TARGET_GRAPHIC) => {
    const p = placeEntry([kind, x, y, 100, 100, 0, 0, 1, 0, 0, 255, 1, focus, 0], geo);
    return [p.x, p.y];
  };
  assert.deepEqual(at(2, 0, 0, TARGET_USER), [100, 300]);
  assert.deepEqual(at(1, 128, -64, TARGET_TARGET), [500, 100]);
  assert.deepEqual(at(1, 138, -64), [520, 100]);
  assert.deepEqual(at(3, 0, 0), [100, 300]);
  assert.deepEqual(at(3, 128, -64), [500, 100]);
  assert.deepEqual(at(3, 64, -32), [300, 200]);
  assert.deepEqual(at(4, 54, -26), [320, 180]);
  const mirrored = placeEntry([TARGET_GRAPHIC, 64, -32, 100, 50, 30, 1, 1, 0, 0, 255, 1, 3, 0], { ...geo, user: geo.target, target: geo.user });
  assert.equal(mirrored.scaleX, 1);
  assert.equal(mirrored.scaleY, 0.5);
  assert.equal(mirrored.angle, -30);
});

test('the animation lasts until its frames and background fades are over', () => {
  assert.equal(animLength({ frames: [[], [], []], bg: [] }), 3);
  assert.equal(animLength({ frames: [[], [], []], bg: [[1, 'update', null, 0, 0, 0, 5]] }), 6);
});

test('battle events pick the PokeRogue animation that matches them', () => {
  assert.equal(statusAnim('tox'), 'common-toxic');
  assert.equal(causeAnim('sand'), 'common-sandstorm');
  assert.equal(causeAnim('spikes'), null);
  assert.equal(conditionAnim('protect'), 'common-protect');
  assert.equal(weatherAnim('harshsun'), 'common-harsh-sun');
  assert.equal(terrainAnim('psychic'), 'common-psychic-terrain');
  assert.equal(chargeAnim('solar-beam'), 'solar-beam-charging');
});

test('sound effects use the PokeRogue samples and animation cues', () => {
  assert.equal(sampleFor('hit', { eff: 2 }), 'hit_strong');
  assert.equal(sampleFor('hit', { eff: 0.5 }), 'hit_weak');
  assert.equal(sampleFor('hit', { eff: 0 }), null);
  assert.equal(sampleFor('throw'), 'pb_throw');
  assert.equal(sampleFor('miss'), null);
  assert.equal(sampleFor('reveal'), 'pb_tray_ball');
  for (const kind of ['hit', 'throw', 'switch', 'faint', 'up', 'down', 'heal', 'reveal']) assert.ok(SOUNDS.includes(sampleFor(kind)), kind);
  assert.equal(animSoundFor('status', { status: 'par' }), 'common-paralysis');
  assert.equal(animSoundFor('weather', { weather: 'rain' }), 'common-rain');
  assert.equal(animSoundFor('miss'), null);
});

test('the player and the opponent hear their own side of the move', () => {
  const manifest = { tackle: [[[0, 'a.wav', 1, 1]]], 'u-turn': [[[0, 'me.wav', 0.5, 1]], [[100, 'foe.wav', 1, 0.9]]] };
  assert.deepEqual(moveSfxCues(manifest, 'tackle', false), [{ at: 0, sound: 'a.wav', gain: 1, rate: 1 }]);
  assert.deepEqual(moveSfxCues(manifest, 'u-turn', false), [{ at: 100, sound: 'foe.wav', gain: 1, rate: 0.9 }]);
  assert.deepEqual(moveSfxCues(null, 'tackle'), []);
});

test('the HP bar drains like PokeRogue: 5 ms per point, between 250 ms and 5 s', () => {
  assert.equal(hpTweenMs(100, 90), 250);
  assert.equal(hpTweenMs(100, 20), 400);
  assert.equal(hpTweenMs(20, 100), 400);
  assert.equal(hpTweenMs(2000, 0), 5000);
});


test('a move lands when the foe takes damage, or its substitute does', () => {
  const move = { t: 'move', side: 0, kind: 'attack', target: 'foe' };
  assert.equal(moveLands([move, { t: 'damage', side: 1, amount: 10 }], 0), true);
  assert.equal(moveLands([move, { t: 'subDamage', side: 1, amount: 10 }], 0), true);
  assert.equal(moveLands([move, { t: 'ability', side: 1, note: 'disguise' }, { t: 'damage', side: 1 }], 0), true);
});

test('a move does not land when it misses, is blocked or gets absorbed', () => {
  const move = { t: 'move', side: 0, kind: 'attack', target: 'foe' };
  for (const t of ['miss', 'immune', 'protected', 'nothing', 'notarget', 'fizzle']) assert.equal(moveLands([move, { t, side: 0 }], 0), false, t);
  assert.equal(moveLands([move, { t: 'ability', side: 1, ability: 'Absorbe Electricidad' }, { t: 'heal', side: 1 }], 0), false);
});

test('a move aimed at its user always plays, and the outcome stops at the next action', () => {
  assert.equal(moveLands([{ t: 'move', side: 0, target: 'self' }, { t: 'nothing', side: 0 }], 0), true);
  assert.equal(moveLands([{ t: 'move', side: 0, target: 'foe' }, { t: 'move', side: 1, target: 'foe' }, { t: 'miss', side: 1 }], 0), true);
});

const ANIMS = new URL('../../public/anims/', import.meta.url);
test('a wave move ends when its wave is gone, so the damage lands right after it', { skip: existsSync(ANIMS) ? false : 'needs the battle animations in public/anims: run npm run anims' }, async () => {
  const { readFileSync } = await import('node:fs');
  for (const key of ['surf', 'muddy-water']) {
    const [player] = JSON.parse(readFileSync(new URL(`${key}.json`, ANIMS), 'utf8'));
    const lastBgEvent = Math.max(...player.bg.map(([frame, , , , , , duration]) => frame + duration));
    assert.equal(animLength(player), Math.max(player.frames.length, lastBgEvent), key);
    assert.ok(animLength(player) <= 50, `${key} lasts ${animLength(player)} frames`);
  }
});

test('a type-shifting move tints its white sheet with the type color, keeping a bright core', async () => {
  const { tintPixels } = await import('../../public/battle-anims.js');
  const pixels = new Uint8ClampedArray([255, 255, 255, 255, 128, 128, 128, 255, 0, 0, 0, 0]);
  tintPixels(pixels, '#e8603c');
  const [r, g, b] = pixels;
  assert.ok(r > g && g > b, 'the white pixel turns toward the fire color');
  assert.ok(b > 60, 'the brightest pixels keep a light core');
  assert.ok(pixels[4] > pixels[6] && pixels[4] < 200, 'a mid pixel takes the color without the core');
  assert.deepEqual([...pixels.slice(8)], [0, 0, 0, 0], 'transparent pixels stay untouched');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assetName, compactAnim, compactFrame, pngSize, resourcesOf } from '../scripts/sync-battle-anims.js';
import { animLength, causeAnim, hpTweenMs, chargeAnim, conditionAnim, pickVariant, placeEntry, statusAnim, TARGET_GRAPHIC, TARGET_TARGET, TARGET_USER, terrainAnim, weatherAnim } from '../public/battle-anims.js';
import { animSoundFor, moveSfxCues, sampleFor } from '../public/music.js';

const sound = (frameIndex, resourceName, volume = 100, pitch = 100) => ({ frameIndex, resourceName, volume, pitch, eventType: 'AnimTimedSoundEvent' });
const frame = (target, x, y, focus, extra = {}) => ({ target, x, y, zoomX: 100, zoomY: 100, visible: true, opacity: 255, focus, graphicFrame: 0, ...extra });

test('frames compact to fixed arrays, with PokeRogue defaults for missing fields', () => {
  assert.deepEqual(compactFrame(frame(2, 82.5, -132, 1, { graphicFrame: 50, blendType: 1, tone: [0, 0, 0, 0] })), [2, 82.5, -132, 100, 100, 0, 0, 1, 1, 50, 255, 0, 1, 0]);
  assert.deepEqual(compactFrame({ target: 0 }), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0]);
  assert.deepEqual(compactFrame({ target: 1, tone: [-60, -60, -60, 0], mirror: true }).slice(-1), [[-60, -60, -60, 0]]);
});

test('an animation keeps its sheet, background events and sound cues at 50 ms per frame', () => {
  const thunderbolt = {
    graphic: 'PRAS- Electric',
    frames: [[frame(0, 0, 0, 2)], [frame(0, 0, 0, 2)]],
    frameTimedEvents: {
      0: [{ frameIndex: 0, resourceName: 'PRAS- Black BG', bgX: 0, bgY: 0, opacity: 0, duration: 5, eventType: 'AnimTimedAddBgEvent' }],
      1: [sound(1, 'PRSFX- Thunderbolt2.wav', 70)],
      14: [sound(14, 'PRSFX- Thunderbolt1.wav', 100, 120), sound(14, '')],
    },
  };
  const [side] = compactAnim(thunderbolt, () => 5);
  assert.deepEqual(side.graphic, { url: '/anims/graphics/pras-electric.png', columns: 5 });
  assert.deepEqual(side.bg, [[0, 'add', '/anims/graphics/pras-black-bg.png', 0, 0, 0, 5]]);
  assert.deepEqual(side.sounds, [[50, '/sfx/moves/audio/prsfx-thunderbolt2.wav', 0.7, 1], [700, '/sfx/moves/audio/prsfx-thunderbolt1.wav', 1, 1.2]]);
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

test('asset names are url-safe and PNG headers give the sheet size', () => {
  assert.equal(assetName('PRSFX- Thunderbolt2.wav'), 'prsfx-thunderbolt2.wav');
  assert.equal(assetName('PRAS- Black BG'), 'pras-black-bg');
  const header = Buffer.alloc(24);
  header.write('IHDR', 12, 'ascii');
  header.writeUInt32BE(480, 16);
  header.writeUInt32BE(192, 20);
  assert.deepEqual(pngSize(header), { width: 480, height: 192 });
  assert.equal(pngSize(Buffer.alloc(8)), null);
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
  assert.equal(animLength({ frames: [[], [], []], bg: [[1, 'update', null, 0, 0, 0, 5]] }), 11);
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
  assert.equal(sampleFor('hit', { eff: 2 }), '/sfx/se/hit_strong.wav');
  assert.equal(sampleFor('hit', { eff: 0.5 }), '/sfx/se/hit_weak.wav');
  assert.equal(sampleFor('hit', { eff: 0 }), null);
  assert.equal(sampleFor('throw'), '/sfx/se/pb_throw.wav');
  assert.equal(sampleFor('miss'), null);
  assert.equal(sampleFor('reveal'), '/sfx/se/pb_tray_ball.wav');
  assert.equal(animSoundFor('status', { status: 'par' }), 'common-paralysis');
  assert.equal(animSoundFor('weather', { weather: 'rain' }), 'common-rain');
  assert.equal(animSoundFor('miss'), null);
});

test('the player and the opponent hear their own side of the move', () => {
  const manifest = { tackle: [[[0, '/a.wav', 1, 1]]], 'u-turn': [[[0, '/me.wav', 0.5, 1]], [[100, '/foe.wav', 1, 0.9]]] };
  assert.deepEqual(moveSfxCues(manifest, 'tackle', false), [{ at: 0, url: '/a.wav', gain: 1, rate: 1 }]);
  assert.deepEqual(moveSfxCues(manifest, 'u-turn', false), [{ at: 100, url: '/foe.wav', gain: 1, rate: 0.9 }]);
  assert.deepEqual(moveSfxCues(null, 'tackle'), []);
});

test('the HP bar drains like PokeRogue: 5 ms per point, between 250 ms and 5 s', () => {
  assert.equal(hpTweenMs(100, 90), 250);
  assert.equal(hpTweenMs(100, 20), 400);
  assert.equal(hpTweenMs(20, 100), 400);
  assert.equal(hpTweenMs(2000, 0), 5000);
});

test('a non-ghost Curse is shown on its user, a ghost Curse on the foe', async () => {
  const { shownTarget } = await import('../server/battle.js');
  assert.equal(shownTarget({ types: ['normal'] }, 'curse', 'foe'), 'self');
  assert.equal(shownTarget({ types: ['ghost', 'poison'] }, 'curse', 'foe'), 'foe');
  assert.equal(shownTarget({ types: ['normal'] }, 'tackle', 'foe'), 'foe');
});

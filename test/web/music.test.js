import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MUSIC_TRACKS, musicFile, trackFor, UI_SOUND_KINDS, uiSampleFor } from '../../public/music.js';

const scenes = [...new Set([...readFileSync(new URL('../../public/backgrounds.js', import.meta.url), 'utf8').matchAll(/file: '([a-z0-9-]+)'/g)].map((m) => m[1]))];

test('cries prefer the latest recording and fall back to the legacy one', async () => {
  const { cryUrls } = await import('../../public/music.js');
  const manifest = {
    25: { latest: '/cries/latest/25.ogg', legacy: '/cries/legacy/25.ogg' },
    'darmanitan-zen': { latest: '/cries/latest/10017.ogg' },
    906: { legacy: '/cries/legacy/906.ogg' },
  };
  assert.deepEqual(cryUrls(manifest, '25'), ['/cries/latest/25.ogg', '/cries/legacy/25.ogg']);
  assert.deepEqual(cryUrls(manifest, 25), ['/cries/latest/25.ogg', '/cries/legacy/25.ogg']);
  assert.deepEqual(cryUrls(manifest, 'darmanitan-zen'), ['/cries/latest/10017.ogg']);
  assert.deepEqual(cryUrls(manifest, '906'), ['/cries/legacy/906.ogg']);
  assert.deepEqual(cryUrls(manifest, 'missingno'), []);
  assert.deepEqual(cryUrls(null, '25'), []);
});

test('every battle scene plays a PokeRogue trainer battle theme that fits it', () => {
  const expected = { beach: 'battle_alola_elite', 'cave-night': 'battle_rocket_grunt', ocean: 'battle_aqua_magma_grunt', snow: 'battle_sinnoh_champion', 'tall-grass': 'battle_trainer', path: 'battle_rival' };
  for (const [scene, track] of Object.entries(expected)) assert.equal(trackFor(`scene:${scene}`), track, scene);
  for (const scene of scenes) assert.match(trackFor(`scene:${scene}`) ?? '', /^battle_/, scene);
});

test('menus play the calm biome tracks, and prep and victories their own', () => {
  assert.equal(trackFor('tab:home'), 'town');
  assert.equal(trackFor('tab:collection'), 'tall_grass');
  assert.equal(trackFor('tab:pokedex'), 'laboratory');
  assert.equal(trackFor('tab:stats'), 'plains');
  assert.equal(trackFor('prep'), 'menu');
  assert.equal(trackFor('victory:champion'), 'bw/victory_champion');
  assert.equal(trackFor('scene:unknown'), null);
  assert.equal(trackFor('unknown'), null);
  const ids = [...scenes.map((scene) => `scene:${scene}`), 'tab:home', 'tab:collection', 'tab:pokedex', 'tab:stats', 'prep', 'victory:win', 'victory:champion'];
  for (const id of ids) assert.ok(MUSIC_TRACKS.includes(trackFor(id)), id);
  assert.equal(musicFile('bw/victory_trainer'), '/music/bw-victory_trainer.mp3');
});

test('each button sound maps to a PokeRogue sample, and unknown kinds play nothing', () => {
  assert.deepEqual(uiSampleFor('select'), { url: '/sfx/se/select.wav', rate: 1 });
  assert.deepEqual(uiSampleFor('back'), { url: '/sfx/se/select.wav', rate: 0.8 });
  assert.equal(uiSampleFor('open').url, '/sfx/se/menu_open.wav');
  for (const kind of UI_SOUND_KINDS) assert.match(uiSampleFor(kind).url, /^\/sfx\/se\/\w+\.wav$/);
  assert.equal(uiSampleFor('nope'), null);
});

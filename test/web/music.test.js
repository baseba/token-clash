import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MUSIC_TRACKS, musicFile, trackFor, UI_SOUND_KINDS, uiSampleFor } from '../../public/music.js';

const scenes = [...new Set([...readFileSync(new URL('../../public/backgrounds.js', import.meta.url), 'utf8').matchAll(/file: '([a-z0-9-]+)'/g)].map((m) => m[1]))];

test('a cry loads from jsDelivr, then raw GitHub, at the path its manifest resolved', async () => {
  const { cryURLs } = await import('../../public/music.js');
  const { UPSTREAM, upstreamURLs } = await import('../../public/upstream.js');
  const manifest = { 25: 'cries/pokemon/latest/25.ogg', 'darmanitan-zen': 'cries/pokemon/latest/10017.ogg' };
  assert.deepEqual(cryURLs(manifest, '25'), upstreamURLs(UPSTREAM.cries, 'cries/pokemon/latest/25.ogg'));
  assert.deepEqual(cryURLs(manifest, 25), cryURLs(manifest, '25'));
  assert.match(cryURLs(manifest, 'darmanitan-zen')[0], /^https:\/\/cdn\.jsdelivr\.net\/gh\/PokeAPI\/cries@[0-9a-f]{40}\/cries\/pokemon\/latest\/10017\.ogg$/);
  assert.deepEqual(cryURLs(manifest, 'missingno'), []);
  assert.deepEqual(cryURLs(manifest, 'constructor'), []);
  assert.deepEqual(cryURLs(null, '25'), []);
});

test('cries prefer the latest recording and fall back to the legacy one', async () => {
  const { resolveCry } = await import('../../scripts/sync-cries.js');
  const upstreamHas = (...paths) => async (tried) => tried.find((path) => paths.includes(path)) ?? null;
  assert.equal(await resolveCry(25, upstreamHas('cries/pokemon/latest/25.ogg', 'cries/pokemon/legacy/25.ogg')), 'cries/pokemon/latest/25.ogg');
  assert.equal(await resolveCry(906, upstreamHas('cries/pokemon/legacy/906.ogg')), 'cries/pokemon/legacy/906.ogg');
  assert.equal(await resolveCry(0, upstreamHas()), null);
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

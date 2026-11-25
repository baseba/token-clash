import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolveVariants } from '../../scripts/sprites.mjs';
import { ASSET_ORIGINS, fallBackToRaw, fetchFirst, rawFallback, UPSTREAM, upstreamManifest, upstreamURLs } from '../../public/upstream.js';

const pokerogue = { repo: 'pagefaultgames/pokerogue-assets', commit: 'b7ce1013491141864da412fa733d5ac585b5d453' };

test('every upstream repo is pinned to a commit, never to a branch', () => {
  assert.ok(Object.keys(UPSTREAM).length > 0);
  for (const [name, { repo, commit }] of Object.entries(UPSTREAM)) {
    assert.match(repo, /^[\w.-]+\/[\w.-]+$/, name);
    assert.match(commit, /^[0-9a-f]{40}$/, name);
  }
});

test('a file loads from jsDelivr first and from raw GitHub second, at the same commit', () => {
  assert.deepEqual(upstreamURLs(pokerogue, 'images/battle_anims/PRAS- Fire.png'), [
    'https://cdn.jsdelivr.net/gh/pagefaultgames/pokerogue-assets@b7ce1013491141864da412fa733d5ac585b5d453/images/battle_anims/PRAS-%20Fire.png',
    'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/b7ce1013491141864da412fa733d5ac585b5d453/images/battle_anims/PRAS-%20Fire.png',
  ]);
  for (const url of upstreamURLs(UPSTREAM.sprites, 'sprites/pokemon/25.png')) assert.ok(ASSET_ORIGINS.includes(new URL(url).origin), url);
});

test('a jsDelivr URL falls back to its raw GitHub copy, and nothing else falls back', () => {
  const [jsdelivr, raw] = upstreamURLs(pokerogue, 'audio/se/hit.wav');
  assert.equal(rawFallback(jsdelivr), raw);
  assert.equal(rawFallback(raw), null);
  assert.equal(rawFallback('http://localhost:8080/trainers/red.png'), null);
  assert.equal(rawFallback('https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/sprites/pokemon/25.png'), null, 'only pinned files have a raw copy we trust');
});

test('an image that fails on jsDelivr retries once at raw GitHub', () => {
  let onError;
  fallBackToRaw({ addEventListener: (type, listener, capture) => type === 'error' && capture && (onError = listener) });
  const [jsdelivr, raw] = upstreamURLs(UPSTREAM.sprites, 'sprites/pokemon/25.png');
  const img = { tagName: 'IMG', src: jsdelivr };
  onError({ target: img });
  assert.equal(img.src, raw);
  onError({ target: img });
  assert.equal(img.src, raw, 'a second failure stays put instead of looping');
  const script = { tagName: 'SCRIPT', src: jsdelivr };
  onError({ target: script });
  assert.equal(script.src, jsdelivr);
});

test('a fetched file comes from the first URL that answers OK', async () => {
  const asked = [];
  const answers = { a: () => Promise.reject(new TypeError('offline')), b: async () => ({ ok: false }), c: async () => ({ ok: true, url: 'c' }) };
  const fetchURL = (url) => (asked.push(url), answers[url]());
  assert.equal((await fetchFirst(['a', 'b', 'c'], fetchURL)).url, 'c');
  assert.deepEqual(asked, ['a', 'b', 'c']);
  assert.equal(await fetchFirst(['a', 'b'], fetchURL), null);
});

test('a manifest that fails to load is asked for again on the next call', async () => {
  const realFetch = globalThis.fetch;
  const asked = [];
  globalThis.fetch = async (url) => {
    asked.push(url);
    if (asked.length === 1) throw new Error('offline');
    return { ok: true, json: async () => ({ loaded: true }) };
  };
  try {
    assert.deepEqual(await upstreamManifest('flaky'), {});
    assert.deepEqual(await upstreamManifest('flaky'), { loaded: true });
    assert.deepEqual(await upstreamManifest('flaky'), { loaded: true });
    assert.equal(asked.length, 2, 'a loaded manifest is not asked for again');
  } finally {
    globalThis.fetch = realFetch;
  }
});

const readManifest = (url) => JSON.parse(readFileSync(new URL(`../../public${url.split('?')[0]}`, import.meta.url), 'utf8'));
globalThis.fetch = async (url) => ({ ok: true, json: async () => readManifest(url) });

const pokeapi = JSON.parse(readFileSync(new URL('../../src/catalog/data/pokeapi.json', import.meta.url), 'utf8'));
const creatures = [...Object.keys(pokeapi.species), ...Object.values(pokeapi.forms).map((form) => form.sprite)];
const jsdelivr = (repo) => new RegExp(`^https://cdn\\.jsdelivr\\.net/gh/${repo}@[0-9a-f]{40}/`);

test('every species, form and the substitute has its four sprites on jsDelivr', async () => {
  const { loadSprites, spriteURL } = await import('../../public/creature.js');
  await loadSprites();
  for (const sprite of [...creatures, 'substitute']) {
    for (const back of [false, true]) for (const shiny of [false, true]) assert.match(spriteURL({ sprite, shiny }, { back }), jsdelivr('PokeAPI/sprites'), `${sprite}${back ? ' back' : ''}${shiny ? ' shiny' : ''}`);
  }
  assert.match(spriteURL({ sprite: '25', shiny: true }, { back: true }), /\/sprites\/pokemon\/versions\/generation-v\/black-white\/animated\/back\/shiny\/25\.gif$/, 'Black/White species animate');
  assert.match(spriteURL({ sprite: 906 }), /\/sprites\/pokemon\/906\.png$/, 'later species are still PNGs');
  assert.equal(spriteURL({ sprite: 'missingno' }), '');
});

test('a missing sprite falls back to the closest one: back shiny to front shiny, then back, then front', async () => {
  const candidates = { front: ['front'], frontShiny: ['front-shiny'], back: ['back'], backShiny: ['back-shiny'] };
  const upstreamHas = (...paths) => async (tried) => tried.find((path) => paths.includes(path)) ?? null;
  assert.deepEqual(await resolveVariants(candidates, upstreamHas('front', 'front-shiny', 'back', 'back-shiny')), ['front', 'front-shiny', 'back', 'back-shiny']);
  assert.deepEqual(await resolveVariants(candidates, upstreamHas('front', 'front-shiny', 'back')), ['front', 'front-shiny', 'back', 'front-shiny']);
  assert.deepEqual(await resolveVariants(candidates, upstreamHas('front', 'back')), ['front', 'front', 'back', 'back']);
  assert.deepEqual(await resolveVariants(candidates, upstreamHas('front')), ['front', 'front', 'front', 'front']);
  assert.equal(await resolveVariants(candidates, upstreamHas('front-shiny', 'back')), null, 'no front, no sprite');
});

test('every species and form has a cry on jsDelivr', async () => {
  const { cryURLs } = await import('../../public/music.js');
  const cries = readManifest('/upstream/cries.json');
  for (const sprite of creatures) assert.match(cryURLs(cries, sprite)[0] ?? '', jsdelivr('PokeAPI/cries'), sprite);
});

test('every music track, sound effect and shredder sound has its file in pokerogue-assets', async () => {
  const { MUSIC_TRACKS, SOUNDS } = await import('../../public/music.js');
  const pokerogue = readManifest('/upstream/pokerogue.json');
  for (const track of MUSIC_TRACKS) assert.match(pokerogue.music[track] ?? '', /^audio\/bgm\/.+\.mp3$/, track);
  for (const sound of SOUNDS) assert.match(pokerogue.sounds[sound] ?? '', /^audio\/(se|ui)\/\w+\.wav$/, sound);
  const shredder = [...readFileSync(new URL('../../public/app.js', import.meta.url), 'utf8').matchAll(/\{ sound: '([^']+)'/g)].map((match) => match[1]);
  assert.equal(shredder.length, 5);
  for (const sound of shredder) assert.match(pokerogue.moveSounds[sound] ?? '', /^audio\/battle_anims\/.+\.wav$/, sound);
});

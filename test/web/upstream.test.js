import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ASSET_ORIGINS, fallBackToRaw, fetchFirst, rawFallback, UPSTREAM, upstreamURLs } from '../../public/upstream.js';

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

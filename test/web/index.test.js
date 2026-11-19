import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PUBLIC = new URL('../../public/', import.meta.url);
const html = readFileSync(new URL('index.html', PUBLIC), 'utf8');
const linkHrefs = (rel) => [...html.matchAll(new RegExp(`<link rel="${rel}"[^>]*href="([^"]+)"`, 'g'))].map((match) => match[1]);

function importGraph(entry) {
  const seen = new Set();
  const visit = (file) => {
    const source = readFileSync(new URL(file, PUBLIC), 'utf8');
    for (const [, imported] of source.matchAll(/^import [^;]+ from '\.\/([\w-]+\.js)\?v=dev';$/gm)) {
      if (seen.has(imported)) continue;
      seen.add(imported);
      visit(imported);
    }
  };
  visit(entry);
  return seen;
}

test('the page preloads every module app.js imports, directly or not, and nothing else', () => {
  const preloaded = linkHrefs('modulepreload');
  assert.deepEqual(preloaded.toSorted(), [...importGraph('app.js')].map((file) => `/${file}?v=dev`).toSorted());
});

test('the page preloads the manifests the first paint waits for, at the URLs that fetch them', async () => {
  const requested = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requested.push(url);
    return new Response('{}');
  };
  try {
    const { loadSprites } = await import('../../public/creature.js');
    await loadSprites();
  } finally {
    globalThis.fetch = realFetch;
  }
  const app = readFileSync(new URL('app.js', PUBLIC), 'utf8');
  assert.match(app, /fetch\('\/trainers\/faces\.json\?v=dev'\)/, 'app.js fetches the faces at the preloaded URL');
  assert.deepEqual(linkHrefs('preload'), [...requested, '/trainers/faces.json?v=dev']);
});

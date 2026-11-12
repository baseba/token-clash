#!/usr/bin/env node
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const API = 'https://pokeapi.co/api/v2';
const RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const DATA = new URL('../server/pokeapi.json', import.meta.url);
const SPRITES = new URL('../public/sprites/', import.meta.url);
const CONCURRENCY = 16;
const HEADERS = { 'user-agent': 'token-clash-importer' };

async function fetchRetry(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok || res.status === 404) return res;
      throw new Error(`${res.status} ${url}`);
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

async function firstAvailable(urls) {
  for (const url of urls.filter(Boolean)) {
    const res = await fetchRetry(url);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
  }
  return null;
}

async function mapLimit(items, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

const variants = ({ front, back, frontShiny, backShiny }) => ({
  front: [front],
  'front-shiny': [frontShiny, front],
  back: [back, front],
  'back-shiny': [backShiny, frontShiny, back, front],
});

const fromRaw = (stem) => ({
  front: `${RAW}/${stem}.png`,
  back: `${RAW}/back/${stem}.png`,
  frontShiny: `${RAW}/shiny/${stem}.png`,
  backShiny: `${RAW}/back/shiny/${stem}.png`,
});

async function formSources(name) {
  const res = await fetchRetry(`${API}/pokemon-form/${name}`);
  if (!res.ok) return null;
  const sp = (await res.json()).sprites || {};
  return { front: sp.front_default, back: sp.back_default, frontShiny: sp.front_shiny, backShiny: sp.back_shiny };
}

export async function syncSprites({ log = (msg) => process.stderr.write(`${msg}\n`) } = {}) {
  mkdirSync(SPRITES, { recursive: true });
  const data = JSON.parse(readFileSync(DATA, 'utf8'));
  const targets = [
    ...Object.keys(data.species).map((id) => ({ slug: id, sources: async () => fromRaw(id) })),
    ...Object.values(data.forms ?? {}).map((f) => ({ slug: f.sprite, sources: () => formSources(f.sprite) })),
  ];
  const missing = targets.filter((t) => Object.keys(variants({})).some((v) => !existsSync(new URL(`${t.slug}-${v}.png`, SPRITES))));
  log(`Sprites: ${targets.length - missing.length}/${targets.length} ya están; faltan ${missing.length}.`);

  let done = 0;
  const failed = [];
  await mapLimit(missing, async (t) => {
    try {
      const src = await t.sources();
      if (!src) throw new Error('sin sprites en PokeAPI');
      for (const [variant, urls] of Object.entries(variants(src))) {
        const file = new URL(`${t.slug}-${variant}.png`, SPRITES);
        if (existsSync(file)) continue;
        const png = await firstAvailable(urls);
        if (!png) throw new Error(`sin ${variant}`);
        writeFileSync(file, png);
      }
    } catch (err) {
      failed.push(`${t.slug} (${err.message})`);
    }
    if (++done % 100 === 0) log(`  ${done}/${missing.length}`);
  });
  if (failed.length) throw new Error(`No se pudieron descargar ${failed.length} sprites: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`);
  log('Sprites listos en public/sprites/.');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncSprites().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

#!/usr/bin/env node
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { fileURLToPath } from 'node:url';

const API = 'https://pokeapi.co/api/v2';
const RAW = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon';
const BW = `${RAW}/versions/generation-v/black-white/animated`;
const LAST_BW_SPECIES = 649;
const DATA = new URL('../server/pokeapi.json', import.meta.url);
const SPRITES = new URL('../public/sprites/', import.meta.url);
const CONCURRENCY = 16;
const HEADERS = { 'user-agent': 'token-clash-importer' };
const VARIANTS = ['front', 'front-shiny', 'back', 'back-shiny'];

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

async function getJson(url) {
  const res = await fetchRetry(url);
  return res.ok ? res.json() : null;
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

const fallbacks = ({ front = [], back = [], frontShiny = [], backShiny = [] }) => ({
  front: [...front],
  'front-shiny': [...frontShiny, ...front],
  back: [...back, ...front],
  'back-shiny': [...backShiny, ...frontShiny, ...back, ...front],
});

const fromStems = (base, ext, stems) => ({
  front: stems.map((s) => `${base}/${s}.${ext}`),
  back: stems.map((s) => `${base}/back/${s}.${ext}`),
  frontShiny: stems.map((s) => `${base}/shiny/${s}.${ext}`),
  backShiny: stems.map((s) => `${base}/back/shiny/${s}.${ext}`),
});

const fileFor = (slug, variant, ext) => new URL(`${slug}-${variant}.${ext}`, SPRITES);
const complete = (slug, ext) => VARIANTS.every((v) => existsSync(fileFor(slug, v, ext)));

async function writeSet(slug, ext, sources) {
  for (const [variant, urls] of Object.entries(fallbacks(sources))) {
    const file = fileFor(slug, variant, ext);
    if (existsSync(file)) continue;
    const data = await firstAvailable(urls);
    if (!data) return false;
    writeFileSync(file, data);
  }
  return true;
}

function speciesTarget(id) {
  const animated = Number(id) <= LAST_BW_SPECIES;
  return {
    slug: id,
    animated,
    sources: async () => ({ png: fromStems(RAW, 'png', [id]), gif: animated ? fromStems(BW, 'gif', [id]) : null }),
  };
}

function formTarget(name) {
  return {
    slug: name,
    animated: true,
    sources: async () => {
      const form = await getJson(`${API}/pokemon-form/${name}`);
      if (!form) return null;
      const sp = form.sprites || {};
      const mon = await getJson(form.pokemon.url);
      const speciesId = Number(mon?.species?.url.match(/\/(\d+)\/?$/)?.[1]);
      const one = (url) => (url ? [url] : []);
      const png = { front: one(sp.front_default), back: one(sp.back_default), frontShiny: one(sp.front_shiny), backShiny: one(sp.back_shiny) };
      if (!(speciesId <= LAST_BW_SPECIES)) return { png, gif: null };
      const bw = sp.versions?.['generation-v']?.['black-white']?.animated || {};
      const byName = fromStems(BW, 'gif', [`${speciesId}-${form.form_name}`]);
      const gif = {
        front: [...byName.front, ...one(bw.front_default)],
        back: [...byName.back, ...one(bw.back_default)],
        frontShiny: [...byName.frontShiny, ...one(bw.front_shiny)],
        backShiny: [...byName.backShiny, ...one(bw.back_shiny)],
      };
      return { png, gif };
    },
  };
}

const substituteTarget = {
  slug: 'substitute',
  animated: true,
  sources: async () => ({ png: fromStems(RAW, 'png', ['substitute']), gif: fromStems(BW, 'gif', ['substitute']) }),
};

export async function syncSprites({ log = (msg) => process.stderr.write(`${msg}\n`) } = {}) {
  mkdirSync(SPRITES, { recursive: true });
  const data = JSON.parse(readFileSync(DATA, 'utf8'));
  const targets = [...Object.keys(data.species).map(speciesTarget), ...Object.values(data.forms ?? {}).map((f) => formTarget(f.sprite)), substituteTarget];
  const missing = targets.filter((t) => !complete(t.slug, 'png') || (t.animated && !complete(t.slug, 'gif')));
  log(`Sprites: ${targets.length - missing.length}/${targets.length} listos; revisando ${missing.length}.`);

  let done = 0;
  let animated = 0;
  const failed = [];
  await mapLimit(missing, async (t) => {
    try {
      const src = await t.sources();
      if (!src) throw new Error('sin sprites en PokeAPI');
      if (!(await writeSet(t.slug, 'png', src.png))) throw new Error('sin PNG');
      if (src.gif && (await writeSet(t.slug, 'gif', src.gif))) animated += 1;
    } catch (err) {
      failed.push(`${t.slug} (${err.message})`);
    }
    if (++done % 100 === 0) log(`  ${done}/${missing.length}`);
  });
  const animatedSlugs = targets.filter((t) => complete(t.slug, 'gif')).map((t) => t.slug);
  writeFileSync(new URL('animated.json', SPRITES), `${JSON.stringify(animatedSlugs)}\n`);
  if (failed.length) throw new Error(`No se pudieron descargar ${failed.length} sprites: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`);
  log(`Sprites listos en public/sprites/ (${animated} con animación nueva de Negro/Blanco).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncSprites().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

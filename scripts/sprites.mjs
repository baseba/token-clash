#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UPSTREAM } from '../public/upstream.js';
import { essentialsManifest, withShowdownStills } from './essentials-sprites.mjs';
import { fetchRetry, firstExisting, manifestJSON, mapLimit, resolveVariants } from './upstream-files.js';

const API = 'https://pokeapi.co/api/v2';
const PNG_DIR = 'sprites/pokemon/';
const GIF_DIR = 'sprites/pokemon/versions/generation-v/black-white/animated/';
const LAST_BW_SPECIES = 649;
const API_SPRITE = /^https:\/\/raw\.githubusercontent\.com\/PokeAPI\/sprites\/[^/]+\/(.+)$/;
const DATA = new URL('../src/catalog/data/pokeapi.json', import.meta.url);
const MANIFEST = new URL('../public/upstream/sprites.json', import.meta.url);
const ESSENTIALS_MANIFEST = new URL('../public/upstream/essentials.json', import.meta.url);

const fromStem = (dir, ext, stem) => ({
  front: [`${dir}${stem}.${ext}`],
  frontShiny: [`${dir}shiny/${stem}.${ext}`],
  back: [`${dir}back/${stem}.${ext}`],
  backShiny: [`${dir}back/shiny/${stem}.${ext}`],
});

async function getJson(url) {
  const res = await fetchRetry(url);
  return res.ok ? res.json() : null;
}

const apiPath = (url) => (url ? [API_SPRITE.exec(url)?.[1]].filter(Boolean) : []);

function speciesTarget(id) {
  return { slug: id, candidates: async () => ({ gif: Number(id) <= LAST_BW_SPECIES ? fromStem(GIF_DIR, 'gif', id) : null, png: fromStem(PNG_DIR, 'png', id) }) };
}

function formTarget(name) {
  return {
    slug: name,
    candidates: async () => {
      const form = await getJson(`${API}/pokemon-form/${name}`);
      if (!form) return null;
      const sprites = form.sprites || {};
      const pokemon = await getJson(form.pokemon.url);
      const speciesId = Number(pokemon?.species?.url.match(/\/(\d+)\/?$/)?.[1]);
      const png = { front: apiPath(sprites.front_default), frontShiny: apiPath(sprites.front_shiny), back: apiPath(sprites.back_default), backShiny: apiPath(sprites.back_shiny) };
      if (!(speciesId <= LAST_BW_SPECIES)) return { gif: null, png };
      const blackWhite = sprites.versions?.['generation-v']?.['black-white']?.animated || {};
      const byName = fromStem(GIF_DIR, 'gif', `${speciesId}-${form.form_name}`);
      const gif = {
        front: [...byName.front, ...apiPath(blackWhite.front_default)],
        frontShiny: [...byName.frontShiny, ...apiPath(blackWhite.front_shiny)],
        back: [...byName.back, ...apiPath(blackWhite.back_default)],
        backShiny: [...byName.backShiny, ...apiPath(blackWhite.back_shiny)],
      };
      return { gif, png };
    },
  };
}

const substituteTarget = { slug: 'substitute', candidates: async () => ({ gif: fromStem(GIF_DIR, 'gif', 'substitute'), png: fromStem(PNG_DIR, 'png', 'substitute') }) };

export async function syncSprites({ log = (msg) => process.stderr.write(`${msg}\n`) } = {}) {
  const data = JSON.parse(readFileSync(DATA, 'utf8'));
  const targets = [...Object.keys(data.species).map(speciesTarget), ...Object.values(data.forms ?? {}).map((form) => formTarget(form.sprite)), substituteTarget];
  log(`Sprites: resolviendo ${targets.length} Pokémon y formas en PokeAPI/sprites@${UPSTREAM.sprites.commit.slice(0, 7)}.`);
  const firstOf = (paths) => firstExisting(UPSTREAM.sprites, paths);
  const resolved = new Map();
  const failed = [];
  let done = 0;
  await mapLimit(targets, async (target) => {
    try {
      const candidates = await target.candidates();
      if (!candidates) throw new Error('sin sprites en PokeAPI');
      const gif = candidates.gif && (await resolveVariants(candidates.gif, firstOf));
      const sprites = gif ? { dir: GIF_DIR, paths: gif } : { dir: PNG_DIR, paths: await resolveVariants(candidates.png, firstOf) };
      if (!sprites.paths) throw new Error('sin PNG');
      const outside = sprites.paths.find((path) => !path.startsWith(sprites.dir));
      if (outside) throw new Error(`${outside} queda fuera de ${sprites.dir}`);
      resolved.set(target.slug, { dir: sprites.dir, files: sprites.paths.map((path) => path.slice(sprites.dir.length)) });
    } catch (err) {
      failed.push(`${target.slug} (${err.message})`);
    }
    if (++done % 100 === 0) log(`  ${done}/${targets.length}`);
  });
  if (failed.length) throw new Error(`No se pudieron resolver ${failed.length} sprites: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`);

  const manifest = { [GIF_DIR]: {}, [PNG_DIR]: {} };
  for (const { slug } of targets) manifest[resolved.get(slug).dir][slug] = resolved.get(slug).files;
  writeFileSync(MANIFEST, manifestJSON(manifest));
  log(`Sprites listos en public/upstream/sprites.json: ${Object.keys(manifest[GIF_DIR]).length} animados de Negro/Blanco y ${Object.keys(manifest[PNG_DIR]).length} PNG.`);
  log(`Sprites animados: buscando los ${Object.keys(manifest[PNG_DIR]).length} sin GIF en ${UPSTREAM.essentials.repo}@${UPSTREAM.essentials.commit.slice(0, 7)}.`);
  const essentials = await withShowdownStills(await essentialsManifest(Object.keys(manifest[PNG_DIR])), log);
  writeFileSync(ESSENTIALS_MANIFEST, manifestJSON(essentials));
  log(`Sprites animados listos en public/upstream/essentials.json: ${Object.keys(essentials).length}.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncSprites().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { UPSTREAM } from '../public/upstream.js';
import { fetchRetry, firstExisting, manifestJSON, mapLimit } from './upstream-files.js';

const API = 'https://pokeapi.co/api/v2';
const DATA = new URL('../src/catalog/data/pokeapi.json', import.meta.url);
const MANIFEST = new URL('../public/upstream/cries.json', import.meta.url);
const RECORDINGS = ['latest', 'legacy'];

export const resolveCry = (id, firstOf) => firstOf(RECORDINGS.map((recording) => `cries/pokemon/${recording}/${id}.ogg`));

async function formPokemonId(name) {
  const res = await fetchRetry(`${API}/pokemon-form/${name}`);
  const form = res.ok ? await res.json() : null;
  const id = Number(form?.pokemon?.url.match(/\/(\d+)\/?$/)?.[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function syncCries({ log = (msg) => process.stderr.write(`${msg}\n`) } = {}) {
  const data = JSON.parse(readFileSync(DATA, 'utf8'));
  const targets = [
    ...Object.keys(data.species).map((id) => ({ slug: id, pokemonId: async () => Number(id) })),
    ...Object.values(data.forms ?? {}).map((form) => ({ slug: form.sprite, pokemonId: () => formPokemonId(form.sprite) })),
  ];
  log(`Gritos: resolviendo ${targets.length} Pokémon y formas en PokeAPI/cries@${UPSTREAM.cries.commit.slice(0, 7)}.`);
  const firstOf = (paths) => firstExisting(UPSTREAM.cries, paths);
  const cries = new Map();
  const failed = [];
  let done = 0;
  await mapLimit(targets, async (target) => {
    try {
      const id = await target.pokemonId();
      if (!id) throw new Error('sin ID de Pokémon');
      const cry = await resolveCry(id, firstOf);
      if (!cry) throw new Error(`sin gritos para ID ${id}`);
      cries.set(target.slug, cry);
    } catch (err) {
      failed.push(`${target.slug} (${err.message})`);
    }
    if (++done % 100 === 0) log(`  ${done}/${targets.length}`);
  });
  if (failed.length) throw new Error(`No se pudieron resolver ${failed.length} gritos: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`);

  writeFileSync(MANIFEST, manifestJSON(Object.fromEntries(targets.map(({ slug }) => [slug, cries.get(slug)]))));
  const legacy = [...cries.values()].filter((path) => path.includes('/legacy/')).length;
  log(`Gritos listos en public/upstream/cries.json: ${cries.size - legacy} actuales y ${legacy} antiguos.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  syncCries().catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
}

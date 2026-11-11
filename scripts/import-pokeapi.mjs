#!/usr/bin/env node
// Downloads the battle data of every species from PokeAPI (https://pokeapi.co) into
// server/pokeapi.json: base stats, types (mapped to the six elements of Token Clash) and where each
// species sits in its evolution chain. Only numbers and type words are kept: no names, sprites or
// move names. What the player sees comes from Tuxemon (see server/creatures.js).
//
// The server never calls PokeAPI (production has no egress): run this again to refresh the data.
//
//   node scripts/import-pokeapi.mjs

import { writeFileSync } from 'node:fs';

const API = 'https://pokeapi.co/api/v2';
const OUT = new URL('../server/pokeapi.json', import.meta.url);
const CONCURRENCY = 8;

// PokeAPI types -> elements. Normal is neutral; a normal/flying species takes its second type.
export const ELEMENT = {
  fire: 'brasa', dragon: 'brasa',
  water: 'marea', ice: 'marea',
  grass: 'brote', bug: 'brote', poison: 'brote',
  electric: 'chispa', flying: 'chispa',
  rock: 'roca', ground: 'roca', steel: 'roca', fighting: 'roca',
  ghost: 'sombra', dark: 'sombra', psychic: 'sombra', fairy: 'sombra',
};

async function get(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': 'token-clash-importer' } });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
      throw new Error(`${res.status} ${url}`);
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

async function mapLimit(items, fn) {
  const out = new Array(items.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
        if (++done % 100 === 0) process.stderr.write(`  ${done}/${items.length}\n`);
      }
    }),
  );
  return out;
}

const idFromUrl = (url) => Number(url.match(/\/(\d+)\/?$/)[1]);

const { count } = await get(`${API}/pokemon-species?limit=1`);
const ids = Array.from({ length: count }, (_, i) => i + 1);
console.error(`${count} especies: stats y tipos…`);

const species = {};
const chainIds = new Set();
await mapLimit(ids, async (id) => {
  const sp = await get(`${API}/pokemon-species/${id}`);
  if (!sp) return;
  const def = sp.varieties.find((v) => v.is_default) ?? sp.varieties[0];
  const mon = await get(def.pokemon.url);
  if (!mon) return;
  const stat = Object.fromEntries(mon.stats.map((s) => [s.stat.name, s.base_stat]));
  const types = [...mon.types].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
  species[id] = {
    types,
    element: types.map((t) => ELEMENT[t]).find(Boolean) ?? null,
    stats: [stat.hp, stat.attack, stat.defense, stat['special-attack'], stat['special-defense'], stat.speed],
  };
  if (sp.evolution_chain) {
    species[id].chainId = idFromUrl(sp.evolution_chain.url);
    chainIds.add(species[id].chainId);
  }
});

console.error(`${chainIds.size} cadenas evolutivas…`);
// stage = depth in the chain (0 = first form); chainLen = forms on the longest path through it.
const placement = {};
function walk(node, depth) {
  const below = node.evolves_to.length ? Math.max(...node.evolves_to.map((c) => walk(c, depth + 1))) : 0;
  placement[idFromUrl(node.species.url)] = { stage: depth, chainLen: depth + 1 + below };
  return below + 1;
}
await mapLimit([...chainIds], async (cid) => {
  const chain = await get(`${API}/evolution-chain/${cid}`);
  if (chain) walk(chain.chain, 0);
});

const lines = Object.keys(species)
  .map(Number)
  .sort((a, b) => a - b)
  .map((id) => {
    const { chainId, ...s } = species[id];
    const p = placement[id] ?? { stage: 0, chainLen: 1 };
    return `  "${id}": ${JSON.stringify({ ...s, stage: p.stage, chainLen: p.chainLen })}`;
  });

const header = { source: 'https://pokeapi.co', fetchedAt: new Date().toISOString().slice(0, 10), stats: ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'] };
const head = JSON.stringify(header, null, 1).slice(0, -2);
writeFileSync(OUT, `${head},\n "species": {\n${lines.join(',\n')}\n }\n}\n`);
console.error(`Listo: ${lines.length} especies en server/pokeapi.json`);

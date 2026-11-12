#!/usr/bin/env node
// Downloads every species from PokeAPI (https://pokeapi.co) into the game's data:
// - server/pokeapi.json: name, base stats, real types, abilities and where each species sits in
//   its evolution chain.
// - server/abilities.json: Spanish name and description of every main-series ability.
// - public/sprites/: the official sprites of every species and battle form, via scripts/sprites.mjs.
//
// The server never calls PokeAPI (production has no egress): run this again to refresh the data.
//
//   node scripts/import-pokeapi.mjs

import { writeFileSync } from 'node:fs';
import { syncSprites } from './sprites.mjs';

const API = 'https://pokeapi.co/api/v2';
const OUT = new URL('../server/pokeapi.json', import.meta.url);
const ABILITIES_OUT = new URL('../server/abilities.json', import.meta.url);
const CONCURRENCY = 8;

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
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

const { count } = await get(`${API}/pokemon-species?limit=1`);
const ids = Array.from({ length: count }, (_, i) => i + 1);
console.error(`${count} especies: nombre, stats y tipos…`);

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
  const esName = sp.names.find((n) => n.language.name === 'es')?.name;
  const bySlot = [...mon.abilities].sort((a, b) => a.slot - b.slot);
  species[id] = {
    name: esName || cap(sp.name.replace(/-/g, ' ')),
    types,
    stats: [stat.hp, stat.attack, stat.defense, stat['special-attack'], stat['special-defense'], stat.speed],
    abilities: bySlot.filter((a) => !a.is_hidden).map((a) => a.ability.name),
    hiddenAbility: bySlot.find((a) => a.is_hidden)?.ability.name ?? null,
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

const { results: abilityList } = await get(`${API}/ability?limit=1000`);
console.error(`${abilityList.length} habilidades…`);
const abilities = {};
const spanish = (entries) => entries.filter((e) => e.language.name === 'es');
await mapLimit(abilityList, async ({ url }) => {
  const ab = await get(url);
  if (!ab || !ab.is_main_series) return;
  const flavor = spanish(ab.flavor_text_entries).at(-1)?.flavor_text;
  abilities[ab.name] = {
    id: ab.id,
    name: spanish(ab.names)[0]?.name || cap(ab.name.replace(/-/g, ' ')),
    desc: (flavor || ab.effect_entries.find((e) => e.language.name === 'en')?.short_effect || '').replace(/\s+/g, ' ').trim(),
  };
});
const abilityLines = Object.keys(abilities)
  .sort((a, b) => abilities[a].id - abilities[b].id)
  .map((k) => {
    const { id, ...a } = abilities[k];
    return `  "${k}": ${JSON.stringify(a)}`;
  });
writeFileSync(ABILITIES_OUT, `{\n${abilityLines.join(',\n')}\n}\n`);
console.error(`Listo: ${abilityLines.length} habilidades en server/abilities.json`);

const BATTLE_FORMS = [
  'darmanitan-zen', 'aegislash-blade', 'wishiwashi-school', 'zygarde-complete', 'mimikyu-busted', 'eiscue-noice',
  'palafin-hero', 'terapagos-terastal', 'cramorant-gulping', 'cramorant-gorging', 'morpeko-hangry', 'cherrim-sunshine',
  'castform-sunny', 'castform-rainy', 'castform-snowy',
  'minior-red', 'minior-orange', 'minior-yellow', 'minior-green', 'minior-blue', 'minior-indigo', 'minior-violet',
];
console.error(`${BATTLE_FORMS.length} formas de combate…`);
const forms = {};
await mapLimit(BATTLE_FORMS, async (name) => {
  const form = await get(`${API}/pokemon-form/${name}`);
  if (!form) return;
  const mon = await get(form.pokemon.url);
  const typesOf = (list) => [...list].sort((a, b) => a.slot - b.slot).map((t) => t.type.name);
  const stat = Object.fromEntries(mon.stats.map((x) => [x.stat.name, x.base_stat]));
  forms[name] = {
    types: typesOf(form.types?.length ? form.types : mon.types),
    stats: [stat.hp, stat.attack, stat.defense, stat['special-attack'], stat['special-defense'], stat.speed],
    sprite: name,
  };
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
const formLines = BATTLE_FORMS.filter((n) => forms[n]).map((n) => `  "${n}": ${JSON.stringify(forms[n])}`);
writeFileSync(OUT, `${head},\n "species": {\n${lines.join(',\n')}\n },\n "forms": {\n${formLines.join(',\n')}\n }\n}\n`);
console.error(`Listo: ${lines.length} especies en server/pokeapi.json`);
await syncSprites();

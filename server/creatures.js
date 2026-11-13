// Creatures. Everything comes from PokeAPI (https://pokeapi.co), downloaded into the game by
// scripts/import-pokeapi.mjs: server/pokeapi.json holds the name, base stats, real types and
// evolution placement of every species, and public/sprites/ holds each species' official
// front/back sprites by dex number. The server never calls PokeAPI (production has no egress). The
// type chart and labels live in public/types.js, shared with the browser. server/movedex.json holds
// every learnable move.

import { readFileSync } from 'node:fs';
import { effectiveness } from '../public/types.js';
import { abilityInfo, knownAbility, INERT } from './abilities.js';

export { effectiveness };

const POKEAPI_FILE = JSON.parse(readFileSync(new URL('./pokeapi.json', import.meta.url), 'utf8'));
const POKEAPI = POKEAPI_FILE.species;
const FORMS = POKEAPI_FILE.forms ?? {};
const AIRBORNE = JSON.parse(readFileSync(new URL('./airborne.json', import.meta.url), 'utf8'));
const AIRBORNE_IDS = new Set(AIRBORNE.airborne);
const FLOATING_ABILITIES = new Set(['levitate', 'eelevate']);

export function floats(id) {
  if (id <= AIRBORNE.coversUpTo) return AIRBORNE_IDS.has(id);
  const d = POKEAPI[id];
  if (!d) return false;
  return d.types.includes('flying') || [...(d.abilities ?? []), d.hiddenAbility].some((a) => FLOATING_ABILITIES.has(a));
}

// PokeAPI data of a species number, or null when we don't have it (unknown or newer species).
export function speciesData(id) {
  const d = POKEAPI[id];
  if (!d) return null;
  const [hp, attack, defense, spAttack, spDefense, speed] = d.stats;
  return { ...d, base: { hp, attack, defense, spAttack, spDefense, speed } };
}

export function formData(name) {
  const f = FORMS[name];
  return f ? { types: f.types, base: f.stats, sprite: f.sprite } : null;
}

export function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function rng(seed) {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

export function shuffled(items, random = Math.random) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const MOVEDEX = JSON.parse(readFileSync(new URL('./movedex.json', import.meta.url), 'utf8'));
export const MOVES_PER_FIGHTER = 4;
const SUPPORTED_VOLATILES = new Set(['confusion', 'attract', 'leechseed']);
const SPECIAL_STATUS_MOVES = new Set(['rest', 'synthesis', 'morning-sun', 'moonlight', 'shore-up']);
const GRASSY_HALVED = new Set(['earthquake', 'bulldoze', 'magnitude']);
const SCREEN_MOVES = { reflect: 'reflect', 'light-screen': 'lightscreen', 'aurora-veil': 'auroraveil' };
const SCREEN_BREAKERS = new Set(['brick-break', 'psychic-fangs', 'raging-bull']);

export const STRUGGLE = {
  key: 'struggle', id: 'struggle', name: 'Forcejeo', desc: 'Ataque desesperado que solo se usa cuando no quedan PP; daña también al usuario.',
  type: null, category: 'physical', power: 50, accuracy: null, pp: 1, priority: 0, target: 'foe', flags: ['contact'], kind: 'attack', recoilMaxHp: 1 / 4, supported: true,
};

function supportedMove(m) {
  if (m.category !== 'status') return m.power > 0 || !!m.fixedDamage || !!m.ohko;
  return !!(m.boosts || m.self || m.status || m.screen || SUPPORTED_VOLATILES.has(m.volatile) || m.heal || m.weather || m.terrain || SPECIAL_STATUS_MOVES.has(m.id));
}

export function moveData(id) {
  const d = MOVEDEX[id];
  if (!d) return null;
  const m = { key: id, id, ...d, flags: [...(d.flags ?? [])], kind: d.category === 'status' ? 'status' : 'attack' };
  if (GRASSY_HALVED.has(id)) m.weakenedByGrassyTerrain = true;
  if (id === 'foul-play') m.usesTargetAttack = true;
  if (id === 'toxic') m.status = 'tox';
  if (SCREEN_MOVES[id]) m.screen = SCREEN_MOVES[id];
  if (SCREEN_BREAKERS.has(id)) m.breaksScreens = true;
  if (id === 'defog') {
    m.boosts = { eva: -1 };
    m.clearsScreens = true;
  }
  m.supported = supportedMove(m);
  return m;
}

export function learnedMoves(entry) {
  const data = speciesData(entry.finalID);
  const byLevel = new Map((data?.learnset ?? []).filter(([, lvl]) => lvl <= entry.level).map(([id, lvl]) => [id, lvl]));
  for (const id of entry.learned ?? []) if (!byLevel.has(id)) byLevel.set(id, 0);
  return [...byLevel.entries()]
    .filter(([id]) => MOVEDEX[id])
    .sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

export function movepool(entry) {
  return learnedMoves(entry).map((id) => moveData(id));
}

export function usableMovepool(entry) {
  return learnedMoves(entry).filter((id) => moveData(id).supported);
}

export function defaultMoveset(entry) {
  const usable = usableMovepool(entry);
  if (usable.length) return usable.slice(-MOVES_PER_FIGHTER);
  return MOVEDEX.tackle ? ['tackle'] : [];
}

export function validMoveset(entry, ids) {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MOVES_PER_FIGHTER || new Set(ids).size !== ids.length) return false;
  const pool = new Set(learnedMoves(entry));
  return ids.every((id) => typeof id === 'string' && pool.has(id) && moveData(id).supported);
}

export function movesetFor(entry) {
  if (!Array.isArray(entry.moveset) || !entry.moveset.length) return defaultMoveset(entry);
  const saved = [...new Set(entry.moveset)].slice(0, MOVES_PER_FIGHTER);
  const pool = new Set(usableMovepool(entry));
  const spares = shuffled([...pool].filter((id) => !saved.includes(id)), rng(`mv:${entry.id ?? entry.finalID}:${saved.join(',')}`));
  const moves = saved.map((id) => (pool.has(id) ? id : spares.shift())).filter(Boolean);
  return moves.length ? moves : defaultMoveset(entry);
}

export const usableAbility = (key) => !!key && knownAbility(key) && !INERT[key];

export function abilityOptions(entry) {
  const data = speciesData(entry.finalID);
  if (!data) return [];
  return [...data.abilities.map((key) => ({ key, hidden: false })), ...(data.hiddenAbility ? [{ key: data.hiddenAbility, hidden: true }] : [])].filter((a) => knownAbility(a.key));
}

const NATURES = {
  lonely: ['atk', 'def'], brave: ['atk', 'spd'], adamant: ['atk', 'satk'], naughty: ['atk', 'sdef'],
  bold: ['def', 'atk'], relaxed: ['def', 'spd'], impish: ['def', 'satk'], lax: ['def', 'sdef'],
  timid: ['spd', 'atk'], hasty: ['spd', 'def'], jolly: ['spd', 'satk'], naive: ['spd', 'sdef'],
  modest: ['satk', 'atk'], mild: ['satk', 'def'], quiet: ['satk', 'spd'], rash: ['satk', 'sdef'],
  calm: ['sdef', 'atk'], gentle: ['sdef', 'def'], sassy: ['sdef', 'spd'], careful: ['sdef', 'satk'],
};
export const NATURE_NAMES = new Set([...Object.keys(NATURES), 'hardy', 'docile', 'serious', 'bashful', 'quirky']);

const RARITY_BASE = { common: 55, uncommon: 65, rare: 75, legendary: 90 };

// Species: name, sprite, types and stats straight from PokeAPI. A species PokeAPI doesn't know
// (unknown or newer) falls back to its dex number, the Normal type and stats derived from rarity.
export function species(entry) {
  const { finalID, rarity } = entry;
  const data = speciesData(finalID);
  const r = rng(`sp:${finalID}`);
  const types = data ? data.types : ['normal'];

  let stats;
  if (data) {
    const b = data.base;
    stats = { hp: b.hp, atk: b.attack, def: b.defense, satk: b.spAttack, sdef: b.spDefense, spd: b.speed };
  } else {
    const base = RARITY_BASE[rarity] ?? RARITY_BASE.common;
    stats = {
      hp: base + between(r, -14, 14),
      atk: base + between(r, -16, 16),
      def: base + between(r, -16, 16),
      satk: base + between(r, -16, 16),
      sdef: base + between(r, -16, 16),
      spd: base + between(r, -18, 18),
    };
  }
  return { id: finalID, name: data ? data.name : `#${finalID}`, sprite: String(finalID), types, stats, floats: floats(finalID) };
}

function savedAbility(entry, data) {
  const regular = data.abilities;
  const all = data.hiddenAbility ? [...regular, data.hiddenAbility] : regular;
  if (entry.abilityChoice && all.includes(entry.abilityChoice) && knownAbility(entry.abilityChoice)) return entry.abilityChoice;
  if (entry.ability && all.includes(entry.ability) && knownAbility(entry.ability)) return entry.ability;
  if (entry.abilitySlot === 3 && data.hiddenAbility) return data.hiddenAbility;
  if (entry.abilitySlot === 1 || entry.abilitySlot === 2) return regular[entry.abilitySlot - 1] ?? regular[0];
  return regular[hash(`ab:${entry.id ?? entry.finalID}`) % regular.length];
}

export function abilityFor(entry) {
  const data = speciesData(entry.finalID);
  if (!data?.abilities?.length) return null;
  const saved = savedAbility(entry, data);
  if (usableAbility(saved)) return saved;
  const others = abilityOptions(entry).map((a) => a.key).filter((key) => key !== saved && usableAbility(key));
  if (!others.length) return null;
  return others[Math.floor(rng(`ab:${entry.id ?? entry.finalID}:${saved}`)() * others.length)];
}

const scale = (base, iv, level) => Math.floor(((2 * base + iv) * level) / 100);

export function statsFor([hp, attack, defense, spAttack, spDefense, speed], iv, level, nature = null) {
  const [up, down] = NATURES[nature] ?? [];
  const stat = (key, base, value) => Math.floor((scale(base, value, level) + 5) * (key === up ? 1.1 : key === down ? 0.9 : 1));
  return {
    hp: hp === 1 ? 1 : scale(hp, iv.hp, level) + level + 10,
    atk: stat('atk', attack, iv.atk),
    def: stat('def', defense, iv.def),
    satk: stat('satk', spAttack, iv.satk ?? iv.atk),
    sdef: stat('sdef', spDefense, iv.sdef ?? iv.def),
    spd: stat('spd', speed, iv.spd),
  };
}

// A fighter as the battle and the browser see it.
export function buildFighter(entry, { levelCap } = {}) {
  const sp = species(entry);
  const level = levelCap ? levelCap : entry.level;
  const iv = entry.ivs;
  const ability = abilityFor(entry);
  const { hp, atk, def, satk, sdef, spd } = sp.stats;
  const stats = statsFor([hp, atk, def, satk, sdef, spd], iv, level, entry.nature);
  return {
    uid: entry.id,
    name: entry.nickname || sp.name,
    speciesName: sp.name,
    speciesId: sp.id,
    types: sp.types,
    rarity: entry.rarity,
    shiny: entry.shiny,
    level,
    stats,
    moves: movesetFor(entry).map((id) => moveData(id)),
    sprite: sp.sprite,
    floats: sp.floats,
    ability,
    abilityInfo: abilityInfo(ability),
    gender: entry.gender ?? null,
    nature: entry.nature ?? null,
    ivs: iv,
  };
}

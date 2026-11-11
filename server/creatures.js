// Creatures. Everything comes from PokeAPI (https://pokeapi.co), downloaded into the game by
// scripts/import-pokeapi.mjs: server/pokeapi.json holds the name, base stats, types (mapped to the
// six elements of Token Clash) and evolution placement of every species, and public/sprites/ holds
// each species' official front/back sprites by dex number. The server never calls PokeAPI
// (production has no egress); the move names are the game's own, chosen by element.

import { readFileSync } from 'node:fs';

const POKEAPI = JSON.parse(readFileSync(new URL('./pokeapi.json', import.meta.url), 'utf8')).species;

// PokeAPI data of a species number, or null when we don't have it (unknown or newer species).
export function speciesData(id) {
  const d = POKEAPI[id];
  if (!d) return null;
  const [hp, attack, defense, spAttack, spDefense, speed] = d.stats;
  return { ...d, base: { hp, attack, defense, spAttack, spDefense, speed } };
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

const pick = (r, list) => list[Math.floor(r() * list.length)];
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

export const ELEMENTS = {
  brasa: { label: 'Brasa', hue: 14, sat: 85 },
  marea: { label: 'Marea', hue: 205, sat: 75 },
  brote: { label: 'Brote', hue: 118, sat: 55 },
  chispa: { label: 'Chispa', hue: 48, sat: 95 },
  roca: { label: 'Roca', hue: 30, sat: 35 },
  sombra: { label: 'Sombra', hue: 272, sat: 45 },
};

// Two triangles: brasa > brote > marea > brasa, and chispa > sombra > roca > chispa.
export const BEATS = { brasa: 'brote', brote: 'marea', marea: 'brasa', chispa: 'sombra', sombra: 'roca', roca: 'chispa' };

export function effectiveness(attackEl, defendEl) {
  if (!attackEl || !defendEl) return 1;
  if (BEATS[attackEl] === defendEl) return 1.5;
  if (BEATS[defendEl] === attackEl) return 0.67;
  return 1;
}

const MOVE_NAMES = {
  brasa: { strike: ['Tizón', 'Zarpa de ceniza', 'Chamusco'], burst: ['Fogonazo', 'Volcán interior', 'Brasero'] },
  marea: { strike: ['Salpicón', 'Chorro frío', 'Golpe de ola'], burst: ['Marejada', 'Resaca', 'Tromba'] },
  brote: { strike: ['Espina', 'Raíz trampa', 'Semillazo'], burst: ['Floración', 'Bosque súbito', 'Enredadera'] },
  chispa: { strike: ['Calambre', 'Cortocircuito', 'Chasquido'], burst: ['Sobrecarga', 'Tormenta seca', 'Arco voltaico'] },
  roca: { strike: ['Guijarro', 'Canto rodado', 'Cabezazo pétreo'], burst: ['Alud', 'Derrumbe', 'Monolito'] },
  sombra: { strike: ['Susurro', 'Zarpazo umbrío', 'Mordida gris'], burst: ['Eclipse', 'Noche cerrada', 'Vacío'] },
  neutro: { strike: ['Placaje', 'Arañazo', 'Cabezazo'], burst: ['Embestida total', 'Golpe final', 'Carga'] },
};

export const SUPPORT_MOVES = {
  guard: { name: 'Coraza', kind: 'boost', stat: 'def', desc: 'Sube su defensa' },
  focus: { name: 'Enfoque', kind: 'boost', stat: 'atk', desc: 'Sube su ataque' },
  mend: { name: 'Respiro', kind: 'heal', amount: 0.3, uses: 2, desc: 'Recupera 30% de vida (2 usos)' },
};
const QUICK_NAMES = ['Finta', 'Codazo rápido', 'Amague'];

const RARITY_BASE = { common: 55, uncommon: 65, rare: 75, legendary: 90 };

// Species: name, sprite, element and stats straight from PokeAPI; the move names are the game's
// own, chosen by element. Physical and special stats are averaged, like the IVs in save.js. A
// species PokeAPI doesn't know (unknown or newer) falls back to its dex number and stats derived
// from rarity.
export function species(entry) {
  const { finalID, rarity } = entry;
  const data = speciesData(finalID);
  const r = rng(`sp:${finalID}`);
  const element = data ? data.element : null;
  const names = MOVE_NAMES[element || 'neutro'];

  let stats;
  if (data) {
    const b = data.base;
    stats = { hp: b.hp, atk: Math.round((b.attack + b.spAttack) / 2), def: Math.round((b.defense + b.spDefense) / 2), spd: b.speed };
  } else {
    const base = RARITY_BASE[rarity] ?? RARITY_BASE.common;
    stats = {
      hp: base + between(r, -14, 14),
      atk: base + between(r, -16, 16),
      def: base + between(r, -16, 16),
      spd: base + between(r, -18, 18),
    };
  }

  const supportKey = pick(r, Object.keys(SUPPORT_MOVES));
  const strike = pick(r, names.strike);
  let burst = pick(r, names.burst);
  if (burst === strike) burst = pick(r, names.burst);
  const quickName = pick(r, QUICK_NAMES);
  const moves = [
    { key: 'strike', name: strike, element, power: 60, accuracy: 100, priority: 0 },
    { key: 'burst', name: burst, element, power: 95, accuracy: 85, priority: 0 },
    { key: 'quick', name: quickName, element: null, power: 40, accuracy: 100, priority: 1 },
    { key: supportKey, ...SUPPORT_MOVES[supportKey], power: 0, accuracy: 100, priority: 0 },
  ];
  return { id: finalID, name: data ? data.name : `#${finalID}`, sprite: String(finalID), element, stats, moves };
}

const scale = (base, iv, level, flat) => Math.floor(((2 * base + iv) * level) / 100) + flat;

// A fighter as the battle and the browser see it.
export function buildFighter(entry, { levelCap } = {}) {
  const sp = species(entry);
  const level = levelCap ? levelCap : entry.level;
  const iv = entry.ivs;
  const stats = {
    hp: scale(sp.stats.hp, iv.hp, level, level + 20),
    atk: scale(sp.stats.atk, iv.atk, level, 10),
    def: scale(sp.stats.def, iv.def, level, 10),
    spd: scale(sp.stats.spd, iv.spd, level, 10),
  };
  return {
    uid: entry.id,
    name: entry.nickname || sp.name,
    speciesName: sp.name,
    speciesId: sp.id,
    element: sp.element,
    rarity: entry.rarity,
    shiny: entry.shiny,
    level,
    stats,
    moves: sp.moves.map((m) => ({ ...m })),
    sprite: sp.sprite,
  };
}

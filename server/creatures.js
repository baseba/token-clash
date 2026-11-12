// Creatures. Everything comes from PokeAPI (https://pokeapi.co), downloaded into the game by
// scripts/import-pokeapi.mjs: server/pokeapi.json holds the name, base stats, real types and
// evolution placement of every species, and public/sprites/ holds each species' official
// front/back sprites by dex number. The server never calls PokeAPI (production has no egress). The
// type chart and labels live in public/types.js, shared with the browser; the move names here are
// real Pokémon moves, picked by the species' own types so each attack matches its type.

import { readFileSync } from 'node:fs';
import { effectiveness } from '../public/types.js';
import { moveInfo } from './moves.js';
import { abilityInfo, knownAbility } from './abilities.js';

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

const pick = (r, list) => list[Math.floor(r() * list.length)];
const between = (r, lo, hi) => lo + Math.floor(r() * (hi - lo + 1));

// Real Pokémon move names per type: a weaker "strike" (power 60) and a stronger "burst" (power 95).
const MOVE_NAMES = {
  normal: { strike: ['Placaje', 'Golpe Cabeza', 'Doble Filo'], burst: ['Hiperrayo', 'Gigaimpacto', 'Última Baza'] },
  fire: { strike: ['Ascuas', 'Colmillo Ígneo', 'Rueda Fuego'], burst: ['Lanzallamas', 'Llamarada', 'Envite Ígneo'] },
  water: { strike: ['Pistola Agua', 'Hidropulso', 'Burbuja'], burst: ['Hidrobomba', 'Cascada', 'Acua Cola'] },
  grass: { strike: ['Látigo Cepa', 'Hoja Afilada', 'Megaagotar'], burst: ['Rayo Solar', 'Bomba Germen', 'Lluevehojas'] },
  electric: { strike: ['Impactrueno', 'Chispa', 'Colmillo Rayo'], burst: ['Rayo', 'Trueno', 'Voltio Cruel'] },
  ice: { strike: ['Viento Hielo', 'Colmillo Hielo', 'Nieve Polvo'], burst: ['Rayo Hielo', 'Ventisca', 'Frío Polar'] },
  fighting: { strike: ['Golpe Kárate', 'Patada Baja', 'Demolición'], burst: ['A Bocajarro', 'Puño Dinámico', 'Patada Salto Alta'] },
  poison: { strike: ['Ácido', 'Colmillo Veneno', 'Puya Nociva'], burst: ['Bomba Lodo', 'Lanzamugre', 'Onda Tóxica'] },
  ground: { strike: ['Bofetón Lodo', 'Disparo Lodo', 'Terratemblor'], burst: ['Terremoto', 'Fuerza Telúrica', 'Tierra Viva'] },
  flying: { strike: ['Picotazo', 'Ataque Ala', 'Tajo Aéreo'], burst: ['Pájaro Osado', 'Vendaval', 'Vuelo'] },
  psychic: { strike: ['Confusión', 'Psicorrayo', 'Cabezazo Zen'], burst: ['Psíquico', 'Psicocorte', 'Premonición'] },
  bug: { strike: ['Picadura', 'Tijera X', 'Pin Misil'], burst: ['Megacuerno', 'Zumbido', 'Chupavidas'] },
  rock: { strike: ['Lanzarrocas', 'Pedrada', 'Antiaéreo'], burst: ['Roca Afilada', 'Avalancha', 'Poder Pasado'] },
  ghost: { strike: ['Lengüetazo', 'Garra Umbría', 'Puño Sombra'], burst: ['Bola Sombra', 'Golpe Fantasma', 'Infortunio'] },
  dragon: { strike: ['Furia Dragón', 'Aliento Dragón', 'Garra Dragón'], burst: ['Enfado', 'Cometa Draco', 'Carga Dragón'] },
  dark: { strike: ['Mordisco', 'Finta', 'Tajo Umbrío'], burst: ['Triturar', 'Pulso Umbrío', 'Juego Sucio'] },
  steel: { strike: ['Garra Metal', 'Cola Férrea', 'Puño Bala'], burst: ['Foco Resplandor', 'Cabeza de Hierro', 'Puño Meteoro'] },
  fairy: { strike: ['Viento Feérico', 'Beso Drenaje', 'Carantoña'], burst: ['Fuerza Lunar', 'Brillo Mágico', 'Voz Cautivadora'] },
};

// A real priority move for the quick slot, by type; types without one fall back to Ataque Rápido.
const PRIORITY_MOVE = {
  water: 'Acua Jet', steel: 'Puño Bala', fighting: 'Ultrapuño', dark: 'Golpe Bajo',
  ghost: 'Sombra Vil', ice: 'Esquirla Helada', rock: 'Roca Veloz',
};

export const SUPPORT_MOVES = {
  guard: { name: 'Defensa Férrea', kind: 'boost', stat: 'def', desc: 'Sube su defensa' },
  focus: { name: 'Danza Espada', kind: 'boost', stat: 'atk', desc: 'Sube su ataque' },
  mend: { name: 'Recuperación', kind: 'heal', amount: 0.3, uses: 2, desc: 'Recupera 30% de vida (2 usos)' },
  plot: { name: 'Maquinación', kind: 'boost', stat: 'satk', desc: 'Sube su ataque especial' },
  calm: { name: 'Amnesia', kind: 'boost', stat: 'sdef', desc: 'Sube su defensa especial' },
};

const RARITY_BASE = { common: 55, uncommon: 65, rare: 75, legendary: 90 };

// Species: name, sprite, types and stats straight from PokeAPI; the move names are real Pokémon
// moves chosen by the species' types. A species PokeAPI doesn't know (unknown or newer) falls back
// to its dex number, the Normal type and stats derived from rarity.
export function species(entry) {
  const { finalID, rarity } = entry;
  const data = speciesData(finalID);
  const r = rng(`sp:${finalID}`);
  const types = data ? data.types : ['normal'];
  const t1 = types[0];
  const t2 = types[1] || types[0];

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

  // One move per type (so both types of a dual get represented), a priority move and a support move.
  const category = stats.atk >= stats.satk ? 'physical' : 'special';
  const fitting = (names) => {
    const same = names.filter((n) => moveInfo(n).category === category);
    return same.length ? same : names;
  };
  let supportKey = pick(r, ['guard', 'focus', 'mend']);
  if (supportKey === 'focus' && category === 'special') supportKey = 'plot';
  if (supportKey === 'guard' && stats.sdef > stats.def) supportKey = 'calm';
  const strike = pick(r, fitting(MOVE_NAMES[t1].strike));
  const burst = pick(r, fitting(MOVE_NAMES[t2].burst));
  const quick = PRIORITY_MOVE[t2]
    ? { name: PRIORITY_MOVE[t2], type: t2 }
    : PRIORITY_MOVE[t1]
      ? { name: PRIORITY_MOVE[t1], type: t1 }
      : { name: 'Ataque Rápido', type: 'normal' };
  const moves = [
    { key: 'strike', name: strike, type: t1, power: 60, accuracy: 100, priority: 0 },
    { key: 'burst', name: burst, type: t2, power: 95, accuracy: 85, priority: 0 },
    { key: 'quick', name: quick.name, type: quick.type, power: 40, accuracy: 100, priority: 1 },
    { key: supportKey, ...SUPPORT_MOVES[supportKey], type: null, power: 0, accuracy: 100, priority: 0 },
  ].map((m) => ({ ...moveInfo(m.name), ...m }));
  return { id: finalID, name: data ? data.name : `#${finalID}`, sprite: String(finalID), types, stats, moves, floats: floats(finalID) };
}

export function abilityFor(entry) {
  const data = speciesData(entry.finalID);
  if (!data?.abilities?.length) return null;
  const regular = data.abilities;
  const all = data.hiddenAbility ? [...regular, data.hiddenAbility] : regular;
  if (entry.ability && all.includes(entry.ability) && knownAbility(entry.ability)) return entry.ability;
  if (entry.abilitySlot === 3 && data.hiddenAbility) return data.hiddenAbility;
  if (entry.abilitySlot === 1 || entry.abilitySlot === 2) return regular[entry.abilitySlot - 1] ?? regular[0];
  return regular[hash(`ab:${entry.id ?? entry.finalID}`) % regular.length];
}

const scale = (base, iv, level, flat) => Math.floor(((2 * base + iv) * level) / 100) + flat;

export function statsFor([hp, attack, defense, spAttack, spDefense, speed], iv, level) {
  return {
    hp: scale(hp, iv.hp, level, level + 20),
    atk: scale(attack, iv.atk, level, 10),
    def: scale(defense, iv.def, level, 10),
    satk: scale(spAttack, iv.satk ?? iv.atk, level, 10),
    sdef: scale(spDefense, iv.sdef ?? iv.def, level, 10),
    spd: scale(speed, iv.spd, level, 10),
  };
}

// A fighter as the battle and the browser see it.
export function buildFighter(entry, { levelCap } = {}) {
  const sp = species(entry);
  const level = levelCap ? levelCap : entry.level;
  const iv = entry.ivs;
  const ability = abilityFor(entry);
  const { hp, atk, def, satk, sdef, spd } = sp.stats;
  const stats = statsFor([hp, atk, def, satk, sdef, spd], iv, level);
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
    moves: sp.moves.map((m) => ({ ...m, flags: [...m.flags] })),
    sprite: sp.sprite,
    floats: sp.floats,
    ability,
    abilityInfo: abilityInfo(ability),
    gender: entry.gender ?? null,
    ivs: iv,
  };
}

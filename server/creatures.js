// Creatures. A PokeTokenBar entry only tells us a species number, its evolution chain, a rarity and
// the individual's numbers (level, IVs, shiny). Each evolution chain becomes an evolution line of
// Tuxemon (an open-source creature game, art under CC BY-SA / CC BY, see public/creditos.txt), and
// each stage of the chain the matching stage of that line: its name, sprites, element and attack
// names. Same species, same creature for every colleague. Nothing from the source franchise is shown.

import { readFileSync } from 'node:fs';

const CATALOG = JSON.parse(readFileSync(new URL('./tuxemon.json', import.meta.url), 'utf8'));
// Pools of lines per chain length. A one-form species can also be the last form of any line, and a
// two-form chain the last two forms of a three-form line, so there are more distinct choices.
function pools() {
  const uniq = (ls) => [...new Map(ls.map((l) => [l.join(), l])).values()];
  const { lines } = CATALOG;
  return [
    uniq([...lines.filter((l) => l.length === 1), ...lines.filter((l) => l.length > 1).map((l) => l.slice(-1))]),
    uniq([...lines.filter((l) => l.length === 2), ...lines.filter((l) => l.length === 3).map((l) => l.slice(1))]),
    lines.filter((l) => l.length === 3),
  ];
}
const LINES_BY_LEN = pools();

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

// Which Tuxemon a save entry becomes. The line depends only on the start of the chain (baseID) and
// its length, the stage on where finalID sits in it. Neighbouring dex numbers get different lines.
export function tuxemonFor({ finalID, baseID, stage, chainLen }) {
  let len = Number.isInteger(chainLen) && chainLen > 0 ? chainLen : null;
  let st = Number.isInteger(stage) && stage >= 0 ? stage : null;
  if (len === null) {
    // Old entries without the chain: dex numbers of a chain are usually consecutive.
    len = finalID === baseID ? 1 : Math.min(3, Math.max(2, finalID - baseID + 1));
    st = len - 1;
  }
  len = Math.min(3, len);
  const pool = LINES_BY_LEN[len - 1].length ? LINES_BY_LEN[len - 1] : CATALOG.lines;
  const line = pool[(baseID * 7919) % pool.length];
  const slug = line[Math.min(st ?? 0, line.length - 1)];
  return { slug, ...CATALOG.species[slug] };
}

// Species: name, sprite, element and attack names from Tuxemon; stats from the species number.
export function species(entry) {
  const { finalID, rarity } = entry;
  const tux = tuxemonFor(entry);
  const r = rng(`sp:${finalID}`);
  const element = tux.element;
  const names = MOVE_NAMES[element || 'neutro'];

  const base = RARITY_BASE[rarity] ?? RARITY_BASE.common;
  const stats = {
    hp: base + between(r, -14, 14),
    atk: base + between(r, -16, 16),
    def: base + between(r, -16, 16),
    spd: base + between(r, -18, 18),
  };

  const supportKey = pick(r, Object.keys(SUPPORT_MOVES));
  const strike = tux.moves.strike || pick(r, names.strike);
  let burst = tux.moves.burst || pick(r, names.burst);
  if (burst === strike) burst = pick(r, names.burst);
  const moves = [
    { key: 'strike', name: strike, element, power: 60, accuracy: 100, priority: 0 },
    { key: 'burst', name: burst, element, power: 95, accuracy: 85, priority: 0 },
    { key: 'quick', name: tux.moves.quick && tux.moves.quick !== strike ? tux.moves.quick : pick(r, QUICK_NAMES), element: null, power: 40, accuracy: 100, priority: 1 },
    { key: supportKey, ...SUPPORT_MOVES[supportKey], power: 0, accuracy: 100, priority: 0 },
  ];
  return { id: finalID, name: tux.name, sprite: tux.slug, element, stats, moves };
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

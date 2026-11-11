// Original creatures. A PokeTokenBar entry only tells us a species number, a rarity and the
// individual's numbers (level, IVs, shiny). Everything a player sees here (name, look, element,
// moves) is generated from those numbers, so the same species becomes the same original creature
// for every colleague, and nothing from the source franchise is shown.

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
const ELEMENT_KEYS = Object.keys(ELEMENTS);

// Two triangles: brasa > brote > marea > brasa, and chispa > sombra > roca > chispa.
export const BEATS = { brasa: 'brote', brote: 'marea', marea: 'brasa', chispa: 'sombra', sombra: 'roca', roca: 'chispa' };

export function effectiveness(attackEl, defendEl) {
  if (!attackEl || !defendEl) return 1;
  if (BEATS[attackEl] === defendEl) return 1.5;
  if (BEATS[defendEl] === attackEl) return 0.67;
  return 1;
}

const SYL_START = ['ka', 'zu', 'mo', 'ri', 'bal', 'te', 'vo', 'nim', 'qua', 'sel', 'dra', 'po', 'fen', 'lu', 'gor', 'xi', 'ber', 'tam', 'cho', 'wi', 'yel', 'or', 'ux', 'ilo'];
const SYL_MID = ['ra', 'lo', 'ki', 'mu', 'ne', 'ta', 'vi', 'so', 'ga', 'pe', 'ru', 'di', 'zo', 'ma', 'fi', 'le'];
const SYL_END = {
  brasa: ['dor', 'zar', 'cen', 'ix', 'ardo'],
  marea: ['lin', 'mar', 'ola', 'uba', 'rin'],
  brote: ['flor', 'eto', 'iza', 'bam', 'oto'],
  chispa: ['tron', 'zik', 'vat', 'ix', 'ello'],
  roca: ['gran', 'oto', 'urk', 'pedr', 'ant'],
  sombra: ['nox', 'umbra', 'ush', 'eth', 'avel'],
};

const MOVE_NAMES = {
  brasa: { strike: ['Tizón', 'Zarpa de ceniza', 'Chamusco'], burst: ['Fogonazo', 'Volcán interior', 'Brasero'] },
  marea: { strike: ['Salpicón', 'Chorro frío', 'Golpe de ola'], burst: ['Marejada', 'Resaca', 'Tromba'] },
  brote: { strike: ['Espina', 'Raíz trampa', 'Semillazo'], burst: ['Floración', 'Bosque súbito', 'Enredadera'] },
  chispa: { strike: ['Calambre', 'Cortocircuito', 'Chasquido'], burst: ['Sobrecarga', 'Tormenta seca', 'Arco voltaico'] },
  roca: { strike: ['Guijarro', 'Canto rodado', 'Cabezazo pétreo'], burst: ['Alud', 'Derrumbe', 'Monolito'] },
  sombra: { strike: ['Susurro', 'Zarpazo umbrío', 'Mordida gris'], burst: ['Eclipse', 'Noche cerrada', 'Vacío'] },
};

export const SUPPORT_MOVES = {
  guard: { name: 'Coraza', kind: 'boost', stat: 'def', desc: 'Sube su defensa' },
  focus: { name: 'Enfoque', kind: 'boost', stat: 'atk', desc: 'Sube su ataque' },
  mend: { name: 'Respiro', kind: 'heal', amount: 0.3, uses: 2, desc: 'Recupera 30% de vida (2 usos)' },
};
const QUICK_NAMES = ['Finta', 'Codazo rápido', 'Amague'];

const RARITY_BASE = { common: 55, uncommon: 65, rare: 75, legendary: 90 };

// Species: depends only on the evolution line (element) and the final species number (everything else).
export function species(finalID, baseID, rarity) {
  const r = rng(`sp:${finalID}`);
  const element = ELEMENT_KEYS[hash(`line:${baseID}`) % ELEMENT_KEYS.length];
  const parts = [pick(r, SYL_START)];
  if (r() < 0.55) parts.push(pick(r, SYL_MID));
  parts.push(pick(r, SYL_END[element]));
  const raw = parts.join('');
  const name = raw[0].toUpperCase() + raw.slice(1);

  const base = RARITY_BASE[rarity] ?? RARITY_BASE.common;
  const stats = {
    hp: base + between(r, -14, 14),
    atk: base + between(r, -16, 16),
    def: base + between(r, -16, 16),
    spd: base + between(r, -18, 18),
  };

  const supportKey = pick(r, Object.keys(SUPPORT_MOVES));
  const moves = [
    { key: 'strike', name: pick(r, MOVE_NAMES[element].strike), element, power: 60, accuracy: 100, priority: 0 },
    { key: 'burst', name: pick(r, MOVE_NAMES[element].burst), element, power: 95, accuracy: 85, priority: 0 },
    { key: 'quick', name: pick(r, QUICK_NAMES), element: null, power: 40, accuracy: 100, priority: 1 },
    { key: supportKey, ...SUPPORT_MOVES[supportKey], power: 0, accuracy: 100, priority: 0 },
  ];

  // Look: parameters the browser turns into an SVG. Same species, same look.
  const look = {
    body: between(r, 0, 3), // 0 round, 1 tall, 2 wide, 3 pear
    ears: between(r, 0, 5), // 0 none, 1 pointy, 2 round, 3 antenna, 4 horns, 5 leaf
    tail: between(r, 0, 3),
    eyes: between(r, 0, 2),
    pattern: between(r, 0, 3), // 0 none, 1 spots, 2 belly, 3 stripes
    mouth: between(r, 0, 2),
    hueShift: between(r, -18, 18),
    feet: r() < 0.6,
  };
  return { id: finalID, name, element, stats, moves, look };
}

const scale = (base, iv, level, flat) => Math.floor(((2 * base + iv) * level) / 100) + flat;

// A fighter as the battle and the browser see it.
export function buildFighter(entry, { levelCap } = {}) {
  const sp = species(entry.finalID, entry.baseID, entry.rarity);
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
    look: sp.look,
  };
}

// The 18 real PokeAPI types, in Spanish, with the real type chart. Shared by the server (battle
// maths) and the browser (so the UI can show effectiveness before you attack). A creature can have
// one or two types; a move has exactly one.

export const TYPES = {
  normal: { label: 'Normal', color: '#9099a1' },
  fire: { label: 'Fuego', color: '#e8603c' },
  water: { label: 'Agua', color: '#3f9bf5' },
  grass: { label: 'Planta', color: '#4bb050' },
  electric: { label: 'Eléctrico', color: '#e4c531' },
  ice: { label: 'Hielo', color: '#54cfcf' },
  fighting: { label: 'Lucha', color: '#cf4068' },
  poison: { label: 'Veneno', color: '#a24ec8' },
  ground: { label: 'Tierra', color: '#b88a4b' },
  flying: { label: 'Volador', color: '#8aa9df' },
  psychic: { label: 'Psíquico', color: '#f3598a' },
  bug: { label: 'Bicho', color: '#90c12c' },
  rock: { label: 'Roca', color: '#c0b377' },
  ghost: { label: 'Fantasma', color: '#6a5a9b' },
  dragon: { label: 'Dragón', color: '#6a5bd8' },
  dark: { label: 'Siniestro', color: '#5e5366' },
  steel: { label: 'Acero', color: '#5a8ea1' },
  fairy: { label: 'Hada', color: '#ed8cd0' },
};

export const typeLabel = (t) => TYPES[t]?.label ?? t;
export const typeNames = (types) => (types || []).map(typeLabel).join(' ');

// Attacking type -> { defending type: multiplier }. Only the non-1 cases are listed (2 = super
// effective, 0.5 = resisted, 0 = immune). Gen 6+ chart.
const CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

// How much a move of `moveType` does to a creature with `defTypes` (string or array): the product
// of the chart over each defending type. 0, 0.25, 0.5, 1, 2 or 4.
export function effectiveness(moveType, defTypes) {
  if (!moveType || !defTypes) return 1;
  const list = Array.isArray(defTypes) ? defTypes : [defTypes];
  let mult = 1;
  for (const d of list) mult *= CHART[moveType]?.[d] ?? 1;
  return mult;
}

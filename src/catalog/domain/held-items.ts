// The items a Pokémon can hold, like the held items of PokeRogue and Emerald Rogue. Only the Tower hands
// them out (as rewards, and to its later rivals); the arena's battles have none. What each one does in
// battle lives in combat/domain/item-effects.ts; this is what it is called, says and how rare it is.
export type ItemTier = 'common' | 'rare' | 'epic';

export interface HeldItemInfo {
  key: string;
  name: string;
  desc: string;
  tier: ItemTier;
  /** The type of the moves it strengthens (Charcoal, Mystic Water…). */
  boosts?: string;
  /** It only works on a Pokémon that can still evolve (Eviolite). */
  unevolved?: boolean;
  /** It is used up once it acts (a berry, a Focus Sash). */
  consumable?: boolean;
}

/** A type-boosting item makes the moves of its type this much stronger. */
export const TYPE_BOOST = 1.2;

const booster = (key: string, name: string, type: string, typeName: string): HeldItemInfo => ({
  key,
  name,
  desc: `Los movimientos de tipo ${typeName} pegan un 20 % más fuerte.`,
  tier: 'common',
  boosts: type,
});

const LIST: readonly HeldItemInfo[] = [
  booster('charcoal', 'Carbón', 'fire', 'Fuego'),
  booster('mystic-water', 'Agua Mística', 'water', 'Agua'),
  booster('miracle-seed', 'Semilla Milagro', 'grass', 'Planta'),
  booster('magnet', 'Imán', 'electric', 'Eléctrico'),
  booster('never-melt-ice', 'Antiderretir', 'ice', 'Hielo'),
  booster('black-belt', 'Cinturón Negro', 'fighting', 'Lucha'),
  booster('poison-barb', 'Flecha Venenosa', 'poison', 'Veneno'),
  booster('soft-sand', 'Arena Fina', 'ground', 'Tierra'),
  booster('sharp-beak', 'Pico Afilado', 'flying', 'Volador'),
  booster('twisted-spoon', 'Cuchara Torcida', 'psychic', 'Psíquico'),
  booster('silver-powder', 'Polvo Plata', 'bug', 'Bicho'),
  booster('hard-stone', 'Piedra Dura', 'rock', 'Roca'),
  booster('spell-tag', 'Hechizo', 'ghost', 'Fantasma'),
  booster('dragon-fang', 'Colmillo Dragón', 'dragon', 'Dragón'),
  booster('black-glasses', 'Gafas de Sol', 'dark', 'Siniestro'),
  booster('metal-coat', 'Revestimiento Metálico', 'steel', 'Acero'),
  booster('silk-scarf', 'Pañuelo Seda', 'normal', 'Normal'),
  { key: 'muscle-band', name: 'Cinta Fuerte', desc: 'Sus ataques físicos pegan un 10 % más fuerte.', tier: 'common' },
  { key: 'wise-glasses', name: 'Gafas Especiales', desc: 'Sus ataques especiales pegan un 10 % más fuerte.', tier: 'common' },
  { key: 'scope-lens', name: 'Periscopio', desc: 'Sube un nivel su probabilidad de golpe crítico.', tier: 'common' },
  { key: 'wide-lens', name: 'Lupa', desc: 'Sus movimientos aciertan un 10 % más.', tier: 'common' },
  { key: 'leftovers', name: 'Restos', desc: 'Recupera 1/16 de sus PS al final de cada turno.', tier: 'rare' },
  { key: 'shell-bell', name: 'Campana Concha', desc: 'Recupera 1/8 del daño que hace con cada ataque.', tier: 'rare' },
  { key: 'sitrus-berry', name: 'Baya Zidra', desc: 'Una vez, cuando sus PS bajan a la mitad, recupera 1/4.', tier: 'rare', consumable: true },
  { key: 'lum-berry', name: 'Baya Ziuela', desc: 'Una vez, se cura del primer problema de estado que sufra.', tier: 'rare', consumable: true },
  { key: 'focus-band', name: 'Cinta Focus', desc: 'Un 10 % de las veces aguanta con 1 PS un golpe que lo debilitaría.', tier: 'rare' },
  { key: 'rocky-helmet', name: 'Casco Dentado', desc: 'Quien lo golpea con contacto pierde 1/6 de sus PS.', tier: 'rare' },
  { key: 'eviolite', name: 'Mineral Evolutivo', desc: 'Si aún puede evolucionar, su Defensa y su Defensa Especial suben un 50 %.', tier: 'rare', unevolved: true },
  { key: 'life-orb', name: 'Vidasfera', desc: 'Sus ataques pegan un 30 % más fuerte, pero cada uno le cuesta 1/10 de sus PS.', tier: 'epic' },
  { key: 'expert-belt', name: 'Cinta Experto', desc: 'Sus ataques supereficaces pegan un 20 % más fuerte.', tier: 'epic' },
  { key: 'focus-sash', name: 'Banda Focus', desc: 'Una vez, con los PS llenos, aguanta con 1 PS un golpe que lo debilitaría.', tier: 'epic', consumable: true },
];

export const HELD_ITEMS: Readonly<Record<string, HeldItemInfo>> = Object.fromEntries(LIST.map((item) => [item.key, item]));
export const HELD_ITEM_KEYS: readonly string[] = LIST.map((item) => item.key);
export const isHeldItem = (key: string | null | undefined): key is string => !!key && key in HELD_ITEMS;
/** The item that strengthens moves of a type, if there is one. */
export const boosterOf = (type: string): string | null => LIST.find((item) => item.boosts === type)?.key ?? null;

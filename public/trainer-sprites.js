import { GENERATED_VARIANTS, VARIANT_COLOR_NAMES, VARIANT_COLOR_TYPES } from './trainer-variants.js?v=dev';

export { VARIANT_COLOR_NAMES, VARIANT_COLOR_TYPES };

export const DOWNLOADED_SPRITES = [
  'aaron', 'ace_trainer_f', 'ace_trainer_m', 'acerola', 'aether_grunt_f', 'aether_grunt_m', 'agatha', 'alder',
  'aliana', 'allister', 'amarys', 'aqua_grunt_f', 'aqua_grunt_m', 'archer', 'archie', 'ariana',
  'aroma_lady', 'artist', 'atticus', 'backers_f', 'backers_m', 'backpacker_f', 'backpacker_m', 'baker',
  'bea', 'beauty', 'beauty_2', 'bede', 'benga', 'bertha', 'biker', 'bird_keeper_f',
  'bird_keeper_m', 'black_belt_f', 'black_belt_m', 'blaine', 'blue', 'brassius', 'brawly', 'breeder_f',
  'breeder_m', 'brock', 'bruno', 'brycen', 'bryony', 'buck', 'bug_catcher', 'bug_type_superfan',
  'bugsy', 'burgh', 'byron', 'caitlin', 'camper_f', 'camper_m', 'candice', 'celosia',
  'cheren', 'cheryl', 'chili', 'chuck', 'cilan', 'clair', 'clay', 'clemont',
  'clerk_f', 'clerk_m', 'clerk_m_2', 'collector', 'colress', 'courtney', 'crasher_wake', 'cress',
  'crispin', 'cyclist_f', 'cyclist_m', 'cynthia', 'cyrus', 'dancer', 'depot_agent', 'diantha',
  'doctor_f', 'doctor_m', 'dragon_tamer', 'drake', 'drasna', 'drayden', 'drayton', 'elesa',
  'emmet', 'eri', 'erika', 'expert_pokemon_breeder', 'faba', 'fairy_tale_girl', 'falkner', 'fantina',
  'firebreather', 'fisherman', 'flannery', 'flare_grunt_f', 'flare_grunt_m', 'flint', 'galactic_grunt_f', 'galactic_grunt_m',
  'gardenia', 'geeta', 'ghetsis', 'giacomo', 'giovanni', 'glacia', 'gordie', 'grant',
  'grimsley', 'grusha', 'guitarist', 'guzma', 'hala', 'halloween_rival_f', 'halloween_rival_m', 'harlequin',
  'hassel', 'hau', 'hex_maniac', 'hiker', 'hooligans', 'hoopster', 'hugh', 'infielder',
  'ingo', 'interviewers', 'iono', 'iris', 'jacinthe_holo', 'janine', 'janitor', 'jasmine',
  'juan', 'jupiter', 'kabu', 'kahili', 'karen', 'katy', 'kieran', 'kofu',
  'koga', 'korrina', 'kukui', 'lacey', 'lance', 'larry', 'lenora', 'leon',
  'linebacker', 'liza', 'lorelei', 'lt_surge', 'lucian', 'lusamine', 'lysandre', 'mable',
  'macro_grunt_f', 'macro_grunt_m', 'magma_grunt_f', 'magma_grunt_m', 'maid', 'malva', 'marley', 'marlon',
  'marnie', 'mars', 'marshal', 'matt', 'maxie', 'maylene', 'mela', 'melony',
  'milo', 'mira', 'misty', 'molayne', 'morty', 'musician', 'mustard', 'mysterious_sisters',
  'nate', 'nemona', 'nessa', 'norman', 'nursery_aide', 'officer', 'oleana', 'olivia',
  'olympia', 'opal', 'ortega', 'parasol_lady', 'penny', 'petrel', 'phoebe', 'piers',
  'pilot', 'plasma_grunt_f', 'plasma_grunt_m', 'player_f', 'player_f_2', 'player_f_alternate', 'player_m', 'player_m_2',
  'player_m_alternate', 'plumeria', 'pokefan_f', 'pokefan_m', 'poppy', 'preschooler_f', 'preschooler_m', 'proton',
  'pryce', 'psychic_f', 'psychic_m', 'raihan', 'ramos', 'ranger_f', 'ranger_m', 'red',
  'rich_f', 'rich_kid_f', 'rich_kid_m', 'rich_m', 'rika', 'riley', 'rival_f', 'rival_m',
  'roark', 'rocket_boss_giovanni_1', 'rocket_grunt_f', 'rocket_grunt_m', 'rood', 'rosa', 'rose', 'roughneck',
  'roxanne', 'roxie', 'ruin_maniac', 'ryme', 'sabrina', 'sailor', 'saturn', 'school_kid_f',
  'school_kid_m', 'scientist_f', 'scientist_m', 'scuba_diver_f', 'scuba_diver_m', 'shauntal', 'shelly', 'sidney',
  'siebold', 'skull_grunt_f', 'skull_grunt_m', 'skyla', 'smasher', 'snow_ace_trainer_f', 'snow_ace_trainer_m', 'snow_worker',
  'snow_worker_f', 'snow_worker_m', 'star_grunt_f', 'star_grunt_m', 'steven', 'striker', 'swimmer_f', 'swimmer_m',
  'tabitha', 'tate', 'tulip', 'twins', 'unknown_f', 'unknown_m', 'valerie', 'veteran_f',
  'veteran_m', 'vicky', 'victor', 'victoria', 'viola', 'vito', 'vivi', 'volkner',
  'waiter_f', 'waiter_m', 'wallace', 'wattson', 'whitney', 'wikstrom', 'will', 'winona',
  'worker_f', 'worker_m', 'wulfric', 'xerosic', 'young_couple', 'youngster_f', 'youngster_m', 'zinzolin',
];

export const HANDMADE_VARIANTS = [
  { key: 'red_blue', base: 'red', name: 'Red Azul', swaps: [{ from: [330, 10], hue: 215 }] },
  { key: 'maxie_aqua', base: 'maxie', name: 'Maxie Aqua', swaps: [{ from: [340, 10], hue: 215 }] },
  { key: 'archie_magma', base: 'archie', name: 'Archie Magma', swaps: [{ from: [195, 225], hue: 355 }] },
  { key: 'lance_emerald', base: 'lance', name: 'Lance Esmeralda', swaps: [{ from: [325, 350], hue: 145 }] },
  { key: 'leon_shadow', base: 'leon', name: 'Leon Sombrío', swaps: [{ from: [340, 356], hue: 272 }] },
  { key: 'player_m_red', base: 'player_m', name: 'Player ♂ Carmesí', swaps: [{ from: [220, 232], hue: 355, light: 0.7 }] },
  { key: 'player_f_mint', base: 'player_f', name: 'Player ♀ Menta', swaps: [{ from: [320, 340], hue: 155 }] },
  { key: 'red_yellow', base: 'red', name: 'Red Amarillo', swaps: [{ from: [330, 10], hue: 50, light: 1.1 }] },
  { key: 'red_green', base: 'red', name: 'Red Verde', swaps: [{ from: [330, 10], hue: 120 }] },
  { key: 'blue_red', base: 'blue', name: 'Blue Rojo', swaps: [{ from: [18, 40], minSat: 0.45, maxLight: 0.56, hue: 358, light: 0.95 }] },
  { key: 'lance_dragonite', base: 'lance', name: 'Lance Dragonite', swaps: [{ from: [325, 350], hue: 32, light: 1.15 }] },
  { key: 'misty_starmie', base: 'misty', name: 'Misty Starmie', swaps: [{ from: [185, 215], hue: 280 }] },
  { key: 'steven_metagross', base: 'steven', name: 'Steven Metagross', swaps: [{ from: [180, 195], hue: 215, light: 0.85 }, { from: [250, 285], hue: 205 }] },
  { key: 'wallace_milotic', base: 'wallace', name: 'Wallace Milotic', swaps: [{ from: [280, 300], hue: 205 }] },
  { key: 'cynthia_garchomp', base: 'cynthia', name: 'Cynthia Garchomp', swaps: [{ from: [35, 55], hue: 225, sat: 0.8, light: 0.8 }] },
  { key: 'cynthia_platinum', base: 'cynthia', name: 'Cynthia Platino', swaps: [{ from: [35, 55], hue: 220, sat: 0.12, light: 1.05 }] },
  { key: 'iris_haxorus', base: 'iris', name: 'Iris Haxorus', swaps: [{ from: [335, 5], hue: 70 }] },
  { key: 'diantha_gardevoir', base: 'diantha', name: 'Diantha Gardevoir', swaps: [{ from: [200, 225], hue: 130, sat: 2.2 }] },
  { key: 'nate_red', base: 'nate', name: 'Nate Rojo', swaps: [{ from: [195, 245], hue: 355 }] },
  { key: 'rosa_emerald', base: 'rosa', name: 'Rosa Esmeralda', swaps: [{ from: [195, 215], hue: 145 }, { from: [335, 350], hue: 160 }] },
  { key: 'player_m_green', base: 'player_m', name: 'Player ♂ Esmeralda', swaps: [{ from: [220, 232], hue: 140, light: 0.75 }] },
  { key: 'player_f_violet', base: 'player_f', name: 'Player ♀ Violeta', swaps: [{ from: [320, 340], hue: 275 }] },
];

export const GYM_LEADERS = {
  normal: ['whitney', 'norman', 'lenora'],
  fire: ['blaine', 'flannery', 'chili', 'kabu'],
  water: ['misty', 'juan', 'crasher_wake', 'cress', 'marlon', 'nessa', 'kofu'],
  electric: ['lt_surge', 'wattson', 'volkner', 'elesa', 'clemont', 'iono'],
  grass: ['erika', 'gardenia', 'cilan', 'ramos', 'milo', 'brassius'],
  ice: ['pryce', 'candice', 'brycen', 'wulfric', 'melony', 'grusha'],
  fighting: ['chuck', 'brawly', 'maylene', 'korrina', 'bea'],
  poison: ['janine', 'roxie'],
  ground: ['giovanni', 'clay'],
  flying: ['falkner', 'winona', 'skyla'],
  psychic: ['sabrina', 'tate', 'liza', 'olympia', 'tulip'],
  bug: ['bugsy', 'burgh', 'viola', 'katy'],
  rock: ['brock', 'roxanne', 'roark', 'grant', 'gordie'],
  ghost: ['morty', 'fantina', 'allister', 'ryme'],
  dragon: ['clair', 'drayden', 'raihan'],
  dark: ['piers'],
  steel: ['jasmine', 'byron'],
  fairy: ['valerie', 'opal'],
};

export const ELITE_FOUR = {
  lorelei: 'ice', bruno: 'fighting', agatha: 'ghost', will: 'psychic', koga: 'poison', karen: 'dark', sidney: 'dark',
  phoebe: 'ghost', glacia: 'ice', drake: 'dragon', aaron: 'bug', bertha: 'ground', flint: 'fire', lucian: 'psychic',
  shauntal: 'ghost', grimsley: 'dark', caitlin: 'psychic', marshal: 'fighting', malva: 'fire', siebold: 'water',
  wikstrom: 'steel', drasna: 'dragon', hala: 'fighting', olivia: 'rock', acerola: 'ghost', kahili: 'flying',
  molayne: 'steel', rika: 'ground', poppy: 'steel', larry: 'flying', hassel: 'dragon', crispin: 'fire', amarys: 'steel',
  lacey: 'fairy', drayton: 'dragon',
};

export const CHAMPIONS = ['blue', 'lance', 'steven', 'wallace', 'cynthia', 'alder', 'iris', 'diantha', 'kukui', 'hau', 'leon', 'geeta', 'nemona', 'kieran', 'red'];

export const VILLAINS = {
  admin: ['archer', 'ariana', 'proton', 'petrel', 'courtney', 'matt', 'shelly', 'tabitha', 'mars', 'jupiter', 'saturn', 'zinzolin', 'rood', 'xerosic', 'bryony', 'aliana', 'celosia', 'mable', 'plumeria', 'faba', 'oleana'],
  boss: ['maxie', 'archie', 'cyrus', 'lysandre', 'lusamine', 'guzma'],
  legend: ['rocket_boss_giovanni_1', 'ghetsis', 'rose', 'penny'],
  star: ['giacomo', 'mela', 'atticus', 'ortega', 'eri'],
  partner: ['cheryl', 'riley', 'buck', 'marley', 'mira'],
};

const SHOP_STATIC = {
  halloween_rival_m: 'legendary', halloween_rival_f: 'legendary', jacinthe_holo: 'legendary',
  player_m_alternate: 'epic', player_f_alternate: 'epic', mysterious_sisters: 'epic', bug_type_superfan: 'epic', hooligans: 'epic',
  player_m_2: 'rare', player_f_2: 'rare', nate: 'rare', rosa: 'rare', victor: 'rare', victoria: 'rare', vicky: 'rare', vito: 'rare',
  vivi: 'rare', interviewers: 'rare', backers_m: 'rare', backers_f: 'rare', young_couple: 'rare', twins: 'rare', expert_pokemon_breeder: 'rare', harlequin: 'rare',
  rich_kid_m: 'common', rich_kid_f: 'common', maid: 'common', fairy_tale_girl: 'common', dancer: 'common', musician: 'common', smasher: 'common',
  striker: 'common', infielder: 'common', hoopster: 'common', linebacker: 'common',
  leon_shadow: 'mythic', player_m_red: 'rare', player_f_mint: 'rare', player_m_green: 'rare', player_f_violet: 'rare', nate_red: 'epic', rosa_emerald: 'epic',
};

export const SPECIALS = ['red_blue', 'maxie_aqua', 'archie_magma', 'lance_emerald', 'red_yellow', 'red_green', 'blue_red', 'lance_dragonite', 'misty_starmie', 'steven_metagross', 'wallace_milotic', 'cynthia_garchomp', 'cynthia_platinum', 'iris_haxorus', 'diantha_gardevoir', 'collector', 'colress', 'mustard', 'rich_m', 'rich_f', 'cheren', 'hugh', 'emmet', 'ingo', 'bede', 'marnie'];

const NEXT_TIER = { common: 'rare', rare: 'epic', epic: 'legendary', legendary: 'mythic', mythic: 'mythic' };

function tierOf(key) {
  if (key in SHOP_STATIC) return SHOP_STATIC[key];
  if (CHAMPIONS.includes(key) || VILLAINS.legend.includes(key)) return 'legendary';
  if (key in ELITE_FOUR || VILLAINS.boss.includes(key) || SPECIALS.includes(key)) return 'epic';
  if (Object.values(GYM_LEADERS).flat().includes(key) || [...VILLAINS.admin, ...VILLAINS.star, ...VILLAINS.partner].includes(key)) return 'rare';
  return null;
}

export const TRAINER_VARIANTS = [...HANDMADE_VARIANTS, ...GENERATED_VARIANTS];

export const EARNED_VARIANTS = GENERATED_VARIANTS.filter((variant) => variant.earn);

const SOLD_VARIANTS = GENERATED_VARIANTS.filter((variant) => !variant.earn);

export const VARIANT_REQUIRES = Object.fromEntries(SOLD_VARIANTS.filter((variant) => tierOf(variant.base)).map((variant) => [variant.key, variant.base]));

export const SHOP_TRAINERS = {
  ...SHOP_STATIC,
  ...Object.fromEntries(SOLD_VARIANTS.map((variant) => [variant.key, tierOf(variant.base) ? NEXT_TIER[tierOf(variant.base)] : 'common'])),
};

const LOCKED = new Set([...EARNED_VARIANTS.map((variant) => variant.key), ...Object.values(GYM_LEADERS).flat(), ...Object.keys(ELITE_FOUR), ...CHAMPIONS, ...Object.values(VILLAINS).flat(), ...SPECIALS, ...Object.keys(SHOP_TRAINERS)]);

export const TRAINER_SPRITES = [...DOWNLOADED_SPRITES, ...TRAINER_VARIANTS.map((variant) => variant.key)];

export const STARTER_SPRITES = TRAINER_SPRITES.filter((key) => !LOCKED.has(key));

export const isTrainerSprite = (key) => TRAINER_SPRITES.includes(key);

export function trainerSpriteFor(seed, pool = TRAINER_SPRITES) {
  let hash = 0;
  for (const ch of String(seed)) hash = (Math.imul(hash, 31) + ch.codePointAt(0)) >>> 0;
  return pool[hash % pool.length];
}

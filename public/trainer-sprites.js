import { GENERATED_VARIANTS, POKEMON_VARIANT_MAPS, RETIRED_GENERATED, VARIANT_COLOR_NAMES, VARIANT_COLOR_TYPES } from './trainer-variants.js?v=dev';

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

const MALE_MARK = /_m(?=_|$)/;

export const MALE_OF = Object.fromEntries(DOWNLOADED_SPRITES.filter((key) => MALE_MARK.test(key)).map((male) => [male.replace(MALE_MARK, '_f'), male]).filter(([female]) => DOWNLOADED_SPRITES.includes(female)));

export const FEMALE_OF = Object.fromEntries(Object.entries(MALE_OF).map(([female, male]) => [male, female]));

export const HANDMADE_VARIANTS = [
  { key: 'red_blue', base: 'red', pokemon: 9, name: 'Red Blastoise', swaps: [{ from: [330, 10], hue: 215 }] },
  { key: 'maxie_aqua', base: 'maxie', pokemon: 382, name: 'Maxie Kyogre', swaps: [{ from: [340, 10], hue: 215 }] },
  { key: 'archie_magma', base: 'archie', pokemon: 383, name: 'Archie Groudon', swaps: [{ from: [195, 225], hue: 355 }] },
  { key: 'lance_emerald', base: 'lance', pokemon: 384, name: 'Lance Rayquaza', swaps: [{ from: [325, 350], hue: 145 }] },
  { key: 'leon_shadow', base: 'leon', name: 'Leon Sombrío', swaps: [{ from: [340, 356], hue: 272 }] },
  { key: 'player_m_red', base: 'player_m', name: 'Player ♂ Carmesí', swaps: [{ from: [220, 232], hue: 355, light: 0.7 }] },
  { key: 'player_f_mint', base: 'player_f', name: 'Player ♀ Menta', swaps: [{ from: [320, 340], hue: 155 }] },
  { key: 'red_yellow', base: 'red', pokemon: 26, name: 'Red Raichu', swaps: [{ from: [330, 10], hue: 50, light: 1.1 }] },
  { key: 'red_green', base: 'red', pokemon: 3, name: 'Red Venusaur', swaps: [{ from: [330, 10], hue: 120 }] },
  { key: 'blue_red', base: 'blue', pokemon: 6, name: 'Blue Charizard', swaps: [{ from: [18, 40], minSat: 0.45, maxLight: 0.56, hue: 22, sat: 1.9, light: 1.25 }] },
  { key: 'red_charizard', base: 'red', pokemon: 6, name: 'Red Charizard', swaps: [{ from: [330, 10], hue: 24, sat: 1.25, light: 1.05 }] },
  { key: 'lance_dragonite', base: 'lance', pokemon: 149, name: 'Lance Dragonite', swaps: [{ from: [325, 350], hue: 32, light: 1.15 }] },
  { key: 'misty_starmie', base: 'misty', pokemon: 121, name: 'Misty Starmie', swaps: [{ from: [185, 215], hue: 280 }] },
  { key: 'steven_metagross', base: 'steven', pokemon: 376, name: 'Steven Metagross', swaps: [{ from: [180, 195], hue: 215, light: 0.85 }, { from: [250, 285], hue: 205 }] },
  { key: 'wallace_milotic', base: 'wallace', pokemon: 350, name: 'Wallace Milotic', swaps: [{ from: [280, 300], hue: 205 }] },
  { key: 'cynthia_garchomp', base: 'cynthia', pokemon: 445, name: 'Cynthia Garchomp', swaps: [{ from: [35, 55], hue: 225, sat: 0.8, light: 0.8 }] },
  { key: 'cynthia_platinum', base: 'cynthia', pokemon: 487, name: 'Cynthia Giratina', swaps: [{ from: [35, 55], hue: 220, sat: 0.12, light: 1.05 }] },
  { key: 'iris_haxorus', base: 'iris', pokemon: 612, name: 'Iris Haxorus', swaps: [{ from: [335, 5], hue: 70 }] },
  { key: 'diantha_gardevoir', base: 'diantha', pokemon: 282, name: 'Diantha Gardevoir', swaps: [{ from: [200, 225], hue: 130, sat: 2.2 }] },
  { key: 'nate_red', base: 'nate', name: 'Nate Rojo', swaps: [{ from: [195, 245], hue: 355 }] },
  { key: 'rosa_emerald', base: 'rosa', name: 'Rosa Esmeralda', swaps: [{ from: [195, 215], hue: 145 }, { from: [335, 350], hue: 160 }] },
  { key: 'player_m_green', base: 'player_m', name: 'Player ♂ Esmeralda', swaps: [{ from: [220, 232], hue: 140, light: 0.75 }] },
  { key: 'player_f_violet', base: 'player_f', name: 'Player ♀ Violeta', swaps: [{ from: [320, 340], hue: 275 }] },
  { key: 'lorelei_articuno', base: 'lorelei', pokemon: 144, name: 'Lorelei Articuno', swaps: [] },
  { key: 'lt_surge_zapdos', base: 'lt_surge', pokemon: 145, name: 'Lt. Surge Zapdos', swaps: [] },
  { key: 'blaine_moltres', base: 'blaine', pokemon: 146, name: 'Blaine Moltres', swaps: [] },
  { key: 'rocket_boss_giovanni_1_mewtwo', base: 'rocket_boss_giovanni_1', pokemon: 150, name: 'Giovanni Mewtwo', swaps: [] },
  { key: 'scientist_m_mew', base: 'scientist_m', pokemon: 151, name: 'Científico Mew', swaps: [] },
  { key: 'volkner_raikou', base: 'volkner', pokemon: 243, name: 'Volkner Raikou', swaps: [] },
  { key: 'flannery_entei', base: 'flannery', pokemon: 244, name: 'Flannery Entei', swaps: [] },
  { key: 'crasher_wake_suicune', base: 'crasher_wake', pokemon: 245, name: 'Crasher Wake Suicune', swaps: [] },
  { key: 'falkner_lugia', base: 'falkner', pokemon: 249, name: 'Falkner Lugia', swaps: [] },
  { key: 'morty_ho_oh', base: 'morty', pokemon: 250, name: 'Morty Ho-Oh', swaps: [] },
  { key: 'erika_celebi', base: 'erika', pokemon: 251, name: 'Erika Celebi', swaps: [] },
  { key: 'roxanne_regirock', base: 'roxanne', pokemon: 377, name: 'Roxanne Regirock', swaps: [] },
  { key: 'glacia_regice', base: 'glacia', pokemon: 378, name: 'Glacia Regice', swaps: [] },
  { key: 'byron_registeel', base: 'byron', pokemon: 379, name: 'Byron Registeel', swaps: [] },
  { key: 'winona_latias', base: 'winona', pokemon: 380, name: 'Winona Latias', swaps: [] },
  { key: 'drake_latios', base: 'drake', pokemon: 381, name: 'Drake Latios', swaps: [] },
  { key: 'liza_jirachi', base: 'liza', pokemon: 385, name: 'Liza Jirachi', swaps: [] },
  { key: 'tate_deoxys', base: 'tate', pokemon: 386, name: 'Tate Deoxys', swaps: [] },
  { key: 'jupiter_uxie', base: 'jupiter', pokemon: 480, name: 'Jupiter Uxie', swaps: [] },
  { key: 'mars_mesprit', base: 'mars', pokemon: 481, name: 'Mars Mesprit', swaps: [] },
  { key: 'saturn_azelf', base: 'saturn', pokemon: 482, name: 'Saturn Azelf', swaps: [] },
  { key: 'cyrus_dialga', base: 'cyrus', pokemon: 483, name: 'Cyrus Dialga', swaps: [] },
  { key: 'cyrus_palkia', base: 'cyrus', pokemon: 484, name: 'Cyrus Palkia', swaps: [] },
  { key: 'flint_heatran', base: 'flint', pokemon: 485, name: 'Flint Heatran', swaps: [] },
  { key: 'candice_regigigas', base: 'candice', pokemon: 486, name: 'Candice Regigigas', swaps: [] },
  { key: 'lucian_cresselia', base: 'lucian', pokemon: 488, name: 'Lucian Cresselia', swaps: [] },
  { key: 'marlon_phione', base: 'marlon', pokemon: 489, name: 'Marlon Phione', swaps: [] },
  { key: 'juan_manaphy', base: 'juan', pokemon: 490, name: 'Juan Manaphy', swaps: [] },
  { key: 'karen_darkrai', base: 'karen', pokemon: 491, name: 'Karen Darkrai', swaps: [] },
  { key: 'gardenia_shaymin', base: 'gardenia', pokemon: 492, name: 'Gardenia Shaymin', swaps: [] },
  { key: 'fantina_arceus', base: 'fantina', pokemon: 493, name: 'Fantina Arceus', swaps: [] },
  { key: 'cheren_victini', base: 'cheren', pokemon: 494, name: 'Cheren Victini', swaps: [] },
  { key: 'jasmine_cobalion', base: 'jasmine', pokemon: 638, name: 'Jasmine Cobalion', swaps: [] },
  { key: 'clay_terrakion', base: 'clay', pokemon: 639, name: 'Clay Terrakion', swaps: [] },
  { key: 'cilan_virizion', base: 'cilan', pokemon: 640, name: 'Cilan Virizion', swaps: [] },
  { key: 'skyla_tornadus', base: 'skyla', pokemon: 641, name: 'Skyla Tornadus', swaps: [] },
  { key: 'elesa_thundurus', base: 'elesa', pokemon: 642, name: 'Elesa Thundurus', swaps: [] },
  { key: 'ghetsis_reshiram', base: 'ghetsis', pokemon: 643, name: 'Ghetsis Reshiram', swaps: [] },
  { key: 'drayden_zekrom', base: 'drayden', pokemon: 644, name: 'Drayden Zekrom', swaps: [] },
  { key: 'bertha_landorus', base: 'bertha', pokemon: 645, name: 'Bertha Landorus', swaps: [] },
  { key: 'hugh_kyurem', base: 'hugh', pokemon: 646, name: 'Hugh Kyurem', swaps: [] },
  { key: 'cress_keldeo', base: 'cress', pokemon: 647, name: 'Cress Keldeo', swaps: [] },
  { key: 'musician_meloetta', base: 'musician', pokemon: 648, name: 'Músico Meloetta', swaps: [] },
  { key: 'colress_genesect', base: 'colress', pokemon: 649, name: 'Colress Genesect', swaps: [] },
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

export const RETIRED_SHOP_TRAINERS = {
  halloween_rival_m: 'legendary', halloween_rival_f: 'legendary', jacinthe_holo: 'legendary',
  player_m_alternate: 'epic', player_f_alternate: 'epic', mysterious_sisters: 'epic', bug_type_superfan: 'epic', hooligans: 'epic',
  player_m_2: 'rare', player_f_2: 'rare', nate: 'rare', rosa: 'rare', victor: 'rare', victoria: 'rare', vicky: 'rare', vito: 'rare',
  vivi: 'rare', interviewers: 'rare', backers_m: 'rare', backers_f: 'rare', young_couple: 'rare', twins: 'rare', expert_pokemon_breeder: 'rare', harlequin: 'rare',
  rich_kid_m: 'common', rich_kid_f: 'common', maid: 'common', fairy_tale_girl: 'common', dancer: 'common', musician: 'common', smasher: 'common',
  striker: 'common', infielder: 'common', hoopster: 'common', linebacker: 'common',
};

export const RETIRED_RECOLORS = { player_f__mint: 'rare', ...RETIRED_GENERATED };

const HANDMADE_SOLD = { leon_shadow: 'mythic', player_m_red: 'rare', player_f_mint: 'rare', player_m_green: 'rare', player_f_violet: 'rare', nate_red: 'epic', rosa_emerald: 'epic' };

export const DEFAULT_LOOKS = ['youngster_m', 'youngster_f', 'school_kid_m', 'school_kid_f', 'preschooler_m', 'preschooler_f'];

export const SPECIALS = ['red_charizard', 'red_blue', 'maxie_aqua', 'archie_magma', 'lance_emerald', 'red_yellow', 'red_green', 'blue_red', 'lance_dragonite', 'misty_starmie', 'steven_metagross', 'wallace_milotic', 'cynthia_garchomp', 'cynthia_platinum', 'iris_haxorus', 'diantha_gardevoir', 'collector', 'colress', 'mustard', 'rich_m', 'rich_f', 'cheren', 'hugh', 'emmet', 'ingo', 'bede', 'marnie'];

const NEXT_TIER = { common: 'rare', rare: 'epic', epic: 'legendary', legendary: 'mythic', mythic: 'mythic' };

export function originalTier(key) {
  if (CHAMPIONS.includes(key) || VILLAINS.legend.includes(key)) return 'legendary';
  if (key in ELITE_FOUR || VILLAINS.boss.includes(key) || SPECIALS.includes(key)) return 'epic';
  if (Object.values(GYM_LEADERS).flat().includes(key) || [...VILLAINS.admin, ...VILLAINS.star, ...VILLAINS.partner].includes(key)) return 'rare';
  const retired = RETIRED_SHOP_TRAINERS[key];
  return retired === 'legendary' ? 'epic' : retired ?? 'common';
}

export const SHINY_VARIANTS = HANDMADE_VARIANTS.filter((variant) => variant.pokemon).map((variant) => ({ key: `${variant.key}_shiny`, base: variant.base, pokemon: variant.pokemon, shiny: true, original: variant.key, name: `${variant.name} Shiny`, swaps: [] }));

const withPokemonMap = (variant) => (POKEMON_VARIANT_MAPS[variant.key] ? { ...variant, map: POKEMON_VARIANT_MAPS[variant.key] } : variant);

export const TRAINER_VARIANTS = [...[...HANDMADE_VARIANTS, ...SHINY_VARIANTS].map(withPokemonMap), ...GENERATED_VARIANTS];

export const EARNED_VARIANTS = GENERATED_VARIANTS.filter((variant) => variant.earn);

const SOLD_VARIANTS = GENERATED_VARIANTS.filter((variant) => !variant.earn);

export const VARIANT_REQUIRES = Object.fromEntries([...HANDMADE_VARIANTS.filter((variant) => variant.key in HANDMADE_SOLD), ...SOLD_VARIANTS].map((variant) => [variant.key, variant.base]));

export const SHOP_TRAINERS = {
  ...HANDMADE_SOLD,
  ...Object.fromEntries(SOLD_VARIANTS.map((variant) => [variant.key, NEXT_TIER[originalTier(variant.base)]])),
};

export const TRAINER_SPRITES = [...DOWNLOADED_SPRITES, ...TRAINER_VARIANTS.map((variant) => variant.key)];

export const STARTER_SPRITES = DEFAULT_LOOKS;

export const isTrainerSprite = (key) => TRAINER_SPRITES.includes(key);

export function trainerSpriteFor(seed, pool = TRAINER_SPRITES) {
  let hash = 0;
  for (const ch of String(seed)) hash = (Math.imul(hash, 31) + ch.codePointAt(0)) >>> 0;
  return pool[hash % pool.length];
}

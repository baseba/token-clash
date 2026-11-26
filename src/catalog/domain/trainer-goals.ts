export type TrainerRarity = 'common' | 'rare' | 'epic' | 'legendary';

export type StarterRegion = 'kanto' | 'johto' | 'hoenn' | 'sinnoh' | 'unova' | 'kalos' | 'alola' | 'galar' | 'paldea';

export type ClassGoal =
  | { kind: 'type'; type: string }
  | { kind: 'species'; names: readonly string[]; label: string }
  | { kind: 'total'; need: number }
  | { kind: 'starter'; region?: StarterRegion }
  | { kind: 'tokens'; need: number; label: string };

export interface ClassTrainer {
  rarity: TrainerRarity;
  title: string;
  goal: ClassGoal;
}

export const STARTER_IDS: Readonly<Record<StarterRegion, readonly [number, number]>> = {
  kanto: [1, 9],
  johto: [152, 160],
  hoenn: [252, 260],
  sinnoh: [387, 395],
  unova: [495, 503],
  kalos: [650, 658],
  alola: [722, 730],
  galar: [810, 818],
  paldea: [906, 914],
};

export const TYPE_NEED: Readonly<Record<TrainerRarity, number>> = { common: 3, rare: 5, epic: 8, legendary: 12 };
export const SPECIES_NEED: Readonly<Record<TrainerRarity, number>> = { common: 1, rare: 2, epic: 3, legendary: 4 };
export const STARTER_NEED: Readonly<Record<TrainerRarity, number>> = { common: 1, rare: 2, epic: 3, legendary: 5 };

const type = (title: string, t: string, rarity: TrainerRarity = 'common'): ClassTrainer => ({ rarity, title, goal: { kind: 'type', type: t } });
const team = (title: string, label: string, names: readonly string[], rarity: TrainerRarity = 'common'): ClassTrainer => ({ rarity, title, goal: { kind: 'species', names, label } });
const total = (title: string, need: number, rarity: TrainerRarity = 'common'): ClassTrainer => ({ rarity, title, goal: { kind: 'total', need } });
const starter = (title: string, rarity: TrainerRarity = 'common', region?: StarterRegion): ClassTrainer => ({ rarity, title, goal: { kind: 'starter', region } });

const ROCKET = ['Ekans', 'Koffing', 'Zubat', 'Rattata'];
const AQUA = ['Carvanha', 'Poochyena', 'Wailmer'];
const MAGMA = ['Numel', 'Poochyena', 'Slugma'];
const GALACTIC = ['Glameow', 'Stunky', 'Zubat', 'Croagunk'];
const PLASMA = ['Purrloin', 'Patrat', 'Trubbish'];
const FLARE = ['Houndour', 'Croagunk', 'Scraggy', 'Golbat'];
const SKULL = ['Zubat', 'Drowzee', 'Golbat', 'Raticate'];
const AETHER = ['Porygon', 'Bronzor', 'Lillipup'];
const MACRO = ['Bronzor', 'Klink', 'Ferroseed'];

export const CLASS_TRAINERS: Readonly<Record<string, ClassTrainer>> = {
  youngster_m: total('Principiante', 1),
  youngster_f: total('Principiante', 1),
  school_kid_m: total('Principiante', 1),
  school_kid_f: total('Principiante', 1),
  preschooler_m: total('Principiante', 1),
  preschooler_f: total('Principiante', 1),
  player_m: starter('Protagonista'),
  player_f: starter('Protagonista'),
  rival_m: starter('Rival'),
  rival_f: starter('Rival'),
  player_m_2: starter('Protagonista', 'rare'),
  player_f_2: starter('Protagonista', 'rare'),
  player_m_alternate: starter('Protagonista', 'epic'),
  player_f_alternate: starter('Protagonista', 'epic'),
  nate: starter('Protagonista de Teselia', 'rare', 'unova'),
  rosa: starter('Protagonista de Teselia', 'rare', 'unova'),
  victor: starter('Protagonista de Galar', 'rare'),
  victoria: starter('Protagonista de Galar', 'rare'),
  rocket_grunt_m: team('Recluta del Team Rocket', 'Pokémon del Team Rocket', ROCKET),
  rocket_grunt_f: team('Recluta del Team Rocket', 'Pokémon del Team Rocket', ROCKET),
  aqua_grunt_m: team('Recluta del Team Aqua', 'Pokémon del Team Aqua', AQUA),
  aqua_grunt_f: team('Recluta del Team Aqua', 'Pokémon del Team Aqua', AQUA),
  magma_grunt_m: team('Recluta del Team Magma', 'Pokémon del Team Magma', MAGMA),
  magma_grunt_f: team('Recluta del Team Magma', 'Pokémon del Team Magma', MAGMA),
  galactic_grunt_m: team('Recluta del Team Galaxia', 'Pokémon del Team Galaxia', GALACTIC),
  galactic_grunt_f: team('Recluta del Team Galaxia', 'Pokémon del Team Galaxia', GALACTIC),
  plasma_grunt_m: team('Recluta del Team Plasma', 'Pokémon del Team Plasma', PLASMA),
  plasma_grunt_f: team('Recluta del Team Plasma', 'Pokémon del Team Plasma', PLASMA),
  flare_grunt_m: team('Recluta del Team Flare', 'Pokémon del Team Flare', FLARE),
  flare_grunt_f: team('Recluta del Team Flare', 'Pokémon del Team Flare', FLARE),
  skull_grunt_m: team('Recluta del Team Skull', 'Pokémon del Team Skull', SKULL),
  skull_grunt_f: team('Recluta del Team Skull', 'Pokémon del Team Skull', SKULL),
  aether_grunt_m: team('Empleado de la Fundación Æther', 'Pokémon de la Fundación Æther', AETHER),
  aether_grunt_f: team('Empleada de la Fundación Æther', 'Pokémon de la Fundación Æther', AETHER),
  macro_grunt_m: team('Empleado de Macro Cosmos', 'Pokémon de Macro Cosmos', MACRO),
  macro_grunt_f: team('Empleada de Macro Cosmos', 'Pokémon de Macro Cosmos', MACRO),
  star_grunt_m: type('Recluta del Team Star', 'dark'),
  star_grunt_f: type('Recluta del Team Star', 'dark'),
  ace_trainer_m: total('Entrenador guay', 40, 'rare'),
  ace_trainer_f: total('Entrenadora guay', 40, 'rare'),
  snow_ace_trainer_m: type('Entrenador guay de la nieve', 'ice', 'rare'),
  snow_ace_trainer_f: type('Entrenadora guay de la nieve', 'ice', 'rare'),
  veteran_m: total('Veterano', 80, 'epic'),
  veteran_f: total('Veterana', 80, 'epic'),
  benga: total('Heredero de la Torre Batalla', 100, 'epic'),
  breeder_m: total('Criador', 20),
  breeder_f: total('Criadora', 20),
  expert_pokemon_breeder: total('Criadora experta', 60, 'rare'),
  nursery_aide: total('Cuidadora', 10),
  ranger_m: total('Guardabosques', 30, 'rare'),
  ranger_f: total('Guardabosques', 30, 'rare'),
  hiker: type('Montañero', 'rock'),
  backpacker_m: type('Mochilero', 'ground'),
  backpacker_f: type('Mochilera', 'ground'),
  ruin_maniac: type('Ruinamaníaco', 'ground'),
  worker_m: type('Obrero', 'steel'),
  worker_f: type('Obrera', 'steel'),
  depot_agent: type('Agente del metro', 'steel'),
  scientist_m: type('Científico', 'steel'),
  scientist_f: type('Científica', 'steel'),
  snow_worker: type('Obrero de la nieve', 'ice'),
  bird_keeper_m: type('Ornitólogo', 'flying'),
  bird_keeper_f: type('Ornitóloga', 'flying'),
  pilot: type('Piloto', 'flying'),
  bug_catcher: type('Cazabichos', 'bug'),
  bug_type_superfan: type('Superfan de los Bicho', 'bug', 'epic'),
  fisherman: type('Pescador', 'water'),
  sailor: type('Marinero', 'water'),
  swimmer_m: type('Nadador', 'water'),
  swimmer_f: type('Nadadora', 'water'),
  scuba_diver_m: type('Buceador', 'water', 'rare'),
  scuba_diver_f: type('Buceadora', 'water', 'rare'),
  parasol_lady: type('Dama parasol', 'water'),
  psychic_m: type('Médium', 'psychic'),
  psychic_f: type('Médium', 'psychic'),
  harlequin: team('Arlequín', 'Mr. Mime o Mime Jr.', ['Mr. Mime', 'Mime Jr.'], 'rare'),
  jacinthe_holo: type('Jacinthe', 'psychic', 'epic'),
  hex_maniac: type('Ocultista', 'ghost'),
  halloween_rival_m: type('Rival de Halloween', 'ghost', 'epic'),
  halloween_rival_f: type('Rival de Halloween', 'ghost', 'epic'),
  mysterious_sisters: type('Hermanas misteriosas', 'ghost', 'epic'),
  black_belt_m: type('Karateka', 'fighting'),
  black_belt_f: type('Karateka', 'fighting'),
  striker: type('Delantero', 'fighting'),
  linebacker: type('Defensa', 'fighting'),
  hoopster: type('Basquetbolista', 'fighting'),
  infielder: type('Beisbolista', 'fighting'),
  smasher: type('Tenista', 'fighting'),
  roughneck: type('Gamberro', 'dark'),
  hooligans: type('Pandilleros', 'dark', 'epic'),
  biker: type('Motorista', 'poison'),
  janitor: team('Conserje', 'Grimer o Trubbish', ['Grimer', 'Trubbish']),
  firebreather: type('Comefuegos', 'fire'),
  dragon_tamer: type('Domadragones', 'dragon', 'rare'),
  guitarist: type('Guitarrista', 'electric'),
  aroma_lady: type('Dama aroma', 'grass'),
  camper_m: type('Campista', 'grass'),
  camper_f: type('Campista', 'grass'),
  beauty: type('Bella', 'fairy'),
  beauty_2: type('Bella', 'fairy'),
  fairy_tale_girl: type('Chica de cuento', 'fairy'),
  backers_m: type('Animador', 'fairy', 'rare'),
  backers_f: type('Animadora', 'fairy', 'rare'),
  twins: team('Gemelas', 'Plusle y Minun', ['Plusle', 'Minun'], 'rare'),
  young_couple: team('Pareja joven', 'Luvdisc, Volbeat o Illumise', ['Luvdisc', 'Volbeat', 'Illumise'], 'rare'),
  dancer: team('Bailarín', 'Hitmontop o Ludicolo', ['Hitmontop', 'Ludicolo']),
  musician: team('Músico', 'Kricketune o Exploud', ['Kricketune', 'Exploud']),
  artist: team('Artista', 'Smeargle', ['Smeargle']),
  baker: team('Panadera', 'Miltank', ['Miltank']),
  doctor_m: team('Doctor', 'Chansey, Blissey o Audino', ['Chansey', 'Blissey', 'Audino']),
  doctor_f: team('Doctora', 'Chansey, Blissey o Audino', ['Chansey', 'Blissey', 'Audino']),
  officer: team('Policía', 'Growlithe o Arcanine', ['Growlithe', 'Arcanine']),
  unknown_m: team('Investigador', 'Unown', ['Unown']),
  unknown_f: team('Investigadora', 'Unown', ['Unown']),
  interviewers: team('Reporteros', 'Chatot o Exploud', ['Chatot', 'Exploud'], 'rare'),
  clerk_m: type('Oficinista', 'normal'),
  clerk_m_2: type('Oficinista', 'normal'),
  clerk_f: type('Oficinista', 'normal'),
  waiter_m: type('Camarero', 'normal'),
  waiter_f: type('Camarera', 'normal'),
  maid: type('Doncella', 'normal'),
  pokefan_m: type('Pokéfan', 'normal'),
  pokefan_f: type('Pokéfan', 'normal'),
  cyclist_m: type('Ciclista', 'electric'),
  cyclist_f: type('Ciclista', 'electric'),
  vicky: type('Vicky', 'normal', 'rare'),
  vito: type('Vito', 'normal', 'rare'),
  vivi: type('Vivi', 'normal', 'rare'),
  rich_kid_m: { rarity: 'common', title: 'Niño rico', goal: { kind: 'tokens', need: 500_000_000, label: '500 millones' } },
  rich_kid_f: { rarity: 'common', title: 'Niña rica', goal: { kind: 'tokens', need: 500_000_000, label: '500 millones' } },
};

export const SIGNATURE: Readonly<Record<string, string>> = {
  brock: 'Onix', misty: 'Lapras', lt_surge: 'Raichu', erika: 'Vileplume', koga: 'Crobat', janine: 'Venomoth', sabrina: 'Alakazam', blaine: 'Arcanine', giovanni: 'Nidoking',
  falkner: 'Pidgeot', bugsy: 'Scyther', whitney: 'Miltank', morty: 'Gengar', chuck: 'Poliwrath', jasmine: 'Steelix', pryce: 'Piloswine', clair: 'Kingdra',
  roxanne: 'Nosepass', brawly: 'Hariyama', wattson: 'Manectric', flannery: 'Torkoal', norman: 'Slaking', winona: 'Altaria', tate: 'Solrock', liza: 'Lunatone', juan: 'Kingdra',
  roark: 'Rampardos', gardenia: 'Roserade', maylene: 'Lucario', crasher_wake: 'Floatzel', fantina: 'Mismagius', byron: 'Bastiodon', candice: 'Abomasnow', volkner: 'Luxray',
  cilan: 'Simisage', chili: 'Simisear', cress: 'Simipour', lenora: 'Watchog', burgh: 'Leavanny', elesa: 'Zebstrika', clay: 'Excadrill', skyla: 'Swanna', brycen: 'Beartic', drayden: 'Haxorus', marlon: 'Jellicent',
  viola: 'Vivillon', grant: 'Tyrantrum', korrina: 'Lucario', ramos: 'Gogoat', clemont: 'Heliolisk', valerie: 'Sylveon', olympia: 'Meowstic', wulfric: 'Avalugg',
  milo: 'Eldegoss', nessa: 'Drednaw', kabu: 'Centiskorch', allister: 'Gengar', opal: 'Alcremie', gordie: 'Coalossal', melony: 'Lapras', piers: 'Scrafty', raihan: 'Duraludon',
  katy: 'Lokix', brassius: 'Sudowoodo', iono: 'Bellibolt', kofu: 'Crabominable', ryme: 'Houndstone', tulip: 'Espathra', grusha: 'Cetitan',
  lorelei: 'Lapras', bruno: 'Machamp', agatha: 'Gengar', will: 'Xatu', karen: 'Houndoom', sidney: 'Absol', phoebe: 'Dusknoir', glacia: 'Walrein', drake: 'Salamence',
  aaron: 'Drapion', bertha: 'Hippowdon', flint: 'Infernape', lucian: 'Gallade', shauntal: 'Chandelure', grimsley: 'Bisharp', caitlin: 'Gothitelle', marshal: 'Conkeldurr',
  malva: 'Pyroar', siebold: 'Clawitzer', wikstrom: 'Aegislash', drasna: 'Noivern', hala: 'Crabominable', olivia: 'Lycanroc', acerola: 'Palossand', kahili: 'Toucannon', molayne: 'Dugtrio',
  rika: 'Whiscash', poppy: 'Tinkaton', larry: 'Staraptor', hassel: 'Baxcalibur',
  red: 'Snorlax', blue: 'Pidgeot', lance: 'Gyarados', steven: 'Aggron', wallace: 'Ludicolo', cynthia: 'Spiritomb', alder: 'Volcarona', iris: 'Druddigon',
  kukui: 'Lycanroc', hau: 'Decidueye', leon: 'Charizard', geeta: 'Glimmora', nemona: 'Pawmot',
  maxie: 'Camerupt', archie: 'Sharpedo', cyrus: 'Honchkrow', ghetsis: 'Hydreigon', lysandre: 'Gyarados', lusamine: 'Bewear', guzma: 'Golisopod', rose: 'Copperajah', rocket_boss_giovanni_1: 'Nidoking',
  archer: 'Houndoom', ariana: 'Arbok', petrel: 'Weezing', mars: 'Purugly', jupiter: 'Skuntank', saturn: 'Toxicroak', courtney: 'Camerupt', tabitha: 'Camerupt', matt: 'Sharpedo', shelly: 'Sharpedo',
  plumeria: 'Salazzle', faba: 'Hypno', mela: 'Armarouge', atticus: 'Revavroom', ortega: 'Revavroom', eri: 'Revavroom', giacomo: 'Revavroom',
};

export const TOWER_LENGTHS = [10, 25, 50, null];
export const GYM_EVERY = 5;
export const LEAGUE_BLOCK = 25;
export const ELITE_FLOORS = 4;
export const PARTY_LIMIT = 6;
export const START_LEVEL = 5;
export const MAX_LEVEL = 100;
export const LAB_OFFERS = 6;
export const STARTERS = 3;
export const LAB_SCENE = 'path';
export const PROFESSOR = { key: 'prof_oak', name: 'Profesor Oak' };

export const TYPE_SCENES = {
  normal: ['path', 'tall-grass'], fire: ['desert', 'mountain-night'], water: ['lake', 'beach', 'ocean'], grass: ['tall-grass', 'path-2'],
  electric: ['desert-night', 'path-2'], ice: ['snow', 'snow-night'], fighting: ['mountain-2', 'path'], poison: ['path-night', 'lake-night'],
  ground: ['desert', 'mountain-2'], flying: ['mountain-2', 'beach-2'], psychic: ['cave-night', 'path-night'], bug: ['tall-grass', 'tall-grass-night'],
  rock: ['cave', 'mountain'], ghost: ['path-night', 'cave-night'], dragon: ['ocean-night', 'mountain-night'], dark: ['beach-night', 'path-night'],
  steel: ['cave-2', 'mountain'], fairy: ['path-2', 'tall-grass'],
};
export const ROUTE_SCENES = ['tall-grass', 'path', 'lake', 'beach', 'mountain', 'desert', 'path-2', 'beach-2', 'cave', 'snow', 'ocean', 'underwater'];

export const REGIONS = {
  kanto: ['brock', 'misty', 'lt_surge', 'erika', 'koga', 'janine', 'sabrina', 'blaine', 'giovanni', 'lorelei', 'bruno', 'agatha', 'lance', 'blue', 'red'],
  johto: ['falkner', 'bugsy', 'whitney', 'morty', 'chuck', 'jasmine', 'pryce', 'clair', 'will', 'karen'],
  hoenn: ['roxanne', 'brawly', 'wattson', 'flannery', 'norman', 'winona', 'tate', 'liza', 'juan', 'sidney', 'phoebe', 'glacia', 'drake', 'steven', 'wallace'],
  sinnoh: ['roark', 'gardenia', 'maylene', 'crasher_wake', 'fantina', 'byron', 'candice', 'volkner', 'aaron', 'bertha', 'flint', 'lucian', 'cynthia'],
  unova: ['cilan', 'chili', 'cress', 'lenora', 'burgh', 'elesa', 'clay', 'skyla', 'brycen', 'drayden', 'iris', 'roxie', 'marlon', 'shauntal', 'grimsley', 'caitlin', 'marshal', 'alder'],
  kalos: ['viola', 'grant', 'korrina', 'ramos', 'clemont', 'valerie', 'olympia', 'wulfric', 'malva', 'siebold', 'wikstrom', 'drasna', 'diantha'],
  alola: ['hala', 'olivia', 'acerola', 'kahili', 'molayne', 'kukui', 'hau'],
  galar: ['milo', 'nessa', 'kabu', 'bea', 'allister', 'opal', 'gordie', 'melony', 'piers', 'raihan', 'leon'],
  paldea: ['katy', 'brassius', 'iono', 'kofu', 'ryme', 'tulip', 'grusha', 'larry', 'rika', 'poppy', 'hassel', 'geeta', 'nemona', 'kieran', 'crispin', 'amarys', 'lacey', 'drayton'],
};

export const MUSIC = {
  gym: { kanto: 'battle_kanto_gym', johto: 'battle_johto_gym', hoenn: 'battle_hoenn_gym', sinnoh: 'battle_sinnoh_gym', unova: 'battle_unova_gym', kalos: 'battle_kalos_gym', alola: 'battle_alola_elite', galar: 'battle_galar_gym', paldea: 'battle_paldea_gym' },
  elite: { kanto: 'battle_johto_gym', johto: 'battle_johto_gym', hoenn: 'battle_hoenn_elite', sinnoh: 'battle_unova_elite', unova: 'battle_unova_elite', kalos: 'battle_kalos_elite', alola: 'battle_alola_elite', galar: 'battle_galar_elite', paldea: 'battle_paldea_elite' },
  champion: { kanto: 'battle_kanto_champion', johto: 'battle_johto_champion', hoenn: 'battle_hoenn_champion_g5', sinnoh: 'battle_sinnoh_champion', unova: 'battle_champion_alder', kalos: 'battle_kalos_champion', alola: 'battle_alola_champion', galar: 'battle_galar_champion', paldea: 'battle_champion_geeta' },
  route: 'battle_trainer',
  lateRoute: 'battle_rival_2',
  hideout: 'battle_rocket_grunt',
};

export const NAMES = {
  m: ['Tomás', 'Matías', 'Benjamín', 'Vicente', 'Joaquín', 'Agustín', 'Cristóbal', 'Diego', 'Felipe', 'Lucas', 'Maximiliano', 'Gaspar', 'Ignacio', 'Simón', 'Bruno', 'Martín', 'Sebastián', 'Nicolás', 'Andrés', 'Rodrigo', 'Pablo', 'Gonzalo', 'Emilio', 'Renato', 'Alonso', 'Julián', 'Facundo', 'Damián', 'Elías', 'Bastián', 'Ramiro', 'Hernán', 'Óscar', 'Raúl', 'Esteban', 'Fabián', 'León', 'Mateo', 'Thiago', 'Iván', 'Camilo', 'Patricio', 'Germán', 'Álvaro', 'Manuel'],
  f: ['Javiera', 'Antonia', 'Catalina', 'Florencia', 'Isidora', 'Martina', 'Josefa', 'Trinidad', 'Amanda', 'Emilia', 'Fernanda', 'Renata', 'Constanza', 'Valentina', 'Paz', 'Sofía', 'Agustina', 'Magdalena', 'Ignacia', 'Francisca', 'Daniela', 'Camila', 'Rocío', 'Belén', 'Macarena', 'Pía', 'Colomba', 'Laura', 'Elisa', 'Julieta', 'Olivia', 'Maite', 'Carolina', 'Bárbara', 'Gabriela', 'Montserrat', 'Violeta', 'Ana', 'Lucía', 'Inés', 'Clara', 'Rosario', 'Teresa', 'Alma', 'Victoria'],
};

export const FEMALE_CLASSES = ['parasol_lady', 'jacinthe_holo', 'hex_maniac', 'aroma_lady', 'beauty', 'beauty_2', 'fairy_tale_girl', 'baker', 'maid', 'vicky', 'vivi', 'lass', 'picnicker', 'battle_girl', 'lady', 'socialite', 'nurse', 'kimono_girl', 'idol', 'cowgirl', 'madame'];
export const PAIR_CLASSES = { twins: 'ff', mysterious_sisters: 'ff', young_couple: 'mf', hooligans: 'mm', interviewers: 'mf', sis_and_bro: 'fm' };
export const NAMED_CLASSES = { jacinthe_holo: 'Jacinthe', vicky: 'Vicky', vito: 'Vito', vivi: 'Vivi', nate: 'Nate', rosa: 'Rosa', victor: 'Victor', victoria: 'Victoria', benga: 'Benga' };

export const PROFESSOR_LINES = {
  hello: 'Así que tú vas a subir la torre. Revisé tu colección y aparté a los que mejor se ven para empezar. Llévate tres… y recuerda: un Pokémon crece al ritmo de quien lo acompaña.',
  picked: 'Buena elección. Ese tiene más de lo que muestra. ¡Anda, la torre te espera!',
  twist: 'Por cierto, me llegó un rumor sobre esta subida:',
};

export const RECRUIT_LINE = 'Tus Pokémon tienen buen temple. Elige a uno de estos de tu colección para lo que viene.';

export const STOP_PEOPLE = {
  rest: { speaker: 'Enfermera de la ruta', lines: ['Tus Pokémon se ven cansados. Déjamelos un rato… ¡Listo! Toma, también encontré esto para ti.', 'Bienvenid{o} a la parada. Descansa, que lo que viene es más difícil.', '¡Qué equipo tan bonito! Tengo un par de cosas que te pueden servir.'] },
  den: { speaker: 'Criadora', lines: ['Aquí se esconden Pokémon de tu colección que quieren acompañarte.', 'Shh… si te acercas despacio, alguno se va a querer unir.', 'Estos se escaparon de la guardería buscando aventura. ¿Te llevas uno?'] },
  deal: { speaker: 'Figura en la sombra', lines: ['Je… Tengo algo que te interesa. Pero todo tiene un precio.', 'Nadie sube esta torre sin sacrificar algo. ¿Qué me ofreces?', 'Dos tesoros por uno de los tuyos. Un trato justo, ¿no crees?'] },
};

export const TWISTS = {
  night: { name: 'Noche cerrada', icon: 'planet', text: 'La torre está de noche: todas las rutas se ven oscuras y las guaridas villanas aparecen el doble.' },
  market: { name: 'Feria ambulante', icon: 'heart', text: 'Hay más paradas en el camino y cada descanso ofrece un premio más para elegir.' },
  wild: { name: 'Rutas salvajes', icon: 'skull', text: 'En cada piso hay una ruta difícil y todos los puntos valen 20 % más.' },
  tutors: { name: 'Temporada de tutores', icon: 'dex', text: 'Las MT y los tutores de movimientos aparecen mucho más entre los premios.' },
  sweet: { name: 'Caramelos de sobra', icon: 'sparkle', text: 'Los caramelos aparecen más seguido y suben un nivel más.' },
  migration: { name: 'Migración', icon: 'ball', text: 'Más madrigueras en el camino: más oportunidades de sumar Pokémon de tu colección.' },
  caps: { name: 'Mercado de chapas', icon: 'cap', text: 'Las Chapas, que llevan un IV al máximo, aparecen mucho más entre los premios.' },
  breeze: { name: 'Brisa tranquila', icon: 'wind', text: 'Las rutas tranquilas aparecen mucho más, y su premio puede ser raro.', hints: { calm: 'Rival más débil. Premio común o raro.' } },
  blackMarket: { name: 'Mercado negro', icon: 'candle', text: 'Los pactos oscuros aparecen el triple: hay más tesoros épicos, pero cada uno cuesta un Pokémon.' },
  items: { name: 'Bazar de objetos', icon: 'bag', text: 'Los objetos para equipar aparecen mucho más entre los premios.' },
  meteor: { name: 'Lluvia de meteoritos', icon: 'star', text: 'Las piedras evolutivas, los Cordones Unión y los Tarros de Caramelos aparecen mucho más entre los premios.' },
  veterans: { name: 'Liga de veteranos', icon: 'shield', text: 'Todos los rivales de ruta vienen entrenados, con naturaleza y EVs a su favor, y los puntos valen 15 % más.' },
  breeding: { name: 'Temporada de crianza', icon: 'clover', text: 'Hay más madrigueras, y los huevos y los movimientos huevo aparecen mucho más entre los premios.' },
  training: { name: 'Campo de entrenamiento', icon: 'target', text: 'Las vitaminas, las plumas y las mentas aparecen mucho más entre los premios.' },
};
export const TWIST_KEYS = Object.keys(TWISTS);

export const ROOMS = {
  trainer: { label: 'Ruta', icon: 'swords', battle: true, hint: 'Un entrenador de la ruta.' },
  tough: { label: 'Ruta difícil', icon: 'skull', battle: true, hint: 'Rival entrenado y 2 niveles más. Premio raro o mejor.' },
  calm: { label: 'Ruta tranquila', icon: 'leaf', battle: true, hint: 'Rival más débil. Premio común.' },
  rest: { label: 'Parada', icon: 'heart', battle: false, hint: 'Sin pelea: dos premios a elegir.' },
  den: { label: 'Madriguera', icon: 'ball', battle: false, hint: 'Sin pelea: recluta uno de tu colección.' },
  hideout: { label: 'Guarida', icon: 'flag', battle: true, hint: 'Un recluta o jefe villano. Premio épico.' },
  deal: { label: 'Pacto oscuro', icon: 'diamond', battle: false, hint: 'Deja ir a uno de tu equipo a cambio de dos premios épicos.' },
};

const SCENE_MUSIC = { 'tall-grass': 'tall_grass', path: 'plains', lake: 'lake', beach: 'beach', mountain: 'mountain', desert: 'desert', cave: 'cave', snow: 'snowy_forest', ocean: 'sea', underwater: 'seabed' };
export const sceneMusic = (scene) => SCENE_MUSIC[String(scene).replace(/-(2|night)$/, '')] ?? 'town';

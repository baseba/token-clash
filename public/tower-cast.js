// Who you meet in the Tower, where and what they say. The server builds each floor from it (trainer,
// types its team uses, scene, music) and the browser draws it. Trainers are the keys of
// public/trainer-sprites.js: their battle sprite and their overworld sprite (public/overworlds/,
// made at install by scripts/sync-overworlds.js) are the same character. A scene is one of our battle
// backgrounds (public/backgrounds.js); the map of a floor is drawn after it.

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
export const PROFESSOR = { key: 'prof_rowan', name: 'Profesor Rowan' };

/** Where a team of each type fights. */
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
  m: ['Tomás', 'Matías', 'Benjamín', 'Vicente', 'Joaquín', 'Agustín', 'Cristóbal', 'Diego', 'Felipe', 'Lucas', 'Maximiliano', 'Gaspar', 'Ignacio', 'Simón', 'Bruno'],
  f: ['Javiera', 'Antonia', 'Catalina', 'Florencia', 'Isidora', 'Martina', 'Josefa', 'Trinidad', 'Amanda', 'Emilia', 'Fernanda', 'Renata', 'Constanza', 'Valentina', 'Paz'],
};

/** What a trainer says when it sees you and when it loses, by the type of its theme. */
export const TYPE_LINES = {
  normal: ['¡Nada de trucos raros! Un buen combate y ya.', 'Bien jugado. Sin trucos y aun así me ganaste.'],
  fire: ['¡Siente el calor! Mis Pokémon no se apagan fácil.', 'Me quemé solito… Tus Pokémon arden más.'],
  water: ['¡Acabo de salir del agua y ya me quiero tirar de nuevo! Pero primero, tú.', 'Me ganaste… Volveré a nadar contra la corriente.'],
  grass: ['Mis Pokémon crecieron al sol de esta ruta. ¡Mira cómo pelean!', 'Hasta la mejor planta necesita más riego.'],
  electric: ['¡Vengo cargado al máximo! ¿Aguantas la descarga?', 'Se me fueron las pilas…'],
  ice: ['Aquí el frío templa a cualquiera. ¿Vienes abrigado?', 'Me congelé en el peor momento… Bien jugado.'],
  fighting: ['¡Hai! Mis puños y mis Pokémon entrenan juntos cada mañana.', '¡Osu! Fue una pelea limpia.'],
  poison: ['Un poquito de veneno nunca le hizo mal a nadie… a mí.', 'Me salió el tiro por la culata.'],
  ground: ['¡Estas tierras me han visto pelear mil veces!', 'Me tragó la tierra…'],
  flying: ['¡Desde arriba se ve todo! Hasta tus errores.', 'Me cortaste las alas.'],
  psychic: ['Ya sabía que vendrías… y que perderías.', 'Mis visiones… se equivocaron.'],
  bug: ['¡Mira lo que atrapé hoy! Bueno, ahora mira cómo pelea.', '¡Mis bichos necesitan más sol!'],
  rock: ['¡Estas cuevas templan a cualquiera! A ver si tus Pokémon aguantan el peso.', '¡Uf! Tus Pokémon pisan más firme que estas rocas.'],
  ghost: ['Shhh… ¿Escuchas eso? Algo te está siguiendo.', 'Los espíritus se fueron contigo…'],
  dragon: ['Los dragones no se rinden. Yo tampoco.', 'Hoy el dragón fuiste tú.'],
  dark: ['¿Perdido? Esta ruta no perdona a los novatos.', 'Está bien, está bien… pasa.'],
  steel: ['Mis Pokémon están hechos para durar. ¿Y los tuyos?', 'Se me oxidó la estrategia.'],
  fairy: ['¡Qué lindos tus Pokémon! Los míos también… y pegan fuerte.', '¡Ay! Ni el encanto me salvó.'],
};

/** Bosses with a voice of their own: [when it sees you, when it loses]. */
export const BOSS_LINES = {
  roark: ['Mis Pokémon de tipo Roca se forjaron en la mina. ¡Muéstrame si los tuyos son de buena piedra!', 'En la mina aprendí a reconocer una buena piedra, y tu equipo tiene temple.'],
  whitney: ['¡Todos dicen que mi Miltank es imparable! ¿Tú qué crees?', '¡Bua! ¡No es justo…! Bueno, ya, te lo ganaste.'],
  candice: ['¡Concentración total! En la nieve se ve quién tiene garra.', '¡Esa concentración sí que la tienes!'],
  brock: ['Mi voluntad es tan dura como la roca. ¡Adelante!', 'Tu determinación es admirable.'],
  misty: ['¡Mi estrategia es el ataque total con Pokémon de agua!', 'Vaya, sí que eres fuerte.'],
  karen: ['Pokémon fuertes, Pokémon débiles… los verdaderos entrenadores ganan con sus favoritos.', 'Así se hace. Sigue con los tuyos.'],
  lance: ['Los dragones son criaturas místicas. ¡Prepárate!', 'Tú y tus Pokémon tienen algo especial.'],
  cynthia: ['Hay algo en cómo te miran tus Pokémon. Quiero verlo de cerca.', 'Hacía tiempo que no sentía algo así en una pelea. Tus Pokémon confían en ti; cuídalo.'],
  steven: ['Me fascinan las piedras raras… y los entrenadores raros. Veamos de qué estás hecho.', 'Eres una piedra preciosa, sin duda.'],
  leon: ['¡Hagamos de esta pelea un campeonato inolvidable!', '¡Qué combate! Esto merece una foto.'],
  iris: ['¡Mis dragones y yo vamos con todo! ¿Listo?', '¡Uf! ¡Eres demasiado fuerte!'],
  diantha: ['Una pelea es un escenario. ¿Brillamos juntos?', 'Qué actuación tan hermosa la tuya.'],
  nemona: ['¡Por fin un rival que vale la pena! ¡Peleemos!', '¡Qué buena pelea! Volvamos a hacerlo pronto.'],
  geeta: ['Como presidenta de la liga, voy a medirte con justicia.', 'Has demostrado tu valía. Sigue así.'],
  iono: ['¡Hola, hola, electrofans! ¡Hoy transmitimos en vivo tu derrota!', '¡Corten, corten! Bueno… ¡igual fue un éxito de audiencia!'],
};

export const PROFESSOR_LINES = {
  hello: 'Así que tú vas a subir la torre. Revisé tu colección y aparté a los que mejor se ven para empezar. Llévate tres… y recuerda: un Pokémon crece al ritmo de quien lo acompaña.',
  picked: 'Buena elección. Ese tiene más de lo que muestra.',
};

export const RECRUIT_LINE = 'Tus Pokémon tienen buen temple. Elige a uno de estos de tu colección para lo que viene.';

/**
 * Between two bosses you choose your way, like the adventure paths of Emerald Rogue: plain, tough or
 * calm trainers, a rest stop, a den to recruit, a villain hideout or a dark deal.
 */
export const ROOMS = {
  trainer: { label: 'Ruta', icon: 'swords', battle: true, hint: 'Un entrenador de la ruta.' },
  tough: { label: 'Ruta difícil', icon: 'skull', battle: true, hint: 'Rival entrenado y 2 niveles más. Premio raro o mejor.' },
  calm: { label: 'Ruta tranquila', icon: 'leaf', battle: true, hint: 'Rival más débil. Premio común.' },
  rest: { label: 'Parada', icon: 'heart', battle: false, hint: 'Sin pelea: dos premios a elegir.' },
  den: { label: 'Madriguera', icon: 'ball', battle: false, hint: 'Sin pelea: recluta uno de tu colección.' },
  hideout: { label: 'Guarida', icon: 'flag', battle: true, hint: 'Un recluta o jefe villano. Premio épico.' },
  deal: { label: 'Pacto oscuro', icon: 'diamond', battle: false, hint: 'Deja ir a uno de tu equipo a cambio de dos premios épicos.' },
};

/** The calm biome track that plays while you look at a floor of each scene (the battle has its own). */
const SCENE_MUSIC = { 'tall-grass': 'tall_grass', path: 'plains', lake: 'lake', beach: 'beach', mountain: 'mountain', desert: 'desert', cave: 'cave', snow: 'snowy_forest', ocean: 'sea', underwater: 'seabed' };
export const sceneMusic = (scene) => SCENE_MUSIC[String(scene).replace(/-(2|night)$/, '')] ?? 'town';

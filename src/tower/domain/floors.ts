// What waits on each floor of the Tower. Between two bosses you choose your way, like the adventure
// paths of Emerald Rogue: each plain floor offers two or three rooms (a trainer, a tough or calm one,
// a rest stop, a den, a villain hideout, a dark deal). Every 5 floors a gym leader, and at the end of
// each block of 25 (or of a shorter climb) four of the Elite Four and a champion. Leaders, Elite Four
// and champions come from every region, never repeated in a climb, each with its type, its scene, its
// region's music and its own words. Levels follow Emerald Rogue: your Pokémon never outgrow the floor
// ahead (a level cap) and bosses fight right at that cap. A plain rival is two levels under it and a
// calm one four; a tough rival and a villain grunt fight at your cap, trained and with one more
// Pokémon, and a villain leader is fought like a boss. Difficulty moves levels by one at most; it
// trains more rivals and sharpens the AI. Route trainers are of every class: typed ones (a Hiker, a
// Swimmer), rookies on calm ways and seasoned ones (an Ace Trainer, your rival) on tough ones.
import type { AiLevel } from '../../combat/domain/ai.js';
import { hash, rng, shuffled, speciesData, speciesIdByName } from '../../catalog/domain/creatures.js';
import { CLASS_TRAINERS, SIGNATURE, STARTER_IDS, type ClassTrainer } from '../../catalog/domain/trainer-goals.js';
import { CHAMPIONS, ELITE_FOUR, GYM_LEADERS, TRAINER_VARIANTS, VILLAINS } from '../../catalog/domain/trainer-sprites.js';
import {
  BOSS_LINES,
  CLASS_LINES,
  ELITE_FLOORS,
  FEMALE_CLASSES,
  GYM_EVERY,
  LEAGUE_BLOCK,
  MAX_LEVEL,
  MUSIC,
  NAMED_CLASSES,
  NAMES,
  PAIR_CLASSES,
  PAIR_LINES,
  REGIONS,
  ROOM_LINES,
  ROOMS,
  ROUTE_SCENES,
  START_LEVEL,
  TYPE_LINES,
  TYPE_SCENES,
  VILLAIN_LINES,
  type Line,
  type Region,
  type RoomKind,
  type TwistKey,
} from '../../catalog/domain/tower-cast.js';

export type FloorKind = 'trainer' | 'gym' | 'elite' | 'champion';
export type Strength = 'weak' | 'normal' | 'strong';

export interface Foe {
  /** The trainer sprite (a colour variant or the original). */
  key: string;
  base: string;
  name: string;
  title: string;
}

export interface Floor {
  number: number;
  kind: FloorKind;
  room: RoomKind | null;
  foe: Foe | null;
  type: string | null;
  types: readonly string[];
  /** Species a themed class always brings (a team's grunts, a Harlequin's Mr. Mime…). */
  species: readonly number[];
  /** The boss's ace, as a fully evolved species. */
  signature: number | null;
  scene: string;
  music: string;
  level: number;
  teamSize: number;
  trained: boolean;
  /** Which part of the theme's species it draws from: the weakest, any, or the strongest. */
  strength: Strength;
  lines: { hello: string; lose: string };
}

const LEVELS_PER_FLOOR = 1.9;
const BOSS_LEVELS: Record<FloorKind, number> = { trainer: 0, gym: 0, elite: 0, champion: 1 };
/** How many levels under your cap each way's rival fights: a tough one and a villain right at it. */
const LEVELS_BELOW: Partial<Record<RoomKind, number>> = { trainer: 2, calm: 4, tough: 0, hideout: 0 };
/** A villain leader (an admin or a boss) fights one level over a grunt, like a gym leader at its best. */
const LEADER_LEVELS = 1;
/** From this floor a villain boss may wait in a hideout; from the next, a legend among them. */
const LEGENDS_IN_HIDEOUT_FROM = 30;
/** How often a way's rival is of a class with no type of its own instead of a typed one. */
const MIXED_CHANCE: Partial<Record<RoomKind, number>> = { trainer: 0.2, calm: 0.4, tough: 0.35 };
const ROOM_STRENGTH: Partial<Record<RoomKind, Strength>> = { tough: 'strong', calm: 'weak', hideout: 'strong' };
const DIFFICULTY_LEVELS: Record<AiLevel, number> = { easy: -1, mid: 0, hard: 0, veryhard: 1, skynet: 1 };
/** From which floor each difficulty trains its plain route rivals (natures and EVs). */
const ROUTES_TRAINED_FROM: Record<AiLevel, number> = { easy: Infinity, mid: Infinity, hard: 10, veryhard: 1, skynet: 1 };
/** From which floor each difficulty trains its bosses. */
const BOSSES_TRAINED_FROM: Record<AiLevel, number> = { easy: Infinity, mid: 10, hard: 1, veryhard: 1, skynet: 1 };
const WARM_UP_FLOORS = 2;
/** Before this level a party knows little more than Normal moves: no Ghost-themed rival. */
const GHOSTS_FROM_LEVEL = 15;
const LATE_FLOOR = 20;
const ROOM_WEIGHTS: [RoomKind, number][] = [['tough', 30], ['calm', 18], ['rest', 20], ['den', 14], ['hideout', 10], ['deal', 6]];
/** How a climb's rumour changes the odds of each way. */
const TWIST_WEIGHTS: Partial<Record<TwistKey, Partial<Record<RoomKind, number>>>> = { night: { hideout: 2 }, market: { rest: 2 }, migration: { den: 2.5 } };
/** Scenes with a night version among our battle backgrounds. */
const NIGHT_SCENES = ['beach', 'cave', 'desert', 'lake', 'mountain', 'ocean', 'path', 'snow', 'tall-grass'];
const WAY_ORDER: readonly RoomKind[] = ['trainer', 'tough', 'calm', 'hideout'];
const EARLY_ROOMS: readonly RoomKind[] = ['tough', 'calm', 'rest', 'den'];
const FEMALE = new Set([
  'misty', 'erika', 'janine', 'sabrina', 'lorelei', 'agatha', 'whitney', 'jasmine', 'clair', 'karen', 'roxanne', 'flannery', 'winona', 'liza', 'phoebe', 'glacia',
  'gardenia', 'maylene', 'fantina', 'candice', 'bertha', 'cynthia', 'lenora', 'elesa', 'skyla', 'iris', 'roxie', 'shauntal', 'caitlin', 'viola', 'korrina', 'valerie',
  'olympia', 'malva', 'drasna', 'diantha', 'olivia', 'acerola', 'kahili', 'nessa', 'bea', 'opal', 'melony', 'katy', 'iono', 'tulip', 'rika', 'poppy', 'geeta',
  'nemona', 'amarys', 'lacey', 'courtney', 'shelly', 'tabitha', 'mars', 'jupiter', 'ariana', 'bryony', 'aliana', 'celosia', 'mable', 'plumeria', 'lusamine', 'oleana',
  'penny', 'mela', 'eri', 'cheryl', 'mira', 'marley', 'mysterious_sisters', 'twins', 'sis_and_bro',
]);

const REGION_OF = new Map<string, Region>(Object.entries(REGIONS).flatMap(([region, keys]) => keys.map((key) => [key, region as Region] as const)));
const regionOf = (key: string): Region => REGION_OF.get(key) ?? 'kanto';
const isFemale = (key: string): boolean => key.endsWith('_f') || FEMALE.has(key) || FEMALE_CLASSES.includes(key);
const pick = <T>(list: readonly T[], seed: string): T => list[hash(seed) % list.length];

const NAME_FIXES: Record<string, string> = { lt_surge: 'Lt. Surge', crasher_wake: 'Crasher Wake', rocket_boss_giovanni_1: 'Giovanni' };
export const displayName = (key: string): string => NAME_FIXES[key] ?? key.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');

function variantOf(base: string, seed: string): string {
  const options = TRAINER_VARIANTS.filter((variant) => variant.base === base && !variant.pokemon).map((variant) => variant.key);
  return options.length && hash(`${seed}:look`) % 2 ? pick(options, `${seed}:variant`) : base;
}

/** The level of the floor: the rivals' base and the most your Pokémon can reach before fighting it. */
export const levelCap = (floor: number): number => Math.min(MAX_LEVEL, Math.round(START_LEVEL + (floor - 1) * LEVELS_PER_FLOOR));

/** Where the rivals of a stretch between bosses start: the cap of the last boss, or below your starters before the first. */
export function stretchStart(floor: number): number {
  const lastBoss = Math.floor((floor - 1) / GYM_EVERY) * GYM_EVERY;
  return lastBoss ? levelCap(lastBoss) : START_LEVEL - 2;
}

export function foeLevel(floor: number, kind: FloorKind, difficulty: AiLevel, room: RoomKind | null = null): number {
  const cap = levelCap(floor);
  const start = Math.min(stretchStart(floor), cap);
  const route = Math.max(start, cap - (LEVELS_BELOW[room ?? 'trainer'] ?? LEVELS_BELOW.trainer!));
  const level = kind === 'trainer' ? route : cap + BOSS_LEVELS[kind];
  return Math.min(MAX_LEVEL, Math.max(2, level + DIFFICULTY_LEVELS[difficulty]));
}

/**
 * The floor against the party you bring: no route rival above your strongest Pokémon, and no boss nor
 * villain leader more than one over it. The curve keeps the party at the cap; this keeps a party that
 * fell behind (a dark deal, a climb with few battles) from meeting rivals it cannot reach.
 */
export function fitToParty(floor: Floor, partyLevels: readonly number[]): Floor {
  if (!partyLevels.length) return floor;
  const ceiling = Math.max(...partyLevels) + (isLeader(floor) ? LEADER_LEVELS : 0);
  return floor.level > ceiling ? { ...floor, level: Math.max(2, ceiling) } : floor;
}

/** A boss, or a villain admin or boss waiting in a hideout: it brings its ace and fights like one. */
export const isLeader = (floor: Pick<Floor, 'kind' | 'room' | 'signature'>): boolean => isBoss(floor.kind) || (floor.room === 'hideout' && floor.signature !== null);

/** Always at least the 3 a battle takes; later rivals bring more, so they also choose. A tough rival brings one more, a calm one just 3. */
export function teamSize(floor: number, kind: FloorKind, room: RoomKind | null = null): number {
  if (kind === 'champion' || kind === 'elite') return 6;
  if (kind === 'gym') return floor <= 5 ? 3 : floor <= 15 ? 4 : floor <= 20 ? 5 : 6;
  if (room === 'calm') return 3;
  return Math.min(6, 3 + (floor >= 10 ? 1 : 0) + (floor >= 25 ? 1 : 0) + (room === 'tough' || room === 'hideout' ? 1 : 0));
}

function championFloor(floor: number, length: number | null): number {
  const blockEnd = Math.ceil(floor / LEAGUE_BLOCK) * LEAGUE_BLOCK;
  return length === null ? blockEnd : Math.min(blockEnd, length);
}

export function floorKind(floor: number, length: number | null): FloorKind {
  const champion = championFloor(floor, length);
  if (floor === champion) return 'champion';
  if (champion - floor <= ELITE_FLOORS && champion % LEAGUE_BLOCK === 0) return 'elite';
  return floor % GYM_EVERY === 0 ? 'gym' : 'trainer';
}

/** The rooms a plain floor offers: always a trainer, and one or two other ways. */
/** What a floor's draw is made of: the climb, and the roll made when you reached that floor. */
export type Rolls = Readonly<Record<number, string>>;
const drawOf = (seed: string, rolls: Rolls, floor: number): string => (rolls[floor] ? `${seed}:${rolls[floor]}` : seed);

export function roomsAt(floor: number, length: number | null, seed: string, rolls: Rolls = {}, twist: TwistKey | null = null): RoomKind[] {
  if (floorKind(floor, length) !== 'trainer') return [];
  const random = rng(`${drawOf(seed, rolls, floor)}:rooms:${floor}`);
  const boost = (twist && TWIST_WEIGHTS[twist]) ?? {};
  const pool = ROOM_WEIGHTS.filter(([room]) => floor > WARM_UP_FLOORS || EARLY_ROOMS.includes(room)).map(([room, weight]): [RoomKind, number] => [room, weight * (boost[room] ?? 1)]);
  const rooms: RoomKind[] = ['trainer'];
  if (twist === 'wild') rooms.push(pool.splice(pool.findIndex(([room]) => room === 'tough'), 1)[0][0]);
  const extra = random() < 0.5 ? 2 : 1;
  while (rooms.length < Math.max(1 + extra, twist === 'wild' ? 2 : 0) && pool.length) {
    const total = pool.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = random() * total;
    const index = pool.findIndex(([, weight]) => (roll -= weight) <= 0);
    rooms.push(pool.splice(Math.max(0, index), 1)[0][0]);
  }
  return rooms;
}

const typedClasses = Object.entries(CLASS_TRAINERS).filter(([key, cls]) => (cls.goal.kind === 'type' || cls.goal.kind === 'species') && !key.includes('_grunt') && cls.rarity !== 'legendary');
const ROOKIES = ['youngster', 'school_kid', 'preschooler', 'nursery_aide'];
const SEASONED = ['ace_trainer', 'veteran', 'rival', 'player', 'nate', 'rosa', 'victor', 'victoria', 'benga'];
const mixedOf = (bases: readonly string[]) => Object.entries(CLASS_TRAINERS).filter(([key]) => bases.some((base) => key === base || key.startsWith(`${base}_`)));
/** Classes with no type of their own, by the way they fit: rookies on a calm way, seasoned ones on a tough one, the rest anywhere. */
const MIXED_CLASSES: Partial<Record<RoomKind, [string, ClassTrainer][]>> = {
  calm: mixedOf(ROOKIES),
  tough: mixedOf(SEASONED),
  trainer: Object.entries(CLASS_TRAINERS).filter(([key, cls]) => (cls.goal.kind === 'total' || cls.goal.kind === 'starter') && !mixedOf([...ROOKIES, ...SEASONED]).some(([other]) => other === key)),
};
const villainClasses = Object.entries(CLASS_TRAINERS).filter(([key, cls]) => key.includes('_grunt') && cls.goal.kind !== 'total');
const speciesOf = (names: readonly string[]): number[] => names.map((name) => speciesIdByName(name)).filter((id): id is number => !!id);
/** The ace of a villain in its hideout: its signature, or the one it is known for when it has none (Team Star's bosses each their own). */
const HIDEOUT_ACES: Readonly<Record<string, string>> = {
  proton: 'Golbat', zinzolin: 'Cryogonal', rood: 'Swoobat', xerosic: 'Crawdaunt', bryony: 'Liepard', aliana: 'Mightyena', celosia: 'Manectric',
  mable: 'Houndoom', oleana: 'Garbodor', penny: 'Sylveon', giacomo: 'Kingambit', ortega: 'Azumarill', eri: 'Annihilape',
};
const signatureOf = (key: string): number | null => (SIGNATURE[key] ? speciesIdByName(SIGNATURE[key]) : null);
const hideoutAceOf = (key: string): number | null => (HIDEOUT_ACES[key] ? speciesIdByName(HIDEOUT_ACES[key]) : signatureOf(key));
const typesOfSpecies = (ids: readonly number[]): string[] => [...new Set(ids.flatMap((id) => speciesData(id)?.types ?? []))];

const classBase = (key: string): string => key.replace(/_(m|f)(_\d+)?$|_\d+$/, '');
const agree = (text: string, female: boolean): string => text.replaceAll('{o}', female ? 'a' : 'o');

/** What a trainer says: a boss its own words; others, by its class, its team, the way you took or the type of its theme. */
function linesFor(key: string, type: string | null, at: string, room: RoomKind | null = null): { hello: string; lose: string } {
  const own = BOSS_LINES[key];
  if (own) return { hello: own[0], lose: own[1] };
  const team = key.includes('_grunt') ? VILLAIN_LINES[key.split('_')[0]] : null;
  const typed = TYPE_LINES[type ?? 'normal'] ?? TYPE_LINES.normal;
  const voices: readonly Line[] = PAIR_CLASSES[key]
    ? PAIR_LINES
    : team ?? (room && ROOM_LINES[room] && hash(`${at}:mood`) % 2 ? ROOM_LINES[room] : hash(`${at}:voice`) % 2 && CLASS_LINES[classBase(key)] ? CLASS_LINES[classBase(key)] : typed);
  const [hello, lose] = pick(voices, `${at}:line`);
  return { hello: agree(hello, isFemale(key)), lose: agree(lose, isFemale(key)) };
}

/** A route trainer's name, from lists shuffled once per climb so names rarely repeat; two names for a pair. */
function nameFor(key: string, seed: string, floor: number, room: RoomKind | null): string {
  if (NAMED_CLASSES[key]) return NAMED_CLASSES[key];
  const slot = floor * WAY_ORDER.length + Math.max(0, WAY_ORDER.indexOf(room ?? 'trainer'));
  const nameAt = (gender: 'm' | 'f', offset: number) => {
    const list = shuffled([...NAMES[gender]], rng(`${seed}:names:${gender}`));
    return list[(slot * 2 + offset) % list.length];
  };
  const pair = PAIR_CLASSES[key];
  if (pair) return `${nameAt(pair[0] as 'm' | 'f', 0)} y ${nameAt(pair[1] as 'm' | 'f', 1)}`;
  return nameAt(isFemale(key) ? 'f' : 'm', 0);
}

const nightOf = (scene: string): string => {
  const base = scene.replace(/-(2|night)$/, '');
  return NIGHT_SCENES.includes(base) ? `${base}-night` : scene;
};

function sceneFor(type: string | null, seed: string, fallback: string): string {
  const scenes = type ? TYPE_SCENES[type] : null;
  return scenes?.length ? pick(scenes, `${seed}:scene`) : fallback;
}

const themeOf = ([, cls]: (typeof typedClasses)[number]): string =>
  (cls.goal.kind === 'type' ? [cls.goal.type] : typesOfSpecies(speciesOf(cls.goal.kind === 'species' ? cls.goal.names : []))).sort().join();

/** The class of a floor's route trainer, never of the theme of the floor below nor, for another way, of the plain route's. */
function classAt(seed: string, rolls: Rolls, floor: number, room: RoomKind | null, level: number): (typeof typedClasses)[number] {
  const indexAt = (number: number, way: RoomKind | null) => hash(`${drawOf(seed, rolls, number)}:${number}${way && way !== 'trainer' ? `:${way}` : ''}:class`) % typedClasses.length;
  const avoid = new Set([floor > 1 ? themeOf(typedClasses[indexAt(floor - 1, null)]) : '', room && room !== 'trainer' ? themeOf(typedClasses[indexAt(floor, null)]) : ''].filter(Boolean));
  let index = indexAt(floor, room);
  const unfit = (entry: (typeof typedClasses)[number]) => avoid.has(themeOf(entry)) || (level < GHOSTS_FROM_LEVEL && themeOf(entry).includes('ghost'));
  for (let tries = 0; tries < typedClasses.length && unfit(typedClasses[index]); tries++) index = (index + 1) % typedClasses.length;
  return typedClasses[index];
}

/**
 * Whether a way's rival is of a class with no type of its own. Never two in a row: not when the plain
 * route below had one, nor on another way when this floor's plain route has one.
 */
function takesMixed(seed: string, rolls: Rolls, floor: number, room: RoomKind | null): boolean {
  const way = room ?? 'trainer';
  const rolled = (number: number, option: RoomKind) =>
    !!MIXED_CLASSES[option]?.length && rng(`${drawOf(seed, rolls, number)}:${number}${option === 'trainer' ? '' : `:${option}`}:mixed`)() < (MIXED_CHANCE[option] ?? 0);
  if (!rolled(floor, way)) return false;
  return way === 'trainer' ? floor <= 1 || !rolled(floor - 1, 'trainer') : !rolled(floor, 'trainer');
}

const routeScene = (floor: number): string => ROUTE_SCENES[Math.floor((floor - 1) / GYM_EVERY) % ROUTE_SCENES.length];

/** A rival or a protagonist brings one of the starters of its region (any, when it has none). */
function starterOf(goal: ClassTrainer['goal'], at: string): number[] {
  if (goal.kind !== 'starter') return [];
  const [first] = goal.region ? STARTER_IDS[goal.region] : pick(Object.values(STARTER_IDS), `${at}:region`);
  return [first + 3 * (hash(`${at}:starter`) % 3)];
}

function themedTrainer(key: string, cls: ClassTrainer, at: string, seed: string, floor: number, room: RoomKind | null) {
  const species = cls.goal.kind === 'species' ? speciesOf(cls.goal.names) : starterOf(cls.goal, at);
  const types = cls.goal.kind === 'type' ? [cls.goal.type] : cls.goal.kind === 'species' ? typesOfSpecies(species) : [];
  const name = nameFor(key, seed, floor, room);
  const title = cls.title === name ? (isFemale(key) ? 'Entrenadora' : 'Entrenador') : cls.title;
  return { foe: { key: variantOf(key, at), base: key, name, title }, species, types };
}

/** Route trainers and ways come from the floor's roll; the order of bosses is fixed for the climb so none repeats. */
export function floorAt(floor: number, length: number | null, difficulty: AiLevel, seed: string, room: RoomKind | null = null, rolls: Rolls = {}, twist: TwistKey | null = null): Floor {
  const drawn = drawFloor(floor, length, difficulty, seed, room, rolls);
  return twist === 'night' ? { ...drawn, scene: nightOf(drawn.scene) } : drawn;
}

function drawFloor(floor: number, length: number | null, difficulty: AiLevel, seed: string, room: RoomKind | null, rolls: Rolls): Floor {
  const kind = floorKind(floor, length);
  const chosen: RoomKind | null = kind === 'trainer' ? (room ?? 'trainer') : null;
  const at = `${drawOf(seed, rolls, floor)}:${floor}${chosen && chosen !== 'trainer' ? `:${chosen}` : ''}`;
  const base = {
    number: floor,
    kind,
    room: chosen,
    level: foeLevel(floor, kind, difficulty, chosen),
    teamSize: teamSize(floor, kind, chosen),
    trained: kind === 'trainer' ? chosen === 'tough' || chosen === 'hideout' || (chosen !== 'calm' && floor >= ROUTES_TRAINED_FROM[difficulty]) : floor >= BOSSES_TRAINED_FROM[difficulty],
    strength: kind === 'trainer' ? (ROOM_STRENGTH[chosen ?? 'trainer'] ?? 'normal') : 'strong',
  };
  if (chosen && !ROOMS[chosen].battle)
    return { ...base, foe: null, type: null, types: [], species: [], signature: null, scene: routeScene(floor), music: MUSIC.route, lines: { hello: '', lose: '' } };
  if (chosen === 'hideout') {
    if (hash(`${at}:boss`) % 3 === 0) {
      const bosses = [...VILLAINS.boss, ...(floor >= LEGENDS_IN_HIDEOUT_FROM ? VILLAINS.legend : [])];
      const key = pick([...VILLAINS.admin, ...VILLAINS.star, ...(floor >= LATE_FLOOR ? bosses : [])], `${at}:villain`);
      const ace = hideoutAceOf(key);
      const types = ace ? [...(speciesData(ace)?.types ?? [])] : ['dark'];
      const leader = { ...base, level: base.level + LEADER_LEVELS, teamSize: Math.min(6, base.teamSize + 1) };
      return { ...leader, foe: { key: variantOf(key, at), base: key, name: displayName(key), title: bosses.includes(key) ? (isFemale(key) ? 'Jefa' : 'Jefe') : VILLAINS.star.includes(key) ? 'Jefe de escuadrón' : 'Comandante' }, type: types[0] ?? null, types, species: [], signature: ace, scene: pick(['path-night', 'cave-night', 'beach-night'], at), music: MUSIC.hideout, lines: linesFor(key, 'dark', at) };
    }
    const [key, cls] = pick(villainClasses, `${at}:grunt`);
    const { foe, species, types } = themedTrainer(key, cls, at, seed, floor, chosen);
    return { ...base, foe, type: null, types, species, signature: null, scene: pick(['path-night', 'cave-night'], at), music: MUSIC.hideout, lines: linesFor(key, 'dark', at) };
  }
  if (kind === 'trainer') {
    const [key, cls] = takesMixed(seed, rolls, floor, chosen) ? pick(MIXED_CLASSES[chosen ?? 'trainer']!, `${at}:mixed-class`) : classAt(seed, rolls, floor, chosen, base.level);
    const { foe, species, types } = themedTrainer(key, cls, at, seed, floor, chosen);
    return { ...base, foe, type: null, types, species, signature: null, scene: sceneFor(types[0] ?? null, at, routeScene(floor)), music: floor >= LATE_FLOOR ? MUSIC.lateRoute : MUSIC.route, lines: linesFor(key, types[0] ?? null, at, chosen) };
  }
  const block = Math.floor((floor - 1) / LEAGUE_BLOCK);
  let key: string;
  let type: string | null = null;
  if (kind === 'gym') {
    const leaders = shuffled(Object.entries(GYM_LEADERS).flatMap(([t, keys]) => keys.map((k) => [k, t] as const)), rng(`${seed}:gyms`));
    [key, type] = leaders[(Math.floor(floor / GYM_EVERY) - 1) % leaders.length];
  } else if (kind === 'elite') {
    const elite = shuffled(Object.entries(ELITE_FOUR), rng(`${seed}:elite:${block}`));
    [key, type] = elite[(ELITE_FLOORS - (championFloor(floor, length) - floor)) % elite.length];
  } else key = shuffled(CHAMPIONS, rng(`${seed}:champions`))[block % CHAMPIONS.length];
  const title = kind === 'gym' ? 'Líder' : kind === 'elite' ? 'Alto Mando' : isFemale(key) ? 'Campeona' : 'Campeón';
  return {
    ...base,
    foe: { key: variantOf(key, at), base: key, name: displayName(key), title },
    type,
    types: type ? [type] : [],
    species: [],
    signature: signatureOf(key),
    scene: kind === 'champion' ? pick(['snow-night', 'cave-2', 'mountain-night'], at) : sceneFor(type, at, 'path'),
    music: MUSIC[kind][regionOf(key)],
    lines: linesFor(key, type, at),
  };
}

export const isBoss = (kind: FloorKind): boolean => kind !== 'trainer';
export const isLastFloor = (floor: number, length: number | null): boolean => length !== null && floor >= length;

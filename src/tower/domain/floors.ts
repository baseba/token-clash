import type { AiLevel } from '../../combat/domain/ai.js';
import { speciesData, speciesIdByName } from '../../catalog/domain/creatures.js';
import { hash, rng, shuffled } from '../../shared/domain/random.js';
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
  species: readonly number[];
  signature: number | null;
  scene: string;
  music: string;
  level: number;
  teamSize: number;
  trained: boolean;
  strength: Strength;
  lines: FloorLines;
}

export interface FloorLines {
  hello: string;
  lose: string;
  win: string;
}

const LEVELS_PER_FLOOR = 1.9;
const BOSS_LEVELS: Record<FloorKind, number> = { trainer: 0, gym: 0, elite: 0, champion: 1 };
const LEVELS_BELOW: Partial<Record<RoomKind, number>> = { trainer: 2, calm: 4, tough: 0, hideout: 0 };
const LEADER_LEVELS = 1;
const LEGENDS_IN_HIDEOUT_FROM = 30;
const MIXED_CHANCE: Partial<Record<RoomKind, number>> = { trainer: 0.2, calm: 0.4, tough: 0.35 };
const ROOM_STRENGTH: Partial<Record<RoomKind, Strength>> = { tough: 'strong', calm: 'weak', hideout: 'strong' };
const DIFFICULTY_LEVELS: Record<AiLevel, number> = { easy: -1, mid: 0, hard: 0, veryhard: 1, skynet: 1 };
const ROUTES_TRAINED_FROM: Record<AiLevel, number> = { easy: Infinity, mid: Infinity, hard: 10, veryhard: 1, skynet: 1 };
const BOSSES_TRAINED_FROM: Record<AiLevel, number> = { easy: Infinity, mid: 10, hard: 1, veryhard: 1, skynet: 1 };
const WARM_UP_FLOORS = 2;
const GHOSTS_FROM_LEVEL = 15;
const LATE_FLOOR = 20;
const ROOM_WEIGHTS: [RoomKind, number][] = [['tough', 30], ['calm', 18], ['rest', 20], ['den', 14], ['hideout', 10], ['deal', 6]];
const TWIST_WEIGHTS: Partial<Record<TwistKey, Partial<Record<RoomKind, number>>>> = { night: { hideout: 2 }, market: { rest: 2 }, migration: { den: 2.5 }, breeze: { calm: 2.5 }, blackMarket: { deal: 3 }, breeding: { den: 1.5 } };
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

export const levelCap = (floor: number): number => Math.min(MAX_LEVEL, Math.round(START_LEVEL + (floor - 1) * LEVELS_PER_FLOOR));

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

export function fitToParty(floor: Floor, partyLevels: readonly number[]): Floor {
  if (!partyLevels.length) return floor;
  const ceiling = Math.max(...partyLevels) + (isLeader(floor) ? LEADER_LEVELS : 0);
  return floor.level > ceiling ? { ...floor, level: Math.max(2, ceiling) } : floor;
}

export const isLeader = (floor: Pick<Floor, 'kind' | 'room' | 'signature'>): boolean => isBoss(floor.kind) || (floor.room === 'hideout' && floor.signature !== null);

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

export type Rolls = Readonly<Record<number, string>>;
const drawOf = (seed: string, rolls: Rolls, floor: number): string => (rolls[floor] ? `${seed}:${rolls[floor]}` : seed);

const extraWays = (roll: number): number => (roll < 0.5 ? 2 : roll < 0.8 ? 3 : 4);
const BOTH_ROUTES_AFTER_DETOUR = 0.45;

export const DETOURS: readonly RoomKind[] = ['rest', 'den', 'deal', 'hideout'];
const FLOORS_WITHOUT_DETOURS = 2;

export function detoursOffered(floor: number, length: number | null, detourAt: number | null): boolean {
  if (detourAt === null) return true;
  let plainFloors = 0;
  for (let between = detourAt + 1; between < floor; between++) if (floorKind(between, length) === 'trainer') plainFloors++;
  return plainFloors >= FLOORS_WITHOUT_DETOURS;
}

export function roomsAt(floor: number, length: number | null, seed: string, rolls: Rolls = {}, twist: TwistKey | null = null, detourAt: number | null = null): RoomKind[] {
  if (floorKind(floor, length) !== 'trainer') return [];
  const random = rng(`${drawOf(seed, rolls, floor)}:rooms:${floor}`);
  const boost = (twist && TWIST_WEIGHTS[twist]) ?? {};
  const detours = detoursOffered(floor, length, detourAt);
  const pool = ROOM_WEIGHTS.filter(([room]) => (floor > WARM_UP_FLOORS || EARLY_ROOMS.includes(room)) && (detours || !DETOURS.includes(room))).map(([room, weight]): [RoomKind, number] => [room, weight * (boost[room] ?? 1)]);
  const rooms: RoomKind[] = ['trainer'];
  if (twist === 'wild') rooms.push(pool.splice(pool.findIndex(([room]) => room === 'tough'), 1)[0][0]);
  const roll = random();
  const extra = detours ? extraWays(roll) : roll < BOTH_ROUTES_AFTER_DETOUR ? 2 : 1;
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
const MIXED_CLASSES: Partial<Record<RoomKind, [string, ClassTrainer][]>> = {
  calm: mixedOf(ROOKIES),
  tough: mixedOf(SEASONED),
  trainer: Object.entries(CLASS_TRAINERS).filter(([key, cls]) => (cls.goal.kind === 'total' || cls.goal.kind === 'starter') && !mixedOf([...ROOKIES, ...SEASONED]).some(([other]) => other === key)),
};
const villainClasses = Object.entries(CLASS_TRAINERS).filter(([key, cls]) => key.includes('_grunt') && cls.goal.kind !== 'total');
const speciesOf = (names: readonly string[]): number[] => names.map((name) => speciesIdByName(name)).filter((id): id is number => !!id);
const HIDEOUT_ACES: Readonly<Record<string, string>> = {
  proton: 'Golbat', zinzolin: 'Cryogonal', rood: 'Swoobat', xerosic: 'Crawdaunt', bryony: 'Liepard', aliana: 'Mightyena', celosia: 'Manectric',
  mable: 'Houndoom', oleana: 'Garbodor', penny: 'Sylveon', giacomo: 'Kingambit', ortega: 'Azumarill', eri: 'Annihilape',
};
const aceNamed = (name: string | undefined): number | null => (name ? speciesIdByName(name) : null) ?? null;
const signatureOf = (key: string): number | null => aceNamed(SIGNATURE[key]);
const hideoutAceOf = (key: string): number | null => aceNamed(HIDEOUT_ACES[key] ?? SIGNATURE[key]);
const typesOfSpecies = (ids: readonly number[]): string[] => [...new Set(ids.flatMap((id) => speciesData(id)?.types ?? []))];

const classBase = (key: string): string => key.replace(/_(m|f)(_\d+)?$|_\d+$/, '');
const agree = (text: string, female: boolean): string => text.replaceAll('{o}', female ? 'a' : 'o');

function linesFor(key: string, type: string | null, at: string, room: RoomKind | null = null): FloorLines {
  const own = BOSS_LINES[key] ?? (key.includes('_grunt') ? VILLAIN_LINES[key.split('_')[0]] : null);
  const typed = TYPE_LINES[type ?? 'normal'] ?? TYPE_LINES.normal;
  const roomVoice = room === 'tough' || room === 'calm' ? ROOM_LINES[room] : null;
  const classVoice = CLASS_LINES[classBase(key)];
  const voices: readonly Line[] =
    own ?? (classVoice && hash(`${at}:voice`) % 2 ? classVoice : PAIR_CLASSES[key] ? PAIR_LINES : roomVoice && hash(`${at}:mood`) % 2 ? roomVoice : typed);
  const [hello, lose, win] = pick(voices, `${at}:line`).map((text) => agree(text, isFemale(key)));
  return { hello, lose, win };
}

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

function classAt(seed: string, rolls: Rolls, floor: number, room: RoomKind | null, level: number): (typeof typedClasses)[number] {
  const indexAt = (number: number, way: RoomKind | null) => hash(`${drawOf(seed, rolls, number)}:${number}${way && way !== 'trainer' ? `:${way}` : ''}:class`) % typedClasses.length;
  const avoid = new Set([floor > 1 ? themeOf(typedClasses[indexAt(floor - 1, null)]) : '', room && room !== 'trainer' ? themeOf(typedClasses[indexAt(floor, null)]) : ''].filter(Boolean));
  let index = indexAt(floor, room);
  const unfit = (entry: (typeof typedClasses)[number]) => avoid.has(themeOf(entry)) || (level < GHOSTS_FROM_LEVEL && themeOf(entry).includes('ghost'));
  for (let tries = 0; tries < typedClasses.length && unfit(typedClasses[index]); tries++) index = (index + 1) % typedClasses.length;
  return typedClasses[index];
}

function takesMixed(seed: string, rolls: Rolls, floor: number, room: RoomKind | null): boolean {
  const way = room ?? 'trainer';
  const rolled = (number: number, option: RoomKind) =>
    !!MIXED_CLASSES[option]?.length && rng(`${drawOf(seed, rolls, number)}:${number}${option === 'trainer' ? '' : `:${option}`}:mixed`)() < (MIXED_CHANCE[option] ?? 0);
  if (!rolled(floor, way)) return false;
  return way === 'trainer' ? floor <= 1 || !rolled(floor - 1, 'trainer') : !rolled(floor, 'trainer');
}

const routeScene = (floor: number): string => ROUTE_SCENES[Math.floor((floor - 1) / GYM_EVERY) % ROUTE_SCENES.length];

function starterOf(goal: ClassTrainer['goal'], at: string): number[] {
  if (goal.kind !== 'starter') return [];
  const own = goal.region ? STARTER_IDS[goal.region] : null;
  const [first] = own ?? pick(Object.values(STARTER_IDS), `${at}:region`);
  return [first + 3 * (hash(`${at}:starter`) % 3)];
}

function themedTrainer(key: string, cls: ClassTrainer, at: string, seed: string, floor: number, room: RoomKind | null) {
  const named = cls.goal.kind === 'species' ? speciesOf(cls.goal.names) : starterOf(cls.goal, at);
  const types = cls.goal.kind === 'type' ? [cls.goal.type] : cls.goal.kind === 'species' ? typesOfSpecies(named) : [];
  const name = nameFor(key, seed, floor, room);
  const title = cls.title === name ? (isFemale(key) ? 'Entrenadora' : 'Entrenador') : cls.title;
  return { foe: { key: variantOf(key, at), base: key, name, title }, species: named, types };
}

export function floorAt(floor: number, length: number | null, difficulty: AiLevel, seed: string, room: RoomKind | null = null, rolls: Rolls = {}, twist: TwistKey | null = null): Floor {
  const drawn = drawFloor(floor, length, difficulty, seed, room, rolls);
  if (twist === 'night') return { ...drawn, scene: nightOf(drawn.scene) };
  if (twist === 'veterans' && drawn.foe) return { ...drawn, trained: true };
  return drawn;
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
    return { ...base, foe: null, type: null, types: [], species: [], signature: null, scene: routeScene(floor), music: MUSIC.route, lines: { hello: '', lose: '', win: '' } };
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

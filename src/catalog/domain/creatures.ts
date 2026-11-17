// Creatures. Everything comes from PokeAPI (https://pokeapi.co), downloaded into the game by
// scripts/import-pokeapi.mjs: src/catalog/data/pokeapi.json holds the name, base stats, real types
// and evolution placement of every species, and public/sprites/ holds each species' official
// front/back sprites by dex number. The server never calls PokeAPI (production has no egress). The
// type chart and labels live in public/types.js, shared with the browser. src/catalog/data/movedex.json
// holds every learnable move.

import { readFileSync } from 'node:fs';
import { catalogFile } from '../../shared/paths.js';
import { effectiveness } from './type-chart.js';
import { abilityInfo, knownAbility, INERT, type AbilityInfo } from './abilities.js';
import { MOVE_RULES, IMPOSSIBLE_MOVES } from './move-rules.js';
import type { Gender, Ivs, Rarity, RosterEntry } from './roster-entry.js';

export { effectiveness };

// ---------- shapes ----------

export type StatKey = 'hp' | 'atk' | 'def' | 'satk' | 'sdef' | 'spd';
export type Stats = Record<StatKey, number>;
export type BoostKey = 'atk' | 'def' | 'satk' | 'sdef' | 'spd' | 'acc' | 'eva';
export type Boosts = Partial<Record<BoostKey, number>>;
export type MoveCategory = 'physical' | 'special' | 'status';

export interface MoveSecondary {
  chance: number;
  boosts?: Boosts;
  self?: Boosts;
  status?: string;
  flinch?: boolean;
  confuse?: boolean;
}

/** A move as the catalog describes it (movedex.json plus the rules derived in moveData()). */
export interface MoveData {
  key: string;
  id: string;
  name: string;
  desc: string;
  type: string | null;
  category: MoveCategory;
  power: number;
  accuracy: number | null;
  pp: number;
  priority: number;
  target: string;
  flags: string[];
  kind: 'attack' | 'status';
  supported: boolean;
  // From Pokémon Showdown's data (movedex.json):
  drain?: number;
  secondary?: MoveSecondary[];
  spread?: boolean;
  boosts?: Boosts;
  crit?: number;
  volatile?: string;
  multihit?: [number, number];
  self?: Boosts;
  sideCondition?: string;
  stalling?: boolean;
  selfSwitchKind?: string;
  ignoresImmunity?: boolean;
  recoil?: number;
  status?: string;
  fixedDamage?: number | string;
  terrain?: string;
  selfDestruct?: boolean;
  pseudoWeather?: string;
  breaksProtect?: boolean;
  ohko?: boolean;
  weather?: string;
  heal?: number;
  sleepUsable?: boolean;
  // Derived in moveData():
  weakenedByGrassyTerrain?: boolean;
  usesTargetAttack?: boolean;
  screen?: string;
  breaksScreens?: boolean;
  clearsScreens?: boolean;
  firstTurnOnly?: boolean;
  rampage?: boolean;
  binds?: boolean;
  traps?: boolean;
  selfSwitch?: boolean;
  forceSwitch?: boolean;
  leavesOne?: boolean;
  crashes?: boolean;
  ignoresDefBoosts?: boolean;
  hitsPhysicalDef?: boolean;
  losesType?: string;
  selfCost?: number;
  usesDefense?: boolean;
  extraType?: string;
  recoilMaxHp?: number;
  usableAsleep?: boolean;
  grounds?: boolean;
  hitsAirborne?: boolean;
  curls?: boolean;
  thaws?: boolean;
}

type RawMove = Omit<MoveData, 'key' | 'id' | 'kind' | 'supported'>;

interface RawSpecies {
  name: string;
  types: string[];
  /** hp, attack, defense, special attack, special defense, speed */
  stats: [number, number, number, number, number, number];
  abilities: string[];
  hiddenAbility: string | null;
  learnset?: [string, number][];
  teachable?: Partial<Record<string, string[]>>;
  genderRate?: number;
  weight?: number;
  height?: number;
  genus?: string | null;
  dexEntry?: string | null;
  stage?: number;
  chainLen?: number;
  evolvesFrom?: number;
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

/** PokeAPI data of a species. */
export interface SpeciesData extends RawSpecies {
  base: BaseStats;
}

export interface FormData {
  types: string[];
  base: RawSpecies['stats'];
  sprite: string;
}

export interface SpeciesView {
  id: number;
  name: string;
  sprite: string;
  types: string[];
  stats: Stats;
  floats: boolean;
}

/** A fighter as the battle and the browser see it. */
export interface Fighter {
  uid: string;
  name: string;
  speciesName: string;
  speciesId: number;
  types: string[];
  rarity: Rarity;
  shiny: boolean;
  level: number;
  stats: Stats;
  moves: MoveData[];
  sprite: string;
  floats: boolean;
  ability: string | null;
  abilityInfo: AbilityInfo | null;
  gender: Gender | null;
  nature: string | null;
  ivs: Ivs;
}

export interface MoveOrigin {
  origin: 'level' | 'machine' | 'tutor' | 'egg' | 'other';
  level: number | null;
}

export interface AbilityOption {
  key: string;
  hidden: boolean;
}

// ---------- data ----------

const POKEAPI_FILE = JSON.parse(readFileSync(catalogFile('pokeapi.json'), 'utf8')) as { species: Record<string, RawSpecies>; forms?: Record<string, { types: string[]; stats: RawSpecies['stats']; sprite: string }> };
const POKEAPI = POKEAPI_FILE.species;
const FORMS = POKEAPI_FILE.forms ?? {};
const AIRBORNE = JSON.parse(readFileSync(catalogFile('airborne.json'), 'utf8')) as { coversUpTo: number; airborne: number[] };
const AIRBORNE_IDS = new Set(AIRBORNE.airborne);
const FLOATING_ABILITIES = new Set(['levitate', 'eelevate']);

export function floats(id: number): boolean {
  if (id <= AIRBORNE.coversUpTo) return AIRBORNE_IDS.has(id);
  const species = POKEAPI[id];
  if (!species) return false;
  return species.types.includes('flying') || [...(species.abilities ?? []), species.hiddenAbility].some((a) => FLOATING_ABILITIES.has(a as string));
}

// PokeAPI data of a species number, or null when we don't have it (unknown or newer species).
export function speciesData(id: number): SpeciesData | null {
  const species = POKEAPI[id];
  if (!species) return null;
  const [hp, attack, defense, spAttack, spDefense, speed] = species.stats;
  return { ...species, base: { hp, attack, defense, spAttack, spDefense, speed } };
}

export function formData(name: string): FormData | null {
  const form = FORMS[name];
  return form ? { types: form.types, base: form.stats, sprite: form.sprite } : null;
}

export function hash(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export type Random = () => number;

export function rng(seed: number | string): Random {
  let a = typeof seed === 'number' ? seed >>> 0 : hash(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const between = (random: Random, lo: number, hi: number) => lo + Math.floor(random() * (hi - lo + 1));

export function shuffled<T>(items: Iterable<T>, random: Random = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const MOVEDEX = JSON.parse(readFileSync(catalogFile('movedex.json'), 'utf8')) as Record<string, RawMove>;
export const MOVES_PER_FIGHTER = 4;
const SUPPORTED_VOLATILES = new Set(['confusion', 'attract', 'leechseed']);
const SPECIAL_STATUS_MOVES = new Set(['rest', 'synthesis', 'morning-sun', 'moonlight', 'shore-up']);
const GRASSY_HALVED = new Set(['earthquake', 'bulldoze', 'magnitude']);
const SCREEN_MOVES: Record<string, string> = { reflect: 'reflect', 'light-screen': 'lightscreen', 'aurora-veil': 'auroraveil' };
const SCREEN_BREAKERS = new Set(['brick-break', 'psychic-fangs', 'raging-bull']);
const FIRST_TURN_ONLY = new Set(['fake-out', 'first-impression', 'mat-block']);
const RAMPAGE = new Set(['outrage', 'thrash', 'petal-dance', 'raging-fury']);
const BINDING = new Set(['bind', 'wrap', 'fire-spin', 'whirlpool', 'sand-tomb', 'clamp', 'infestation', 'magma-storm', 'thunder-cage', 'snap-trap']);
const TRAPPING = new Set(['jaw-lock', 'anchor-shot', 'spirit-shackle', 'thousand-waves']);
const SELF_SWITCH = new Set(['u-turn', 'volt-switch', 'flip-turn']);
const FORCE_SWITCH = new Set(['dragon-tail', 'circle-throw']);
const LEAVES_ONE = new Set(['false-swipe', 'hold-back']);
const CRASHES = new Set(['high-jump-kick', 'jump-kick', 'axe-kick', 'supercell-slam']);
const IGNORES_DEF_BOOSTS = new Set(['sacred-sword', 'darkest-lariat', 'chip-away']);
const HITS_PHYSICAL_DEF = new Set(['psyshock', 'psystrike', 'secret-sword']);
const LOSES_TYPE: Record<string, string> = { 'burn-up': 'fire', 'double-shock': 'electric' };
const SELF_COST: Record<string, number> = { 'fillet-away': 1 / 2, 'clangorous-soul': 1 / 3 };

export const STRUGGLE: MoveData = {
  key: 'struggle', id: 'struggle', name: 'Forcejeo', desc: 'Ataque desesperado que solo se usa cuando no quedan PP; daña también al usuario.',
  type: null, category: 'physical', power: 50, accuracy: null, pp: 1, priority: 0, target: 'foe', flags: ['contact'], kind: 'attack', recoilMaxHp: 1 / 4, supported: true,
};

function supportedMove(move: MoveData): boolean {
  if (move.category !== 'status') return move.power > 0 || !!move.fixedDamage || !!move.ohko;
  return !!(move.boosts
    || move.self
    || move.status
    || move.screen
    || SUPPORTED_VOLATILES.has(move.volatile as string)
    || move.heal
    || move.weather
    || move.terrain
    || SPECIAL_STATUS_MOVES.has(move.id));
}

export const ALL_MOVE_IDS = (): string[] => Object.keys(MOVEDEX);

export function moveData(id: string): MoveData | null {
  const raw = MOVEDEX[id];
  if (!raw) return null;
  // `supported` is set last, as before, so the object keeps its key order.
  const move = { key: id, id, ...raw, flags: [...(raw.flags ?? [])], kind: raw.category === 'status' ? 'status' : 'attack' } as MoveData;
  if (GRASSY_HALVED.has(id)) move.weakenedByGrassyTerrain = true;
  if (id === 'foul-play') move.usesTargetAttack = true;
  if (id === 'toxic') move.status = 'tox';
  if (SCREEN_MOVES[id]) move.screen = SCREEN_MOVES[id];
  if (SCREEN_BREAKERS.has(id)) move.breaksScreens = true;
  if (id === 'defog') {
    move.boosts = { eva: -1 };
    move.clearsScreens = true;
  }
  if (FIRST_TURN_ONLY.has(id)) move.firstTurnOnly = true;
  if (RAMPAGE.has(id)) move.rampage = true;
  if (BINDING.has(id)) move.binds = true;
  if (TRAPPING.has(id)) move.traps = true;
  if (SELF_SWITCH.has(id)) move.selfSwitch = true;
  if (FORCE_SWITCH.has(id)) move.forceSwitch = true;
  if (LEAVES_ONE.has(id)) move.leavesOne = true;
  if (CRASHES.has(id)) move.crashes = true;
  if (IGNORES_DEF_BOOSTS.has(id)) move.ignoresDefBoosts = true;
  if (HITS_PHYSICAL_DEF.has(id)) move.hitsPhysicalDef = true;
  if (LOSES_TYPE[id]) move.losesType = LOSES_TYPE[id];
  if (SELF_COST[id]) move.selfCost = SELF_COST[id];
  if (id === 'body-press') move.usesDefense = true;
  if (id === 'flying-press') move.extraType = 'flying';
  if (id === 'clanging-scales') move.self = { def: -1 };
  if (id === 'scale-shot') move.self = { def: -1, spd: 1 };
  if (id === 'mind-blown' || id === 'steel-beam') move.recoilMaxHp = 1 / 2;
  if (id === 'memento') move.selfDestruct = true;
  if (id === 'snore') move.usableAsleep = true;
  if (id === 'smack-down' || id === 'thousand-arrows') move.grounds = true;
  if (id === 'thousand-arrows') move.hitsAirborne = true;
  if (id === 'defense-curl') move.curls = true;
  move.supported = !IMPOSSIBLE_MOVES.has(id) && (supportedMove(move) || !!MOVE_RULES[id]);
  return move;
}

export function lineage(id: number): number[] {
  const chain: number[] = [];
  for (let cur: number | undefined = id; cur && POKEAPI[cur] && !chain.includes(cur); cur = POKEAPI[cur].evolvesFrom) chain.push(cur);
  return chain;
}

const CHILDREN = new Map<number, number[]>();
for (const [id, species] of Object.entries(POKEAPI))
  if (species.evolvesFrom) CHILDREN.set(species.evolvesFrom, [...(CHILDREN.get(species.evolvesFrom) ?? []), Number(id)]);


export function family(id: number): { id: number; stage: number }[] {
  const root = lineage(id).at(-1) ?? id;
  const out: { id: number; stage: number }[] = [];
  const visit = (cur: number, stage: number) => {
    out.push({ id: cur, stage });
    for (const next of CHILDREN.get(cur) ?? []) visit(next, stage + 1);
  };
  visit(root, 0);
  return out;
}

export function lineageLearnset(id: number): Map<string, { level: number; from: number }> {
  const best = new Map<string, { level: number; from: number }>();
  for (const speciesId of lineage(id)) {
    for (const [move, level] of POKEAPI[speciesId].learnset ?? []) {
      const known = best.get(move);
      if (!known) best.set(move, { level, from: speciesId });
      else if (level < known.level) known.level = level;
    }
  }
  return best;
}

const TEACH_ORIGINS = ['machine', 'tutor', 'egg', 'other'] as const;

/** Entry fields the move and ability rules read. */
type EntryLike = Pick<RosterEntry, 'finalID'> & Partial<RosterEntry>;

export function moveOrigins(entry: EntryLike): Map<string, MoveOrigin> {
  const out = new Map<string, MoveOrigin>();
  const byLevel = [...lineageLearnset(entry.finalID)].sort((a, b) => a[1].level - b[1].level || a[0].localeCompare(b[0]));
  for (const [id, learned] of byLevel) out.set(id, { origin: 'level', level: learned.level });
  const line = lineage(entry.finalID);
  for (const origin of TEACH_ORIGINS) {
    const ids = new Set(line.flatMap((speciesId) => POKEAPI[speciesId].teachable?.[origin] ?? []));
    for (const id of [...ids].sort()) if (!out.has(id)) out.set(id, { origin, level: null });
  }
  for (const id of entry.learned ?? []) if (!out.has(id)) out.set(id, { origin: 'other', level: null });
  for (const id of out.keys()) if (!MOVEDEX[id]) out.delete(id);
  return out;
}

export function learnedMoves(entry: EntryLike): string[] {
  return [...moveOrigins(entry).keys()];
}

export function movepool(entry: EntryLike): MoveData[] {
  return learnedMoves(entry).map((id) => moveData(id) as MoveData);
}

export function usableMovepool(entry: EntryLike): string[] {
  return learnedMoves(entry).filter((id) => (moveData(id) as MoveData).supported);
}

export function defaultMoveset(entry: EntryLike): string[] {
  const origins = moveOrigins(entry);
  const usable = usableMovepool(entry);
  const reached = usable.filter((id) => origins.get(id)!.origin === 'level' && origins.get(id)!.level! <= (entry.level as number));
  if (reached.length) return reached.slice(-MOVES_PER_FIGHTER);
  if (usable.length) return usable.slice(0, MOVES_PER_FIGHTER);
  return MOVEDEX.tackle ? ['tackle'] : [];
}

export function validMoveset(entry: EntryLike, ids: unknown): ids is string[] {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MOVES_PER_FIGHTER || new Set(ids).size !== ids.length) return false;
  const pool = new Set(learnedMoves(entry));
  return ids.every((id) => typeof id === 'string' && pool.has(id) && (moveData(id) as MoveData).supported);
}

export function movesetFor(entry: EntryLike): string[] {
  if (!Array.isArray(entry.moveset) || !entry.moveset.length) return defaultMoveset(entry);
  const saved = [...new Set(entry.moveset)].slice(0, MOVES_PER_FIGHTER);
  const pool = new Set(usableMovepool(entry));
  const spares = shuffled([...pool].filter((id) => !saved.includes(id)), rng(`mv:${entry.id ?? entry.finalID}:${saved.join(',')}`));
  const moves = saved.map((id) => (pool.has(id) ? id : spares.shift())).filter(Boolean) as string[];
  return moves.length ? moves : defaultMoveset(entry);
}

export const usableAbility = (key: string | null | undefined): boolean => !!key && knownAbility(key) && !INERT[key];

export function abilityOptions(entry: EntryLike): AbilityOption[] {
  const data = speciesData(entry.finalID);
  if (!data) return [];
  return [...data.abilities.map((key) => ({ key, hidden: false })), ...(data.hiddenAbility ? [{ key: data.hiddenAbility, hidden: true }] : [])].filter((a) => knownAbility(a.key));
}

const NATURES: Record<string, [StatKey, StatKey]> = {
  lonely: ['atk', 'def'], brave: ['atk', 'spd'], adamant: ['atk', 'satk'], naughty: ['atk', 'sdef'],
  bold: ['def', 'atk'], relaxed: ['def', 'spd'], impish: ['def', 'satk'], lax: ['def', 'sdef'],
  timid: ['spd', 'atk'], hasty: ['spd', 'def'], jolly: ['spd', 'satk'], naive: ['spd', 'sdef'],
  modest: ['satk', 'atk'], mild: ['satk', 'def'], quiet: ['satk', 'spd'], rash: ['satk', 'sdef'],
  calm: ['sdef', 'atk'], gentle: ['sdef', 'def'], sassy: ['sdef', 'spd'], careful: ['sdef', 'satk'],
};
export const NATURE_NAMES = new Set([...Object.keys(NATURES), 'hardy', 'docile', 'serious', 'bashful', 'quirky']);

const RARITY_BASE: Record<string, number> = { common: 55, uncommon: 65, rare: 75, legendary: 90 };

// Species: name, sprite, types and stats straight from PokeAPI. A species PokeAPI doesn't know
// (unknown or newer) falls back to its dex number, the Normal type and stats derived from rarity.
export function species(entry: EntryLike): SpeciesView {
  const { finalID, rarity } = entry;
  const data = speciesData(finalID);
  const random = rng(`sp:${finalID}`);
  const types = data ? data.types : ['normal'];

  let stats: Stats;
  if (data) {
    const base = data.base;
    stats = { hp: base.hp, atk: base.attack, def: base.defense, satk: base.spAttack, sdef: base.spDefense, spd: base.speed };
  } else {
    const base = RARITY_BASE[rarity as string] ?? RARITY_BASE.common;
    stats = {
      hp: base + between(random, -14, 14),
      atk: base + between(random, -16, 16),
      def: base + between(random, -16, 16),
      satk: base + between(random, -16, 16),
      sdef: base + between(random, -16, 16),
      spd: base + between(random, -18, 18),
    };
  }
  return { id: finalID, name: data ? data.name : `#${finalID}`, sprite: String(finalID), types, stats, floats: floats(finalID) };
}

function savedAbility(entry: EntryLike, data: SpeciesData): string {
  const regular = data.abilities;
  const all = data.hiddenAbility ? [...regular, data.hiddenAbility] : regular;
  if (entry.abilityChoice && all.includes(entry.abilityChoice) && knownAbility(entry.abilityChoice)) return entry.abilityChoice;
  if (entry.ability && all.includes(entry.ability) && knownAbility(entry.ability)) return entry.ability;
  if (entry.abilitySlot === 3 && data.hiddenAbility) return data.hiddenAbility;
  if (entry.abilitySlot === 1 || entry.abilitySlot === 2) return regular[entry.abilitySlot - 1] ?? regular[0];
  return regular[hash(`ab:${entry.id ?? entry.finalID}`) % regular.length];
}

export function abilityFor(entry: EntryLike): string | null {
  const data = speciesData(entry.finalID);
  if (!data?.abilities?.length) return null;
  const saved = savedAbility(entry, data);
  if (usableAbility(saved)) return saved;
  const others = abilityOptions(entry).map((a) => a.key).filter((key) => key !== saved && usableAbility(key));
  if (!others.length) return null;
  return others[Math.floor(rng(`ab:${entry.id ?? entry.finalID}:${saved}`)() * others.length)];
}

export function genderFor(entry: EntryLike): Gender | null {
  const rate = speciesData(entry.finalID)?.genderRate;
  if (rate == null) return entry.gender ?? null;
  if (rate === -1) return null;
  if (rate === 0) return 'male';
  if (rate === 8) return 'female';
  if (entry.gender === 'male' || entry.gender === 'female') return entry.gender;
  return hash(`gender:${entry.id ?? entry.finalID}`) % 8 < rate ? 'female' : 'male';
}

const scale = (base: number, iv: number, level: number) => Math.floor(((2 * base + iv) * level) / 100);

/** IVs as stats read them: old fixtures may omit the special ones, which fall back to atk/def. */
type IvsLike = Pick<Ivs, 'hp' | 'atk' | 'def' | 'spd'> & Partial<Pick<Ivs, 'satk' | 'sdef'>>;

export function statsFor([hp, attack, defense, spAttack, spDefense, speed]: readonly number[], iv: IvsLike, level: number, nature: string | null = null): Stats {
  const [up, down] = NATURES[nature as string] ?? [];
  const stat = (key: StatKey, base: number, value: number) => Math.floor((scale(base, value, level) + 5) * (key === up ? 1.1 : key === down ? 0.9 : 1));
  return {
    hp: hp === 1 ? 1 : scale(hp, iv.hp, level) + level + 10,
    atk: stat('atk', attack, iv.atk),
    def: stat('def', defense, iv.def),
    satk: stat('satk', spAttack, iv.satk ?? iv.atk),
    sdef: stat('sdef', spDefense, iv.sdef ?? iv.def),
    spd: stat('spd', speed, iv.spd),
  };
}

// A fighter as the battle and the browser see it.
export function buildFighter(entry: RosterEntry, { levelCap }: { levelCap?: number | null } = {}): Fighter {
  const sp = species(entry);
  const level = levelCap ? levelCap : entry.level;
  const iv = entry.ivs;
  const ability = abilityFor(entry);
  const { hp, atk, def, satk, sdef, spd } = sp.stats;
  const stats = statsFor([hp, atk, def, satk, sdef, spd], iv, level, entry.nature);
  return {
    uid: entry.id,
    name: entry.nickname || sp.name,
    speciesName: sp.name,
    speciesId: sp.id,
    types: sp.types,
    rarity: entry.rarity,
    shiny: entry.shiny,
    level,
    stats,
    moves: movesetFor(entry).map((id) => moveData(id) as MoveData),
    sprite: sp.sprite,
    floats: sp.floats,
    ability,
    abilityInfo: abilityInfo(ability),
    gender: genderFor(entry),
    nature: entry.nature ?? null,
    ivs: iv,
  };
}

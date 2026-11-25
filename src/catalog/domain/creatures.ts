import { readFileSync } from 'node:fs';
import { catalogFile } from '../../shared/paths.js';
import { effectiveness } from './type-chart.js';
import { knownAbility, INERT } from './abilities.js';
import type { Gender, Ivs, RosterEntry } from './roster-entry.js';
import { statValue } from '../../../public/stat-formula.js';

export { effectiveness };

export type StatKey = 'hp' | 'atk' | 'def' | 'satk' | 'sdef' | 'spd';
export type Stats = Record<StatKey, number>;
export type BoostKey = 'atk' | 'def' | 'satk' | 'sdef' | 'spd' | 'acc' | 'eva';
export type Boosts = Partial<Record<BoostKey, number>>;
export type MoveCategory = 'physical' | 'special' | 'status';
export const MAJOR_STATUSES = ['brn', 'par', 'psn', 'tox', 'slp', 'frz'] as const;
export type MajorStatus = (typeof MAJOR_STATUSES)[number];
export type Weather = 'sun' | 'rain' | 'sand' | 'hail' | 'snow' | 'harshsun' | 'heavyrain' | 'winds';

export interface MoveSecondary {
  chance: number;
  boosts?: Boosts;
  self?: Boosts;
  status?: MajorStatus;
  flinch?: boolean;
  confuse?: boolean;
}

export interface MoveEntry {
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
  status?: MajorStatus;
  fixedDamage?: number | string;
  terrain?: string;
  selfDestruct?: boolean;
  pseudoWeather?: string;
  breaksProtect?: boolean;
  ohko?: boolean;
  weather?: Weather;
  heal?: number;
  sleepUsable?: boolean;
}

interface RawSpecies {
  name: string;
  types: string[];
  stats: [hp: number, attack: number, defense: number, spAttack: number, spDefense: number, speed: number];
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
  evolvesAt?: number;
}

export interface BaseStats {
  hp: number;
  attack: number;
  defense: number;
  spAttack: number;
  spDefense: number;
  speed: number;
}

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

export interface MoveOrigin {
  origin: 'level' | 'machine' | 'tutor' | 'egg' | 'other';
  level: number | null;
}

export interface AbilityOption {
  key: string;
  hidden: boolean;
}

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

export function speciesData(id: number): SpeciesData | null {
  const species = POKEAPI[id];
  if (!species) return null;
  const [hp, attack, defense, spAttack, spDefense, speed] = species.stats;
  return { ...species, base: { hp, attack, defense, spAttack, spDefense, speed } };
}

const SPECIES_BY_NAME = new Map(Object.entries(POKEAPI).map(([id, data]) => [data.name, Number(id)]));

export const speciesIdByName = (name: string): number | null => SPECIES_BY_NAME.get(name) ?? null;

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

const MOVEDEX = JSON.parse(readFileSync(catalogFile('movedex.json'), 'utf8')) as Record<string, MoveEntry>;

export const ALL_MOVE_IDS = (): string[] => Object.keys(MOVEDEX);
export const moveEntry = (id: string): MoveEntry | null => MOVEDEX[id] ?? null;

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

export function finalForms(id: number, maxId = Infinity): number[] {
  const finals: number[] = [];
  const visit = (cur: number) => {
    const next = (CHILDREN.get(cur) ?? []).filter((child) => child <= maxId);
    if (!next.length) finals.push(cur);
    next.forEach(visit);
  };
  if (POKEAPI[id]) visit(id);
  return finals;
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

export type EntryLike = Pick<RosterEntry, 'finalID'> & Partial<RosterEntry>;

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
export const NATURE_KEYS = ['hardy', 'lonely', 'brave', 'adamant', 'naughty', 'bold', 'docile', 'relaxed', 'impish', 'lax', 'timid', 'hasty', 'serious', 'jolly', 'naive', 'modest', 'mild', 'quiet', 'bashful', 'rash', 'calm', 'gentle', 'sassy', 'careful', 'quirky'] as const;
export const NATURE_NAMES = new Set<string>(NATURE_KEYS);
const NATURE_LABELS: Record<string, string> = {
  hardy: 'Fuerte', lonely: 'Huraña', brave: 'Audaz', adamant: 'Firme', naughty: 'Pícara', bold: 'Osada', docile: 'Dócil', relaxed: 'Plácida',
  impish: 'Agitada', lax: 'Floja', timid: 'Miedosa', hasty: 'Activa', serious: 'Seria', jolly: 'Alegre', naive: 'Ingenua', modest: 'Modesta',
  mild: 'Afable', quiet: 'Mansa', bashful: 'Tímida', rash: 'Alocada', calm: 'Serena', gentle: 'Amable', sassy: 'Grosera', careful: 'Cauta', quirky: 'Rara',
};

export interface NatureInfo {
  key: string;
  name: string;
  up: StatKey | null;
  down: StatKey | null;
}

export const natureInfo = (key: string): NatureInfo => ({ key, name: NATURE_LABELS[key] ?? key, up: NATURES[key]?.[0] ?? null, down: NATURES[key]?.[1] ?? null });

export function natureFor(entry: Pick<RosterEntry, 'nature' | 'natureChoice'>): string | null {
  if (entry.natureChoice && NATURE_NAMES.has(entry.natureChoice)) return entry.natureChoice;
  return entry.nature ?? null;
}

const RARITY_BASE: Record<string, number> = { common: 55, uncommon: 65, rare: 75, legendary: 90 };

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

type IvsLike = Pick<Ivs, 'hp' | 'atk' | 'def' | 'spd'> & Partial<Pick<Ivs, 'satk' | 'sdef'>>;

export function statsFor(bases: readonly number[], iv: IvsLike, level: number, nature: string | null = null, evs: Partial<Ivs> = {}): Stats {
  const [up, down] = NATURES[nature as string] ?? [];
  const ivOf: Record<StatKey, number> = { hp: iv.hp, atk: iv.atk, def: iv.def, satk: iv.satk ?? iv.atk, sdef: iv.sdef ?? iv.def, spd: iv.spd };
  const stat = (key: StatKey, index: number) => statValue(key, bases[index], ivOf[key], evs[key] ?? 0, level, key === up ? 1.1 : key === down ? 0.9 : 1);
  return { hp: stat('hp', 0), atk: stat('atk', 1), def: stat('def', 2), satk: stat('satk', 3), sdef: stat('sdef', 4), spd: stat('spd', 5) };
}

export const PERFECT_IVS: Ivs = { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 };


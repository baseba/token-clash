import { finalForms, NATURE_NAMES, speciesData } from '../../catalog/domain/creatures.js';
import { hash } from '../../shared/domain/random.js';
import { uniqueSpecies, variantKey, type Gender, type Ivs, type Rarity, type RosterEntry } from '../../catalog/domain/roster-entry.js';
import { toDuplicate, type Duplicate } from './recycling.js';
import { invalid } from '../../shared/domain/errors.js';

const RARITIES = new Set(['common', 'uncommon', 'rare', 'legendary']);
const UUID = /^[0-9a-fA-F-]{8,40}$/;
const MAX_DUPLICATES = 1000;
const ABILITY_KEY = /^[a-z0-9-]{1,40}$/;
const GENDERS = new Set(['male', 'female']);
const MOVE_KEY = /^[a-z0-9-]{1,40}$/;
const MAX_LEARNED = 120;
const GRADUATED_LEVEL = 100;

export interface ParsedSave {
  roster: RosterEntry[];
  duplicates: Duplicate[];
  totalTokens: number;
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => !!value && typeof value === 'object';

const int = (value: unknown, lo: number, hi: number, fallback: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(number)));
};

function ivsFrom(profile: Json | null, seedKey: string): Ivs {
  const iv = profile && isObject(profile.ivs) ? profile.ivs : null;
  const fb = 8 + (hash(seedKey) % 16);
  if (!iv) return { hp: fb, atk: fb, def: fb, satk: fb, sdef: fb, spd: fb };
  const ivFor = (key: string) => int(iv[key], 0, 31, fb);
  return {
    hp: ivFor('hp'),
    atk: ivFor('attack'),
    def: ivFor('defense'),
    satk: ivFor('specialAttack'),
    sdef: ivFor('specialDefense'),
    spd: ivFor('speed'),
  };
}

function chainInfo(chain: unknown, finalID: number, stageHint?: number): { stage?: number; chainLen?: number } {
  if (!Array.isArray(chain) || chain.length < 1 || chain.length > 10 || !chain.every(Number.isInteger)) return {};
  const stage = Number.isInteger(stageHint) ? (stageHint as number) : chain.indexOf(finalID);
  if (stage < 0 || stage >= chain.length) return {};
  return { stage, chainLen: chain.length };
}

function currentMovesOf(profile: Json | null): string[] {
  const list = Array.isArray(profile?.currentMoves) ? profile.currentMoves.filter((n): n is string => typeof n === 'string' && MOVE_KEY.test(n)) : [];
  return [...new Set(list)].slice(0, 4);
}

interface EntryHints {
  finalID: unknown;
  baseID: unknown;
  defaultLevel: number;
  fallbackId: string;
  chain: unknown;
  stageHint?: number;
}

function entryFrom(raw: Json, { finalID, baseID, defaultLevel, fallbackId, chain, stageHint }: EntryHints): RosterEntry | null {
  if (!Number.isInteger(finalID) || (finalID as number) < 1 || (finalID as number) > 5000) return null;
  const species = finalID as number;
  const base = Number.isInteger(baseID) && (baseID as number) >= 1 && (baseID as number) <= 5000 ? (baseID as number) : species;
  const profile = isObject(raw.profile) ? raw.profile : null;
  let id = typeof raw.id === 'string' ? raw.id : profile && typeof profile.instanceID === 'string' ? profile.instanceID : '';
  if (!UUID.test(id)) id = fallbackId;
  const moves = Array.isArray(profile?.moves) ? profile.moves.map((m: unknown) => (isObject(m) ? m.name : undefined)) : [];
  const current = currentMovesOf(profile);
  return {
    id: id.toLowerCase(),
    finalID: species,
    baseID: base,
    rarity: RARITIES.has(raw.rarity as string) ? (raw.rarity as Rarity) : 'common',
    shiny: raw.isShiny === true,
    level: int(profile?.level, 1, 100, defaultLevel),
    ivs: ivsFrom(profile, id),
    ability: typeof profile?.abilityName === 'string' && ABILITY_KEY.test(profile.abilityName) ? profile.abilityName : null,
    abilitySlot: [1, 2, 3].includes(profile?.abilitySlot as number) ? (profile!.abilitySlot as 1 | 2 | 3) : null,
    gender: GENDERS.has(profile?.gender as string) ? (profile!.gender as Gender) : null,
    nature: NATURE_NAMES.has(raw.nature as string) ? (raw.nature as string) : NATURE_NAMES.has(profile?.nature as string) ? (profile!.nature as string) : null,
    learned: [...new Set([...moves, ...current])].filter((n): n is string => typeof n === 'string' && MOVE_KEY.test(n)).slice(0, MAX_LEARNED),
    ...(current.length ? { moveset: current } : {}),
    ...chainInfo(chain, species, stageHint),
  };
}

export function evolvedGraduate(entry: RosterEntry, chain: unknown): RosterEntry {
  const endOfSavedChain = Array.isArray(chain) && chain[chain.length - 1] === entry.finalID;
  if (entry.level !== GRADUATED_LEVEL || !endOfSavedChain) return entry;
  const later = finalForms(entry.finalID).filter((id) => id !== entry.finalID);
  if (!later.length) return entry;
  const finalID = later[hash(entry.id) % later.length];
  const species = speciesData(finalID);
  return { ...entry, finalID, ...(species?.stage != null && species.chainLen != null ? { stage: species.stage, chainLen: species.chainLen } : {}) };
}

export interface CaughtCandidate {
  entry: RosterEntry;
  caught: number;
  order: number;
}

export function firstOfEachSpecies(candidates: CaughtCandidate[]): RosterEntry[] {
  const first = new Map<string, CaughtCandidate>();
  for (const candidate of candidates) {
    const key = variantKey(candidate.entry);
    const prev = first.get(key);
    if (!prev || candidate.caught < prev.caught || (candidate.caught === prev.caught && candidate.order < prev.order)) first.set(key, candidate);
  }
  return [...first.values()]
    .sort((x, y) => x.entry.finalID - y.entry.finalID || Number(!!x.entry.shiny) - Number(!!y.entry.shiny))
    .map((c) => c.entry);
}

export function carryTeam(team: string[], before: RosterEntry[], after: RosterEntry[]): string[] {
  const kept = new Map(after.map((e) => [e.id, e]));
  const keptByVariant = new Map(after.map((e) => [variantKey(e), e]));
  const variantOf = new Map(before.map((e) => [e.id, variantKey(e)]));
  const carried = team.map((id) => kept.get(id) ?? keptByVariant.get(variantOf.get(id) ?? '')).filter((e): e is RosterEntry => !!e);
  return uniqueSpecies(carried).map((e) => e.id);
}

export function parseSave(text: string): ParsedSave {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw invalid('El archivo no es JSON válido.');
  }
  if (!isObject(json)) throw invalid('El archivo no es un save de PokeTokenBar.');
  if ('format' in json && json.format !== 'poketokenbar.save') throw invalid('Formato de archivo desconocido.');
  const state = json.format === 'poketokenbar.save' ? json.state : json;
  if (!isObject(state) || (!Array.isArray(state.dex) && !state.active)) {
    throw invalid('No encontré tu colección. Exporta desde PokeTokenBar → Ajustes → Backup & Transfer.');
  }

  const candidates: CaughtCandidate[] = [];
  const seenIds = new Set<string>();
  const add = (entry: RosterEntry | null, caughtAt: unknown) => {
    if (!entry || seenIds.has(entry.id)) return;
    seenIds.add(entry.id);
    const time = Date.parse(caughtAt as string);
    candidates.push({ entry, caught: Number.isFinite(time) ? time : Infinity, order: candidates.length });
  };

  const dex = Array.isArray(state.dex) ? state.dex : [];
  dex.forEach((seen: unknown, i: number) => {
    if (!isObject(seen) || seen.releasedAt) return;
    const entry = entryFrom(seen, {
      finalID: seen.finalID,
      baseID: seen.baseID,
      defaultLevel: 100,
      fallbackId: `dex-${i}-${seen.finalID}`,
      chain: seen.chainOrder,
    });
    add(entry && evolvedGraduate(entry, seen.chainOrder), seen.caughtAt);
  });

  const active = state.active;
  if (isObject(active) && Array.isArray(active.pathIDs)) {
    const stage = int(active.stageIndex, 0, active.pathIDs.length - 1, 0);
    const current = active.pathIDs[stage];
    const planned = Array.isArray(active.plannedPathIDs) && active.plannedPathIDs.length >= active.pathIDs.length
      ? active.plannedPathIDs
      : active.pathIDs;
    const entry = entryFrom(active, {
      finalID: current,
      baseID: active.baseID,
      defaultLevel: 30,
      fallbackId: `active-${active.baseID}`,
      chain: planned,
      stageHint: stage,
    });
    if (entry) {
      entry.active = true;
      add(entry, null);
    }
  }

  const roster = firstOfEachSpecies(candidates);
  const kept = new Set(roster.map((entry) => entry.id));
  const duplicates = candidates
    .filter(({ entry }) => !kept.has(entry.id) && !entry.active && roster.some((first) => variantKey(first) === variantKey(entry)))
    .map(({ entry }) => toDuplicate(entry))
    .slice(0, MAX_DUPLICATES);

  if (roster.length === 0) throw invalid('Tu save no tiene Pokémon todavía (¿solo un huevo?). Vuelve cuando nazca el primero.');

  const used = Number(state.usedSinceInstall);
  return {
    roster,
    duplicates,
    totalTokens: Number.isFinite(used) && used > 0 ? Math.min(used, 1e15) : 0,
  };
}

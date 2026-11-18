// Reads a PokeTokenBar save: the app's export / snapshot ({format: "poketokenbar.save", state})
// or the raw live file (~/Library/Application Support/PokeTokenBar/companion-state.json).
// We keep only game data: species numbers, rarity, level, IVs, nature, shiny, ability, gender and
// learned moves. Names, device name and token logs are dropped on purpose.
//
// Pure domain: text in, roster out. No database, no HTTP.

import { hash, NATURE_NAMES } from '../../catalog/domain/creatures.js';
import { uniqueSpecies, variantKey, type Gender, type Ivs, type Rarity, type RosterEntry } from '../../catalog/domain/roster-entry.js';
import { toDuplicate, type Duplicate } from './recycling.js';
import { invalid } from '../../shared/domain/errors.js';

const RARITIES = new Set(['common', 'uncommon', 'rare', 'legendary']);
const UUID = /^[0-9a-fA-F-]{8,40}$/;
const MAX_ROSTER = 300;
const MAX_DUPLICATES = 1000;
const ABILITY_KEY = /^[a-z0-9-]{1,40}$/;
const GENDERS = new Set(['male', 'female']);
const MOVE_KEY = /^[a-z0-9-]{1,40}$/;
const MAX_LEARNED = 120;

export interface ParsedSave {
  roster: RosterEntry[];
  /** The repeated copies the roster leaves out (it keeps one per species and variant). */
  duplicates: Duplicate[];
  totalTokens: number;
}

// The save is untrusted JSON: everything below reads it as `unknown` and checks each field.
type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json => !!value && typeof value === 'object';

const int = (value: unknown, lo: number, hi: number, fallback: number) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(number)));
};

function ivsFrom(profile: Json | null, seedKey: string): Ivs {
  const iv = profile && isObject(profile.ivs) ? profile.ivs : null;
  // Old saves have no IVs: give a stable middling value instead of a random one.
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

// Where finalID sits in its evolution chain (0 = first form) and how long the chain is.
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

export interface CaughtCandidate {
  entry: RosterEntry;
  caught: number;
  order: number;
}

/** Keeps the first one caught of each species and variant (shiny/plain), sorted by dex number. */
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

/**
 * After a roster changes (a new save, or dropping repeats), keeps the team pointing at the same
 * Pokémon: by instance id, or by species and variant when the id changed.
 */
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
    // profile.seed is a uint64 and loses precision here; we never use it.
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
    if (!isObject(seen) || seen.releasedAt) return; // released ones were let go, not raised
    add(
      entryFrom(seen, {
        finalID: seen.finalID,
        baseID: seen.baseID,
        defaultLevel: 100,
        fallbackId: `dex-${i}-${seen.finalID}`,
        chain: seen.chainOrder,
      }),
      seen.caughtAt,
    );
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

  const roster = firstOfEachSpecies(candidates).slice(0, MAX_ROSTER);
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

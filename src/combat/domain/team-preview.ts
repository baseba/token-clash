// Team preview: each side sees the rival's party (up to 6) and secretly picks the 3 that fight.
import { buildFighter, type Fighter } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { BATTLE_SIZE } from './battle.js';

export const PARTY_SIZE = 6;

export interface PreviewSide {
  trainerId: string;
  name: string;
  entries: RosterEntry[];
  /** Indexes into entries, once confirmed. */
  picks: number[] | null;
  /** What the side has marked so far, shown to spectators. */
  draft?: number[];
}

export interface PreviewState {
  levelCap: number | null;
  mode: string;
  sides: PreviewSide[];
  /** Both picked: everyone sees the picks for a moment before the battle. */
  revealed?: boolean;
}

export function createPreview({ sides, levelCap = null, mode = 'team' }: { sides: { trainerId: string; name: string; entries: RosterEntry[] }[]; levelCap?: number | null; mode?: string }): PreviewState {
  return {
    levelCap,
    mode,
    sides: sides.map((s) => ({ trainerId: s.trainerId, name: s.name, entries: s.entries.slice(0, PARTY_SIZE), picks: null })),
  };
}

export const picksNeeded = (p: PreviewState, s: number): number => Math.min(BATTLE_SIZE, p.sides[s].entries.length);

export function validPicks(p: PreviewState, s: number, picks: unknown): picks is number[] {
  const n = picksNeeded(p, s);
  return Array.isArray(picks) && picks.length === n && new Set(picks).size === n && picks.every((i) => Number.isInteger(i) && i >= 0 && i < p.sides[s].entries.length);
}

export function pick(p: PreviewState, s: number, picks: unknown): void {
  if (p.sides[s].picks) throw new Error('Ya elegiste tu equipo.');
  if (!validPicks(p, s, picks)) throw new Error(`Elige ${picksNeeded(p, s)} Pokémon distintos.`);
  p.sides[s].picks = [...picks];
}

export function randomPicks(p: PreviewState, s: number, random: () => number = Math.random): number[] {
  const order = p.sides[s].entries.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, picksNeeded(p, s));
}

export function fillMissing(p: PreviewState, random: () => number = Math.random): void {
  p.sides.forEach((side, s) => {
    if (!side.picks) side.picks = randomPicks(p, s, random);
  });
}

export const previewReady = (p: PreviewState): boolean => p.sides.every((s) => s.picks);

export const chosenEntries = (p: PreviewState, s: number): RosterEntry[] => p.sides[s].picks!.map((i) => p.sides[s].entries[i]);

/** What a rival sees of a Pokémon in your party: no stats, moves or ability. */
export type SeenCard = Pick<Fighter, 'name' | 'speciesName' | 'sprite' | 'shiny' | 'floats' | 'rarity' | 'types' | 'gender'>;

function seenCard(f: Fighter): SeenCard {
  return { name: f.name, speciesName: f.speciesName, sprite: f.sprite, shiny: f.shiny, floats: f.floats, rarity: f.rarity, types: f.types, gender: f.gender };
}

export interface PreviewSideView {
  trainerId: string;
  name: string;
  ready: boolean;
  needed: number;
  party: (Fighter | SeenCard)[];
  picks: number[] | null;
  draft: number[] | null;
  locked: number[] | null;
}

export interface PreviewView {
  levelCap: number | null;
  mode: string;
  sides: PreviewSideView[];
  revealed: boolean;
}

/** The preview as `viewer` (a side index, or null for a spectator) may see it. */
export function previewView(p: PreviewState, viewer: number | null = null): PreviewView {
  return {
    levelCap: p.levelCap,
    mode: p.mode ?? 'team',
    sides: p.sides.map((side, s) => {
      const fighters = side.entries.map((e) => buildFighter(e, { levelCap: p.levelCap }));
      const own = viewer === s;
      const watching = viewer === null;
      return {
        trainerId: side.trainerId,
        name: side.name,
        ready: !!side.picks,
        needed: picksNeeded(p, s),
        party: own || watching ? fighters : fighters.map(seenCard),
        picks: own || (watching && p.revealed) ? side.picks : null,
        draft: watching && !side.picks ? side.draft ?? [] : null,
        locked: watching && !!side.picks ? side.picks : null,
      };
    }),
    revealed: !!p.revealed,
  };
}

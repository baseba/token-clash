// Team preview: each side sees the rival's party (up to 6) and secretly picks the 3 that fight.
import { buildFighter, type Fighter } from './fighter.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { conflict, invalid } from '../../shared/domain/errors.js';
import { BATTLE_SIZE } from './battle.js';

export const PARTY_SIZE = 6;

export interface PreviewSide {
  trainerId: string;
  name: string;
  avatar?: string;
  frame?: string | null;
  entries: RosterEntry[];
  /** Indexes into entries, once confirmed. */
  picks: number[] | null;
  /** What the side has marked so far, shown to spectators. */
  draft?: number[];
  rerolled?: number;
}

export interface PreviewState {
  mode: string;
  sides: PreviewSide[];
  /** Both picked: everyone sees the picks for a moment before the battle. */
  revealed?: boolean;
}

export function createPreview({ sides, mode = 'team' }: { sides: { trainerId: string; name: string; avatar?: string; frame?: string | null; entries: RosterEntry[] }[]; mode?: string }): PreviewState {
  return {
    mode,
    sides: sides.map((s) => ({ trainerId: s.trainerId, name: s.name, ...(s.avatar ? { avatar: s.avatar } : {}), ...(s.frame ? { frame: s.frame } : {}), entries: s.entries.slice(0, PARTY_SIZE), picks: null })),
  };
}

export const picksNeeded = (preview: PreviewState, sideIndex: number): number => Math.min(BATTLE_SIZE, preview.sides[sideIndex].entries.length);

function validPicks(preview: PreviewState, sideIndex: number, picks: number[]): boolean {
  const needed = picksNeeded(preview, sideIndex);
  return picks.length === needed
    && new Set(picks).size === needed
    && picks.every((i) => Number.isInteger(i) && i >= 0 && i < preview.sides[sideIndex].entries.length);
}

export function pick(preview: PreviewState, sideIndex: number, picks: number[]): void {
  if (preview.sides[sideIndex].picks) throw conflict('Ya elegiste tu equipo.');
  if (!validPicks(preview, sideIndex, picks)) throw invalid(`Elige ${picksNeeded(preview, sideIndex)} Pokémon distintos.`);
  preview.sides[sideIndex].picks = [...picks];
}

export function randomPicks(preview: PreviewState, sideIndex: number, random: () => number = Math.random): number[] {
  const order = preview.sides[sideIndex].entries.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, picksNeeded(preview, sideIndex));
}

export function fillMissing(preview: PreviewState, random: () => number = Math.random): void {
  preview.sides.forEach((side, sideIndex) => {
    if (!side.picks) side.picks = randomPicks(preview, sideIndex, random);
  });
}

export const canReroll = (preview: PreviewState, sideIndex: number): boolean =>
  preview.mode === 'random' && !preview.revealed && preview.sides[sideIndex].rerolled === undefined && !preview.sides[sideIndex].picks;

export const previewReady = (preview: PreviewState): boolean => preview.sides.every((s) => s.picks);

export const chosenEntries = (preview: PreviewState, sideIndex: number): RosterEntry[] =>
  preview.sides[sideIndex].picks!.map((i) => preview.sides[sideIndex].entries[i]);

/** What a rival sees of a Pokémon in your party: no stats, moves or ability. */
export type SeenCard = Pick<Fighter, 'name' | 'speciesName' | 'sprite' | 'shiny' | 'floats' | 'rarity' | 'types' | 'gender'>;

function seenCard(fighter: Fighter): SeenCard {
  return {
    name: fighter.name,
    speciesName: fighter.speciesName,
    sprite: fighter.sprite,
    shiny: fighter.shiny,
    floats: fighter.floats,
    rarity: fighter.rarity,
    types: fighter.types,
    gender: fighter.gender,
  };
}

export interface PreviewSideView {
  trainerId: string;
  name: string;
  avatar: string | null;
  frame: string | null;
  ready: boolean;
  needed: number;
  party: (Fighter | SeenCard)[];
  picks: number[] | null;
  draft: number[] | null;
  locked: number[] | null;
  canReroll: boolean;
  rerolled: number | null;
}

export interface PreviewView {
  mode: string;
  sides: PreviewSideView[];
  revealed: boolean;
}

/** The preview as `viewer` (a side index, or null for a spectator) may see it. */
export function previewView(preview: PreviewState, viewer: number | null = null): PreviewView {
  return {
    mode: preview.mode ?? 'team',
    sides: preview.sides.map((side, sideIndex) => {
      const fighters = side.entries.map((e) => buildFighter(e));
      const own = viewer === sideIndex;
      const watching = viewer === null;
      return {
        trainerId: side.trainerId,
        name: side.name,
        avatar: side.avatar ?? null,
        frame: side.frame ?? null,
        ready: !!side.picks,
        needed: picksNeeded(preview, sideIndex),
        party: own || watching ? fighters : fighters.map(seenCard),
        picks: own || (watching && preview.revealed) ? side.picks : null,
        draft: watching && !side.picks ? side.draft ?? [] : null,
        locked: watching && !!side.picks ? side.picks : null,
        canReroll: canReroll(preview, sideIndex),
        rerolled: side.rerolled ?? null,
      };
    }),
    revealed: !!preview.revealed,
  };
}

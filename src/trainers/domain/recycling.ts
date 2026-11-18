import type { Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';

export type Duplicate = Pick<RosterEntry, 'id' | 'finalID' | 'rarity' | 'shiny' | 'level'>;

export interface RecycledRecord {
  id: string;
  finalID: number;
  rarity: Rarity;
  shiny: boolean;
  tokens: number;
  at: number;
}

export const RECYCLE_TOKENS: Readonly<Record<Rarity, number>> = {
  common: 20_000_000,
  uncommon: 40_000_000,
  rare: 100_000_000,
  legendary: 300_000_000,
};

export const SHINY_RECYCLE_MULTIPLIER = 3;

export const recycleReward = (entry: Pick<Duplicate, 'rarity' | 'shiny'>): number => RECYCLE_TOKENS[entry.rarity] * (entry.shiny ? SHINY_RECYCLE_MULTIPLIER : 1);

export const toDuplicate = ({ id, finalID, rarity, shiny, level }: RosterEntry): Duplicate => ({ id, finalID, rarity, shiny, level });

export const recycledTokens = (records: readonly RecycledRecord[]): number => records.reduce((sum, record) => sum + record.tokens, 0);

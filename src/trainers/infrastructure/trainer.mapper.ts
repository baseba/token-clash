// Translates between the Trainer aggregate and its rows. The domain never sees a row and the
// tables never see a Trainer: if the schema changes, only this file and the schema change.
import type { Gender, Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { Trainer } from '../domain/trainer.js';
import type { rosterEntries, RosterEntryRow, TrainerRow, trainers } from './trainer.schema.js';

/** Drops the keys whose column was NULL, so a restored entry looks like the one that was saved. */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;
}

export function toDomain(row: TrainerRow, roster: RosterEntryRow[]): Trainer {
  return Trainer.restore(
    compact({
      id: row.id,
      name: row.name,
      tokenHash: row.tokenHash,
      team: row.team,
      wins: row.wins,
      losses: row.losses,
      totalTokens: row.totalTokens,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
      lastSeen: row.lastSeen ?? undefined,
      roster: roster.sort((a, b) => a.position - b.position).map(entryToDomain),
    }),
  );
}

export function entryToDomain(r: RosterEntryRow): RosterEntry {
  return compact({
    id: r.entryId,
    finalID: r.speciesId,
    baseID: r.baseSpeciesId,
    rarity: r.rarity as Rarity,
    shiny: r.shiny,
    level: r.level,
    ivs: r.ivs,
    ability: r.ability,
    abilitySlot: r.abilitySlot as RosterEntry['abilitySlot'],
    gender: r.gender as Gender | null,
    nature: r.nature,
    learned: r.learned ?? undefined,
    moveset: r.moveset ?? undefined,
    abilityChoice: r.abilityChoice ?? undefined,
    nickname: r.nickname ?? undefined,
    stage: r.stage ?? undefined,
    chainLen: r.chainLen ?? undefined,
    active: r.active ?? undefined,
  });
}

export function toRow(t: Trainer): typeof trainers.$inferInsert {
  return {
    id: t.id,
    name: t.name,
    tokenHash: t.tokenHash,
    team: t.team,
    wins: t.wins,
    losses: t.losses,
    totalTokens: t.totalTokens ?? 0,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt ?? null,
    lastSeen: t.lastSeen ?? null,
  };
}

export function entryToRow(trainerId: string, e: RosterEntry, position: number): typeof rosterEntries.$inferInsert {
  return {
    trainerId,
    position,
    entryId: e.id,
    speciesId: e.finalID,
    baseSpeciesId: e.baseID,
    rarity: e.rarity,
    shiny: !!e.shiny,
    level: e.level,
    ivs: e.ivs,
    ability: e.ability ?? null,
    abilitySlot: e.abilitySlot ?? null,
    gender: e.gender ?? null,
    nature: e.nature ?? null,
    learned: e.learned ?? null,
    moveset: e.moveset ?? null,
    abilityChoice: e.abilityChoice ?? null,
    nickname: e.nickname ?? null,
    stage: e.stage ?? null,
    chainLen: e.chainLen ?? null,
    active: e.active ?? null,
  };
}

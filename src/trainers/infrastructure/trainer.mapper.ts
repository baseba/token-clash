// Translates between the Trainer aggregate and its rows. The domain never sees a row and the
// tables never see a Trainer: if the schema changes, only this file and the schema change.
import type { Gender, Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { compact } from '../../shared/infrastructure/database/compact.js';
import { Trainer } from '../domain/trainer.js';
import type { rosterEntries, RosterEntryRow, TrainerRow, trainers, trainerSessions, TrainerSessionRow } from './trainer.schema.js';

export function toDomain(row: TrainerRow, roster: RosterEntryRow[], sessions: TrainerSessionRow[] = []): Trainer {
  return Trainer.restore(
    compact({
      id: row.id,
      name: row.name,
      tokenHash: row.tokenHash,
      passwordHash: row.passwordHash ?? undefined,
      sessions: sessions.length ? [...sessions].sort((a, b) => a.openedAt - b.openedAt).map(({ tokenHash, openedAt }) => ({ tokenHash, openedAt })) : undefined,
      team: row.team,
      wins: row.wins,
      losses: row.losses,
      totalTokens: row.totalTokens,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt ?? undefined,
      lastSeen: row.lastSeen ?? undefined,
      avatar: row.avatar ?? undefined,
      shopBaseline: row.shopBaseline ?? undefined,
      shopSpent: row.shopSpent || undefined,
      owned: row.owned?.length ? row.owned : undefined,
      equipped: row.equipped && Object.keys(row.equipped).length ? row.equipped : undefined,
      duplicates: row.duplicates?.length ? row.duplicates : undefined,
      recycled: row.recycled?.length ? row.recycled : undefined,
      roster: roster.sort((a, b) => a.position - b.position).map(entryToDomain),
    }),
  );
}

export function entryToDomain(row: RosterEntryRow): RosterEntry {
  return compact({
    id: row.entryId,
    finalID: row.speciesId,
    baseID: row.baseSpeciesId,
    rarity: row.rarity as Rarity,
    shiny: row.shiny,
    level: row.level,
    ivs: row.ivs,
    ability: row.ability,
    abilitySlot: row.abilitySlot as RosterEntry['abilitySlot'],
    gender: row.gender as Gender | null,
    nature: row.nature,
    learned: row.learned ?? undefined,
    moveset: row.moveset ?? undefined,
    abilityChoice: row.abilityChoice ?? undefined,
    nickname: row.nickname ?? undefined,
    stage: row.stage ?? undefined,
    chainLen: row.chainLen ?? undefined,
    active: row.active ?? undefined,
  });
}

export function toRow(trainer: Trainer): typeof trainers.$inferInsert {
  return {
    id: trainer.id,
    name: trainer.name,
    tokenHash: trainer.tokenHash,
    passwordHash: trainer.passwordHash ?? null,
    team: trainer.team,
    wins: trainer.wins,
    losses: trainer.losses,
    totalTokens: trainer.totalTokens ?? 0,
    createdAt: trainer.createdAt,
    updatedAt: trainer.updatedAt ?? null,
    lastSeen: trainer.lastSeen ?? null,
    avatar: trainer.avatar ?? null,
    shopBaseline: trainer.shopBaseline ?? null,
    shopSpent: trainer.shopSpent ?? 0,
    owned: trainer.owned ?? [],
    equipped: trainer.equipped ?? null,
    duplicates: trainer.duplicates ?? [],
    recycled: trainer.recycled ?? [],
  };
}

export function entryToRow(trainerId: string, entry: RosterEntry, position: number): typeof rosterEntries.$inferInsert {
  return {
    trainerId,
    position,
    entryId: entry.id,
    speciesId: entry.finalID,
    baseSpeciesId: entry.baseID,
    rarity: entry.rarity,
    shiny: !!entry.shiny,
    level: entry.level,
    ivs: entry.ivs,
    ability: entry.ability ?? null,
    abilitySlot: entry.abilitySlot ?? null,
    gender: entry.gender ?? null,
    nature: entry.nature ?? null,
    learned: entry.learned ?? null,
    moveset: entry.moveset ?? null,
    abilityChoice: entry.abilityChoice ?? null,
    nickname: entry.nickname ?? null,
    stage: entry.stage ?? null,
    chainLen: entry.chainLen ?? null,
    active: entry.active ?? null,
  };
}

export function sessionsToRows(trainer: Trainer): (typeof trainerSessions.$inferInsert)[] {
  return (trainer.sessions ?? []).map(({ tokenHash, openedAt }) => ({ tokenHash, trainerId: trainer.id, openedAt }));
}

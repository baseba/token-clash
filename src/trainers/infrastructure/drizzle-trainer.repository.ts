// Adapter: TrainerRepository on SQLite through Drizzle.
//
// It is also an *identity map*: every trainer is loaded once at startup and the same object is
// handed out afterwards, so two parts of the app never hold diverging copies of one trainer. Reads
// come from memory (a few dozen trainers); every save writes through to SQLite at once, inside a
// transaction. If the data ever outgrows memory, only this class changes.
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import type { Database } from '../../shared/infrastructure/database/database.js';
import type { Trainer } from '../domain/trainer.js';
import { TrainerRepository } from '../domain/trainer.repository.js';
import { entryToRow, sessionsToRows, toDomain, toRow } from './trainer.mapper.js';
import { rosterEntries, trainers, trainerSessions, type RosterEntryRow, type TrainerSessionRow } from './trainer.schema.js';

const CHUNK = 100;

@Injectable()
export class DrizzleTrainerRepository extends TrainerRepository {
  private readonly byId = new Map<string, Trainer>();
  private readonly byToken = new Map<string, Trainer>();
  private readonly tokensOf = new Map<string, string[]>();

  constructor(@InjectDrizzle() private readonly db: Database) {
    super();
    const roster = new Map<string, RosterEntryRow[]>();
    for (const row of this.db.select().from(rosterEntries).all()) roster.set(row.trainerId, [...(roster.get(row.trainerId) ?? []), row]);
    const sessions = new Map<string, TrainerSessionRow[]>();
    for (const row of this.db.select().from(trainerSessions).all()) sessions.set(row.trainerId, [...(sessions.get(row.trainerId) ?? []), row]);
    for (const row of this.db.select().from(trainers).all()) this.remember(toDomain(row, roster.get(row.id) ?? [], sessions.get(row.id) ?? []));
  }

  private remember(trainer: Trainer): void {
    for (const token of this.tokensOf.get(trainer.id) ?? []) this.byToken.delete(token);
    this.byId.set(trainer.id, trainer);
    for (const token of trainer.sessionHashes) this.byToken.set(token, trainer);
    this.tokensOf.set(trainer.id, trainer.sessionHashes);
  }

  all(): Trainer[] {
    return [...this.byId.values()];
  }

  findById(id: string): Trainer | undefined {
    return this.byId.get(id);
  }

  findByTokenHash(tokenHash: string): Trainer | undefined {
    return this.byToken.get(tokenHash);
  }

  save(trainer: Trainer): void {
    const row = toRow(trainer);
    const entries = trainer.roster.map((e, i) => entryToRow(trainer.id, e, i));
    const sessions = sessionsToRows(trainer);
    this.db.transaction((tx) => {
      tx.insert(trainers).values(row).onConflictDoUpdate({ target: trainers.id, set: row }).run();
      tx.delete(rosterEntries).where(eq(rosterEntries.trainerId, trainer.id)).run();
      for (let i = 0; i < entries.length; i += CHUNK) tx.insert(rosterEntries).values(entries.slice(i, i + CHUNK)).run();
      tx.delete(trainerSessions).where(eq(trainerSessions.trainerId, trainer.id)).run();
      if (sessions.length) tx.insert(trainerSessions).values(sessions).run();
    });
    this.remember(trainer);
  }

  saveLastSeen(trainer: Trainer): void {
    this.db.update(trainers).set({ lastSeen: trainer.lastSeen ?? null }).where(eq(trainers.id, trainer.id)).run();
  }
}

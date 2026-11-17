// Adapters: the arena repositories on SQLite through Drizzle. Like the trainers one, they are
// identity maps: loaded once, the same object handed out afterwards (live rooms and their timers
// keep references to a challenge or tournament and must see every change), writes go through.
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import type { Database } from '../../shared/infrastructure/database/database.js';
import { ChallengeRepository, TournamentRepository } from '../domain/arena.repositories.js';
import type { Challenge } from '../domain/challenge.js';
import type { Tournament } from '../domain/tournament.js';
import { challengeToDomain, challengeToRow, tournamentToDomain, tournamentToRows } from './arena.mapper.js';
import { challenges, tournamentMatches, tournaments, tournamentSeats, type MatchRow, type SeatRow } from './arena.schema.js';

const groupBy = <T>(rows: T[], key: (r: T) => string) => {
  const out = new Map<string, T[]>();
  for (const r of rows) out.set(key(r), [...(out.get(key(r)) ?? []), r]);
  return out;
};

@Injectable()
export class DrizzleChallengeRepository extends ChallengeRepository {
  private readonly byId = new Map<string, Challenge>();

  constructor(@InjectDrizzle() private readonly db: Database) {
    super();
    for (const row of this.db.select().from(challenges).all()) {
      const c = challengeToDomain(row);
      this.byId.set(c.id, c);
    }
  }

  all(): Challenge[] {
    return [...this.byId.values()];
  }

  findById(id: string): Challenge | undefined {
    return this.byId.get(id);
  }

  save(c: Challenge): void {
    const row = challengeToRow(c);
    this.db.insert(challenges).values(row).onConflictDoUpdate({ target: challenges.id, set: row }).run();
    this.byId.set(c.id, c);
  }
}

@Injectable()
export class DrizzleTournamentRepository extends TournamentRepository {
  private readonly byId = new Map<string, Tournament>();

  constructor(@InjectDrizzle() private readonly db: Database) {
    super();
    const seats = groupBy<SeatRow>(this.db.select().from(tournamentSeats).all(), (r) => r.tournamentId);
    const matches = groupBy<MatchRow>(this.db.select().from(tournamentMatches).all(), (r) => r.tournamentId);
    for (const row of this.db.select().from(tournaments).all()) {
      const t = tournamentToDomain(row, seats.get(row.id) ?? [], matches.get(row.id) ?? []);
      this.byId.set(t.id, t);
    }
  }

  all(): Tournament[] {
    return [...this.byId.values()];
  }

  findById(id: string): Tournament | undefined {
    return this.byId.get(id);
  }

  /** The whole aggregate, in one transaction: tournament row, its seats and its bracket. */
  save(t: Tournament): void {
    const rows = tournamentToRows(t);
    this.db.transaction((tx) => {
      tx.insert(tournaments).values(rows.tournament).onConflictDoUpdate({ target: tournaments.id, set: rows.tournament }).run();
      tx.delete(tournamentSeats).where(eq(tournamentSeats.tournamentId, t.id)).run();
      tx.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, t.id)).run();
      if (rows.seats.length) tx.insert(tournamentSeats).values(rows.seats).run();
      if (rows.matches.length) tx.insert(tournamentMatches).values(rows.matches).run();
    });
    this.byId.set(t.id, t);
  }
}

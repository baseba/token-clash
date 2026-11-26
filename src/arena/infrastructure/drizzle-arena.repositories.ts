import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import type { Database } from '../../platform/database/database.js';
import { ChallengeRepository, TournamentRepository } from '../domain/arena.repositories.js';
import type { Challenge } from '../domain/challenge.js';
import type { Tournament } from '../domain/tournament.js';
import { challengeToDomain, challengeToRow, tournamentToDomain, tournamentToRows } from './arena.mapper.js';
import { challenges, tournamentMatches, tournaments, tournamentSeats, type MatchRow, type SeatRow } from './arena.schema.js';

const groupBy = <T>(rows: T[], key: (row: T) => string) => {
  const out = new Map<string, T[]>();
  for (const row of rows) out.set(key(row), [...(out.get(key(row)) ?? []), row]);
  return out;
};

@Injectable()
export class DrizzleChallengeRepository extends ChallengeRepository {
  private readonly byId = new Map<string, Challenge>();

  constructor(@InjectDrizzle() private readonly db: Database) {
    super();
    for (const row of this.db.select().from(challenges).all()) {
      const challenge = challengeToDomain(row);
      this.byId.set(challenge.id, challenge);
    }
  }

  all(): Challenge[] {
    return [...this.byId.values()];
  }

  findById(id: string): Challenge | undefined {
    return this.byId.get(id);
  }

  save(challenge: Challenge): void {
    const row = challengeToRow(challenge);
    this.db.insert(challenges).values(row).onConflictDoUpdate({ target: challenges.id, set: row }).run();
    this.byId.set(challenge.id, challenge);
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
      const tournament = tournamentToDomain(row, seats.get(row.id) ?? [], matches.get(row.id) ?? []);
      this.byId.set(tournament.id, tournament);
    }
  }

  all(): Tournament[] {
    return [...this.byId.values()];
  }

  findById(id: string): Tournament | undefined {
    return this.byId.get(id);
  }

  save(tournament: Tournament): void {
    const rows = tournamentToRows(tournament);
    this.db.transaction((tx) => {
      tx.insert(tournaments).values(rows.tournament).onConflictDoUpdate({ target: tournaments.id, set: rows.tournament }).run();
      tx.delete(tournamentSeats).where(eq(tournamentSeats.tournamentId, tournament.id)).run();
      tx.delete(tournamentMatches).where(eq(tournamentMatches.tournamentId, tournament.id)).run();
      if (rows.seats.length) tx.insert(tournamentSeats).values(rows.seats).run();
      if (rows.matches.length) tx.insert(tournamentMatches).values(rows.matches).run();
    });
    this.byId.set(tournament.id, tournament);
  }
}

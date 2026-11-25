import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import type { FinalBattleState, Staging } from '../domain/challenge.js';
import type { MatchRef } from '../domain/tournament.js';

export const challenges = sqliteTable(
  'challenges',
  {
    id: text().primaryKey(),
    status: text().notNull(),
    mode: text().notNull(),
    levelCap: integer('level_cap'),
    visibility: text().notNull(),
    ai: text(),
    aiOnly: integer('ai_only', { mode: 'boolean' }),
    hostId: text('host_id').notNull(),
    hostName: text('host_name').notNull(),
    hostTeam: text('host_team', { mode: 'json' }).$type<RosterEntry[]>().notNull(),
    guestId: text('guest_id'),
    guestName: text('guest_name'),
    guestTeam: text('guest_team', { mode: 'json' }).$type<RosterEntry[]>(),
    tournamentId: text('tournament_id'),
    round: integer(),
    matchIndex: integer('match_index'),
    winnerId: text('winner_id'),
    turns: integer(),
    final: text({ mode: 'json' }).$type<FinalBattleState>(),
    createdAt: integer('created_at').notNull(),
    finishedAt: integer('finished_at'),
    staging: text({ mode: 'json' }).$type<Staging>(),
  },
  (t) => [index('challenges_host').on(t.hostId), index('challenges_guest').on(t.guestId), index('challenges_status').on(t.status), index('challenges_tournament').on(t.tournamentId)],
);

export const tournaments = sqliteTable('tournaments', {
  id: text().primaryKey(),
  hostId: text('host_id').notNull(),
  mode: text().notNull(),
  levelCap: integer('level_cap'),
  size: integer().notNull(),
  visibility: text().notNull(),
  status: text().notNull(),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at'),
  drawAt: integer('draw_at'),
  aiLevel: integer('ai_level'),
  nextAt: integer('next_at'),
  current: text({ mode: 'json' }).$type<MatchRef & { challengeId: string }>(),
  champion: integer(),
  finishedAt: integer('finished_at'),
});

export const tournamentSeats = sqliteTable(
  'tournament_seats',
  {
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    seatId: text('seat_id').notNull(),
    name: text().notNull(),
    ai: text(),
    aiBase: text('ai_base'),
    ready: integer({ mode: 'boolean' }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.tournamentId, t.position] })],
);

export const tournamentMatches = sqliteTable(
  'tournament_matches',
  {
    tournamentId: text('tournament_id')
      .notNull()
      .references(() => tournaments.id, { onDelete: 'cascade' }),
    round: integer().notNull(),
    position: integer().notNull(),
    seatA: integer('seat_a'),
    seatB: integer('seat_b'),
    winner: integer(),
    coinFlip: integer('coin_flip', { mode: 'boolean' }),
    challengeId: text('challenge_id'),
  },
  (t) => [primaryKey({ columns: [t.tournamentId, t.round, t.position] })],
);

export type ChallengeRow = typeof challenges.$inferSelect;
export type TournamentRow = typeof tournaments.$inferSelect;
export type SeatRow = typeof tournamentSeats.$inferSelect;
export type MatchRow = typeof tournamentMatches.$inferSelect;

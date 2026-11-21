// The table owned by the tower context. The trainer and the battle are referenced by id only: they
// belong to other contexts.
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { FloorResult, TowerMon } from '../domain/tower-run.js';
import type { Offer } from '../domain/lab.js';
import type { Reward } from '../domain/rewards.js';
import type { Rolls } from '../domain/floors.js';
import type { FloorScore } from '../domain/score.js';

export const towerRuns = sqliteTable(
  'tower_runs',
  {
    id: text().primaryKey(),
    trainerId: text('trainer_id').notNull(),
    difficulty: text().notNull(),
    length: integer(),
    seed: text().notNull(),
    status: text().notNull(),
    floor: integer().notNull(),
    party: text({ mode: 'json' }).$type<TowerMon[]>().notNull(),
    offers: text({ mode: 'json' }).$type<Offer[]>().notNull(),
    rewards: text({ mode: 'json' }).$type<Reward[]>().notNull(),
    room: text(),
    picks: integer().notNull().default(0),
    rerolls: integer().notNull().default(0),
    rolls: text({ mode: 'json' }).$type<Rolls>().notNull().default({}),
    log: text({ mode: 'json' }).$type<FloorScore[]>().notNull().default([]),
    challengeId: text('challenge_id'),
    lastResult: text('last_result', { mode: 'json' }).$type<FloorResult>(),
    cleared: integer().notNull(),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    finishedAt: integer('finished_at'),
  },
  (t) => [index('tower_runs_trainer').on(t.trainerId), index('tower_runs_status').on(t.status)],
);

export type TowerRunRow = typeof towerRuns.$inferSelect;

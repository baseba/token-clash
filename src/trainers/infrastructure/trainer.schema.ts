import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Ivs } from '../../catalog/domain/roster-entry.js';
import type { Duplicate, RecycledRecord } from '../domain/recycling.js';

export const trainers = sqliteTable(
  'trainers',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    passwordHash: text('password_hash'),
    team: text({ mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    wins: integer().notNull().default(0),
    losses: integer().notNull().default(0),
    totalTokens: integer('total_tokens').notNull().default(0),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at'),
    lastSeen: integer('last_seen'),
    avatar: text(),
    shopBaseline: integer('shop_baseline'),
    shopSpent: integer('shop_spent').notNull().default(0),
    owned: text({ mode: 'json' }).$type<string[]>().notNull().default(sql`'[]'`),
    equipped: text({ mode: 'json' }).$type<Record<string, string>>(),
    duplicates: text({ mode: 'json' }).$type<Duplicate[]>().notNull().default(sql`'[]'`),
    recycled: text({ mode: 'json' }).$type<RecycledRecord[]>().notNull().default(sql`'[]'`),
  },
);

export const rosterEntries = sqliteTable(
  'roster_entries',
  {
    trainerId: text('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    entryId: text('entry_id').notNull(),
    speciesId: integer('species_id').notNull(),
    baseSpeciesId: integer('base_species_id').notNull(),
    rarity: text().notNull(),
    shiny: integer({ mode: 'boolean' }).notNull(),
    level: integer().notNull(),
    ivs: text({ mode: 'json' }).$type<Ivs>().notNull(),
    ability: text(),
    abilitySlot: integer('ability_slot'),
    gender: text(),
    nature: text(),
    learned: text({ mode: 'json' }).$type<string[]>(),
    moveset: text({ mode: 'json' }).$type<string[]>(),
    abilityChoice: text('ability_choice'),
    natureChoice: text('nature_choice'),
    evs: text({ mode: 'json' }).$type<Ivs>(),
    nickname: text(),
    stage: integer(),
    chainLen: integer('chain_len'),
    active: integer({ mode: 'boolean' }),
  },
  (t) => [
    primaryKey({ columns: [t.trainerId, t.position] }),
    index('roster_entries_entry_id').on(t.entryId),
  ],
);

export const trainerSessions = sqliteTable(
  'trainer_sessions',
  {
    tokenHash: text('token_hash').primaryKey(),
    trainerId: text('trainer_id')
      .notNull()
      .references(() => trainers.id, { onDelete: 'cascade' }),
    openedAt: integer('opened_at').notNull(),
  },
  (t) => [index('trainer_sessions_trainer_id').on(t.trainerId)],
);

export type TrainerRow = typeof trainers.$inferSelect;
export type RosterEntryRow = typeof rosterEntries.$inferSelect;
export type TrainerSessionRow = typeof trainerSessions.$inferSelect;

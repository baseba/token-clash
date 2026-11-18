// Tables owned by the trainers context. No other context reads or writes them: they ask
// TrainersService. Drizzle infers the row types from these definitions, and drizzle-kit generates
// the SQL migrations in drizzle/ from them (npm run db:generate).
import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { Ivs } from '../../catalog/domain/roster-entry.js';

export const trainers = sqliteTable(
  'trainers',
  {
    id: text().primaryKey(),
    name: text().notNull(),
    tokenHash: text('token_hash').notNull().unique(),
    /** Roster entry ids, leader first. A small ordered list that is always read whole: JSON. */
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
  },
);

/** One row per Pokémon in a trainer's collection, in roster order. */
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
    nickname: text(),
    stage: integer(),
    chainLen: integer('chain_len'),
    active: integer({ mode: 'boolean' }),
  },
  (t) => [
    primaryKey({ columns: [t.trainerId, t.position] }),
    // The same save imported in two accounts shares instance ids: stats use it to count people once.
    index('roster_entries_entry_id').on(t.entryId),
  ],
);

export type TrainerRow = typeof trainers.$inferSelect;
export type RosterEntryRow = typeof rosterEntries.$inferSelect;

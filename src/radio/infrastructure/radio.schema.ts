import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { RadioTrackId } from '../domain/radio-tracks.js';

export const radioStations = sqliteTable('radio_stations', {
  ownerId: text('owner_id').primaryKey(),
  name: text().notNull(),
  openedAt: integer('opened_at').notNull(),
  queue: text({ mode: 'json' }).$type<RadioTrackId[]>().notNull(),
  nowPlayingTrack: text('now_playing_track'),
  nowPlayingStartedAt: integer('now_playing_started_at'),
  nowPlayingEndsAt: integer('now_playing_ends_at'),
});

export type StationRow = typeof radioStations.$inferSelect;

// Tables owned by the radio context. The owner is a trainer referenced by id only (no foreign key):
// radio must not depend on how trainers are stored.
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import type { RadioTrackId } from '../../catalog/domain/radio-tracks.js';

export const radioStations = sqliteTable('radio_stations', {
  ownerId: text('owner_id').primaryKey(),
  name: text().notNull(),
  openedAt: integer('opened_at').notNull(),
  /** The songs waiting their turn, in order: JSON. */
  queue: text({ mode: 'json' }).$type<RadioTrackId[]>().notNull(),
  /** The song on air: all three set, or all three null while nothing was ever queued. */
  nowPlayingTrack: text('now_playing_track'),
  nowPlayingStartedAt: integer('now_playing_started_at'),
  nowPlayingEndsAt: integer('now_playing_ends_at'),
});

export type StationRow = typeof radioStations.$inferSelect;

import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Facts about the database itself, such as when the old data/db.json was imported. */
export const appMeta = sqliteTable('app_meta', {
  key: text().primaryKey(),
  value: text({ mode: 'json' }).notNull(),
});

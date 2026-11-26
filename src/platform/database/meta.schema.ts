import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const appMeta = sqliteTable('app_meta', {
  key: text().primaryKey(),
  value: text({ mode: 'json' }).notNull(),
});

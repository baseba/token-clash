// The SQLite database: one file in DATA_DIR, opened with Node's built-in driver (node:sqlite, so no
// native module to compile) through Drizzle. The schema lives next to each context
// (*/infrastructure/*.schema.ts) and drizzle-kit turns it into the SQL migrations in drizzle/.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle, type NodeSQLiteDatabase } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { PROJECT_ROOT } from '../../paths.js';

export type Database = NodeSQLiteDatabase;

export const MIGRATIONS_DIR = join(PROJECT_ROOT, 'drizzle');
export const DATABASE_FILE = 'token-clash.db';

/** Opens (or creates) the database and brings its schema up to date. */
export function openDatabase(file: string): Database {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const client = new DatabaseSync(file);
  // WAL: readers never wait for the writer, and a crash can't leave a half-written file.
  client.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  const db = drizzle({ client });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { drizzle } from 'drizzle-orm/node-sqlite';
import { migrate } from 'drizzle-orm/node-sqlite/migrator';
import { MIGRATIONS_DIR, openDatabase } from '../../shared/infrastructure/database/database.js';
import { parseSave } from '../../trainers/domain/save-file.js';
import { PROJECT_ROOT } from '../../shared/paths.js';
import { DrizzleChallengeRepository } from './drizzle-arena.repositories.js';

const INITIAL = '20261117022843_initial';
const BACKFILL = '20261117123258_challenge_mode_visibility_backfill';
const { roster } = parseSave(readFileSync(join(PROJECT_ROOT, 'test', 'fixtures', 'export.json'), 'utf8'));
const team = JSON.stringify(roster.slice(0, 2));
const final = JSON.stringify({ winner: 0, sides: [{ team: [{ speciesName: 'Pikachu' }] }, { team: [{ hidden: true }] }] });

const rows = [
  { id: 'old-open', status: 'open', mode: null, visibility: null, host_team: team, created_at: 1 },
  { id: 'old-done', status: 'finished', mode: null, visibility: null, host_team: team, guest_id: 't2', guest_name: 'Beto', guest_team: team, winner_id: 't1', turns: 7, final, created_at: 2, finished_at: 3 },
  { id: 'no-visibility', status: 'finished', mode: 'random', visibility: null, level_cap: 50, host_team: team, guest_id: 'ai:hard', guest_name: 'IA', guest_team: team, ai: 'hard', turns: 4, final, created_at: 4, finished_at: 5 },
  { id: 'current', status: 'cancelled', mode: 'random', visibility: 'public', host_team: '[]', created_at: 6 },
  { id: 'match', status: 'abandoned', mode: 'team', visibility: 'private', host_team: team, guest_id: 'ai:easy#1', guest_name: 'tom ai', guest_team: team, ai: 'easy', ai_only: 0, tournament_id: 'T1', round: 0, match_index: 1, created_at: 7 },
];

function databaseAt(upTo: string[], rowsToWrite: Record<string, string | number | null>[]): string {
  const dir = mkdtempSync(join(tmpdir(), 'tc-migrations-'));
  for (const name of upTo) cpSync(join(MIGRATIONS_DIR, name), join(dir, 'migrations', name), { recursive: true });
  const file = join(dir, 'token-clash.db');
  const client = new DatabaseSync(file);
  migrate(drizzle({ client }), { migrationsFolder: join(dir, 'migrations') });
  for (const row of rowsToWrite) {
    const columns = Object.keys(row);
    client.prepare(`INSERT INTO challenges (host_id, host_name, ${columns.join(', ')}) VALUES ('t1', 'Ana', ${columns.map(() => '?').join(', ')})`).run(...Object.values(row));
  }
  client.close();
  return file;
}

const rawRows = (file: string) => new DatabaseSync(file).prepare('SELECT * FROM challenges ORDER BY id').all().map((row) => ({ ...row }));

test('old rooms without mode or visibility become private team battles; nothing else changes', () => {
  const file = databaseAt([INITIAL], rows);
  const before = rawRows(file);
  const db = openDatabase(file);
  const after = rawRows(file);

  const defaults = { mode: 'team', visibility: 'private' };
  const addedLater = { staging: null };
  assert.deepEqual(
    after,
    before.map((row) => ({ ...row, ...addedLater, mode: row.mode ?? defaults.mode, visibility: row.visibility ?? defaults.visibility })),
  );
  const read = Object.fromEntries(new DrizzleChallengeRepository(db).all().map((c) => [c.id, [c.mode, c.visibility]]));
  assert.deepEqual(read, {
    'old-open': ['team', 'private'],
    'old-done': ['team', 'private'],
    'no-visibility': ['random', 'private'],
    current: ['random', 'public'],
    match: ['team', 'private'],
  });
  const indexes = new DatabaseSync(file).prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name = 'challenges' AND sql IS NOT NULL ORDER BY name").all();
  assert.deepEqual(indexes.map((index) => index.name), ['challenges_guest', 'challenges_host', 'challenges_status', 'challenges_tournament']);
});

test('a NULL written by a rollback between the two steps is filled before the column becomes NOT NULL', () => {
  const rolledBack = { id: 'rolled-back', status: 'open', mode: null, visibility: null, host_team: '[]', created_at: 8 };
  const file = databaseAt([INITIAL, BACKFILL], [rolledBack]);
  const challenge = new DrizzleChallengeRepository(openDatabase(file)).findById('rolled-back');
  assert.deepEqual([challenge?.mode, challenge?.visibility], ['team', 'private']);
  assert.throws(() => new DatabaseSync(file).prepare("INSERT INTO challenges (id, status, host_id, host_name, host_team, created_at) VALUES ('x', 'open', 't1', 'Ana', '[]', 9)").run(), /NOT NULL/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importLegacyJson } from './legacy-json-import.js';
import { openDatabase } from '../platform/database/database.js';
import { DrizzleTrainerRepository } from '../trainers/infrastructure/drizzle-trainer.repository.js';
import { DrizzleChallengeRepository, DrizzleTournamentRepository } from '../arena/infrastructure/drizzle-arena.repositories.js';
import { parseSave } from '../trainers/domain/save-file.js';
import { PROJECT_ROOT } from '../shared/paths.js';

function normalize(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(normalize);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== null && x !== undefined).map(([k, x]) => [k, normalize(x)]).sort(([a], [b]) => String(a).localeCompare(String(b))));
  return v;
}

const { roster } = parseSave(readFileSync(join(PROJECT_ROOT, 'test', 'fixtures', 'export.json'), 'utf8'));

function syntheticLegacy() {
  const team = roster.map((e) => ({ ...e }));
  team[0] = { ...team[0], nickname: 'Chispa', moveset: ['tackle'], abilityChoice: 'static', active: true };
  team[1] = { ...team[1], ability: null, gender: null } as any;
  delete (team[2] as any).learned;
  const final = { id: 'c1', status: 'finished', phase: 'end', turn: 7, winner: 0, levelCap: 50, sides: [{ team: [{ speciesName: 'Pikachu', sprite: '25', types: ['electric'] }] }, { team: [{ hidden: true }] }] };
  return {
    trainers: {
      t1: { id: 't1', name: 'Ana', tokenHash: 'h1', roster: team, team: [team[0].id, team[1].id], wins: 3, losses: 1, createdAt: 1, totalTokens: 12345678901, updatedAt: 2, lastSeen: 3 },
      t2: { id: 't2', name: 'Beto', tokenHash: 'h2', roster: [{ ...team[3] }], team: [], wins: 0, losses: 0, createdAt: 4, totalTokens: 0, updatedAt: 5 },
    },
    challenges: {
      c1: { id: 'c1', hostId: 't1', hostName: 'Ana', hostTeam: team.slice(0, 2), levelCap: 50, status: 'finished', createdAt: 10, guestId: 't2', guestName: 'Beto', guestTeam: [team[3]], finishedAt: 20, turns: 7, final, winnerId: 't1', mode: 'random', visibility: 'public' },
      c2: { id: 'c2', hostId: 't1', hostName: 'Ana', hostTeam: [team[0]], levelCap: null, status: 'open', createdAt: 30 },
      c3: { id: 'c3', hostId: 't1', hostName: 'Ana', hostTeam: [team[0]], guestId: 'ai:hard#1', guestName: 'nora ai - difícil', guestTeam: [team[1]], levelCap: null, status: 'finished', createdAt: 40, mode: 'team', ai: 'hard', aiOnly: false, visibility: 'private', tournamentId: 'T1', round: 0, match: 1, finishedAt: 41, turns: 3, winnerId: null, final },
      c4: { id: 'c4', hostId: 't2', hostName: 'Beto', hostTeam: [team[3]], levelCap: null, status: 'active', createdAt: 50, guestId: 't1', guestName: 'Ana', guestTeam: [team[0]], mode: 'team' },
    },
    tournaments: {
      T1: {
        id: 'T1', hostId: 't1', mode: 'team', levelCap: null, size: 4, visibility: 'public', status: 'finished', createdAt: 100, startedAt: 101, drawAt: 101, aiLevel: 30, nextAt: null, current: null, champion: 2, finishedAt: 200,
        seats: [{ id: 't1', name: 'Ana', ai: null, ready: true }, { id: 't2', name: 'Beto', ai: null, ready: true }, { id: 'ai:hard#1', name: 'nora ai - difícil', ai: 'hard', aiBase: 'nora ai', ready: true }, { id: 'ai:easy#1', name: 'tom ai - fácil', ai: 'easy', aiBase: 'tom ai', ready: true }],
        bracket: [[{ a: 0, b: 1, winner: 0, challengeId: 'cx' }, { a: 2, b: 3, winner: 2, challengeId: 'c3', coinFlip: true }], [{ a: 0, b: 2, winner: 2, challengeId: 'cy' }]],
      },
      T2: { id: 'T2', hostId: 't2', mode: 'random', levelCap: 50, size: 8, visibility: 'private', status: 'open', createdAt: 300, seats: [{ id: 't2', name: 'Beto', ai: null, ready: false }] },
    },
  };
}

function expected(legacy: any) {
  const challenges = Object.entries(legacy.challenges ?? {}).map(([id, { levelCap, ...c }]: [string, any]) => [id, { ...c, mode: c.mode ?? 'team', visibility: c.visibility ?? 'private' }]);
  const tournaments = Object.entries(legacy.tournaments ?? {}).map(([id, { levelCap, aiLevel, ...t }]: [string, any]) => [id, t]);
  return { trainers: legacy.trainers ?? {}, challenges: Object.fromEntries(challenges), tournaments: Object.fromEntries(tournaments) };
}

function roundTrip(legacy: any) {
  const dir = mkdtempSync(join(tmpdir(), 'tc-legacy-'));
  writeFileSync(join(dir, 'db.json'), JSON.stringify(legacy));
  const db = openDatabase(join(dir, 'token-clash.db'));
  const result = importLegacyJson(db, dir);
  assert.equal(importLegacyJson(db, dir).reason, 'already-imported');
  assert.equal(readFileSync(join(dir, 'db.json'), 'utf8'), JSON.stringify(legacy));
  const read = {
    trainers: Object.fromEntries(new DrizzleTrainerRepository(db).all().map((t) => [t.id, { ...t }])),
    challenges: Object.fromEntries(new DrizzleChallengeRepository(db).all().map((c) => [c.id, { ...c }])),
    tournaments: Object.fromEntries(new DrizzleTournamentRepository(db).all().map((t) => [t.id, { ...t }])),
  };
  return { result, read };
}

test('importing db.json and reading it back gives exactly the same data', () => {
  const legacy = syntheticLegacy();
  const { result, read } = roundTrip(legacy);
  assert.deepEqual(result, { imported: true, reason: 'imported', trainers: 2, pokemon: roster.length + 1, challenges: 4, tournaments: 2 });
  assert.deepEqual(normalize(read), normalize(expected(legacy)));
  assert.deepEqual([read.challenges.c2.mode, read.challenges.c2.visibility], ['team', 'private']);
});

test('a fresh install with no db.json just starts empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tc-empty-'));
  const db = openDatabase(join(dir, 'token-clash.db'));
  assert.equal(importLegacyJson(db, dir).reason, 'no-file');
  writeFileSync(join(dir, 'db.json'), JSON.stringify(syntheticLegacy()));
  assert.equal(importLegacyJson(db, dir).reason, 'already-imported');
  assert.equal(new DrizzleTrainerRepository(db).all().length, 0);
});

const REAL = process.env.LEGACY_DB;
test('a real db.json (LEGACY_DB) survives the import intact', { skip: !REAL || !existsSync(REAL) ? 'set LEGACY_DB=/path/to/db.json to run it' : false }, () => {
  const legacy = JSON.parse(readFileSync(REAL!, 'utf8'));
  const { read } = roundTrip(legacy);
  assert.deepEqual(normalize(read), normalize(expected(legacy)));
});

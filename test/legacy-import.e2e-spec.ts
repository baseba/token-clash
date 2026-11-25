import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSave } from '../src/trainers/domain/save-file.js';
import { PROJECT_ROOT } from '../src/shared/paths.js';
import { appProcess, FAST_TIMINGS } from './app-process.js';

const app = appProcess({ ...FAST_TIMINGS, JEV_API_KEY: '', JEV_API_URL: '' }, 17000);
const { roster } = parseSave(readFileSync(join(PROJECT_ROOT, 'test', 'fixtures', 'export.json'), 'utf8'));

const legacyDb = {
  trainers: {
    t1: { id: 't1', name: 'Ana', tokenHash: 'h1', roster: [roster[0]], team: [roster[0].id], wins: 3, losses: 1, createdAt: 1, totalTokens: 100, updatedAt: 2 },
    t2: { id: 't2', name: 'Beto', tokenHash: 'h2', roster: [roster[1]], team: [roster[1].id], wins: 0, losses: 0, createdAt: 3, totalTokens: 0, updatedAt: 4 },
  },
  challenges: {
    'legacy-room': { id: 'legacy-room', hostId: 't1', hostName: 'Ana', hostTeam: [roster[0]], guestId: 't2', guestName: 'Beto', guestTeam: [roster[1]], levelCap: null, status: 'active', createdAt: 10, mode: 'team' },
  },
};

const json = async (path: string) => (await fetch(app.base + path)).json() as Promise<any>;
const legacyNames = async () => (await json('/api/leaderboard')).trainers.map((trainer: { name: string }) => trainer.name).sort();

before(async () => {
  writeFileSync(join(app.dataDir, 'db.json'), JSON.stringify(legacyDb));
  await app.start();
});
after(() => app.kill());

test('a legacy db.json in the data dir is imported at startup and served by the API', async () => {
  assert.deepEqual(await legacyNames(), ['Ana', 'Beto']);
});

test('the import lands before the arena closes battles left active, so an imported active challenge comes back abandoned', async () => {
  assert.equal((await json('/api/challenges/legacy-room')).challenge.status, 'abandoned');
});

test('a restart does not import db.json a second time', async () => {
  await app.stop();
  const withNewcomer = { ...legacyDb, trainers: { ...legacyDb.trainers, t3: { ...legacyDb.trainers.t2, id: 't3', name: 'Carla', tokenHash: 'h3' } } };
  writeFileSync(join(app.dataDir, 'db.json'), JSON.stringify(withNewcomer));
  await app.start();
  assert.deepEqual(await legacyNames(), ['Ana', 'Beto']);
});

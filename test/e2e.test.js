import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import WebSocket from 'ws';

const save = readFileSync(new URL('./fixtures/export.json', import.meta.url), 'utf8');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${PORT}`;
let proc;

before(async () => {
  proc = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: mkdtempSync(join(tmpdir(), 'tc-')), TURN_MS: '1500' },
    stdio: 'inherit',
  });
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('server did not start');
});
after(() => proc.kill());

async function call(path, { method = 'GET', body, token } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}

function player(room, token) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const frames = [];
  let resolveEnd;
  const ended = new Promise((r) => (resolveEnd = r));
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', room, token })));
  ws.on('message', (raw) => {
    const m = JSON.parse(raw);
    frames.push(m);
    if (m.state?.status === 'finished') resolveEnd(m);
    // Play: always pick the first legal action.
    if (m.actions?.length) ws.send(JSON.stringify({ t: 'act', action: m.actions[0] }));
  });
  return { ws, frames, ended };
}

test('import → challenge → accept → live battle → leaderboard', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Ana', save } });
  assert.equal(a.status, 200);
  assert.ok(a.data.token);
  assert.equal(a.data.me.roster.length, 4);
  assert.equal(a.data.me.team.length, 3);
  const b = await call('/api/import', { method: 'POST', body: { name: 'Beto <b>', save } });

  const page = await fetch(`${base}/b/abcdef`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);

  const team = [a.data.me.roster[3].uid];
  assert.deepEqual((await call('/api/me', { method: 'PUT', token: a.data.token, body: { team } })).data.me.team, team);

  const ch = await call('/api/challenges', { method: 'POST', token: a.data.token, body: { levelCap: 50 } });
  assert.equal(ch.status, 200);
  const id = ch.data.challenge.id;
  assert.equal(ch.data.challenge.hostTeam.length, 1);
  assert.equal(ch.data.challenge.hostTeam[0].level, 50);

  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: a.data.token })).status, 400);
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST' })).status, 401);

  const battles = async () => (await fetch(`${base}/healthz/battles`)).text();
  assert.equal(await battles(), '0');
  const host = player(id, a.data.token);
  await new Promise((r) => host.ws.on('open', r));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token })).status, 200);
  assert.equal(await battles(), '1'); // deploy/deploy.sh waits for this to reach 0
  const guest = player(id, b.data.token);
  const spectator = player(id, null);

  const [endA, endB, endS] = await Promise.all([host.ended, guest.ended, spectator.ended]);
  assert.equal(endA.state.winner, endB.state.winner);
  assert.equal(endA.you, 0);
  assert.equal(endB.you, 1);
  assert.equal(endS.you, null);
  assert.ok(host.frames.some((f) => f.events?.some((e) => e.t === 'damage')));
  [host, guest, spectator].forEach((p) => p.ws.close());

  await new Promise((r) => setTimeout(r, 300));
  const done = await call(`/api/challenges/${id}`);
  assert.equal(done.data.challenge.status, 'finished');
  assert.equal(await battles(), '0');
  assert.ok(done.data.challenge.final);
  const lb = await call('/api/leaderboard');
  const total = lb.data.trainers.reduce((n, t) => n + t.wins + t.losses, 0);
  assert.equal(total, 2);
  assert.equal(lb.data.trainers.find((t) => t.name.startsWith('Beto')).name, 'Beto <b>'); // stored as text, escaped by the client
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token })).status, 409);
});

test('timeouts auto-play so a battle always ends', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Lento', save } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Ausente', save } });
  const id = (await call('/api/challenges', { method: 'POST', token: a.data.token, body: {} })).data.challenge.id;
  await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token });
  // Nobody plays; the 1.5 s turn timer drives the battle to the end.
  const watcher = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  watcher.on('open', () => watcher.send(JSON.stringify({ t: 'hello', room: id })));
  const end = await new Promise((r) => watcher.on('message', (raw) => { const m = JSON.parse(raw); if (m.state?.status === 'finished') r(m); }));
  assert.ok(end.state.winner === 0 || end.state.winner === 1);
  watcher.close();
});

test('bad uploads get a clear error', async () => {
  const r = await call('/api/import', { method: 'POST', body: { name: 'X', save: '{"hello":1}' } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /colección/);
  const traversal = await fetch(`${base}/..%2fserver%2findex.js`);
  assert.equal(traversal.status, 404);
});

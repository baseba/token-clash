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
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: mkdtempSync(join(tmpdir(), 'tc-')), TURN_MS: '1500', PREVIEW_MS: '1500', ROLL_MS: '0' },
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
    // Team preview: take the first ones; then always pick the first legal action.
    const mine = m.preview && m.you != null ? m.preview.sides[m.you] : null;
    if (mine && !mine.ready) ws.send(JSON.stringify({ t: 'pick', picks: mine.party.slice(0, mine.needed).map((_, i) => i) }));
    if (m.actions?.length) ws.send(JSON.stringify({ t: 'act', action: m.actions[0] }));
  });
  return { ws, frames, ended };
}

test('import → challenge → accept → live battle → leaderboard', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Ana', save } });
  assert.equal(a.status, 200);
  assert.ok(a.data.token);
  assert.equal(a.data.me.roster.length, 4);
  assert.equal(a.data.me.team.length, 4);
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
  const preview = await new Promise((r) => guest.ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.preview) r(m.preview); }));
  const hostParty = preview.sides[0].party;
  assert.ok(hostParty.length >= 1 && hostParty.every((f) => f.name && f.sprite && f.types?.length && !f.moves && !f.abilityInfo && !f.stats));
  assert.ok(preview.sides[1].party.every((f) => f.moves && f.stats));
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

  assert.equal((await fetch(`${base}/stats`)).status, 200);
  const stats = await call('/api/stats');
  assert.equal(stats.data.totals.battles, 1);
  assert.equal(stats.data.recent[0].id, id);
  assert.ok(stats.data.topMons.length >= 1);
  assert.equal(typeof stats.data.live.online, 'number');
});

test('random battle rolls a party from each collection', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Dados', save } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Suerte', save } });
  await call('/api/me', { method: 'PUT', token: a.data.token, body: { team: [a.data.me.roster[0].uid] } });
  const ch = await call('/api/challenges', { method: 'POST', token: a.data.token, body: { mode: 'random' } });
  const id = ch.data.challenge.id;
  assert.equal(ch.data.challenge.mode, 'random');
  assert.deepEqual(ch.data.challenge.hostTeam, []);
  assert.equal(ch.data.challenge.hostTeamSize, 4);

  const host = player(id, a.data.token);
  await new Promise((r) => host.ws.on('open', r));
  await new Promise((r) => setTimeout(r, 100));
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token })).status, 200);
  const preview = await new Promise((r) => {
    const seen = host.frames.find((f) => f.preview);
    if (seen) return r(seen.preview);
    host.ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.preview) r(m.preview); });
  });
  assert.equal(preview.mode, 'random');
  assert.equal(preview.sides[0].party.length, 4);
  assert.equal(new Set(preview.sides[0].party.map((f) => f.uid)).size, 4);

  const end = await host.ended;
  assert.ok(end.state.winner === 0 || end.state.winner === 1 || end.state.winner === null);
  host.ws.close();
  const mine = await call('/api/me/challenges', { token: a.data.token });
  assert.equal(mine.data.challenges.find((c) => c.id === id).mode, 'random');
});

test('a battle against the AI starts at once and stays out of the ranking and the history', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Solo', save } });
  for (const mode of ['team', 'random']) {
    const ch = await call('/api/challenges', { method: 'POST', token: a.data.token, body: { mode, ai: 'veryhard', levelCap: 50 } });
    assert.equal(ch.status, 200);
    assert.equal(ch.data.challenge.status, 'active');
    assert.equal(ch.data.challenge.ai, 'veryhard');
    assert.equal(ch.data.challenge.guest.name, 'IA Muy difícil');
    const host = player(ch.data.challenge.id, a.data.token);
    const preview = await new Promise((r) => host.ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.preview) r(m.preview); }));
    assert.equal(preview.sides[1].ready, true);
    assert.ok(preview.sides[1].party.length === 6);
    const end = await host.ended;
    assert.ok(end.state.winner === 0 || end.state.winner === 1 || end.state.winner === null);
    host.ws.close();
  }
  const me = await call('/api/me', { token: a.data.token });
  assert.equal(me.data.me.wins + me.data.me.losses, 0);
  const list = await call('/api/me/challenges', { token: a.data.token });
  assert.deepEqual(list.data.challenges, []);
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

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import WebSocket from 'ws';
import { createJevProxy } from '../server/jev-proxy.js';

const save = readFileSync(new URL('./fixtures/export.json', import.meta.url), 'utf8');
const PORT = 18000 + Math.floor(Math.random() * 1000);
const base = `http://127.0.0.1:${PORT}`;
let proc;

// Same topology as production: the app has no key and talks to the egress proxy, which adds it
// and forwards to a stand-in for Jev that always picks the last option it is offered.
const FAKE_JEV_KEY = 'fake-jev-key';
const jevCalls = [];
const fakeJev = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(raw);
    jevCalls.push({ auth: req.headers.authorization, body });
    const keys = Object.keys(body.questions.action.criteria);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: body.model, answers: { action: { type: 'choice', choice: keys[keys.length - 1], confidence: 0.9, probabilities: {} } }, usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});

let jevProxy;

before(async () => {
  await new Promise((r) => fakeJev.listen(0, '127.0.0.1', r));
  jevProxy = createJevProxy({ apiKey: FAKE_JEV_KEY, upstream: `http://127.0.0.1:${fakeJev.address().port}/v1/systemone` });
  await new Promise((r) => jevProxy.listen(0, '127.0.0.1', r));
  proc = spawn(process.execPath, ['server/index.js'], {
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', DATA_DIR: mkdtempSync(join(tmpdir(), 'tc-')), TURN_MS: '1500', PREVIEW_MS: '1500', ROLL_MS: '0', MATCH_MS: '300', DRAW_MS: '100', BETWEEN_MS: '100', AI_PACE_MS: '20', ABSENT_MS: '1500', SEAT_GRACE_MS: '60000', JEV_API_KEY: '', JEV_API_URL: `http://127.0.0.1:${jevProxy.address().port}/v1/systemone` },
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
after(() => {
  proc.kill();
  jevProxy.close();
  fakeJev.close();
});

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
    if (m.t === 'lobby' && m.you != null && !m.players[m.you].ready) ws.send(JSON.stringify({ t: 'set-ready', ready: true }));
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
  const countdown = host.frames.find((f) => f.t === 'countdown');
  assert.deepEqual(countdown.players.map((p) => p.name), ['Ana', 'Beto <b>']);
  assert.equal(countdown.you, 0);
  assert.ok(countdown.ms > 0 && countdown.ms <= 300);
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
  assert.equal(typeof stats.data.live.battles, 'number');
  assert.equal(stats.data.totals.activeNow, 1);
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
  const guest = player(id, b.data.token);
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
  guest.ws.close();
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
    assert.match(ch.data.challenge.guest.name, / ai - muy difícil$/);
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

test('against Skynet, Jev picks the AI\'s actions and the battle ends', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Sarah', save } });
  assert.ok(a.data.me.aiLevels.includes('skynet'));
  const ch = await call('/api/challenges', { method: 'POST', token: a.data.token, body: { mode: 'team', ai: 'skynet', levelCap: 50 } });
  assert.equal(ch.status, 200);
  assert.match(ch.data.challenge.guest.name, / ai - skynet$/);
  const first = jevCalls.length;
  const host = player(ch.data.challenge.id, a.data.token);
  const end = await host.ended;
  host.ws.close();
  assert.ok(end.state.winner === 0 || end.state.winner === 1 || end.state.winner === null);
  const mine = jevCalls.slice(first);
  assert.ok(mine.length > 0, 'Jev was never asked');
  assert.ok(mine.every((c) => c.auth === `Bearer ${FAKE_JEV_KEY}`));
  assert.ok(!JSON.stringify(mine.map((c) => c.body)).includes('Sarah'), 'trainer name sent to Jev');
});

test('timeouts auto-play so a battle always ends', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Lento', save } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Ausente', save } });
  const id = (await call('/api/challenges', { method: 'POST', token: a.data.token, body: {} })).data.challenge.id;
  await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token });
  const presses = [a, b].map((p) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', room: id, token: p.data.token })));
    ws.on('message', (raw) => { const m = JSON.parse(raw); if (m.t === 'lobby' && !m.players[m.you].ready) ws.send(JSON.stringify({ t: 'set-ready', ready: true })); });
    return ws;
  });
  // After both press ready nobody plays; the 1.5 s turn timer drives the battle to the end.
  const watcher = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  watcher.on('open', () => watcher.send(JSON.stringify({ t: 'hello', room: id })));
  const end = await new Promise((r) => watcher.on('message', (raw) => { const m = JSON.parse(raw); if (m.state?.status === 'finished') r(m); }));
  assert.ok(end.state.winner === 0 || end.state.winner === 1);
  watcher.close();
  presses.forEach((ws) => ws.close());
});

test('a 1v1 room waits until both press ready, and the guest can leave to reopen it', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Dueña', save } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Visita', save } });
  const id = (await call('/api/challenges', { method: 'POST', token: a.data.token, body: { visibility: 'private' } })).data.challenge.id;
  await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token });
  const host = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const frames = [];
  host.on('message', (raw) => frames.push(JSON.parse(raw)));
  host.on('open', () => host.send(JSON.stringify({ t: 'hello', room: id, token: a.data.token })));
  const guest = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  await new Promise((r) => guest.on('open', r));
  guest.send(JSON.stringify({ t: 'hello', room: id, token: b.data.token }));
  await new Promise((r) => setTimeout(r, 150));
  host.send(JSON.stringify({ t: 'set-ready', ready: true }));
  await new Promise((r) => setTimeout(r, 150));
  const last = frames.filter((f) => f.t === 'lobby').at(-1);
  assert.deepEqual(last.players.map((p) => [p.name, p.ready]), [['Dueña', true], ['Visita', false]]);
  assert.ok(!frames.some((f) => f.t === 'countdown'));
  guest.send(JSON.stringify({ t: 'leave' }));
  await new Promise((r) => setTimeout(r, 150));
  assert.deepEqual(frames.at(-1), { t: 'reopened', host: true });
  assert.equal((await call(`/api/challenges/${id}`)).data.challenge.status, 'open');
  [host, guest].forEach((ws) => ws.close());
});

test('a 4-player tournament filled with AIs plays every match in order until a champion', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Campeona', save } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Intrusa', save } });
  const T = (await call('/api/tournaments', { method: 'POST', token: a.data.token, body: { size: 4, mode: 'random', levelCap: 50, visibility: 'private' } })).data.tournament;
  assert.equal(T.status, 'open');
  assert.equal((await call(`/api/tournaments/${T.id}/ai`, { method: 'POST', body: { level: 'easy' } })).status, 401);
  assert.equal((await call(`/api/tournaments/${T.id}/join`, { method: 'POST', token: b.data.token })).status, 200);
  assert.equal((await call(`/api/tournaments/${T.id}/ai`, { method: 'POST', token: b.data.token, body: { level: 'easy' } })).status, 403);
  const filled = (await call(`/api/tournaments/${T.id}/ai`, { method: 'POST', token: a.data.token, body: { level: 'easy', count: 5 } })).data.tournament;
  assert.deepEqual(filled.seats.map((s) => s.ready), [false, false, true, true]);
  assert.ok(filled.seats.slice(2).every((s) => / ai - fácil$/.test(s.name)));
  assert.notEqual(filled.seats[2].name, filled.seats[3].name);
  const kicked = (await call(`/api/tournaments/${T.id}/seats/1`, { method: 'DELETE', token: a.data.token })).data.tournament;
  assert.equal(kicked.seats.length, 3);
  await call(`/api/tournaments/${T.id}/ai`, { method: 'POST', token: a.data.token, body: { level: 'mid' } });
  const feed = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const seen = [];
  const playing = new Set();
  const done = new Promise((resolve) => {
    feed.on('message', async (raw) => {
      const m = JSON.parse(raw);
      if (m.t !== 'tour') return;
      seen.push(m.tournament);
      const cur = m.tournament.current?.challengeId;
      if (cur && !playing.has(cur)) {
        playing.add(cur);
        const c = (await call(`/api/challenges/${cur}`)).data.challenge;
        if (c.host.id === a.data.me.id || c.guest?.id === a.data.me.id) player(cur, a.data.token);
      }
      if (m.tournament.status === 'finished') resolve(m.tournament);
    });
  });
  await new Promise((r) => feed.on('open', r));
  feed.send(JSON.stringify({ t: 'tour', id: T.id, token: a.data.token }));
  assert.equal((await call(`/api/tournaments/${T.id}/ready`, { method: 'POST', token: a.data.token, body: { ready: true } })).data.tournament.status, 'running');
  const end = await done;
  feed.close();
  assert.equal(end.played, 3);
  assert.equal(end.rounds.length, 2);
  assert.ok(end.rounds[1].matches[0].winner === end.champion);
  assert.ok(end.rounds.flatMap((r) => r.matches).every((m) => m.winner !== null && m.challengeId));
  const mine = (await call('/api/me/challenges', { token: a.data.token })).data;
  assert.ok(!mine.challenges.some((c) => end.rounds.some((r) => r.matches.some((m) => m.challengeId === c.id))));
  assert.ok(!mine.tournaments.some((t) => t.id === T.id), 'a tournament with one person stays out of the history');
  const order = seen.map((t) => t.current?.challengeId).filter(Boolean);
  assert.deepEqual([...new Set(order)], end.rounds.flatMap((r) => r.matches.map((m) => m.challengeId)));
});

test('public rooms are listed and a matching search joins them; private ones stay hidden', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Anfitrión', save } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Buscador', save } });
  const body = { mode: 'random', levelCap: 50 };
  const priv = (await call('/api/challenges', { method: 'POST', token: a.data.token, body: { ...body, visibility: 'private' } })).data.challenge;
  assert.equal(priv.visibility, 'private');
  const pub = (await call('/api/challenges', { method: 'POST', token: a.data.token, body })).data.challenge;
  assert.equal(pub.visibility, 'public');
  assert.equal((await call('/api/challenges', { method: 'POST', token: a.data.token, body })).data.challenge.id, pub.id);
  const listed = (await call('/api/rooms', { token: b.data.token })).data.rooms;
  assert.ok(listed.some((r) => r.id === pub.id && !r.mine && r.host.name === 'Anfitrión'));
  assert.ok(!listed.some((r) => r.id === priv.id));
  const lobby = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const frames = [];
  const next = () => new Promise((r) => lobby.once('message', (raw) => r(JSON.parse(raw))));
  lobby.on('message', (raw) => frames.push(JSON.parse(raw)));
  await new Promise((r) => lobby.on('open', r));
  const firstList = next();
  lobby.send(JSON.stringify({ t: 'lobby', token: b.data.token }));
  assert.ok((await firstList).rooms.some((r) => r.id === pub.id));
  const emptied = next();
  const found = await call('/api/challenges', { method: 'POST', token: b.data.token, body });
  assert.equal(found.data.joined, true);
  assert.equal(found.data.challenge.id, pub.id);
  assert.equal(found.data.challenge.status, 'active');
  assert.ok(!(await call('/api/rooms')).data.rooms.some((r) => r.id === pub.id));
  assert.ok(!(await emptied).rooms.some((r) => r.id === pub.id));
  lobby.close();
  const late = await call(`/api/challenges/${pub.id}/accept`, { method: 'POST', token: (await call('/api/import', { method: 'POST', body: { name: 'Tardío', save } })).data.token });
  assert.equal(late.status, 409);
  assert.match(late.data.error, /Llegaste tarde/);
  await call(`/api/challenges/${priv.id}`, { method: 'DELETE', token: a.data.token });
  const page1 = (await call('/api/me/challenges?offset=0&limit=1', { token: a.data.token })).data;
  const page2 = (await call('/api/me/challenges?offset=1&limit=1', { token: a.data.token })).data;
  assert.equal(page1.challenges.length, 1);
  assert.equal(page1.hasMore, true);
  assert.equal(page2.hasMore, false);
  assert.notEqual(page1.challenges[0].id, page2.challenges[0].id);
});

test('bad uploads get a clear error', async () => {
  const r = await call('/api/import', { method: 'POST', body: { name: 'X', save: '{"hello":1}' } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /colección/);
  const traversal = await fetch(`${base}/..%2fserver%2findex.js`);
  assert.equal(traversal.status, 404);
});

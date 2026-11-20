import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import WebSocket from 'ws';
import { createJevProxy } from '../src/combat/infrastructure/jev/jev-proxy.js';
import { PROJECT_ROOT } from '../src/shared/paths.js';
import { appProcess, FAST_TIMINGS, type AppProcess } from './app-process.js';

const save = readFileSync(join(PROJECT_ROOT, 'test', 'fixtures', 'export.json'), 'utf8');

// Same topology as production: the app has no key and talks to the egress proxy, which adds it
// and forwards to a stand-in for Jev that always picks the last option it is offered.
const FAKE_JEV_KEY = 'fake-jev-key';
const jevCalls: any[] = [];
const fakeJev = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const body = JSON.parse(String(raw));
    jevCalls.push({ auth: req.headers.authorization, body });
    const keys = Object.keys(body.questions.action.criteria);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ model: body.model, answers: { action: { type: 'choice', choice: keys[keys.length - 1], confidence: 0.9, probabilities: {} } }, usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});

let jevProxy: Server;
let app: AppProcess;
let base: string;
let PORT: number;

before(async () => {
  await new Promise<void>((r) => fakeJev.listen(0, '127.0.0.1', r));
  jevProxy = createJevProxy({ apiKey: FAKE_JEV_KEY, upstream: `http://127.0.0.1:${(fakeJev.address() as AddressInfo).port}/v1/systemone` });
  await new Promise<void>((r) => jevProxy.listen(0, '127.0.0.1', r));
  const proxyPort = (jevProxy.address() as AddressInfo).port;
  app = appProcess({ ...FAST_TIMINGS, SEAT_GRACE_MS: '60000', TRUST_CF_CONNECTING_IP: '1', JEV_API_KEY: '', JEV_API_URL: `http://127.0.0.1:${proxyPort}/v1/systemone` }, 18000);
  ({ base, port: PORT } = app);
  await app.start();
});
after(() => {
  app.kill();
  jevProxy.close();
  fakeJev.close();
});

const newAccount = () => ({ password: 'contraseña-segura' });

async function call(path: string, { method = 'GET', body = undefined as unknown, token = undefined as string | undefined, ip = undefined as string | undefined } = {}): Promise<{ status: number; data: any; headers: Headers }> {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(ip ? { 'CF-Connecting-IP': ip } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null), headers: res.headers };
}

function player(room: string, token: string | null): { ws: WebSocket; frames: any[]; ended: Promise<any> } {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const frames: any[] = [];
  let resolveEnd: (m: any) => void;
  const ended = new Promise<any>((r) => (resolveEnd = r));
  ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', room, token })));
  ws.on('message', (raw) => {
    const m = JSON.parse(String(raw));
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
  const a = await call('/api/import', { method: 'POST', body: { name: 'Ana', save, ...newAccount() } });
  assert.equal(a.status, 200);
  assert.ok(a.data.token);
  assert.equal(a.data.me.roster.length, 4);
  assert.equal(a.data.me.team.length, 4);
  const b = await call('/api/import', { method: 'POST', body: { name: 'Beto <b>', save, ...newAccount() } });

  const page = await fetch(`${base}/b/abcdef`);
  assert.equal(page.status, 200);
  const csp = new Map(page.headers.get('content-security-policy').split(';').map((directive) => directive.trim().split(/\s+/)).map(([name, ...sources]) => [name, sources]));
  assert.deepEqual(csp.get('default-src'), ["'self'"]);
  const upstream = ['https://cdn.jsdelivr.net', 'https://raw.githubusercontent.com'];
  assert.deepEqual(csp.get('img-src'), ["'self'", 'data:', ...upstream], 'sprites and battle animations load from the CDNs');
  assert.deepEqual(csp.get('connect-src'), ["'self'", ...upstream], 'cries, sounds and music are fetched from the CDNs');
  for (const [name, sources] of csp) if (!['img-src', 'connect-src'].includes(name)) assert.ok(!sources.some((source) => source.startsWith('https:')), `${name} stays closed`);

  const versioned = (await (await fetch(`${base}/upstream.js?v=dev`)).text()).match(/\/upstream\/\$\{name\}\.json\?v=(\w+)/);
  assert.ok(versioned && versioned[1] !== 'dev', 'the page asks for the manifests with the deploy version');
  const manifest = await fetch(`${base}/upstream/sprites.json?v=${versioned[1]}`);
  assert.equal(manifest.status, 200);
  assert.equal(manifest.headers.get('cache-control'), 'public, max-age=31536000, immutable', 'a versioned manifest is cached');

  const team = [a.data.me.roster[3].uid];
  assert.deepEqual((await call('/api/me', { method: 'PUT', token: a.data.token, body: { team } })).data.me.team, team);

  const ch = await call('/api/challenges', { method: 'POST', token: a.data.token, body: { visibility: 'private' } });
  assert.equal(ch.status, 200);
  const id = ch.data.challenge.id;
  assert.equal(ch.data.challenge.hostTeam.length, 1);
  assert.equal(ch.data.challenge.hostTeam[0].level, 100);

  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: a.data.token })).status, 400);
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST' })).status, 401);

  const battles = async () => (await fetch(`${base}/healthz/battles`)).text();
  assert.equal(await battles(), '0');
  const host = player(id, a.data.token);
  await new Promise<any>((r) => host.ws.on('open', r));
  await new Promise<any>((r) => setTimeout(r, 100));
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token })).status, 200);
  assert.equal(await battles(), '1'); // deploy/deploy.sh waits for this to reach 0
  const guest = player(id, b.data.token);
  const preview = await new Promise<any>((r) => guest.ws.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.preview) r(m.preview); }));
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

  await new Promise<any>((r) => setTimeout(r, 300));
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
  const a = await call('/api/import', { method: 'POST', body: { name: 'Dados', save, ...newAccount() } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Suerte', save, ...newAccount() } });
  await call('/api/me', { method: 'PUT', token: a.data.token, body: { team: [a.data.me.roster[0].uid] } });
  const ch = await call('/api/challenges', { method: 'POST', token: a.data.token, body: { mode: 'random' } });
  const id = ch.data.challenge.id;
  assert.equal(ch.data.challenge.mode, 'random');
  assert.deepEqual(ch.data.challenge.hostTeam, []);
  assert.equal(ch.data.challenge.hostTeamSize, 4);

  const host = player(id, a.data.token);
  await new Promise<any>((r) => host.ws.on('open', r));
  await new Promise<any>((r) => setTimeout(r, 100));
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token })).status, 200);
  const guest = player(id, b.data.token);
  const preview = await new Promise<any>((r) => {
    const seen = host.frames.find((f) => f.preview);
    if (seen) return r(seen.preview);
    host.ws.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.preview) r(m.preview); });
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
  const a = await call('/api/import', { method: 'POST', body: { name: 'Solo', save, ...newAccount() } });
  for (const mode of ['team', 'random']) {
    const ch = await call('/api/challenges', { method: 'POST', token: a.data.token, body: { mode, ai: 'veryhard' } });
    assert.equal(ch.status, 200);
    assert.equal(ch.data.challenge.status, 'active');
    assert.equal(ch.data.challenge.ai, 'veryhard');
    assert.match(ch.data.challenge.guest.name, / ai - muy difícil$/);
    const host = player(ch.data.challenge.id, a.data.token);
    const preview = await new Promise<any>((r) => host.ws.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.preview) r(m.preview); }));
    assert.equal(preview.sides[1].ready, false, 'the AI takes its time to pick');
    assert.ok(preview.sides[1].party.length === 6);
    await new Promise<any>((r) => host.ws.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.preview?.sides[1].ready) r(undefined); }));
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
  const a = await call('/api/import', { method: 'POST', body: { name: 'Sarah', save, ...newAccount() } });
  assert.ok(a.data.me.aiLevels.includes('skynet'));
  const ch = await call('/api/challenges', { method: 'POST', token: a.data.token, body: { mode: 'team', ai: 'skynet' } });
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

test('a player who surrenders loses at once, and it counts in the ranking', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Rendida', save, ...newAccount() }, ip: '10.9.0.1' });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Ganadora', save, ...newAccount() }, ip: '10.9.0.2' });
  const id = (await call('/api/challenges', { method: 'POST', token: a.data.token, body: { visibility: 'private' } })).data.challenge.id;
  await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token });
  const quitter = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  let surrendered = false;
  const ended = new Promise<any>((r) => quitter.on('message', (raw) => {
    const m = JSON.parse(String(raw));
    if (m.state?.status === 'finished') r(m);
    if (m.t === 'lobby' && !m.players[m.you].ready) quitter.send(JSON.stringify({ t: 'set-ready', ready: true }));
    const mine = m.preview && m.you != null ? m.preview.sides[m.you] : null;
    if (mine && !mine.ready) quitter.send(JSON.stringify({ t: 'pick', picks: mine.party.slice(0, mine.needed).map((_, i) => i) }));
    if (m.actions?.length && !surrendered) {
      surrendered = true;
      quitter.send(JSON.stringify({ t: 'surrender' }));
    }
  }));
  quitter.on('open', () => quitter.send(JSON.stringify({ t: 'hello', room: id, token: a.data.token })));
  const rival = player(id, b.data.token);
  const end = await ended;
  assert.equal(end.state.winner, 1);
  assert.deepEqual(end.events.at(-1), { t: 'end', winner: 1, reason: 'forfeit' });
  [quitter, rival.ws].forEach((ws) => ws.close());
  await new Promise<any>((r) => setTimeout(r, 200));
  assert.equal((await call(`/api/challenges/${id}`)).data.challenge.winnerId, b.data.me.id);
  assert.equal((await call('/api/me', { token: a.data.token })).data.me.losses, 1);
  assert.equal((await call('/api/me', { token: b.data.token })).data.me.wins, 1);
});

test('timeouts auto-play so a battle always ends', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Lento', save, ...newAccount() } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Ausente', save, ...newAccount() } });
  const id = (await call('/api/challenges', { method: 'POST', token: a.data.token, body: {} })).data.challenge.id;
  await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token });
  const presses = [a, b].map((p) => {
    const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
    ws.on('open', () => ws.send(JSON.stringify({ t: 'hello', room: id, token: p.data.token })));
    ws.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.t === 'lobby' && !m.players[m.you].ready) ws.send(JSON.stringify({ t: 'set-ready', ready: true })); });
    return ws;
  });
  // After both press ready nobody plays; the 1.5 s turn timer drives the battle to the end.
  const watcher = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  watcher.on('open', () => watcher.send(JSON.stringify({ t: 'hello', room: id })));
  const end = await new Promise<any>((r) => watcher.on('message', (raw) => { const m = JSON.parse(String(raw)); if (m.state?.status === 'finished') r(m); }));
  assert.ok(end.state.winner === 0 || end.state.winner === 1);
  watcher.close();
  presses.forEach((ws) => ws.close());
});

test('a 1v1 room waits until both press ready, and the guest can leave to reopen it', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Dueña', save, ...newAccount() } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Visita', save, ...newAccount() } });
  const id = (await call('/api/challenges', { method: 'POST', token: a.data.token, body: { visibility: 'private' } })).data.challenge.id;
  await call(`/api/challenges/${id}/accept`, { method: 'POST', token: b.data.token });
  const host = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const frames = [];
  host.on('message', (raw) => frames.push(JSON.parse(String(raw))));
  host.on('open', () => host.send(JSON.stringify({ t: 'hello', room: id, token: a.data.token })));
  const guest = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  await new Promise<any>((r) => guest.on('open', r));
  guest.send(JSON.stringify({ t: 'hello', room: id, token: b.data.token }));
  await new Promise<any>((r) => setTimeout(r, 150));
  host.send(JSON.stringify({ t: 'set-ready', ready: true }));
  await new Promise<any>((r) => setTimeout(r, 150));
  const last = frames.filter((f) => f.t === 'lobby').at(-1);
  assert.deepEqual(last.players.map((p) => [p.name, p.ready]), [['Dueña', true], ['Visita', false]]);
  assert.ok(!frames.some((f) => f.t === 'countdown'));
  guest.send(JSON.stringify({ t: 'leave' }));
  await new Promise<any>((r) => setTimeout(r, 150));
  assert.deepEqual(frames.at(-1), { t: 'reopened', host: true });
  assert.equal((await call(`/api/challenges/${id}`)).data.challenge.status, 'open');
  [host, guest].forEach((ws) => ws.close());
});

test('a 4-player tournament filled with AIs plays every match in order until a champion', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Campeona', save, ...newAccount() } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Intrusa', save, ...newAccount() } });
  const T = (await call('/api/tournaments', { method: 'POST', token: a.data.token, body: { size: 4, mode: 'random', visibility: 'private' } })).data.tournament;
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
  const done = new Promise<any>((resolve) => {
    feed.on('message', async (raw) => {
      const m = JSON.parse(String(raw));
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
  await new Promise<any>((r) => feed.on('open', r));
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
  const a = await call('/api/import', { method: 'POST', body: { name: 'Anfitrión', save, ...newAccount() } });
  const b = await call('/api/import', { method: 'POST', body: { name: 'Buscador', save, ...newAccount() } });
  const body = { mode: 'random' };
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
  const next = () => new Promise<any>((r) => lobby.once('message', (raw) => r(JSON.parse(String(raw)))));
  lobby.on('message', (raw) => frames.push(JSON.parse(String(raw))));
  await new Promise<any>((r) => lobby.on('open', r));
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
  const late = await call(`/api/challenges/${pub.id}/accept`, { method: 'POST', token: (await call('/api/import', { method: 'POST', body: { name: 'Tardío', save, ...newAccount() } })).data.token });
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

test('the shop sells, equips and guards what is still locked', async () => {
  const { token } = (await call('/api/import', { method: 'POST', body: { name: 'Clienta', save, ...newAccount() }, ip: '10.9.0.3' })).data;
  const shop = await call('/api/shop', { token });
  assert.equal(shop.status, 200);
  assert.equal(shop.data.shop.items.find((item: any) => item.id === 'window:sapphire').owned, false);
  assert.equal(shop.data.shop.items.find((item: any) => item.id === 'trainer:iris__sapphire').available, false);
  const achievements = await call('/api/me/achievements', { token });
  assert.equal(achievements.status, 200);
  assert.ok(achievements.data.sprites.some((sprite: any) => sprite.key === 'iris' && !sprite.unlocked));

  const rejected = async (path: string, method: string, body: unknown) => {
    const { status, data } = await call(path, { method, token, body });
    return [status, data];
  };
  assert.deepEqual(await rejected('/api/shop/buy', 'POST', { item: 'ball:nope' }), [404, { error: 'Ese artículo no existe.' }]);
  assert.deepEqual(await rejected('/api/shop/buy', 'POST', { item: 'trainer:iris__sapphire' }), [403, { error: 'Primero desbloquea al entrenador original.' }]);
  assert.deepEqual(await rejected('/api/me/equip', 'PUT', { kind: 'window', key: 'sapphire' }), [403, { error: 'Primero cómpralo en tu perfil.' }]);
  assert.deepEqual(await rejected('/api/me/look', 'PUT', { avatar: 'iris' }), [403, { error: 'Todavía no desbloqueas a ese entrenador.' }]);

  const bought = await call('/api/shop/buy', { method: 'POST', token, body: { item: 'window:sapphire' } });
  assert.equal(bought.status, 200);
  assert.ok(bought.data.shop.owned.includes('window:sapphire'));
  assert.equal((await call('/api/me/equip', { method: 'PUT', token, body: { kind: 'window', key: 'sapphire' } })).status, 200);
  assert.equal((await call('/api/me', { token })).data.me.shop.equipped.window, 'sapphire');
});

test('the shredder turns a repeated Pokémon into tokens once', async () => {
  const withRepeat = JSON.parse(save);
  const venusaur = withRepeat.state.dex.find((seen: { finalID: number }) => seen.finalID === 3);
  venusaur.caughtAt = '2024-01-01T00:00:00Z';
  withRepeat.state.dex.push({ ...venusaur, id: '22222222-2222-3333-4444-555555555555', caughtAt: '2099-01-01T00:00:00Z' });
  const { token } = (await call('/api/import', { method: 'POST', body: { name: 'Recicla', save: JSON.stringify(withRepeat), ...newAccount() }, ip: '10.9.0.4' })).data;
  const before = await call('/api/me/recycling', { token });
  assert.equal(before.status, 200);
  const [duplicate] = before.data.recycling.duplicates;
  assert.equal(duplicate.id, '22222222-2222-3333-4444-555555555555');

  const shredded = await call('/api/me/recycling', { method: 'POST', token, body: { entry: duplicate.id } });
  assert.equal(shredded.status, 200);
  assert.equal(shredded.data.tokens, duplicate.tokens);
  assert.ok(!shredded.data.recycling.duplicates.some((left: any) => left.id === duplicate.id));

  const again = await call('/api/me/recycling', { method: 'POST', token, body: { entry: duplicate.id } });
  assert.deepEqual([again.status, again.data], [409, { error: 'Ese Pokémon ya pasó por la trituradora.' }]);
  const unknown = await call('/api/me/recycling', { method: 'POST', token, body: { entry: 'nope' } });
  assert.deepEqual([unknown.status, unknown.data], [404, { error: 'Ese Pokémon no está entre tus repetidos.' }]);
});

test('bad uploads get a clear error', async () => {
  const r = await call('/api/import', { method: 'POST', body: { name: 'X', save: '{"hello":1}' } });
  assert.equal(r.status, 400);
  assert.match(r.data.error, /colección/);
  const notJson = await fetch(`${base}/api/import`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{bad' });
  assert.deepEqual([notJson.status, await notJson.json()], [400, { error: 'JSON inválido' }]);
  const huge = await call('/api/import', { method: 'POST', body: { name: 'X', save: 'x'.repeat(10 * 1024 * 1024), ...newAccount() } });
  assert.deepEqual([huge.status, huge.data], [413, { error: 'El archivo es demasiado grande (máx. 9 MB).' }]);
  const traversal = await fetch(`${base}/..%2fserver%2findex.js`);
  assert.equal(traversal.status, 404);
});

test('the same account plays from two devices with its trainer name and password', async () => {
  const ip = '10.9.0.7';
  const created = await call('/api/import', { method: 'POST', body: { name: 'Viajera', save, password: 'dos-equipos' }, ip });
  assert.equal(created.status, 200);
  assert.equal(created.data.me.hasPassword, true);
  const taken = await call('/api/import', { method: 'POST', body: { name: ' VIAJERA ', save, password: 'otra-clave' }, ip });
  assert.deepEqual([taken.status, taken.data.error], [409, 'Ya hay un entrenador que se llama VIAJERA, elige otro nombre.']);
  const noPassword = await call('/api/import', { method: 'POST', body: { name: 'Apurada', save }, ip });
  assert.equal(noPassword.status, 400);

  const wrong = await call('/api/login', { method: 'POST', body: { name: 'Viajera', password: 'no-es-esta' }, ip });
  const nobody = await call('/api/login', { method: 'POST', body: { name: 'Nadie', password: 'no-es-esta' }, ip });
  assert.deepEqual([wrong.status, wrong.data.error], [401, 'Nombre o contraseña incorrectos.']);
  assert.deepEqual(nobody.data, wrong.data, 'a missing trainer and a wrong password look the same');
  const laptop = await call('/api/login', { method: 'POST', body: { name: ' viajera ', password: 'dos-equipos' }, ip });
  assert.equal(laptop.status, 200);
  assert.notEqual(laptop.data.token, created.data.token);
  assert.equal(laptop.data.me.id, created.data.me.id);
  assert.equal((await call('/api/me', { token: created.data.token })).status, 200, 'the first device stays logged in');

  const other = await call('/api/import', { method: 'POST', body: { name: 'Otra', save, password: 'otra-clave' }, ip });
  const clash = await call('/api/me', { method: 'PUT', token: other.data.token, body: { name: 'viajera' } });
  assert.equal(clash.status, 409, 'a name already in use cannot be taken by renaming');
  assert.equal((await call('/api/me', { method: 'PUT', token: laptop.data.token, body: { name: 'Viajera Frecuente' } })).status, 200);

  const badChange = await call('/api/me/password', { method: 'PUT', token: laptop.data.token, body: { password: 'tres-equipos', currentPassword: 'no-es-esta' } });
  assert.equal(badChange.status, 403);
  assert.equal((await call('/api/me/password', { method: 'PUT', token: laptop.data.token, body: { password: 'tres-equipos', currentPassword: 'dos-equipos' } })).status, 200);

  assert.equal((await call('/api/logout', { method: 'POST', token: laptop.data.token })).status, 204);
  assert.equal((await call('/api/me', { token: laptop.data.token })).status, 401);
  assert.equal((await call('/api/me', { token: created.data.token })).status, 200, 'logging out closes only that device');
  assert.equal((await call('/api/login', { method: 'POST', body: { name: 'viajera frecuente', password: 'tres-equipos' }, ip })).status, 200, 'the new name is the new login');
});

test('the Mac uploads the save on its own with the trainer name and password, without opening a session', async () => {
  const ip = '10.9.0.8';
  const created = await call('/api/import', { method: 'POST', body: { name: 'Ñandú Sync', save, password: 'clave:con:dos-puntos' }, ip });
  const sync = (authorization?: string) => fetch(`${base}/api/sync`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...(authorization ? { Authorization: authorization } : {}) }, body: save });
  const basic = (text: string) => `Basic ${Buffer.from(text, 'utf8').toString('base64')}`;

  const ok = await sync(basic('ñandú sync:clave:con:dos-puntos'));
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { rosterSize: created.data.me.rosterSize, shinies: created.data.me.shinies, totalTokens: created.data.me.totalTokens });
  assert.equal((await sync(basic('Ñandú Sync:otra-clave'))).status, 401);
  assert.equal((await sync()).status, 401);
  assert.equal((await sync(`Bearer ${created.data.token}`)).status, 401, 'a session token does not work here');
  assert.equal((await call('/api/me', { token: created.data.token })).status, 200);
});

test('requests with the wrong shape get a 400 before reaching the domain', async () => {
  const { token } = (await call('/api/import', { method: 'POST', body: { name: 'Dora', save, ...newAccount() } })).data;
  const bad = await call('/api/challenges', { method: 'POST', token, body: { mode: 'chaos' } });
  assert.equal(bad.status, 400);
  assert.match(bad.data.error, /^mode: /);
  const noFile = await call('/api/import', { method: 'POST', body: { name: 'Dora' } });
  assert.equal(noFile.status, 400);
  assert.equal(noFile.data.error, 'Falta el archivo.');
  // Without a session the guard answers first: shape is checked only for whoever may call.
  assert.equal((await call('/api/challenges', { method: 'POST', body: { mode: 'chaos' } })).status, 401);
  const unknownAi = await call('/api/challenges', { method: 'POST', token, body: { ai: 'godlike' } });
  assert.equal(unknownAi.status, 400);
  assert.equal(unknownAi.data.error, 'Esa dificultad no está disponible.');
});

test('malformed socket frames are dropped or answered like a wrong value, and the socket stays usable', async () => {
  const { token } = (await call('/api/import', { method: 'POST', body: { name: 'Ruido', save, ...newAccount() } })).data;
  const room = (await call('/api/challenges', { method: 'POST', token, body: { ai: 'easy' } })).data.challenge.id;
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const frames: any[] = [];
  ws.on('message', (raw) => frames.push(JSON.parse(String(raw))));
  await new Promise((r) => ws.once('open', r));
  const next = async () => {
    for (let i = 0; i < 50 && !frames.length; i++) await new Promise((r) => setTimeout(r, 20));
    return frames.shift();
  };
  for (const frame of ['not json', '[]', JSON.stringify({ t: 'nope' }), JSON.stringify({ t: 'act', action: 'x' })]) ws.send(frame);
  ws.send(JSON.stringify({ t: 'hello', room: 42 }));
  assert.deepEqual(await next(), { t: 'error', error: 'Ese desafío no existe.' });
  ws.send(JSON.stringify({ t: 'hello', room, token }));
  assert.equal((await next()).you, 0);
  ws.close();
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
});

test('a trainer runs a radio station: only they edit its queue, and every listener hears each change', async () => {
  const dj = (await call('/api/import', { method: 'POST', body: { name: 'DJ Ana', save, ...newAccount() }, ip: '10.9.0.5' })).data;
  const other = (await call('/api/import', { method: 'POST', body: { name: 'Otro', save, ...newAccount() }, ip: '10.9.0.6' })).data;
  const ownerId = dj.me.id;
  assert.equal((await call('/api/radio/station', { method: 'PUT', body: { name: 'Radio Kanto' } })).status, 401);
  assert.equal((await call('/api/radio/station', { method: 'PUT', token: dj.token, body: { name: '   ' } })).status, 400);
  const opened = await call('/api/radio/station', { method: 'PUT', token: dj.token, body: { name: '  Radio Kanto ' } });
  assert.equal(opened.status, 200);
  assert.deepEqual(opened.data.station, { ownerId, ownerName: 'DJ Ana', name: 'Radio Kanto', nowPlaying: null, queue: [], listeners: 0 });
  const skipEmpty = await call('/api/radio/station/skip', { method: 'POST', token: dj.token });
  assert.equal(skipEmpty.status, 409);
  assert.match(skipEmpty.data.error, /cola/);

  const listener = new WebSocket(`ws://127.0.0.1:${PORT}/ws`);
  const frames: any[] = [];
  listener.on('message', (raw) => frames.push(JSON.parse(String(raw))));
  await new Promise((r) => listener.once('open', r));
  const nextFrame = async () => {
    for (let i = 0; i < 100 && !frames.length; i++) await new Promise((r) => setTimeout(r, 20));
    return frames.shift();
  };
  listener.send(JSON.stringify({ t: 'radio', station: 'nobody' }));
  assert.deepEqual({ ...(await nextFrame()), now: 0 }, { t: 'radio', stationId: 'nobody', station: null, now: 0 });
  listener.send(JSON.stringify({ t: 'radio', station: ownerId }));
  const tuned = await nextFrame();
  assert.equal(tuned.stationId, ownerId);
  assert.equal(tuned.station.name, 'Radio Kanto');
  assert.equal(tuned.station.listeners, 1);
  assert.ok(Math.abs(tuned.now - Date.now()) < 5000, 'the frame carries the server clock');

  const queued = await call('/api/radio/station/queue', { method: 'PUT', token: dj.token, body: { queue: ['battle_kanto_gym', 'title'], playing: null } });
  assert.equal(queued.status, 200);
  const playing = (await nextFrame()).station;
  assert.deepEqual(playing, queued.data.station);
  assert.equal(playing.nowPlaying.track, 'battle_kanto_gym');
  assert.equal(playing.nowPlaying.endsAt - playing.nowPlaying.startedAt, 58253, 'it plays once through, as long as the mp3 lasts');
  assert.deepEqual(playing.queue, ['title']);
  assert.equal((await call('/api/radio/station/queue', { method: 'PUT', token: dj.token, body: { queue: ['not_a_song'], playing: null } })).status, 400);
  const notTheirs = await call('/api/radio/station/queue', { method: 'PUT', token: other.token, body: { queue: ['title'], playing: null } });
  assert.deepEqual([notTheirs.status, notTheirs.data.error], [404, 'No tienes una estación abierta.']);

  const skipped = await call('/api/radio/station/skip', { method: 'POST', token: dj.token });
  assert.equal(skipped.data.station.nowPlaying.track, 'title');
  assert.deepEqual((await nextFrame()).station.queue, []);
  const stale = await call('/api/radio/station/queue', { method: 'PUT', token: dj.token, body: { queue: ['battle_kanto_gym', 'title'], playing: playing.nowPlaying.startedAt } });
  assert.equal(stale.status, 409, 'a queue edited while an older song was on air is refused');
  assert.match(stale.data.error, /cambió de canción/);
  const listed = (await call('/api/radio/stations')).data.stations.find((station) => station.ownerId === ownerId);
  assert.deepEqual(listed, skipped.data.station);
  assert.deepEqual((await call(`/api/radio/stations/${ownerId}`)).data.station, listed);
  assert.equal((await call('/api/radio/stations/nobody')).status, 404);

  assert.equal((await call('/api/radio/station', { method: 'PUT', token: dj.token, body: { name: 'Radio Johto' } })).data.station.name, 'Radio Johto');
  assert.equal((await nextFrame()).station.name, 'Radio Johto');
  assert.equal((await call('/api/radio/station', { method: 'DELETE', token: other.token })).status, 200, 'closing a station you never opened changes nothing');
  assert.equal((await call('/api/radio/station', { method: 'DELETE', token: dj.token })).status, 200);
  assert.deepEqual({ ...(await nextFrame()), now: 0 }, { t: 'radio', stationId: ownerId, station: null, now: 0 }, 'listeners hear which station closed');
  assert.equal((await call(`/api/radio/stations/${ownerId}`)).status, 404);
  listener.close();
});

test('everything survives a restart: sessions, collections, results, tournaments and radio stations live in SQLite', async () => {
  const a = await call('/api/import', { method: 'POST', body: { name: 'Memoria', save, ...newAccount() } });
  const token = a.data.token;
  const uid = a.data.me.roster[0].uid;
  await call('/api/me', { method: 'PUT', token, body: { nickname: { id: uid, name: 'Chispa' } } });
  await call('/api/radio/station', { method: 'PUT', token, body: { name: 'Radio Memoria' } });
  await call('/api/radio/station/queue', { method: 'PUT', token, body: { queue: ['battle_rocket_boss', 'title', 'town'], playing: null } });
  // A battle in progress lives in memory only: after a restart it must show up as cut.
  const live = (await call('/api/challenges', { method: 'POST', token, body: { ai: 'easy' } })).data.challenge;
  assert.equal(live.status, 'active');

  const snapshot = async () => {
    const stats = (await call('/api/stats')).data;
    delete stats.live;
    stats.totals.activeNow = stats.totals.activeToday = 0;
    const station = (await call(`/api/radio/stations/${a.data.me.id}`)).data;
    return { me: (await call('/api/me', { token })).data, leaderboard: (await call('/api/leaderboard')).data, stats, station };
  };
  const before = await snapshot();
  await app.stop();
  await app.start();
  const afterRestart = await snapshot();

  assert.deepEqual(afterRestart, before);
  assert.equal(afterRestart.me.me.roster.find((m) => m.uid === uid).nickname, 'Chispa');
  assert.deepEqual(afterRestart.station.station.queue, ['title', 'town'], 'a radio station and its queue live in SQLite');
  assert.equal((await call(`/api/challenges/${live.id}`)).data.challenge.status, 'abandoned');
  assert.ok(before.stats.tournaments.totals.tournaments >= 0);
});

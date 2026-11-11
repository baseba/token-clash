import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { parseSave, SaveError } from './save.js';
import { buildFighter } from './creatures.js';
import { createBattle, submit, autoAction, needsAction, validActions, publicState, TEAM_SIZE } from './battle.js';
import { openStore } from './store.js';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url));
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || '';
const TRUST_CF = process.env.TRUST_CF_CONNECTING_IP === '1';
const TURN_MS = Number(process.env.TURN_MS || 60_000);
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
// "?v=dev" in index.html and app.js becomes a hash of the code, so each deploy gets new URLs and
// no browser keeps old code (Cloudflare stretches the cache of .js/.css to hours).
const ASSET_VERSION = (() => {
  const h = createHash('sha256');
  for (const f of readdirSync(PUBLIC_DIR).filter((f) => /\.(js|css|html)$/.test(f)).sort()) h.update(f).update(readFileSync(join(PUBLIC_DIR, f)));
  return h.digest('hex').slice(0, 10);
})();
const MAX_BODY = 9 * 1024 * 1024;

const store = openStore(DATA_DIR);
const { db } = store;

// ---------- helpers ----------
const sha = (s) => createHash('sha256').update(s).digest('hex');
const newId = (n = 9) => randomBytes(n).toString('base64url');
const byToken = new Map(Object.values(db.trainers).map((t) => [t.tokenHash, t]));

function clientIp(req) {
  if (TRUST_CF && req.headers['cf-connecting-ip']) return String(req.headers['cf-connecting-ip']);
  return req.socket.remoteAddress || 'unknown';
}

const buckets = new Map();
function limited(key, max, windowMs) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now > b.reset) b = { n: 0, reset: now + windowMs };
  b.n += 1;
  buckets.set(key, b);
  return b.n > max;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now > b.reset) buckets.delete(k);
}, 60_000).unref();

function cleanName(s, max = 24) {
  return String(s ?? '')
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .trim()
    .slice(0, max);
}

function trainerFrom(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer ([A-Za-z0-9_-]{20,100})$/.exec(h);
  return m ? byToken.get(sha(m[1])) || null : null;
}

function originOk(req) {
  if (!PUBLIC_ORIGIN) return true;
  const o = req.headers.origin;
  return !o || o === PUBLIC_ORIGIN;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy':
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : headers['Content-Type'] || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(isJson ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(Object.assign(new Error('El archivo es demasiado grande (máx. 8 MB).'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(Object.assign(new Error('JSON inválido'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// ---------- trainer views ----------
function defaultTeam(roster) {
  const rank = { legendary: 3, rare: 2, uncommon: 1, common: 0 };
  return [...roster]
    .sort((a, b) => b.level - a.level || rank[b.rarity] - rank[a.rarity] || (b.shiny ? 1 : 0) - (a.shiny ? 1 : 0))
    .slice(0, TEAM_SIZE)
    .map((e) => e.id);
}

function teamEntries(t) {
  const byId = new Map(t.roster.map((e) => [e.id, e]));
  const team = t.team.map((id) => byId.get(id)).filter(Boolean);
  return team.length ? team : defaultTeam(t.roster).map((id) => byId.get(id));
}

function trainerSummary(t) {
  return {
    id: t.id,
    name: t.name,
    wins: t.wins,
    losses: t.losses,
    rosterSize: t.roster.length,
    shinies: t.roster.filter((e) => e.shiny).length,
    totalTokens: t.totalTokens,
  };
}

function myView(t) {
  return {
    ...trainerSummary(t),
    team: t.team,
    roster: t.roster.map((e) => ({ ...buildFighter(e), active: !!e.active, nickname: e.nickname || null })),
  };
}

function challengeView(c) {
  const host = db.trainers[c.hostId];
  return {
    id: c.id,
    status: c.status,
    levelCap: c.levelCap,
    createdAt: c.createdAt,
    host: { id: c.hostId, name: host?.name ?? c.hostName },
    guest: c.guestId ? { id: c.guestId, name: db.trainers[c.guestId]?.name ?? c.guestName } : null,
    hostTeam: c.hostTeam.map((e) => buildFighter(e, { levelCap: c.levelCap })),
    winnerId: c.winnerId ?? null,
    turns: c.turns ?? null,
    final: c.final ?? null,
  };
}

// ---------- live battles ----------
const rooms = new Map(); // challengeId -> { battle, sockets:Set, deadline, timer }

function room(id) {
  let r = rooms.get(id);
  if (!r) {
    r = { battle: null, sockets: new Set(), deadline: null, timer: null };
    rooms.set(id, r);
  }
  return r;
}

function sideOf(battle, trainerId) {
  if (!battle || !trainerId) return null;
  const i = battle.sides.findIndex((s) => s.trainerId === trainerId);
  return i === -1 ? null : i;
}

function frameFor(r, ws, extra = {}) {
  const you = sideOf(r.battle, ws.trainerId);
  return {
    ...extra,
    state: publicState(r.battle),
    you,
    actions: you === null ? [] : validActions(r.battle, you),
    deadline: r.deadline,
    watchers: r.sockets.size,
  };
}

function broadcast(r, extra) {
  for (const ws of r.sockets) if (ws.readyState === 1) ws.send(JSON.stringify(frameFor(r, ws, extra)));
}

function armTimer(id, r) {
  clearTimeout(r.timer);
  r.timer = null;
  r.deadline = null;
  if (!r.battle || r.battle.status !== 'active') return;
  r.deadline = Date.now() + TURN_MS;
  r.timer = setTimeout(() => {
    // Whoever has not chosen gets an automatic move, so a battle always ends.
    let events = null;
    r.battle.sides.forEach((_, s) => {
      if (needsAction(r.battle, s)) {
        const a = autoAction(r.battle, s);
        if (a) events = submit(r.battle, s, a) || events;
      }
    });
    afterResolve(id, r, events ?? [], true);
  }, TURN_MS);
  r.timer.unref?.();
}

function afterResolve(id, r, events, timedOut = false) {
  if (r.battle.status === 'finished') finishBattle(id, r);
  else armTimer(id, r);
  broadcast(r, { t: 'events', events, timedOut });
}

function finishBattle(id, r) {
  clearTimeout(r.timer);
  r.deadline = null;
  const b = r.battle;
  const c = db.challenges[id];
  if (!c || c.status !== 'active') return;
  c.status = 'finished';
  c.finishedAt = Date.now();
  c.turns = b.turn;
  c.final = publicState(b);
  if (b.winner !== null) {
    const w = db.trainers[b.sides[b.winner].trainerId];
    const l = db.trainers[b.sides[1 - b.winner].trainerId];
    c.winnerId = w?.id ?? null;
    if (w) w.wins += 1;
    if (l) l.losses += 1;
  }
  store.save();
  // Keep the finished room a while for late viewers, then drop it.
  setTimeout(() => {
    const cur = rooms.get(id);
    if (cur === r && r.sockets.size === 0) rooms.delete(id);
  }, 10 * 60_000).unref();
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

async function serveStatic(req, res, path) {
  const rel = normalize(path).replace(/^([/\\])+/, '');
  if (rel.includes('..')) return send(res, 404, 'not found');
  const file = join(PUBLIC_DIR, rel || 'index.html');
  try {
    let body = await readFile(file);
    if (['.html', '.js'].includes(extname(file))) body = body.toString('utf8').replaceAll('?v=dev', `?v=${ASSET_VERSION}`);
    const type = MIME[extname(file)] || 'application/octet-stream';
    // Code revalidates on every load so a deploy shows up at once (Cloudflare would stretch a short
    // max-age to hours). Sprites never change under the same name, so they can be cached.
    const cache = ['.png', '.ico'].includes(extname(file)) ? 'public, max-age=86400' : 'no-cache';
    send(res, 200, body, { 'Content-Type': type, 'Cache-Control': cache });
  } catch {
    send(res, 404, 'not found');
  }
}

async function api(req, res, url) {
  const ip = clientIp(req);
  const method = req.method;
  const p = url.pathname;
  if (method !== 'GET' && !originOk(req)) return send(res, 403, { error: 'Origen no permitido' });
  if (limited(`api:${ip}`, 300, 60_000)) return send(res, 429, { error: 'Demasiadas solicitudes, espera un momento.' });

  if (p === '/api/import' && method === 'POST') {
    if (limited(`import:${ip}`, 20, 10 * 60_000)) return send(res, 429, { error: 'Demasiadas importaciones, espera unos minutos.' });
    const body = await readBody(req);
    if (typeof body.save !== 'string') return send(res, 400, { error: 'Falta el archivo.' });
    const parsed = parseSave(body.save);
    let t = trainerFrom(req);
    let token = null;
    const name = cleanName(body.name);
    if (!t) {
      if (!name) return send(res, 400, { error: 'Ponte un nombre de entrenador.' });
      token = randomBytes(24).toString('base64url');
      t = { id: newId(6), name, tokenHash: sha(token), roster: [], team: [], wins: 0, losses: 0, createdAt: Date.now() };
      db.trainers[t.id] = t;
      byToken.set(t.tokenHash, t);
    } else if (name) t.name = name;
    const nick = new Map(t.roster.map((e) => [e.id, e.nickname]));
    t.roster = parsed.roster.map((e) => (nick.get(e.id) ? { ...e, nickname: nick.get(e.id) } : e));
    const ids = new Set(t.roster.map((e) => e.id));
    t.team = t.team.filter((id) => ids.has(id));
    if (!t.team.length) t.team = defaultTeam(t.roster);
    t.totalTokens = parsed.totalTokens;
    t.updatedAt = Date.now();
    store.save();
    return send(res, 200, { token, me: myView(t) });
  }

  if (p === '/api/me' && method === 'GET') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Sin sesión' });
    return send(res, 200, { me: myView(t) });
  }

  if (p === '/api/me' && method === 'PUT') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Sin sesión' });
    const body = await readBody(req);
    if (body.name !== undefined) {
      const n = cleanName(body.name);
      if (n) t.name = n;
    }
    const byId = new Map(t.roster.map((e) => [e.id, e]));
    if (Array.isArray(body.team)) {
      const team = [...new Set(body.team.filter((id) => typeof id === 'string' && byId.has(id)))].slice(0, TEAM_SIZE);
      if (team.length) t.team = team;
    }
    if (body.nickname && typeof body.nickname.id === 'string' && byId.has(body.nickname.id)) {
      const n = cleanName(body.nickname.name, 16);
      const e = byId.get(body.nickname.id);
      if (n) e.nickname = n;
      else delete e.nickname;
    }
    t.updatedAt = Date.now();
    store.save();
    return send(res, 200, { me: myView(t) });
  }

  if (p === '/api/me/challenges' && method === 'GET') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Sin sesión' });
    const list = Object.values(db.challenges)
      .filter((c) => c.hostId === t.id || c.guestId === t.id)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((c) => ({
        id: c.id,
        status: c.status,
        levelCap: c.levelCap,
        createdAt: c.createdAt,
        opponent: c.hostId === t.id ? (c.guestId ? db.trainers[c.guestId]?.name ?? c.guestName : null) : db.trainers[c.hostId]?.name ?? c.hostName,
        won: c.status === 'finished' ? c.winnerId === t.id : null,
        mine: c.hostId === t.id,
      }));
    return send(res, 200, { challenges: list });
  }

  if (p === '/api/leaderboard' && method === 'GET') {
    const list = Object.values(db.trainers)
      .map(trainerSummary)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.totalTokens - a.totalTokens)
      .slice(0, 50);
    return send(res, 200, { trainers: list });
  }

  if (p === '/api/challenges' && method === 'POST') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Primero importa tu equipo.' });
    if (limited(`challenge:${t.id}`, 30, 10 * 60_000)) return send(res, 429, { error: 'Demasiados desafíos, espera unos minutos.' });
    const body = await readBody(req);
    const levelCap = body.levelCap === 50 ? 50 : null;
    const id = newId(6);
    db.challenges[id] = {
      id,
      hostId: t.id,
      hostName: t.name,
      hostTeam: teamEntries(t).map((e) => ({ ...e })),
      levelCap,
      status: 'open',
      createdAt: Date.now(),
    };
    store.save();
    return send(res, 200, { challenge: challengeView(db.challenges[id]) });
  }

  let m = /^\/api\/challenges\/([A-Za-z0-9_-]{4,20})$/.exec(p);
  if (m && method === 'GET') {
    const c = db.challenges[m[1]];
    if (!c) return send(res, 404, { error: 'Ese desafío no existe.' });
    return send(res, 200, { challenge: challengeView(c) });
  }
  if (m && method === 'DELETE') {
    const t = trainerFrom(req);
    const c = db.challenges[m[1]];
    if (!c) return send(res, 404, { error: 'Ese desafío no existe.' });
    if (!t || c.hostId !== t.id || c.status !== 'open') return send(res, 403, { error: 'No puedes cancelar este desafío.' });
    c.status = 'cancelled';
    store.save();
    return send(res, 200, { challenge: challengeView(c) });
  }

  m = /^\/api\/challenges\/([A-Za-z0-9_-]{4,20})\/accept$/.exec(p);
  if (m && method === 'POST') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Primero importa tu equipo.' });
    const c = db.challenges[m[1]];
    if (!c) return send(res, 404, { error: 'Ese desafío no existe.' });
    if (c.hostId === t.id) return send(res, 400, { error: 'No puedes aceptar tu propio desafío. Mándale el link a un colega.' });
    if (c.status !== 'open') return send(res, 409, { error: 'Este desafío ya no está abierto.' });
    c.status = 'active';
    c.guestId = t.id;
    c.guestName = t.name;
    c.guestTeam = teamEntries(t).map((e) => ({ ...e }));
    const host = db.trainers[c.hostId];
    const r = room(c.id);
    r.battle = createBattle({
      id: c.id,
      levelCap: c.levelCap,
      sides: [
        { trainerId: c.hostId, name: host?.name ?? c.hostName, entries: c.hostTeam },
        { trainerId: t.id, name: t.name, entries: c.guestTeam },
      ],
    });
    store.save();
    armTimer(c.id, r);
    broadcast(r, { t: 'start' });
    return send(res, 200, { challenge: challengeView(c) });
  }

  return send(res, 404, { error: 'No encontrado' });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/healthz') return send(res, 200, 'ok');
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
    if (url.pathname === '/' || /^\/b\/[A-Za-z0-9_-]{4,20}$/.test(url.pathname)) return await serveStatic(req, res, 'index.html');
    return await serveStatic(req, res, url.pathname);
  } catch (e) {
    if (e instanceof SaveError) return send(res, 400, { error: e.message });
    if (e.status) return send(res, e.status, { error: e.message });
    console.error(e);
    if (!res.headersSent) send(res, 500, { error: 'Error interno' });
  }
});

// ---------- WebSocket ----------
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
const wsPerIp = new Map();

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://x');
  const ip = clientIp(req);
  if (url.pathname !== '/ws' || !originOk(req) || (wsPerIp.get(ip) ?? 0) >= 30) {
    socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
    return socket.destroy();
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    wsPerIp.set(ip, (wsPerIp.get(ip) ?? 0) + 1);
    ws.on('close', () => {
      const n = (wsPerIp.get(ip) ?? 1) - 1;
      if (n <= 0) wsPerIp.delete(ip);
      else wsPerIp.set(ip, n);
    });
    onSocket(ws);
  });
});

function onSocket(ws) {
  ws.trainerId = null;
  ws.roomId = null;
  ws.alive = true;
  ws.on('pong', () => (ws.alive = true));
  ws.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.t === 'hello' && !ws.roomId) {
      if (typeof msg.token === 'string') ws.trainerId = byToken.get(sha(msg.token))?.id ?? null;
      const c = typeof msg.room === 'string' ? db.challenges[msg.room] : null;
      if (!c) return ws.send(JSON.stringify({ t: 'error', error: 'Ese desafío no existe.' }));
      ws.roomId = c.id;
      const r = room(c.id);
      r.sockets.add(ws);
      ws.on('close', () => {
        r.sockets.delete(ws);
        if (r.battle) broadcast(r, { t: 'presence' });
        if (!r.battle && r.sockets.size === 0) rooms.delete(c.id);
      });
      if (r.battle) broadcast(r, { t: 'presence' });
      else ws.send(JSON.stringify({ t: 'waiting', watchers: r.sockets.size }));
      return;
    }
    if (msg.t === 'act' && ws.roomId) {
      const r = rooms.get(ws.roomId);
      if (!r?.battle || r.battle.status !== 'active') return;
      const s = sideOf(r.battle, ws.trainerId);
      if (s === null) return;
      const a = msg.action;
      const action = a && a.type === 'move' ? { type: 'move', move: Number(a.move) } : a && a.type === 'switch' ? { type: 'switch', to: Number(a.to) } : null;
      let events;
      try {
        events = submit(r.battle, s, action);
      } catch (e) {
        return ws.send(JSON.stringify({ t: 'error', error: e.message }));
      }
      if (events) afterResolve(ws.roomId, r, events);
      else broadcast(r, { t: 'ready' });
    }
  });
}

setInterval(() => {
  for (const ws of wss.clients) {
    if (!ws.alive) {
      ws.terminate();
      continue;
    }
    ws.alive = false;
    ws.ping();
  }
}, 30_000).unref();

server.listen(PORT, HOST, () => console.log(`token-clash escuchando en http://${HOST}:${PORT}`));

for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, () => {
    store.flushNow();
    process.exit(0);
  });
}

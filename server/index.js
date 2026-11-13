import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { parseSave, SaveError, uniqueSpecies, uniqueVariants, carryTeam } from './save.js';
import { buildFighter, movepool, validMoveset, abilityOptions, usableAbility, movesetFor, speciesData, lineageLearnset, MOVES_PER_FIGHTER } from './creatures.js';
import { abilityInfo } from './abilities.js';
import { createBattle, submit, autoAction, needsAction, validActions, publicState, viewEvents } from './battle.js';
import { createPreview, pick, fillMissing, previewReady, chosenEntries, previewView, PARTY_SIZE } from './preview.js';
import { openStore } from './store.js';
import { serverStats } from './stats.js';
import { pokedexOf } from './pokedex.js';
import { openRooms, matchFor, visibilityOf, joinBlocker, HOST_GRACE_MS } from './lobby.js';
import { TOURNAMENT_SIZES, aiName, humanCount, reachedRound, addSeat, removeSeat, setReady, allReady, isFull, seatOf, nextAiId, shuffledOrder, createBracket, nextMatch, recordWinner, roundName, matchNumber, totalMatches, tournamentMatchFor } from './tournament.js';
import { randomParty } from './random.js';
import { AI_LEVELS, JEV_LEVEL, aiTrainerId, aiLevelOf, buildAiTeam, buildAiRandomParty, aiPicks, chooseAction } from './ai.js';
import { chooseJevAction, jevConfigured } from './jev.js';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_DIR = process.env.DATA_DIR || fileURLToPath(new URL('../data', import.meta.url));
const PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN || '';
const TRUST_CF = process.env.TRUST_CF_CONNECTING_IP === '1';
const TURN_MS = Number(process.env.TURN_MS || 60_000);
const PREVIEW_MS = Number(process.env.PREVIEW_MS || 60_000);
const ROLL_MS = Number(process.env.ROLL_MS ?? 6_000);
const MATCH_MS = Number(process.env.MATCH_MS ?? 5_000);
const DRAW_MS = Number(process.env.DRAW_MS ?? 6_000);
const BETWEEN_MS = Number(process.env.BETWEEN_MS ?? 15_000);
const AI_PACE_MS = Number(process.env.AI_PACE_MS ?? 2_500);
const ABSENT_MS = Number(process.env.ABSENT_MS ?? 15_000);
const SEAT_GRACE_MS = Number(process.env.SEAT_GRACE_MS ?? 30_000);
// Skynet needs a way to reach Jev: JEV_API_URL (the egress proxy, which holds the key) or a key to
// call TypeSafe directly. Without either, the level is neither offered nor accepted.
const JEV_API_KEY = process.env.JEV_API_KEY || '';
const JEV_ON = jevConfigured();
const AI_AVAILABLE = AI_LEVELS.filter((level) => level !== JEV_LEVEL || JEV_ON);
const PUBLIC_DIR = fileURLToPath(new URL('../public', import.meta.url));
// "?v=dev" in index.html and app.js becomes a hash of the code, so each deploy gets new URLs and
// no browser keeps old code (Cloudflare stretches the cache of .js/.css to hours).
const ASSET_VERSION = (() => {
  const h = createHash('sha256');
  for (const f of readdirSync(PUBLIC_DIR).filter((f) => /\.(js|css|html)$/.test(f)).sort()) h.update(f).update(readFileSync(join(PUBLIC_DIR, f)));
  return h.digest('hex').slice(0, 10);
})();
const MAX_BODY = 9 * 1024 * 1024;
const STARTED_AT = Date.now();

const store = openStore(DATA_DIR);
const { db } = store;
dropRepeatedSpecies();

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
  return seen(m ? byToken.get(sha(m[1])) : null);
}

function seen(t) {
  if (t) t.lastSeen = Date.now();
  return t ?? null;
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
  const best = [...roster].sort((a, b) => b.level - a.level || rank[b.rarity] - rank[a.rarity] || (b.shiny ? 1 : 0) - (a.shiny ? 1 : 0));
  return uniqueSpecies(best)
    .slice(0, PARTY_SIZE)
    .map((e) => e.id);
}

function teamEntries(t) {
  const byId = new Map(t.roster.map((e) => [e.id, e]));
  const team = uniqueSpecies(t.team.map((id) => byId.get(id)).filter(Boolean));
  return team.length ? team : defaultTeam(t.roster).map((id) => byId.get(id));
}

function saveEdit(e) {
  if (!e.moveset && !e.abilityChoice) return null;
  const data = speciesData(e.finalID);
  const level = new Map([...lineageLearnset(e.finalID)].map(([id, m]) => [id, m.level]));
  const out = { id: e.id };
  if (e.moveset && validMoveset(e, e.moveset)) out.currentMoves = e.moveset.map((name) => ({ name, level: level.get(name) ?? 1 }));
  if (e.abilityChoice && data) {
    const hidden = data.hiddenAbility === e.abilityChoice && !data.abilities.includes(e.abilityChoice);
    out.ability = { name: e.abilityChoice, slot: hidden ? 3 : data.abilities.indexOf(e.abilityChoice) + 1, hidden };
  }
  return out.currentMoves || out.ability ? out : null;
}

function monDetail(e) {
  const chosen = new Set(movesetFor(e));
  const learnedAt = lineageLearnset(e.finalID);
  return {
    ...buildFighter(e),
    nickname: e.nickname || null,
    movepool: movepool(e).map((m) => ({ level: learnedAt.get(m.key)?.level ?? null, key: m.key, name: m.name, desc: m.desc, type: m.type, category: m.category, power: m.power, accuracy: m.accuracy, pp: m.pp, priority: m.priority, contact: m.flags.includes('contact'), supported: m.supported, chosen: chosen.has(m.key) })),
    abilityOptions: abilityOptions(e).map((a) => ({ ...abilityInfo(a.key), hidden: a.hidden })),
    maxMoves: MOVES_PER_FIGHTER,
  };
}

function dropRepeatedSpecies() {
  let changed = false;
  for (const t of Object.values(db.trainers)) {
    const roster = uniqueVariants(t.roster ?? []);
    const team = carryTeam(t.team ?? [], t.roster, roster);
    if (roster.length === t.roster.length && team.join() === (t.team ?? []).join()) continue;
    t.team = team;
    t.roster = roster;
    if (!t.team.length) t.team = defaultTeam(roster);
    changed = true;
  }
  for (const c of Object.values(db.challenges)) {
    if (c.status !== 'open' || !Array.isArray(c.hostTeam)) continue;
    const team = uniqueSpecies(c.hostTeam);
    if (team.length === c.hostTeam.length) continue;
    c.hostTeam = team;
    changed = true;
  }
  if (changed) store.save();
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
    aiLevels: AI_AVAILABLE,
    roster: t.roster.map((e) => ({ ...buildFighter(e), active: !!e.active, nickname: e.nickname || null, saveEdit: saveEdit(e) })).sort((a, b) => a.speciesId - b.speciesId),
  };
}


function challengeView(c, viewerId = null) {
  const host = db.trainers[c.hostId];
  const hostTeam = (c.status === 'finished' || c.mode !== 'random' ? c.hostTeam : []).map((e) => buildFighter(e, { levelCap: c.levelCap }));
  return {
    id: c.id,
    status: c.status,
    levelCap: c.levelCap,
    mode: c.mode ?? 'team',
    ai: c.ai ?? null,
    visibility: visibilityOf(c),
    tournament: c.tournamentId && db.tournaments[c.tournamentId]?.bracket ? tournamentLabel(db.tournaments[c.tournamentId], { round: c.round, index: c.match }) : null,
    createdAt: c.createdAt,
    host: { id: c.hostId, name: host?.name ?? c.hostName },
    guest: c.guestId ? { id: c.guestId, name: db.trainers[c.guestId]?.name ?? c.guestName } : null,
    hostTeam: viewerId === c.hostId || c.status === 'finished' ? hostTeam : [],
    hostTeamSize: c.mode === 'random' ? Math.min(PARTY_SIZE, host?.roster.length ?? 0) : hostTeam.length,
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

function sideIn(sides, trainerId) {
  if (!trainerId) return null;
  const i = sides.findIndex((s) => s.trainerId === trainerId);
  return i === -1 ? null : i;
}

function previewFrame(r, ws, extra) {
  const you = sideIn(r.preview.sides, ws.trainerId);
  return { ...extra, t: extra.t === 'presence' || extra.t === 'ready' ? 'preview' : extra.t, preview: previewView(r.preview, you), you, deadline: r.deadline, watchers: r.sockets.size };
}

function armPreviewTimer(id, r, extraMs = 0) {
  clearTimeout(r.timer);
  const ms = (someoneAbsent(id, r, r.preview.sides) ? Math.min(ABSENT_MS, PREVIEW_MS) : PREVIEW_MS) + extraMs;
  r.deadline = Date.now() + ms;
  r.timer = setTimeout(() => {
    if (!r.preview) return;
    fillMissing(r.preview);
    startBattle(id, r);
  }, ms);
  r.timer.unref?.();
}

function startBattle(id, r) {
  const p = r.preview;
  r.preview = null;
  r.battle = createBattle({
    id,
    levelCap: p.levelCap,
    sides: p.sides.map((side, s) => ({ trainerId: side.trainerId, name: side.name, entries: chosenEntries(p, s) })),
  });
  armTimer(id, r);
  broadcast(r, { t: 'start' });
  nextAiTurn(id, r);
}

const aiOnly = (b) => b.sides.every((side) => aiLevelOf(side.trainerId));

function nextAiTurn(id, r) {
  if (r.battle && aiOnly(r.battle)) setTimeout(() => aiTurn(id, r), AI_PACE_MS).unref?.();
  else aiTurn(id, r);
}

function someoneAbsent(id, r, sides) {
  if (!db.challenges[id]?.tournamentId) return false;
  return sides.some((side) => !aiLevelOf(side.trainerId) && ![...r.sockets].some((ws) => ws.trainerId === side.trainerId && ws.readyState === 1));
}

function aiTurn(id, r) {
  const b = r.battle;
  if (!b || b.status !== 'active') return;
  let events = null;
  let acted = false;
  b.sides.forEach((side, s) => {
    const level = aiLevelOf(side.trainerId);
    if (!level || !needsAction(b, s)) return;
    // Never let a Skynet bug become an unhandled rejection: the turn timer still plays for it.
    if (level === JEV_LEVEL) return void jevTurn(id, r, s).catch((e) => console.error('Skynet:', e));
    const action = chooseAction(b, s, level) ?? autoAction(b, s);
    if (!action) return;
    acted = true;
    events = submit(b, s, action) || events;
  });
  if (events) afterResolve(id, r, events);
  else if (acted) broadcast(r, { t: 'ready' });
}

// Jev answers over the network, so this side acts later. Meanwhile the rival may act, the turn
// timer may play for Skynet, or the room may close: the answer only counts if nothing moved.
async function jevTurn(id, r, s) {
  const b = r.battle;
  const at = `${b.turn}:${b.phase}`;
  r.jevAsked ??= new Set();
  if (r.jevAsked.has(at)) return;
  r.jevAsked.add(at);
  const picked = await chooseJevAction(b, s, { apiKey: JEV_API_KEY });
  r.jevAsked.delete(at);
  if (r.battle !== b || b.status !== 'active' || `${b.turn}:${b.phase}` !== at || !needsAction(b, s)) return;
  const action = picked ?? chooseAction(b, s, JEV_LEVEL) ?? autoAction(b, s);
  if (!action) return;
  let events;
  try {
    events = submit(b, s, action);
  } catch {
    return;
  }
  if (events) afterResolve(id, r, events);
  else broadcast(r, { t: 'ready' });
}

function inRoom(r, trainerId) {
  return [...r.sockets].some((ws) => ws.trainerId === trainerId && ws.readyState === 1);
}

function frameFor(r, ws, extra = {}) {
  if (r.readyCheck) {
    const players = r.readyCheck.players;
    const you = players.findIndex((p) => p.id === ws.trainerId);
    return { t: 'lobby', players: players.map((p) => ({ ...p, ready: r.readyCheck.ready.has(p.id), online: inRoom(r, p.id) })), you: you === -1 ? null : you };
  }
  if (r.countdown) {
    const you = r.countdown.players.findIndex((p) => p.id === ws.trainerId);
    return { ...extra, t: 'countdown', ms: Math.max(0, r.countdown.endsAt - Date.now()), players: r.countdown.players, you: you === -1 ? null : you, tournament: r.countdown.tournament ?? null };
  }
  if (r.preview) return previewFrame(r, ws, extra);
  const you = sideOf(r.battle, ws.trainerId);
  return {
    ...extra,
    ...(extra.events ? { events: viewEvents(extra.events, you) } : {}),
    state: publicState(r.battle, you),
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
  const ms = someoneAbsent(id, r, r.battle.sides) ? Math.min(ABSENT_MS, TURN_MS) : TURN_MS;
  r.deadline = Date.now() + ms;
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
  }, ms);
  r.timer.unref?.();
}

function afterResolve(id, r, events, timedOut = false) {
  if (r.battle.status === 'finished') finishBattle(id, r);
  else armTimer(id, r);
  broadcast(r, { t: 'events', events, timedOut });
  nextAiTurn(id, r);
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
    c.winnerId = b.sides[b.winner].trainerId;
    const w = db.trainers[b.sides[b.winner].trainerId];
    const l = db.trainers[b.sides[1 - b.winner].trainerId];
    if (w && !c.ai && !c.tournamentId) w.wins += 1;
    if (l && !c.ai && !c.tournamentId) l.losses += 1;
  }
  store.save();
  if (c.tournamentId) tournamentMatchDone(c, b.winner);
  // Keep the finished room a while for late viewers, then drop it.
  setTimeout(() => {
    const cur = rooms.get(id);
    if (cur === r && r.sockets.size === 0) rooms.delete(id);
  }, 10 * 60_000).unref();
}

function averageLevel(entries) {
  if (!entries.length) return 50;
  return Math.max(1, Math.min(100, Math.round(entries.reduce((sum, e) => sum + e.level, 0) / entries.length)));
}

function startAiChallenge(t, { mode, levelCap, level }) {
  const id = newId(6);
  const hostTeam = mode === 'random' ? randomParty(t.roster) : teamEntries(t).map((e) => ({ ...e }));
  const aiLevel = levelCap ?? averageLevel(hostTeam);
  const aiTeam = mode === 'random' ? buildAiRandomParty({ level: aiLevel }) : buildAiTeam({ difficulty: level, level: aiLevel });
  const c = {
    id,
    hostId: t.id,
    hostName: t.name,
    hostTeam,
    guestId: aiTrainerId(level),
    guestName: aiName(level).name,
    guestTeam: aiTeam,
    levelCap,
    mode,
    ai: level,
    status: 'active',
    createdAt: Date.now(),
  };
  db.challenges[id] = c;
  const r = room(id);
  r.preview = createPreview({
    levelCap,
    mode,
    sides: [
      { trainerId: t.id, name: t.name, entries: hostTeam },
      { trainerId: c.guestId, name: c.guestName, entries: aiTeam },
    ],
  });
  pick(r.preview, 1, aiPicks({ difficulty: level, own: r.preview.sides[1].entries }));
  store.save();
  armPreviewTimer(id, r, mode === 'random' ? ROLL_MS : 0);
  return c;
}

function hostWaiting(c) {
  const r = rooms.get(c.id);
  return !!r && [...r.sockets].some((ws) => ws.trainerId === c.hostId && ws.readyState === 1);
}

function publicRooms() {
  return openRooms(db.challenges, { hostWaiting });
}

const lobbySockets = new Set();
const sentRooms = new WeakMap();
let lobbyTimer = null;

function roomsFrame(ws) {
  const list = [...publicRooms().map((c) => roomView(c, ws.trainerId)), ...listedTournaments().map((T) => tournamentRoomView(T, ws.trainerId))].sort((a, b) => a.createdAt - b.createdAt);
  return JSON.stringify({ t: 'rooms', rooms: list.slice(0, 40) });
}

function sendRooms(ws, force = false) {
  if (ws.readyState !== 1) return;
  const frame = roomsFrame(ws);
  if (!force && sentRooms.get(ws) === frame) return;
  sentRooms.set(ws, frame);
  ws.send(frame);
}

function notifyLobby() {
  if (lobbyTimer) return;
  lobbyTimer = setTimeout(() => {
    lobbyTimer = null;
    for (const ws of lobbySockets) sendRooms(ws);
  }, 50);
}

function closeRoom(c) {
  c.status = 'cancelled';
  store.save();
  const r = rooms.get(c.id);
  if (r) for (const ws of r.sockets) if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'closed' }));
  notifyLobby();
}

function roomView(c, viewerId) {
  const host = db.trainers[c.hostId];
  return { id: c.id, kind: 'duel', mode: c.mode ?? 'team', levelCap: c.levelCap ?? null, createdAt: c.createdAt, host: { name: host?.name ?? c.hostName, wins: host?.wins ?? 0, losses: host?.losses ?? 0 }, mine: c.hostId === viewerId };
}

function joinChallenge(c, t) {
  const host = db.trainers[c.hostId];
  const random = c.mode === 'random';
  if (random) {
    if (!host?.roster.length) return 'El anfitrión ya no tiene Pokémon.';
    c.hostTeam = randomParty(host.roster);
    c.guestTeam = randomParty(t.roster);
  } else c.guestTeam = teamEntries(t).map((e) => ({ ...e }));
  c.status = 'active';
  c.guestId = t.id;
  c.guestName = t.name;
  store.save();
  const r = room(c.id);
  r.readyCheck = { ready: new Set(), players: [countdownPlayer(c.hostId, c.hostName), countdownPlayer(t.id, t.name)] };
  broadcast(r, { t: 'lobby' });
  notifyLobby();
  return null;
}

function startCountdown(c, r, tournament = null) {
  r.readyCheck = null;
  r.countdown = { endsAt: Date.now() + MATCH_MS, players: [countdownPlayer(c.hostId, c.hostName), countdownPlayer(c.guestId, c.guestName)], tournament };
  r.countdownTimer = setTimeout(() => openPreview(c, r), MATCH_MS);
  broadcast(r, { t: 'countdown' });
}

function setRoomReady(c, r, trainerId, ready) {
  if (!r.readyCheck?.players.some((p) => p.id === trainerId)) return;
  if (ready) r.readyCheck.ready.add(trainerId);
  else r.readyCheck.ready.delete(trainerId);
  if (r.readyCheck.players.every((p) => r.readyCheck.ready.has(p.id))) startCountdown(c, r);
  else broadcast(r, { t: 'lobby' });
}

function reopenRoom(c, r) {
  if (!r.readyCheck) return;
  r.readyCheck = null;
  c.status = 'open';
  if (c.mode === 'random') c.hostTeam = [];
  delete c.guestId;
  delete c.guestName;
  delete c.guestTeam;
  store.save();
  for (const ws of r.sockets) if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'reopened', host: ws.trainerId === c.hostId }));
  notifyLobby();
}

function countdownPlayer(id, fallbackName) {
  const level = aiLevelOf(id);
  if (level) return { id, name: fallbackName, ai: level, wins: 0, losses: 0, rosterSize: 0, shinies: 0 };
  const t = db.trainers[id];
  return { id, name: t?.name ?? fallbackName, ai: null, wins: t?.wins ?? 0, losses: t?.losses ?? 0, rosterSize: t?.roster.length ?? 0, shinies: t?.roster.filter((e) => e.shiny).length ?? 0 };
}

function openPreview(c, r) {
  r.countdown = null;
  if (c.status !== 'active') return;
  r.preview = createPreview({
    levelCap: c.levelCap,
    mode: c.mode ?? 'team',
    sides: [
      { trainerId: c.hostId, name: db.trainers[c.hostId]?.name ?? c.hostName, entries: c.hostTeam },
      { trainerId: c.guestId, name: db.trainers[c.guestId]?.name ?? c.guestName, entries: c.guestTeam },
    ],
  });
  r.preview.sides.forEach((side, s) => {
    const level = aiLevelOf(side.trainerId);
    if (level) pick(r.preview, s, aiPicks({ difficulty: level, own: side.entries }));
  });
  if (previewReady(r.preview)) return startBattle(c.id, r);
  armPreviewTimer(c.id, r, c.mode === 'random' ? ROLL_MS : 0);
  broadcast(r, { t: 'preview' });
}

// ---------- tournaments ----------
const tourSockets = new Map();
const tourTimers = new Map();

function tourWatchers(id) {
  let set = tourSockets.get(id);
  if (!set) tourSockets.set(id, (set = new Set()));
  return set;
}

function inTournament(id, trainerId) {
  return [...(tourSockets.get(id) ?? [])].some((ws) => ws.trainerId === trainerId && ws.readyState === 1);
}

function tournamentView(T, viewerId = null) {
  const you = seatOf(T, viewerId);
  return {
    id: T.id,
    status: T.status,
    mode: T.mode,
    levelCap: T.levelCap ?? null,
    size: T.size,
    visibility: T.visibility,
    createdAt: T.createdAt,
    hostId: T.hostId,
    host: viewerId === T.hostId,
    you: you === -1 ? null : you,
    seats: T.seats.map((seat) => {
      const t = seat.ai ? null : db.trainers[seat.id];
      return { name: seat.name, ai: seat.ai ?? null, ready: seat.ready, online: seat.ai ? true : inTournament(T.id, seat.id), wins: t?.wins ?? 0, losses: t?.losses ?? 0, rosterSize: t?.roster.length ?? 0 };
    }),
    rounds: (T.bracket ?? []).map((round, i) => ({ name: roundName(T.size, i), matches: round.map((m) => ({ a: m.a, b: m.b, winner: m.winner, coinFlip: !!m.coinFlip, challengeId: m.challengeId })) })),
    current: T.current ?? null,
    drawAt: T.drawAt ?? null,
    nextAt: T.nextAt ?? null,
    champion: T.champion ?? null,
    played: T.bracket ? T.bracket.flat().filter((m) => m.winner !== null).length : 0,
    total: T.bracket ? totalMatches(T.bracket) : T.size - 1,
    aiLevels: AI_AVAILABLE,
    serverNow: Date.now(),
  };
}

function broadcastTournament(T) {
  for (const ws of tourSockets.get(T.id) ?? []) if (ws.readyState === 1) ws.send(JSON.stringify({ t: 'tour', tournament: tournamentView(T, ws.trainerId) }));
  if (T.visibility === 'public') notifyLobby();
}

function listedTournaments(now = Date.now()) {
  return Object.values(db.tournaments)
    .filter((T) => T.status === 'open' && T.visibility === 'public' && !isFull(T) && (now - T.createdAt < HOST_GRACE_MS || inTournament(T.id, T.hostId)))
    .sort((a, b) => a.createdAt - b.createdAt);
}

function tournamentRoomView(T, viewerId) {
  const host = db.trainers[T.hostId];
  return { id: T.id, kind: 'tournament', mode: T.mode, levelCap: T.levelCap ?? null, size: T.size, filled: T.seats.length, createdAt: T.createdAt, host: { name: host?.name ?? T.seats[0]?.name, wins: host?.wins ?? 0, losses: host?.losses ?? 0 }, mine: seatOf(T, viewerId) !== -1 };
}

function createTournament(t, { mode, levelCap, size, visibility }) {
  const id = newId(6);
  const T = { id, hostId: t.id, mode, levelCap, size, visibility, status: 'open', createdAt: Date.now(), seats: [] };
  addSeat(T, { id: t.id, name: t.name, ai: null });
  db.tournaments[id] = T;
  store.save();
  watchSeat(T, t.id);
  if (visibility === 'public') setTimeout(notifyLobby, HOST_GRACE_MS + 100).unref();
  return T;
}

function joinTournament(T, t) {
  if (T.status !== 'open') throw new Error(T.status === 'running' || T.status === 'finished' ? 'Llegaste tarde: este torneo ya partió.' : 'Este torneo se cerró.');
  addSeat(T, { id: t.id, name: t.name, ai: null });
  store.save();
  watchSeat(T, t.id);
  afterSeatsChange(T);
}

function afterSeatsChange(T) {
  if (allReady(T)) return startTournament(T);
  store.save();
  broadcastTournament(T);
}

function closeTournament(T) {
  T.status = 'cancelled';
  store.save();
  broadcastTournament(T);
  notifyLobby();
}

function watchSeat(T, trainerId) {
  const key = `${T.id}:${trainerId}`;
  clearTimeout(tourTimers.get(key));
  tourTimers.set(
    key,
    setTimeout(() => {
      tourTimers.delete(key);
      if (T.status !== 'open' || inTournament(T.id, trainerId)) return;
      if (trainerId === T.hostId) return closeTournament(T);
      const i = seatOf(T, trainerId);
      if (i > 0) {
        T.seats.splice(i, 1);
        afterSeatsChange(T);
      }
    }, SEAT_GRACE_MS),
  );
  tourTimers.get(key).unref?.();
}

function humanAverageLevel(T) {
  const entries = T.seats.filter((seat) => !seat.ai).flatMap((seat) => (db.trainers[seat.id] ? teamEntries(db.trainers[seat.id]) : []));
  return averageLevel(entries);
}

function startTournament(T) {
  T.status = 'running';
  T.startedAt = Date.now();
  T.bracket = createBracket(shuffledOrder(T.size));
  T.drawAt = Date.now();
  T.aiLevel = T.levelCap ?? humanAverageLevel(T);
  T.nextAt = Date.now() + DRAW_MS;
  store.save();
  broadcastTournament(T);
  notifyLobby();
  setTimeout(() => startTournamentMatch(T), DRAW_MS).unref?.();
}

function seatTeam(T, seat) {
  if (seat.ai) return T.mode === 'random' ? buildAiRandomParty({ level: T.aiLevel }) : buildAiTeam({ difficulty: seat.ai, level: T.aiLevel });
  const t = db.trainers[seat.id];
  if (!t?.roster.length) return buildAiRandomParty({ level: T.aiLevel });
  return T.mode === 'random' ? randomParty(t.roster) : teamEntries(t).map((e) => ({ ...e }));
}

function startTournamentMatch(T) {
  if (T.status !== 'running') return;
  const at = nextMatch(T.bracket);
  if (!at) return;
  const m = T.bracket[at.round][at.index];
  const [first, second] = [T.seats[m.a], T.seats[m.b]];
  const [host, guest] = first.ai && !second.ai ? [second, first] : [first, second];
  const id = newId(6);
  const c = {
    id,
    hostId: host.id,
    hostName: host.name,
    hostTeam: seatTeam(T, host),
    guestId: guest.id,
    guestName: guest.name,
    guestTeam: seatTeam(T, guest),
    levelCap: T.levelCap,
    mode: T.mode,
    ai: guest.ai ?? host.ai ?? null,
    aiOnly: !!(host.ai && guest.ai),
    visibility: 'private',
    tournamentId: T.id,
    round: at.round,
    match: at.index,
    status: 'active',
    createdAt: Date.now(),
  };
  db.challenges[id] = c;
  m.challengeId = id;
  T.current = { ...at, challengeId: id };
  T.nextAt = null;
  store.save();
  startCountdown(c, room(id), tournamentLabel(T, at));
  broadcastTournament(T);
}

function tournamentLabel(T, at) {
  const final = at.round === T.bracket.length - 1;
  return { id: T.id, size: T.size, round: roundName(T.size, at.round), next: final ? null : roundName(T.size, at.round + 1), final, number: matchNumber(T.bracket, at), total: totalMatches(T.bracket) };
}

function tournamentMatchDone(c, winnerSide) {
  const T = db.tournaments[c.tournamentId];
  if (!T || T.status !== 'running') return;
  const m = T.bracket[c.round][c.match];
  let winner = T.seats.findIndex((seat) => seat.id === c.winnerId);
  if (winnerSide === null || winner === -1) {
    winner = Math.random() < 0.5 ? m.a : m.b;
    m.coinFlip = true;
  }
  const champion = recordWinner(T.bracket, { round: c.round, index: c.match }, winner);
  T.current = null;
  if (champion !== null) {
    T.status = 'finished';
    T.champion = champion;
    T.finishedAt = Date.now();
  } else {
    T.nextAt = Date.now() + BETWEEN_MS;
    setTimeout(() => startTournamentMatch(T), BETWEEN_MS).unref?.();
  }
  store.save();
  broadcastTournament(T);
}

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };

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
    const cache = ['.png', '.gif', '.ico'].includes(extname(file)) ? 'public, max-age=86400' : 'no-cache';
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
      t = { id: newId(6), name, tokenHash: sha(token), roster: [], team: [], wins: 0, losses: 0, createdAt: Date.now(), lastSeen: Date.now() };
      db.trainers[t.id] = t;
      byToken.set(t.tokenHash, t);
    } else if (name) t.name = name;
    const previous = t.roster;
    const kept = new Map(t.roster.map((e) => [e.id, { nickname: e.nickname, moveset: e.moveset, abilityChoice: e.abilityChoice }]));
    t.roster = parsed.roster.map((e) => {
      const k = kept.get(e.id);
      if (!k) return e;
      return Object.fromEntries(Object.entries({ ...e, ...k }).filter(([, v]) => v !== undefined));
    });
    t.team = carryTeam(t.team, previous, t.roster);
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
      const team = uniqueSpecies([...new Set(body.team.filter((id) => typeof id === 'string' && byId.has(id)))].map((id) => byId.get(id))).map((e) => e.id).slice(0, PARTY_SIZE);
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

  let mon = /^\/api\/me\/mons\/([A-Za-z0-9_-]{1,64})$/.exec(p);
  if (mon) {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Sin sesión' });
    const e = t.roster.find((x) => x.id === mon[1]);
    if (!e) return send(res, 404, { error: 'Ese Pokémon no está en tu colección.' });
    if (method === 'PUT') {
      const body = await readBody(req);
      if (body.moves !== undefined) {
        if (!validMoveset(e, body.moves)) return send(res, 400, { error: `Elige entre 1 y ${MOVES_PER_FIGHTER} movimientos distintos que conozca.` });
        e.moveset = [...body.moves];
      }
      if (body.ability !== undefined) {
        if (!abilityOptions(e).some((a) => a.key === body.ability)) return send(res, 400, { error: 'Esa habilidad no es de su especie.' });
        if (!usableAbility(body.ability)) return send(res, 400, { error: 'Esa habilidad no tiene efecto en Token Clash.' });
        e.abilityChoice = body.ability;
      }
      t.updatedAt = Date.now();
      store.save();
    } else if (method !== 'GET') return send(res, 405, { error: 'Método no permitido' });
    return send(res, 200, { mon: monDetail(e) });
  }

  if (p === '/api/pokedex' && method === 'GET') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Sin sesión' });
    return send(res, 200, { pokedex: pokedexOf(t.roster) });
  }

  if (p === '/api/me/challenges' && method === 'GET') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Sin sesión' });
    const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));
    const limit = Math.min(50, Math.max(1, Math.floor(Number(url.searchParams.get('limit')) || 30)));
    const mine = Object.values(db.challenges)
      .filter((c) => !c.ai && !c.tournamentId && (c.hostId === t.id || c.guestId === t.id))
      .sort((a, b) => b.createdAt - a.createdAt);
    const list = mine
      .slice(offset, offset + limit)
      .map((c) => ({
        id: c.id,
        status: c.status,
        levelCap: c.levelCap,
        mode: c.mode ?? 'team',
        ai: c.ai ?? null,
        visibility: visibilityOf(c),
        createdAt: c.createdAt,
        opponent: c.hostId === t.id ? (c.guestId ? db.trainers[c.guestId]?.name ?? c.guestName : null) : db.trainers[c.hostId]?.name ?? c.hostName,
        won: c.status === 'finished' ? c.winnerId === t.id : null,
        mine: c.hostId === t.id,
      }));
    const tournaments = Object.values(db.tournaments)
      .filter((T) => seatOf(T, t.id) !== -1 && (T.status === 'open' || T.status === 'running' || (T.status === 'finished' && humanCount(T) >= 2)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15)
      .map((T) => {
        const seat = seatOf(T, t.id);
        const reached = T.bracket ? reachedRound(T.bracket, seat) : -1;
        return { id: T.id, size: T.size, mode: T.mode, levelCap: T.levelCap ?? null, status: T.status, humans: humanCount(T), createdAt: T.createdAt, champion: T.champion === seat, reached: reached === -1 ? null : roundName(T.size, reached) };
      });
    return send(res, 200, { challenges: list, hasMore: offset + limit < mine.length, tournaments });
  }

  if (p === '/api/stats' && method === 'GET') {
    const live = [...rooms.values()].filter((r) => r.sockets.size > 0 && (r.countdown || r.preview || r.battle?.status === 'active')).length;
    return send(res, 200, { ...serverStats(db), live: { battles: live, startedAt: STARTED_AT, version: ASSET_VERSION } });
  }

  if (p === '/api/rooms' && method === 'GET') {
    const viewer = trainerFrom(req)?.id ?? null;
    const list = [...publicRooms().map((c) => roomView(c, viewer)), ...listedTournaments().map((T) => tournamentRoomView(T, viewer))].sort((a, b) => a.createdAt - b.createdAt);
    return send(res, 200, { rooms: list.slice(0, 40) });
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
    const mode = body.mode === 'random' ? 'random' : 'team';
    if (body.ai === JEV_LEVEL && !JEV_ON) return send(res, 503, { error: 'Skynet no está disponible en este servidor.' });
    if (AI_AVAILABLE.includes(body.ai)) return send(res, 200, { challenge: challengeView(startAiChallenge(t, { mode, levelCap, level: body.ai }), t.id) });
    const visibility = body.visibility === 'private' ? 'private' : 'public';
    if (visibility === 'public') {
      const { own, rival } = matchFor(publicRooms(), { trainerId: t.id, mode, levelCap });
      if (rival && !joinChallenge(rival, t)) {
        if (own) closeRoom(own);
        return send(res, 200, { challenge: challengeView(rival, t.id), joined: true });
      }
      if (own) return send(res, 200, { challenge: challengeView(own, t.id) });
    }
    const id = newId(6);
    db.challenges[id] = {
      id,
      hostId: t.id,
      hostName: t.name,
      hostTeam: mode === 'random' ? [] : teamEntries(t).map((e) => ({ ...e })),
      levelCap,
      mode,
      visibility,
      status: 'open',
      createdAt: Date.now(),
    };
    store.save();
    if (visibility === 'public') {
      notifyLobby();
      setTimeout(notifyLobby, HOST_GRACE_MS + 100).unref();
    }
    return send(res, 200, { challenge: challengeView(db.challenges[id], t.id) });
  }

  let m = /^\/api\/challenges\/([A-Za-z0-9_-]{4,20})$/.exec(p);
  if (m && method === 'GET') {
    const c = db.challenges[m[1]];
    if (!c) return send(res, 404, { error: 'Ese desafío no existe.' });
    return send(res, 200, { challenge: challengeView(c, trainerFrom(req)?.id) });
  }
  if (m && method === 'DELETE') {
    const t = trainerFrom(req);
    const c = db.challenges[m[1]];
    if (!c) return send(res, 404, { error: 'Ese desafío no existe.' });
    const checking = c.status === 'active' && rooms.get(c.id)?.readyCheck;
    if (!t || c.hostId !== t.id || (c.status !== 'open' && !checking) || c.tournamentId) return send(res, 403, { error: 'No puedes cerrar esta sala.' });
    if (checking) rooms.get(c.id).readyCheck = null;
    closeRoom(c);
    return send(res, 200, { challenge: challengeView(c, t.id) });
  }

  m = /^\/api\/challenges\/([A-Za-z0-9_-]{4,20})\/accept$/.exec(p);
  if (m && method === 'POST') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Primero importa tu equipo.' });
    const c = db.challenges[m[1]];
    const blocked = joinBlocker(c, { trainerId: t.id, hostWaiting });
    if (blocked) return send(res, blocked.status, { error: blocked.error });
    const failed = joinChallenge(c, t);
    if (failed) return send(res, 409, { error: failed });
    return send(res, 200, { challenge: challengeView(c, t.id) });
  }

  if (p === '/api/tournaments' && method === 'POST') {
    const t = trainerFrom(req);
    if (!t) return send(res, 401, { error: 'Primero importa tu equipo.' });
    if (limited(`challenge:${t.id}`, 30, 10 * 60_000)) return send(res, 429, { error: 'Demasiados desafíos, espera unos minutos.' });
    const body = await readBody(req);
    const opts = { mode: body.mode === 'random' ? 'random' : 'team', levelCap: body.levelCap === 50 ? 50 : null, size: TOURNAMENT_SIZES.includes(body.size) ? body.size : 8, visibility: body.visibility === 'private' ? 'private' : 'public' };
    if (opts.visibility === 'public') {
      const { own, rival, seated } = tournamentMatchFor(listedTournaments(), { trainerId: t.id, ...opts });
      if (seated ?? own) return send(res, 200, { tournament: tournamentView(seated ?? own, t.id) });
      if (rival) {
        joinTournament(rival, t);
        return send(res, 200, { tournament: tournamentView(rival, t.id), joined: true });
      }
    }
    const T = createTournament(t, opts);
    notifyLobby();
    return send(res, 200, { tournament: tournamentView(T, t.id) });
  }

  m = /^\/api\/tournaments\/([A-Za-z0-9_-]{4,20})(?:\/(join|leave|ready|ai|seats\/(\d+)))?$/.exec(p);
  if (m) {
    const T = db.tournaments[m[1]];
    const t = trainerFrom(req);
    if (!T) return send(res, 404, { error: 'Ese torneo no existe.' });
    if (!m[2] && method === 'GET') return send(res, 200, { tournament: tournamentView(T, t?.id) });
    if (!t) return send(res, 401, { error: 'Primero importa tu equipo.' });
    const host = T.hostId === t.id;
    const lobbyOnly = () => {
      if (T.status !== 'open') throw new Error(T.status === 'cancelled' ? 'Este torneo se cerró.' : 'El torneo ya partió.');
    };
    try {
      if (!m[2] && method === 'DELETE') {
        if (!host) return send(res, 403, { error: 'Solo el dueño puede cerrar el torneo.' });
        lobbyOnly();
        closeTournament(T);
      } else if (m[2] === 'join' && method === 'POST') {
        if (seatOf(T, t.id) !== -1) return send(res, 200, { tournament: tournamentView(T, t.id) });
        joinTournament(T, t);
      } else if (m[2] === 'leave' && method === 'POST') {
        lobbyOnly();
        if (host) closeTournament(T);
        else {
          const i = seatOf(T, t.id);
          if (i === -1) return send(res, 409, { error: 'No estás en este torneo.' });
          T.seats.splice(i, 1);
          afterSeatsChange(T);
        }
      } else if (m[2] === 'ready' && method === 'POST') {
        lobbyOnly();
        const body = await readBody(req);
        setReady(T, t.id, body.ready !== false);
        afterSeatsChange(T);
      } else if (m[2] === 'ai' && method === 'POST') {
        if (!host) return send(res, 403, { error: 'Solo el dueño puede agregar IAs.' });
        lobbyOnly();
        const body = await readBody(req);
        if (!AI_AVAILABLE.includes(body.level)) return send(res, 400, { error: 'Esa dificultad no está disponible.' });
        const count = Math.max(1, Math.min(T.size - T.seats.length, Number(body.count) || 1));
        if (isFull(T)) return send(res, 409, { error: 'El torneo ya está lleno.' });
        for (let i = 0; i < count; i++) {
          const { id } = nextAiId(T, body.level);
          const { base, name } = aiName(body.level, T.seats.map((seat) => seat.aiBase).filter(Boolean));
          addSeat(T, { id, name, aiBase: base, ai: body.level });
        }
        afterSeatsChange(T);
      } else if (m[3] && method === 'DELETE') {
        if (!host) return send(res, 403, { error: 'Solo el dueño puede quitar jugadores.' });
        lobbyOnly();
        removeSeat(T, Number(m[3]));
        afterSeatsChange(T);
      } else return send(res, 405, { error: 'Método no permitido' });
    } catch (e) {
      return send(res, 409, { error: e.message });
    }
    return send(res, 200, { tournament: tournamentView(T, t.id) });
  }

  return send(res, 404, { error: 'No encontrado' });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (url.pathname === '/healthz') return send(res, 200, 'ok');
    // Live battle count for deploy/deploy.sh, which asks from inside the container (podman exec) so
    // it can wait until nobody is fighting. Loopback only: cloudflared reaches us from another container.
    if (url.pathname === '/healthz/battles' && ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {
      return send(res, 200, String([...rooms.values()].filter((r) => r.readyCheck || r.countdown || r.preview || r.battle?.status === 'active').length));
    }
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'method not allowed');
    if (url.pathname === '/' || ['/equipo', '/coleccion', '/pokedex', '/stats'].includes(url.pathname) || /^\/[bt]\/[A-Za-z0-9_-]{4,20}$/.test(url.pathname)) return await serveStatic(req, res, 'index.html');
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
    if (msg.t === 'lobby' && !ws.roomId && !lobbySockets.has(ws)) {
      if (typeof msg.token === 'string') ws.trainerId = byToken.get(sha(msg.token))?.id ?? null;
      lobbySockets.add(ws);
      ws.on('close', () => lobbySockets.delete(ws));
      return sendRooms(ws, true);
    }
    if (msg.t === 'tour' && !ws.roomId && !ws.tourId && !lobbySockets.has(ws)) {
      const T = typeof msg.id === 'string' ? db.tournaments[msg.id] : null;
      if (!T) return ws.send(JSON.stringify({ t: 'error', error: 'Ese torneo no existe.' }));
      if (typeof msg.token === 'string') ws.trainerId = seen(byToken.get(sha(msg.token)))?.id ?? null;
      ws.tourId = T.id;
      tourWatchers(T.id).add(ws);
      ws.on('close', () => {
        tourSockets.get(T.id)?.delete(ws);
        if (seatOf(T, ws.trainerId) !== -1 && T.status === 'open') {
          watchSeat(T, ws.trainerId);
          broadcastTournament(T);
        }
      });
      broadcastTournament(T);
      return;
    }
    if (msg.t === 'set-ready' && ws.roomId) {
      const r = rooms.get(ws.roomId);
      const c = db.challenges[ws.roomId];
      if (r && c) setRoomReady(c, r, ws.trainerId, msg.ready !== false);
      return;
    }
    if (msg.t === 'leave' && ws.roomId) {
      const r = rooms.get(ws.roomId);
      const c = db.challenges[ws.roomId];
      if (r?.readyCheck && c?.guestId === ws.trainerId) reopenRoom(c, r);
      return;
    }
    if (msg.t === 'hello' && !ws.roomId && !ws.tourId && !lobbySockets.has(ws)) {
      if (typeof msg.token === 'string') ws.trainerId = seen(byToken.get(sha(msg.token)))?.id ?? null;
      const c = typeof msg.room === 'string' ? db.challenges[msg.room] : null;
      if (!c) return ws.send(JSON.stringify({ t: 'error', error: 'Ese desafío no existe.' }));
      ws.roomId = c.id;
      const r = room(c.id);
      r.sockets.add(ws);
      ws.on('close', () => {
        r.sockets.delete(ws);
        if (ws.trainerId === c.hostId) notifyLobby();
        if (r.readyCheck && r.readyCheck.players.some((p) => p.id === ws.trainerId)) {
          broadcast(r, { t: 'lobby' });
          setTimeout(() => {
            if (!r.readyCheck || inRoom(r, ws.trainerId)) return;
            if (ws.trainerId === c.hostId) {
              r.readyCheck = null;
              closeRoom(c);
            } else reopenRoom(c, r);
          }, SEAT_GRACE_MS).unref?.();
        }
        if (r.battle || r.preview) broadcast(r, { t: 'presence' });
        if (!r.battle && !r.preview && !r.countdown && !r.readyCheck && r.sockets.size === 0) rooms.delete(c.id);
      });
      if (ws.trainerId === c.hostId && c.status === 'open') notifyLobby();
      if (r.battle || r.preview || r.readyCheck) broadcast(r, { t: 'presence' });
      else if (r.countdown) ws.send(JSON.stringify(frameFor(r, ws)));
      else ws.send(JSON.stringify({ t: 'waiting', watchers: r.sockets.size }));
      return;
    }
    if (msg.t === 'pick' && ws.roomId) {
      const r = rooms.get(ws.roomId);
      if (!r?.preview) return;
      const s = sideIn(r.preview.sides, ws.trainerId);
      if (s === null) return;
      try {
        pick(r.preview, s, Array.isArray(msg.picks) ? msg.picks.map(Number) : null);
      } catch (e) {
        return ws.send(JSON.stringify({ t: 'error', error: e.message }));
      }
      if (previewReady(r.preview)) startBattle(ws.roomId, r);
      else broadcast(r, { t: 'preview' });
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

// The life of a duel room as its clients see it over the socket: which frames arrive, in which
// order and with which keys, when someone leaves or comes back during the ready check, when the
// host closes it, and who hears each chat message. Runs its own server with a short seat grace.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import WebSocket from 'ws';
import { PROJECT_ROOT } from '../src/shared/paths.js';
import { appProcess, FAST_TIMINGS } from './app-process.js';

const SEAT_GRACE_MS = 400;
// Each trainer imports from their own address (the import is rate-limited per IP), as behind Cloudflare.
const app = appProcess({ ...FAST_TIMINGS, SEAT_GRACE_MS: String(SEAT_GRACE_MS), TRUST_CF_CONNECTING_IP: '1', JEV_API_KEY: '', JEV_API_URL: '' }, 19000);
const save = readFileSync(join(PROJECT_ROOT, 'test', 'fixtures', 'export.json'), 'utf8');

before(() => app.start());
after(() => app.kill());

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const newAccount = () => ({ password: 'contraseña-segura' });

async function call(path: string, { method = 'GET', body = undefined as unknown, token = undefined as string | undefined, ip = '10.0.0.1' } = {}): Promise<{ status: number; data: any }> {
  const res = await fetch(app.base + path, {
    method,
    headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': ip, ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json().catch(() => null) };
}

let trainers = 0;
async function trainer(name: string) {
  const { data } = await call('/api/import', { method: 'POST', body: { name, save, ...newAccount() }, ip: `10.0.1.${++trainers}` });
  return { token: data.token as string, me: data.me };
}

/** A socket that keeps every frame, raw and parsed, and can wait for the next one that matches. */
class Client {
  readonly ws: WebSocket;
  readonly raw: string[] = [];
  readonly frames: any[] = [];
  private cursor = 0;

  constructor(first: object, onFrame?: (frame: any, client: Client) => void) {
    this.ws = new WebSocket(`ws://127.0.0.1:${app.port}/ws`);
    this.ws.on('open', () => this.send(first));
    this.ws.on('message', (data) => {
      const frame = JSON.parse(String(data));
      this.raw.push(String(data));
      this.frames.push(frame);
      onFrame?.(frame, this);
    });
  }

  static async room(room: string, token: string | null, onFrame?: (frame: any, client: Client) => void): Promise<Client> {
    const client = new Client({ t: 'hello', room, token }, onFrame);
    await client.next((f) => f.t === 'chatLog');
    return client;
  }

  send(message: object): void {
    this.ws.send(JSON.stringify(message));
  }

  /** The next frame (after the last one returned) that matches. */
  async next(match: (frame: any) => boolean, ms = 8000): Promise<any> {
    for (const until = Date.now() + ms; Date.now() < until; await sleep(10)) {
      const index = this.frames.findIndex((frame, i) => i >= this.cursor && match(frame));
      if (index !== -1) {
        this.cursor = index + 1;
        return this.frames[index];
      }
    }
    throw new Error(`no matching frame; got ${JSON.stringify(this.frames.slice(this.cursor).map((f) => f.t))}`);
  }

  /** Frames that arrived after the last one returned by next(). */
  rest(): any[] {
    return this.frames.slice(this.cursor);
  }

  close(): Promise<void> {
    const closed = new Promise<void>((r) => this.ws.once('close', () => r()));
    this.ws.close();
    return closed;
  }
}

/** Plays like the real client: presses ready, picks the first ones, takes the first legal action. */
function autoPlay(frame: any, client: Client): void {
  if (frame.t === 'lobby' && frame.you != null && !frame.players[frame.you].ready) client.send({ t: 'set-ready', ready: true });
  const mine = frame.preview && frame.you != null ? frame.preview.sides[frame.you] : null;
  if (mine && !mine.ready) client.send({ t: 'pick', picks: mine.party.slice(0, mine.needed).map((_, i) => i) });
  if (frame.actions?.length) client.send({ t: 'act', action: frame.actions[0] });
}

/** Which step of the match a frame shows. */
function phaseOf(frame: any): string | null {
  if (frame.t === 'waiting') return 'waiting';
  if (frame.t === 'lobby') return 'readyCheck';
  if (frame.t === 'countdown') return 'countdown';
  if (frame.preview) return 'preview';
  if (frame.state) return 'battle';
  return null;
}

const phases = (frames: any[]) => frames.map(phaseOf).filter((phase, i, all) => phase && phase !== all.slice(0, i).filter(Boolean).at(-1));

const seat = (who: { me: any }, { ready, online }: { ready: boolean; online: boolean }) => ({
  id: who.me.id,
  name: who.me.name,
  avatar: who.me.avatar,
  frame: null,
  ai: null,
  wins: 0,
  losses: 0,
  rosterSize: who.me.roster.length,
  shinies: who.me.roster.filter((entry) => entry.shiny).length,
  ready,
  online,
});

/** A private room whose guest has accepted (over HTTP): the ready check has begun. */
async function acceptedRoom(hostName: string, guestName: string) {
  const host = await trainer(hostName);
  const guest = await trainer(guestName);
  const id = (await call('/api/challenges', { method: 'POST', token: host.token, body: { visibility: 'private' } })).data.challenge.id;
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: guest.token })).status, 200);
  return { host, guest, id };
}

const statusOf = async (id: string) => (await call(`/api/challenges/${id}`)).data.challenge.status;

test('a room nobody joined yet: the host waits and gets the chat log', async () => {
  const host = await trainer('Espera');
  const id = (await call('/api/challenges', { method: 'POST', token: host.token, body: { visibility: 'private' } })).data.challenge.id;
  const client = await Client.room(id, host.token);
  assert.deepEqual(client.raw, ['{"t":"waiting","watchers":1}', '{"t":"chatLog","messages":[]}', '{"t":"watch","open":false}']);
  await client.close();
});

test('the ready check shows both seats; when the host drops and the grace runs out, the room closes', async () => {
  const { host, guest, id } = await acceptedRoom('Anfitriona', 'Invitado');
  const hostClient = await Client.room(id, host.token);
  assert.equal(hostClient.raw[0], JSON.stringify({ t: 'lobby', players: [seat(host, { ready: false, online: true }), seat(guest, { ready: false, online: false })], you: 0 }));
  const guestClient = await Client.room(id, guest.token);
  assert.equal(guestClient.raw[0], JSON.stringify({ t: 'lobby', players: [seat(host, { ready: false, online: true }), seat(guest, { ready: false, online: true })], you: 1 }));

  await hostClient.close();
  const away = await guestClient.next((f) => f.t === 'lobby');
  assert.deepEqual(away.players.map((p) => p.online), [false, true]);
  assert.equal(await statusOf(id), 'active', 'the seat is kept during the grace');
  assert.deepEqual(await guestClient.next((f) => f.t !== 'lobby'), { t: 'closed' });
  assert.equal(guestClient.raw.at(-1), '{"t":"closed"}');
  assert.equal(await statusOf(id), 'cancelled');
  await guestClient.close();
});

test('when the guest drops during the ready check and does not come back, the room reopens', async () => {
  const { host, guest, id } = await acceptedRoom('Dueño', 'Fugaz');
  const hostClient = await Client.room(id, host.token);
  const guestClient = await Client.room(id, guest.token);
  const viewer = await Client.room(id, null);
  assert.equal(viewer.frames[0].you, null);

  await guestClient.close();
  assert.deepEqual((await hostClient.next((f) => f.t === 'lobby' && !f.players[1].online)).players.map((p) => p.online), [true, false]);
  assert.equal((await hostClient.next((f) => f.t !== 'lobby')).t, 'reopened');
  assert.equal(hostClient.raw.at(-1), '{"t":"reopened","host":true}');
  assert.equal((await viewer.next((f) => f.t === 'reopened')).host, false);
  const room = (await call(`/api/challenges/${id}`)).data.challenge;
  assert.equal(room.status, 'open');
  assert.equal(room.guest, null);
  await Promise.all([hostClient.close(), viewer.close()]);
});

test('a guest who reconnects within the grace keeps the seat, and both ready starts the countdown', async () => {
  const { host, guest, id } = await acceptedRoom('Paciente', 'Vuelve');
  const hostClient = await Client.room(id, host.token);
  const first = await Client.room(id, guest.token);
  await first.close();
  await hostClient.next((f) => f.t === 'lobby' && !f.players[1].online);
  const again = await Client.room(id, guest.token);
  assert.deepEqual((await hostClient.next((f) => f.t === 'lobby')).players.map((p) => p.online), [true, true]);

  await sleep(SEAT_GRACE_MS * 2);
  assert.deepEqual(hostClient.rest(), [], 'no reopened or closed after the grace');
  assert.equal(await statusOf(id), 'active');

  hostClient.send({ t: 'set-ready', ready: true });
  assert.deepEqual((await hostClient.next((f) => f.t === 'lobby')).players.map((p) => p.ready), [true, false]);
  again.send({ t: 'set-ready', ready: true });
  const countdown = await again.next((f) => f.t === 'countdown');
  assert.deepEqual(Object.keys(countdown), ['t', 'ms', 'players', 'you', 'tournament', 'waiting']);
  assert.deepEqual([countdown.you, countdown.tournament, countdown.waiting], [1, null, null]);
  assert.deepEqual(countdown.players, [seat(host, { ready: true, online: true }), seat(guest, { ready: true, online: true })].map(({ ready, online, ...player }) => player));
  // Once the countdown runs, the host can no longer close the room.
  assert.equal((await call(`/api/challenges/${id}`, { method: 'DELETE', token: host.token })).status, 403);
  await Promise.all([hostClient.close(), again.close()]);
});

test('a seat timer left by a guest who walked out does not break up the next ready check', async () => {
  const { host, guest, id } = await acceptedRoom('Constante', 'Indecisa');
  const hostClient = await Client.room(id, host.token);
  const first = await Client.room(id, guest.token);
  await first.close();
  const back = await Client.room(id, guest.token);
  back.send({ t: 'leave' });
  await hostClient.next((f) => f.t === 'reopened');
  const next = await trainer('Siguiente');
  assert.equal((await call(`/api/challenges/${id}/accept`, { method: 'POST', token: next.token })).status, 200);
  const nextClient = await Client.room(id, next.token);
  await back.close();

  await sleep(SEAT_GRACE_MS * 2);
  assert.deepEqual(hostClient.rest().filter((f) => f.t !== 'lobby'), [], 'the first guest\'s timer is stale');
  const room = (await call(`/api/challenges/${id}`)).data.challenge;
  assert.deepEqual([room.status, room.guest?.name], ['active', 'Siguiente']);
  await Promise.all([hostClient.close(), nextClient.close()]);
});

test('the host closes the room during the ready check: everyone inside is told', async () => {
  const { host, guest, id } = await acceptedRoom('Cierra', 'Mira');
  const hostClient = await Client.room(id, host.token);
  const guestClient = await Client.room(id, guest.token);
  const forbidden = await call(`/api/challenges/${id}`, { method: 'DELETE', token: guest.token });
  assert.deepEqual([forbidden.status, forbidden.data], [403, { error: 'No puedes cerrar esta sala.' }]);
  assert.equal((await call(`/api/challenges/${id}`, { method: 'DELETE', token: host.token })).status, 200);
  for (const client of [hostClient, guestClient]) {
    assert.deepEqual(await client.next((f) => f.t === 'closed'), { t: 'closed' });
  }
  assert.equal(await statusOf(id), 'cancelled');
  assert.equal((await call(`/api/challenges/${id}`, { method: 'DELETE', token: host.token })).status, 403);
  await Promise.all([hostClient.close(), guestClient.close()]);
});

test('a 1v1 goes waiting → ready check → countdown → preview → battle for players and viewers', async () => {
  const host = await trainer('Fases');
  const guest = await trainer('Rival');
  const id = (await call('/api/challenges', { method: 'POST', token: host.token, body: { visibility: 'private' } })).data.challenge.id;
  const ended = (client: Client) => client.next((f) => f.state?.status === 'finished', 60_000);
  const hostClient = await Client.room(id, host.token, autoPlay);
  const viewer = await Client.room(id, null);
  assert.deepEqual(viewer.frames[0], { t: 'waiting', watchers: 2 });
  await call(`/api/challenges/${id}/accept`, { method: 'POST', token: guest.token });
  const guestClient = await Client.room(id, guest.token, autoPlay);
  const [endHost, endGuest, endViewer] = await Promise.all([ended(hostClient), ended(guestClient), ended(viewer)]);

  const full = ['waiting', 'readyCheck', 'countdown', 'preview', 'battle'];
  assert.deepEqual(phases(hostClient.frames), full);
  assert.deepEqual(phases(viewer.frames), full);
  assert.deepEqual(phases(guestClient.frames), full.slice(1));

  const preview = hostClient.frames.find((f) => f.preview);
  assert.deepEqual(Object.keys(preview), ['t', 'preview', 'you', 'deadline', 'watchers']);
  assert.equal(preview.watchers, 3);
  const start = hostClient.frames.find((f) => f.t === 'start');
  assert.deepEqual(Object.keys(start), ['t', 'state', 'you', 'actions', 'forced', 'deadline', 'watchers']);
  const events = hostClient.frames.find((f) => f.t === 'events');
  assert.deepEqual(Object.keys(events), ['t', 'events', 'timedOut', 'state', 'you', 'actions', 'forced', 'deadline', 'watchers']);
  assert.deepEqual([endHost.you, endGuest.you, endViewer.you], [0, 1, null]);
  assert.equal(endHost.deadline, null);
  assert.deepEqual(endViewer.actions, []);

  // After the battle the players still talk from their side; viewers have none.
  const chatter = await trainer('Hincha');
  const fan = await Client.room(id, chatter.token);
  const heard = [];
  for (const [client, text] of [[hostClient, 'gg'], [guestClient, 'gg wp'], [fan, 'buena']] as const) {
    client.send({ t: 'chat', text });
    heard.push(await viewer.next((f) => f.t === 'chat'));
  }
  assert.deepEqual(
    heard.map((f) => [f.message.name, f.message.role, f.message.side]).sort(),
    [['Fases', 'player', 0], ['Hincha', 'watcher', null], ['Rival', 'player', 1]],
  );
  await Promise.all([hostClient, guestClient, viewer, fan].map((client) => client.close()));
});

test('room chat: players and viewers talk in the room, floods and anonymous viewers are dropped', async () => {
  const { host, guest, id } = await acceptedRoom('Charla', 'Respuesta');
  const fan = await trainer('Mirona');
  const hostClient = await Client.room(id, host.token);
  const guestClient = await Client.room(id, guest.token);
  const fanClient = await Client.room(id, fan.token);
  const anonymous = await Client.room(id, null);
  const other = await acceptedRoom('Otra', 'Sala');
  const elsewhere = await Client.room(other.id, other.host.token);

  hostClient.send({ t: 'chat', text: '  hola\n  a todos ' });
  const hello = await anonymous.next((f) => f.t === 'chat');
  assert.deepEqual(Object.keys(hello), ['t', 'message']);
  assert.deepEqual(Object.keys(hello.message), ['trainerId', 'name', 'role', 'side', 'text', 'at', 'id']);
  assert.deepEqual({ ...hello.message, at: 0 }, { id: 1, trainerId: host.me.id, name: 'Charla', role: 'player', side: null, text: 'hola a todos', at: 0 });
  hostClient.send({ t: 'chat', text: 'muy seguido' });
  anonymous.send({ t: 'chat', text: 'sin sesión' });
  guestClient.send({ t: 'chat', text: '   ' });
  await sleep(100);
  // One at a time: two sockets give no order between them.
  fanClient.send({ t: 'chat', text: 'miro nomás' });
  await anonymous.next((f) => f.t === 'chat');
  guestClient.send({ t: 'chat', text: 'listo' });
  await anonymous.next((f) => f.t === 'chat');
  await sleep(200);
  for (const client of [hostClient, guestClient, fanClient, anonymous]) {
    assert.deepEqual(client.frames.filter((f) => f.t === 'chat').map((f) => [f.message.id, f.message.name, f.message.role, f.message.text]), [
      [1, 'Charla', 'player', 'hola a todos'],
      [2, 'Mirona', 'watcher', 'miro nomás'],
      [3, 'Respuesta', 'player', 'listo'],
    ]);
  }
  assert.deepEqual(elsewhere.frames.filter((f) => f.t === 'chat'), [], 'another room hears nothing');

  const late = await Client.room(id, null);
  assert.deepEqual(late.frames.find((f) => f.t === 'chatLog').messages.map((m) => m.text), ['hola a todos', 'miro nomás', 'listo']);
  await Promise.all([hostClient, guestClient, fanClient, anonymous, elsewhere, late].map((client) => client.close()));
});

test('tournament chat: the tournament page and its match rooms share one channel', async () => {
  const host = await trainer('Organiza');
  const fan = await trainer('Hinchada');
  const tournament = (await call('/api/tournaments', { method: 'POST', token: host.token, body: { size: 4, mode: 'team', visibility: 'private' } })).data.tournament;
  const page = new Client({ t: 'tour', id: tournament.id, token: host.token });
  const fanPage = new Client({ t: 'tour', id: tournament.id, token: fan.token });
  assert.deepEqual((await page.next((f) => f.t === 'chatLog')).messages, []);
  await fanPage.next((f) => f.t === 'chatLog');
  await call(`/api/tournaments/${tournament.id}/ai`, { method: 'POST', token: host.token, body: { level: 'easy', count: 3 } });
  await call(`/api/tournaments/${tournament.id}/ready`, { method: 'POST', token: host.token, body: { ready: true } });

  page.send({ t: 'chat', text: 'suerte' });
  const first = await fanPage.next((f) => f.t === 'chat');
  fanPage.send({ t: 'chat', text: 'vamos' });
  const onPage = [first, await fanPage.next((f) => f.t === 'chat')];
  assert.deepEqual(onPage.map((f) => [f.message.name, f.message.role, f.message.side]), [['Organiza', 'player', null], ['Hinchada', 'watcher', null]]);

  // Round one has the host's match and a match between two AIs, in either order.
  let matchId: string | undefined;
  let aiMatchId: string | undefined;
  const room = new Promise<Client>(async (resolve) => {
    while (!matchId || !aiMatchId) {
      const current = (await page.next((f) => f.t === 'tour' && f.tournament.current)).tournament.current.challengeId;
      if (current === matchId || current === aiMatchId) continue;
      const hosting = (await call(`/api/challenges/${current}`)).data.challenge.host.id === host.me.id;
      if (hosting) {
        matchId = current;
        resolve(await Client.room(current, host.token, autoPlay));
      } else aiMatchId = current;
    }
  });
  const inMatch = await room;
  assert.deepEqual(inMatch.frames.find((f) => f.t === 'chatLog').messages.map((m) => m.text), ['suerte', 'vamos']);
  await inMatch.next((f) => (f.preview || f.state) && f.you === 0);
  inMatch.send({ t: 'chat', text: 'desde la sala' });
  for (const client of [page, fanPage]) {
    const said = await client.next((f) => f.t === 'chat' && f.message.text === 'desde la sala');
    assert.deepEqual([said.message.id, said.message.role, said.message.side], [3, 'player', 0]);
  }
  // In a match they don't play, a seated player still talks as a player of the tournament.
  while (!aiMatchId) await sleep(50);
  const otherMatch = await Client.room(aiMatchId, host.token);
  otherMatch.send({ t: 'chat', text: 'mirando la otra' });
  const said = await fanPage.next((f) => f.t === 'chat' && f.message.text === 'mirando la otra');
  assert.deepEqual([said.message.id, said.message.role, said.message.side], [4, 'player', null]);
  await Promise.all([page, fanPage, inMatch, otherMatch].map((client) => client.close()));
});

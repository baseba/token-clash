import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { WebSocket, WebSocketServer } from 'ws';
import type { ArenaChatService } from '../arena/application/arena-chat.service.js';
import type { ClientConnection } from '../arena/application/connection.js';
import type { DuelService } from '../arena/application/duel.service.js';
import type { LiveBattleService } from '../arena/application/live-battle.service.js';
import type { LobbyService } from '../arena/application/lobby.service.js';
import type { TeamPreviewService } from '../arena/application/team-preview.service.js';
import type { TournamentsService } from '../arena/application/tournaments.service.js';
import type { RadioService } from '../radio/application/radio.service.js';
import { AppConfig } from '../shared/config/app-config.js';
import { ConnectionLimits } from './connection-limits.js';
import { GameGateway } from './game.gateway.js';

const HEARTBEAT_MS = 30_000;

class FakeSocket extends EventEmitter {
  readyState = 1;
  pings = 0;
  terminated = false;

  ping(): void {
    this.pings++;
  }

  terminate(): void {
    this.terminated = true;
  }
}

const request = { headers: {}, socket: { remoteAddress: '10.0.0.1' } } as unknown as IncomingMessage;

function connectedGateway() {
  const calls: string[] = [];
  const entered: ClientConnection[] = [];
  const record = (name: string) => () => {
    calls.push(name);
  };
  const enter = (name: string, connection: ClientConnection, admitted: boolean) => {
    calls.push(name);
    entered.push(connection);
    return admitted ? {} : null;
  };
  const limits = new ConnectionLimits(AppConfig.fromEnv({}));
  const gateway = new GameGateway(
    limits,
    { subscribe: record('lobby.subscribe'), unsubscribe: record('lobby.unsubscribe'), sendWatchState: () => {} } as unknown as LobbyService,
    { enter: (connection: ClientConnection, room: string) => enter('duels.enter', connection, connection.enterRoom(room)), left: record('duels.left') } as unknown as DuelService,
    {} as unknown as TeamPreviewService,
    {} as unknown as LiveBattleService,
    { follow: (connection: ClientConnection, id: string) => enter('tournaments.follow', connection, connection.follow(id)), unfollow: record('tournaments.unfollow') } as unknown as TournamentsService,
    { sendHistory: () => {} } as unknown as ArenaChatService,
    { disconnected: record('radio.disconnected') } as unknown as RadioService,
  );
  const server = Object.assign(new EventEmitter(), { clients: new Set<FakeSocket>() });
  gateway.afterInit(server as unknown as WebSocketServer);
  const connect = (): FakeSocket => {
    const socket = new FakeSocket();
    server.clients.add(socket);
    gateway.handleConnection(socket as unknown as WebSocket, request);
    return socket;
  };
  const ws = (socket: FakeSocket) => socket as unknown as WebSocket;
  return { gateway, limits, calls, entered, connect, ws, stop: () => server.emit('close') };
}

beforeEach(() => mock.timers.enable({ apis: ['setInterval'] }));
afterEach(() => mock.timers.reset());

test('the heartbeat pings every socket and keeps the ones that answer with a pong', () => {
  const { connect, stop } = connectedGateway();
  const socket = connect();
  for (let beat = 1; beat <= 3; beat++) {
    mock.timers.tick(HEARTBEAT_MS);
    assert.equal(socket.pings, beat);
    assert.equal(socket.terminated, false);
    socket.emit('pong');
  }
  stop();
});

test('a socket that misses a pong is cut on the next heartbeat, without another ping', () => {
  const { connect, stop } = connectedGateway();
  const quiet = connect();
  const answering = connect();
  mock.timers.tick(HEARTBEAT_MS);
  answering.emit('pong');
  assert.deepEqual([quiet.pings, quiet.terminated], [1, false]);
  mock.timers.tick(HEARTBEAT_MS);
  assert.deepEqual([quiet.pings, quiet.terminated], [1, true]);
  assert.deepEqual([answering.pings, answering.terminated], [2, false]);
  stop();
});

test('a closed server stops the heartbeat', () => {
  const { connect, stop } = connectedGateway();
  const socket = connect();
  stop();
  mock.timers.tick(HEARTBEAT_MS * 2);
  assert.deepEqual([socket.pings, socket.terminated], [0, false]);
});

test('closing a room socket leaves the lobby list, the room and the radio, and frees its slot for the address', () => {
  const { gateway, limits, calls, connect, ws, stop } = connectedGateway();
  const sockets = Array.from({ length: 30 }, connect);
  assert.equal(limits.allows(request), false);
  gateway.onHello(ws(sockets[0]), { t: 'hello', room: 'room-1', token: undefined });
  calls.length = 0;
  gateway.handleDisconnect(ws(sockets[0]));
  assert.deepEqual(calls, ['lobby.unsubscribe', 'duels.left', 'radio.disconnected']);
  assert.equal(limits.allows(request), true);
  stop();
});

test('closing a tournament page stops following the tournament', () => {
  const { gateway, calls, connect, ws, stop } = connectedGateway();
  const socket = connect();
  gateway.onTour(ws(socket), { t: 'tour', id: 'tour-1', token: undefined });
  calls.length = 0;
  gateway.handleDisconnect(ws(socket));
  assert.deepEqual(calls, ['lobby.unsubscribe', 'tournaments.unfollow', 'radio.disconnected']);
  stop();
});

test('closing a socket the gateway never saw touches nothing', () => {
  const { gateway, calls, ws, stop } = connectedGateway();
  gateway.handleDisconnect(ws(new FakeSocket()));
  assert.deepEqual(calls, []);
  stop();
});

test('a connection inside a room or a tournament refuses to enter another one, and the gateway never asks the arena', () => {
  const { gateway, calls, entered, connect, ws, stop } = connectedGateway();
  const inRoom = connect();
  const following = connect();
  gateway.onHello(ws(inRoom), { t: 'hello', room: 'room-1', token: undefined });
  gateway.onTour(ws(following), { t: 'tour', id: 'tour-1', token: undefined });
  assert.deepEqual(calls, ['duels.enter', 'tournaments.follow']);
  for (const socket of [inRoom, following]) {
    gateway.onHello(ws(socket), { t: 'hello', room: 'room-2', token: undefined });
    gateway.onTour(ws(socket), { t: 'tour', id: 'tour-2', token: undefined });
  }
  assert.deepEqual(calls, ['duels.enter', 'tournaments.follow']);
  for (const connection of entered) assert.deepEqual([connection.enterRoom('room-3'), connection.follow('tour-3')], [false, false]);
  assert.deepEqual(
    entered.map((connection) => [connection.roomId, connection.tourId]),
    [
      ['room-1', null],
      [null, 'tour-1'],
    ],
  );
  stop();
});

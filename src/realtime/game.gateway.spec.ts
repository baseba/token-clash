import { afterEach, beforeEach, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import type { IncomingMessage } from 'node:http';
import type { WebSocket, WebSocketServer } from 'ws';
import type { ArenaChatService } from '../arena/application/arena-chat.service.js';
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

function connectedGateway() {
  const gateway = new GameGateway(
    new ConnectionLimits(AppConfig.fromEnv({})),
    {} as unknown as LobbyService,
    {} as unknown as DuelService,
    {} as unknown as TeamPreviewService,
    {} as unknown as LiveBattleService,
    {} as unknown as TournamentsService,
    {} as unknown as ArenaChatService,
    {} as unknown as RadioService,
  );
  const server = Object.assign(new EventEmitter(), { clients: new Set<FakeSocket>() });
  gateway.afterInit(server as unknown as WebSocketServer);
  const connect = (): FakeSocket => {
    const socket = new FakeSocket();
    server.clients.add(socket);
    gateway.handleConnection(socket as unknown as WebSocket, { headers: {}, socket: { remoteAddress: '10.0.0.1' } } as unknown as IncomingMessage);
    return socket;
  };
  return { connect, stop: () => server.emit('close') };
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

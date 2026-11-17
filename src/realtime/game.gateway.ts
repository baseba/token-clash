// The socket protocol at /ws. One gateway, thin: it keeps per-connection state, checks which
// messages are allowed in which state, and hands each one to the use case that owns it (arena for
// rooms, tournaments and the lobby; chat for messages). The frames sent back are built there too.
//
// Client → server messages ({ t: ... }):
//   lobby {token}           follow the open rooms list
//   tour {id, token}        follow a tournament page
//   hello {room, token}     enter a room (as a player or a viewer)
//   set-ready {ready}       ready check of a 1v1 room       leave   guest walks out of it
//   choosing {picks}        draft of the 3 picks (viewers)  pick {picks}  confirm them
//   act {action}            a move or a switch              seen {turn}   finished animating a turn
//   chat {text}             a message to the room/tournament chat
import { Logger } from '@nestjs/common';
import { ConnectedSocket, MessageBody, OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway } from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type { WebSocket, WebSocketServer } from 'ws';
import { ArenaQueries } from '../arena/application/arena-queries.js';
import type { ClientConnection } from '../arena/application/connection.js';
import { DuelService } from '../arena/application/duel.service.js';
import { LobbyService } from '../arena/application/lobby.service.js';
import { TournamentsService } from '../arena/application/tournaments.service.js';
import { ChatService } from '../chat/application/chat.service.js';
import { chatChannel, tournamentChannel } from '../chat/domain/chat.js';
import { now } from '../shared/domain/clock.js';
import { TrainersService } from '../trainers/application/trainers.service.js';
import { ConnectionLimits } from './connection-limits.js';

/** Adapts a WebSocket to the arena's ClientConnection port. */
class WsConnection implements ClientConnection {
  trainerId: string | null = null;
  roomId: string | null = null;
  tourId: string | null = null;
  seenTurn?: number;
  lastChatAt?: number;
  inLobby = false;
  alive = true;

  constructor(
    readonly socket: WebSocket,
    readonly ip: string,
  ) {}

  get open(): boolean {
    return this.socket.readyState === 1;
  }

  send(frame: object | string): void {
    this.socket.send(typeof frame === 'string' ? frame : JSON.stringify(frame));
  }

  /** Not yet in a room, a tournament or the lobby: free to choose one. */
  get idle(): boolean {
    return !this.roomId && !this.tourId && !this.inLobby;
  }
}

type Msg = Record<string, unknown>;

@WebSocketGateway({ path: '/ws', maxPayload: 4096 })
export class GameGateway implements OnGatewayInit<WebSocketServer>, OnGatewayConnection<WebSocket>, OnGatewayDisconnect<WebSocket> {
  private readonly logger = new Logger(GameGateway.name);
  private readonly connections = new WeakMap<WebSocket, WsConnection>();
  private heartbeat?: NodeJS.Timeout;

  constructor(
    private readonly limits: ConnectionLimits,
    private readonly trainers: TrainersService,
    private readonly lobby: LobbyService,
    private readonly duels: DuelService,
    private readonly tournaments: TournamentsService,
    private readonly arena: ArenaQueries,
    private readonly chat: ChatService,
  ) {}

  afterInit(server: WebSocketServer): void {
    // Drop sockets that stopped answering pings (a laptop that went to sleep, a dead network).
    this.heartbeat = setInterval(() => {
      for (const socket of server.clients) {
        const conn = this.connections.get(socket);
        if (!conn) continue;
        if (!conn.alive) {
          socket.terminate();
          continue;
        }
        conn.alive = false;
        socket.ping();
      }
    }, 30_000).unref();
    server.on('close', () => clearInterval(this.heartbeat));
  }

  handleConnection(socket: WebSocket, req: IncomingMessage): void {
    const conn = new WsConnection(socket, this.limits.ipOf(req));
    this.connections.set(socket, conn);
    this.limits.opened(conn.ip);
    socket.on('pong', () => (conn.alive = true));
  }

  handleDisconnect(socket: WebSocket): void {
    const conn = this.connections.get(socket);
    if (!conn) return;
    this.limits.closed(conn.ip);
    if (conn.inLobby) this.lobby.unsubscribe(conn);
    if (conn.tourId) this.tournaments.unfollow(conn);
    if (conn.roomId) this.duels.left(conn);
  }

  private conn(socket: WebSocket): WsConnection | undefined {
    return this.connections.get(socket);
  }

  @SubscribeMessage('lobby')
  onLobby(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (!c || c.roomId || c.inLobby) return;
    c.inLobby = true;
    this.lobby.subscribe(c, msg.token);
  }

  @SubscribeMessage('tour')
  onTour(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (!c?.idle) return;
    const T = this.tournaments.follow(c, msg);
    if (T) c.send({ t: 'chatLog', messages: this.chat.history(tournamentChannel(T.id)) });
  }

  @SubscribeMessage('hello')
  onHello(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (!c?.idle) return;
    const challenge = this.duels.enter(c, msg);
    if (challenge) c.send({ t: 'chatLog', messages: this.chat.history(chatChannel(challenge)) });
  }

  @SubscribeMessage('set-ready')
  onSetReady(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (c?.roomId) this.duels.setReady(c, msg.ready !== false);
  }

  @SubscribeMessage('leave')
  onLeave(@ConnectedSocket() socket: WebSocket): void {
    const c = this.conn(socket);
    if (c?.roomId) this.duels.leaveReadyCheck(c);
  }

  @SubscribeMessage('seen')
  onSeen(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (c?.roomId) this.duels.seen(c, msg.turn);
  }

  @SubscribeMessage('choosing')
  onChoosing(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (c?.roomId) this.duels.choosing(c, msg.picks);
  }

  @SubscribeMessage('pick')
  onPick(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (c?.roomId) this.duels.pick(c, msg.picks);
  }

  @SubscribeMessage('act')
  onAct(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (c?.roomId) this.duels.act(c, msg.action);
  }

  @SubscribeMessage('chat')
  onChat(@ConnectedSocket() socket: WebSocket, @MessageBody() msg: Msg): void {
    const c = this.conn(socket);
    if (!c || (!c.roomId && !c.tourId)) return;
    const trainer = this.trainers.byId(c.trainerId);
    if (!trainer) return;
    const from = this.chatSender(c, trainer.id);
    if (!from) return;
    const at = now();
    const message = this.chat.post(from.channel, { trainerId: trainer.id, name: trainer.name, role: from.role, side: from.side, text: msg.text, lastAt: c.lastChatAt, at });
    if (!message) return;
    c.lastChatAt = at;
    this.sendToChannel(from.channel, JSON.stringify({ t: 'chat', message }));
  }

  /** Where a connection talks and as what: a room player (with their side) or a viewer. */
  private chatSender(c: WsConnection, trainerId: string) {
    if (c.roomId) {
      const found = this.duels.chatRole(c, trainerId, (tournamentId) => this.tournaments.isPlayer(tournamentId, trainerId));
      return found && { channel: chatChannel(found.challenge), role: found.role, side: found.side };
    }
    const T = this.arena.allTournaments().find((t) => t.id === c.tourId);
    if (!T) return null;
    return { channel: tournamentChannel(T.id), role: T.seatOf(trainerId) !== -1 ? ('player' as const) : ('watcher' as const), side: null };
  }

  private sendToChannel(channel: string, frame: string): void {
    const targets: ClientConnection[] = [];
    for (const [challenge, sockets] of this.arena.roomConnections()) if (chatChannel(challenge) === channel) targets.push(...sockets);
    if (channel.startsWith('t:')) targets.push(...this.arena.tournamentConnections(channel.slice(2)));
    for (const ws of targets) if (ws.open) ws.send(frame);
  }
}

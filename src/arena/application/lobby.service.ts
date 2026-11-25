import { Injectable } from '@nestjs/common';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { ChallengeRepository, TournamentRepository } from '../domain/arena.repositories.js';
import type { Challenge } from '../domain/challenge.js';
import { HOST_GRACE_MS, openRooms } from '../domain/lobby.js';
import type { Tournament } from '../domain/tournament.js';
import { ArenaViews } from './arena-views.js';
import type { ClientConnection } from './connection.js';
import { Presence, tournamentWatchKey, watchKey, type BattlePhase, type Room } from './presence.js';

const LISTED = 40;

@Injectable()
export class LobbyService {
  private readonly sent = new WeakMap<ClientConnection, string>();
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly tournaments: TournamentRepository,
    private readonly trainers: TrainersService,
    private readonly presence: Presence,
    private readonly views: ArenaViews,
  ) {}

  publicRooms(): Challenge[] {
    return openRooms<Challenge>(this.challenges.all(), { hostWaiting: this.presence.hostWaiting });
  }

  listedTournaments(now = Date.now()): Tournament[] {
    return this.tournaments
      .all()
      .filter((T) => T.status === 'open' && T.visibility === 'public' && !T.full && (now - T.createdAt < HOST_GRACE_MS || this.presence.inTournament(T.id, T.hostId)))
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  list(viewerId: string | null) {
    const list = [...this.publicRooms().map((c) => this.views.room(c, viewerId)), ...this.listedTournaments().map((T) => this.views.tournamentRoom(T, viewerId))].sort((a, b) => a.createdAt - b.createdAt);
    return list.slice(0, LISTED);
  }

  liveBattles() {
    return [...this.presence.rooms.values()]
      .filter((room): room is Room & { phase: BattlePhase } => room.phase.kind === 'battle' && room.phase.battle.status === 'active' && this.watchable(room))
      .sort((a, b) => b.phase.startedAt - a.phase.startedAt)
      .slice(0, LISTED)
      .map((room) => this.views.liveBattle(room.challenge, room.phase, this.tournamentOf(room)));
  }

  private tournamentOf(room: Room): Tournament | undefined {
    return room.challenge.tournamentId ? this.tournaments.findById(room.challenge.tournamentId) : undefined;
  }

  private watchable(room: Room): boolean {
    return this.presence.watchable(watchKey(room.challenge));
  }

  allowWatchers(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    const tournament = room ? this.tournamentOf(room) : ws.tourId ? this.tournaments.findById(ws.tourId) : undefined;
    const player = tournament ? tournament.seatOf(ws.trainerId) !== -1 : !!room && !!ws.trainerId && [room.challenge.hostId, room.challenge.guestId].includes(ws.trainerId);
    if (!player) return;
    const key = tournament ? tournamentWatchKey(tournament.id) : watchKey(room!.challenge);
    this.presence.allowWatchers(key);
    const sockets = tournament ? this.presence.tournamentAudience(tournament.id) : [...room!.sockets];
    for (const socket of sockets) if (socket.open) socket.send({ t: 'watch', open: true });
    this.notify();
  }

  sendWatchState(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    const key = room ? watchKey(room.challenge) : ws.tourId ? tournamentWatchKey(ws.tourId) : null;
    if (key) ws.send({ t: 'watch', open: this.presence.watchable(key) });
  }

  subscribe(ws: ClientConnection, token: string | undefined): void {
    ws.trainerId = this.trainers.peekToken(token)?.id ?? null;
    this.presence.lobby.add(ws);
    this.send(ws, true);
  }

  unsubscribe(ws: ClientConnection): void {
    this.presence.lobby.delete(ws);
  }

  notify(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      for (const ws of this.presence.lobby) this.send(ws);
    }, 50);
  }

  notifyAfterGrace(): void {
    setTimeout(() => this.notify(), HOST_GRACE_MS + 100).unref();
  }

  private send(ws: ClientConnection, force = false): void {
    if (!ws.open) return;
    const frame = JSON.stringify({ t: 'rooms', rooms: this.list(ws.trainerId), live: this.liveBattles() });
    if (!force && this.sent.get(ws) === frame) return;
    this.sent.set(ws, frame);
    ws.send(frame);
  }
}

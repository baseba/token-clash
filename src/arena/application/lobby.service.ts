// The lobby: the live list of open rooms and tournaments anyone can join with one click. Clients
// on the home page subscribe over the socket and get the list again whenever it changes.
import { Injectable } from '@nestjs/common';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { ChallengeRepository, TournamentRepository } from '../domain/arena.repositories.js';
import type { Challenge } from '../domain/challenge.js';
import { HOST_GRACE_MS, openRooms } from '../domain/lobby.js';
import type { Tournament } from '../domain/tournament.js';
import { ArenaViews } from './arena-views.js';
import type { ClientConnection } from './connection.js';
import { Presence } from './presence.js';

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

  /** Public duel rooms waiting for a rival whose host is still around. */
  publicRooms(): Challenge[] {
    return openRooms<Challenge>(this.challenges.all(), { hostWaiting: this.presence.hostWaiting });
  }

  /** Public tournaments with free seats whose host is still around. */
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

  subscribe(ws: ClientConnection, token: unknown): void {
    ws.trainerId = this.trainers.peekToken(token)?.id ?? null;
    this.presence.lobby.add(ws);
    this.send(ws, true);
  }

  unsubscribe(ws: ClientConnection): void {
    this.presence.lobby.delete(ws);
  }

  /** Something listed changed: tell everyone in the lobby (batched, and only if their list changed). */
  notify(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      for (const ws of this.presence.lobby) this.send(ws);
    }, 50);
  }

  /** Re-check the list once a new public room's grace period is over. */
  notifyAfterGrace(): void {
    setTimeout(() => this.notify(), HOST_GRACE_MS + 100).unref();
  }

  private send(ws: ClientConnection, force = false): void {
    if (!ws.open) return;
    const frame = JSON.stringify({ t: 'rooms', rooms: this.list(ws.trainerId) });
    if (!force && this.sent.get(ws) === frame) return;
    this.sent.set(ws, frame);
    ws.send(frame);
  }
}

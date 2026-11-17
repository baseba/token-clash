// Use cases for tournaments: the lobby (seats, AIs, ready), the draw, and playing the bracket one
// match at a time. Each match is an ordinary challenge driven by DuelService; when it ends,
// DuelService announces it (ArenaEvents) and the bracket advances here.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { buildAiRandomParty, buildAiTeam } from '../../combat/domain/ai.js';
import { randomParty } from '../../combat/domain/random-party.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { AppConfig, type ArenaTimings } from '../../shared/config/app-config.js';
import { newId, now } from '../../shared/domain/clock.js';
import { conflict, notFound } from '../../shared/domain/errors.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { ChallengeRepository, TournamentRepository } from '../domain/arena.repositories.js';
import { Challenge, type BattleMode, type Visibility } from '../domain/challenge.js';
import { shuffledOrder, tournamentMatchFor, type Seat, Tournament } from '../domain/tournament.js';
import { ArenaEvents, type MatchFinished } from './arena-events.js';
import { ArenaViews } from './arena-views.js';
import type { ClientConnection } from './connection.js';
import { averageLevel, DuelService } from './duel.service.js';
import { LobbyService } from './lobby.service.js';
import { Presence } from './presence.js';

export interface NewTournament {
  mode: BattleMode;
  levelCap: number | null;
  size: number;
  visibility: Visibility;
}

@Injectable()
export class TournamentsService implements OnModuleInit {
  private readonly timings: ArenaTimings;
  /** Seats of people who disconnected from the lobby, waiting for them to come back. */
  private readonly seatTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    config: AppConfig,
    private readonly tournaments: TournamentRepository,
    private readonly challenges: ChallengeRepository,
    private readonly trainers: TrainersService,
    private readonly duels: DuelService,
    private readonly lobby: LobbyService,
    private readonly presence: Presence,
    private readonly views: ArenaViews,
    private readonly skynet: SkynetService,
    events: ArenaEvents,
  ) {
    this.timings = config.timings;
    events.onMatchFinished((e) => this.matchFinished(e));
  }

  onModuleInit(): void {
    // The bracket's matches lived in memory: a tournament cut by a restart can't go on.
    for (const T of this.tournaments.all()) {
      if (T.status !== 'running') continue;
      T.abandon();
      this.tournaments.save(T);
    }
  }

  find(id: string): Tournament {
    const T = this.tournaments.findById(id);
    if (!T) throw notFound('Ese torneo no existe.');
    return T;
  }

  /** A public search sits you in a matching tournament (or returns yours); otherwise a new one opens. */
  create(trainer: Trainer, opts: NewTournament): { tournament: Tournament; joined?: boolean } {
    if (opts.visibility === 'public') {
      const { own, rival, seated } = tournamentMatchFor(this.lobby.listedTournaments(), { trainerId: trainer.id, ...opts });
      const mine = seated ?? own;
      if (mine) return { tournament: mine };
      if (rival) {
        this.join(rival, trainer);
        return { tournament: rival, joined: true };
      }
    }
    const T = Tournament.create({ id: newId(), host: trainer, ...opts, at: now() });
    this.tournaments.save(T);
    this.watchSeat(T, trainer.id);
    if (opts.visibility === 'public') this.lobby.notifyAfterGrace();
    this.lobby.notify();
    return { tournament: T };
  }

  join(T: Tournament, trainer: Trainer): void {
    if (T.seatOf(trainer.id) !== -1) return;
    T.join(trainer);
    this.tournaments.save(T);
    this.watchSeat(T, trainer.id);
    this.afterSeatsChange(T);
  }

  /** The host closes it, or anyone else gives up their seat (only before it starts). */
  leave(T: Tournament, trainer: Trainer): void {
    T.assertLobby();
    if (T.hostId === trainer.id) return this.close(T);
    if (!T.leave(trainer.id)) throw conflict('No estás en este torneo.');
    this.afterSeatsChange(T);
  }

  closeByHost(T: Tournament, trainer: Trainer): void {
    T.assertHost(trainer.id, 'cerrar el torneo');
    T.assertLobby();
    this.close(T);
  }

  setReady(T: Tournament, trainer: Trainer, ready: boolean): void {
    T.assertLobby();
    T.setReady(trainer.id, ready);
    this.afterSeatsChange(T);
  }

  addAis(T: Tournament, trainer: Trainer, { level, count }: { level: string; count: number }): void {
    T.assertHost(trainer.id, 'agregar IAs');
    T.assertLobby();
    this.skynet.assertOffered(level);
    T.addAis(level, count);
    this.afterSeatsChange(T);
  }

  kick(T: Tournament, trainer: Trainer, seat: number): void {
    T.assertHost(trainer.id, 'quitar jugadores');
    T.assertLobby();
    T.kick(seat);
    this.afterSeatsChange(T);
  }

  // ---------- following a tournament over the socket ----------

  /** A client opens the tournament page. Returns it, or null if it doesn't exist. */
  follow(ws: ClientConnection, id: string, token: string | undefined): Tournament | null {
    const T = this.tournaments.findById(id);
    if (!T) {
      ws.send({ t: 'error', error: 'Ese torneo no existe.' });
      return null;
    }
    if (token !== undefined) ws.trainerId = this.trainers.authenticate(token)?.id ?? null;
    ws.tourId = T.id;
    this.presence.tourWatchers(T.id).add(ws);
    this.broadcast(T);
    return T;
  }

  unfollow(ws: ClientConnection): void {
    const T = ws.tourId ? this.tournaments.findById(ws.tourId) : undefined;
    if (!T) return;
    this.presence.tourSockets(T.id).delete(ws);
    if (T.seatOf(ws.trainerId) !== -1 && T.status === 'open') {
      this.watchSeat(T, ws.trainerId!);
      this.broadcast(T);
    }
  }

  isPlayer(tournamentId: string, trainerId: string): boolean {
    const T = this.tournaments.findById(tournamentId);
    return !!T && T.seatOf(trainerId) !== -1;
  }

  broadcast(T: Tournament): void {
    for (const ws of this.presence.tourSockets(T.id)) if (ws.open) ws.send({ t: 'tour', tournament: this.views.tournament(T, ws.trainerId) });
    if (T.visibility === 'public') this.lobby.notify();
  }

  // ---------- lobby ----------

  private afterSeatsChange(T: Tournament): void {
    if (T.everyoneReady) return this.start(T);
    this.tournaments.save(T);
    this.broadcast(T);
  }

  private close(T: Tournament): void {
    T.close();
    this.tournaments.save(T);
    this.broadcast(T);
    this.lobby.notify();
  }

  /** Someone left the lobby page: their seat (or the whole tournament, for the host) waits a while. */
  private watchSeat(T: Tournament, trainerId: string): void {
    const key = `${T.id}:${trainerId}`;
    clearTimeout(this.seatTimers.get(key));
    const timer = setTimeout(() => {
      this.seatTimers.delete(key);
      if (T.status !== 'open' || this.presence.inTournament(T.id, trainerId)) return;
      if (trainerId === T.hostId) return this.close(T);
      if (T.leave(trainerId)) this.afterSeatsChange(T);
    }, this.timings.seatGraceMs);
    timer.unref?.();
    this.seatTimers.set(key, timer);
  }

  // ---------- playing the bracket ----------

  private humanAverageLevel(T: Tournament): number {
    const entries = T.seats.filter((seat) => !seat.ai).flatMap((seat) => this.trainers.byId(seat.id)?.teamEntries() ?? []);
    return averageLevel(entries);
  }

  private start(T: Tournament): void {
    const at = now();
    T.start({ at, order: shuffledOrder(T.size), aiLevel: T.levelCap ?? this.humanAverageLevel(T), firstMatchAt: at + this.timings.bracketDrawMs });
    this.tournaments.save(T);
    this.broadcast(T);
    this.lobby.notify();
    setTimeout(() => this.startMatch(T), this.timings.bracketDrawMs).unref?.();
  }

  private seatTeam(T: Tournament, seat: Seat): RosterEntry[] {
    const level = T.aiLevel!;
    if (seat.ai) return T.mode === 'random' ? buildAiRandomParty({ level }) : buildAiTeam({ difficulty: seat.ai, level });
    const t = this.trainers.byId(seat.id);
    if (!t?.roster.length) return buildAiRandomParty({ level });
    return T.mode === 'random' ? randomParty(t.roster) : t.teamSnapshot();
  }

  private startMatch(T: Tournament): void {
    const next = T.nextMatch();
    if (!next) return;
    // A person always hosts when there is one (the AI side is the guest).
    const [host, guest] = next.a.ai && !next.b.ai ? [next.b, next.a] : [next.a, next.b];
    const c = Challenge.tournamentMatch({
      id: newId(),
      host: { id: host.id, name: host.name, team: this.seatTeam(T, host), ai: host.ai },
      guest: { id: guest.id, name: guest.name, team: this.seatTeam(T, guest), ai: guest.ai },
      levelCap: T.levelCap,
      mode: T.mode,
      tournamentId: T.id,
      round: next.round,
      match: next.index,
      at: now(),
    });
    this.challenges.save(c);
    T.matchStarted(next, c.id);
    this.tournaments.save(T);
    this.duels.startCountdown(c, T.label(next));
    this.broadcast(T);
  }

  private matchFinished({ challenge: c }: MatchFinished): void {
    const T = c.tournamentId ? this.tournaments.findById(c.tournamentId) : undefined;
    if (!T || T.status !== 'running') return;
    const at = now();
    const champion = T.matchFinished({ round: c.round!, index: c.match! }, c.winnerId ?? null, { now: at, nextMatchAt: at + this.timings.betweenMatchesMs });
    if (champion === null) setTimeout(() => this.startMatch(T), this.timings.betweenMatchesMs).unref?.();
    this.tournaments.save(T);
    this.broadcast(T);
  }
}


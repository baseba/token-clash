import { Injectable, OnModuleInit } from '@nestjs/common';
import { aiLevelOf, buildAiRandomParty, buildAiTeam } from '../../combat/domain/ai.js';
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
import { LobbyService } from './lobby.service.js';
import { Presence } from './presence.js';
import { TeamPreviewService } from './team-preview.service.js';

export interface NewTournament {
  mode: BattleMode;
  size: number;
  visibility: Visibility;
}

@Injectable()
export class TournamentsService implements OnModuleInit {
  private readonly timings: ArenaTimings;
  private readonly seatTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    config: AppConfig,
    private readonly tournaments: TournamentRepository,
    private readonly challenges: ChallengeRepository,
    private readonly trainers: TrainersService,
    private readonly previews: TeamPreviewService,
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
    for (const tournament of this.tournaments.all()) {
      if (tournament.status !== 'running') continue;
      tournament.abandon();
      this.tournaments.save(tournament);
    }
  }

  find(id: string): Tournament {
    const tournament = this.tournaments.findById(id);
    if (!tournament) throw notFound('Ese torneo no existe.');
    return tournament;
  }

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
    const tournament = Tournament.create({ id: newId(), host: trainer, ...opts, at: now() });
    this.tournaments.save(tournament);
    this.watchSeat(tournament, trainer.id);
    if (opts.visibility === 'public') this.lobby.notifyAfterGrace();
    this.lobby.notify();
    return { tournament };
  }

  join(tournament: Tournament, trainer: Trainer): void {
    if (tournament.seatOf(trainer.id) !== -1) return;
    tournament.join(trainer);
    this.tournaments.save(tournament);
    this.watchSeat(tournament, trainer.id);
    this.afterSeatsChange(tournament);
  }

  leave(tournament: Tournament, trainer: Trainer): void {
    tournament.assertLobby();
    if (tournament.hostId === trainer.id) return this.close(tournament);
    if (!tournament.leave(trainer.id)) throw conflict('No estás en este torneo.');
    this.afterSeatsChange(tournament);
  }

  closeByHost(tournament: Tournament, trainer: Trainer): void {
    tournament.assertHost(trainer.id, 'cerrar el torneo');
    tournament.assertLobby();
    this.close(tournament);
  }

  setReady(tournament: Tournament, trainer: Trainer, ready: boolean): void {
    tournament.assertLobby();
    tournament.setReady(trainer.id, ready);
    this.afterSeatsChange(tournament);
  }

  addAis(tournament: Tournament, trainer: Trainer, { level, count }: { level: string; count: number }): void {
    tournament.assertHost(trainer.id, 'agregar IAs');
    tournament.assertLobby();
    this.skynet.assertOffered(level);
    tournament.addAis(level, count);
    this.afterSeatsChange(tournament);
  }

  kick(tournament: Tournament, trainer: Trainer, seat: number): void {
    tournament.assertHost(trainer.id, 'quitar jugadores');
    tournament.assertLobby();
    tournament.kick(seat);
    this.afterSeatsChange(tournament);
  }

  follow(ws: ClientConnection, id: string, token: string | undefined): Tournament | null {
    const tournament = this.tournaments.findById(id);
    if (!tournament) {
      ws.send({ t: 'error', error: 'Ese torneo no existe.' });
      return null;
    }
    if (token !== undefined) ws.signIn(this.trainers.authenticate(token));
    ws.follow(tournament);
    this.presence.followTournament(tournament.id, ws);
    this.broadcast(tournament);
    return tournament;
  }

  unfollow(ws: ClientConnection): void {
    const tournament = ws.tourId ? this.tournaments.findById(ws.tourId) : undefined;
    if (!tournament) return;
    this.presence.unfollowTournament(tournament.id, ws);
    if (tournament.seatOf(ws.trainerId) !== -1 && tournament.status === 'open') {
      this.watchSeat(tournament, ws.trainerId!);
      this.broadcast(tournament);
    }
  }

  broadcast(tournament: Tournament): void {
    for (const ws of this.presence.tournamentSockets(tournament.id))
      if (ws.open) ws.send({ t: 'tour', tournament: this.views.tournament(tournament, ws.trainerId) });
    if (tournament.visibility === 'public') this.lobby.notify();
  }

  private afterSeatsChange(tournament: Tournament): void {
    if (tournament.everyoneReady) return this.start(tournament);
    this.tournaments.save(tournament);
    this.broadcast(tournament);
  }

  private close(tournament: Tournament): void {
    tournament.close();
    this.tournaments.save(tournament);
    this.broadcast(tournament);
    this.lobby.notify();
  }

  private watchSeat(tournament: Tournament, trainerId: string): void {
    const key = `${tournament.id}:${trainerId}`;
    clearTimeout(this.seatTimers.get(key));
    const timer = setTimeout(() => {
      this.seatTimers.delete(key);
      if (tournament.status !== 'open' || this.presence.inTournament(tournament.id, trainerId)) return;
      if (trainerId === tournament.hostId) return this.close(tournament);
      if (tournament.leave(trainerId)) this.afterSeatsChange(tournament);
    }, this.timings.seatGraceMs);
    timer.unref();
    this.seatTimers.set(key, timer);
  }

  private start(tournament: Tournament): void {
    const at = now();
    tournament.start({
      at,
      order: shuffledOrder(tournament.size),
      firstMatchAt: at + this.timings.bracketDrawMs,
    });
    this.tournaments.save(tournament);
    this.broadcast(tournament);
    this.lobby.notify();
    setTimeout(() => this.startMatch(tournament), this.timings.bracketDrawMs).unref();
  }

  private seatTeam(tournament: Tournament, seat: Seat): RosterEntry[] {
    const ai = aiLevelOf(seat.id);
    if (ai) return tournament.mode === 'random' ? buildAiRandomParty() : buildAiTeam({ difficulty: ai });
    const trainer = this.trainers.byId(seat.id);
    if (!trainer?.roster.length) return buildAiRandomParty();
    return tournament.mode === 'random' ? randomParty(trainer.roster) : trainer.teamSnapshot();
  }

  private startMatch(tournament: Tournament): void {
    const next = tournament.nextMatch();
    if (!next) return;
    const [host, guest] = next.a.ai && !next.b.ai ? [next.b, next.a] : [next.a, next.b];
    const challenge = Challenge.tournamentMatch({
      id: newId(),
      host: { id: host.id, name: host.name, team: this.seatTeam(tournament, host), ai: host.ai },
      guest: { id: guest.id, name: guest.name, team: this.seatTeam(tournament, guest), ai: guest.ai },
      mode: tournament.mode,
      tournamentId: tournament.id,
      round: next.round,
      match: next.index,
      at: now(),
    });
    this.challenges.save(challenge);
    tournament.matchStarted(next, challenge.id);
    this.tournaments.save(tournament);
    this.previews.startCountdown(this.presence.room(challenge), tournament.label(next));
    this.broadcast(tournament);
  }

  private matchFinished({ challenge }: MatchFinished): void {
    const tournament = challenge.tournamentId ? this.tournaments.findById(challenge.tournamentId) : undefined;
    if (!tournament || tournament.status !== 'running') return;
    const at = now();
    const champion = tournament.matchFinished({ round: challenge.round!, index: challenge.match! }, challenge.winnerId ?? null, {
      now: at,
      nextMatchAt: at + this.timings.betweenMatchesMs,
    });
    if (champion === null) setTimeout(() => this.startMatch(tournament), this.timings.betweenMatchesMs).unref();
    this.tournaments.save(tournament);
    this.broadcast(tournament);
  }
}


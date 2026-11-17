// What the clients see of rooms and tournaments (the JSON shapes the frontend reads). Presenters
// only read: they never change an aggregate.
import { Injectable } from '@nestjs/common';
import { buildFighter } from '../../combat/domain/fighter.js';
import { aiLevelOf } from '../../combat/domain/ai.js';
import { PARTY_SIZE } from '../../combat/domain/team-preview.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { TournamentRepository } from '../domain/arena.repositories.js';
import type { Challenge } from '../domain/challenge.js';
import { humanCount, reachedRound, roundName, type Tournament } from '../domain/tournament.js';
import { Presence, type CountdownPlayer } from './presence.js';

@Injectable()
export class ArenaViews {
  constructor(
    private readonly trainers: TrainersService,
    private readonly tournaments: TournamentRepository,
    private readonly presence: Presence,
    private readonly skynet: SkynetService,
  ) {}

  /** The current name of a trainer (it may have changed since the room was created). */
  nameOf(id: string | null | undefined, fallback?: string): string | undefined {
    return this.trainers.byId(id)?.name ?? fallback;
  }

  challenge(challenge: Challenge, viewerId: string | null = null) {
    const host = this.trainers.byId(challenge.hostId);
    const hostTeam = (challenge.status === 'finished' || challenge.mode !== 'random'
      ? challenge.hostTeam
      : []).map((e) => buildFighter(e, { levelCap: challenge.levelCap }));
    const tournament = challenge.tournamentId ? this.tournaments.findById(challenge.tournamentId) : undefined;
    return {
      id: challenge.id,
      status: challenge.status,
      levelCap: challenge.levelCap,
      mode: challenge.mode,
      ai: challenge.ai ?? null,
      visibility: challenge.visibility,
      tournament: tournament?.bracket ? tournament.label({ round: challenge.round!, index: challenge.match! }) : null,
      createdAt: challenge.createdAt,
      host: { id: challenge.hostId, name: host?.name ?? challenge.hostName },
      guest: challenge.guestId ? { id: challenge.guestId, name: this.nameOf(challenge.guestId, challenge.guestName) } : null,
      hostTeam: viewerId === challenge.hostId || challenge.status === 'finished' ? hostTeam : [],
      hostTeamSize: challenge.mode === 'random' ? Math.min(PARTY_SIZE, host?.roster.length ?? 0) : hostTeam.length,
      winnerId: challenge.winnerId ?? null,
      turns: challenge.turns ?? null,
      final: challenge.final ?? null,
    };
  }

  /** A duel room in the "open rooms" list. */
  room(challenge: Challenge, viewerId: string | null) {
    const host = this.trainers.byId(challenge.hostId);
    return {
      id: challenge.id,
      kind: 'duel',
      mode: challenge.mode,
      levelCap: challenge.levelCap ?? null,
      createdAt: challenge.createdAt,
      host: { name: host?.name ?? challenge.hostName, wins: host?.wins ?? 0, losses: host?.losses ?? 0 },
      mine: challenge.hostId === viewerId,
    };
  }

  /** A tournament in the "open rooms" list. */
  tournamentRoom(tournament: Tournament, viewerId: string | null) {
    const host = this.trainers.byId(tournament.hostId);
    return {
      id: tournament.id,
      kind: 'tournament',
      mode: tournament.mode,
      levelCap: tournament.levelCap ?? null,
      size: tournament.size,
      filled: tournament.seats.length,
      createdAt: tournament.createdAt,
      host: { name: host?.name ?? tournament.seats[0]?.name, wins: host?.wins ?? 0, losses: host?.losses ?? 0 },
      mine: tournament.seatOf(viewerId) !== -1,
    };
  }

  tournament(tournament: Tournament, viewerId: string | null = null) {
    const you = tournament.seatOf(viewerId);
    return {
      id: tournament.id,
      status: tournament.status,
      mode: tournament.mode,
      levelCap: tournament.levelCap ?? null,
      size: tournament.size,
      visibility: tournament.visibility,
      createdAt: tournament.createdAt,
      hostId: tournament.hostId,
      host: viewerId === tournament.hostId,
      you: you === -1 ? null : you,
      seats: tournament.seats.map((seat) => {
        const trainer = seat.ai ? undefined : this.trainers.byId(seat.id);
        return {
          name: seat.name,
          ai: seat.ai ?? null,
          ready: seat.ready,
          online: seat.ai ? true : this.presence.inTournament(tournament.id, seat.id),
          wins: trainer?.wins ?? 0,
          losses: trainer?.losses ?? 0,
          rosterSize: trainer?.roster.length ?? 0,
        };
      }),
      rounds: (tournament.bracket ?? []).map((round, i) => ({
        name: roundName(tournament.size, i),
        matches: round.map((m) => ({ a: m.a, b: m.b, winner: m.winner, coinFlip: !!m.coinFlip, challengeId: m.challengeId })),
      })),
      current: tournament.current ?? null,
      drawAt: tournament.drawAt ?? null,
      nextAt: tournament.nextAt ?? null,
      champion: tournament.champion ?? null,
      played: tournament.played(),
      total: tournament.total(),
      aiLevels: this.skynet.aiLevels,
      serverNow: Date.now(),
    };
  }

  /** A 1v1 in `trainerId`'s history. */
  pastChallenge(challenge: Challenge, trainerId: string) {
    const mine = challenge.hostId === trainerId;
    return {
      id: challenge.id,
      status: challenge.status,
      levelCap: challenge.levelCap,
      mode: challenge.mode,
      ai: challenge.ai ?? null,
      visibility: challenge.visibility,
      createdAt: challenge.createdAt,
      opponent: mine
        ? (challenge.guestId ? (this.nameOf(challenge.guestId, challenge.guestName) ?? null) : null)
        : this.nameOf(challenge.hostId, challenge.hostName),
      won: challenge.status === 'finished' ? challenge.winnerId === trainerId : null,
      mine,
    };
  }

  /** A tournament in `trainerId`'s history: how far they got. */
  pastTournament(tournament: Tournament, trainerId: string) {
    const seat = tournament.seatOf(trainerId);
    const reached = tournament.bracket ? reachedRound(tournament.bracket, seat) : -1;
    return {
      id: tournament.id,
      size: tournament.size,
      mode: tournament.mode,
      levelCap: tournament.levelCap ?? null,
      status: tournament.status,
      humans: humanCount(tournament),
      createdAt: tournament.createdAt,
      champion: tournament.champion === seat,
      reached: reached === -1 ? null : roundName(tournament.size, reached),
    };
  }

  countdownPlayer(id: string, fallbackName: string): CountdownPlayer {
    const level = aiLevelOf(id);
    if (level) return { id, name: fallbackName, ai: level, wins: 0, losses: 0, rosterSize: 0, shinies: 0 };
    const trainer = this.trainers.byId(id);
    return {
      id,
      name: trainer?.name ?? fallbackName,
      ai: null,
      wins: trainer?.wins ?? 0,
      losses: trainer?.losses ?? 0,
      rosterSize: trainer?.roster.length ?? 0,
      shinies: trainer?.roster.filter((e) => e.shiny).length ?? 0,
    };
  }
}

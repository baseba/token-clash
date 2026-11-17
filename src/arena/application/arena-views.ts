// What the clients see of rooms and tournaments (the JSON shapes the frontend reads). Presenters
// only read: they never change an aggregate.
import { Injectable } from '@nestjs/common';
import { buildFighter } from '../../catalog/domain/creatures.js';
import { aiLevelOf } from '../../combat/domain/ai.js';
import { PARTY_SIZE } from '../../combat/domain/team-preview.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { TournamentRepository } from '../domain/arena.repositories.js';
import type { Challenge } from '../domain/challenge.js';
import { visibilityOf } from '../domain/lobby.js';
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

  challenge(c: Challenge, viewerId: string | null = null) {
    const host = this.trainers.byId(c.hostId);
    const hostTeam = (c.status === 'finished' || c.battleMode !== 'random' ? c.hostTeam : []).map((e) => buildFighter(e, { levelCap: c.levelCap }));
    const T = c.tournamentId ? this.tournaments.findById(c.tournamentId) : undefined;
    return {
      id: c.id,
      status: c.status,
      levelCap: c.levelCap,
      mode: c.battleMode,
      ai: c.ai ?? null,
      visibility: visibilityOf(c),
      tournament: T?.bracket ? T.label({ round: c.round!, index: c.match! }) : null,
      createdAt: c.createdAt,
      host: { id: c.hostId, name: host?.name ?? c.hostName },
      guest: c.guestId ? { id: c.guestId, name: this.nameOf(c.guestId, c.guestName) } : null,
      hostTeam: viewerId === c.hostId || c.status === 'finished' ? hostTeam : [],
      hostTeamSize: c.battleMode === 'random' ? Math.min(PARTY_SIZE, host?.roster.length ?? 0) : hostTeam.length,
      winnerId: c.winnerId ?? null,
      turns: c.turns ?? null,
      final: c.final ?? null,
    };
  }

  /** A duel room in the "open rooms" list. */
  room(c: Challenge, viewerId: string | null) {
    const host = this.trainers.byId(c.hostId);
    return { id: c.id, kind: 'duel', mode: c.battleMode, levelCap: c.levelCap ?? null, createdAt: c.createdAt, host: { name: host?.name ?? c.hostName, wins: host?.wins ?? 0, losses: host?.losses ?? 0 }, mine: c.hostId === viewerId };
  }

  /** A tournament in the "open rooms" list. */
  tournamentRoom(T: Tournament, viewerId: string | null) {
    const host = this.trainers.byId(T.hostId);
    return { id: T.id, kind: 'tournament', mode: T.mode, levelCap: T.levelCap ?? null, size: T.size, filled: T.seats.length, createdAt: T.createdAt, host: { name: host?.name ?? T.seats[0]?.name, wins: host?.wins ?? 0, losses: host?.losses ?? 0 }, mine: T.seatOf(viewerId) !== -1 };
  }

  tournament(T: Tournament, viewerId: string | null = null) {
    const you = T.seatOf(viewerId);
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
        const t = seat.ai ? undefined : this.trainers.byId(seat.id);
        return { name: seat.name, ai: seat.ai ?? null, ready: seat.ready, online: seat.ai ? true : this.presence.inTournament(T.id, seat.id), wins: t?.wins ?? 0, losses: t?.losses ?? 0, rosterSize: t?.roster.length ?? 0 };
      }),
      rounds: (T.bracket ?? []).map((round, i) => ({ name: roundName(T.size, i), matches: round.map((m) => ({ a: m.a, b: m.b, winner: m.winner, coinFlip: !!m.coinFlip, challengeId: m.challengeId })) })),
      current: T.current ?? null,
      drawAt: T.drawAt ?? null,
      nextAt: T.nextAt ?? null,
      champion: T.champion ?? null,
      played: T.played(),
      total: T.total(),
      aiLevels: this.skynet.aiLevels,
      serverNow: Date.now(),
    };
  }

  /** A 1v1 in `trainerId`'s history. */
  pastChallenge(c: Challenge, trainerId: string) {
    const mine = c.hostId === trainerId;
    return {
      id: c.id,
      status: c.status,
      levelCap: c.levelCap,
      mode: c.battleMode,
      ai: c.ai ?? null,
      visibility: visibilityOf(c),
      createdAt: c.createdAt,
      opponent: mine ? (c.guestId ? (this.nameOf(c.guestId, c.guestName) ?? null) : null) : this.nameOf(c.hostId, c.hostName),
      won: c.status === 'finished' ? c.winnerId === trainerId : null,
      mine,
    };
  }

  /** A tournament in `trainerId`'s history: how far they got. */
  pastTournament(T: Tournament, trainerId: string) {
    const seat = T.seatOf(trainerId);
    const reached = T.bracket ? reachedRound(T.bracket, seat) : -1;
    return { id: T.id, size: T.size, mode: T.mode, levelCap: T.levelCap ?? null, status: T.status, humans: humanCount(T), createdAt: T.createdAt, champion: T.champion === seat, reached: reached === -1 ? null : roundName(T.size, reached) };
  }

  countdownPlayer(id: string, fallbackName: string): CountdownPlayer {
    const level = aiLevelOf(id);
    if (level) return { id, name: fallbackName, ai: level, wins: 0, losses: 0, rosterSize: 0, shinies: 0 };
    const t = this.trainers.byId(id);
    return { id, name: t?.name ?? fallbackName, ai: null, wins: t?.wins ?? 0, losses: t?.losses ?? 0, rosterSize: t?.roster.length ?? 0, shinies: t?.roster.filter((e) => e.shiny).length ?? 0 };
  }
}

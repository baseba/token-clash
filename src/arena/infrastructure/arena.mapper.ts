import { compact } from '../../platform/database/compact.js';
import { Challenge, type BattleMode, type ChallengeStatus, type Visibility } from '../domain/challenge.js';
import { Tournament, type Bracket, type TournamentStatus } from '../domain/tournament.js';
import type { challenges, ChallengeRow, MatchRow, SeatRow, tournamentMatches, TournamentRow, tournaments, tournamentSeats } from './arena.schema.js';

export function challengeToDomain(row: ChallengeRow): Challenge {
  return Challenge.restore({
    ...compact({
      id: row.id,
      status: row.status as ChallengeStatus,
      mode: row.mode as BattleMode,
      visibility: row.visibility as Visibility,
      ai: row.ai ?? undefined,
      aiOnly: row.aiOnly ?? undefined,
      hostId: row.hostId,
      hostName: row.hostName,
      hostTeam: row.hostTeam,
      guestId: row.guestId ?? undefined,
      guestName: row.guestName ?? undefined,
      guestTeam: row.guestTeam ?? undefined,
      tournamentId: row.tournamentId ?? undefined,
      round: row.round ?? undefined,
      match: row.matchIndex ?? undefined,
      winnerId: row.winnerId ?? undefined,
      turns: row.turns ?? undefined,
      final: row.final ?? undefined,
      createdAt: row.createdAt,
      finishedAt: row.finishedAt ?? undefined,
      staging: row.staging ?? undefined,
    }),
  });
}

export function challengeToRow(challenge: Challenge): typeof challenges.$inferInsert {
  return {
    id: challenge.id,
    status: challenge.status,
    mode: challenge.mode,
    visibility: challenge.visibility,
    ai: challenge.ai ?? null,
    aiOnly: challenge.aiOnly ?? null,
    hostId: challenge.hostId,
    hostName: challenge.hostName,
    hostTeam: challenge.hostTeam ?? [],
    guestId: challenge.guestId ?? null,
    guestName: challenge.guestName ?? null,
    guestTeam: challenge.guestTeam ?? null,
    tournamentId: challenge.tournamentId ?? null,
    round: challenge.round ?? null,
    matchIndex: challenge.match ?? null,
    winnerId: challenge.winnerId ?? null,
    turns: challenge.turns ?? null,
    final: challenge.final ?? null,
    createdAt: challenge.createdAt,
    finishedAt: challenge.finishedAt ?? null,
    staging: challenge.staging ?? null,
  };
}

export function tournamentToDomain(row: TournamentRow, seats: SeatRow[], matches: MatchRow[]): Tournament {
  let bracket: Bracket | undefined;
  if (matches.length) {
    bracket = [];
    for (const row of [...matches].sort((x, y) => x.round - y.round || x.position - y.position)) {
      (bracket[row.round] ??= [])[row.position] = {
        a: row.seatA,
        b: row.seatB,
        winner: row.winner,
        challengeId: row.challengeId,
        ...(row.coinFlip ? { coinFlip: true } : {}),
      };
    }
  }
  return Tournament.restore({
    ...compact({
      id: row.id,
      hostId: row.hostId,
      mode: row.mode as BattleMode,
      size: row.size,
      visibility: row.visibility as Visibility,
      status: row.status as TournamentStatus,
      createdAt: row.createdAt,
      startedAt: row.startedAt ?? undefined,
      bracket,
      drawAt: row.drawAt ?? undefined,
      nextAt: row.nextAt ?? undefined,
      current: row.current ?? undefined,
      champion: row.champion ?? undefined,
      finishedAt: row.finishedAt ?? undefined,
    }),
    seats: [...seats].sort((a, b) => a.position - b.position).map((s) => ({ id: s.seatId, name: s.name, ai: s.ai ?? null, ...(s.aiBase ? { aiBase: s.aiBase } : {}), ready: s.ready })),
  });
}

export function tournamentToRows(tournament: Tournament): {
  tournament: typeof tournaments.$inferInsert;
  seats: (typeof tournamentSeats.$inferInsert)[];
  matches: (typeof tournamentMatches.$inferInsert)[];
} {
  return {
    tournament: {
      id: tournament.id,
      hostId: tournament.hostId,
      mode: tournament.mode,
      size: tournament.size,
      visibility: tournament.visibility,
      status: tournament.status,
      createdAt: tournament.createdAt,
      startedAt: tournament.startedAt ?? null,
      drawAt: tournament.drawAt ?? null,
      nextAt: tournament.nextAt ?? null,
      current: tournament.current ?? null,
      champion: tournament.champion ?? null,
      finishedAt: tournament.finishedAt ?? null,
    },
    seats: tournament.seats.map((s, position) => ({
      tournamentId: tournament.id,
      position,
      seatId: s.id,
      name: s.name,
      ai: s.ai ?? null,
      aiBase: s.aiBase ?? null,
      ready: !!s.ready,
    })),
    matches: (tournament.bracket ?? []).flatMap((round, r) =>
      round.map((m, position) => ({
        tournamentId: tournament.id,
        round: r,
        position,
        seatA: m.a,
        seatB: m.b,
        winner: m.winner,
        coinFlip: m.coinFlip ?? null,
        challengeId: m.challengeId ?? null,
      })),
    ),
  };
}

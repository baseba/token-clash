// Aggregate ⇄ rows for challenges and tournaments. A tournament is one aggregate stored in three
// tables (tournament, seats, bracket matches): it is always loaded and saved whole.
import { compact } from '../../shared/infrastructure/database/compact.js';
import { Challenge, type BattleMode, type ChallengeStatus, type Visibility } from '../domain/challenge.js';
import { Tournament, type Bracket, type TournamentStatus } from '../domain/tournament.js';
import type { challenges, ChallengeRow, MatchRow, SeatRow, tournamentMatches, TournamentRow, tournaments, tournamentSeats } from './arena.schema.js';

export function challengeToDomain(r: ChallengeRow): Challenge {
  return Challenge.restore({
    ...compact({
      id: r.id,
      status: r.status as ChallengeStatus,
      mode: (r.mode as BattleMode | null) ?? undefined,
      visibility: (r.visibility as Visibility | null) ?? undefined,
      ai: r.ai ?? undefined,
      aiOnly: r.aiOnly ?? undefined,
      hostId: r.hostId,
      hostName: r.hostName,
      hostTeam: r.hostTeam,
      guestId: r.guestId ?? undefined,
      guestName: r.guestName ?? undefined,
      guestTeam: r.guestTeam ?? undefined,
      tournamentId: r.tournamentId ?? undefined,
      round: r.round ?? undefined,
      match: r.matchIndex ?? undefined,
      winnerId: r.winnerId ?? undefined,
      turns: r.turns ?? undefined,
      final: r.final ?? undefined,
      createdAt: r.createdAt,
      finishedAt: r.finishedAt ?? undefined,
    }),
    levelCap: r.levelCap ?? null,
  });
}

export function challengeToRow(c: Challenge): typeof challenges.$inferInsert {
  return {
    id: c.id,
    status: c.status,
    mode: c.mode ?? null,
    levelCap: c.levelCap ?? null,
    visibility: c.visibility ?? null,
    ai: c.ai ?? null,
    aiOnly: c.aiOnly ?? null,
    hostId: c.hostId,
    hostName: c.hostName,
    hostTeam: c.hostTeam ?? [],
    guestId: c.guestId ?? null,
    guestName: c.guestName ?? null,
    guestTeam: c.guestTeam ?? null,
    tournamentId: c.tournamentId ?? null,
    round: c.round ?? null,
    matchIndex: c.match ?? null,
    winnerId: c.winnerId ?? null,
    turns: c.turns ?? null,
    final: c.final ?? null,
    createdAt: c.createdAt,
    finishedAt: c.finishedAt ?? null,
  };
}

export function tournamentToDomain(r: TournamentRow, seats: SeatRow[], matches: MatchRow[]): Tournament {
  let bracket: Bracket | undefined;
  if (matches.length) {
    bracket = [];
    for (const m of [...matches].sort((x, y) => x.round - y.round || x.position - y.position)) {
      (bracket[m.round] ??= [])[m.position] = { a: m.seatA, b: m.seatB, winner: m.winner, challengeId: m.challengeId, ...(m.coinFlip ? { coinFlip: true } : {}) };
    }
  }
  return Tournament.restore({
    ...compact({
      id: r.id,
      hostId: r.hostId,
      mode: r.mode as BattleMode,
      size: r.size,
      visibility: r.visibility as Visibility,
      status: r.status as TournamentStatus,
      createdAt: r.createdAt,
      startedAt: r.startedAt ?? undefined,
      bracket,
      drawAt: r.drawAt ?? undefined,
      aiLevel: r.aiLevel ?? undefined,
      nextAt: r.nextAt ?? undefined,
      current: r.current ?? undefined,
      champion: r.champion ?? undefined,
      finishedAt: r.finishedAt ?? undefined,
    }),
    levelCap: r.levelCap ?? null,
    seats: [...seats].sort((a, b) => a.position - b.position).map((s) => ({ id: s.seatId, name: s.name, ai: s.ai ?? null, ...(s.aiBase ? { aiBase: s.aiBase } : {}), ready: s.ready })),
  });
}

export function tournamentToRows(t: Tournament): {
  tournament: typeof tournaments.$inferInsert;
  seats: (typeof tournamentSeats.$inferInsert)[];
  matches: (typeof tournamentMatches.$inferInsert)[];
} {
  return {
    tournament: {
      id: t.id,
      hostId: t.hostId,
      mode: t.mode,
      levelCap: t.levelCap ?? null,
      size: t.size,
      visibility: t.visibility,
      status: t.status,
      createdAt: t.createdAt,
      startedAt: t.startedAt ?? null,
      drawAt: t.drawAt ?? null,
      aiLevel: t.aiLevel ?? null,
      nextAt: t.nextAt ?? null,
      current: t.current ?? null,
      champion: t.champion ?? null,
      finishedAt: t.finishedAt ?? null,
    },
    seats: t.seats.map((s, position) => ({ tournamentId: t.id, position, seatId: s.id, name: s.name, ai: s.ai ?? null, aiBase: s.aiBase ?? null, ready: !!s.ready })),
    matches: (t.bracket ?? []).flatMap((round, r) =>
      round.map((m, position) => ({ tournamentId: t.id, round: r, position, seatA: m.a, seatB: m.b, winner: m.winner, coinFlip: m.coinFlip ?? null, challengeId: m.challengeId ?? null })),
    ),
  };
}

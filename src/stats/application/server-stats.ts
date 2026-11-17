// The /stats page: ranking, recent battles, most used Pokémon, tournaments and server totals.
// It is a read model: it only reads (from the other contexts' public queries) and computes.
import { humanCount, type TournamentState } from '../../arena/domain/tournament.js';
import { isHumanDuel, type ChallengeState } from '../../arena/domain/challenge.js';
import { TURN_LIMIT } from '../../combat/domain/battle.js';
import { byRanking } from '../../trainers/domain/ranking.js';
import type { TrainerState } from '../../trainers/domain/trainer.js';

const RECENT = 12;
const TOP_MONS = 12;
const ACTIVE_NOW_MS = 15 * 60_000;
const ACTIVE_DAY_MS = 24 * 60 * 60_000;

type TrainerLike = Pick<TrainerState, 'id' | 'name' | 'wins' | 'losses' | 'roster'> & Partial<Pick<TrainerState, 'totalTokens' | 'lastSeen'>>;

/** Everything the stats read, by id. */
export interface StatsSource {
  trainers: Record<string, TrainerLike>;
  challenges: Record<string, ChallengeState>;
  tournaments?: Record<string, TournamentState>;
}

const nameOf = (source: StatsSource, id: string | null | undefined, fallback?: string | null) => (id ? source.trainers[id]?.name : undefined) ?? fallback ?? '¿?';

export function rankingOf(trainers: TrainerLike[]) {
  return trainers
    .filter((t) => t.wins + t.losses > 0)
    .map((trainer) => {
      const games = trainer.wins + trainer.losses;
      return {
        id: trainer.id,
        name: trainer.name,
        wins: trainer.wins,
        losses: trainer.losses,
        games,
        winRate: games ? trainer.wins / games : null,
        rosterSize: trainer.roster.length,
        shinies: trainer.roster.filter((e) => e.shiny).length,
        totalTokens: trainer.totalTokens ?? 0,
      };
    })
    .sort(byRanking);
}

/** Groups accounts that imported the same save (they share Pokémon instance ids): one person each. */
export function playersOf<T extends TrainerLike>(trainers: T[]): T[][] {
  const parent = trainers.map((_, i) => i);
  const find = (node: number): number => (parent[node] === node ? node : (parent[node] = find(parent[node])));
  const ownerOf = new Map<string, number>();
  trainers.forEach((trainer, i) => {
    for (const entry of trainer.roster) {
      if (!entry.id) continue;
      if (ownerOf.has(entry.id)) parent[find(i)] = find(ownerOf.get(entry.id)!);
      else ownerOf.set(entry.id, i);
    }
  });
  const groups = new Map<number, T[]>();
  trainers.forEach((t, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), t]));
  return [...groups.values()];
}

function uniqueEntries(trainers: TrainerLike[]) {
  const byKey = new Map<string, TrainerLike['roster'][number]>();
  for (const trainer of trainers) trainer.roster.forEach((e, i) => byKey.set(e.id ?? `${trainer.id}:${i}`, e));
  return [...byKey.values()];
}

const activeSince = (players: TrainerLike[][], since: number) => players.filter((group) => group.some((t) => (t.lastSeen ?? 0) >= since)).length;

function monUsage(battles: ChallengeState[]) {
  const usage = new Map<string, { name: string; sprite?: string; types?: string[]; uses: number; wins: number }>();
  for (const challenge of battles) {
    challenge.final!.sides.forEach((side, sideIndex) => {
      for (const fighter of side.team) {
        if (!fighter.speciesName || fighter.hidden) continue;
        const key = fighter.speciesName;
        const row = usage.get(key) ?? { name: fighter.speciesName, sprite: fighter.sprite, types: fighter.types, uses: 0, wins: 0 };
        row.uses += 1;
        if (challenge.final!.winner === sideIndex) row.wins += 1;
        usage.set(key, row);
      }
    });
  }
  return [...usage.values()].sort((a, b) => b.uses - a.uses || b.wins - a.wins || a.name.localeCompare(b.name)).slice(0, TOP_MONS);
}

export function serverStats(source: StatsSource, now = Date.now()) {
  const trainers = Object.values(source.trainers);
  const players = playersOf(trainers);
  const entries = uniqueEntries(trainers);
  const challenges = Object.values(source.challenges);
  const pvp = challenges.filter((c) => isHumanDuel(c) && c.status === 'finished' && c.final);
  const vsAi = challenges.filter((c) => c.ai && !c.aiOnly && c.status === 'finished');
  const turns = pvp.reduce((sum, c) => sum + Math.min(c.turns ?? 0, TURN_LIMIT), 0);
  return {
    totals: {
      trainers: players.length,
      accounts: trainers.length,
      pokemon: entries.length,
      species: new Set(entries.map((e) => e.finalID)).size,
      shinies: entries.filter((e) => e.shiny).length,
      tokens: players.reduce((sum, group) => sum + Math.max(...group.map((t) => t.totalTokens ?? 0)), 0),
      battles: pvp.length,
      randomBattles: pvp.filter((c) => c.mode === 'random').length,
      draws: pvp.filter((c) => !c.winnerId).length,
      avgTurns: pvp.length ? Math.round((turns / pvp.length) * 10) / 10 : null,
      aiBattles: vsAi.length,
      aiWins: vsAi.filter((c) => c.winnerId && c.winnerId === c.hostId).length,
      activeNow: activeSince(players, now - ACTIVE_NOW_MS),
      activeToday: activeSince(players, now - ACTIVE_DAY_MS),
    },
    ranking: rankingOf(trainers),
    recent: pvp
      .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))
      .slice(0, RECENT)
      .map((c) => ({
        id: c.id,
        host: nameOf(source, c.hostId, c.hostName),
        guest: nameOf(source, c.guestId, c.guestName),
        winner: c.winnerId === c.hostId ? 'host' : c.winnerId === c.guestId ? 'guest' : null,
        mode: c.mode,
        levelCap: c.levelCap ?? null,
        turns: c.turns ?? null,
        finishedAt: c.finishedAt ?? c.createdAt,
      })),
    topMons: monUsage(pvp),
    tournaments: tournamentStats(source),
  };
}

export function tournamentStats(source: StatsSource) {
  const done = Object.values(source.tournaments ?? {}).filter((t) => t.status === 'finished' && t.bracket && humanCount(t) >= 2);
  type Row = { id: string; name: string; titles: number; finals: number; played: number; wins: number; losses: number };
  const rows = new Map<string, Row>();
  const row = (seat: { id: string; name: string }) => {
    const key = seat.id;
    if (!rows.has(key)) rows.set(key, { id: seat.id, name: nameOf(source, seat.id, seat.name), titles: 0, finals: 0, played: 0, wins: 0, losses: 0 });
    return rows.get(key)!;
  };
  for (const tournament of done) {
    tournament.seats.forEach((seat, i) => {
      if (seat.ai) return;
      const stats = row(seat);
      stats.played += 1;
      if (tournament.champion === i) stats.titles += 1;
      const final = tournament.bracket!.at(-1)![0];
      if (final.a === i || final.b === i) stats.finals += 1;
      for (const match of tournament.bracket!.flat()) {
        if (match.winner === null || (match.a !== i && match.b !== i)) continue;
        if (match.winner === i) stats.wins += 1;
        else stats.losses += 1;
      }
    });
  }
  const ranking = [...rows.values()].sort((a, b) => b.titles - a.titles || b.finals - a.finals || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  const recent = done
    .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))
    .slice(0, RECENT)
    .map((tournament) => {
      const champ = tournament.seats[tournament.champion!];
      return {
        id: tournament.id,
        size: tournament.size,
        mode: tournament.mode,
        levelCap: tournament.levelCap ?? null,
        humans: humanCount(tournament),
        champion: champ ? nameOf(source, champ.ai ? null : champ.id, champ.name) : '¿?',
        championAi: !!champ?.ai,
        finishedAt: tournament.finishedAt ?? tournament.createdAt,
      };
    });
  return {
    totals: { tournaments: done.length, matches: done.reduce((n, t) => n + t.size - 1, 0), aiTitles: done.filter((t) => t.seats[t.champion!]?.ai).length },
    ranking,
    recent,
  };
}

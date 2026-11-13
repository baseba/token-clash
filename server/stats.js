import { humanCount } from './tournament.js';
import { TURN_LIMIT } from './battle.js';

const RECENT = 12;
const TOP_MONS = 12;
const ACTIVE_NOW_MS = 15 * 60_000;
const ACTIVE_DAY_MS = 24 * 60 * 60_000;

const nameOf = (db, id, fallback) => db.trainers[id]?.name ?? fallback ?? '¿?';

export function rankingOf(trainers) {
  return trainers
    .filter((t) => t.wins + t.losses > 0)
    .map((t) => {
      const games = t.wins + t.losses;
      return {
        id: t.id,
        name: t.name,
        wins: t.wins,
        losses: t.losses,
        games,
        winRate: games ? t.wins / games : null,
        rosterSize: t.roster.length,
        shinies: t.roster.filter((e) => e.shiny).length,
        totalTokens: t.totalTokens ?? 0,
      };
    })
    .sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || a.losses - b.losses || a.name.localeCompare(b.name));
}

export function playersOf(trainers) {
  const parent = trainers.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const ownerOf = new Map();
  trainers.forEach((t, i) => {
    for (const e of t.roster) {
      if (!e.id) continue;
      if (ownerOf.has(e.id)) parent[find(i)] = find(ownerOf.get(e.id));
      else ownerOf.set(e.id, i);
    }
  });
  const groups = new Map();
  trainers.forEach((t, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), t]));
  return [...groups.values()];
}

function uniqueEntries(trainers) {
  const byKey = new Map();
  for (const t of trainers) t.roster.forEach((e, i) => byKey.set(e.id ?? `${t.id}:${i}`, e));
  return [...byKey.values()];
}

const activeSince = (players, since) => players.filter((group) => group.some((t) => (t.lastSeen ?? 0) >= since)).length;

function monUsage(battles) {
  const usage = new Map();
  for (const c of battles) {
    c.final.sides.forEach((side, s) => {
      for (const f of side.team) {
        if (!f.speciesName || f.hidden) continue;
        const key = f.speciesName;
        const row = usage.get(key) ?? { name: f.speciesName, sprite: f.sprite, types: f.types, uses: 0, wins: 0 };
        row.uses += 1;
        if (c.final.winner === s) row.wins += 1;
        usage.set(key, row);
      }
    });
  }
  return [...usage.values()].sort((a, b) => b.uses - a.uses || b.wins - a.wins || a.name.localeCompare(b.name)).slice(0, TOP_MONS);
}

export function serverStats(db, now = Date.now()) {
  const trainers = Object.values(db.trainers);
  const players = playersOf(trainers);
  const entries = uniqueEntries(trainers);
  const challenges = Object.values(db.challenges);
  const pvp = challenges.filter((c) => !c.ai && !c.tournamentId && c.status === 'finished' && c.final);
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
        host: nameOf(db, c.hostId, c.hostName),
        guest: nameOf(db, c.guestId, c.guestName),
        winner: c.winnerId === c.hostId ? 'host' : c.winnerId === c.guestId ? 'guest' : null,
        mode: c.mode ?? 'team',
        levelCap: c.levelCap ?? null,
        turns: c.turns ?? null,
        finishedAt: c.finishedAt ?? c.createdAt,
      })),
    topMons: monUsage(pvp),
    tournaments: tournamentStats(db),
  };
}

export function tournamentStats(db) {
  const done = Object.values(db.tournaments ?? {}).filter((t) => t.status === 'finished' && t.bracket && humanCount(t) >= 2);
  const rows = new Map();
  const row = (seat) => {
    const key = seat.id;
    if (!rows.has(key)) rows.set(key, { id: seat.id, name: nameOf(db, seat.id, seat.name), titles: 0, finals: 0, played: 0, wins: 0, losses: 0 });
    return rows.get(key);
  };
  for (const t of done) {
    t.seats.forEach((seat, i) => {
      if (seat.ai) return;
      const r = row(seat);
      r.played += 1;
      if (t.champion === i) r.titles += 1;
      const final = t.bracket.at(-1)[0];
      if (final.a === i || final.b === i) r.finals += 1;
      for (const m of t.bracket.flat()) {
        if (m.winner === null || (m.a !== i && m.b !== i)) continue;
        if (m.winner === i) r.wins += 1;
        else r.losses += 1;
      }
    });
  }
  const ranking = [...rows.values()].sort((a, b) => b.titles - a.titles || b.finals - a.finals || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name));
  const recent = done
    .sort((a, b) => (b.finishedAt ?? b.createdAt) - (a.finishedAt ?? a.createdAt))
    .slice(0, RECENT)
    .map((t) => {
      const champ = t.seats[t.champion];
      return { id: t.id, size: t.size, mode: t.mode ?? 'team', levelCap: t.levelCap ?? null, humans: humanCount(t), champion: champ ? nameOf(db, champ.ai ? null : champ.id, champ.name) : '¿?', championAi: !!champ?.ai, finishedAt: t.finishedAt ?? t.createdAt };
    });
  return {
    totals: { tournaments: done.length, matches: done.reduce((n, t) => n + t.size - 1, 0), aiTitles: done.filter((t) => t.seats[t.champion]?.ai).length },
    ranking,
    recent,
  };
}

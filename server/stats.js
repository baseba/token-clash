const RECENT = 12;
const TOP_MONS = 12;

const nameOf = (db, id, fallback) => db.trainers[id]?.name ?? fallback ?? '¿?';

export function rankingOf(trainers) {
  return trainers
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
    .sort((a, b) => b.wins - a.wins || a.losses - b.losses || b.totalTokens - a.totalTokens);
}

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

export function serverStats(db) {
  const trainers = Object.values(db.trainers);
  const challenges = Object.values(db.challenges);
  const pvp = challenges.filter((c) => !c.ai && c.status === 'finished' && c.final);
  const species = new Set(trainers.flatMap((t) => t.roster.map((e) => e.finalID)));
  const turns = pvp.reduce((sum, c) => sum + (c.turns ?? 0), 0);
  return {
    totals: {
      trainers: trainers.length,
      pokemon: trainers.reduce((sum, t) => sum + t.roster.length, 0),
      species: species.size,
      shinies: trainers.reduce((sum, t) => sum + t.roster.filter((e) => e.shiny).length, 0),
      tokens: trainers.reduce((sum, t) => sum + (t.totalTokens ?? 0), 0),
      battles: pvp.length,
      aiBattles: challenges.filter((c) => c.ai && c.status === 'finished').length,
      randomBattles: pvp.filter((c) => c.mode === 'random').length,
      avgTurns: pvp.length ? Math.round((turns / pvp.length) * 10) / 10 : null,
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
  };
}

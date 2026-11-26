interface Ranked {
  name: string;
  wins: number;
  losses: number;
  elo: number | null;
}

const byElo = (a: Ranked, b: Ranked) => (a.elo === b.elo ? 0 : a.elo === null ? 1 : b.elo === null ? -1 : b.elo - a.elo);

export function byRanking(a: Ranked, b: Ranked): number {
  return byElo(a, b) || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name);
}

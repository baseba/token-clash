// The 1v1 ranking. Trainers keep the score (wins and losses), so the order lives here, and both
// the leaderboard (/api/leaderboard) and the stats page sort with it.

interface Scored {
  name: string;
  wins: number;
  losses: number;
}

/** More wins first; with the same wins, fewer losses; then by name, so ties never depend on load order. */
export function byRanking(a: Scored, b: Scored): number {
  return b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name);
}

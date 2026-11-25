interface Scored {
  name: string;
  wins: number;
  losses: number;
}

export function byRanking(a: Scored, b: Scored): number {
  return b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name);
}

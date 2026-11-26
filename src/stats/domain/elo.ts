export const INITIAL_ELO = 1000;
export const ELO_K_FACTOR = 32;

export interface RatedDuel {
  id: string;
  players: readonly [string, string];
  winnerId: string | null;
  finishedAt: number;
}

const expectedScore = (own: number, opponent: number) => 1 / (1 + 10 ** ((opponent - own) / 400));

const scoreOf = (duel: RatedDuel, playerId: string) => (duel.winnerId === null ? 0.5 : duel.winnerId === playerId ? 1 : 0);

const chronologically = (a: RatedDuel, b: RatedDuel) => a.finishedAt - b.finishedAt || a.id.localeCompare(b.id);

export function eloRatings(duels: readonly RatedDuel[]): Map<string, number> {
  const ratings = new Map<string, number>();
  for (const duel of [...duels].sort(chronologically)) {
    const [first, second] = duel.players;
    const firstRating = ratings.get(first) ?? INITIAL_ELO;
    const secondRating = ratings.get(second) ?? INITIAL_ELO;
    ratings.set(first, firstRating + ELO_K_FACTOR * (scoreOf(duel, first) - expectedScore(firstRating, secondRating)));
    ratings.set(second, secondRating + ELO_K_FACTOR * (scoreOf(duel, second) - expectedScore(secondRating, firstRating)));
  }
  return new Map([...ratings].map(([playerId, rating]) => [playerId, Math.round(rating)]));
}

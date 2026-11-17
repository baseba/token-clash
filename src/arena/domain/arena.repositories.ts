import type { Challenge } from './challenge.js';
import type { Tournament } from './tournament.js';

/** Port for challenges (rooms and their battles). Implemented in infrastructure with Drizzle. */
export abstract class ChallengeRepository {
  abstract all(): Challenge[];
  abstract findById(id: string): Challenge | undefined;
  abstract save(challenge: Challenge): void;
}

/** Port for tournaments (with their seats and bracket). Implemented in infrastructure with Drizzle. */
export abstract class TournamentRepository {
  abstract all(): Tournament[];
  abstract findById(id: string): Tournament | undefined;
  abstract save(tournament: Tournament): void;
}

import type { Challenge } from './challenge.js';
import type { Tournament } from './tournament.js';

export abstract class ChallengeRepository {
  abstract all(): Challenge[];
  abstract findById(id: string): Challenge | undefined;
  abstract save(challenge: Challenge): void;
}

export abstract class TournamentRepository {
  abstract all(): Tournament[];
  abstract findById(id: string): Tournament | undefined;
  abstract save(tournament: Tournament): void;
}

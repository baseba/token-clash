import type { Trainer } from '../../trainers/domain/trainer.js';
import type { Challenge } from '../domain/challenge.js';
import type { Tournament } from '../domain/tournament.js';

export interface ClientConnection {
  readonly trainerId: string | null;
  readonly roomId: string | null;
  readonly tourId: string | null;
  readonly open: boolean;
  send(frame: object | string): void;
  signIn(trainer: Trainer | undefined): void;
  enterRoom(challenge: Challenge): void;
  follow(tournament: Tournament): void;
}

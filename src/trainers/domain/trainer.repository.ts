import type { Trainer } from './trainer.js';

export abstract class TrainerRepository {
  abstract all(): Trainer[];
  abstract findById(id: string): Trainer | undefined;
  abstract findByTokenHash(tokenHash: string): Trainer | undefined;
  abstract save(trainer: Trainer): void;
  abstract saveLastSeen(trainer: Trainer): void;
}

import type { Trainer } from './trainer.js';

/**
 * Port: what the trainers use cases need from storage, in domain words. The domain defines it and
 * the infrastructure implements it (DrizzleTrainerRepository), so the rules never depend on SQL.
 * Nest injects the implementation through this abstract class, which doubles as the DI token.
 */
export abstract class TrainerRepository {
  abstract all(): Trainer[];
  abstract findById(id: string): Trainer | undefined;
  abstract findByTokenHash(tokenHash: string): Trainer | undefined;
  /** Stores the whole aggregate (trainer and roster) atomically. */
  abstract save(trainer: Trainer): void;
  /** Cheap path for the one field that changes on every request. */
  abstract saveLastSeen(trainer: Trainer): void;
}

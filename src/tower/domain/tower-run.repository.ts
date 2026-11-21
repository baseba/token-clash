import type { TowerRun } from './tower-run.js';

/** Port for the Tower climbs. Implemented in infrastructure with Drizzle. */
export abstract class TowerRunRepository {
  abstract all(): TowerRun[];
  abstract findById(id: string): TowerRun | undefined;
  abstract save(run: TowerRun): void;
}

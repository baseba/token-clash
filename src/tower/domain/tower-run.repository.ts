import type { TowerRun } from './tower-run.js';

export abstract class TowerRunRepository {
  abstract all(): TowerRun[];
  abstract findById(id: string): TowerRun | undefined;
  abstract save(run: TowerRun): void;
}

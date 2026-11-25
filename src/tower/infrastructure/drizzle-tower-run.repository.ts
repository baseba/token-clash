import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import type { Database } from '../../shared/infrastructure/database/database.js';
import { TowerRunRepository } from '../domain/tower-run.repository.js';
import type { TowerRun } from '../domain/tower-run.js';
import { towerRunToDomain, towerRunToRow } from './tower.mapper.js';
import { towerRuns } from './tower.schema.js';

@Injectable()
export class DrizzleTowerRunRepository extends TowerRunRepository {
  private readonly byId = new Map<string, TowerRun>();

  constructor(@InjectDrizzle() private readonly db: Database) {
    super();
    for (const row of this.db.select().from(towerRuns).all()) {
      const run = towerRunToDomain(row);
      this.byId.set(run.id, run);
    }
  }

  all(): TowerRun[] {
    return [...this.byId.values()];
  }

  findById(id: string): TowerRun | undefined {
    return this.byId.get(id);
  }

  save(run: TowerRun): void {
    const row = towerRunToRow(run);
    this.db.insert(towerRuns).values(row).onConflictDoUpdate({ target: towerRuns.id, set: row }).run();
    this.byId.set(run.id, run);
  }
}

import { Injectable } from '@nestjs/common';
import type { AiLevel } from '../../combat/domain/ai.js';
import { TowerRunRepository } from '../domain/tower-run.repository.js';
import type { TowerRun } from '../domain/tower-run.js';
import type { FloorScore } from '../domain/score.js';

export interface TowerRecord {
  trainerId: string;
  difficulty: AiLevel;
  length: number | null;
  points: number;
  cleared: number;
  finished: boolean;
  log: FloorScore[];
  at: number;
}

@Injectable()
export class TowerRecords {
  constructor(private readonly runs: TowerRunRepository) {}

  current(trainerId: string): TowerRun | undefined {
    return this.runs.all().find((run) => run.trainerId === trainerId && run.open);
  }

  last(trainerId: string): TowerRun | undefined {
    let latest: TowerRun | undefined;
    for (const run of this.runs.all()) {
      if (run.trainerId !== trainerId || run.open) continue;
      if (!latest || (run.finishedAt ?? 0) > (latest.finishedAt ?? 0)) latest = run;
    }
    return latest;
  }

  records(): TowerRecord[] {
    const best = new Map<string, TowerRun>();
    for (const run of this.runs.all()) {
      if (!run.log.length) continue;
      const key = `${run.trainerId}:${run.difficulty}`;
      const known = best.get(key);
      if (!known || run.points > known.points || (run.points === known.points && run.updatedAt < known.updatedAt)) best.set(key, run);
    }
    return [...best.values()]
      .map((run) => ({ trainerId: run.trainerId, difficulty: run.difficulty, length: run.length, points: run.points, cleared: run.cleared, finished: run.status === 'cleared', log: run.log, at: run.finishedAt ?? run.updatedAt }))
      .sort((a, b) => b.points - a.points || a.at - b.at);
  }
}

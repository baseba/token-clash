// TowerRun ⇄ row.
import type { AiLevel } from '../../combat/domain/ai.js';
import type { RoomKind } from '../../catalog/domain/tower-cast.js';
import { TowerRun, type RunStatus } from '../domain/tower-run.js';
import type { towerRuns, TowerRunRow } from './tower.schema.js';

export function towerRunToDomain(row: TowerRunRow): TowerRun {
  return TowerRun.restore({
    id: row.id,
    trainerId: row.trainerId,
    difficulty: row.difficulty as AiLevel,
    length: row.length ?? null,
    seed: row.seed,
    status: row.status as RunStatus,
    floor: row.floor,
    party: row.party.map((mon) => ({ ...mon, evs: mon.evs ?? { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 } })),
    offers: row.offers,
    rewards: row.rewards,
    room: (row.room as RoomKind | null) ?? null,
    picks: row.picks,
    rerolls: row.rerolls,
    rolls: row.rolls ?? {},
    log: row.log ?? [],
    challengeId: row.challengeId ?? null,
    lastResult: row.lastResult ?? null,
    cleared: row.cleared,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    finishedAt: row.finishedAt ?? null,
  });
}

export function towerRunToRow(run: TowerRun): typeof towerRuns.$inferInsert {
  return {
    id: run.id,
    trainerId: run.trainerId,
    difficulty: run.difficulty,
    length: run.length,
    seed: run.seed,
    status: run.status,
    floor: run.floor,
    party: run.party,
    offers: run.offers,
    rewards: run.rewards,
    room: run.room,
    picks: run.picks,
    rerolls: run.rerolls,
    rolls: run.rolls,
    log: run.log,
    challengeId: run.challengeId,
    lastResult: run.lastResult,
    cleared: run.cleared,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    finishedAt: run.finishedAt,
  };
}

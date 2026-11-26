import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speciesIdByName } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { TowerRunRepository } from '../domain/tower-run.repository.js';
import { TowerRun } from '../domain/tower-run.js';
import { TowerRecords } from './tower-records.js';

class MemoryRuns extends TowerRunRepository {
  readonly runs: TowerRun[] = [];
  all = () => this.runs;
  findById = (id: string) => this.runs.find((run) => run.id === id);
  save = (run: TowerRun) => void this.runs.push(run);
}

const charizard = speciesIdByName('Charizard') as number;
const roster: RosterEntry[] = [{ id: 'e1', finalID: charizard, baseID: charizard, rarity: 'common', shiny: false, level: 50, ivs: { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 } }];

function run(id: string, trainerId: string, abandonedAt: number | null): TowerRun {
  const climb = TowerRun.start({ id, trainerId, difficulty: 'mid', length: 25, roster, at: 0 });
  if (abandonedAt !== null) climb.abandon(abandonedAt);
  return climb;
}

test('the current climb is the open one of that trainer', () => {
  const memory = new MemoryRuns();
  memory.runs.push(run('old', 't1', 5), run('other', 't2', null), run('open', 't1', null));
  const records = new TowerRecords(memory);
  assert.equal(records.current('t1')?.id, 'open');
  assert.equal(records.current('t3'), undefined);
});

test('the last climb is the closed one that finished latest, the earliest saved on a tie', () => {
  const memory = new MemoryRuns();
  memory.runs.push(run('first', 't1', 5), run('latest', 't1', 9), run('tie', 't1', 9), run('open', 't1', null), run('other', 't2', 20));
  const records = new TowerRecords(memory);
  assert.equal(records.last('t1')?.id, 'latest');
  assert.equal(records.last('t3'), undefined);
});

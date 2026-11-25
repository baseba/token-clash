import { test } from 'node:test';
import assert from 'node:assert/strict';
import { variantKeys } from '../testing/workspace.js';

interface Case {
  family: string;
  variants: string[];
  removed: string[];
  keys: string[];
}

const fixture = (family: string, variants: string[], keys: string[], removed: string[] = []): Case => ({ family, variants, removed, keys });

const HEAD_AND_ITEMS = ['field-leak src::queue::ring::RunQueue::head', 'field-leak src::queue::ring::RunQueue::items'];

const KERNEL_CYCLE = 'module-cycle src::kernel::tasks,src::kernel::timers';

const TASKS_AND_TIMERS = 'tangle src::kernel::tasks::Tasks,src::kernel::timers::Timers';

const RING = `tangle ${['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].map((name) => `src::ring::${name}`).join(',')}`;

const STORE = ['shallow-module src::store'];

const POLICY_AND_REPORT = ['src/sched/policy.ts', 'src/sched/report.ts'];

const CASES: Case[] = [
  fixture('clean', [], []),
  fixture('field-leak', [], HEAD_AND_ITEMS),
  fixture('field-leak', ['getters'], HEAD_AND_ITEMS),
  fixture('field-leak', ['let-getters'], HEAD_AND_ITEMS),
  fixture('field-leak', ['all-pub'], HEAD_AND_ITEMS),
  fixture('field-leak', ['pasted'], HEAD_AND_ITEMS, POLICY_AND_REPORT),
  fixture('field-leak', ['tuple-getter'], HEAD_AND_ITEMS),
  fixture('field-leak', ['real'], []),
  fixture('field-leak', ['passed-on'], []),
  fixture('field-leak', ['read'], []),
  fixture('field-leak', ['lent-read'], []),
  fixture('module-cycle', [], ['module-cycle src::kinds,src::socket']),
  fixture('module-cycle', ['reexported'], ['module-cycle src::kinds,src::socket']),
  fixture('module-cycle', ['relayed'], ['module-cycle src::kinds,src::limits,src::socket']),
  fixture('module-cycle', ['moved'], []),
  fixture('module-cycle', ['moved', 'for-tests'], []),
  fixture('tangle', [], [KERNEL_CYCLE, TASKS_AND_TIMERS]),
  fixture('tangle', ['lifted'], ['tangle src::kernel::Tasks,src::kernel::timers::Timers'], ['src/kernel/tasks.ts']),
  fixture('tangle', ['merged'], [], ['src/kernel/tasks.ts', 'src/kernel/timers.ts']),
  fixture('tangle', ['real'], []),
  fixture('tangle', ['lifted-untied'], [], ['src/kernel/tasks.ts']),
  fixture('tangle', ['ring'], [KERNEL_CYCLE, TASKS_AND_TIMERS, RING]),
  fixture('shallow', [], STORE),
  fixture('shallow', ['padded'], STORE),
  fixture('shallow', ['pub-field'], STORE),
  fixture('shallow', ['private-modules'], STORE),
  fixture('shallow', ['some-free-functions'], STORE),
  fixture('shallow', ['free-functions'], STORE),
  fixture('shallow', ['deep'], []),
  fixture('small-types', [], []),
  fixture('two-contexts', [], []),
  fixture('two-contexts', ['vault', 'bump-plain'], []),
  fixture('two-contexts', ['vault', 'read-vault'], []),
  fixture('two-contexts', ['vault', 'bump-vault'], ['field-leak src::lib::vault::Vault::leaked']),
];

test('each fixture of the original, and each variant of it, reports the keys the original reports', () => {
  const found = CASES.map(({ family, variants, removed }) => ({ family, variants, removed, keys: variantKeys(family, variants, removed) }));
  assert.deepEqual(found, CASES);
});

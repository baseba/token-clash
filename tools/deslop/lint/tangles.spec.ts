import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../graph/graph.js';
import type { ItemId } from '../model/model.js';
import { Sample } from '../testing/sample.js';
import { keys as keysIn, runIn, variantKeys, workspace } from '../testing/workspace.js';
import { HELD_IN_MIND } from './report.js';
import { checkTangles } from './tangles.js';

const diagnose = (sample: Sample) => checkTangles(sample.model, buildGraph(sample.model), undefined);
const keys = (sample: Sample) => diagnose(sample).map((diagnostic) => diagnostic.key);

test('two things in a circle are reported when their code is in two modules', () => {
  const sample = new Sample();
  const kernel = sample.module('kernel');
  const timers = sample.module('kernel::timers');
  const tasks = sample.item(kernel, 'Tasks', 'type');
  const timer = sample.item(timers, 'Timers', 'type');
  const spawn = sample.member(tasks, kernel, 'Tasks::spawn', 'function');
  const fire = sample.member(timer, timers, 'Timers::fire', 'function');
  sample.refer(spawn, timer);
  sample.refer(fire, tasks);
  assert.deepEqual(keys(sample), ['p::kernel::Tasks,p::kernel::timers::Timers']);
});

test('a circle in one module is reported only when it is too big to hold in mind', () => {
  const sample = new Sample();
  const module = sample.module('ring');
  const ring = (size: number) => {
    const things: ItemId[] = Array.from({ length: size }, (_unused, index) => sample.item(module, `T${size}x${index}`, 'type'));
    things.forEach((thing, index) => sample.refer(thing, things[(index + 1) % size]));
  };
  ring(HELD_IN_MIND);
  assert.deepEqual(keys(sample), []);
  ring(HELD_IN_MIND + 1);
  const diagnostics = diagnose(sample);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].message, '8 things know each other in a circle, all in `p::ring`');
});

test('the picture is the shortest circle through the cheapest tie', () => {
  const sample = new Sample();
  const firstModule = sample.module('a');
  const secondModule = sample.module('b');
  const first = sample.item(firstModule, 'A', 'type');
  const firstMethod = sample.member(first, firstModule, 'A::x', 'function');
  const second = sample.item(secondModule, 'B', 'type');
  const run = sample.member(second, secondModule, 'B::run', 'function');
  const third = sample.item(secondModule, 'C', 'type');
  sample.refer(first, second);
  sample.refer(run, third);
  sample.refer(third, first);
  sample.refer(run, first);
  sample.refer(run, firstMethod);
  const picture = diagnose(sample)[0].picture;
  assert.ok(picture.kind === 'circle');
  assert.deepEqual(
    picture.steps.map((step) => [step.member, step.uses]),
    [
      ['p::a::A', 'A uses B'],
      ['p::b::B', 'B::run uses A::{self, x}'],
    ],
  );
  assert.equal(picture.rest, 'not drawn: 1 more thing, 2 more ties');
});

test('a method written elsewhere ties its type from there', () => {
  const sample = new Sample();
  const scheduling = sample.module('scheduling');
  const elsewhere = sample.module('elsewhere');
  const tasks = sample.item(scheduling, 'Tasks', 'type');
  const timers = sample.item(scheduling, 'Timers', 'type');
  const spawn = sample.member(tasks, scheduling, 'Tasks::spawn', 'function');
  const fire = sample.member(timers, elsewhere, 'Timers::fire', 'function');
  sample.refer(spawn, timers);
  sample.refer(fire, tasks);
  const diagnostics = diagnose(sample);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].message, '2 things know each other in a circle, across 2 modules');
  assert.equal(diagnostics[0].notes[1], 'written in: p::elsewhere, p::scheduling');
});

test('a tie written in two modules is shown in both', () => {
  const sample = new Sample();
  const tail = sample.module('tail');
  const writer = sample.module('writer');
  const walTail = sample.item(tail, 'WalTail', 'type');
  const scanned = sample.item(tail, 'Scanned', 'type');
  const scanBytes = sample.member(walTail, tail, 'WalTail::scanBytes', 'function');
  const scanFile = sample.member(walTail, writer, 'WalTail::scanFile', 'function');
  const records = sample.member(scanned, tail, 'Scanned::records', 'field');
  sample.refer(scanBytes, scanned);
  sample.refer(scanFile, records);
  sample.refer(scanned, walTail);
  const notes = diagnose(sample)[0].notes;
  assert.equal(notes[1], 'written in: p::tail, p::writer');
  assert.ok(notes[3].endsWith('; also at src/writer.ts:2:1'), notes[3]);
});

test('a tangle stays one however it is laid out until it is one module or untied', () => {
  const tasksAndTimers = 'tangle src::kernel::tasks::Tasks,src::kernel::timers::Timers';
  const cycle = 'module-cycle src::kernel::tasks,src::kernel::timers';
  const boot = runIn(workspace('tangle'));
  assert.equal(boot.code, 1);
  assert.ok(boot.stdout.includes('error[tangle]: 2 things know each other in a circle, across 2 modules\n  --> src/kernel/tasks.ts:15:1\n'), boot.stdout);
  const picture = [
    '    ┌─▶ src::kernel::tasks::Tasks',
    '    │     ┃ tasks.ts:15   Tasks::spawn uses Timers::{self, arm}',
    '    │     ▼',
    '    │   src::kernel::timers::Timers',
    '    │     │ timers.ts:14  Timers::fire uses Tasks::{self, wake}',
    '    └─────┘',
    '',
  ];
  assert.ok(boot.stdout.includes(picture.join('\n')), boot.stdout);
  assert.ok(boot.stdout.includes('error[module-cycle]: 2 modules in `src::kernel` use each other in a circle'), boot.stdout);
  assert.deepEqual(variantKeys('tangle', ['lifted'], ['src/kernel/tasks.ts']), ['tangle src::kernel::Tasks,src::kernel::timers::Timers']);
  assert.deepEqual(variantKeys('tangle', ['merged'], ['src/kernel/tasks.ts', 'src/kernel/timers.ts']), []);
  assert.deepEqual(variantKeys('tangle', ['real']), []);
  assert.deepEqual(variantKeys('tangle', ['lifted-untied'], ['src/kernel/tasks.ts']), []);
  const ring = workspace('tangle', ['ring']);
  assert.ok(runIn(ring).stdout.includes('error[tangle]: 8 things know each other in a circle, all in `src::ring`'));
  const ringKey = `tangle ${['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'].map((name) => `src::ring::${name}`).join(',')}`;
  assert.deepEqual(keysIn(ring), [cycle, tasksAndTimers, ringKey]);
});

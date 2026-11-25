import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { Sample } from '../testing/sample.js';
import { keys as keysIn, runIn, variantKeys, workspace } from '../testing/workspace.js';
import { checkCycles } from './cycles.js';

const keys = (sample: Sample) => checkCycles(sample.model, undefined).map((diagnostic) => diagnostic.key);

test('siblings that use each other are a circle though no two things are', () => {
  const sample = new Sample();
  const socket = sample.module('socket');
  const kinds = sample.module('kinds');
  const open = sample.item(socket, 'open', 'function');
  const limit = sample.item(socket, 'LIMIT', 'constant');
  const stream = sample.item(kinds, 'Stream', 'type');
  const fits = sample.item(kinds, 'fits', 'function');
  sample.refer(open, stream);
  assert.deepEqual(keys(sample), []);
  sample.refer(fits, limit);
  const diagnostics = checkCycles(sample.model, undefined);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].key, 'p::kinds,p::socket');
  assert.equal(diagnostics[0].message, '2 modules in `p` use each other in a circle');
  assert.deepEqual(diagnostics[0].notes, [
    'members: kinds, socket',
    'src/kinds.ts:2:1: `kinds` uses `socket` by 1 item: LIMIT',
    'src/socket.ts:1:1: `socket` uses `kinds` by 1 item: Stream',
  ]);
  assert.deepEqual(diagnostics[0].picture, {
    kind: 'circle',
    steps: [
      { member: 'kinds', site: { file: 'src/kinds.ts', line: 2 }, uses: 'fits uses LIMIT' },
      { member: 'socket', site: { file: 'src/socket.ts', line: 1 }, uses: 'open uses Stream' },
    ],
    rest: undefined,
  });
});

test('a circle is between the children of the module that holds it', () => {
  const sample = new Sample();
  const epoll = sample.module('kinds::epoll');
  const address = sample.module('socket::address');
  const wait = sample.item(epoll, 'wait', 'function');
  const parse = sample.item(address, 'parse', 'function');
  sample.refer(wait, parse);
  sample.refer(parse, wait);
  assert.deepEqual(keys(sample), ['p::kinds,p::socket']);
});

test('a module and what is inside it make no circle', () => {
  const sample = new Sample();
  const kinds = sample.module('kinds');
  const epoll = sample.module('kinds::epoll');
  const kind = sample.item(kinds, 'Kind', 'type');
  const wait = sample.item(epoll, 'wait', 'function');
  const poll = sample.item(kinds, 'poll', 'function');
  sample.refer(wait, kind);
  sample.refer(poll, wait);
  assert.deepEqual(keys(sample), []);
});

test('a method counts where it is written', () => {
  const sample = new Sample();
  const tasks = sample.module('tasks');
  const timers = sample.module('timers');
  const task = sample.item(tasks, 'Tasks', 'type');
  const timer = sample.item(timers, 'Timers', 'type');
  const fire = sample.member(timer, timers, 'Timers::fire', 'function');
  sample.refer(fire, task);
  const spawnElsewhere = sample.member(task, timers, 'Tasks::spawn', 'function');
  sample.refer(spawnElsewhere, timer);
  assert.deepEqual(keys(sample), []);
  const spawn = sample.member(task, tasks, 'Tasks::spawn', 'function');
  sample.refer(spawn, timer);
  assert.deepEqual(keys(sample), ['p::tasks,p::timers']);
});

test('a circle concerns a scope that holds one of its members', () => {
  const sample = new Sample();
  const socket = sample.module('socket');
  const kinds = sample.module('kinds');
  const other = sample.module('other');
  const open = sample.item(socket, 'open', 'function');
  const fits = sample.item(kinds, 'fits', 'function');
  sample.refer(open, fits);
  sample.refer(fits, open);
  assert.equal(checkCycles(sample.model, kinds).length, 1);
  assert.equal(checkCycles(sample.model, other).length, 0);
});

test('a module cycle stays one through a re-export or a relay until code moves where it is used', () => {
  const net = runIn(workspace('module-cycle'));
  assert.equal(net.code, 1);
  assert.ok(net.stdout.includes('error[module-cycle]: 2 modules in `src` use each other in a circle\n  --> src/kinds.ts:8:1\n'), net.stdout);
  assert.ok(!net.stdout.includes('error[tangle]'), net.stdout);
  const picture = [
    '    ┌─▶ kinds',
    '    │     ┃ kinds.ts:8   Stream::constructor uses BACKLOG_MOST',
    '    │     ▼',
    '    │   socket',
    '    │     │ socket.ts:5  listen uses Stream::{self, constructor}',
    '    └─────┘',
    '',
  ];
  assert.ok(net.stdout.includes(picture.join('\n')), net.stdout);
  assert.deepEqual(variantKeys('module-cycle', ['reexported']), ['module-cycle src::kinds,src::socket']);
  assert.deepEqual(variantKeys('module-cycle', ['relayed']), ['module-cycle src::kinds,src::limits,src::socket']);
  assert.deepEqual(variantKeys('module-cycle', ['moved']), []);
});

test('a spec file is test code and makes no circle, and the same code in a file of its module does', () => {
  const directory = workspace('module-cycle', ['moved', 'for-tests']);
  assert.deepEqual(keysIn(directory), []);
  renameSync(join(directory, 'src/kinds/harness.spec.ts'), join(directory, 'src/kinds/harness.ts'));
  assert.deepEqual(keysIn(directory), ['module-cycle src::kinds,src::socket']);
});

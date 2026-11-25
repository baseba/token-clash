import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heldBy, modelOf } from '../../testing/models.js';
import type { Model } from '../model.js';

function heldByNoOne(model: Model): string[] {
  return model.references.filter((reference) => reference.holder === undefined).map((reference) => model.items[reference.item].name);
}

const TASK = 'export interface Task {\n  id: number;\n  asleep: boolean;\n}\n';

const TASK_USER = `import type { Task } from './task.js';

export function make(id: number): Task {
  return { id, asleep: true };
}

export function wake(tasks: Task[]): number[] {
  return tasks.map(({ id, asleep: wasAsleep }) => (wasAsleep ? id : 0));
}

export function quoted(task: Task): Task {
  const { 'asleep': wasAsleep } = task;
  return { 'id': task['id'], asleep: !wasAsleep };
}

export function keyed(task: Task, key: 'id'): number {
  return task[key];
}
`;

const TASK_TAKER = `import type { Task } from './task.js';

export function reassigned(task: Task): number {
  let id = 0;
  ({ id } = task);
  return id;
}

export function renamed(task: Task): boolean {
  let wasAsleep = false;
  ({ asleep: wasAsleep } = task);
  return wasAsleep;
}

export function nested(tasks: Task[], other: Task): number {
  let id = 0;
  [{ id }] = tasks;
  for ({ id } of tasks) ({ id = 1 } = other);
  return id;
}

export function built(id: number): { id: number } {
  return { id };
}

export function quotedLater(task: Task): boolean {
  let wasAsleep = false;
  ({ 'asleep': wasAsleep } = task);
  return wasAsleep;
}

export function quotedDeep(tasks: Task[], holder: { task: Task }): number {
  let id = 0;
  [{ 'id': id }] = tasks;
  for ({ 'id': id } of tasks) ({ task: { 'id': id } } = holder);
  return id;
}

export function rested(task: Task): unknown {
  let rest = {};
  ({ ...rest } = task);
  return rest;
}
`;

const NEST = 'export function Module(_options: { providers: unknown[] }) {\n  return (_target: unknown, _context: unknown): void => undefined;\n}\n';

const STORE = 'export class Store {\n  list(): number[] {\n    return [];\n  }\n}\n';

const SERVICE = `import { Module } from './nest.js';
import { Store } from './store.js';

export class Service {
  constructor(private readonly store: Store) {}

  count(): number {
    return this.store.list().length;
  }
}

@Module({ providers: [Service, Store] })
export class AppModule {}
`;

const THINGS = `export class Bare {}

export class Built {
  constructor(readonly size: number) {}
}

export class Grown extends Built {
  constructor() {
    super(2);
  }
}
`;

const THINGS_USER = `import { Bare, Built } from './things.js';

export function bare(): Bare {
  return new Bare();
}

export function built(): Built {
  return new Built(1);
}
`;

const HERITAGE = `export interface Closable {
  close(): void;
}

export interface Lockable extends Closable {
  lock(): void;
}

export class Box<Held> {
  held: Held | undefined;
}

export class Safe extends Box<Closable> implements Lockable {
  close(): void {
    this.held = undefined;
  }

  lock(): void {
    this.held?.close();
  }
}

export function sealed(): unknown {
  return class extends Safe {};
}
`;

const QUEUE = `export class Queue {
  private start = 0;

  get head(): number {
    return this.start;
  }

  set head(head: number) {
    this.start = head;
  }
}
`;

const QUEUE_USER = `import type { Queue } from './queue.js';

export function read(queue: Queue): number {
  return queue.head;
}

export function taken(queue: Queue): number {
  const { head } = queue;
  return head;
}

export function write(queue: Queue): void {
  queue.head = 5;
}

export function bump(queue: Queue): void {
  queue.head += 1;
}
`;

const TASK_KEYS = `import type { Task } from './task.js';

const KEY = 'id';

export function computed(task: Task): number {
  const { ['id']: taken } = task;
  return taken;
}

export function assigned(task: Task): number {
  let taken = 0;
  ({ ['id']: taken } = task);
  return taken;
}

export function constant(task: Task): number {
  return task[KEY];
}

export function dotted(task: Task): number {
  return task.id;
}
`;

test('a field named by a computed key, or by a constant that holds its name, is no use of that field', () => {
  const model = modelOf({ 'src/task.ts': TASK, 'src/user.ts': TASK_KEYS });
  assert.deepEqual(heldBy(model, 'computed'), ['Task']);
  assert.deepEqual(heldBy(model, 'assigned'), ['Task']);
  assert.deepEqual(heldBy(model, 'constant'), ['KEY', 'Task']);
  assert.deepEqual(heldBy(model, 'dotted'), ['Task', 'Task::id']);
});

test('a field given in an object literal or taken in a destructuring is a use of that field', () => {
  const model = modelOf({ 'src/task.ts': TASK, 'src/user.ts': TASK_USER });
  assert.deepEqual(heldBy(model, 'make'), ['Task', 'Task::asleep', 'Task::id']);
  assert.deepEqual(heldBy(model, 'wake'), ['Task', 'Task::asleep', 'Task::id']);
});

test('a field taken by a destructuring assignment is a use of that field, however deep the pattern is', () => {
  const model = modelOf({ 'src/task.ts': TASK, 'src/user.ts': TASK_TAKER });
  assert.deepEqual(heldBy(model, 'reassigned'), ['Task', 'Task::id']);
  assert.deepEqual(heldBy(model, 'renamed'), ['Task', 'Task::asleep']);
  assert.deepEqual(heldBy(model, 'built'), []);
  const ofNested = model.references.filter((reference) => reference.holder !== undefined && model.items[reference.holder].name === 'nested');
  assert.deepEqual(
    ofNested.map((reference) => [model.items[reference.item].name, reference.line]),
    [
      ['Task', 15],
      ['Task', 15],
      ['Task::id', 17],
      ['Task::id', 18],
      ['Task::id', 18],
    ],
  );
});

test('a field a destructuring assignment takes by a string is a use of that field, and the rest it takes names no field', () => {
  const model = modelOf({ 'src/task.ts': TASK, 'src/user.ts': TASK_TAKER });
  assert.deepEqual(heldBy(model, 'quotedLater'), ['Task', 'Task::asleep']);
  assert.deepEqual(heldBy(model, 'rested'), ['Task']);
  const ofDeep = model.references.filter((reference) => reference.holder !== undefined && model.items[reference.holder].name === 'quotedDeep');
  assert.deepEqual(
    ofDeep.map((reference) => [model.items[reference.item].name, reference.line]),
    [
      ['Task', 32],
      ['Task', 32],
      ['Task::id', 34],
      ['Task::id', 35],
      ['Task::id', 35],
    ],
  );
});

test('a field named by a string is a use of that field, and one named by a value that is worked out is not', () => {
  const model = modelOf({ 'src/task.ts': TASK, 'src/user.ts': TASK_USER });
  assert.deepEqual(heldBy(model, 'quoted'), ['Task', 'Task::asleep', 'Task::id']);
  assert.deepEqual(heldBy(model, 'keyed'), ['Task']);
  const ofQuoted = model.references.filter((reference) => reference.holder !== undefined && model.items[reference.holder].name === 'quoted');
  assert.deepEqual(
    ofQuoted.map((reference) => [model.items[reference.item].name, reference.line]),
    [
      ['Task', 11],
      ['Task', 11],
      ['Task::asleep', 12],
      ['Task::id', 13],
      ['Task::id', 13],
      ['Task::asleep', 13],
    ],
  );
});

test('what a class is given by injection is a field that knows its type, and a decorator is held by what it decorates', () => {
  const model = modelOf({ 'src/store.ts': STORE, 'src/nest.ts': NEST, 'src/service.ts': SERVICE });
  assert.deepEqual(heldBy(model, 'Service::store'), ['Store']);
  assert.deepEqual(heldBy(model, 'Service::constructor'), []);
  assert.deepEqual(heldBy(model, 'Service::count'), ['Service::store', 'Store::list']);
  assert.deepEqual(heldBy(model, 'AppModule'), ['Module', 'Service', 'Store']);
});

test('new names the class and the constructor it declares', () => {
  const model = modelOf({ 'src/things.ts': THINGS, 'src/user.ts': THINGS_USER });
  assert.deepEqual(heldBy(model, 'bare'), ['Bare']);
  assert.deepEqual(heldBy(model, 'built'), ['Built', 'Built::constructor']);
  assert.deepEqual(heldBy(model, 'Grown::constructor'), ['Built::constructor']);
  assert.deepEqual(heldBy(model, 'Grown'), []);
});

test('what a class extends or implements is held by no one, and what an interface extends is held by the interface', () => {
  const model = modelOf({ 'src/heritage.ts': HERITAGE });
  assert.deepEqual(heldByNoOne(model), ['Box', 'Closable', 'Lockable']);
  assert.deepEqual(heldBy(model, 'Safe'), []);
  assert.deepEqual(heldBy(model, 'Lockable'), ['Closable']);
  assert.deepEqual(heldBy(model, 'sealed'), ['Safe']);
});

test('a read names the getter, a write the setter, and a write that reads first names both', () => {
  const model = modelOf({ 'src/queue.ts': QUEUE, 'src/user.ts': QUEUE_USER });
  assert.deepEqual(heldBy(model, 'read'), ['Queue', 'Queue::head']);
  assert.deepEqual(heldBy(model, 'taken'), ['Queue', 'Queue::head']);
  assert.deepEqual(heldBy(model, 'write'), ['Queue', 'Queue::set head']);
  assert.deepEqual(heldBy(model, 'bump'), ['Queue', 'Queue::head', 'Queue::set head']);
});

test('a name exported as the default is a use, and a value worked out to be the default names what it is made of', () => {
  const named = modelOf({ 'src/limit.ts': 'const LIMIT = 4;\n\nexport default LIMIT;\n' });
  assert.deepEqual(named.references, []);
  const made = modelOf({ 'src/limit.ts': 'const LIMIT = 4;\n\nexport default { most: LIMIT };\n' });
  assert.deepEqual(heldByNoOne(made), ['LIMIT']);
});

test('a member of a namespace exported as the default is a use, and a field of a value exported as the default names the field', () => {
  const kinds = 'export enum Kind {\n  Ring,\n}\n\nexport interface Box {\n  size: number;\n}\n';
  const member = modelOf({ 'src/kinds.ts': kinds, 'src/ring.ts': "import { Kind } from './kinds.js';\n\nexport default Kind.Ring;\n" });
  assert.deepEqual(member.references, []);
  const boxed = "import type { Box } from './kinds.js';\n\ndeclare const box: Box;\n\nexport default box.size;\n";
  assert.deepEqual(heldByNoOne(modelOf({ 'src/kinds.ts': kinds, 'src/size.ts': boxed })), ['box', 'Box::size']);
});

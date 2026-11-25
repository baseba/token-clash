import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Sample } from '../testing/sample.js';
import { buildGraph } from './graph.js';

test('a method written anywhere is part of its type and things that use each other are a tangle', () => {
  const sample = new Sample();
  const first = sample.module('a');
  const second = sample.module('b');
  const tasks = sample.item(first, 'Tasks', 'type');
  const timers = sample.item(second, 'Timers', 'type');
  const fire = sample.member(timers, first, 'Timers::fire', 'function');
  const spawn = sample.member(tasks, first, 'Tasks::spawn', 'function');
  sample.refer(fire, tasks);
  sample.refer(spawn, timers);
  const graph = buildGraph(sample.model);
  const ofFire = graph.thingOf[fire];
  assert.ok(ofFire !== undefined);
  assert.equal(graph.things[ofFire].item, timers);
  assert.equal(graph.things[ofFire].home, second);
  assert.equal(graph.tangles.length, 1);
  assert.equal(graph.tangles[0].length, 2);
});

test('a use of a wrapper is a use of what is behind it and its own body is no use', () => {
  const sample = new Sample();
  const first = sample.module('a');
  const second = sample.module('b');
  const queue = sample.item(first, 'Queue', 'type');
  const inner = sample.item(first, 'Inner', 'type');
  const items = sample.member(inner, first, 'Inner::items', 'field');
  const field = sample.member(queue, first, 'Queue::inner', 'field');
  const getter = sample.member(inner, first, 'Inner::items', 'function');
  const forwarder = sample.member(queue, first, 'Queue::items', 'function');
  sample.model.wrappers.set(getter, { kind: 'accessor', lent: [items], copied: [] });
  sample.model.wrappers.set(forwarder, { kind: 'forwarder', target: getter, fields: [field] });
  sample.refer(getter, items);
  sample.refer(forwarder, field);
  sample.refer(forwarder, getter);
  const report = sample.item(second, 'report', 'function');
  sample.refer(report, forwarder);
  const graph = buildGraph(sample.model);
  assert.deepEqual(
    graph.uses.map((use) => [use.item, use.through]),
    [
      [field, forwarder],
      [items, forwarder],
    ],
  );
  assert.ok(graph.uses.every((use) => use.user === graph.thingOf[report]));
});

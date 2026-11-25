import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeId } from '../model/tree.js';
import { Sample } from '../testing/sample.js';
import { check, resolveNode } from './check.js';

const FILLERS = [...'bcdefghijklmno'];

function indebted(): Sample {
  const sample = new Sample();
  const zebra = sample.module('zebra');
  const apple = sample.module('apple');
  const stripes = sample.item(zebra, 'Stripes', 'type');
  const core = sample.item(apple, 'Core', 'type');
  sample.refer(stripes, core);
  sample.refer(core, stripes);
  const queue = sample.item(zebra, 'Queue', 'type');
  const [head, tail, limit] = ['head', 'Tail', 'limit'].map((field) => sample.member(queue, zebra, `Queue::${field}`, 'field'));
  const full = sample.member(queue, zebra, 'Queue::full', 'function');
  sample.model.items[full].takesSelf = true;
  for (const field of [head, tail, limit]) sample.refer(full, field);
  const admit = sample.item(apple, 'admit', 'function');
  sample.refer(admit, head);
  sample.refer(admit, tail);
  for (const file of sample.model.files) file.lines = 2_001;
  for (const name of FILLERS) sample.module(name);
  return sample;
}

const keys = (sample: Sample, scope: NodeId | undefined) => check(sample.model, scope).map((diagnostic) => `${diagnostic.lint} ${diagnostic.key}`);

test('diagnostics come out lint by lint in the order the lints are listed, and by key within a lint, capitals first', () => {
  assert.deepEqual(keys(indebted(), undefined), [
    'module-cycle p::apple,p::zebra',
    'tangle p::apple::Core,p::zebra::Stripes',
    'field-leak p::zebra::Queue::Tail',
    'field-leak p::zebra::Queue::head',
    'wide-directory src/',
    'long-file src/apple.ts',
    'long-file src/zebra.ts',
  ]);
});

test('a scope keeps the order and leaves out what does not concern it', () => {
  const sample = indebted();
  const filler = resolveNode(sample.model, 'p::b');
  assert.ok(filler !== undefined);
  assert.deepEqual(keys(sample, filler), ['wide-directory src/']);
  const apple = resolveNode(sample.model, 'p::apple');
  assert.ok(apple !== undefined);
  assert.deepEqual(keys(sample, apple), [
    'module-cycle p::apple,p::zebra',
    'tangle p::apple::Core,p::zebra::Stripes',
    'field-leak p::zebra::Queue::Tail',
    'field-leak p::zebra::Queue::head',
    'wide-directory src/',
    'long-file src/apple.ts',
  ]);
});

test('a scope is found by the whole name its module is shown with', () => {
  const sample = indebted();
  const tree = sample.model.tree;
  assert.equal(resolveNode(sample.model, 'p'), tree.root());
  assert.equal(resolveNode(sample.model, 'p::zebra'), tree.child(tree.root(), 'zebra'));
  assert.equal(resolveNode(sample.model, 'zebra'), undefined);
  assert.equal(resolveNode(sample.model, 'p::nowhere'), undefined);
});

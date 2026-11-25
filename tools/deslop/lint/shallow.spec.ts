import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../graph/graph.js';
import type { ItemId } from '../model/model.js';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Sample } from '../testing/sample.js';
import { keys as keysIn, runIn, variantKeys, workspace } from '../testing/workspace.js';
import { checkShallow } from './shallow.js';

function store(shown: number, hidden: number): Sample {
  const sample = new Sample();
  const storeModule = sample.module('store');
  const app = sample.module('app');
  sample.module('store::table');
  const type = sample.item(storeModule, 'Store', 'type');
  const run = sample.item(app, 'run', 'function');
  const helpers = Array.from({ length: hidden }, (_unused, index) => sample.member(type, storeModule, `Store::helper${index}`, 'function'));
  for (let i = 0; i < shown; i += 1) {
    const method = sample.member(type, storeModule, `Store::m${i}`, 'function');
    sample.refer(run, method);
    for (const helper of helpers) sample.refer(method, helper);
  }
  return sample;
}

function things(widths: number[], free: number): Sample {
  const sample = new Sample();
  const storeModule = sample.module('store');
  const app = sample.module('app');
  sample.module('store::table');
  const run = sample.item(app, 'run', 'function');
  widths.forEach((width, index) => {
    const type = sample.item(storeModule, `T${index}`, 'type');
    for (let i = 0; i < width; i += 1) sample.refer(run, sample.member(type, storeModule, `T${index}::m${i}`, 'function'));
  });
  for (let i = 0; i < free; i += 1) sample.refer(run, sample.item(storeModule, `f${i}`, 'function'));
  return sample;
}

const named = (sample: Sample, name: string) => sample.model.items.findIndex((item) => item.name === name) as ItemId;

function knowing(sample: Sample, name: string, types: string[]): void {
  const made = sample.item(sample.module('store'), name, 'function');
  sample.refer(named(sample, 'run'), made);
  for (const type of types) sample.refer(made, named(sample, type));
}

const diagnose = (sample: Sample) => checkShallow(sample.model, buildGraph(sample.model), undefined);
const keys = (sample: Sample) => diagnose(sample).map((diagnostic) => diagnostic.key);

function notes(sample: Sample): string[] {
  const diagnostics = diagnose(sample);
  assert.equal(diagnostics.length, 1);
  return diagnostics[0].notes;
}

test('a module that shows more than it hides and more than seven is shallow', () => {
  assert.deepEqual(keys(store(8, 8)), ['p::store']);
  assert.deepEqual(diagnose(store(8, 8))[0].picture, { kind: 'lists', shown: 8, hidden: 8, lists: [{ name: 'Store', length: 8 }] });
  assert.equal(diagnose(store(8, 8))[0].message, '`p::store` is shallow: it shows 8 of its 16 functions');
  assert.deepEqual(diagnose(store(8, 8))[0].location, { file: 'src/store.ts', line: 1 });
  assert.deepEqual(keys(store(8, 9)), []);
  assert.deepEqual(keys(store(7, 0)), []);
});

function passedThrough(): Sample {
  const sample = new Sample();
  const domain = sample.module('catalog::domain');
  sample.module('catalog::domain::species');
  const run = sample.item(sample.module('app'), 'run', 'function');
  const type = sample.item(domain, 'Species', 'type');
  for (let i = 0; i < 8; i += 1) sample.refer(run, sample.member(type, domain, `Species::m${i}`, 'function'));
  return sample;
}

test('a module that shows what a module inside it shows, and has no more functions, is reported once, at the module inside', () => {
  assert.deepEqual(keys(passedThrough()), ['p::catalog::domain']);
});

test('a module that hides a function of its own, or shows one more, is reported beside the shallow module inside it', () => {
  const hiding = passedThrough();
  const helper = hiding.item(hiding.module('catalog::data'), 'load', 'function');
  hiding.refer(named(hiding, 'Species::m0'), helper);
  assert.deepEqual(keys(hiding), ['p::catalog', 'p::catalog::domain']);
  assert.equal(diagnose(hiding)[0].message, '`p::catalog` is shallow: it shows 8 of its 9 functions');
  const showing = passedThrough();
  showing.refer(named(showing, 'run'), showing.item(showing.module('catalog::data'), 'load', 'function'));
  assert.deepEqual(keys(showing), ['p::catalog', 'p::catalog::domain']);
  assert.equal(diagnose(showing)[0].message, '`p::catalog` is shallow: it shows 9 of its 9 functions');
});

test('seven is a limit on each list, not on their sum', () => {
  assert.deepEqual(keys(things([5, 5, 5], 0)), []);
  assert.deepEqual(keys(things([5, 4, 3], 1)), []);
  assert.deepEqual(keys(things([7, 7, 7, 7, 7, 7, 7], 0)), []);
  assert.deepEqual(keys(things([], 7)), []);
  assert.deepEqual(keys(things([], 8)), ['p::store']);
  assert.deepEqual(keys(things([8], 0)), ['p::store']);
});

test('the notes name each list that is too long, the things first, then the widest', () => {
  assert.deepEqual(notes(things([2, 8], 5)), ['`T1` shows 8 functions: T1::m0, T1::m1, T1::m2, T1::m3, T1::m4, T1::m5, T1::m6, +1 more']);
  assert.deepEqual(notes(things([8, 9, 9], 5)), [
    'shows 8 things: T1, T2, T0, f0, f1, f2, f3, +1 more',
    '`T1` shows 9 functions: T1::m0, T1::m1, T1::m2, T1::m3, T1::m4, T1::m5, T1::m6, +2 more',
    '`T2` shows 9 functions: T2::m0, T2::m1, T2::m2, T2::m3, T2::m4, T2::m5, T2::m6, +2 more',
    '`T0` shows 8 functions: T0::m0, T0::m1, T0::m2, T0::m3, T0::m4, T0::m5, T0::m6, +1 more',
  ]);
  assert.deepEqual(notes(things([1], 7)), ['shows 8 things: T0, f0, f1, f2, f3, f4, f5, +1 more']);
});

test('a free function is on the list of each type of the module it knows', () => {
  const one = things([6], 0);
  knowing(one, 'fa', ['T0']);
  knowing(one, 'fb', ['T0']);
  assert.deepEqual(keys(one), ['p::store']);
  assert.deepEqual(keys(things([6], 2)), []);
  const two = things([6, 6], 0);
  knowing(two, 'both', ['T0', 'T1']);
  knowing(two, 'first', ['T0']);
  knowing(two, 'second', ['T1']);
  assert.deepEqual(notes(two), [
    '`T0` shows 8 functions: T0::m0, T0::m1, T0::m2, T0::m3, T0::m4, T0::m5, both, +1 more',
    '`T1` shows 8 functions: T1::m0, T1::m1, T1::m2, T1::m3, T1::m4, T1::m5, both, +1 more',
  ]);
});

test('a free function that knows no type of the module is a thing of its own', () => {
  const sample = things([], 7);
  sample.item(sample.module('app'), 'Outside', 'type');
  knowing(sample, 'e', ['Outside']);
  assert.deepEqual(notes(sample), ['shows 8 things: e, f0, f1, f2, f3, f4, f5, +1 more']);
});

test('lists that share a free function never make a module shallow that shows seven', () => {
  const sample = things([0, 0, 0, 0, 0, 0, 0, 0], 0);
  knowing(sample, 'build', ['T0', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']);
  assert.deepEqual(keys(sample), []);
});

test('wrappers count for nothing and a method counts at the home of its type', () => {
  const sample = store(8, 8);
  const type = named(sample, 'Store');
  for (let i = 0; i < 8; i += 1) {
    const forwarder = sample.member(type, sample.module('store'), `Store::pad${i}`, 'function');
    sample.model.wrappers.set(forwarder, { kind: 'forwarder', target: named(sample, 'Store::helper1'), fields: [] });
  }
  const moved = sample.member(type, sample.module('app'), 'Store::moved', 'function');
  sample.refer(named(sample, 'run'), moved);
  assert.equal(diagnose(sample)[0].message, '`p::store` is shallow: it shows 9 of its 17 functions');
});

test('a function of an interface a class implements is not one the module shows', () => {
  const sample = store(8, 8);
  for (let i = 0; i < 8; i += 1) sample.model.items[named(sample, `Store::m${i}`)].traitImpl = true;
  assert.deepEqual(keys(sample), []);
});

const STORE_SHOWS = 'Store::constructor, Store::contains, Store::get, Store::insert, Store::isFull, Store::largest, Store::remove';

test('a shallow module stays shallow however it is dressed until it does more with less', () => {
  const store = runIn(workspace('shallow'));
  assert.equal(store.code, 1);
  const report = [
    'error[shallow-module]: `src::store` is shallow: it shows 9 of its 15 functions',
    '  --> src/store.ts:1:1',
    `  = note: \`Store\` shows 9 functions: ${STORE_SHOWS}, +2 more`,
    '                  7',
    '    shows  ███████│██ 9',
    '    hides  ██████ │ 6',
    '    Store  ███████│██ 9',
    '',
  ];
  assert.ok(store.stdout.includes(report.join('\n')), store.stdout);
  for (const variant of ['padded', 'pub-field', 'private-modules', 'some-free-functions', 'free-functions']) {
    assert.deepEqual(variantKeys('shallow', [variant]), ['shallow-module src::store'], variant);
  }
  const free = runIn(workspace('shallow', ['free-functions']));
  const shows = '= note: `Store` shows 9 functions: Store::constructor, contains, get, insert, isFull, largest, remove, +2 more';
  assert.ok(free.stdout.includes(shows), free.stdout);
  const padded = runIn(workspace('shallow', ['padded']));
  assert.ok(padded.stdout.includes('`src::store` is shallow: it shows 9 of its 17 functions'), padded.stdout);
  assert.deepEqual(variantKeys('shallow', ['deep']), []);
});

test('small types that each show a few functions are not shallow however many they show in all', () => {
  const stats = runIn(workspace('small-types'));
  assert.ok(stats.stdout.includes('deslop-please: ok'), stats.stdout);
  assert.equal(stats.code, 0);
});

test('a file with no directory of its own is not judged, and spec files beside it do not make it a parent', () => {
  const directory = workspace('clean');
  const names = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'];
  writeFileSync(join(directory, 'src/queue.ts'), names.map((name, index) => `export function ${name}(): number {\n  return ${index + 1};\n}\n`).join('\n'));
  const sum = names.map((name) => `${name}()`).join(' + ');
  writeFileSync(join(directory, 'src/index.ts'), `import { ${names.join(', ')} } from './queue.js';\n\nexport function run(): number {\n  return ${sum};\n}\n`);
  assert.deepEqual(keysIn(directory), []);
  writeFileSync(join(directory, 'src/queue.spec.ts'), "import { f1 } from './queue.js';\n\nexport const expected = f1();\n");
  assert.deepEqual(keysIn(directory), []);
  writeFileSync(join(directory, 'src/queue.spec.ts'), `export const expected = 36;\n${'\n'.repeat(2_000)}`);
  assert.deepEqual(keysIn(directory), []);
});

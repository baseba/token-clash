import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { NodeId } from '../model/tree.js';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Sample } from '../testing/sample.js';
import { keys as keysIn, runIn, workspace } from '../testing/workspace.js';
import { checkLayout, holders } from './layout.js';

const letters = (count: number) => [...'abcdefghijklmnopqrstuvwxyz'].slice(0, count);

function packageP(): Sample {
  const sample = new Sample();
  sample.file(sample.model.tree.root(), 'src/app.module.ts', 1);
  return sample;
}

const keys = (sample: Sample, scope: NodeId | undefined) => checkLayout(sample.model, scope).map((diagnostic) => `${diagnostic.lint} ${diagnostic.key}`);

test('a directory of more than fifteen files and directories is wide', () => {
  const sample = packageP();
  for (const name of letters(14)) sample.module(name);
  assert.deepEqual(keys(sample, undefined), []);
  sample.module('o::p');
  const diagnostics = checkLayout(sample.model, undefined);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].key, 'src/');
  assert.equal(diagnostics[0].message, '`src/` is wide: it holds 16 files and directories, more than 15');
  assert.deepEqual(diagnostics[0].location, { file: 'src/app.module.ts', line: 1 });
  assert.deepEqual(diagnostics[0].notes, ['15 files: a.ts, app.module.ts, b.ts, c.ts, d.ts, e.ts, f.ts, +8 more', '1 directory: o/']);
  assert.deepEqual(diagnostics[0].picture, { kind: 'bar', label: 'holds', length: 16, most: 15 });
});

test('a wide directory is found where its modules are declared', () => {
  const sample = packageP();
  const store = sample.module('store');
  for (const name of letters(16)) {
    sample.file(store, `src/store/${name}.ts`, 1);
    sample.file(store, `test/${name}.ts`, 1);
  }
  const location = (key: string) => checkLayout(sample.model, undefined).find((diagnostic) => diagnostic.key === key)?.location;
  assert.deepEqual(location('src/store/'), { file: 'src/store.ts', line: 1 });
  assert.equal(location('test/'), undefined);
  assert.ok(keys(sample, undefined).includes('wide-directory test/'));
  sample.file(store, 'src/store/index.ts', 1);
  assert.deepEqual(location('src/store/'), { file: 'src/store/index.ts', line: 1 });
  sample.file(store, 'src/store/store.module.ts', 1);
  assert.deepEqual(location('src/store/'), { file: 'src/store/store.module.ts', line: 1 });
});

test('a wide directory at the root is found where it is declared', () => {
  const sample = new Sample();
  const root = sample.model.tree.root();
  for (const name of letters(16)) sample.file(root, `${name}.ts`, 1);
  const location = () => checkLayout(sample.model, undefined).find((diagnostic) => diagnostic.key === './')?.location;
  assert.equal(location(), undefined);
  sample.file(root, 'index.ts', 1);
  assert.deepEqual(location(), { file: 'index.ts', line: 1 });
  sample.file(root, 'app.module.ts', 1);
  assert.deepEqual(location(), { file: 'app.module.ts', line: 1 });
});

test('a file of more than 2000 lines is long', () => {
  const sample = packageP();
  sample.file(sample.model.tree.root(), 'src/table.ts', 2_000);
  assert.deepEqual(keys(sample, undefined), []);
  sample.model.files[sample.model.files.length - 1].lines = 2_001;
  const diagnostics = checkLayout(sample.model, undefined);
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].key, 'src/table.ts');
  assert.equal(diagnostics[0].message, '`src/table.ts` is long: it has 2001 lines, more than 2000');
  assert.deepEqual(diagnostics[0].location, { file: 'src/table.ts', line: 1 });
  assert.deepEqual(diagnostics[0].picture, { kind: 'bar', label: 'lines', length: 2_001, most: 2_000 });
});

test('a wide directory concerns what is below it and a long file its module', () => {
  const sample = packageP();
  const modules = letters(15).map((name) => sample.module(name));
  sample.model.files[1].lines = 2_001;
  const both = ['long-file src/a.ts', 'wide-directory src/'];
  assert.deepEqual(keys(sample, undefined), both);
  assert.deepEqual(keys(sample, sample.model.tree.root()), both);
  assert.deepEqual(keys(sample, modules[0]), both);
  assert.deepEqual(keys(sample, modules[1]), ['wide-directory src/']);
});

test('a path is held by each directory above it', () => {
  assert.deepEqual(holders('src/lint/cycles.ts'), [
    { directory: '', member: 'src/' },
    { directory: 'src', member: 'lint/' },
    { directory: 'src/lint', member: 'cycles.ts' },
  ]);
  assert.deepEqual(holders('build.ts'), [{ directory: '', member: 'build.ts' }]);
});

test('a long file and a wide directory are reported until they are split', () => {
  const directory = workspace('clean');
  const kinds = join(directory, 'src/kinds.ts');
  const original = readFileSync(kinds, 'utf8');
  writeFileSync(kinds, original + '\n'.repeat(2_000 - original.split('\n').length + 1));
  const parts = (count: number) => {
    for (let part = 1; part <= count; part += 1) writeFileSync(join(directory, `src/socket/part${part}.ts`), `export class Part${part} {}\n`);
  };
  parts(14);
  assert.deepEqual(keysIn(directory), []);
  parts(15);
  appendFileSync(kinds, 'export class Late {}\n');
  const result = runIn(directory);
  assert.equal(result.code, 1);
  const wide = [
    'error[wide-directory]: `src/socket/` is wide: it holds 16 files and directories, more than 15',
    '  --> src/socket.ts:1:1',
    '  = note: 16 files: datagram.ts, part1.ts, part10.ts, part11.ts, part12.ts, part13.ts, part14.ts, +9 more',
    '                         15',
    '    holds  ███████████████│█ 16',
    '',
  ];
  assert.ok(result.stdout.includes(wide.join('\n')), result.stdout);
  const long = [
    'error[long-file]: `src/kinds.ts` is long: it has 2001 lines, more than 2000',
    '  --> src/kinds.ts:1:1',
    '                            2000',
    '    lines  ████████████████████│█ 2001',
    '',
  ];
  assert.ok(result.stdout.includes(long.join('\n')), result.stdout);
  assert.deepEqual(keysIn(directory), ['long-file src/kinds.ts', 'wide-directory src/socket/']);
});

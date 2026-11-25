import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { emptyDirectory, project } from '../../testing/workspace.js';
import { ToolError } from '../../tool.js';
import { loadProject } from './load.js';

const QUEUE = 'export const LIMIT = 4;\n';

const MIXED = { 'src/queue.ts': QUEUE, 'src/queue.spec.ts': QUEUE, 'src/test/helper.ts': QUEUE, 'tools/check.ts': QUEUE };

function failure(directory: string): string {
  try {
    loadProject(directory);
  } catch (error) {
    assert.ok(error instanceof ToolError, String(error));
    return error.message;
  }
  return 'loaded';
}

test('only the code under src that is not a spec is read', () => {
  const loaded = loadProject(project(MIXED));
  assert.deepEqual(
    loaded.sources.map((source) => source.path),
    ['src/queue.ts'],
  );
});

test('outside a TypeScript project nothing is loaded', () => {
  assert.equal(failure(emptyDirectory()), 'not inside a TypeScript project');
});

test('a tsconfig that cannot be read as one is an error', () => {
  const unparsed = project({ 'src/queue.ts': QUEUE, 'tsconfig.json': '{ "include": [' });
  assert.ok(failure(unparsed).startsWith(`${join(unparsed, 'tsconfig.json')}: `), failure(unparsed));
  const wrong = project({ 'src/queue.ts': QUEUE, 'tsconfig.json': '{ "compilerOptions": { "target": "ES1" }, "include": ["src/**/*.ts"] }' });
  assert.ok(failure(wrong).startsWith(`${join(wrong, 'tsconfig.json')}: Argument for '--target' option must be:`), failure(wrong));
});

test('a tsconfig that matches no source file is an error', () => {
  const unmatched = project({ 'tools/check.ts': QUEUE });
  assert.ok(failure(unmatched).startsWith(`${join(unmatched, 'tsconfig.json')}: No inputs were found in config file`), failure(unmatched));
  const everywhere = '{ "compilerOptions": { "noEmit": true, "types": [] }, "include": ["**/*.ts"] }';
  const outside = project({ 'tools/check.ts': QUEUE, 'src/queue.spec.ts': QUEUE, 'tsconfig.json': everywhere });
  assert.equal(failure(outside), `${join(outside, 'tsconfig.json')}: no source files under src/`);
});

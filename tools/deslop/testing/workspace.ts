import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { after } from 'node:test';
import { type Run, run } from '../cli.js';

const FIXTURES = join(import.meta.dirname, '../../../../tools/deslop/fixtures');

const made: string[] = [];

after(() => {
  for (const directory of made) rmSync(directory, { recursive: true, force: true });
});

export function emptyDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'deslop-'));
  made.push(directory);
  return directory;
}

export function workspace(family: string, variants: string[] = [], removed: string[] = []): string {
  const copy = emptyDirectory();
  const variantsOf = join(FIXTURES, family, 'variants');
  cpSync(join(FIXTURES, family), copy, { recursive: true, filter: (source) => source !== variantsOf });
  for (const variant of variants) cpSync(join(variantsOf, variant), copy, { recursive: true });
  for (const path of removed) rmSync(join(copy, path));
  return copy;
}

export function project(files: Record<string, string>): string {
  const directory = emptyDirectory();
  cpSync(join(FIXTURES, 'clean', 'tsconfig.json'), join(directory, 'tsconfig.json'));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(directory, path)), { recursive: true });
    writeFileSync(join(directory, path), text);
  }
  return directory;
}

export function runIn(directory: string, ...words: string[]): Run {
  return run(words, directory, false);
}

export function keys(directory: string): string[] {
  const allow = join(emptyDirectory(), 'keys.allow');
  assert.equal(runIn(directory, '--update-allow', allow).code, 0);
  return readFileSync(allow, 'utf8')
    .split('\n')
    .filter((line) => line !== '' && !line.startsWith('#'))
    .sort();
}

export function variantKeys(family: string, variants: string[] = [], removed: string[] = []): string[] {
  return keys(workspace(family, variants, removed));
}

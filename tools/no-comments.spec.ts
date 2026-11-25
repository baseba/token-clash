import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolsDirectory = dirname(fileURLToPath(import.meta.url));
const environment = Object.fromEntries(Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')));

function repository(context: TestContext, files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'no comments '));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', ['-c', 'user.name=test', '-c', 'user.email=test@example.com', '-c', 'commit.gpgsign=false', ...args], { cwd: root, env: environment });
  git('init', '-q');
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  git('add', '.');
  git('commit', '-q', '-m', 'start');
  return root;
}

function run(root: string, ...args: string[]) {
  const linkParent = mkdtempSync(join(tmpdir(), 'linked tools '));
  const linkedTools = join(linkParent, 'tools');
  symlinkSync(toolsDirectory, linkedTools);
  try {
    return spawnSync(process.execPath, [join(linkedTools, 'no-comments.js'), ...args], { cwd: join(root, 'src'), encoding: 'utf8', env: environment });
  } finally {
    rmSync(linkParent, { recursive: true, force: true });
  }
}

test('the check sees new files, skips deleted ones and runs from any path', (context) => {
  const root = repository(context, { 'src/kept.ts': 'export const kept = 1;\n', 'src/gone.ts': 'export const gone = 1;\n' });
  rmSync(join(root, 'src/gone.ts'));
  writeFileSync(join(root, 'src/new.ts'), 'export const fresh = 1; // why\n');
  const result = run(root);
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /src\/new\.ts:1: \/\/ why/);
  assert.match(result.stderr, /1 comentario\./);
});

test('--fix strips the comments of tracked and new files and leaves a repository that passes the check', (context) => {
  const root = repository(context, { 'src/kept.ts': '// header\nexport const kept = 1; // why\n' });
  writeFileSync(join(root, 'src/new.ts'), 'export const fresh = 1; // why\n');
  const fixed = run(root, '--fix');
  assert.equal(fixed.status, 0, fixed.stderr);
  assert.equal(readFileSync(join(root, 'src/kept.ts'), 'utf8'), 'export const kept = 1;\n');
  assert.equal(readFileSync(join(root, 'src/new.ts'), 'utf8'), 'export const fresh = 1;\n');
  const checked = run(root);
  assert.equal(checked.status, 0, checked.stderr);
});

test('--fix refuses a file whose code the strip would change and fails', (context) => {
  const original = 'export const total = first+/**/+second;\n';
  const root = repository(context, { 'src/risky.js': original });
  const result = run(root, '--fix');
  assert.equal(result.status, 1, result.stderr);
  assert.match(result.stderr, /src\/risky\.js: borrar sus comentarios cambia el código/);
  assert.equal(readFileSync(join(root, 'src/risky.js'), 'utf8'), original);
});

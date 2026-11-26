import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { UsageError, failed, parseArguments, usage } from './cli.js';
import { emptyDirectory, project, runIn, workspace } from './testing/workspace.js';
import { ToolError } from './tool.js';

test('a clean project exits zero', () => {
  const result = runIn(workspace('clean'));
  assert.equal(result.code, 0);
  assert.equal(result.stdout, 'deslop-please: ok\n');
  assert.equal(result.stderr, '');
});

test('outside a TypeScript project is an error, not a report', () => {
  const result = runIn(emptyDirectory());
  assert.equal(result.code, 2);
  assert.equal(result.stdout, '');
  assert.equal(result.stderr, 'deslop-please: not inside a TypeScript project\n');
});

test('a project with no source to check is an error, not a clean report', () => {
  const result = runIn(project({ 'tools/check.ts': 'export const LIMIT = 4;\n' }));
  assert.equal(result.code, 2);
  assert.equal(result.stdout, '');
  assert.ok(result.stderr.startsWith('deslop-please: '), result.stderr);
  assert.ok(result.stderr.includes('tsconfig.json: No inputs were found in config file'), result.stderr);
});

test('an allow file that cannot be written is an error in one line', () => {
  const result = runIn(workspace('clean'), '--update-allow', 'tsconfig.json/debt.allow');
  assert.equal(result.code, 2);
  assert.equal(result.stdout, '');
  assert.match(result.stderr, /^deslop-please: tsconfig\.json\/debt\.allow: [^\n]+\n$/);
});

test('whatever goes wrong exits with two and one line, so a crash is not read as debt', () => {
  assert.deepEqual(failed(new ToolError('no such crate')), { code: 2, stdout: '', stderr: 'deslop-please: no such crate\n' });
  assert.deepEqual(failed(new UsageError('bad flag')), { code: 2, stdout: '', stderr: `deslop-please: bad flag\n${usage()}` });
  const crash = new TypeError('cannot read properties of undefined\n    at somewhere');
  assert.deepEqual(failed(crash), { code: 2, stdout: '', stderr: 'deslop-please: internal error: cannot read properties of undefined\n' });
  assert.deepEqual(failed('thrown text'), { code: 2, stdout: '', stderr: 'deslop-please: internal error: thrown text\n' });
});

test('the allow file suppresses only existing entries and notes what is fixed', () => {
  const directory = workspace('field-leak');
  const allow = join(emptyDirectory(), 'nested', 'debt.allow');
  const update = runIn(directory, '--update-allow', allow);
  assert.deepEqual(update, { code: 0, stdout: '', stderr: `deslop-please: wrote 2 entries to ${allow}\n` });
  assert.equal(
    readFileSync(allow, 'utf8'),
    [
      '# Existing architectural debt suppressed by `deslop-please --allow`.',
      '# Fixing an entry here never fails CI; new issues not listed here fail.',
      'field-leak src::queue::ring::RunQueue::head',
      'field-leak src::queue::ring::RunQueue::items',
      '',
    ].join('\n'),
  );
  const allowed = runIn(directory, '--allow', allow);
  assert.equal(allowed.code, 0);
  assert.equal(allowed.stdout, 'deslop-please: ok\n');

  const fixtures = join(import.meta.dirname, '../../../tools/deslop/fixtures/field-leak/variants');
  cpSync(join(fixtures, 'real'), directory, { recursive: true });
  const fixed = runIn(directory, `--allow=${allow}`);
  assert.equal(fixed.code, 0);
  const tighten = `(run \`deslop-please --update-allow ${allow}\` to tighten it)`;
  assert.equal(fixed.stdout, `note: 2 allowed entries in ${allow} are now fixed ${tighten}\ndeslop-please: ok\n`);

  cpSync(join(fixtures, 'ring'), directory, { recursive: true });
  const grown = runIn(directory, '--allow', allow);
  assert.equal(grown.code, 1);
  assert.ok(grown.stdout.includes('error[tangle]: 8 things'), grown.stdout);
  assert.ok(!grown.stdout.includes('field-leak'), grown.stdout);
  assert.ok(grown.stdout.endsWith('deslop-please: 1 error, well done!\n'), grown.stdout);
});

test('an allow file that cannot be read or has a bad entry is an error', () => {
  const directory = workspace('clean');
  const missing = runIn(directory, '--allow', 'missing.allow');
  assert.equal(missing.code, 2);
  assert.ok(missing.stderr.startsWith('deslop-please: missing.allow: '), missing.stderr);
  const bad = runIn(directory, '--allow', 'tsconfig.json');
  assert.deepEqual(bad, { code: 2, stdout: '', stderr: 'deslop-please: tsconfig.json:1: invalid allowlist entry\n' });
});

test('a scope reports only what concerns that crate or module', () => {
  const directory = workspace('tangle');
  assert.equal(runIn(directory, 'src').stdout, runIn(directory).stdout);
  assert.ok(runIn(directory, 'src::kernel::timers').stdout.endsWith('deslop-please: 2 errors, well done!\n'));
  assert.deepEqual(runIn(directory, 'src::shell'), { code: 0, stdout: 'deslop-please: ok\n', stderr: '' });
  assert.deepEqual(runIn(directory, 'src::nowhere'), { code: 2, stdout: '', stderr: 'deslop-please: src::nowhere: no such crate or module\n' });
});

test('a scoped run does not count allowed entries outside the scope as fixed', () => {
  const directory = workspace('tangle');
  const allow = join(emptyDirectory(), 'debt.allow');
  runIn(directory, '--update-allow', allow);
  assert.deepEqual(runIn(directory, 'src::shell', '--allow', allow), { code: 0, stdout: 'deslop-please: ok\n', stderr: '' });
});

test('help prints the usage and a bad command line prints it as an error', () => {
  for (const word of ['-h', '--help', 'help']) assert.deepEqual(runIn(emptyDirectory(), word), { code: 0, stdout: usage(), stderr: '' });
  assert.deepEqual(runIn(emptyDirectory(), '--release'), { code: 2, stdout: '', stderr: `deslop-please: unexpected argument '--release'\n${usage()}` });
  assert.ok(usage().startsWith('usage: deslop-please [crate_or_mod] [--allow <path>] [--update-allow <path>]\n'));
});

test('no flags check the whole project', () => {
  assert.deepEqual(parseArguments(['src::arena']), { scope: 'src::arena', allow: undefined, updateAllow: undefined });
  assert.deepEqual(parseArguments([]), { scope: undefined, allow: undefined, updateAllow: undefined });
});

test('a value follows its flag or an equals sign in it', () => {
  for (const words of [
    ['src::arena', '--allow', 'a.allow'],
    ['--allow=a.allow', 'src::arena'],
  ]) {
    assert.deepEqual(parseArguments(words), { scope: 'src::arena', allow: 'a.allow', updateAllow: undefined });
  }
  for (const words of [['--update-allow', 'b.allow'], ['--update-allow=b.allow']]) assert.equal(parseArguments(words).updateAllow, 'b.allow');
});

test('what the command line cannot mean is an error', () => {
  const rejected: [string[], string][] = [
    [['--allow'], "'--allow' needs a value"],
    [['--allow', '--update-allow', 'a'], "'--allow' needs a value"],
    [['--allow', 'a', '--allow', 'b'], "'--allow' cannot be given more than once"],
    [['--allow', 'a', '--update-allow', 'b'], "'--allow' and '--update-allow' cannot be given together"],
    [['--release'], "unexpected argument '--release'"],
    [['--target', 'x86_64-pc-windows-msvc'], "unexpected argument '--target'"],
    [['-p', 'src'], "unexpected argument '-p'"],
    [['src', 'public'], "unexpected argument 'public'"],
  ];
  for (const [words, message] of rejected) assert.throws(() => parseArguments(words), new UsageError(message), words.join(' '));
});

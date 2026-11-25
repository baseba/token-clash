import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AllowList } from './allow.js';
import { type Fixed, render } from './format/render.js';
import { check, resolveNode } from './lint/check.js';
import { buildModel } from './model/from-program/build.js';
import { loadProject } from './model/from-program/load.js';
import { TOOL, ToolError } from './tool.js';

export interface Options {
  scope: string | undefined;
  allow: string | undefined;
  updateAllow: string | undefined;
}

export interface Run {
  code: number;
  stdout: string;
  stderr: string;
}

export class UsageError extends Error {}

const FLAGS = ['--allow', '--update-allow'] as const;

type Flag = (typeof FLAGS)[number];

const isFlag = (word: string): word is Flag => (FLAGS as readonly string[]).includes(word);

export function usage(): string {
  return `usage: ${TOOL} [crate_or_mod] [--allow <path>] [--update-allow <path>]

Runs architectural lints (module-cycle, tangle, field-leak, shallow-module,
wide-directory, long-file) on the TypeScript project.

options:
  <crate_or_mod>               check only one crate or module (e.g. src::arena)
  --allow <path>               suppress listed existing debt; new errors still fail
  --update-allow <path>        write current diagnostics to <path>

A flag's value is the next word, or follows \`=\`: \`--allow=<path>\`.
`;
}

export function parseArguments(words: string[]): Options {
  const options: Options = { scope: undefined, allow: undefined, updateAllow: undefined };
  const given = new Set<Flag>();
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    if (!word.startsWith('-')) {
      if (options.scope !== undefined) throw new UsageError(`unexpected argument '${word}'`);
      options.scope = word;
      continue;
    }
    const equals = word.indexOf('=');
    const flag = equals === -1 ? word : word.slice(0, equals);
    if (!isFlag(flag)) throw new UsageError(`unexpected argument '${word}'`);
    if (given.has(flag)) throw new UsageError(`'${flag}' cannot be given more than once`);
    given.add(flag);
    const next = words[i + 1];
    const follows = equals === -1 && next !== undefined && !next.startsWith('-');
    if (equals === -1 && !follows) throw new UsageError(`'${flag}' needs a value`);
    const value = follows ? next : word.slice(equals + 1);
    if (follows) i += 1;
    if (flag === '--allow') options.allow = value;
    else options.updateAllow = value;
  }
  const both = options.allow !== undefined && options.updateAllow !== undefined;
  if (both) throw new UsageError("'--allow' and '--update-allow' cannot be given together");
  return options;
}

const firstLine = (error: unknown): string => (error instanceof Error ? error.message : String(error)).split('\n')[0];

function readText(path: string, shown: string): string {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    throw new ToolError(`${shown}: ${firstLine(error)}`);
  }
}

function writeText(path: string, shown: string, text: string): void {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, text);
  } catch (error) {
    throw new ToolError(`${shown}: ${firstLine(error)}`);
  }
}

function execute(options: Options, directory: string, color: boolean): Run {
  const model = buildModel(loadProject(directory));
  const scope = options.scope === undefined ? undefined : resolveNode(model, options.scope);
  if (options.scope !== undefined && scope === undefined) throw new ToolError(`${options.scope}: no such crate or module`);
  const all = check(model, scope);
  if (options.updateAllow !== undefined) {
    writeText(resolve(directory, options.updateAllow), options.updateAllow, AllowList.fromDiagnostics(all).toText());
    return { code: 0, stdout: '', stderr: `${TOOL}: wrote ${all.length} entries to ${options.updateAllow}\n` };
  }
  if (options.allow === undefined) return { code: all.length === 0 ? 0 : 1, stdout: render(all, undefined, color), stderr: '' };
  const allow = AllowList.parse(readText(resolve(directory, options.allow), options.allow), options.allow);
  const fixed: Fixed = { count: allow.fixedCount(all), path: options.allow };
  const reported = all.filter((diagnostic) => !allow.isAllowed(diagnostic));
  return { code: reported.length === 0 ? 0 : 1, stdout: render(reported, fixed, color), stderr: '' };
}

export function failed(error: unknown): Run {
  if (error instanceof UsageError) return { code: 2, stdout: '', stderr: `${TOOL}: ${error.message}\n${usage()}` };
  if (error instanceof ToolError) return { code: 2, stdout: '', stderr: `${TOOL}: ${error.message}\n` };
  return { code: 2, stdout: '', stderr: `${TOOL}: internal error: ${firstLine(error)}\n` };
}

export function run(words: string[], directory: string, color: boolean): Run {
  if (words.length === 1 && ['-h', '--help', 'help'].includes(words[0])) return { code: 0, stdout: usage(), stderr: '' };
  try {
    return execute(parseArguments(words), directory, color);
  } catch (error) {
    return failed(error);
  }
}

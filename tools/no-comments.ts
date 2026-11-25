import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findComments, isChecked, stripComments, UnsafeStrip } from './comments.js';

const git = (root: string, args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

const root = git(process.cwd(), ['rev-parse', '--show-toplevel']).trim();
const fix = process.argv.includes('--fix');
const files = [...new Set(git(root, ['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0'))].filter((path) => isChecked(path) && existsSync(join(root, path)));
const countOf = (total: number, adjective = '') => {
  const plural = total === 1 ? '' : 's';
  return `${total} comentario${plural}${adjective ? ` ${adjective}${plural}` : ''}`;
};
const lineOf = (text: string, offset: number) => text.slice(0, offset).split('\n').length;

let total = 0;
let removed = 0;
let refused = 0;
for (const path of files) {
  const absolute = join(root, path);
  const text = readFileSync(absolute, 'utf8');
  const comments = findComments(path, text);
  if (comments.length === 0) continue;
  total += comments.length;
  if (!fix) {
    for (const comment of comments) console.error(`${path}:${lineOf(text, comment.start)}: ${text.slice(comment.start, comment.end).split('\n')[0]}`);
    continue;
  }
  try {
    writeFileSync(absolute, stripComments(path, text));
    removed += comments.length;
  } catch (error) {
    if (!(error instanceof UnsafeStrip)) throw error;
    console.error(error.message);
    refused += 1;
  }
}

if (fix) {
  console.log(`no-comments: ${countOf(removed, 'borrado')}.`);
  if (refused > 0) process.exitCode = 1;
} else if (total > 0) {
  console.error(`no-comments: ${countOf(total)}. El código se explica con nombres y tests. Bórralos con npm run no-comments -- --fix.`);
  process.exitCode = 1;
}

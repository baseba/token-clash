import type { Diagnostic } from '../lint/report.js';
import { TOOL } from '../tool.js';
import { type Paint, draw } from './picture.js';

export function painter(color: boolean): Paint {
  const sgr = (code: string) => (text: string) => (color ? `\x1b[${code}m${text}\x1b[0m` : text);
  return { error: sgr('1;31'), gutter: sgr('1;34'), ok: sgr('1;32'), bold: sgr('1') };
}

export interface Fixed {
  count: number;
  path: string;
}

export function render(diagnostics: Diagnostic[], fixed: Fixed | undefined, color: boolean): string {
  const paint = painter(color);
  const lines: string[] = [];
  for (const diagnostic of diagnostics) {
    lines.push(`${paint.error(`error[${diagnostic.lint}]`)}${paint.bold(`: ${diagnostic.message}`)}`);
    if (diagnostic.location !== undefined) lines.push(`  ${paint.gutter('-->')} ${diagnostic.location.file}:${diagnostic.location.line}:1`);
    for (const note of diagnostic.notes) lines.push(`  ${paint.gutter('=')} ${paint.bold('note:')} ${note}`);
    lines.push(...draw(diagnostic.picture, paint), '');
  }
  if (fixed !== undefined && fixed.count > 0) {
    const noun = fixed.count === 1 ? 'entry' : 'entries';
    const tighten = `(run \`${TOOL} --update-allow ${fixed.path}\` to tighten it)`;
    lines.push(`${paint.bold('note:')} ${fixed.count} allowed ${noun} in ${fixed.path} are now fixed ${tighten}`);
  }
  if (diagnostics.length === 0) lines.push(`${TOOL}: ${paint.ok('ok')}`);
  else lines.push(`${TOOL}: ${paint.error(`${diagnostics.length} ${diagnostics.length === 1 ? 'error' : 'errors'}`)}, well done!`);
  return `${lines.join('\n')}\n`;
}

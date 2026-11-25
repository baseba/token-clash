import { type Diagnostic, LINTS, type Lint, compareText } from './lint/report.js';
import { TOOL, ToolError } from './tool.js';

interface Entry {
  lint: Lint;
  key: string;
}

const OPENING = new Set(['<', '(', '[']);
const CLOSING = new Set(['>', ')', ']']);

function membersOf(key: string): string[] {
  const members: string[] = [];
  let depth = 0;
  let start = 0;
  [...key].forEach((character, index) => {
    if (OPENING.has(character)) depth += 1;
    else if (CLOSING.has(character)) depth = Math.max(0, depth - 1);
    else if (character === ',' && depth === 0) {
      members.push(key.slice(start, index));
      start = index + 1;
    }
  });
  return [...members, key.slice(start)];
}

function covers(entry: Entry, diagnostic: Diagnostic): boolean {
  if (diagnostic.lint !== entry.lint) return false;
  if (diagnostic.key === entry.key) return true;
  if (entry.lint !== 'tangle' && entry.lint !== 'module-cycle') return false;
  const allowed = membersOf(entry.key);
  return membersOf(diagnostic.key).every((member) => allowed.includes(member));
}

const isLint = (name: string): name is Lint => (LINTS as readonly string[]).includes(name);

export class AllowList {
  private constructor(private readonly entries: Entry[]) {}

  static fromDiagnostics(diagnostics: Diagnostic[]): AllowList {
    return AllowList.ofEntries(diagnostics.map(({ lint, key }) => ({ lint, key })));
  }

  static parse(text: string, path: string): AllowList {
    const entries: Entry[] = [];
    text.split('\n').forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed === '' || trimmed.startsWith('#')) return;
      const space = trimmed.indexOf(' ');
      const lint = space === -1 ? '' : trimmed.slice(0, space);
      const key = space === -1 ? '' : trimmed.slice(space + 1).trim();
      if (!isLint(lint) || key === '') throw new ToolError(`${path}:${index + 1}: invalid allowlist entry`);
      entries.push({ lint, key });
    });
    return AllowList.ofEntries(entries);
  }

  private static ofEntries(entries: Entry[]): AllowList {
    const sorted = [...entries].sort((a, b) => LINTS.indexOf(a.lint) - LINTS.indexOf(b.lint) || compareText(a.key, b.key));
    return new AllowList(sorted.filter((entry, index) => index === 0 || entry.lint !== sorted[index - 1].lint || entry.key !== sorted[index - 1].key));
  }

  toText(): string {
    const suppressed = `# Existing architectural debt suppressed by \`${TOOL} --allow\`.`;
    const fixing = '# Fixing an entry here never fails CI; new issues not listed here fail.';
    return [suppressed, fixing, ...this.entries.map(({ lint, key }) => `${lint} ${key}`), ''].join('\n');
  }

  isAllowed(diagnostic: Diagnostic): boolean {
    return this.entries.some((entry) => covers(entry, diagnostic));
  }

  fixedCount(diagnostics: Diagnostic[]): number {
    return this.entries.filter((entry) => !diagnostics.some((diagnostic) => covers(entry, diagnostic))).length;
  }
}

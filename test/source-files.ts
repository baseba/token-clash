import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { PROJECT_ROOT } from '../src/shared/paths.js';

export const SRC = join(PROJECT_ROOT, 'src');

export interface Import {
  file: string;
  target: string;
}

export interface SourceFile {
  file: string;
  code: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

export const readSources = (): SourceFile[] => sourceFiles(SRC).map((path) => ({ file: relative(SRC, path), code: readFileSync(path, 'utf8') }));

function isTypeOnly(clause: string): boolean {
  if (/^type\b/.test(clause)) return true;
  const names = /^\{([^}]*)\}$/.exec(clause)?.[1].split(',').map((name) => name.trim()).filter(Boolean) ?? [];
  return names.length > 0 && names.every((name) => /^type\b/.test(name));
}

export function importsOf({ file, code }: SourceFile): Import[] {
  const specifiers = [...code.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+'([^']+)'/gm), ...code.matchAll(/\bimport\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  return specifiers.map((spec) => ({ file, target: spec.startsWith('.') ? normalize(join(dirname(file), spec)).replace(/\.js$/, '.ts') : spec }));
}

export function valueImportsOf({ file, code }: SourceFile): Import[] {
  const staticImports = [...code.matchAll(/^\s*(?:import|export)\s+([^'"]*?)\s*from\s+'([^']+)'/gm)].filter((m) => !isTypeOnly(m[1].trim())).map((m) => m[2]);
  const dynamicImports = [...code.matchAll(/\bimport\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  return [...staticImports, ...dynamicImports].map((target) => ({ file, target }));
}

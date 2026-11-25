import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { PROJECT_ROOT } from './shared/paths.js';

const SRC = join(PROJECT_ROOT, 'src');
const CONTEXTS = ['arena', 'catalog', 'chat', 'combat', 'radio', 'stats', 'tower', 'trainers'];

interface Import {
  file: string;
  target: string;
}

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [path] : [];
  });
}

function importsOf(path: string): Import[] {
  const file = relative(SRC, path);
  const code = readFileSync(path, 'utf8');
  const specifiers = [...code.matchAll(/^\s*(?:import|export)\b[^'"]*?from\s+'([^']+)'/gm), ...code.matchAll(/\bimport\(\s*'([^']+)'\s*\)/g)].map((m) => m[1]);
  return specifiers.map((spec) => ({ file, target: spec.startsWith('.') ? normalize(join(dirname(file), spec)).replace(/\.js$/, '.ts') : spec }));
}

const imports = sourceFiles(SRC).flatMap(importsOf);

const contextOf = (path: string) => CONTEXTS.find((context) => path.startsWith(`${context}/`));
const layerOf = (path: string) => path.split('/')[1];
const isPackage = (target: string, name: string) => target === name || target.startsWith(`${name}/`);
const usesDrizzle = (target: string) => isPackage(target, 'drizzle-orm') || isPackage(target, '@nestjs/drizzle');
const isRepositoryPort = (target: string) => /\/domain\/[^/]+\.repositor(y|ies)\.ts$/.test(target);
const isWiring = (file: string) => !file.includes('/') || file.startsWith('legacy/');
const show = (list: Import[]) => list.map(({ file, target }) => `${file} → ${target}`);

test('the scanner sees the imports it checks', () => {
  assert.ok(imports.some((i) => i.file === 'legacy/legacy-json-import.ts' && i.target === 'drizzle-orm'));
  assert.ok(imports.some((i) => i.file === 'arena/domain/lobby.ts' && i.target === 'shared/domain/errors.ts'));
});

test('a domain/ folder is plain TypeScript: no Nest, no Drizzle, no HTTP, no other layer', () => {
  const bad = imports.filter(({ file, target }) => {
    if (!contextOf(file) || layerOf(file) !== 'domain') return false;
    return isPackage(target, '@nestjs') || usesDrizzle(target) || target === 'node:http' || /^[a-z]+\/(application|infrastructure|interface)\//.test(target);
  });
  assert.deepEqual(show(bad), []);
});

test("nobody reaches into another context's adapters (infrastructure/) or repository ports", () => {
  const bad = imports.filter(({ file, target }) => {
    const owner = contextOf(target);
    if (!owner || owner === contextOf(file) || isWiring(file)) return false;
    return layerOf(target) === 'infrastructure' || isRepositoryPort(target);
  });
  assert.deepEqual(show(bad), []);
});

test('only infrastructure/ folders (and the one-time legacy import) use Drizzle', () => {
  const bad = imports.filter(({ file, target }) => usesDrizzle(target) && !file.split('/').includes('infrastructure') && !isWiring(file));
  assert.deepEqual(show(bad), []);
});

test('catalog depends on no other context: it serves data, and combat decides what the engine can play', () => {
  const bad = imports.filter(({ file, target }) => contextOf(file) === 'catalog' && contextOf(target) && contextOf(target) !== 'catalog');
  assert.deepEqual(show(bad), []);
});

test('shared/ depends on nothing else in src: the arrows point into it, never out', () => {
  const bad = imports.filter(({ file, target }) => file.startsWith('shared/') && target.endsWith('.ts') && !target.startsWith('shared/') && !target.startsWith('../'));
  assert.deepEqual(show(bad), []);
});

test('radio uses catalog and trainers only, and no context knows radio exists', () => {
  const bad = imports.filter(({ file, target }) => {
    const [from, to] = [contextOf(file), contextOf(target)];
    if (!from || !to || from === to) return false;
    return to === 'radio' || (from === 'radio' && !['catalog', 'trainers'].includes(to));
  });
  assert.deepEqual(show(bad), []);
});

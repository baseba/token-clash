import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, relative } from 'node:path';
import { PROJECT_ROOT } from './shared/paths.js';

const SRC = join(PROJECT_ROOT, 'src');
const USES: Record<string, readonly string[]> = {
  catalog: [],
  combat: ['catalog'],
  trainers: ['catalog', 'combat'],
  chat: [],
  arena: ['catalog', 'chat', 'combat', 'trainers'],
  radio: ['trainers'],
  tower: ['arena', 'catalog', 'combat', 'trainers'],
  stats: ['arena', 'catalog', 'combat', 'trainers'],
  realtime: ['arena', 'radio'],
  web: ['arena', 'catalog'],
};
const CONTEXTS = Object.keys(USES);
const PLUMBING = ['app', 'platform', 'shared'];
const LAYER_USES: Record<string, readonly string[]> = {
  domain: [],
  application: ['domain', 'infrastructure'],
  infrastructure: ['domain', 'application'],
  interface: ['application', 'domain'],
};

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
const folderOf = (path: string) => path.split('/')[0];
const layerOf = (path: string) => path.split('/')[1];
const isPackage = (target: string, name: string) => target === name || target.startsWith(`${name}/`);
const usesDrizzle = (target: string) => isPackage(target, 'drizzle-orm') || isPackage(target, '@nestjs/drizzle');
const isPlumbing = (target: string) => isPackage(target, '@nestjs') || usesDrizzle(target) || target === 'node:http';
const isRepositoryPort = (target: string) => /\/domain\/[^/]+\.repositor(y|ies)\.ts$/.test(target);
const isWiring = (file: string) => !file.includes('/') || file.startsWith('app/');
const show = (list: Import[]) => list.map(({ file, target }) => `${file} → ${target}`);

test('the scanner sees the imports it checks', () => {
  assert.ok(imports.some((i) => i.file === 'app/legacy-json-import.ts' && i.target === 'drizzle-orm'));
  assert.ok(imports.some((i) => i.file === 'arena/domain/lobby.ts' && i.target === 'shared/domain/errors.ts'));
  assert.ok(imports.some((i) => i.file === 'shared/domain/clock.ts' && i.target === 'node:crypto'));
  assert.ok(imports.some((i) => i.file === 'platform/http/domain-error.filter.ts' && i.target === 'shared/domain/errors.ts'));
  assert.ok(imports.some((i) => i.file === 'platform/http/client-ip.ts' && i.target === 'node:http'));
});

test('a domain/ folder is plain TypeScript: no Nest, no Drizzle, no HTTP, no other layer', () => {
  const bad = imports.filter(({ file, target }) => {
    if (!contextOf(file) || layerOf(file) !== 'domain') return false;
    return isPlumbing(target) || /^[a-z]+\/(application|infrastructure|interface)\//.test(target);
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

test('only infrastructure/ folders, platform/database/ and the one-time legacy import use Drizzle', () => {
  const bad = imports.filter(({ file, target }) => usesDrizzle(target) && !file.split('/').includes('infrastructure') && !file.startsWith('platform/database/') && !isWiring(file));
  assert.deepEqual(show(bad), []);
});

test('shared/ depends on nothing else in src: the arrows point into it, never out', () => {
  const bad = imports.filter(({ file, target }) => file.startsWith('shared/') && target.endsWith('.ts') && !target.startsWith('shared/') && !target.startsWith('../'));
  assert.deepEqual(show(bad), []);
});

test('shared/ is what a domain/ may import: no Nest, no Drizzle, no HTTP', () => {
  const bad = imports.filter(({ file, target }) => file.startsWith('shared/') && isPlumbing(target));
  assert.deepEqual(show(bad), []);
});

test('platform/ depends on nothing but shared/: the arrows point into it, never out', () => {
  const bad = imports.filter(({ file, target }) => file.startsWith('platform/') && target.endsWith('.ts') && !target.startsWith('platform/') && !target.startsWith('shared/') && !target.startsWith('../'));
  assert.deepEqual(show(bad), []);
});

test('a domain/ folder never imports platform/: what a domain may share lives in shared/', () => {
  const bad = imports.filter(({ file, target }) => layerOf(file) === 'domain' && target.startsWith('platform/'));
  assert.deepEqual(show(bad), []);
});

test('each folder of src/ uses only the folders its row in USES names', () => {
  const bad = imports.filter(({ file, target }) => {
    const [from, to] = [folderOf(file), folderOf(target)];
    return from in USES && to in USES && from !== to && !USES[from].includes(to);
  });
  assert.deepEqual(show(bad), []);
});

test('every folder of src/ has a row in USES or is plumbing: a new folder says what it uses', () => {
  const folders = readdirSync(SRC, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  assert.deepEqual(folders.sort(), [...CONTEXTS, ...PLUMBING].sort());
});

test('inside a context, each layer imports only the layers its row in LAYER_USES names', () => {
  const bad = imports.filter(({ file, target }) => {
    const [from, to] = [layerOf(file), layerOf(target)];
    if (!contextOf(file) || contextOf(file) !== contextOf(target) || !(from in LAYER_USES) || !(to in LAYER_USES)) return false;
    return from !== to && !LAYER_USES[from].includes(to);
  });
  assert.deepEqual(show(bad), []);
});

test('the move and ability rules never import the engine that runs them', () => {
  const bad = imports.filter(({ file, target }) => file.startsWith('combat/domain/rules/') && target.startsWith('combat/domain/engine/'));
  assert.deepEqual(show(bad), []);
});

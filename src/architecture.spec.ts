import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { type Import, importsOf, readSources, SRC } from '../test/source-files.js';

const CONTEXTS = ['arena', 'catalog', 'chat', 'combat', 'radio', 'stats', 'tower', 'trainers'];
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
const PLUMBING = ['app', 'platform', 'shared'];
const LAYER_USES: Record<string, readonly string[]> = {
  domain: [],
  application: ['domain', 'infrastructure'],
  infrastructure: ['domain', 'application'],
  interface: ['application', 'domain'],
};

const sources = readSources();
const imports = sources.flatMap(importsOf);

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
  assert.deepEqual(folders.sort(), [...Object.keys(USES), ...PLUMBING].sort());
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

test('no module exports a repository: other contexts ask its application services', () => {
  const exported = sources.filter(({ file }) => file.endsWith('.module.ts')).flatMap(({ file, code }) => [...code.matchAll(/\bexports:\s*\[([^\]]*)\]/g)].flatMap((m) => m[1].split(',').map((name) => `${file} exports ${name.trim()}`)));
  assert.ok(exported.includes('trainers/trainers.module.ts exports TrainersService'));
  assert.deepEqual(exported.filter((line) => /Repositor(y|ies)$/.test(line)), []);
});

test('a foreign key points at a table of its own schema file: other contexts are referenced by id', () => {
  const references = sources.filter(({ file }) => file.endsWith('.schema.ts')).flatMap(({ file, code }) => [...code.matchAll(/\.references\(\s*\(\)\s*=>\s*(\w+)\./g)].map((m) => ({ file, table: m[1], local: new RegExp(`^export const ${m[1]} =`, 'm').test(code) })));
  assert.ok(references.length > 0);
  assert.deepEqual(references.filter(({ local }) => !local).map(({ file, table }) => `${file} → ${table}`), []);
});

test('only the Jev client leaves the server: nobody else fetches or opens a socket', () => {
  const networkModules = ['node:https', 'node:http2', 'node:net', 'node:tls', 'node:dns', 'node:dgram', 'undici'];
  const jev = (file: string) => file.startsWith('combat/infrastructure/jev/');
  const fetching = sources.filter(({ file, code }) => !jev(file) && /(?<![-\w'".])fetch\b(?![-'"])/.test(code)).map(({ file }) => `${file} uses fetch`);
  const sockets = imports.filter(({ target }) => networkModules.includes(target)).map(({ file, target }) => `${file} → ${target}`);
  const servers = sources.filter(({ file, code }) => !jev(file) && /^\s*import\s+(?!type\b)[^'"]*from\s+'node:http'/m.test(code)).map(({ file }) => `${file} imports node:http as a value`);
  assert.deepEqual([...fetching, ...sockets, ...servers], []);
});

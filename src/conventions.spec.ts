import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readSources, specifiersOf } from '../test/source-files.js';
import { PROJECT_ROOT } from './shared/paths.js';

const sources = readSources();
const layerOf = (file: string) => file.split('/')[1];
const isDomain = (file: string) => layerOf(file) === 'domain' || file.startsWith('shared/');

function projectFiles(dir: string, keep: (name: string) => boolean): string[] {
  return readdirSync(join(PROJECT_ROOT, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return projectFiles(path, keep);
    return keep(entry.name) ? [path] : [];
  });
}

test('a domain/ folder never calls Math.random(): the randomness comes in as a parameter', () => {
  const bad = sources.filter(({ file, code }) => isDomain(file) && /Math\.random\s*\(/.test(code)).map(({ file }) => file);
  assert.deepEqual(bad, []);
});

test('no catch in src/ swallows an error with an empty block', () => {
  const emptyCatch = /\bcatch\s*(\([^)]*\))?\s*\{\s*\}/;
  const emptyCatchCallback = /\.catch\(\s*(\([^)]*\)|\w+)\s*=>\s*\{\s*\}\s*\)/;
  const bad = sources.filter(({ code }) => emptyCatch.test(code) || emptyCatchCallback.test(code)).map(({ file }) => file);
  assert.deepEqual(bad, []);
});

test('domain/ and application/ say no with a DomainError: they never throw anything else', () => {
  const bad = sources
    .filter(({ file }) => ['domain', 'application'].includes(layerOf(file)))
    .flatMap(({ file, code }) => [...code.matchAll(/\bthrow\s+(?:new\s+)?([A-Z]\w*)/g)].filter((m) => m[1] !== 'DomainError').map((m) => `${file} throws ${m[1]}`));
  assert.deepEqual(bad, []);
});

test('only platform/http/ and web/ use the Nest exceptions: everyone else throws a DomainError or an HttpError', () => {
  const bad = sources
    .filter(({ file }) => !file.startsWith('platform/http/') && !file.startsWith('web/'))
    .flatMap(({ file, code }) => [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*'@nestjs\/common'/g)].flatMap((m) => m[1].split(',').map((name) => name.trim()).filter((name) => /Exception$/.test(name)).map((name) => `${file} imports ${name}`)));
  assert.deepEqual(bad, []);
});

test('every @Body() and @Query() of a controller validates with a schema', () => {
  const decorators = sources.filter(({ file }) => file.endsWith('.controller.ts')).flatMap(({ file, code }) => [...code.matchAll(/@(Body|Query)\(([^)]*)\)/g)].map((m) => ({ file, call: m[0], validated: /\bschema:/.test(m[2]) })));
  assert.ok(decorators.length > 0);
  assert.deepEqual(decorators.filter(({ validated }) => !validated).map(({ file, call }) => `${file}: ${call}`), []);
});

test('a DTO takes the list of an enum from the domain: no z.enum([...]) literal in interface/dto/', () => {
  const bad = sources.filter(({ file, code }) => file.includes('/interface/dto/') && /z\.enum\(\s*\[/.test(code)).map(({ file }) => file);
  assert.deepEqual(bad, []);
});

test('every exported DTO is named in the *-dtos.spec.ts of its folder', () => {
  const dtoFiles = sources.filter(({ file }) => /\/interface\/dto\/[^/]+\.dto\.ts$/.test(file));
  assert.ok(dtoFiles.length > 0);
  const bad = dtoFiles.flatMap(({ file, code }) => {
    const folder = join('src', file, '..');
    const specs = readdirSync(join(PROJECT_ROOT, folder)).filter((name) => name.endsWith('-dtos.spec.ts')).map((name) => readFileSync(join(PROJECT_ROOT, folder, name), 'utf8')).join('\n');
    return [...code.matchAll(/^export const (\w+)/gm)].map((m) => m[1]).filter((name) => !new RegExp(`\\b${name}\\b`).test(specs)).map((name) => `${file}: ${name}`);
  });
  assert.deepEqual(bad, []);
});

function testsReading(code: string, naming: RegExp): string[] {
  const tests = [...code.matchAll(/^([ \t]*)(?:test|it)\([\s\S]*?^\1\}\);?$/gm)].map((m) => m[0]);
  const outside = tests.reduce((rest, body) => rest.replace(body, ''), code);
  const constants = [...outside.matchAll(/^\s*const (\w+)\s*=([^;]*)/gm)].filter((m) => naming.test(m[2])).map((m) => m[1]);
  const reads = (body: string) => naming.test(body) || constants.some((name) => new RegExp(`\\b${name}\\b`).test(body));
  return tests.filter(reads);
}

const SKIP_OPTION = /^\s*(?:test|it)\(\s*(['"`])[\s\S]*?\1\s*,\s*\{[^{}]*\bskip\b\s*[:,}]/;
const CONTEXT_SKIP = /(?<![\w.])(?:t|context)\.skip\(/;
const isSkipGuarded = (body: string) => SKIP_OPTION.test(body) || CONTEXT_SKIP.test(body);

test('a test that reads a folder downloaded at install skips when the folder is missing', () => {
  const downloaded = readFileSync(join(PROJECT_ROOT, '.gitignore'), 'utf8').split('\n').map((line) => /^public\/([\w-]+)\/?$/.exec(line.trim())?.[1]).filter((name) => name !== undefined);
  assert.ok(downloaded.includes('anims'));
  const quote = `['"\`]`;
  const naming = new RegExp(`(?:public/|PUBLIC_DIR\\s*,\\s*${quote}|${quote}public${quote}\\s*,\\s*${quote})(${downloaded.join('|')})(?=[/'"\`])`);
  const testFiles = [...projectFiles('src', (name) => name.endsWith('.spec.ts')), ...projectFiles('tools', (name) => name.endsWith('.spec.ts')), ...projectFiles('test', (name) => /\.(e2e-spec\.ts|test\.js)$/.test(name))];
  const readers = testFiles.flatMap((path) => testsReading(readFileSync(join(PROJECT_ROOT, path), 'utf8'), naming).map((body) => ({ path, body })));
  assert.ok(readers.some(({ path }) => path === join('test', 'web', 'battle-anims.test.js')));
  assert.deepEqual(readers.filter(({ body }) => !isSkipGuarded(body)).map(({ path, body }) => `${path}: ${body.split('\n')[0].trim()}`), []);
});

test('the dependencies are the agreed ones: adding one is a decision, not a side effect', () => {
  const manifest = JSON.parse(readFileSync(join(PROJECT_ROOT, 'package.json'), 'utf8')) as { dependencies: Record<string, string>; devDependencies: Record<string, string> };
  assert.deepEqual(Object.keys(manifest.dependencies).sort(), ['@nestjs/common', '@nestjs/core', '@nestjs/drizzle', '@nestjs/platform-express', '@nestjs/platform-ws', '@nestjs/websockets', '@resvg/resvg-js', 'drizzle-orm', 'reflect-metadata', 'rxjs', 'ws', 'zod']);
  assert.deepEqual(Object.keys(manifest.devDependencies).sort(), ['@types/express', '@types/node', '@types/ws', 'drizzle-kit', 'typescript']);
});

test('the browser code imports only files of public/: no package, no CDN, no build', () => {
  const browserFiles = readdirSync(join(PROJECT_ROOT, 'public')).filter((name) => name.endsWith('.js'));
  const bad = browserFiles.flatMap((name) => {
    const code = readFileSync(join(PROJECT_ROOT, 'public', name), 'utf8');
    return specifiersOf(code).filter((specifier) => !specifier.startsWith('./')).map((specifier) => `public/${name} → ${specifier}`);
  });
  assert.deepEqual(bad, []);
});

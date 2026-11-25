import assert from 'node:assert/strict';
import { buildGraph } from '../graph/graph.js';
import { buildModel } from '../model/from-program/build.js';
import { loadProject } from '../model/from-program/load.js';
import type { Item, ItemId, Model } from '../model/model.js';
import { keys, project } from './workspace.js';

export type Files = Record<string, string>;

export const GLOBALS: Files = { 'src/globals.d.ts': 'declare function structuredClone<Value>(value: Value): Value;\n' };

export const modelOf = (files: Files): Model => buildModel(loadProject(project(files)));

export const keysOf = (files: Files): string[] => keys(project(files));

export const named = (model: Model, name: string): Item[] => model.items.filter((item) => item.name === name);

export function heldBy(model: Model, holder: string): string[] {
  const held = model.references.filter((reference) => reference.holder !== undefined && model.items[reference.holder].name === holder);
  return [...new Set(held.map((reference) => model.items[reference.item].name))].sort();
}

export function wrapperOf(model: Model, name: string): string {
  const item = model.items.findIndex((candidate) => candidate.name === name) as ItemId;
  const wrapper = model.wrappers.get(item);
  const names = (items: ItemId[]) => items.map((listed) => model.items[listed].name).join(',');
  if (wrapper?.kind === 'forwarder') return `forwards to ${model.items[wrapper.target].name} on [${names(wrapper.fields)}]`;
  return wrapper === undefined ? 'works' : `lends [${names(wrapper.lent)}] copies [${names(wrapper.copied)}]`;
}

export function userOf(type: string, body: string): string {
  const file = type.toLowerCase();
  return `import type { ${type} } from './${file}.js';\n\nexport function use(${file}: ${type}) {\n  ${body}\n}\n`;
}

export type Wrapped = [name: string, wrapper: string];

export function assertWrappers(model: Model, cases: Wrapped[]): void {
  assert.deepEqual(
    cases.map(([name]) => [name, wrapperOf(model, name)]),
    cases,
  );
}

export type Verdict = 'reads' | 'leaks';

export type Judged = [body: string, verdict: Verdict];

function usersOf(type: string, bodies: string[]): string {
  const subject = type.toLowerCase();
  const given = [`const ${subject}: ${type}`, `const other: ${type}`, 'const ok: boolean', 'function hold(...held: unknown[]): void'];
  const declared = given.map((declaration) => `declare ${declaration};\n`).join('');
  const uses = bodies.map((body, index) => `export function use${index}() {\n  ${body}\n}\n`);
  return `import type { ${type} } from './${subject}.js';\n\n${declared}\n${uses.join('\n')}`;
}

export function verdictsOf(files: Files, type: string, bodies: string[]): Verdict[] {
  const model = modelOf({ ...files, 'src/user.ts': usersOf(type, bodies) });
  const owner = model.items.findIndex((item) => item.name === type && item.kind === 'type');
  const graph = buildGraph(model);
  return bodies.map((body, index) => {
    const user = model.items.findIndex((item) => item.name === `use${index}`);
    const uses = graph.uses.filter((use) => model.references[use.reference].holder === user && model.items[use.item].parent === owner);
    const ofFields = uses.filter((use) => model.items[use.item].kind === 'field');
    assert.ok(ofFields.length > 0, `no field of ${type} is used by: ${body}`);
    return ofFields.every((use) => use.copies) ? 'reads' : 'leaks';
  });
}

export function assertVerdicts(files: Files, type: string, cases: Judged[]): void {
  const found = verdictsOf(
    files,
    type,
    cases.map(([body]) => body),
  );
  assert.deepEqual(
    cases.map(([body], index) => [body, found[index]]),
    cases,
  );
}

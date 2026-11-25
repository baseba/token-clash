import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { project } from '../../testing/workspace.js';
import { loadProject } from './load.js';
import { Values } from './values.js';

const TYPES = `export enum Kind {
  Ring,
  Heap,
}

export interface Task {
  id: number;
}

interface ReadonlySet<Item> {
  add(item: Item): void;
}

export type Count = number;
export type Label = string;
export type Open = boolean;
export type Big = bigint;
export type Key = symbol;
export type Missing = undefined;
export type Empty = null;
export type Nothing = void;
export type Never = never;
export type OneKind = Kind;
export type Mode = 'fast' | 'slow';
export type Maybe = number | undefined;
export type Branded = string & { readonly brand: 'Id' };
export type Named<Name extends string> = Name;
export type KeyOfTask = keyof Task;
export type Template = \`task-\${number}\`;

export type View = readonly number[];
export type Listed = ReadonlyArray<string>;
export type Pair = readonly [number, string];
export type ByName = ReadonlyMap<string, readonly number[]>;
export type MaybeView = readonly number[] | undefined;
export type Frozen = Readonly<number[]>;
export type Tree = string | readonly Tree[];

export type Loose = any;
export type Hidden = unknown;
export type Shapeless = object;
export type Bare = {};
export type Free<Value> = Value;
export type Numbers = number[];
export type OpenPair = [number, string];
export type Record = { count: number };
export type FrozenRecord = Readonly<{ count: number }>;
export type Either = number | Task;
export type Call = () => void;
export type When = Date;
export type Tasks = readonly Task[];
export type TaskPair = readonly [Task, number];
export type Counts = Map<string, number>;
export type Waiting = Set<number>;
export type ById = ReadonlyMap<string, Task>;
export type Shadowed = ReadonlySet<number>;
export type Typed = Uint8Array;
`;

const SCALARS = [
  'Count',
  'Label',
  'Open',
  'Big',
  'Key',
  'Missing',
  'Empty',
  'Nothing',
  'Never',
  'OneKind',
  'Mode',
  'Maybe',
  'Branded',
  'Named',
  'KeyOfTask',
  'Template',
];

const READONLY_COLLECTIONS_OF_VALUES = ['View', 'Listed', 'Pair', 'ByName', 'MaybeView', 'Frozen', 'Tree'];

const NO_VALUES = [
  'Loose',
  'Hidden',
  'Shapeless',
  'Bare',
  'Free',
  'Numbers',
  'OpenPair',
  'Record',
  'FrozenRecord',
  'Either',
  'Call',
  'When',
  'Tasks',
  'TaskPair',
  'Counts',
  'Waiting',
  'ById',
  'Shadowed',
  'Typed',
];

function judged(): (names: string[]) => [name: string, isScalar: boolean, isValue: boolean][] {
  const loaded = loadProject(project({ 'src/types.ts': TYPES }));
  const values = new Values(loaded);
  const aliases = loaded.sources[0].syntax.statements.filter(ts.isTypeAliasDeclaration);
  return (names) =>
    names.map((name) => {
      const alias = aliases.find((declared) => declared.name.text === name);
      assert.ok(alias !== undefined, name);
      const type = loaded.checker.getTypeFromTypeNode(alias.type);
      return [name, values.isScalar(type), values.isValue(type)];
    });
}

test('numbers, texts, booleans, enums, literals, nothing and their unions are scalars, however they are named or branded', () => {
  assert.deepEqual(
    judged()(SCALARS),
    SCALARS.map((name) => [name, true, true]),
  );
});

test('a read-only list, tuple, set or map of the standard library is a value when all it holds are values, and no scalar', () => {
  assert.deepEqual(
    judged()(READONLY_COLLECTIONS_OF_VALUES),
    READONLY_COLLECTIONS_OF_VALUES.map((name) => [name, false, true]),
  );
});

test('whatever can be written through, or holds what can, is no value: a list, an object, read-only or not, a date, a function, any', () => {
  assert.deepEqual(
    judged()(NO_VALUES),
    NO_VALUES.map((name) => [name, false, false]),
  );
});

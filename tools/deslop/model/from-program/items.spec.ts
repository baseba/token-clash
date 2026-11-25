import { test } from 'node:test';
import assert from 'node:assert/strict';
import { heldBy, modelOf, named } from '../../testing/models.js';
import type { ItemId, Model } from '../model.js';

const fieldsOf = (model: Model): string[] => model.items.filter((item) => item.kind === 'field').map((item) => item.name);

const ACTION = `export type Action = { kind: 'move'; slot: number } | { kind: 'switch'; to: { bench: number } };

export function slotOf(action: Action): number {
  return action.kind === 'move' ? action.slot : action.to.bench;
}
`;

const TOURNAMENT = `export interface MatchRef {
  round: number;
}

export interface Seat {
  where: { row: number; column: number };
}

export class Tournament {
  current?: (MatchRef & { challengeId: string }) | null;

  constructor(readonly host: { id: string; name: string }) {}
}

export function challengeOf(tournament: Tournament, seat: Seat): unknown {
  return [tournament.current?.challengeId, tournament.current?.round, tournament.host.id, seat.where.row];
}
`;

const LIMIT = `export const Limit = { most: 4 };
export type Limit = typeof Limit;

export const double = (value: number): number => value * 2;
export const RULES = {
  twice(value: number): number {
    return double(value);
  },
};
`;

const PORTS = `export interface Closable {
  close(): void;
}

export abstract class Repository {
  abstract save(value: number): void;
}

export class Memory extends Repository implements Closable {
  private readonly values: number[] = [];
  readonly drain = (): number[] => this.values.splice(0);

  static empty(): Memory {
    return new Memory();
  }

  save(value: number): void {
    this.values.push(value);
  }

  close(): void {
    this.values.length = 0;
  }

  get size(): number {
    return this.values.length;
  }
}
`;

const PAIR = `export interface Sized {
  get size(): number;
  set size(size: number);
}

export class Queue {
  private start = 0;

  get head(): number {
    return this.start;
  }

  set head(head: number) {
    this.start = head;
  }
}
`;

const GATE = `export interface Gate {
  readonly open: boolean;
  level: number;
  get width(): number;
  set depth(depth: number);
}

export abstract class Frame {
  get height(): number {
    return 0;
  }
}

export class Door extends Frame implements Gate {
  private ajar = false;
  private steps = 0;

  get open(): boolean {
    return this.ajar;
  }

  set open(open: boolean) {
    this.ajar = open;
  }

  get level(): number {
    return this.steps;
  }

  set level(level: number) {
    this.steps = level;
  }

  get width(): number {
    return this.steps;
  }

  set width(width: number) {
    this.steps = width;
  }

  get depth(): number {
    return this.steps;
  }

  set depth(depth: number) {
    this.steps = depth;
  }

  override get height(): number {
    return this.steps;
  }

  override set height(height: number) {
    this.steps = height;
  }

  get tilt(): number {
    return this.steps;
  }
}
`;

const CONNECTION = `export interface Connection {
  trainerId: string | null;
  readonly open: boolean;
  send(frame: string): void;
}

export type Listener = { volume: number };

export abstract class Peer {
  abstract address: string;
  hops = 0;
}
`;

const SOCKET = `import { type Connection, type Listener, Peer } from './connection.js';

export class Socket extends Peer implements Connection, Listener {
  static opened = 0;
  trainerId: string | null = null;
  volume = 1;
  alive = true;

  constructor(readonly address: string) {
    super();
  }

  get open(): boolean {
    return this.alive;
  }

  send(frame: string): void {
    this.alive = frame !== '';
  }
}

export class Tunnel extends Socket {
  override trainerId: string | null = 'tunnel';
}
`;

const LISTED = `export interface Listed {
  items: string[];
  label: string;
}

export interface Sorted extends Listed {
  items: string[];
}

export class Shelf implements Sorted {
  items: string[] = [];
  label = 'shelf';
}

export class Held {
  items: string[] = [];
}

export class Rack extends Held implements Listed {
  label = 'rack';
}

export class Crate extends Rack {}
`;

const MIXED = `export class Base {
  items: string[] = [];
}

export function Mixin<Class extends new (...given: never[]) => object>(base: Class): Class {
  return base;
}

export class Mixed extends Mixin(Base) {}

export const Made = class extends Base {};

export class Plain extends Base {}
`;

test('the members of a type alias are its fields, once for each name, by the path that reaches them', () => {
  const model = modelOf({ 'src/action.ts': ACTION });
  assert.deepEqual(fieldsOf(model), ['Action::kind', 'Action::slot', 'Action::to', 'Action::to::bench']);
  assert.deepEqual(heldBy(model, 'slotOf'), ['Action', 'Action::kind', 'Action::slot', 'Action::to', 'Action::to::bench']);
});

test('a class or an interface has the fields it declares, not the members of the types they hold', () => {
  const model = modelOf({ 'src/tournament.ts': TOURNAMENT });
  assert.deepEqual(fieldsOf(model), ['MatchRef::round', 'Seat::where', 'Tournament::current', 'Tournament::host']);
  assert.deepEqual(heldBy(model, 'challengeOf'), ['MatchRef::round', 'Seat', 'Seat::where', 'Tournament', 'Tournament::current', 'Tournament::host']);
});

test('a constant and a type of one name are one thing, and a constant that holds a function is a function', () => {
  const model = modelOf({ 'src/limit.ts': LIMIT });
  assert.deepEqual(
    model.items.map((item) => [item.name, item.kind]),
    [
      ['Limit', 'type'],
      ['double', 'function'],
      ['RULES', 'constant'],
    ],
  );
  assert.deepEqual(heldBy(model, 'RULES'), ['double']);
});

test('a method takes self unless it is static or a constructor, and one an interface or a base class names is a trait impl', () => {
  const model = modelOf({ 'src/ports.ts': PORTS });
  const flags = (name: string) => named(model, name).map((item) => [item.kind, item.takesSelf, item.traitImpl]);
  assert.deepEqual(flags('Closable::close'), [['function', true, false]]);
  assert.deepEqual(flags('Repository::save'), [['function', true, false]]);
  assert.deepEqual(flags('Memory::save'), [['function', true, true]]);
  assert.deepEqual(flags('Memory::close'), [['function', true, true]]);
  assert.deepEqual(flags('Memory::size'), [['function', true, false]]);
  assert.deepEqual(flags('Memory::drain'), [['function', true, false]]);
  assert.deepEqual(flags('Memory::empty'), [['function', false, false]]);
  assert.deepEqual(flags('Memory::values'), [['field', false, false]]);
});

test('a getter or a setter is a trait impl when a type above its class declares a member of its name, or when it overrides one', () => {
  const model = modelOf({ 'src/gate.ts': GATE });
  const implemented = model.items.filter((item) => item.name.startsWith('Door::') && item.kind === 'function').map((item) => [item.name, item.traitImpl]);
  assert.deepEqual(implemented, [
    ['Door::open', true],
    ['Door::set open', true],
    ['Door::level', true],
    ['Door::set level', true],
    ['Door::width', true],
    ['Door::set width', true],
    ['Door::depth', true],
    ['Door::set depth', true],
    ['Door::height', true],
    ['Door::set height', true],
    ['Door::tilt', false],
  ]);
});

test('a static property that holds no function is a constant of its class and never a field', () => {
  const model = modelOf({ 'src/connection.ts': CONNECTION, 'src/socket.ts': SOCKET });
  assert.deepEqual(
    named(model, 'Socket::opened').map((item) => [item.kind, item.parent === undefined]),
    [['constant', false]],
  );
  assert.ok(!fieldsOf(model).includes('Socket::opened'));
  assert.ok(fieldsOf(model).includes('Socket::alive'));
});

test('a getter and a setter of one name are two functions', () => {
  const model = modelOf({ 'src/queue.ts': PAIR });
  assert.deepEqual(
    model.items.map((item) => [item.name, item.kind, item.takesSelf]),
    [
      ['Sized', 'type', false],
      ['Sized::size', 'function', true],
      ['Sized::set size', 'function', true],
      ['Queue', 'type', false],
      ['Queue::start', 'field', false],
      ['Queue::head', 'function', true],
      ['Queue::set head', 'function', true],
    ],
  );
  assert.deepEqual(heldBy(model, 'Queue::head'), ['Queue::start']);
  assert.deepEqual(heldBy(model, 'Queue::set head'), ['Queue::start']);
});

test('a field of a class implements the field of that name its interfaces declare, and none a base class declares', () => {
  const model = modelOf({ 'src/connection.ts': CONNECTION, 'src/socket.ts': SOCKET });
  const name = (item: ItemId) => model.items[item].name;
  const implemented = [...model.implementations].map(([field, by]) => `${name(field)} by ${by.map(name).join(', ')}`).sort();
  assert.deepEqual(implemented, [
    'Connection::open by Socket::open',
    'Connection::trainerId by Socket::trainerId',
    'Listener::volume by Socket::volume',
  ]);
});

test('a field implements the one an interface above its own declares, and the one a base class holds implements what a subclass promises', () => {
  const model = modelOf({ 'src/listed.ts': LISTED });
  const name = (item: ItemId) => model.items[item].name;
  const implemented = [...model.implementations].map(([field, by]) => `${name(field)} by ${by.map(name).join(', ')}`).sort();
  assert.deepEqual(implemented, ['Listed::items by Sorted::items, Held::items', 'Listed::label by Shelf::label, Rack::label', 'Sorted::items by Shelf::items']);
});

const SHOWN = `export interface Shown {
  readonly items: string[];
  label: string;
  size(): number;
}

export class Board implements Shown {
  private readonly kept: string[] = [];
  private name = '';

  get items(): string[] {
    return this.kept;
  }

  get label(): string {
    return this.name;
  }

  set label(label: string) {
    this.name = label;
  }

  size(): number {
    return this.kept.length;
  }
}
`;

test('a getter and a setter of a class implement the field of that name its interfaces declare, and a method implements no field', () => {
  const model = modelOf({ 'src/shown.ts': SHOWN });
  const name = (item: ItemId) => model.items[item].name;
  const implemented = [...model.implementations].map(([field, by]) => `${name(field)} by ${by.map(name).join(', ')}`).sort();
  assert.deepEqual(implemented, ['Shown::items by Board::items', 'Shown::label by Board::label, Board::set label']);
});

test('a class is a subclass of the class it extends, not of what it implements', () => {
  const model = modelOf({ 'src/listed.ts': LISTED, 'src/connection.ts': CONNECTION, 'src/socket.ts': SOCKET });
  const name = (item: ItemId) => model.items[item].name;
  const extended = [...model.subclasses].map(([base, by]) => `${name(base)} by ${by.map(name).join(', ')}`).sort();
  assert.deepEqual(extended, ['Held by Rack', 'Peer by Socket', 'Rack by Crate', 'Socket by Tunnel']);
});

test('a class that extends what a call returns, and a class written as an expression, are subclasses of no class', () => {
  const model = modelOf({ 'src/mixed.ts': MIXED });
  const name = (item: ItemId) => model.items[item].name;
  const extended = [...model.subclasses].map(([base, by]) => `${name(base)} by ${by.map(name).join(', ')}`);
  assert.deepEqual(extended, ['Base by Plain']);
  assert.deepEqual(
    named(model, 'Made').map((item) => item.kind),
    ['constant'],
  );
});

test('a class or a function exported as the default is an item named default', () => {
  const model = modelOf({
    'src/shape.ts': 'export default class {\n  area(): number {\n    return 1;\n  }\n}\n',
    'src/make.ts': 'export default function (): number {\n  return 2;\n}\n',
    'src/named.ts': 'export default class Named {}\n',
    'src/user.ts': `import make from './make.js';
import type Shape from './shape.js';

export function area(shape: Shape): number {
  return shape.area() + make();
}
`,
  });
  assert.deepEqual(
    model.items.map((item) => [model.tree.display(item.owner), item.name, item.kind]),
    [
      ['src::make', 'default', 'function'],
      ['src::named', 'Named', 'type'],
      ['src::shape', 'default', 'type'],
      ['src::shape', 'default::area', 'function'],
      ['src::user', 'area', 'function'],
    ],
  );
  assert.deepEqual(heldBy(model, 'area'), ['default', 'default::area']);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../graph/graph.js';
import type { ItemId } from '../model/model.js';
import { Sample } from '../testing/sample.js';
import { type Files, keysOf, modelOf, wrapperOf } from '../testing/models.js';
import { project, runIn, workspace } from '../testing/workspace.js';
import { checkLeaks } from './leaks.js';

interface Queue {
  sample: Sample;
  admit: ItemId;
  head: ItemId;
  limit: ItemId;
}

function queue(): Queue {
  const sample = new Sample();
  const queueModule = sample.module('queue');
  const sched = sample.module('sched');
  const runQueue = sample.item(queueModule, 'RunQueue', 'type');
  const [items, head, limit] = ['items', 'head', 'limit'].map((field) => sample.member(runQueue, queueModule, `RunQueue::${field}`, 'field'));
  const full = sample.member(runQueue, queueModule, 'RunQueue::full', 'function');
  sample.model.items[full].takesSelf = true;
  for (const field of [items, head, limit]) sample.refer(full, field);
  const admit = sample.item(sched, 'admit', 'function');
  sample.refer(admit, items);
  return { sample, admit, head, limit };
}

const diagnose = (sample: Sample) => checkLeaks(sample.model, buildGraph(sample.model), undefined);
const keys = (sample: Sample) =>
  diagnose(sample)
    .map((diagnostic) => diagnostic.key)
    .sort();

function getter(sample: Sample, head: ItemId): ItemId {
  const owner = sample.model.items[head].owner;
  const runQueue = sample.model.items[head].parent;
  assert.ok(runQueue !== undefined);
  const made = sample.member(runQueue, owner, 'RunQueue::head', 'function');
  sample.refer(made, head);
  return made;
}

test('a field an outsider uses leaks from a struct that guards its others', () => {
  const { sample } = queue();
  const diagnostics = diagnose(sample);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::items']);
  assert.equal(diagnostics[0].message, '`RunQueue::items` is known outside `RunQueue`: 1 place in 1 module');
  assert.deepEqual(diagnostics[0].notes, ['src/sched.ts:4:1: `p::sched::admit`']);
  const modules = [{ places: 1, module: 'p::sched' }];
  assert.deepEqual(diagnostics[0].picture, { kind: 'spread', owner: 'p::queue::RunQueue', field: 'items', modules, others: ['kept: head, limit'] });
});

test('a getter is seen through and free code in the same file is an outsider', () => {
  const { sample, admit, head } = queue();
  const made = getter(sample, head);
  sample.model.wrappers.set(made, { kind: 'accessor', lent: [head], copied: [] });
  const drained = sample.item(sample.model.items[head].owner, 'drained', 'function');
  sample.refer(drained, made);
  sample.refer(admit, made);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::head', 'p::queue::RunQueue::items']);
  const ofHead = diagnose(sample).find((diagnostic) => diagnostic.key === 'p::queue::RunQueue::head');
  assert.deepEqual(ofHead?.notes, [
    'src/queue.ts:6:1: `p::queue::drained`, through `RunQueue::head`',
    'src/sched.ts:7:1: `p::sched::admit`, through `RunQueue::head`',
  ]);
  sample.model.wrappers.set(made, { kind: 'accessor', lent: [], copied: [head] });
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::items']);
});

test('a borrow a getter lends is no leak where its caller only reads it', () => {
  const { sample, admit, head } = queue();
  const made = getter(sample, head);
  sample.model.wrappers.set(made, { kind: 'accessor', lent: [head], copied: [] });
  sample.read(admit, made);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::items']);
  sample.refer(admit, made);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::head', 'p::queue::RunQueue::items']);
});

test('taking a copy of a field is no leak but the field is not kept', () => {
  const { sample, admit, head, limit } = queue();
  sample.read(admit, head);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::items']);
  sample.read(admit, limit);
  assert.deepEqual(keys(sample), []);
});

test('a struct that keeps nothing or does nothing guards nothing', () => {
  const { sample, admit, head, limit } = queue();
  sample.refer(admit, head);
  sample.refer(admit, limit);
  assert.deepEqual(keys(sample), []);
  const idle = queue().sample;
  for (const item of idle.model.items) item.takesSelf = false;
  assert.deepEqual(keys(idle), []);
});

function declaredIn(sample: Sample, type: string, implementing: ItemId): ItemId {
  const port = sample.item(sample.module('port'), type, 'type');
  const declared = sample.member(port, sample.model.items[port].owner, `${type}::head`, 'field');
  sample.model.implementations.set(declared, [implementing]);
  return declared;
}

test('a use of the field an interface declares is a use of the field that implements it', () => {
  const { sample, admit, head, limit } = queue();
  const declared = declaredIn(sample, 'Queue', head);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::items']);
  sample.refer(admit, declared);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::head', 'p::queue::RunQueue::items']);
  const ofHead = diagnose(sample).find((diagnostic) => diagnostic.key === 'p::queue::RunQueue::head');
  assert.deepEqual(ofHead?.notes, ['src/sched.ts:5:1: `p::sched::admit`, through `Queue::head`']);
  assert.ok(ofHead?.picture.kind === 'spread');
  assert.deepEqual(ofHead.picture.others, ['also known outside: items', 'kept: limit']);
  sample.read(admit, limit);
  assert.deepEqual(keys(sample), []);
});

test('a field only read through the interface it implements is still kept, so the type still guards', () => {
  const { sample, admit, head, limit } = queue();
  sample.read(admit, limit);
  sample.read(admit, declaredIn(sample, 'Queue', head));
  const diagnostics = diagnose(sample);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::items']);
  assert.ok(diagnostics[0].picture.kind === 'spread');
  assert.deepEqual(diagnostics[0].picture.others, ['kept: head']);
  sample.read(admit, head);
  assert.deepEqual(keys(sample), []);
});

test('a field that implements one of a field that implements another is used where the last is', () => {
  const { sample, admit, head } = queue();
  const wider = declaredIn(sample, 'Wide', declaredIn(sample, 'Queue', head));
  sample.refer(admit, wider);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::head', 'p::queue::RunQueue::items']);
});

const CONNECTION = 'export interface Connection {\n  trainerId: string | null;\n}\n';

const SOCKET = `import type { Connection } from './connection.js';
import { NO_ONE } from './lobby.js';

export class Socket implements Connection {
  trainerId: string | null = null;
  alive = true;
  KEPT
  send(): void {
    if (!this.alive) this.trainerId = NO_ONE;
  }
}
`;

const LOBBY = `import type { Connection } from './connection.js';

export const NO_ONE = null;

export function subscribe(connection: Connection, id: string): void {
  connection.trainerId = id;
}
`;

const GATEWAY = `import type { Socket } from './socket.js';

export function drop(socket: Socket): void {
  socket.alive = false;
}
`;

const WRITES = 'connection.trainerId = id;';

const connected = (kept: string, lobby = WRITES): Files => ({
  'src/connection.ts': CONNECTION,
  'src/socket.ts': SOCKET.replace('KEPT', kept),
  'src/lobby.ts': LOBBY.replace(WRITES, lobby),
  'src/gateway.ts': GATEWAY,
});

test('a field written through the interface its class implements leaks from the class, and its writer knows only the interface', () => {
  const files = connected('private sent = 0;\n');
  assert.deepEqual(keysOf(files), ['field-leak src::socket::Socket::alive', 'field-leak src::socket::Socket::trainerId']);
  const report = [
    'error[field-leak]: `Socket::trainerId` is known outside `Socket`: 1 place in 1 module',
    '  --> src/lobby.ts:6:1',
    '  = note: src/lobby.ts:6:1: `src::lobby::subscribe`, through `Connection::trainerId`',
    '    src::socket::Socket',
    '      trainerId ◀━━━ 1  src::lobby',
    '      also known outside: alive',
    '      kept: sent',
    '',
  ];
  const result = runIn(project(files));
  assert.ok(result.stdout.includes(report.join('\n')), result.stdout);
  assert.ok(result.stdout.endsWith('deslop-please: 2 errors, well done!\n'), result.stdout);
});

test('a class whose every field an outsider works on, some through an interface, guards nothing', () => {
  assert.deepEqual(keysOf(connected('')), []);
});

test('a class keeps the field an outsider only reads through an interface, so what is written beside it leaks', () => {
  assert.deepEqual(keysOf(connected('', 'if (connection.trainerId === id) return;')), ['field-leak src::socket::Socket::alive']);
});

const THING_STATE = 'export interface ThingState {\n  id: string;\n  items: string[];\n}\n';

const THING = `import type { ThingState } from './state.js';

export class Thing implements ThingState {
  id = 'thing';
  items: string[] = [];

  add(item: string): void {
    this.items.push(item);
  }
}
`;

const THING_MAPPER = `import type { ThingState } from './state.js';

export function label(state: ThingState): string {
  return state.id;
}
`;

const THING_USER = `import type { Thing } from './thing.js';

export function poke(thing: Thing): void {
  thing.items.push('x');
}
`;

test('a mapper that reads the state interface of a class does not stop the class from guarding what it mirrors', () => {
  const files = { 'src/state.ts': THING_STATE, 'src/thing.ts': THING, 'src/mapper.ts': THING_MAPPER, 'src/user.ts': THING_USER };
  const report = [
    'error[field-leak]: `Thing::items` is known outside `Thing`: 1 place in 1 module',
    '  --> src/user.ts:4:1',
    '  = note: src/user.ts:4:1: `src::user::poke`',
    '    src::thing::Thing',
    '      items ◀━━━ 1  src::user',
    '      kept: id',
    '',
  ];
  const result = runIn(project(files));
  assert.ok(result.stdout.includes(report.join('\n')), result.stdout);
  assert.deepEqual(keysOf(files), ['field-leak src::thing::Thing::items']);
});

const MIRROR = `import type { Connection } from './connection.js';

export class Mirror implements Connection {
  trainerId: string | null = null;

  clear(): void {
    this.trainerId = null;
  }
}
`;

const RELAY = `import type { Connection } from './connection.js';

export class Relay implements Connection {
  trainerId: string | null = null;
  private queued = 0;

  queue(): void {
    this.queued += 1;
  }
}
`;

test('a write through an interface leaks from each class that implements it and keeps a field, and from none that keeps nothing', () => {
  const adapters = { 'src/connection.ts': CONNECTION, 'src/socket.ts': SOCKET.replace('KEPT', 'private sent = 0;\n'), 'src/lobby.ts': LOBBY };
  const ofSocket = 'field-leak src::socket::Socket::trainerId';
  assert.deepEqual(keysOf({ ...adapters, 'src/mirror.ts': MIRROR }), [ofSocket]);
  const both = { ...adapters, 'src/relay.ts': RELAY };
  assert.deepEqual(keysOf(both), ['field-leak src::relay::Relay::trainerId', ofSocket]);
  const place = '1 place in 1 module\n  --> src/lobby.ts:6:1\n  = note: src/lobby.ts:6:1: `src::lobby::subscribe`, through `Connection::trainerId`\n';
  const report = runIn(project(both)).stdout;
  for (const adapter of ['Relay', 'Socket']) {
    assert.ok(report.includes(`error[field-leak]: \`${adapter}::trainerId\` is known outside \`${adapter}\`: ${place}`), report);
  }
});

const BASE = `export class Base {
  items: string[] = [];
  private added = 0;

  add(item: string): void {
    this.added += 1;
    this.items.push(item);
  }
}
`;

const DERIVED = `import { Base } from './base.js';

export class Derived extends Base {
  override items: string[] = ['seed'];
  private drained = 0;

  drain(): void {
    this.drained += 1;
    this.items.length = 0;
  }
}
`;

const BASE_USER = `import type { Base } from './base.js';

export function poke(base: Base): void {
  base.items.push('x');
}
`;

test('a field a subclass declares again is a field of its own, so work on the one of the base class leaks from the base class alone', () => {
  const hierarchy = { 'src/base.ts': BASE, 'src/derived.ts': DERIVED };
  assert.deepEqual(keysOf(hierarchy), []);
  assert.deepEqual(keysOf({ ...hierarchy, 'src/user.ts': BASE_USER }), ['field-leak src::base::Base::items']);
});

const HEIR = `import { Base } from './base.js';

export class Heir extends Base {
  drain(): void {
    this.items.length = 0;
  }
}
`;

const LAST_HEIR = `import { Heir } from './heir.js';

export class LastHeir extends Heir {
  clear(): void {
    this.items.length = 0;
  }
}
`;

test('a subclass that works on a field it inherits, however far down, is no outsider of the base class that declares it', () => {
  const line = { 'src/base.ts': BASE, 'src/heir.ts': HEIR, 'src/last-heir.ts': LAST_HEIR };
  assert.deepEqual(keysOf(line), []);
  const poked = runIn(project({ ...line, 'src/user.ts': BASE_USER }));
  const ofItems = 'error[field-leak]: `Base::items` is known outside `Base`: 1 place in 1 module\n  --> src/user.ts:4:1\n';
  assert.ok(poked.stdout.includes(ofItems), poked.stdout);
  assert.ok(poked.stdout.endsWith('deslop-please: 1 error, well done!\n'), poked.stdout);
});

const LENDING_BASE = `export class Base {
  protected items: string[] = [];
  private added = 0;

  list(): string[] {
    return this.items;
  }

  add(item: string): void {
    this.added += 1;
    this.items.push(item);
  }
}
`;

const HIDING_DERIVED = `import { Base } from './base.js';

export class Derived extends Base {
  protected override items: string[] = ['seed'];
  private drained = 0;

  drain(): void {
    this.drained += 1;
    this.items.length = 0;
  }
}
`;

const RELAYING_SIBLING = `import { Base } from './base.js';

export class Sibling extends Base {
  relist(): string[] {
    return this.list();
  }

  fill(): void {
    this.relist().push('x');
  }
}
`;

const SERVICE = `import type { Base } from './base.js';

export class Service {
  constructor(private readonly base: Base) {}

  list(): string[] {
    return this.base.list();
  }

  run(): void {
    RECEIVER.list().push('x');
  }
}
`;

test('what a class takes through a forwarder of its own that calls another object is work on the field of that object', () => {
  const lent = (receiver: string): Files => {
    return { 'src/base.ts': LENDING_BASE, 'src/derived.ts': HIDING_DERIVED, 'src/service.ts': SERVICE.replace('RECEIVER', receiver) };
  };
  const ofBase = ['field-leak src::base::Base::items'];
  assert.deepEqual(keysOf(lent('this.base')), ofBase);
  assert.deepEqual(keysOf(lent('this')), ofBase);
  const report = runIn(project(lent('this'))).stdout;
  assert.ok(report.includes('  = note: src/service.ts:11:1: `src::service::Service::run`, through `Service::list`\n'), report);
});

test('what a class takes through a forwarder of its own that calls on this or on super is still taken from itself', () => {
  const relaying = (receiver: string): Files => {
    return { 'src/base.ts': LENDING_BASE, 'src/derived.ts': HIDING_DERIVED, 'src/sibling.ts': RELAYING_SIBLING.replace('this.list()', `${receiver}.list()`) };
  };
  assert.deepEqual(keysOf(relaying('this')), []);
  assert.deepEqual(keysOf(relaying('super')), []);
  assert.equal(wrapperOf(modelOf(relaying('super')), 'Sibling::relist'), 'forwards to Base::list on []');
});

const VAULT = `export interface Task {
  id: number;
}

export interface Holder {
  kept: Task[];
}

export class Vault HERITAGE{
  kept: Task[] = [];
  private opened = 0;

  open(): number {
    this.opened += 1;
    return this.opened + this.kept.length;
  }
}
`;

const DRAINS: Record<string, string> = {
  local: `import type { Holder, Vault } from './vault.js';

export function drain(vault: Vault): void {
  const holder: Holder = vault;
  holder.kept.push({ id: 1 });
}
`,
  parameter: `import type { Holder, Vault } from './vault.js';

function empty(holder: Holder): void {
  holder.kept.length = 0;
}

export function drain(vault: Vault): void {
  empty(vault);
}
`,
  inline: `import type { Task, Vault } from './vault.js';

function empty(holder: { kept: Task[] }): void {
  holder.kept.length = 0;
}

export function drain(vault: Vault): void {
  empty(vault);
}
`,
};

test('an instance held or passed as a type its class does not declare hides its fields, and declaring the type makes them count', () => {
  const drained = (heritage: string, drain: string): string[] => keysOf({ 'src/vault.ts': VAULT.replace('HERITAGE', heritage), 'src/drain.ts': DRAINS[drain] });
  for (const drain of ['local', 'parameter', 'inline']) assert.deepEqual(drained('', drain), [], drain);
  for (const drain of ['local', 'parameter']) assert.deepEqual(drained('implements Holder ', drain), ['field-leak src::vault::Vault::kept'], drain);
  assert.deepEqual(drained('implements Holder ', 'inline'), []);
});

test('an operation on a whole instance from outside names none of its fields: this is a limit', () => {
  const drain = (body: string): string => `import type { Vault } from './vault.js';\n\nexport function drain(vault: Vault): void {\n  ${body}\n}\n`;
  const drained = (body: string): string[] => keysOf({ 'src/vault.ts': VAULT.replace('HERITAGE', ''), 'src/drain.ts': drain(body) });
  assert.deepEqual(drained('Object.assign(vault, { kept: [] });'), []);
  assert.deepEqual(drained('Object.values(vault).length = 0;'), []);
  assert.deepEqual(drained('vault.kept = [];'), ['field-leak src::vault::Vault::kept']);
});

test('a field of a value exported as the default is used by the module that exports it', () => {
  const exported = (expression: string): Files => ({
    'src/vault.ts': VAULT.replace('HERITAGE', ''),
    'src/shared.ts': `import { Vault } from './vault.js';\n\nconst vault = new Vault();\n\nexport default ${expression};\n`,
  });
  assert.deepEqual(keysOf(exported('vault.kept')), ['field-leak src::vault::Vault::kept']);
  assert.deepEqual(keysOf(exported('vault.kept.length')), ['field-leak src::vault::Vault::kept']);
  assert.deepEqual(keysOf(exported('vault')), []);
});

const ROOM = `export interface Seat {
  roomId: string | null;
}

export class Socket implements Seat {
  roomId: string | null = null;
  private sent = 0;

  send(): void {
    this.sent += 1;
  }
}
`;

const ABUSER = `import type { Seat } from './room.js';

export class Abuser {
  poke(this: Seat): void {
    this.roomId = 'x';
  }
}
`;

test('a method that takes this as another type works on the field of that type, not on one of its own class', () => {
  assert.deepEqual(keysOf({ 'src/room.ts': ROOM, 'src/abuser.ts': ABUSER }), ['field-leak src::room::Socket::roomId']);
});

function classWorkingOn(sample: Sample, name: string, field: ItemId): ItemId {
  const module = sample.module(name.toLowerCase());
  const type = sample.item(module, name, 'type');
  sample.refer(sample.member(type, module, `${name}::work`, 'function'), field);
  return type;
}

test('the classes a type extends and those that extend it are no outsiders of it, and a class beside it is', () => {
  const { sample, head } = queue();
  const runQueue = sample.model.items[head].parent;
  assert.ok(runQueue !== undefined);
  const base = classWorkingOn(sample, 'Base', head);
  const heir = classWorkingOn(sample, 'Heir', head);
  const lastHeir = classWorkingOn(sample, 'LastHeir', head);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::head', 'p::queue::RunQueue::items']);
  sample.extend(runQueue, base);
  sample.extend(heir, runQueue);
  sample.extend(lastHeir, heir);
  assert.deepEqual(keys(sample), ['p::queue::RunQueue::items']);
  sample.extend(classWorkingOn(sample, 'Rival', head), base);
  const ofHead = diagnose(sample).find((diagnostic) => diagnostic.key === 'p::queue::RunQueue::head');
  assert.deepEqual(ofHead?.notes, ['src/rival.ts:8:1: `p::rival::Rival::work`']);
});

const LINK = `import type { Hub } from './hub.js';

export interface Link {
  id: string | null;
  attach(hub: Hub): void;
}
`;

const HUB = `import type { Link } from './link.js';
import type { Plug } from './plug.js';

export class Hub {
  claim(link: Link): void {
    link.id = 'claimed';
  }
HOLDS}
`;

const HOLDS = `
  holds(plug: Plug): boolean {
    return plug !== undefined;
  }
`;

const PLUG = `import type { Hub } from './hub.js';
import type { Link } from './link.js';

export class Plug implements Link {
  id: string | null = null;
  private attached = 0;

  attach(hub: Hub): void {
    this.attached += 1;
    hub.claim(this);
  }
}
`;

test('a thing in a tangle with an interface is an outsider of the class that implements it, and one in a tangle with the class is not', () => {
  const wired = (holds: string): Files => ({ 'src/link.ts': LINK, 'src/hub.ts': HUB.replace('HOLDS', holds), 'src/plug.ts': PLUG });
  const circle = ['module-cycle src::hub,src::link', 'tangle src::hub::Hub,src::link::Link'];
  assert.deepEqual(keysOf(wired('')), ['field-leak src::plug::Plug::id', ...circle]);
  const report = runIn(project(wired(''))).stdout;
  assert.ok(report.includes('  = note: src/hub.ts:6:1: `src::hub::Hub::claim`, through `Link::id`\n'), report);
  assert.deepEqual(keysOf(wired(HOLDS)), ['module-cycle src::hub,src::link,src::plug', 'tangle src::hub::Hub,src::link::Link,src::plug::Plug']);
});

const LISTED = `export interface Listed {
  items: string[];
}

export interface Sorted extends Listed {
  items: string[];
}
`;

const SHELF = `import type { Sorted } from './listed.js';

export class Shelf implements Sorted {
  items: string[] = [];
  private sorts = 0;

  sort(): void {
    this.sorts += 1;
    this.items.sort();
  }
}
`;

const RACK = `import type { Listed } from './listed.js';

export class Held {
  items: string[] = [];
  private holds = 0;

  hold(item: string): void {
    this.holds += 1;
    this.items.push(item);
  }
}

export class Rack extends Held implements Listed {}
`;

const LISTED_USER = `import type { Listed } from './listed.js';

export function clear(listed: Listed): void {
  listed.items.length = 0;
}
`;

test('a write through an interface leaks from the class below an interface that declares the field again, and from the base class that holds it', () => {
  const files = { 'src/listed.ts': LISTED, 'src/shelf.ts': SHELF, 'src/rack.ts': RACK, 'src/user.ts': LISTED_USER };
  assert.deepEqual(keysOf(files), ['field-leak src::rack::Held::items', 'field-leak src::shelf::Shelf::items']);
  const report = runIn(project(files)).stdout;
  for (const owner of ['Held', 'Shelf']) {
    const place = '1 place in 1 module\n  --> src/user.ts:4:1\n  = note: src/user.ts:4:1: `src::user::clear`, through `Listed::items`\n';
    assert.ok(report.includes(`error[field-leak]: \`${owner}::items\` is known outside \`${owner}\`: ${place}`), report);
  }
});

test('the things in its tangle are insiders of a type', () => {
  const { sample, admit } = queue();
  const runQueue = sample.model.items.findIndex((item) => item.name === 'RunQueue') as ItemId;
  sample.refer(runQueue, admit);
  sample.refer(admit, runQueue);
  assert.deepEqual(keys(sample), []);
});

test('past seven, the places and the modules are counted and not listed', () => {
  const { sample } = queue();
  const items = sample.model.items.findIndex((item) => item.name === 'RunQueue::items') as ItemId;
  for (let i = 0; i < 9; i += 1) sample.refer(sample.item(sample.module(`user${i}`), 'peek', 'function'), items);
  const diagnostic = diagnose(sample)[0];
  assert.equal(diagnostic.message, '`RunQueue::items` is known outside `RunQueue`: 10 places in 10 modules');
  assert.equal(diagnostic.notes.length, 8);
  assert.equal(diagnostic.notes[7], 'and 3 more places');
  assert.ok(diagnostic.picture.kind === 'spread');
  assert.equal(diagnostic.picture.modules.length, 8);
  assert.deepEqual(diagnostic.picture.modules[7], { places: 3, module: 'in 3 more modules' });
});

test('a leaked field leaks however it is reached and not once the type does the work', () => {
  const runQueue = runIn(workspace('field-leak'));
  assert.equal(runQueue.code, 1);
  const report = [
    'error[field-leak]: `RunQueue::items` is known outside `RunQueue`: 4 places in 2 modules',
    '  --> src/sched/policy.ts:5:1',
    '  = note: src/sched/policy.ts:5:1: `src::sched::policy::admit`',
    '  = note: src/sched/policy.ts:10:1: `src::sched::policy::next`',
    '  = note: src/sched/report.ts:4:1: `src::sched::report::backlog`',
    '  = note: src/sched/report.ts:8:1: `src::sched::report::drained`',
    '    src::queue::ring::RunQueue',
    '      items ◀━┳━ 2  src::sched::policy',
    '              ┗━ 2  src::sched::report',
    '      also known outside: head',
    '      kept: limit',
    '',
  ];
  assert.ok(runQueue.stdout.includes(report.join('\n')), runQueue.stdout);
  const ofHead = 'error[field-leak]: `RunQueue::head` is known outside `RunQueue`: 1 place in 1 module\n  --> src/sched/policy.ts:11:1\n';
  assert.ok(runQueue.stdout.includes(ofHead), runQueue.stdout);
});

test('a getter names itself in the report of what it lends', () => {
  const getters = runIn(workspace('field-leak', ['getters']));
  assert.ok(getters.stdout.includes('  = note: src/sched/policy.ts:5:1: `src::sched::policy::admit`, through `RunQueue::itemsMut`\n'), getters.stdout);
  assert.ok(getters.stdout.includes('  = note: src/sched/policy.ts:11:1: `src::sched::policy::next`, through `RunQueue::setHead`\n'), getters.stdout);
});

test('across contexts a field leaks where it is written', () => {
  const result = runIn(workspace('two-contexts', ['vault', 'bump-vault']));
  assert.equal(result.code, 1);
  const ofLeaked = 'error[field-leak]: `Vault::leaked` is known outside `Vault`: 1 place in 1 module\n  --> src/app/bump.ts:4:1\n';
  assert.ok(result.stdout.includes(ofLeaked), result.stdout);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelOf, wrapperOf } from '../../testing/models.js';

const STORE = `export class Store {
  constructor(readonly size: number) {}

  find(id: number, deep: boolean): number {
    return deep ? id * 2 : this.size;
  }

  async save(id: number): Promise<number> {
    return id;
  }
}

export function build(size: number): Store {
  return new Store(size);
}
`;

const SERVICE = `import { Store, build } from './store.js';

export const make = (size: number): Store => build(size);

export class Service {
  private readonly key = 1;

  constructor(private readonly store: Store, private readonly spare: Store | undefined) {}

  static of(size: number): Store {
    return new Store(size);
  }

  find(id: number, deep: boolean): number {
    return this.store.find(id, deep);
  }

  async save(id: number): Promise<void> {
    await this.store.save(id);
  }

  shallow(id: number): number {
    return this.store.find(id, false);
  }

  own(deep: boolean): number {
    return this.store.find(this.key, deep);
  }

  maybe(id: number): Promise<number> | undefined {
    return this.spare?.save(id);
  }

  both(id: number, deep: boolean): number {
    this.store.save(id);
    return this.store.find(id, deep);
  }

  defaulted(id: number, deep = false): number {
    return this.store.find(id, deep);
  }

  optional(id: number, deep?: boolean): number {
    return this.store.find(id, deep ?? false);
  }
}
`;

const RELAY = `import type { Store } from './store.js';

export interface Finder {
  find(id: number, deep: boolean): number;
}

export class Relay implements Finder {
  constructor(private readonly store: Store) {}

  find(id: number, deep: boolean): number {
    return this.store.find(id, deep);
  }

  ask(store: Store, id: number, deep: boolean): number {
    return store.find(id, deep);
  }

  all(...ids: number[]): number {
    return sum(...ids);
  }

  some(ids: number[]): number {
    return sum(...ids);
  }
}

export function sum(...ids: number[]): number {
  return ids.length;
}

export function ping(count: number): number {
  return pong(count);
}

export function pong(count: number): number {
  return ping(count);
}
`;

const REGISTRY = `import { Store } from './store.js';

const fallback = new Store(1);

export function ask(store: Store = fallback, id: number, deep: boolean): number {
  return store.find(id, deep);
}

export function asked(store: Store, id: number, deep: boolean): number {
  return store.find(id, deep);
}

export class Registry {
  static readonly shared = new Store(2);

  static find(id: number, deep: boolean): number {
    return this.shared.find(id, deep);
  }

  static named(id: number, deep: boolean): number {
    return Registry.shared.find(id, deep);
  }

  static of(size: number): Store {
    return new Store(size);
  }

  static make(size: number): Store {
    return this.of(size);
  }

  static build(size: number): Store {
    return Registry.of(size);
  }
}
`;

const TOURNAMENT = `export function removeSeat(tournament: Tournament, index: number): void {
  tournament.seats.splice(index, 1);
}

export function isFull(tournament: Tournament): boolean {
  return tournament.seats.length >= tournament.size;
}

export function countOf(seats: string[]): number {
  return seats.length;
}

export class Clock {
  private ticks = 0;

  now(): number {
    return this.ticks * 2;
  }

  wind(ticks: number): void {
    this.ticks = ticks + 1;
  }

  sync(other: Tournament): void {
    this.ticks = other.size;
  }
}

export class Tournament {
  seats: string[] = [];
  size = 4;
  private readonly clock = new Clock();

  kick(index: number): void {
    removeSeat(this, index);
  }

  get full(): boolean {
    return isFull(this);
  }

  get time(): number {
    return this.clock.now();
  }

  set time(ticks: number) {
    this.clock.wind(ticks);
  }

  sync(): void {
    this.clock.sync(this);
  }

  count(): number {
    return countOf(this.seats);
  }

  static drop(tournament: Tournament, index: number): void {
    removeSeat(tournament, index);
  }
}
`;

test('a function that only passes its parameters on to one call is a forwarder', () => {
  const model = modelOf({ 'src/store.ts': STORE, 'src/service.ts': SERVICE });
  assert.equal(wrapperOf(model, 'build'), 'forwards to Store::constructor on []');
  assert.equal(wrapperOf(model, 'make'), 'forwards to build on []');
  assert.equal(wrapperOf(model, 'Service::of'), 'forwards to Store::constructor on []');
  assert.equal(wrapperOf(model, 'Service::find'), 'forwards to Store::find on [Service::store]');
  assert.equal(wrapperOf(model, 'Service::save'), 'forwards to Store::save on [Service::store]');
  for (const working of ['Service::shallow', 'Service::own', 'Service::maybe', 'Service::both', 'Store::find', 'Store::constructor']) {
    assert.equal(wrapperOf(model, working), 'works', working);
  }
});

test('a forwarder calls on a parameter, spreads only its rest, is no trait impl and never forwards in a circle', () => {
  const model = modelOf({ 'src/store.ts': STORE, 'src/relay.ts': RELAY });
  assert.equal(wrapperOf(model, 'Relay::ask'), 'forwards to Store::find on []');
  assert.equal(wrapperOf(model, 'Relay::all'), 'forwards to sum on []');
  assert.equal(wrapperOf(model, 'ping'), 'forwards to pong on []');
  for (const working of ['Relay::find', 'Relay::some', 'pong']) assert.equal(wrapperOf(model, working), 'works', working);
});

test('a parameter with a default is a value the function decides, so passing it on is no forwarding', () => {
  const model = modelOf({ 'src/store.ts': STORE, 'src/service.ts': SERVICE });
  assert.equal(wrapperOf(model, 'Service::defaulted'), 'works');
  assert.equal(wrapperOf(model, 'Service::optional'), 'works');
});

test('a receiver with a default is a value the function decides, so calling on it is no forwarding', () => {
  const model = modelOf({ 'src/store.ts': STORE, 'src/registry.ts': REGISTRY });
  assert.equal(wrapperOf(model, 'asked'), 'forwards to Store::find on []');
  assert.equal(wrapperOf(model, 'ask'), 'works');
});

test('this in a static method is the class, so a call on it is judged as one on the name of the class is', () => {
  const model = modelOf({ 'src/store.ts': STORE, 'src/registry.ts': REGISTRY });
  assert.equal(wrapperOf(model, 'Registry::named'), 'works');
  assert.equal(wrapperOf(model, 'Registry::find'), 'works');
  assert.equal(wrapperOf(model, 'Registry::build'), 'forwards to Registry::of on []');
  assert.equal(wrapperOf(model, 'Registry::make'), 'forwards to Registry::of on []');
});

test('this passed on as an argument is passed on like a parameter', () => {
  const model = modelOf({ 'src/tournament.ts': TOURNAMENT });
  assert.equal(wrapperOf(model, 'Tournament::kick'), 'forwards to removeSeat on []');
  assert.equal(wrapperOf(model, 'Tournament::full'), 'forwards to isFull on []');
  assert.equal(wrapperOf(model, 'Tournament::sync'), 'forwards to Clock::sync on [Tournament::clock]');
  assert.equal(wrapperOf(model, 'Tournament::drop'), 'forwards to removeSeat on []');
  assert.equal(wrapperOf(model, 'Tournament::count'), 'works');
});

test('a getter or a setter that only passes on to one call is a forwarder', () => {
  const model = modelOf({ 'src/tournament.ts': TOURNAMENT });
  assert.equal(wrapperOf(model, 'Tournament::time'), 'forwards to Clock::now on [Tournament::clock]');
  assert.equal(wrapperOf(model, 'Tournament::set time'), 'forwards to Clock::wind on [Tournament::clock]');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GLOBALS, type Judged, type Wrapped, assertVerdicts, assertWrappers, heldBy, modelOf, userOf } from '../../testing/models.js';

const VAULT = `export interface Limit {
  most: number;
}

export interface Port {
  view: number[];
}

export class Vault implements Port {
  items: number[] = [];
  ids: readonly number[] = [];
  count = 0;
  limit: Limit = { most: 1 };
  private opened = 0;

  open(): number {
    this.opened += 1;
    return this.opened;
  }

  getItems(): number[] {
    return this.items;
  }

  get all(): number[] {
    return this.items;
  }

  get view(): number[] {
    return this.items;
  }

  list = () => this.items;

  relayed(): number[] {
    const items = this.items;
    const again = items;
    return again;
  }

  cast(): number[] {
    return (this.items as number[])!;
  }

  getView(): readonly number[] {
    return this.items satisfies number[];
  }

  getIds(): readonly number[] {
    return this.ids;
  }

  getCount(): number {
    return this.count;
  }

  getLimit(): Limit {
    return this.limit;
  }

  parts(): [number[], number, number] {
    return [this.items, this.count, 1];
  }

  snapshot() {
    return { items: this.items, count: this.count, 'ids': this.ids };
  }

  shorthand() {
    const items = this.items;
    return { items };
  }

  setCount(count: number): void {
    this.count = count;
  }

  set total(count: number) {
    this.count = count;
  }

  setLater(count: number): void {
    const next = count;
    this.count = next;
  }

  swap(count: number): Limit {
    this.count = count;
    return this.limit;
  }

  withItems<Result>(each: (items: number[]) => Result): Result {
    return each(this.items);
  }

  withIds<Result>(each: (ids: readonly number[]) => Result): Result {
    const pass = each;
    return pass(this.ids);
  }

  size(): number {
    return this.items.length;
  }

  first(): number | undefined {
    return this.items[0];
  }

  copy(): number[] {
    return [...this.items];
  }

  sum(): number {
    return this.count + 1;
  }

  negated(): boolean {
    return !this.count;
  }

  guarded(): number[] {
    if (this.count > 0) return this.items;
    return this.items;
  }

  chosen(): number[] {
    return this.count ? this.items : this.items;
  }

  orElse(): number[] {
    return this.items ?? this.items;
  }

  cloned(): number[] {
    return structuredClone(this.items);
  }

  made(): Set<number> {
    return new Set(this.items);
  }

  templated(): string {
    return \`\${this.count}\`;
  }

  close(): void {
    this.count = 0;
  }

  reset(): void {
    this.items = [];
  }

  sync(): void {
    this.ids = this.items;
  }

  bump(count: number): void {
    this.count += count;
  }

  rebound(): number[] {
    let items = this.items;
    return items;
  }

  defaulted(count = 1): void {
    this.count = count;
  }

  inner(): number {
    return this.limit.most;
  }

  keyed(): object {
    return { [this.count]: this.items };
  }

  spread(): object {
    return { ...this.limit };
  }

  closed(): () => number[] {
    return () => this.items;
  }

  async later(): Promise<number[]> {
    return await this.items;
  }

  *each(): Generator<number[]> {
    yield this.items;
  }

  none(): number {
    return 1;
  }

  of(vault: Vault): number[] {
    return vault.items;
  }

  static shared(vault: Vault): number[] {
    return vault.items;
  }
}

export class Heir extends Vault {
  inherited(): number[] {
    return this.items;
  }
}
`;

const FILES = { ...GLOBALS, 'src/vault.ts': VAULT };

const LENDS_ITEMS = 'lends [Vault::items] copies []';

const LENDS_COUNT = 'lends [Vault::count] copies []';

const ACCESSORS: Wrapped[] = [
  ['Vault::getItems', LENDS_ITEMS],
  ['Vault::all', LENDS_ITEMS],
  ['Vault::view', LENDS_ITEMS],
  ['Vault::list', LENDS_ITEMS],
  ['Vault::relayed', LENDS_ITEMS],
  ['Vault::cast', LENDS_ITEMS],
  ['Vault::getView', LENDS_ITEMS],
  ['Vault::getIds', 'lends [Vault::ids] copies []'],
  ['Vault::getCount', LENDS_COUNT],
  ['Vault::getLimit', 'lends [Vault::limit] copies []'],
  ['Vault::parts', 'lends [Vault::items] copies [Vault::count]'],
  ['Vault::snapshot', 'lends [Vault::items] copies [Vault::ids,Vault::count]'],
  ['Vault::shorthand', LENDS_ITEMS],
  ['Vault::setCount', LENDS_COUNT],
  ['Vault::set total', LENDS_COUNT],
  ['Vault::setLater', LENDS_COUNT],
  ['Vault::swap', 'lends [Vault::count,Vault::limit] copies []'],
  ['Vault::withItems', LENDS_ITEMS],
  ['Vault::withIds', 'lends [] copies [Vault::ids]'],
  ['Heir::inherited', LENDS_ITEMS],
];

const WORKING = [
  'open',
  'size',
  'first',
  'copy',
  'sum',
  'negated',
  'guarded',
  'chosen',
  'orElse',
  'cloned',
  'made',
  'templated',
  'close',
  'reset',
  'sync',
  'bump',
  'rebound',
  'defaulted',
  'inner',
  'keyed',
  'spread',
  'closed',
  'later',
  'each',
  'none',
  'of',
  'shared',
];

test('a method, a getter, a setter or an arrow property whose body only relays fields of its class is an accessor', () => {
  assertWrappers(modelOf(FILES), ACCESSORS);
});

test('a body with anything that is no relay is a working function, and so is one that writes a value the class decides', () => {
  assertWrappers(
    modelOf(FILES),
    WORKING.map((name) => [`Vault::${name}`, 'works']),
  );
});

const judge = (cases: Judged[]): void => assertVerdicts(FILES, 'Vault', cases);

test('a call of an accessor that returns one field is judged as the field is, with the type the call gives', () => {
  judge([
    ['hold(vault.getItems());', 'leaks'],
    ['hold(vault.getItems().length);', 'leaks'],
    ['hold(vault.getItems?.());', 'leaks'],
    ['hold(vault.all.length);', 'leaks'],
    ['hold(vault.list());', 'leaks'],
    ['if (vault.getItems()) hold();', 'reads'],
    ['hold(vault.getLimit().most);', 'reads'],
    ['vault.getLimit().most = 2;', 'leaks'],
    ['hold(vault.getIds().length, vault.getCount() + 1);', 'reads'],
    ['hold(vault.getView().length, vault.getView().map((item) => item));', 'reads'],
    ['hold((vault.getView() as number[]).length);', 'leaks'],
  ]);
});

test('an accessor that is taken or named and not called leaks its field unless the field holds a value', () => {
  judge([
    ['hold(vault.getItems);', 'leaks'],
    ['hold(vault.getView);', 'leaks'],
    ['hold(vault.getCount, vault.getIds);', 'reads'],
    ['const { all } = vault;\n  hold(all);', 'leaks'],
    ['const { getCount } = vault;\n  hold(getCount);', 'reads'],
  ]);
});

test('an accessor that writes or calls back always leaks what is no value, and one that hands fields out in a literal is judged at its call', () => {
  judge([
    ['vault.setCount(1);', 'leaks'],
    ['vault.total = 1;', 'leaks'],
    ['vault.setLater(1);', 'leaks'],
    ['hold(vault.swap(1).most);', 'leaks'],
    ['vault.withItems((items) => hold(items));', 'leaks'],
    ['vault.withIds(hold);', 'reads'],
    ['hold(vault.parts());', 'leaks'],
    ['const [items] = vault.parts();\n  hold(items);', 'leaks'],
    ['hold(vault.parts()[1]);', 'leaks'],
    ['if (vault.parts()) hold();', 'reads'],
    ['hold(vault.snapshot().count);', 'reads'],
    ['hold(vault.snapshot().items);', 'leaks'],
  ]);
});

test('a call of a working method names none of its fields', () => {
  const model = modelOf({ ...FILES, 'src/user.ts': userOf('Vault', 'vault.guarded().push(vault.size());') });
  assert.deepEqual(heldBy(model, 'use'), ['Vault', 'Vault::guarded', 'Vault::size']);
});

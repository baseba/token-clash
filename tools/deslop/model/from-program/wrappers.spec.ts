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

  get seen(): readonly number[] {
    return this.items;
  }

  get wide(): number[] {
    return this.ids as number[];
  }

  get cap(): Limit {
    return this.limit;
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

  widen(): number[] {
    return this.ids as number[];
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

  set audited(count: number) {
    const items = this.items;
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

  echo(count: number): number {
    this.count = count;
    return this.count;
  }

  stamp(count: number) {
    this.count = count;
    return { items: this.items, ids: this.ids };
  }

  visit(each: (items: number[]) => void): Limit {
    each(this.items);
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

  async promised(): Promise<number> {
    return this.count;
  }

  *each(): Generator<number[]> {
    yield this.items;
  }

  *ended(): Generator<never, number[]> {
    return this.items;
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

const LENDS_ITEMS = 'leaks [] lends [Vault::items] copies []';

const WRITES_COUNT = 'leaks [Vault::count] lends [] copies []';

const ACCESSORS: Wrapped[] = [
  ['Vault::getItems', LENDS_ITEMS],
  ['Vault::all', LENDS_ITEMS],
  ['Vault::view', LENDS_ITEMS],
  ['Vault::list', LENDS_ITEMS],
  ['Vault::relayed', LENDS_ITEMS],
  ['Vault::cast', LENDS_ITEMS],
  ['Vault::getView', LENDS_ITEMS],
  ['Vault::seen', LENDS_ITEMS],
  ['Vault::wide', 'leaks [] lends [Vault::ids] copies []'],
  ['Vault::getIds', 'leaks [] lends [Vault::ids] copies []'],
  ['Vault::widen', 'leaks [] lends [Vault::ids] copies []'],
  ['Vault::getCount', 'leaks [] lends [Vault::count] copies []'],
  ['Vault::getLimit', 'leaks [] lends [Vault::limit] copies []'],
  ['Vault::parts', 'leaks [] lends [Vault::items] copies [Vault::count]'],
  ['Vault::snapshot', 'leaks [] lends [Vault::items] copies [Vault::ids,Vault::count]'],
  ['Vault::shorthand', LENDS_ITEMS],
  ['Vault::setCount', WRITES_COUNT],
  ['Vault::set total', WRITES_COUNT],
  ['Vault::set audited', 'leaks [Vault::items,Vault::count] lends [] copies []'],
  ['Vault::setLater', WRITES_COUNT],
  ['Vault::swap', 'leaks [Vault::count] lends [Vault::limit] copies []'],
  ['Vault::echo', WRITES_COUNT],
  ['Vault::stamp', 'leaks [Vault::count] lends [Vault::items] copies [Vault::ids]'],
  ['Vault::withItems', 'leaks [Vault::items] lends [] copies []'],
  ['Vault::withIds', 'leaks [] lends [] copies [Vault::ids]'],
  ['Vault::visit', 'leaks [Vault::items,Vault::limit] lends [] copies []'],
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
  'promised',
  'each',
  'ended',
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

test('a method that is an accessor, taken or named and not called, is judged by the type it returns, not by the one its field declares', () => {
  judge([
    ['hold(vault.getItems);', 'leaks'],
    ['hold(vault.getView);', 'reads'],
    ['hold(vault.getCount, vault.getIds);', 'reads'],
    ['const { getCount } = vault;\n  hold(getCount);', 'reads'],
    ['const { getView } = vault;\n  hold(getView);', 'reads'],
    ['hold(vault.widen);', 'leaks'],
    ['const { widen } = vault;\n  widen().push(1);', 'leaks'],
  ]);
});

test('a getter taken by a pattern is judged by the type the getter gives, not by the one its field declares', () => {
  judge([
    ['const { all } = vault;\n  hold(all);', 'leaks'],
    ['const { seen } = vault;\n  hold(seen.length);', 'reads'],
    ['const { seen: mine } = vault;\n  hold(mine);', 'reads'],
    ["const { 'seen': mine } = vault;\n  hold(mine);", 'reads'],
    ['let seen: readonly number[] = [];\n  ({ seen } = vault);\n  hold(seen);', 'reads'],
    ['const { wide } = vault;\n  wide.push(1);', 'leaks'],
    ['let wide: readonly number[] = [];\n  ({ wide } = vault);\n  hold(wide);', 'leaks'],
    ['hold(vault.cap.most);', 'reads'],
    ['const {\n    cap: { most },\n  } = vault;\n  hold(most);', 'reads'],
    ['const { cap } = vault;\n  hold(cap);', 'leaks'],
    ['const { most } = vault.cap;\n  hold(most);', 'reads'],
    ['const { most } = vault.getLimit();\n  hold(most);', 'reads'],
    ['let most = 0;\n  ({\n    cap: { most },\n  } = vault);\n  hold(most);', 'reads'],
  ]);
});

test('a type that names a getter or a method does nothing to the field behind it', () => {
  judge([
    ['const all: typeof vault.all = [];\n  hold(all);', 'reads'],
    ['const items: ReturnType<typeof vault.getItems> = [];\n  hold(items);', 'reads'],
  ]);
});

test('an accessor always leaks the field it writes and, if it calls back, what is no value; its other fields are judged at its call', () => {
  judge([
    ['vault.setCount(1);', 'leaks'],
    ['vault.total = 1;', 'leaks'],
    ['[vault.total] = [1];', 'leaks'],
    ['({ count: vault.total } = { count: 1 });', 'leaks'],
    ['({ count: vault.total = 2 } = { count: 1 });', 'leaks'],
    ['for (vault.total of [1]) hold();', 'leaks'],
    ['vault.setLater(1);', 'leaks'],
    ['hold(vault.swap(1).most);', 'leaks'],
    ['if (vault.visit(hold)) hold();', 'leaks'],
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

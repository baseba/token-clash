import { Table } from './store/table.js';

export class Store {
  private readonly table: Table;
  private readonly limit: number;

  constructor(limit: number) {
    this.table = new Table();
    this.limit = limit;
  }

  getLimit(): number {
    return this.limit;
  }

  insert(key: number, value: number): boolean {
    if (this.table.count() >= this.limit) return false;
    this.table.put(key, value);
    return true;
  }

  get(key: number): number | undefined {
    const at = this.table.find(key);
    return at === undefined ? undefined : this.table.value(at);
  }

  remove(key: number): number | undefined {
    const at = this.table.find(key);
    return at === undefined ? undefined : this.table.take(at);
  }

  contains(key: number): boolean {
    return this.table.find(key) !== undefined;
  }

  room(): number {
    return this.limit - this.table.count();
  }

  isFull(): boolean {
    return this.room() === 0;
  }
}

export function total(store: Store, keys: readonly number[]): number {
  return keys.reduce((sum, key) => sum + (store.get(key) ?? 0), 0);
}

export function largest(store: Store, keys: readonly number[]): number | undefined {
  const found = keys.flatMap((key) => store.get(key) ?? []);
  return found.length === 0 ? undefined : Math.max(...found);
}

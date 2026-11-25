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

  private getTable(): Table {
    return this.table;
  }

  private count(): number {
    return this.table.count();
  }

  private find(key: number): number | undefined {
    return this.getTable().find(key);
  }

  private value(at: number): number {
    return this.getTable().value(at);
  }

  insert(key: number, value: number): boolean {
    if (this.count() >= this.getLimit()) return false;
    this.getTable().put(key, value);
    return true;
  }

  get(key: number): number | undefined {
    const at = this.find(key);
    return at === undefined ? undefined : this.value(at);
  }

  remove(key: number): number | undefined {
    const at = this.find(key);
    return at === undefined ? undefined : this.getTable().take(at);
  }

  contains(key: number): boolean {
    return this.find(key) !== undefined;
  }

  room(): number {
    return this.getLimit() - this.count();
  }

  isFull(): boolean {
    return this.room() === 0;
  }

  total(): number {
    let sum = 0;
    for (let at = 0; at < this.count(); at += 1) sum += this.value(at);
    return sum;
  }

  largest(): number | undefined {
    let most: number | undefined;
    for (let at = 0; at < this.count(); at += 1) most = Math.max(most ?? this.value(at), this.value(at));
    return most;
  }
}

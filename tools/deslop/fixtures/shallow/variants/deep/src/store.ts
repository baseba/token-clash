import { Table } from './store/table.js';

export class Store {
  private readonly table: Table;
  private readonly limit: number;

  constructor(limit: number) {
    this.table = new Table();
    this.limit = limit;
  }

  load(pairs: readonly (readonly [number, number])[]): number {
    for (const [key, value] of pairs) {
      if (this.isFull() || !this.insert(key, value)) this.remove(key);
    }
    return pairs.filter(([key]) => this.contains(key)).length;
  }

  summary(): number {
    let found = 0;
    for (let at = 0; at < this.table.count(); at += 1) found += this.get(this.table.value(at)) === undefined ? 0 : 1;
    return this.total() + (this.largest() ?? 0) + found + this.room();
  }

  private insert(key: number, value: number): boolean {
    if (this.table.count() >= this.limit) return false;
    this.table.put(key, value);
    return true;
  }

  private get(key: number): number | undefined {
    const at = this.table.find(key);
    return at === undefined ? undefined : this.table.value(at);
  }

  private remove(key: number): number | undefined {
    const at = this.table.find(key);
    return at === undefined ? undefined : this.table.take(at);
  }

  private contains(key: number): boolean {
    return this.table.find(key) !== undefined;
  }

  private room(): number {
    return this.limit - this.table.count();
  }

  private isFull(): boolean {
    return this.room() === 0;
  }

  private total(): number {
    let sum = 0;
    for (let at = 0; at < this.table.count(); at += 1) sum += this.table.value(at);
    return sum;
  }

  private largest(): number | undefined {
    let most: number | undefined;
    for (let at = 0; at < this.table.count(); at += 1) most = Math.max(most ?? this.table.value(at), this.table.value(at));
    return most;
  }
}

export class Table {
  private readonly keys: number[];
  private readonly values: number[];

  constructor() {
    this.keys = [];
    this.values = [];
  }

  count(): number {
    return this.keys.length;
  }

  put(key: number, value: number): void {
    const at = this.find(key);
    if (at === undefined) {
      this.keys.push(key);
      this.values.push(value);
    } else {
      this.values[at] = value;
    }
  }

  find(key: number): number | undefined {
    const at = this.keys.indexOf(key);
    return at === -1 ? undefined : at;
  }

  value(at: number): number {
    return this.values[at];
  }

  take(at: number): number {
    this.keys.splice(at, 1);
    return this.values.splice(at, 1)[0];
  }
}

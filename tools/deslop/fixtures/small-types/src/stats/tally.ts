export class Tally {
  private readonly counts: number[];

  constructor(levels: number) {
    this.counts = new Array<number>(Math.max(levels, 1)).fill(0);
  }

  record(level: number): void {
    this.counts[this.slot(level)] += 1;
  }

  count(level: number): number {
    return this.counts[this.slot(level)];
  }

  total(): number {
    return this.counts.reduce((sum, count) => sum + count, 0);
  }

  busiest(): number {
    return this.counts.indexOf(Math.max(...this.counts));
  }

  private slot(level: number): number {
    return Math.min(level, this.counts.length - 1);
  }
}

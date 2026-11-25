export class Rate {
  private readonly first: number;
  private last: number;
  private lines: number;

  constructor(first: number) {
    this.first = first;
    this.last = first;
    this.lines = 0;
  }

  observe(second: number): void {
    this.last = Math.max(this.last, second);
    this.lines += 1;
  }

  perSecond(): number {
    return Math.floor(this.lines / this.span());
  }

  private span(): number {
    return this.last - this.first + 1;
  }
}

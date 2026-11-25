export class RunQueue {
  items: number[];
  head: number;
  private readonly limit: number;

  constructor(limit: number) {
    this.items = [];
    this.head = 0;
    this.limit = limit;
  }

  full(): boolean {
    return this.items.length - this.head >= this.limit;
  }
}

export class RunQueue {
  private readonly items: number[];
  private head: number;
  private readonly limit: number;

  constructor(limit: number) {
    this.items = [];
    this.head = 0;
    this.limit = limit;
  }

  full(): boolean {
    return this.items.length - this.head >= this.limit;
  }

  getItems(): readonly number[] {
    const items = this.items;
    return items;
  }

  withItems<Result>(each: (items: number[]) => Result): Result {
    return each(this.items);
  }

  getHead(): number {
    const head = this.head;
    return head;
  }

  setHead(head: number): void {
    this.head = head;
  }
}

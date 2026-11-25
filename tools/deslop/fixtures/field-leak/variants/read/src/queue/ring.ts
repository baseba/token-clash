export class RunQueue {
  private readonly items: number[];
  head: number;
  private readonly limit: number;

  constructor(limit: number) {
    this.items = [];
    this.head = 0;
    this.limit = limit;
  }

  push(task: number): boolean {
    if (this.backlog() >= this.limit) return false;
    this.items.push(task);
    return true;
  }

  pop(): number | undefined {
    const task = this.items[this.head];
    if (task !== undefined) this.head += 1;
    return task;
  }

  backlog(): number {
    return this.items.length - this.head;
  }

  getLimit(): number {
    return this.limit;
  }
}

export interface Limit {
  most: number;
}

export class RunQueue {
  private readonly items: number[];
  head: number;
  private readonly limit: Limit;

  constructor(limit: number) {
    this.items = [];
    this.head = 0;
    this.limit = { most: limit };
  }

  push(task: number): boolean {
    if (this.backlog() >= this.limit.most) return false;
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

  getLimit(): Readonly<Limit> {
    return this.limit;
  }
}

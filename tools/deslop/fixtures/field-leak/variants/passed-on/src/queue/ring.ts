export class RunQueue {
  private readonly slots: Slots;
  private readonly limit: number;

  constructor(limit: number) {
    this.slots = new Slots();
    this.limit = limit;
  }

  full(): boolean {
    return this.slots.waiting() >= this.limit;
  }

  push(task: number): void {
    this.slots.push(task);
  }

  pop(): number | undefined {
    return this.slots.pop();
  }

  waiting(): number {
    return this.slots.waiting();
  }
}

class Slots {
  private readonly items: number[];
  private head: number;

  constructor() {
    this.items = [];
    this.head = 0;
  }

  push(task: number): void {
    this.items.push(task);
  }

  pop(): number | undefined {
    const task = this.items[this.head];
    if (task !== undefined) this.head += 1;
    return task;
  }

  waiting(): number {
    return this.items.length - this.head;
  }
}

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

export function admit(queue: RunQueue, task: number): boolean {
  if (queue.full()) return false;
  queue.items.push(task);
  return true;
}

export function next(queue: RunQueue): number | undefined {
  const task = queue.items[queue.head];
  if (task !== undefined) queue.head += 1;
  return task;
}

export function backlog(queue: RunQueue): number {
  return queue.items.filter((_task, at) => at >= queue.head).length;
}

export function drained(queue: RunQueue): boolean {
  return queue.items.at(queue.head) === undefined;
}

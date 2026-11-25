import type { RunQueue } from '../queue.js';

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

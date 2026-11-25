import type { RunQueue } from '../queue.js';

export function admit(queue: RunQueue, task: number): boolean {
  if (queue.full()) return false;
  queue.itemsMut().push(task);
  return true;
}

export function next(queue: RunQueue): number | undefined {
  const task = queue.getItems()[queue.getHead()];
  if (task !== undefined) queue.setHead(queue.getHead() + 1);
  return task;
}

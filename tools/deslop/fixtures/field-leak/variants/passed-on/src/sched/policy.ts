import type { RunQueue } from '../queue.js';

export function admit(queue: RunQueue, task: number): boolean {
  if (queue.full()) return false;
  queue.push(task);
  return true;
}

export function next(queue: RunQueue): number | undefined {
  return queue.pop();
}

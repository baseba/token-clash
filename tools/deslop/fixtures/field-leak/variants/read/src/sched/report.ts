import type { RunQueue } from '../queue.js';

export function backlog(queue: RunQueue): number {
  return queue.backlog();
}

export function drained(queue: RunQueue): boolean {
  return queue.backlog() === 0 || queue.head === queue.getLimit();
}

import type { RunQueue } from '../queue.js';

export function backlog(queue: RunQueue): number {
  return Math.min(queue.backlog(), queue.getLimit().most);
}

export function drained(queue: RunQueue): boolean {
  return queue.backlog() === 0 || queue.head === queue.getLimit().most;
}

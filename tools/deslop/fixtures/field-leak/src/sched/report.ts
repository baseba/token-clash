import type { RunQueue } from '../queue.js';

export function backlog(queue: RunQueue): number {
  return queue.items.filter((_task, at) => at >= queue.head).length;
}

export function drained(queue: RunQueue): boolean {
  return queue.items.at(queue.head) === undefined;
}

import type { RunQueue } from '../queue.js';

export function backlog(queue: RunQueue): number {
  const [items, head] = queue.parts();
  return items.filter((_task, at) => at >= head).length;
}

export function drained(queue: RunQueue): boolean {
  const [items, head] = queue.parts();
  return items.at(head) === undefined;
}

import type { RunQueue } from '../queue.js';

export function backlog(queue: RunQueue): number {
  return queue.getItems().filter((_task, at) => at >= queue.getHead()).length;
}

export function drained(queue: RunQueue): boolean {
  return queue.getItems().at(queue.getHead()) === undefined;
}

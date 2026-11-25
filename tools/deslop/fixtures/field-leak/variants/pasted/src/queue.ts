import { RunQueue } from './queue/ring.js';

export { RunQueue };
export { admit, backlog, drained, next } from './queue/ring.js';

export function fresh(limit: number): RunQueue {
  return new RunQueue(limit);
}

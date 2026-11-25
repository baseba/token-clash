import { RunQueue } from './queue/ring.js';

export { RunQueue };

export function fresh(limit: number): RunQueue {
  return new RunQueue(limit);
}

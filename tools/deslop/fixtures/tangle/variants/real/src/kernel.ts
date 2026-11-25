import type { Tasks } from './kernel/tasks.js';
import type { Timers } from './kernel/timers.js';

export function tick(now: number, tasks: Tasks, timers: Timers): void {
  for (const id of timers.fire(now)) tasks.wake(id);
}

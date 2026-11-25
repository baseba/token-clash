import { type RunQueue, fresh } from './queue.js';
import { admit, backlog, drained, next } from './sched.js';

export function run(tasks: readonly number[]): number {
  const ready = fresh(4);
  let ran = 0;
  for (const task of tasks) {
    if (!admit(ready, task)) ran += drain(ready);
  }
  return ran + backlog(ready);
}

function drain(ready: RunQueue): number {
  let ran = 0;
  while (!drained(ready)) {
    if (next(ready) !== undefined) ran += 1;
  }
  return ran;
}

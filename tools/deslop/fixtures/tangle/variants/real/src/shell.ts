import { Tasks } from './kernel/tasks.js';
import { Timers } from './kernel/timers.js';
import { tick } from './kernel.js';

export function banner(width: number): string {
  return '-'.repeat(width);
}

export function prompt(name: string): string {
  return `${name}> `;
}

export function boot(ids: readonly number[], until: number): number {
  const tasks = new Tasks();
  const timers = new Timers();
  for (const id of ids) tasks.spawn(id, timers);
  let awake = 0;
  for (let now = 0; now < until; now += 1) {
    tick(now, tasks, timers);
    awake = tasks.runnable();
  }
  return awake;
}

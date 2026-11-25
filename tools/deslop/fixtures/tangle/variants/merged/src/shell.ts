import { Tasks, Timers } from './kernel/scheduling.js';

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
    timers.fire(now, tasks);
    awake = tasks.runnable();
  }
  return awake;
}

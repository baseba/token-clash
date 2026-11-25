import type { Tasks } from '../kernel.js';

export class Timers {
  private due: [number, number][];

  constructor() {
    this.due = [];
  }

  arm(id: number, at: number): void {
    this.due.push([id, at]);
  }

  fire(now: number, tasks: Tasks): void {
    for (const [id, at] of this.due) {
      if (at <= now) tasks.wake(id);
    }
    this.due = this.due.filter(([, at]) => at > now);
  }
}

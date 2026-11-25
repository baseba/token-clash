import type { Timers } from './kernel/timers.js';

export interface Task {
  id: number;
  asleep: boolean;
}

export class Tasks {
  private readonly list: Task[];

  constructor() {
    this.list = [];
  }

  spawn(id: number, timers: Timers): void {
    this.list.push({ id, asleep: true });
    timers.arm(id, 10);
  }

  wake(id: number): void {
    for (const task of this.list) {
      if (task.id === id) task.asleep = false;
    }
  }

  runnable(): number {
    return this.list.filter((task) => !task.asleep).length;
  }
}

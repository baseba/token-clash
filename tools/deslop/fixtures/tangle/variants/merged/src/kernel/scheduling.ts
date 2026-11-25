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

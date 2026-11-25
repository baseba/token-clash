import { backlogMost } from './limits.js';

export class Stream {
  private readonly backlog: number;
  private pending: number;

  constructor(backlog: number) {
    this.backlog = Math.min(backlog, backlogMost());
    this.pending = 0;
  }

  accept(): boolean {
    const room = this.pending < this.backlog;
    if (room) this.pending += 1;
    return room;
  }
}

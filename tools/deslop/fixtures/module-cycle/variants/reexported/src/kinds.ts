import { BACKLOG_MOST } from './limits.js';

export class Stream {
  private readonly backlog: number;
  private pending: number;

  constructor(backlog: number) {
    this.backlog = Math.min(backlog, BACKLOG_MOST);
    this.pending = 0;
  }

  accept(): boolean {
    const room = this.pending < this.backlog;
    if (room) this.pending += 1;
    return room;
  }
}

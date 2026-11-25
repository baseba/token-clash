import { Stream } from './kinds.js';

export const BACKLOG_MOST = 16;

export function listen(backlog: number): Stream {
  return new Stream(backlog);
}

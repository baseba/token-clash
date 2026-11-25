import { Stream } from './kinds.js';

export function listen(backlog: number): Stream {
  return new Stream(backlog);
}

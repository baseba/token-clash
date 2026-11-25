import type { Stream } from '../kinds.js';
import { listen } from '../socket.js';

export function stream(): Stream {
  return listen(1);
}

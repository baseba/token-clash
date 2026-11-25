import type { Ready } from './kinds.js';
import { send } from './socket/datagram.js';

export { send };

export function sendNow(): Ready {
  return send();
}

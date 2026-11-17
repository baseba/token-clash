// Ids and time, in one place so they are easy to spot (and to fake) instead of being sprinkled
// as Date.now() and randomBytes() all over the use cases.
import { createHash, randomBytes } from 'node:crypto';

export const now = () => Date.now();

/** Short url-safe id: 6 bytes → 8 characters (rooms, tournaments, trainers). */
export const newId = (bytes = 9) => randomBytes(bytes).toString('base64url');

/** A secret session token. Only its hash is stored. */
export const newToken = () => randomBytes(24).toString('base64url');

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

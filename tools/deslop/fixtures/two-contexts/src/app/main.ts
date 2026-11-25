import { type Kept, Shown } from '../lib.js';
import { Hidden } from '../lib/inner.js';

export function main(kept: Kept): unknown[] {
  return [new Hidden(), new Shown(), kept.part];
}

import type { SpecOnly } from './vault.js';

export function probe(vault: SpecOnly): void {
  vault.probed.push(1);
}

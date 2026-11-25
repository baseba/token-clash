import type { Plain } from '../lib/vault.js';

export function bumpPlain(plain: Plain): void {
  plain.width += 1;
}

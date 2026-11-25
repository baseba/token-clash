import type { Vault } from '../lib/vault.js';

export function bumpVault(vault: Vault): void {
  vault.leaked += 1;
}

import type { Vault } from '../lib/vault.js';

export function readVault(vault: Vault): number {
  return vault.leaked;
}

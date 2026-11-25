import { Vault } from './vault.js';

export function peeks(): number {
  const vault = new Vault();
  vault.leaked += 1;
  return vault.leaked;
}

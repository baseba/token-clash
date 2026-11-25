import { Store } from './store.js';

export function run(pairs: readonly (readonly [number, number])[]): number {
  const store = new Store(8);
  const kept = store.load(pairs);
  return store.summary() + kept;
}

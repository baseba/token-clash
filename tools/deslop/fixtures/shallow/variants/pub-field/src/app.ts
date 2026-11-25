import { Store } from './store.js';

export function run(pairs: readonly (readonly [number, number])[]): number {
  const store = new Store(8);
  for (const [key, value] of pairs) {
    if (store.isFull() || !store.insert(key, value)) store.remove(key);
  }
  const kept = pairs.filter(([key]) => store.contains(key)).length;
  const found = pairs.filter(([key]) => store.get(key) !== undefined).length;
  const rest = kept + found + store.room() + store.limit;
  return store.total() + (store.largest() ?? 0) + rest;
}

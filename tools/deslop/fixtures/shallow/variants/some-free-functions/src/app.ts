import { Store, largest, total } from './store.js';

export function run(pairs: readonly (readonly [number, number])[]): number {
  const store = new Store(8);
  for (const [key, value] of pairs) {
    if (store.isFull() || !store.insert(key, value)) store.remove(key);
  }
  const kept = pairs.filter(([key]) => store.contains(key)).length;
  const found = pairs.filter(([key]) => store.get(key) !== undefined).length;
  const rest = kept + found + store.room() + store.getLimit();
  const keys = pairs.map(([key]) => key);
  return total(store, keys) + (largest(store, keys) ?? 0) + rest;
}

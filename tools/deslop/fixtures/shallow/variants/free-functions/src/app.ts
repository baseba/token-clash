import { Store, contains, get, insert, isFull, largest, remove, room, total } from './store.js';

export function run(pairs: readonly (readonly [number, number])[]): number {
  const held = new Store(8);
  for (const [key, value] of pairs) {
    if (isFull(held) || !insert(held, key, value)) remove(held, key);
  }
  const kept = pairs.filter(([key]) => contains(held, key)).length;
  const found = pairs.filter(([key]) => get(held, key) !== undefined).length;
  const rest = kept + found + room(held) + held.getLimit();
  return total(held) + (largest(held) ?? 0) + rest;
}

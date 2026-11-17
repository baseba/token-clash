/** Drops the keys whose column was NULL, so a restored aggregate looks like the one that was saved. */
export function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;
}

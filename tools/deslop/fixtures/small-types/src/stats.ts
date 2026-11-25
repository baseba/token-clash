export { Rate } from './stats/rate.js';
export { Tally } from './stats/tally.js';
export { Window } from './stats/window.js';

export function percent(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.floor((part * 100) / whole);
}

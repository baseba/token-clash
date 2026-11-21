export const STAT_KEYS = ['hp', 'atk', 'def', 'satk', 'sdef', 'spd'];
export const MAX_EV = 252;
export const MAX_EV_TOTAL = 510;

export function statValue(key, base, iv, ev, level, natureMultiplier = 1) {
  const core = Math.floor(((2 * base + iv + Math.floor(ev / 4)) * level) / 100);
  if (key === 'hp') return base === 1 ? 1 : core + level + 10;
  return Math.floor((core + 5) * natureMultiplier);
}

export const evTotal = (evs) => STAT_KEYS.reduce((sum, key) => sum + (evs?.[key] ?? 0), 0);

export function validEvs(evs) {
  return STAT_KEYS.every((key) => Number.isInteger(evs?.[key]) && evs[key] >= 0 && evs[key] <= MAX_EV) && evTotal(evs) <= MAX_EV_TOTAL;
}

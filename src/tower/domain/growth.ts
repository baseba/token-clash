import { lineage, lineageLearnset, speciesData } from '../../catalog/domain/creatures.js';
import { MAX_LEVEL } from '../../catalog/domain/tower-cast.js';
import { MOVES_PER_FIGHTER } from '../../combat/domain/fighter.js';
import { moveData } from '../../combat/domain/moves.js';
import { alwaysDamages } from '../../combat/domain/random-party.js';

const FIRST_FAIR_LEVEL = 10;
const LEVELS_AFTER_PREVIOUS = 6;
const LAST_FAIR_LEVEL = 60;
const HIGHEST_SPECIES = 1025;
const TRAINER_BONUS = 1.5;
const CLIMB_BONUS = 4;
const BOSS_BONUS = 1.5;

export const expForLevel = (level: number): number => Math.min(level, MAX_LEVEL) ** 3;

export function levelForExp(exp: number): number {
  let level = Math.max(1, Math.floor(Math.cbrt(exp)));
  while (level < MAX_LEVEL && expForLevel(level + 1) <= exp) level++;
  while (level > 1 && expForLevel(level) > exp) level--;
  return Math.min(level, MAX_LEVEL);
}

export const baseStatTotal = (speciesId: number): number => speciesData(speciesId)?.stats.reduce((sum, stat) => sum + stat, 0) ?? 300;

export const baseExperience = (speciesId: number): number => Math.round(baseStatTotal(speciesId) ** 2 / 1300);

export function expYield({ speciesId, level }: { speciesId: number; level: number }, ownLevel: number, boss: boolean): number {
  const scaled = ((baseExperience(speciesId) * level) / 5) * ((2 * level + 10) / (level + ownLevel + 10)) ** 2.5;
  return Math.floor((Math.floor(scaled) + 1) * TRAINER_BONUS * CLIMB_BONUS * (boss ? BOSS_BONUS : 1));
}

export const evolutionPath = (finalId: number): number[] => lineage(finalId).reverse();

const evolutionStage = (speciesId: number): number => Math.min(2, Math.max(1, speciesData(speciesId)?.stage ?? 1));

const LEVEL_FIT: ReadonlyMap<number, { slope: number; base: number }> = (() => {
  const points = new Map<number, [number, number][]>();
  for (let id = 1; id <= HIGHEST_SPECIES; id++) {
    const data = speciesData(id);
    if (!data?.evolvesFrom || !data.evolvesAt) continue;
    const stage = evolutionStage(id);
    points.set(stage, [...(points.get(stage) ?? []), [baseStatTotal(id), data.evolvesAt]]);
  }
  const fits = new Map<number, { slope: number; base: number }>();
  for (const [stage, list] of points) {
    const meanX = list.reduce((sum, [x]) => sum + x, 0) / list.length;
    const meanY = list.reduce((sum, [, y]) => sum + y, 0) / list.length;
    const slope = list.reduce((sum, [x, y]) => sum + (x - meanX) * (y - meanY), 0) / (list.reduce((sum, [x]) => sum + (x - meanX) ** 2, 0) || 1);
    fits.set(stage, { slope, base: meanY - slope * meanX });
  }
  return fits;
})();

function fairLevel(speciesId: number, previous: number): number {
  const fit = LEVEL_FIT.get(evolutionStage(speciesId)) ?? { slope: 0, base: FIRST_FAIR_LEVEL };
  const fitted = Math.round(fit.base + fit.slope * baseStatTotal(speciesId));
  return Math.min(LAST_FAIR_LEVEL, Math.max(previous ? previous + LEVELS_AFTER_PREVIOUS : FIRST_FAIR_LEVEL, fitted));
}

export function evolutionLevel(speciesId: number): number | null {
  const data = speciesData(speciesId);
  if (!data?.evolvesFrom) return null;
  if (data.evolvesAt) return data.evolvesAt;
  return fairLevel(speciesId, evolutionLevel(data.evolvesFrom) ?? 0);
}

export function formAtLevel(finalId: number, level: number): number {
  const path = evolutionPath(finalId);
  let form = path[0];
  for (const next of path.slice(1)) {
    if ((evolutionLevel(next) ?? Infinity) > level) break;
    form = next;
  }
  return form;
}

const learnable = (id: string): boolean => !!moveData(id)?.supported;

export function levelMovesUpTo(speciesId: number, level: number): string[] {
  return [...lineageLearnset(speciesId)]
    .filter(([id, learned]) => learnable(id) && learned.level <= level)
    .sort((a, b) => a[1].level - b[1].level || a[0].localeCompare(b[0]))
    .map(([id]) => id);
}

export function movesAtLevel(speciesId: number, level: number, chosen: readonly string[] = []): string[] {
  const reached = levelMovesUpTo(speciesId, level);
  const kept = chosen.filter((id) => reached.includes(id));
  const latest = reached.filter((id) => !kept.includes(id)).reverse();
  const moves = [...kept, ...latest].slice(0, MOVES_PER_FIGHTER);
  if (moves.some(alwaysDamages)) return moves;
  const attack = reached.find(alwaysDamages) ?? levelMovesUpTo(speciesId, MAX_LEVEL).find(alwaysDamages);
  if (!attack) return moves.length ? moves : ['tackle'];
  return [attack, ...moves.filter((id) => id !== attack)].slice(0, MOVES_PER_FIGHTER);
}

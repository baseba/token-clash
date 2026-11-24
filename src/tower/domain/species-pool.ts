import { finalForms, hash, speciesData } from '../../catalog/domain/creatures.js';
import { DEX_LIMIT } from '../../catalog/domain/pokedex.js';
import { aiPool, canAttack } from '../../combat/domain/ai.js';
import { baseStatTotal, evolutionPath } from './growth.js';

const LEGENDARY_TOTAL = 580;
const STAND_IN_CHOICES = 6;
const STRONGER_BY = 30;
const PRIMARY_TYPE = 0.5;

const isLegend = (speciesId: number): boolean => baseStatTotal(speciesId) >= LEGENDARY_TOTAL && evolutionPath(speciesId).length === 1;

export const inDex = (speciesId: number): boolean => speciesId >= 1 && speciesId <= DEX_LIMIT;

let pool: number[] | null = null;

export function towerSpecies(): number[] {
  pool ??= aiPool().filter((id) => finalForms(id, DEX_LIMIT).every((final) => final === id) && canAttack(id));
  return pool;
}

export function standInFor(speciesId: number, seed: string, type: string | null = null): number {
  if (inDex(speciesId)) return speciesId;
  const types = speciesData(speciesId)?.types ?? [];
  const total = baseStatTotal(speciesId);
  const typesOf = (id: number) => speciesData(id)?.types ?? [];
  const likeness = (id: number) => typesOf(id).filter((own) => types.includes(own)).length + (typesOf(id).includes(types[0]) ? PRIMARY_TYPE : 0);
  const fitting = towerSpecies().filter((id) => baseStatTotal(id) <= total + STRONGER_BY && !isLegend(id) && (!type || typesOf(id).includes(type)));
  const most = Math.max(...fitting.map(likeness));
  const closest = fitting
    .filter((id) => likeness(id) === most)
    .sort((a, b) => Math.abs(baseStatTotal(a) - total) - Math.abs(baseStatTotal(b) - total) || a - b)
    .slice(0, STAND_IN_CHOICES);
  return closest[hash(seed) % closest.length];
}

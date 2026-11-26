import { finalForms } from '../../catalog/domain/creatures.js';
import { aiPool, canAttack } from '../../combat/domain/ai.js';

let pool: number[] | null = null;

export function towerSpecies(): number[] {
  pool ??= aiPool().filter((id) => finalForms(id).every((final) => final === id) && canAttack(id));
  return pool;
}

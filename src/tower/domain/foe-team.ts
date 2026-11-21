// The team of the trainer on a floor: species of its types, in the form they have at that level,
// moves learned by level, and its strongest Pokémon (the ace) a level above the rest. Harder
// difficulties and tough rivals draw from stronger species and train them; calm rivals bring the
// weakest of their theme.
import { finalForms, PERFECT_IVS, shuffled, speciesData, type Random } from '../../catalog/domain/creatures.js';
import type { Ivs, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { AI_POOL_SHARE, aiTeamPool, type AiLevel } from '../../combat/domain/ai.js';
import type { Floor } from './floors.js';
import { baseStatTotal, evolutionPath, formAtLevel, movesAtLevel } from './growth.js';

const LEGENDARY_TOTAL = 580;
const LEGENDS_FROM_FLOOR = 40;
const EVS_PER_FLOOR = 8;
const MAX_EV = 252;
const FAST_SPEED = 80;
const FEWEST_CHOICES = 6;

/** Early routes have weak Pokémon: the form a species has at that level must fit this stat total. */
const powerCap = (level: number): number => 300 + level * 8;
const STRONG_BONUS = 40;
/** Below this level a team knows little more than Normal moves, and a Ghost would be unbeatable. */
const GHOSTS_FROM_LEVEL = 15;

/** The trainer's theme first: a Hiker only brings Rock or Ground, a leader only its type. */
function candidates(floor: Floor, difficulty: AiLevel): number[] {
  const legends = floor.kind === 'champion' || floor.number >= LEGENDS_FROM_FLOOR;
  const all = aiTeamPool('easy').filter((id) => legends || baseStatTotal(id) < LEGENDARY_TOTAL);
  const themed = floor.types.length ? all.filter((id) => speciesData(id)?.types.some((type) => floor.types.includes(type))) : all;
  const strength = (id: number) => baseStatTotal(formAtLevel(id, floor.level));
  const beatable = themed.filter((id) => floor.level >= GHOSTS_FROM_LEVEL || !speciesData(formAtLevel(id, floor.level))?.types.includes('ghost'));
  const pool = beatable.length ? beatable : themed;
  const cap = powerCap(floor.level) + (floor.strength === 'strong' ? STRONG_BONUS : 0);
  const fitting = pool.filter((id) => strength(id) <= cap);
  const usable = fitting.length >= FEWEST_CHOICES ? fitting : [...pool].sort((a, b) => strength(a) - strength(b)).slice(0, Math.max(FEWEST_CHOICES, fitting.length));
  const ranked = [...usable].sort((a, b) => strength(b) - strength(a) || a - b);
  if (floor.strength === 'weak') return ranked.slice(-Math.max(FEWEST_CHOICES, Math.ceil(ranked.length / 2)));
  const share = floor.strength === 'strong' ? Math.min(AI_POOL_SHARE[difficulty], 0.35) : AI_POOL_SHARE[difficulty];
  return ranked.slice(0, Math.max(FEWEST_CHOICES, Math.ceil(ranked.length * share)));
}

function training(speciesId: number, floor: number): { natureChoice: string; evs: Ivs } {
  const [, attack, , specialAttack, , speed] = speciesData(speciesId)?.stats ?? [0, 0, 0, 0, 0, 0];
  const physical = attack >= specialAttack;
  const fast = speed >= FAST_SPEED;
  const amount = Math.min(MAX_EV, floor * EVS_PER_FLOOR);
  return {
    natureChoice: physical ? (fast ? 'jolly' : 'adamant') : fast ? 'timid' : 'modest',
    evs: { hp: 0, atk: physical ? amount : 0, def: 0, satk: physical ? 0 : amount, sdef: 0, spd: amount },
  };
}

export function foeTeam(floor: Floor, difficulty: AiLevel, random: Random): RosterEntry[] {
  const themed = floor.species.map((id) => finalForms(id)[0] ?? id).filter((id) => speciesData(id));
  const pool = candidates(floor, difficulty);
  const finals: number[] = [];
  for (const id of shuffled(themed, random)) if (finals.length < floor.teamSize - (floor.signature ? 1 : 0) && !finals.includes(id)) finals.push(id);
  while (finals.length < floor.teamSize - (floor.signature ? 1 : 0) && finals.length < pool.length + themed.length) {
    const pick = pool[Math.floor(random() * pool.length)];
    if (!finals.includes(pick) && pick !== floor.signature) finals.push(pick);
  }
  finals.sort((a, b) => baseStatTotal(a) - baseStatTotal(b));
  if (floor.signature) finals.push(floor.signature);
  const forms = new Set<number>();
  const distinct = finals.filter((id) => {
    const form = formAtLevel(id, floor.level);
    if (forms.has(form)) return false;
    forms.add(form);
    return true;
  });
  for (const id of pool) {
    if (distinct.length >= finals.length) break;
    const form = formAtLevel(id, floor.level);
    if (!forms.has(form)) {
      forms.add(form);
      distinct.splice(distinct.length - (floor.signature ? 1 : 0), 0, id);
    }
  }
  finals.splice(0, finals.length, ...distinct);
  return finals.map((finalId, index) => {
    const ace = index === finals.length - 1;
    const level = Math.max(2, ace ? floor.level + (floor.strength === 'strong' ? 1 : 0) : floor.level - Math.floor(random() * 2));
    const form = formAtLevel(finalId, level);
    return {
      id: `tower-${floor.number}-${index}-${form}`,
      finalID: form,
      baseID: evolutionPath(finalId)[0],
      rarity: 'common',
      shiny: false,
      level,
      battleLevel: level,
      ivs: PERFECT_IVS,
      learned: [],
      moveset: movesAtLevel(form, level),
      ...(floor.trained ? training(form, floor.number) : {}),
    };
  });
}

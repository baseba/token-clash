// The team of the trainer on a floor: species of its types, in the form they have at that level,
// moves learned by level, and its strongest Pokémon (the ace) a level above the rest when the rival is
// strong. Harder difficulties and tough rivals draw from stronger species and train them; calm rivals
// bring the weakest of their theme. Rivals are measured against your party, not against perfect
// Pokémon: their IVs are around yours, and a trained rival has about as many EVs as yours. Later on
// they also know moves from machines, and then from tutors and eggs, stronger the higher you climb.
import { finalForms, moveOrigins, shuffled, speciesData, type Random } from '../../catalog/domain/creatures.js';
import type { Ivs, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { AI_POOL_SHARE, aiTeamPool, type AiLevel } from '../../combat/domain/ai.js';
import { MOVES_PER_FIGHTER } from '../../combat/domain/fighter.js';
import type { Floor } from './floors.js';
import { moveData } from '../../combat/domain/moves.js';
import { alwaysDamages } from '../../combat/domain/random-party.js';
import { baseStatTotal, evolutionPath, formAtLevel, movesAtLevel } from './growth.js';
import { attackStat, idealNature, MAX_IV, MAX_STAT_EVS, MAX_TOTAL_EVS, STATS } from './rewards.js';

const LEGENDARY_TOTAL = 580;
const LEGENDS_FROM_FLOOR = 40;
const FEWEST_CHOICES = 6;
/** How far a rival's IVs sit from your party's average, by difficulty; a boss two more. */
const IV_EDGE: Record<AiLevel, number> = { easy: -6, mid: -3, hard: 0, veryhard: 2, skynet: 4 };
const BOSS_IV_EDGE = 2;
const IV_SPREAD = 3;
const UNKNOWN_IV = 15;
/** The EVs of a trained rival, as a share of the EVs your party has on average. */
const EV_SHARE: Record<AiLevel, number> = { easy: 0.5, mid: 0.8, hard: 1, veryhard: 1.15, skynet: 1.3 };
const MACHINES_FROM_FLOOR = 3;
const TUTORS_FROM_FLOOR = 10;
/** One more taught move every this many floors. */
const TAUGHT_EVERY = 12;
const TAUGHT_LIMIT = { route: 2, boss: 3 };
/** The strongest taught move a Pokémon of this level may know: about 57 at 10, 81 at 30, anything past 60. */
const taughtPowerCap = (level: number): number => 45 + level * 1.2;
const STAB = 1.5;
const TAUGHT_CHOICES = 4;

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

/** What the rivals are measured against: the IVs and EVs of each Pokémon of your party. */
export interface PartyStats {
  ivs: Ivs;
  evs: Ivs;
}

const averageOf = (values: readonly number[], fallback: number): number => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback);

/** Around your party's average in each stat, a few points up or down. */
function foeIvs(party: readonly PartyStats[], edge: number, random: Random): Ivs {
  const ivs = { ...NO_STATS };
  for (const stat of STATS) {
    const spread = Math.round((random() * 2 - 1) * IV_SPREAD);
    ivs[stat] = Math.min(MAX_IV, Math.max(0, Math.round(averageOf(party.map((mon) => mon.ivs[stat] ?? 0), UNKNOWN_IV)) + edge + spread));
  }
  return ivs;
}

const NO_STATS: Ivs = { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 };
const totalEvs = (evs: Ivs): number => STATS.reduce((sum, stat) => sum + (evs[stat] ?? 0), 0);

/** A nature for its best attack, and the EVs into that attack, then Speed, then HP. */
function training(speciesId: number, budget: number): { natureChoice: string; evs: Ivs } {
  let left = Math.min(MAX_TOTAL_EVS, Math.max(0, Math.round(budget)));
  const take = (wanted: number) => {
    const given = Math.min(MAX_STAT_EVS, wanted, left);
    left -= given;
    return given;
  };
  const strike = take(Math.ceil(left / 2));
  const evs = { ...NO_STATS, [attackStat(speciesId)]: strike, spd: take(left) };
  evs.hp = take(left);
  return { natureChoice: idealNature(speciesId), evs };
}

/** How many of its moves a rival learned from a machine, a tutor or an egg: more on later floors and for bosses. */
function taughtSlots(floor: Floor, difficulty: AiLevel): number {
  if (difficulty === 'easy' || floor.number < MACHINES_FROM_FLOOR) return 0;
  const boss = floor.kind !== 'trainer';
  const count = Math.floor(floor.number / TAUGHT_EVERY) + (boss ? 1 : 0) + (!boss && floor.strength === 'strong' ? 1 : 0) + (difficulty === 'skynet' ? 1 : 0);
  return Math.min(boss ? TAUGHT_LIMIT.boss : TAUGHT_LIMIT.route, count);
}

const moveScore = (id: string, types: readonly string[]): number => {
  const move = moveData(id);
  if (!move || !alwaysDamages(id)) return 0;
  return move.power * ((move.accuracy ?? 100) / 100) * (move.type && types.includes(move.type) ? STAB : 1);
};

/** Its level moves, with the weakest attacks swapped for taught ones within the power its level allows. */
function withTaughtMoves(speciesId: number, level: number, floor: number, moves: readonly string[], slots: number, random: Random): string[] {
  if (!slots) return [...moves];
  const types = speciesData(speciesId)?.types ?? [];
  const origins = floor >= TUTORS_FROM_FLOOR ? ['machine', 'tutor', 'egg'] : ['machine'];
  const cap = taughtPowerCap(level);
  const offered = [...moveOrigins({ finalID: speciesId })]
    .filter(([id, origin]) => origins.includes(origin.origin) && !moves.includes(id) && (moveData(id)?.power ?? 0) > 0 && (moveData(id)?.power ?? Infinity) <= cap && moveScore(id, types) > 0)
    .map(([id]) => id)
    .sort((a, b) => moveScore(b, types) - moveScore(a, types) || a.localeCompare(b));
  const known = [...moves];
  for (const id of shuffled(offered.slice(0, TAUGHT_CHOICES), random).slice(0, slots)) {
    if (known.length < MOVES_PER_FIGHTER) {
      known.push(id);
      continue;
    }
    const weakest = known.filter(alwaysDamages).sort((a, b) => moveScore(a, types) - moveScore(b, types))[0];
    const replaced = weakest && moveScore(weakest, types) < moveScore(id, types) ? weakest : known.find((move) => !alwaysDamages(move) && known.filter(alwaysDamages).length >= 2);
    if (replaced) known[known.indexOf(replaced)] = id;
  }
  return known;
}

export function foeTeam(floor: Floor, difficulty: AiLevel, random: Random, party: readonly PartyStats[] = []): RosterEntry[] {
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
  const evBudget = averageOf(party.map((mon) => totalEvs(mon.evs)), 0) * EV_SHARE[difficulty];
  return finals.map((finalId, index) => {
    const ace = index === finals.length - 1;
    const level = Math.max(2, ace ? floor.level + (floor.strength === 'strong' ? 1 : 0) : floor.level);
    const form = formAtLevel(finalId, level);
    const ivs = foeIvs(party, IV_EDGE[difficulty] + (floor.kind === 'trainer' ? 0 : BOSS_IV_EDGE), random);
    return {
      id: `tower-${floor.number}-${index}-${form}`,
      finalID: form,
      baseID: evolutionPath(finalId)[0],
      rarity: 'common',
      shiny: false,
      level,
      battleLevel: level,
      ivs,
      battleIvs: ivs,
      learned: [],
      moveset: withTaughtMoves(form, level, floor.number, movesAtLevel(form, level), taughtSlots(floor, difficulty), random),
      ...(floor.trained ? training(form, evBudget) : {}),
    };
  });
}

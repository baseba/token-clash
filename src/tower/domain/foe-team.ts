// The team of the trainer on a floor: species of its types, in the form they have at that level,
// moves learned by level, and its strongest Pokémon (the ace) a level above the rest when the rival is
// strong. The Tower is a roguelike, so a team is a draw, not the best of its theme: every species that
// fits may come, all of generations 1 to 5. Tough rivals and leaders lean a little towards the stronger
// ones, calm rivals bring the weakest, and a species you already met in the climb seldom comes back. A
// themed class brings one or two of its own species (a Rocket grunt its Zubat or Koffing) and fills up
// with others of its types; a species of several final forms comes as any of them.
// Later rivals hold items too, like yours: a leader's ace first, then a tough rival's, then whole teams. Rivals are measured against your party, not against perfect
// Pokémon: their IVs are around yours, and a trained rival has about as many EVs as yours. Later on
// they also know moves from machines, and then from tutors and eggs, stronger the higher you climb.
import { effectiveness, finalForms, moveOrigins, shuffled, speciesData, type Random } from '../../catalog/domain/creatures.js';
import type { Ivs, RosterEntry } from '../../catalog/domain/roster-entry.js';
import type { AiLevel } from '../../combat/domain/ai.js';
import { DEX_LIMIT } from '../../catalog/domain/pokedex.js';
import { MOVES_PER_FIGHTER } from '../../combat/domain/fighter.js';
import { isLeader, type Floor, type Strength } from './floors.js';
import { moveData } from '../../combat/domain/moves.js';
import { alwaysDamages } from '../../combat/domain/random-party.js';
import { baseStatTotal, evolutionPath, formAtLevel, movesAtLevel } from './growth.js';
import { attackStat, idealNature, MAX_IV, MAX_STAT_EVS, MAX_TOTAL_EVS, STATS } from './rewards.js';
import { boosterOf } from '../../catalog/domain/held-items.js';
import { towerSpecies } from './species-pool.js';

const LEGENDARY_TOTAL = 580;
/**
 * How much a team leans to the stronger species that fit, by who brings it: a calm rival none, a leader
 * the most, and still gently, so each climb brings different teams. Difficulty does not narrow the draw (that is
 * for the arena's 1v1 and tournaments): it shows in how well the rival picks its three from what it drew.
 */
const LEAN: Record<Strength | 'leader', number> = { weak: 0, normal: 0.25, strong: 0.4, leader: 1 };
/** A species (any form of its line) you already met in this climb is this much less likely to come back. */
const MET_AGAIN = 0.1;
/** At most this many of a themed class's own species in one team. */
const OWN_SPECIES = 2;
/** How much a rival's pick of its three weighs how good each one is: 0 picks at random, and the hardest take the best. */
const PICK_SKILL: Record<AiLevel, number> = { easy: 0, mid: 1, hard: 3, veryhard: 6, skynet: 10 };
/** How much the type matchup against your party counts next to raw power when picking. */
const MATCHUP_WEIGHT = 0.35;
const LEGENDS_FROM_FLOOR = 40;
const FEWEST_CHOICES = 12;
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

/** From which floor a rival's Pokémon hold items, by who they are; harder difficulties a few floors sooner, the easiest never. */
const ITEMS_FROM = { leaderAce: 6, strongAce: 12, leaderTeam: 26, routeAce: 30 };
const ITEMS_SOONER: Record<AiLevel, number> = { easy: -Infinity, mid: -5, hard: 0, veryhard: 3, skynet: 6 };
const LATE_ITEMS_FROM = 20;

/** Who on a rival's team holds an item on this floor. */
function holdsItem(floor: Floor, difficulty: AiLevel, ace: boolean): boolean {
  const at = floor.number + ITEMS_SOONER[difficulty];
  if (isLeader(floor)) return at >= (ace ? ITEMS_FROM.leaderAce : ITEMS_FROM.leaderTeam);
  return ace && at >= (floor.strength === 'strong' ? ITEMS_FROM.strongAce : ITEMS_FROM.routeAce);
}

/** An item that suits it: a booster of a type it attacks with, or one that keeps it standing; stronger ones later. */
function foeItem(moves: readonly string[], floorNumber: number, random: Random): string {
  const boosters = [...new Set(moves.filter(alwaysDamages).map((id) => boosterOf(moveData(id)?.type ?? '')).filter((key): key is string => !!key))];
  const options = [...boosters, 'leftovers', 'sitrus-berry', ...(floorNumber >= LATE_ITEMS_FROM ? ['life-orb', 'expert-belt', 'focus-sash', 'rocky-helmet'] : ['muscle-band', 'wise-glasses'])];
  return options[Math.floor(random() * options.length)];
}

/** Early routes have weak Pokémon: the form a species has at that level must fit this stat total. */
const powerCap = (level: number): number => 300 + level * 8;
const STRONG_BONUS = 40;
/** Below this level a team knows little more than Normal moves, and a Ghost would be unbeatable. */
const GHOSTS_FROM_LEVEL = 15;

/** The trainer's theme first: a Hiker only brings Rock or Ground, a leader only its type. Strongest first. */
function candidates(floor: Floor): number[] {
  const legends = floor.kind === 'champion' || floor.number >= LEGENDS_FROM_FLOOR;
  const all = towerSpecies().filter((id) => legends || baseStatTotal(id) < LEGENDARY_TOTAL);
  const themed = floor.types.length ? all.filter((id) => speciesData(id)?.types.some((type) => floor.types.includes(type))) : all;
  const strength = (id: number) => baseStatTotal(formAtLevel(id, floor.level));
  const beatable = themed.filter((id) => floor.level >= GHOSTS_FROM_LEVEL || !speciesData(formAtLevel(id, floor.level))?.types.includes('ghost'));
  const pool = beatable.length ? beatable : themed;
  const cap = powerCap(floor.level) + (floor.strength === 'strong' ? STRONG_BONUS : 0);
  const fitting = pool.filter((id) => strength(id) <= cap);
  const usable = fitting.length >= FEWEST_CHOICES ? fitting : [...pool].sort((a, b) => strength(a) - strength(b)).slice(0, Math.max(FEWEST_CHOICES, fitting.length));
  const ranked = [...usable].sort((a, b) => strength(b) - strength(a) || a - b);
  return floor.strength === 'weak' ? ranked.slice(-Math.max(FEWEST_CHOICES, Math.ceil(ranked.length / 2))) : ranked;
}

/** One of the options by weight, taken out of both lists. */
function drawWeighted<T>(options: T[], weights: number[], random: Random): T {
  let roll = random() * weights.reduce((sum, weight) => sum + weight, 0);
  const index = Math.max(0, weights.findIndex((weight) => (roll -= weight) <= 0));
  weights.splice(index, 1);
  return options.splice(index, 1)[0];
}

/** A weight for each place of a list ranked strongest first: flat with no lean, steeper the more it leans. */
const rankWeights = (length: number, lean: number): number[] => Array.from({ length }, (_, rank) => (1 - rank / length) ** lean);
const lineOf = (id: number): number => evolutionPath(id)[0];

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
  const boss = isLeader(floor);
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

export function foeTeam(floor: Floor, difficulty: AiLevel, random: Random, party: readonly PartyStats[] = [], metLines: readonly number[] = []): RosterEntry[] {
  const slots = floor.teamSize - (floor.signature ? 1 : 0);
  const forms = new Set<number>(floor.signature ? [formAtLevel(floor.signature, floor.level)] : []);
  const finals: number[] = [];
  const add = (id: number) => {
    const form = formAtLevel(id, floor.level);
    if (finals.length >= slots || forms.has(form) || id === floor.signature) return;
    forms.add(form);
    finals.push(id);
  };
  const themed = floor.species.map((id) => shuffled(finalForms(id, DEX_LIMIT), random)[0] ?? id).filter((id) => speciesData(id));
  for (const id of shuffled(themed, random).slice(0, 1 + Math.floor(random() * OWN_SPECIES))) add(id);
  const options = candidates(floor);
  const lean = LEAN[isLeader(floor) ? 'leader' : floor.strength];
  const met = new Set(metLines);
  const weights = rankWeights(options.length, lean).map((weight, rank) => weight * (met.has(lineOf(options[rank])) ? MET_AGAIN : 1));
  while (finals.length < slots && options.length) add(drawWeighted(options, weights, random));
  finals.sort((a, b) => baseStatTotal(a) - baseStatTotal(b));
  if (floor.signature) finals.push(floor.signature);
  const evBudget = averageOf(party.map((mon) => totalEvs(mon.evs)), 0) * EV_SHARE[difficulty];
  return finals.map((finalId, index) => {
    const ace = index === finals.length - 1;
    const level = Math.max(2, ace ? floor.level + (floor.strength === 'strong' ? 1 : 0) : floor.level);
    const form = formAtLevel(finalId, level);
    const moveset = withTaughtMoves(form, level, floor.number, movesAtLevel(form, level), taughtSlots(floor, difficulty), random);
    const ivs = foeIvs(party, IV_EDGE[difficulty] + (isLeader(floor) ? BOSS_IV_EDGE : floor.strength === 'strong' ? BOSS_IV_EDGE / 2 : 0), random);
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
      moveset,
      ...(floor.trained ? training(form, evBudget) : {}),
      ...(holdsItem(floor, difficulty, ace) ? { heldItem: foeItem(moveset, floor.number, random) } : {}),
    };
  });
}

/** What a Pokémon is worth in battle at its level: its stats, by its base stat total. */
const battleWorth = (mon: RosterEntry): number => (baseStatTotal(mon.finalID) * (mon.battleLevel ?? mon.level)) / 100;

/** How its types fare against your party: what its own types hit, less what yours hit it with, on average. */
function matchup(speciesId: number, rivals: readonly number[]): number {
  if (!rivals.length) return 0;
  const mine = speciesData(speciesId)?.types ?? [];
  return rivals.reduce((sum, rival) => {
    const theirs = speciesData(rival)?.types ?? [];
    const dealt = Math.max(...mine.map((type) => effectiveness(type, theirs)));
    const taken = Math.max(...theirs.map((type) => effectiveness(type, mine)));
    return sum + Math.log2(Math.max(dealt, 0.25)) - Math.log2(Math.max(taken, 0.25));
  }, 0) / rivals.length;
}

/**
 * The three a rival takes from the team it drew: the best of that selection, as well as its
 * difficulty lets it judge. Each one's worth is its power at its level and how its types fare against
 * your party; an easy rival picks at random, a harder one leans more and more to the best. A leader
 * always brings its ace.
 */
export function foePicks(floor: Pick<Floor, 'kind' | 'room' | 'signature'>, team: readonly RosterEntry[], difficulty: AiLevel, random: Random, count: number, rivals: readonly number[] = []): number[] {
  const worth = team.map((mon) => battleWorth(mon));
  const top = Math.max(...worth, 1);
  const score = team.map((mon, index) => worth[index] / top + MATCHUP_WEIGHT * matchup(mon.finalID, rivals));
  const picks: number[] = isLeader(floor) && team.length ? [team.length - 1] : [];
  const options = team.map((_, index) => index).filter((index) => !picks.includes(index));
  const best = Math.max(...options.map((index) => score[index]));
  const weights = options.map((index) => Math.exp(PICK_SKILL[difficulty] * (score[index] - best)));
  while (picks.length < Math.min(count, team.length)) picks.push(drawWeighted(options, weights, random));
  return picks;
}

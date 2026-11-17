// The AI: builds its team, picks its three, and chooses what to do each turn. Randomness is injected.
import { buildFighter, speciesData, formData, statsFor, effectiveness, usableMovepool, moveData, shuffled, rng, STRUGGLE, MOVES_PER_FIGHTER, type MoveData, type Random, type SpeciesData } from '../../catalog/domain/creatures.js';
import { DEX_LIMIT } from '../../catalog/domain/pokedex.js';
import type { Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { validActions, submit, needsAction, moveWillFail, BATTLE_SIZE, STRUGGLE_MOVE } from './battle.js';
import type { Action, BattleFighter, BattleSide, BattleState, MoveAction, SwitchAction } from './battle-types.js';
import { randomize } from './random-party.js';
import { PARTY_SIZE } from './team-preview.js';

type F = BattleFighter;
type B = BattleState;

export const AI_LEVELS = ['easy', 'mid', 'hard', 'veryhard', 'skynet'];

// Skynet's turns are decided by Jev (combat/infrastructure/jev/jev.ts). Everything else, and its fallback when Jev
// can't answer, is the very hard AI.
export const JEV_LEVEL = 'skynet';
const tactics = (difficulty: string): string => (difficulty === JEV_LEVEL ? 'veryhard' : difficulty);
export const AI_PREFIX = 'ai:';
export const LAST_AI_SPECIES = DEX_LIMIT;

export const aiTrainerId = (level: string): string => `${AI_PREFIX}${level}`;
/** A tournament can seat several AIs of one level: each gets a number. */
export const aiSeatId = (level: string, seatNumber: number): string => `${aiTrainerId(level)}#${seatNumber}`;
export const aiLevelOf = (trainerId: unknown): string | null => (typeof trainerId === 'string' && trainerId.startsWith(AI_PREFIX) ? trainerId.slice(AI_PREFIX.length).split('#')[0] : null);

const IMMUNE_BY_ABILITY: Record<string, string> = {
  levitate: 'ground', 'volt-absorb': 'electric', 'lightning-rod': 'electric', 'motor-drive': 'electric', 'water-absorb': 'water',
  'storm-drain': 'water', 'dry-skin': 'water', 'flash-fire': 'fire', 'sap-sipper': 'grass',
};
const STATUS_IMMUNE_TYPES: Record<string, string[]> = { par: ['electric'], brn: ['fire'], psn: ['poison', 'steel'], tox: ['poison', 'steel'], frz: ['ice'], slp: [] };
const STATUS_VALUE: Record<string, number> = { slp: 70, par: 55, tox: 52, psn: 35, brn: 48, frz: 40 };

const lastSwitchTurn = new WeakMap<BattleSide, number>();
const pickOne = <T>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)];
const stageMult = (sideIndex = 0): number => (sideIndex >= 0 ? (2 + sideIndex) / 2 : 2 / (2 - sideIndex));
const bst = (data: { stats: readonly number[] }): number => data.stats.reduce((a, b) => a + b, 0);
const fullyEvolved = (data: SpeciesData): boolean => data.chainLen == null || data.stage == null || data.stage >= data.chainLen - 1;
const hpShare = (fighter: F): number => fighter.hp / fighter.stats.hp;

function rarityOf(data: SpeciesData): Rarity {
  const total = bst(data);
  return total >= 580 ? 'legendary' : total >= 500 ? 'rare' : total >= 400 ? 'uncommon' : 'common';
}

export function aiPool(): number[] {
  const ids: number[] = [];
  for (let id = 1; id <= LAST_AI_SPECIES; id++) if (speciesData(id)) ids.push(id);
  return ids;
}

function moveValue(move: MoveData, mon: { types: string[]; stats: { atk: number; satk: number } }): number {
  if (!move.supported) return 0;
  if (move.kind === 'status') {
    const ups = (Object.entries(move.boosts ?? {}) as [string, number][]).filter(([k, v]) => v > 0 && move.target === 'self' && ['atk', 'satk', 'spd'].includes(k)).length;
    if (ups) return 55 + ups * 12;
    if (move.heal) return 60;
    if (move.status) return STATUS_VALUE[move.status] ?? 30;
    if (move.screen) return 45;
    if (move.weather === 'rain' && mon.types.includes('water')) return 50;
    if (move.weather === 'sun' && mon.types.includes('fire')) return 50;
    if (move.volatile === 'leechseed') return 40;
    if (move.volatile === 'confusion') return 30;
    return 12;
  }
  let power = move.power || (move.fixedDamage ? 55 : move.ohko ? 30 : 0);
  if (move.multihit) power *= (move.multihit[0] + move.multihit[1]) / 2;
  const physical = move.category === 'physical';
  const stat = physical ? mon.stats.atk : mon.stats.satk;
  let value = power * ((move.accuracy ?? 100) / 100) * (move.type && mon.types.includes(move.type) ? 1.5 : 1) * (stat / Math.max(1, (mon.stats.atk + mon.stats.satk) / 2));
  if (move.flags.includes('recharge')) value *= 0.55;
  if (move.flags.includes('charge')) value *= 0.55;
  if (move.selfDestruct) value *= 0.3;
  if (move.recoil) value *= 0.9;
  if (move.priority > 0) value *= 1.1;
  if (move.secondary?.length) value *= 1.05;
  return value;
}

export function pickMoveset(entry: RosterEntry, difficulty: string, random: Random): string[] {
  const pool = usableMovepool(entry);
  if (difficulty === 'easy' || pool.length <= MOVES_PER_FIGHTER) return shuffled(pool, random).slice(0, MOVES_PER_FIGHTER);
  const mon = buildFighter({ ...entry, moveset: pool.slice(0, 1) });
  const scored = pool.map((id) => ({ id, m: moveData(id) as MoveData })).map((x) => ({ ...x, v: moveValue(x.m, mon) * (difficulty === 'mid' ? 0.75 + random() * 0.5 : 1) }));
  if (difficulty === 'mid') return scored.sort((a, b) => b.v - a.v).slice(0, MOVES_PER_FIGHTER).map((x) => x.id);
  const maxStatus = difficulty === 'veryhard' ? 2 : 1;
  const chosen: typeof scored = [];
  while (chosen.length < MOVES_PER_FIGHTER) {
    const types = new Set(chosen.filter((x) => x.m.kind === 'attack').map((x) => x.m.type));
    const statusCount = chosen.filter((x) => x.m.kind === 'status').length;
    const attacks = chosen.length - statusCount;
    let best: (typeof scored)[number] | null = null;
    let bestValue = -1;
    for (const candidate of scored) {
      if (chosen.includes(candidate)) continue;
      if (candidate.m.kind === 'status' && (statusCount >= maxStatus || attacks < 2)) continue;
      let value = candidate.v;
      if (candidate.m.kind === 'attack') value *= types.has(candidate.m.type) ? 0.4 : types.size ? 1.3 : 1;
      if (value > bestValue) [best, bestValue] = [candidate, value];
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen.map((x) => x.id);
}

function usableAtLevel(id: number, level: number): boolean {
  return usableMovepool({ id: 'probe', finalID: id, level, learned: [] }).some((k) => (moveData(k) as MoveData).kind === 'attack');
}

export const AI_POOL_SHARE: Record<string, number> = { easy: 1, mid: 0.8, hard: 0.6, veryhard: 0.5, skynet: 0.4 };

const DICE_IVS = { hp: 15, atk: 15, def: 15, satk: 15, sdef: 15, spd: 15 };

function diceEntry(id: number, { level, random, index }: { level: number; random: Random; index: number }): RosterEntry {
  return randomize({ id: `ai-${index}-${id}`, finalID: id, baseID: id, rarity: rarityOf(speciesData(id) as SpeciesData), shiny: false, level, ivs: DICE_IVS, learned: [] }, random);
}

export function aiTeamPool(difficulty: string, level: number): number[] {
  const ranked = aiPool()
    .filter((id) => fullyEvolved(speciesData(id) as SpeciesData) && usableAtLevel(id, level))
    .sort((a, b) => bst(speciesData(b) as SpeciesData) - bst(speciesData(a) as SpeciesData) || a - b);
  const size = Math.max(PARTY_SIZE, Math.ceil(ranked.length * (AI_POOL_SHARE[difficulty] ?? 1)));
  return ranked.slice(0, size);
}

export function buildAiTeam({ difficulty, level, random = Math.random }: { difficulty: string; level: number; random?: Random }): RosterEntry[] {
  const ids = shuffled(aiTeamPool(difficulty, level), random).slice(0, PARTY_SIZE);
  return ids.map((id, index) => diceEntry(id, { level, random, index }));
}

export function buildAiRandomParty({ level, random = Math.random }: { level: number; random?: Random }): RosterEntry[] {
  const ids = shuffled(aiTeamPool('easy', level), random).slice(0, PARTY_SIZE);
  return ids.map((id, index) => diceEntry(id, { level, random, index }));
}

// The three for the battle are picked on a hunch, without looking at the rival's party: easier
// AIs at random, harder ones leaning towards their strongest.
export function aiPicks({ difficulty: level, own, random = Math.random }: { difficulty: string; own: RosterEntry[]; random?: Random }): number[] {
  const difficulty = tactics(level);
  const order = own.map((_, i) => i);
  const count = Math.min(BATTLE_SIZE, own.length);
  if (difficulty === 'easy' || difficulty === 'mid') return shuffled(order, random).slice(0, count);
  const strength = (index: number) => bst(speciesData(own[index].finalID) ?? { stats: [0] }) / 150;
  return order.map((i) => ({ i, s: strength(i) + random() * 2 })).sort((a, b) => b.s - a.s).slice(0, count).map((x) => x.i);
}

// ---------- what the AI may know ----------
// The AI decides on its belief of the battle, built only from what a human on its side sees:
// the rival's revealed moves and ability, its HP as a percentage, and its Pokémon once they've
// been out. The rest is a guess from the species, never the real thing. Its pending choice is
// never there.

const GUESS_IV = 15;
const GUESS_IVS = { hp: GUESS_IV, atk: GUESS_IV, def: GUESS_IV, satk: GUESS_IV, sdef: GUESS_IV, spd: GUESS_IV };
const guesses = new Map<string, MoveData[]>();

// The moves a seasoned player would expect from that species at that level.
function expectedMoves(speciesId: number, level: number): MoveData[] {
  const key = `${speciesId}:${level}`;
  if (!guesses.has(key)) {
    let moves: MoveData[] = [];
    try {
      const probe = { id: `guess-${speciesId}`, finalID: speciesId, baseID: speciesId, level, ivs: GUESS_IVS, learned: [] } as unknown as RosterEntry;
      moves = pickMoveset(probe, 'hard', () => 0.5).map(moveData) as MoveData[];
    } catch {
      // The probe is a bare entry, not a real Pokémon: if the catalog can't build one for this
      // species, the AI guesses no moves rather than stalling the turn timer with a throw.
      moves = [];
    }
    guesses.set(key, moves);
  }
  return guesses.get(key)!;
}

function believedFoe(fighter: F): F {
  if (!fighter.seen) return fighter;
  const look = fighter.vol.illusion ?? fighter.seenAs;
  let moves = fighter.moves;
  let vol = fighter.vol;
  if (!fighter.vol.transformed) {
    // Revealed moves keep their slot; the unknown ones become guesses (or go, if there are none).
    const known = (move: MoveData) => fighter.revealedMoves.has(move.key);
    const extra = expectedMoves(fighter.speciesId, fighter.level).filter((g) => !fighter.moves.some((m) => known(m) && m.key === g.key));
    const slots = fighter.moves.map((m) => (known(m) ? m : extra.shift()));
    moves = slots.filter(Boolean) as MoveData[];
    const slotOf = (slot: number | null | undefined) => (slot == null || !slots[slot] ? undefined : moves.indexOf(slots[slot]));
    vol = { ...fighter.vol, charging: slotOf(fighter.vol.charging), mustRecharge: slotOf(fighter.vol.mustRecharge) };
    for (const key of ['charging', 'mustRecharge']) if (vol[key] === undefined) delete vol[key];
  }
  const base = fighter.form ? formData(fighter.form)?.base : speciesData(fighter.speciesId)?.stats;
  const stats = fighter.vol.transformed || !base ? { ...fighter.stats } : statsFor(base, GUESS_IVS, fighter.level);
  const share = fighter.hp / fighter.stats.hp;
  const ability = fighter.revealedAbilities.has(fighter.ability) ? fighter.ability : null;
  return {
    ...fighter,
    types: look?.types ?? fighter.types,
    stats,
    hp: fighter.hp > 0 ? Math.max(1, Math.round(stats.hp * share)) : 0,
    moves,
    vol,
    pp: Object.fromEntries(moves.map((m) => [m.key, m.pp])),
    ability,
    baseAbility: ability,
  };
}

export function beliefOf(battle: B, sideIndex: number): B {
  const { random, ...state } = battle;
  const copy = structuredClone(state) as B;
  const theirs = copy.sides[1 - sideIndex];
  theirs.action = null;
  theirs.team = theirs.team.map(believedFoe);
  return copy;
}

function moveOf(fighter: F, idx: number): MoveData {
  return idx === STRUGGLE_MOVE ? STRUGGLE : fighter.moves[idx];
}

function typeEffect(move: MoveData, target: F, knowsAbilities: boolean): number {
  if (!move.type) return 1;
  let multiplier = effectiveness(move.type, target.types);
  if (knowsAbilities && IMMUNE_BY_ABILITY[target.ability as string] === move.type) multiplier = 0;
  return multiplier;
}

function speedOf(fighter: F): number {
  return fighter.stats.spd * stageMult(fighter.boosts?.spd) * (fighter.status === 'par' ? 0.5 : 1);
}

export function estimateDamage(battle: B, attacker: F, target: F, move: MoveData | null | undefined, knowsAbilities = true): number {
  if (!move || move.kind === 'status' || move.category === 'status') return 0;
  const eff = typeEffect(move, target, knowsAbilities);
  if (eff === 0) return 0;
  if (move.ohko) return target.level > attacker.level ? 0 : target.hp * ((move.accuracy ?? 30) / 100);
  if (move.fixedDamage) return move.fixedDamage === 'level' ? attacker.level : Number(move.fixedDamage) || 0;
  const physical = move.category === 'physical';
  const attack = (physical ? attacker.stats.atk : attacker.stats.satk) * stageMult(attacker.boosts?.[physical ? 'atk' : 'satk']);
  const defense = (physical ? target.stats.def : target.stats.sdef) * stageMult(target.boosts?.[physical ? 'def' : 'sdef']);
  let power = move.power || 0;
  if (move.multihit) power *= (move.multihit[0] + move.multihit[1]) / 2;
  let dmg = (((2 * attacker.level) / 5 + 2) * power * (attack / Math.max(1, defense))) / 50 + 2;
  if (move.type && attacker.types.includes(move.type)) dmg *= attacker.ability === 'adaptability' ? 2 : 1.5;
  dmg *= eff * 0.925 * ((move.accuracy ?? 100) / 100);
  const weather = battle.field?.weather;
  if (weather === 'sun' || weather === 'harshsun') dmg *= move.type === 'fire' ? 1.5 : move.type === 'water' ? 0.5 : 1;
  if (weather === 'rain' || weather === 'heavyrain') dmg *= move.type === 'water' ? 1.5 : move.type === 'fire' ? 0.5 : 1;
  if (attacker.status === 'brn' && physical && attacker.ability !== 'guts') dmg *= 0.5;
  const screens: Record<string, number> = battle.sides[battle.sides.findIndex((s) => s.team.includes(target))]?.screens ?? {};
  if (screens.auroraveil || (physical ? screens.reflect : screens.lightscreen)) dmg *= 0.5;
  return dmg;
}

function bestDamage(battle: B, attacker: F, target: F, knowsAbilities: boolean): number {
  let best = 0;
  for (const move of attacker.moves) best = Math.max(best, estimateDamage(battle, attacker, target, move, knowsAbilities));
  return best;
}

function statusImmune(target: F, status: string): boolean {
  if (target.status) return true;
  return (STATUS_IMMUNE_TYPES[status] ?? []).some((t) => target.types.includes(t));
}

export function scoreMove(battle: B, sideIndex: number, idx: number, knowsAbilities = true, deep = true): number {
  const side = battle.sides[sideIndex];
  const me = side.team[side.active];
  const foeSide = battle.sides[1 - sideIndex];
  const foe = foeSide.team[foeSide.active];
  const move = moveOf(me, idx);
  if (!foe || foe.hp <= 0) return 1;
  if (moveWillFail(battle, sideIndex, idx)) return 0;
  if (move.kind !== 'status' && move.category !== 'status') {
    const dmg = estimateDamage(battle, me, foe, move, knowsAbilities);
    if (dmg <= 0) return 0;
    let score = Math.min(1, dmg / foe.hp) * 100;
    if (deep) score = Math.max(score, 100 / Math.ceil(foe.hp / dmg));
    if (dmg >= foe.hp) {
      score += 60;
      const threatened = bestDamage(battle, foe, me, knowsAbilities) >= me.hp;
      if (deep && move.priority > 0 && threatened && speedOf(foe) >= speedOf(me)) score += 45;
    }
    if (move.selfDestruct) score *= hpShare(me) < 0.3 ? 1 : 0.3;
    if (move.flags.includes('recharge') && dmg < foe.hp) score *= 0.6;
    return score;
  }
  const threat = bestDamage(battle, foe, me, knowsAbilities) / me.hp;
  if (move.status) {
    if (statusImmune(foe, move.status)) return 0;
    if (move.status === 'par' && speedOf(foe) <= speedOf(me)) return 25;
    return STATUS_VALUE[move.status] ?? 30;
  }
  if (move.heal) return hpShare(me) < 0.5 ? 75 : hpShare(me) < 0.7 ? 30 : 0;
  if (move.screen) {
    if (side.screens?.[move.screen]) return 0;
    if (move.screen === 'auroraveil' && !['hail', 'snow'].includes(battle.field.weather as string)) return 0;
    return threat > 0.25 ? 50 : 25;
  }
  if (move.weather || move.terrain) {
    if (move.weather && battle.field.weather === move.weather) return 0;
    if (move.terrain && battle.field.terrain === move.terrain) return 0;
    const helps = (move.weather === 'rain' && me.types.includes('water')) || (move.weather === 'sun' && me.types.includes('fire'));
    return helps ? 45 : 8;
  }
  if (move.boosts && move.target === 'self') {
    const ups = (Object.entries(move.boosts) as [keyof F['boosts'], number][]).filter(([, v]) => v > 0);
    if (!ups.length || ups.every(([k]) => (me.boosts[k] ?? 0) >= 4)) return 0;
    if (hpShare(me) < 0.6 || threat >= 0.5) return 10;
    return 50 + ups.length * 8;
  }
  if (move.boosts) {
    const downs = Object.keys(move.boosts) as (keyof F['boosts'])[];
    return downs.every((k) => (foe.boosts[k] ?? 0) <= -2) ? 0 : 15;
  }
  if (move.volatile === 'leechseed') return foe.types.includes('grass') || foe.vol?.leechSeed ? 0 : 35;
  if (move.volatile === 'confusion') return foe.vol?.confusion ? 0 : 28;
  if (move.volatile === 'attract') return foe.vol?.attract ? 0 : 20;
  if (move.clearsScreens) return Object.keys(foeSide.screens ?? {}).length ? 40 : 5;
  return 5;
}

function matchupScore(battle: B, mon: F, foe: F | null | undefined, knowsAbilities: boolean): number {
  if (!foe || foe.hp <= 0) return hpShare(mon);
  const dealt = Math.min(1, bestDamage(battle, mon, foe, knowsAbilities) / foe.hp);
  const taken = Math.min(1, bestDamage(battle, foe, mon, knowsAbilities) / Math.max(1, mon.hp));
  const faster = speedOf(mon) > speedOf(foe) ? 0.15 : 0;
  return dealt - taken + faster + hpShare(mon) * 0.3;
}

function weighted<T>(items: { a: T; w: number }[], random: Random): T {
  const total = items.reduce((sum, x) => sum + x.w, 0);
  if (total <= 0) return pickOne(items, random).a;
  let roll = random() * total;
  for (const item of items) {
    roll -= item.w;
    if (roll <= 0) return item.a;
  }
  return items[items.length - 1].a;
}

function sideValue(side: BattleSide): number {
  return side.team.reduce((sum, f) => sum + (f.hp > 0 ? 0.35 + f.hp / f.stats.hp : 0), 0);
}

function evaluate(battle: B, sideIndex: number): number {
  if (battle.status === 'finished') return battle.winner === sideIndex ? 100 : battle.winner === null ? 0 : -100;
  return sideValue(battle.sides[sideIndex]) - sideValue(battle.sides[1 - sideIndex]);
}

function simulate(battle: B, sideIndex: number, mine: Action, theirs: Action | null, seed: string): number {
  const { random, ...state } = battle;
  const copy = structuredClone(state) as B;
  copy.random = rng(seed);
  submit(copy, sideIndex, mine);
  if (theirs && needsAction(copy, 1 - sideIndex)) submit(copy, 1 - sideIndex, theirs);
  return evaluate(copy, sideIndex);
}

const SEARCH_SEEDS = 2;

function lookahead(battle: B, sideIndex: number, options: Action[]): Action | null {
  const rival = battle.sides[1 - sideIndex].team;
  const theirs = validActions(battle, 1 - sideIndex).filter((a) => a.type !== 'switch' || rival[a.to].seen);
  const replies: (Action | null)[] = theirs.length ? theirs : [null];
  let best: Action | null = null;
  let bestValue = -Infinity;
  for (const mine of options) {
    const outcomes = replies.map((reply) => {
      let total = 0;
      for (let seed = 0; seed < SEARCH_SEEDS; seed++) total += simulate(battle, sideIndex, mine, reply, `${battle.turn}:${seed}:${JSON.stringify(mine)}:${JSON.stringify(reply)}`);
      return total / SEARCH_SEEDS;
    });
    // When every line looks the same (say, lost either way), the plain move score breaks the tie.
    const tiebreak = mine.type === 'move' ? scoreMove(battle, sideIndex, mine.move) / 1e4 : 0;
    const value = 0.6 * Math.min(...outcomes) + 0.4 * (outcomes.reduce((a, x) => a + x, 0) / outcomes.length) + tiebreak;
    if (value > bestValue) [best, bestValue] = [mine, value];
  }
  return best;
}

function safeLookahead(battle: B, sideIndex: number, options: Action[]): Action | null {
  try {
    return lookahead(battle, sideIndex, options);
  } catch {
    return null;
  }
}

export function chooseAction(battle: B, sideIndex: number, level: string, random: Random = Math.random): Action | null {
  const difficulty = tactics(level);
  const options = validActions(battle, sideIndex);
  if (!options.length) return null;
  if (options.length === 1) return options[0];
  const belief = beliefOf(battle, sideIndex);
  const side = belief.sides[sideIndex];
  const memory = battle.sides[sideIndex];
  const me = side.team[side.active];
  const foe = belief.sides[1 - sideIndex].team[belief.sides[1 - sideIndex].active];
  const smart = difficulty === 'hard' || difficulty === 'veryhard';
  const moves = options.filter((o): o is MoveAction => o.type === 'move');
  const switches = options.filter((o): o is SwitchAction => o.type === 'switch');

  if (!moves.length) {
    if (!smart) return pickOne(switches, random);
    return switches.map((a) => ({ a, s: matchupScore(belief, side.team[a.to], foe, true) + (difficulty === 'hard' ? random() * 0.3 : 0) })).sort((x, y) => y.s - x.s)[0].a;
  }
  if (difficulty === 'easy') return pickOne(moves, random);
  if (difficulty === 'veryhard' && belief.phase === 'choose' && foe && foe.hp > 0) {
    const chosen = safeLookahead(belief, sideIndex, options);
    if (chosen) return chosen;
  }

  const veryhard = difficulty === 'veryhard';
  const scored = moves.map((a) => ({ a, s: scoreMove(belief, sideIndex, a.move, veryhard, veryhard) }));
  if (difficulty === 'mid') {
    const useful = scored.filter((x) => x.s > 0);
    return weighted((useful.length ? useful : scored).map((x) => ({ a: x.a, w: x.s + 5 })), random);
  }

  scored.sort((x, y) => y.s - x.s);
  const best = scored[0];
  if (switches.length) {
    const canKo = foe && foe.hp > 0 && scored.some((x) => moveOf(me, x.a.move).kind !== 'status' && estimateDamage(belief, me, foe, moveOf(me, x.a.move)) >= foe.hp);
    const doomed = foe && foe.hp > 0 && bestDamage(belief, foe, me, true) >= me.hp && speedOf(foe) > speedOf(me);
    const stuck = best.s < 15;
    const lastSwitched = lastSwitchTurn.get(memory) === belief.turn - 1;
    const willing = veryhard ? true : random() < 0.35;
    if (!canKo && (veryhard ? doomed || stuck : stuck) && !lastSwitched && willing) {
      const here = matchupScore(belief, me, foe, true);
      const alt = switches.map((a) => ({ a, s: matchupScore(belief, side.team[a.to], foe, true) })).sort((x, y) => y.s - x.s)[0];
      if (alt.s > here + 0.35) {
        lastSwitchTurn.set(memory, belief.turn);
        return alt.a;
      }
    }
  }
  if (difficulty === 'hard' && scored.length > 1 && scored[1].s > 0 && scored[1].s >= best.s * 0.6 && random() < 0.25) return scored[1].a;
  return best.a;
}

// The AI: builds its team, picks its three, and chooses what to do each turn. Randomness is injected.
import { speciesData, formData, statsFor, PERFECT_IVS, effectiveness, shuffled, rng, type Random, type SpeciesData } from '../../catalog/domain/creatures.js';
import { BATTLE_LEVEL, buildFighter, usableMovepool, MOVES_PER_FIGHTER } from './fighter.js';
import { moveAt, moveData, type MoveData } from './moves.js';
import { DEX_LIMIT } from '../../catalog/domain/pokedex.js';
import type { Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { validActions, submit, needsAction, moveWillFail, BATTLE_SIZE } from './battle.js';
import type { Action, BattleFighter, BattleSide, BattleState, MoveAction, SwitchAction } from './battle-types.js';
import { isRain, isSun, stageMult } from './conditions.js';
import { alwaysDamages, randomize, GUARANTEED_ATTACKS } from './random-party.js';
import { PARTY_SIZE } from './team-preview.js';

export const AI_LEVELS = ['easy', 'mid', 'hard', 'veryhard', 'skynet'] as const;
export type AiLevel = (typeof AI_LEVELS)[number];
export const isAiLevel = (value: string): value is AiLevel => AI_LEVELS.some((level) => level === value);

// Skynet's turns are decided by Jev (combat/infrastructure/jev/jev.ts). Everything else, and its fallback when Jev
// can't answer, is the very hard AI.
export const JEV_LEVEL = 'skynet';
const tactics = (level: AiLevel): Exclude<AiLevel, typeof JEV_LEVEL> => (level === JEV_LEVEL ? 'veryhard' : level);
export const AI_PREFIX = 'ai:';
export const LAST_AI_SPECIES = DEX_LIMIT;

export const aiTrainerId = (level: AiLevel): string => `${AI_PREFIX}${level}`;
export const aiFrame = (level: AiLevel): string => `ai-${level}`;
/** A tournament can seat several AIs of one level: each gets a number. */
export const aiSeatId = (level: AiLevel, seatNumber: number): string => `${aiTrainerId(level)}#${seatNumber}`;
export function aiLevelOf(trainerId: string): AiLevel | null {
  if (!trainerId.startsWith(AI_PREFIX)) return null;
  const level = trainerId.slice(AI_PREFIX.length).split('#')[0];
  return isAiLevel(level) ? level : null;
}

const IMMUNE_BY_ABILITY: Record<string, string> = {
  levitate: 'ground', 'volt-absorb': 'electric', 'lightning-rod': 'electric', 'motor-drive': 'electric', 'water-absorb': 'water',
  'storm-drain': 'water', 'dry-skin': 'water', 'flash-fire': 'fire', 'sap-sipper': 'grass',
};
const STATUS_IMMUNE_TYPES: Record<string, string[]> = { par: ['electric'], brn: ['fire'], psn: ['poison', 'steel'], tox: ['poison', 'steel'], frz: ['ice'], slp: [] };
const STATUS_VALUE: Record<string, number> = { slp: 70, par: 55, tox: 52, psn: 35, brn: 48, frz: 40 };

const pickOne = <T>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)];
const bst = (data: { stats: readonly number[] }): number => data.stats.reduce((a, b) => a + b, 0);
const fullyEvolved = (data: SpeciesData): boolean => data.chainLen == null || data.stage == null || data.stage >= data.chainLen - 1;
const hpShare = (fighter: BattleFighter): number => fighter.hp / fighter.stats.hp;

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
    const ups = (Object.entries(move.boosts ?? {}) as [string, number][]).filter(([k, v]) =>
      v > 0 && move.target === 'self' && ['atk', 'satk', 'spd'].includes(k)).length;
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
  let value = power
    * ((move.accuracy ?? 100) / 100)
    * (move.type && mon.types.includes(move.type) ? 1.5 : 1)
    * (stat / Math.max(1, (mon.stats.atk + mon.stats.satk) / 2));
  if (move.flags.includes('recharge')) value *= 0.55;
  if (move.flags.includes('charge')) value *= 0.55;
  if (move.selfDestruct) value *= 0.3;
  if (move.recoil) value *= 0.9;
  if (move.priority > 0) value *= 1.1;
  if (move.secondary?.length) value *= 1.05;
  return value;
}

export function pickMoveset(entry: RosterEntry, difficulty: AiLevel, random: Random): string[] {
  const pool = usableMovepool(entry);
  if (difficulty === 'easy' || pool.length <= MOVES_PER_FIGHTER) return shuffled(pool, random).slice(0, MOVES_PER_FIGHTER);
  const mon = buildFighter({ ...entry, moveset: pool.slice(0, 1) });
  const scored = pool
    .map((id) => ({ id, move: moveData(id) as MoveData }))
    .map((x) => ({ ...x, value: moveValue(x.move, mon) * (difficulty === 'mid' ? 0.75 + random() * 0.5 : 1) }));
  if (difficulty === 'mid') return scored.sort((a, b) => b.value - a.value).slice(0, MOVES_PER_FIGHTER).map((x) => x.id);
  const maxStatus = difficulty === 'veryhard' ? 2 : 1;
  const chosen: typeof scored = [];
  while (chosen.length < MOVES_PER_FIGHTER) {
    const types = new Set(chosen.filter((x) => x.move.kind === 'attack').map((x) => x.move.type));
    const statusCount = chosen.filter((x) => x.move.kind === 'status').length;
    const attacks = chosen.filter((x) => alwaysDamages(x.id)).length;
    let best: (typeof scored)[number] | null = null;
    let bestValue = -1;
    for (const candidate of scored) {
      if (chosen.includes(candidate)) continue;
      if (candidate.move.kind === 'status' && (statusCount >= maxStatus || attacks < GUARANTEED_ATTACKS)) continue;
      if (attacks < GUARANTEED_ATTACKS && !alwaysDamages(candidate.id) && chosen.length >= MOVES_PER_FIGHTER - GUARANTEED_ATTACKS + attacks) continue;
      let value = candidate.value;
      if (candidate.move.kind === 'attack') value *= types.has(candidate.move.type) ? 0.4 : types.size ? 1.3 : 1;
      if (value > bestValue) [best, bestValue] = [candidate, value];
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen.map((x) => x.id);
}

function canAttack(id: number): boolean {
  return usableMovepool({ id: 'probe', finalID: id, level: BATTLE_LEVEL, learned: [] }).filter(alwaysDamages).length >= GUARANTEED_ATTACKS;
}

export const AI_POOL_SHARE: Record<AiLevel, number> = { easy: 1, mid: 0.8, hard: 0.6, veryhard: 0.5, skynet: 0.4 };


const diceBase = (id: number, index: number): RosterEntry => ({ id: `ai-${index}-${id}`, finalID: id, baseID: id, rarity: rarityOf(speciesData(id) as SpeciesData), shiny: false, level: BATTLE_LEVEL, ivs: PERFECT_IVS, learned: [] });

function diceEntry(id: number, { random, index }: { random: Random; index: number }): RosterEntry {
  return randomize(diceBase(id, index), random);
}

const teamPools = new Map<AiLevel, number[]>();

export function aiTeamPool(difficulty: AiLevel): number[] {
  const cached = teamPools.get(difficulty);
  if (cached) return cached;
  const ranked = aiPool()
    .filter((id) => fullyEvolved(speciesData(id) as SpeciesData) && canAttack(id))
    .sort((a, b) => bst(speciesData(b) as SpeciesData) - bst(speciesData(a) as SpeciesData) || a - b);
  const size = Math.max(PARTY_SIZE, Math.ceil(ranked.length * AI_POOL_SHARE[difficulty]));
  const pool = ranked.slice(0, size);
  teamPools.set(difficulty, pool);
  return pool;
}

const TRAINED_LEVELS: readonly AiLevel[] = ['hard', 'veryhard', 'skynet'];
const FAST_BASE_SPEED = 80;
const FULL_EVS = 252;

function trainedEntry(id: number, { random, index, difficulty }: { random: Random; index: number; difficulty: AiLevel }): RosterEntry {
  const base = diceBase(id, index);
  const [, attack, , specialAttack, , speed] = (speciesData(id) as SpeciesData).stats;
  const physical = attack >= specialAttack;
  const fast = speed >= FAST_BASE_SPEED;
  const nature = physical ? (fast ? 'jolly' : 'adamant') : fast ? 'timid' : 'modest';
  const evs = { hp: 6, atk: physical ? FULL_EVS : 0, def: 0, satk: physical ? 0 : FULL_EVS, sdef: 0, spd: FULL_EVS };
  const rolled = randomize(base, random);
  return { ...rolled, moveset: pickMoveset(base, tactics(difficulty), random), natureChoice: nature, evs };
}

export function buildAiTeam({ difficulty, random = Math.random }: { difficulty: AiLevel; random?: Random }): RosterEntry[] {
  const ids = shuffled(aiTeamPool(difficulty), random).slice(0, PARTY_SIZE);
  return ids.map((id, index) => (TRAINED_LEVELS.includes(difficulty) ? trainedEntry(id, { random, index, difficulty }) : diceEntry(id, { random, index })));
}

export function buildAiRandomParty({ random = Math.random }: { random?: Random } = {}): RosterEntry[] {
  const ids = shuffled(aiTeamPool('easy'), random).slice(0, PARTY_SIZE);
  return ids.map((id, index) => diceEntry(id, { random, index }));
}

const REROLL_CHOICES = 3;
const PICK_NOISE: Record<'hard' | 'veryhard', number> = { hard: 2, veryhard: 0.5 };

export function aiRerollCandidates(own: RosterEntry[], random: Random = Math.random): RosterEntry[] {
  const taken = new Set(own.map((entry) => entry.finalID));
  const pool = aiTeamPool('easy');
  const picked = new Set<number>();
  for (let tries = 0; picked.size < REROLL_CHOICES && tries < REROLL_CHOICES * 20; tries++) {
    const id = pool[Math.floor(random() * pool.length)];
    if (!taken.has(id)) picked.add(id);
  }
  return [...picked].map((id, i) => diceBase(id, PARTY_SIZE + i));
}

export function aiRerollIndex({ difficulty: level, own, random = Math.random }: { difficulty: AiLevel; own: RosterEntry[]; random?: Random }): number {
  const difficulty = tactics(level);
  if (difficulty === 'easy' || difficulty === 'mid') return Math.floor(random() * own.length);
  const strength = (index: number) => bst(speciesData(own[index].finalID) ?? { stats: [0] });
  return own.map((_, index) => index).reduce((weakest, index) => (strength(index) < strength(weakest) ? index : weakest), 0);
}

// The three for the battle are picked on a hunch, without looking at the rival's party: easier
// AIs at random, harder ones leaning towards their strongest.
export function aiPicks({ difficulty: level, own, random = Math.random }: { difficulty: AiLevel; own: RosterEntry[]; random?: Random }): number[] {
  const difficulty = tactics(level);
  const order = own.map((_, i) => i);
  const count = Math.min(BATTLE_SIZE, own.length);
  if (difficulty === 'easy' || difficulty === 'mid') return shuffled(order, random).slice(0, count);
  const strength = (index: number) => bst(speciesData(own[index].finalID) ?? { stats: [0] }) / 150;
  return order
    .map((index) => ({ index, score: strength(index) + random() * PICK_NOISE[difficulty] }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map((x) => x.index);
}

// The AI decides on its belief of the battle, built only from what a human on its side sees:
// the rival's revealed moves and ability, its HP as a percentage, and its Pokémon once they've
// been out. The rest is a guess from the species, never the real thing. Its pending choice is
// never there.

const guesses = new Map<string, MoveData[]>();

// The moves a seasoned player would expect from that species at that level.
function expectedMoves(speciesId: number, level: number): MoveData[] {
  const key = `${speciesId}:${level}`;
  if (!guesses.has(key)) {
    let moves: MoveData[] = [];
    try {
      const probe = { id: `guess-${speciesId}`, finalID: speciesId, baseID: speciesId, level, ivs: PERFECT_IVS, learned: [] } as unknown as RosterEntry;
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

function believedFoe(fighter: BattleFighter): BattleFighter {
  if (!fighter.seen) return fighter;
  const look = fighter.volatiles.illusion ?? fighter.seenAs;
  let moves = fighter.moves;
  let volatiles = fighter.volatiles;
  if (!fighter.volatiles.transformed) {
    // Revealed moves keep their slot; the unknown ones become guesses (or go, if there are none).
    const known = (move: MoveData) => fighter.revealedMoves.has(move.key);
    const extra = expectedMoves(fighter.speciesId, fighter.level).filter((g) => !fighter.moves.some((m) => known(m) && m.key === g.key));
    const slots = fighter.moves.map((m) => (known(m) ? m : extra.shift()));
    moves = slots.filter(Boolean) as MoveData[];
    const slotOf = (slot: number | null | undefined) => (slot == null || !slots[slot] ? undefined : moves.indexOf(slots[slot]));
    volatiles = { ...fighter.volatiles, charging: slotOf(fighter.volatiles.charging), mustRecharge: slotOf(fighter.volatiles.mustRecharge) };
    for (const key of ['charging', 'mustRecharge'] as const) if (volatiles[key] === undefined) delete volatiles[key];
  }
  const base = fighter.form ? formData(fighter.form)?.base : speciesData(fighter.speciesId)?.stats;
  const stats = fighter.volatiles.transformed || !base ? { ...fighter.stats } : statsFor(base, PERFECT_IVS, fighter.level);
  const share = fighter.hp / fighter.stats.hp;
  const ability = fighter.revealedAbilities.has(fighter.ability) ? fighter.ability : null;
  return {
    ...fighter,
    types: look?.types ?? fighter.types,
    stats,
    hp: fighter.hp > 0 ? Math.max(1, Math.round(stats.hp * share)) : 0,
    moves,
    volatiles,
    pp: Object.fromEntries(moves.map((m) => [m.key, m.pp])),
    ability,
    baseAbility: ability,
  };
}

export function beliefOf(battle: BattleState, sideIndex: number): BattleState {
  const { random, ...state } = battle;
  const copy = structuredClone(state) as BattleState;
  const theirs = copy.sides[1 - sideIndex];
  theirs.action = null;
  theirs.team = theirs.team.map(believedFoe);
  return copy;
}

function typeEffect(move: MoveData, target: BattleFighter, knowsAbilities: boolean): number {
  if (!move.type) return 1;
  let multiplier = effectiveness(move.type, target.types);
  if (knowsAbilities && IMMUNE_BY_ABILITY[target.ability as string] === move.type) multiplier = 0;
  return multiplier;
}

function speedOf(fighter: BattleFighter): number {
  return fighter.stats.spd * stageMult(fighter.boosts.spd) * (fighter.status === 'par' ? 0.5 : 1);
}

export function estimateDamage(
  battle: BattleState,
  attacker: BattleFighter,
  target: BattleFighter,
  move: MoveData | null | undefined,
  knowsAbilities = true,
): number {
  if (!move || move.kind === 'status' || move.category === 'status') return 0;
  const eff = typeEffect(move, target, knowsAbilities);
  if (eff === 0) return 0;
  if (move.ohko) return target.level > attacker.level ? 0 : target.hp * ((move.accuracy ?? 30) / 100);
  if (move.fixedDamage) return move.fixedDamage === 'level' ? attacker.level : Number(move.fixedDamage) || 0;
  const physical = move.category === 'physical';
  const attack = (physical ? attacker.stats.atk : attacker.stats.satk) * stageMult(attacker.boosts[physical ? 'atk' : 'satk']);
  const defense = (physical ? target.stats.def : target.stats.sdef) * stageMult(target.boosts[physical ? 'def' : 'sdef']);
  let power = move.power || 0;
  if (move.multihit) power *= (move.multihit[0] + move.multihit[1]) / 2;
  let dmg = (((2 * attacker.level) / 5 + 2) * power * (attack / Math.max(1, defense))) / 50 + 2;
  if (move.type && attacker.types.includes(move.type)) dmg *= attacker.ability === 'adaptability' ? 2 : 1.5;
  dmg *= eff * 0.925 * ((move.accuracy ?? 100) / 100);
  const weather = battle.field?.weather;
  if (isSun(weather)) dmg *= move.type === 'fire' ? 1.5 : move.type === 'water' ? 0.5 : 1;
  if (isRain(weather)) dmg *= move.type === 'water' ? 1.5 : move.type === 'fire' ? 0.5 : 1;
  if (attacker.status === 'brn' && physical && attacker.ability !== 'guts') dmg *= 0.5;
  const screens: Record<string, number> = battle.sides[battle.sides.findIndex((s) => s.team.includes(target))]?.screens ?? {};
  if (screens.auroraveil || (physical ? screens.reflect : screens.lightscreen)) dmg *= 0.5;
  return dmg;
}

function bestDamage(battle: BattleState, attacker: BattleFighter, target: BattleFighter, knowsAbilities: boolean): number {
  let best = 0;
  for (const move of attacker.moves) best = Math.max(best, estimateDamage(battle, attacker, target, move, knowsAbilities));
  return best;
}

function statusImmune(target: BattleFighter, status: string): boolean {
  if (target.status) return true;
  return (STATUS_IMMUNE_TYPES[status] ?? []).some((t) => target.types.includes(t));
}

export const AI_MODULES = ['checkBadMove', 'tryToFaint', 'checkViability', 'preferHighestDamage', 'hpAware', 'setupFirstTurn', 'smartSwitching', 'smartMonChoices', 'tryTo2hko', 'speedRace', 'lookahead'] as const;
export type AiModule = (typeof AI_MODULES)[number];

export interface AiProfile {
  modules: readonly AiModule[];
  noise: number;
  switchFailure: number;
}

const BASIC: readonly AiModule[] = ['checkBadMove', 'tryToFaint', 'checkViability'];
const SMART: readonly AiModule[] = [...BASIC, 'preferHighestDamage', 'hpAware', 'setupFirstTurn', 'smartSwitching', 'smartMonChoices'];

export const AI_PROFILES: Record<Exclude<AiLevel, typeof JEV_LEVEL>, AiProfile> = {
  easy: { modules: [], noise: 60, switchFailure: 1 },
  mid: { modules: BASIC, noise: 30, switchFailure: 1 },
  hard: { modules: SMART, noise: 12, switchFailure: 0.4 },
  veryhard: { modules: [...SMART, 'tryTo2hko', 'speedRace', 'lookahead'], noise: 0, switchFailure: 0 },
};

const BASE_SCORE = 100;
const BAD_MOVE = -100;
const KO_BONUS = 40;
const PRIORITY_KO_BONUS = 20;
const DAMAGE_WEIGHT = 30;
const HIGHEST_DAMAGE_BONUS = 15;
const SETUP_FIRST_TURN_BONUS = 15;
const LOW_HP = 0.3;
const TWO_HIT_BONUS = 10;
const DOOMED_PENALTY = 25;

const has = (profile: AiProfile, module: AiModule): boolean => profile.modules.includes(module);

function badMove(battle: BattleState, sideIndex: number, idx: number, me: BattleFighter, foe: BattleFighter, knowsAbilities: boolean): boolean {
  const move = moveAt(me, idx);
  const side = battle.sides[sideIndex];
  if (moveWillFail(battle, sideIndex, idx)) return true;
  if (move.kind !== 'status' && move.category !== 'status') return estimateDamage(battle, me, foe, move, knowsAbilities) <= 0;
  if (move.status) return statusImmune(foe, move.status);
  if (move.heal) return hpShare(me) >= 1;
  if (move.screen) return !!side.screens?.[move.screen] || (move.screen === 'auroraveil' && !['hail', 'snow'].includes(battle.field.weather as string));
  if (move.weather && battle.field.weather === move.weather) return true;
  if (move.terrain && battle.field.terrain === move.terrain) return true;
  if (move.boosts && move.target === 'self') {
    const ups = (Object.entries(move.boosts) as [keyof BattleFighter['boosts'], number][]).filter(([, v]) => v > 0);
    return !ups.length || ups.every(([k]) => (me.boosts[k] ?? 0) >= 6);
  }
  if (move.boosts) return (Object.keys(move.boosts) as (keyof BattleFighter['boosts'])[]).every((k) => (foe.boosts[k] ?? 0) <= -6);
  if (move.volatile === 'leechseed') return foe.types.includes('grass') || !!foe.volatiles?.leechSeed;
  if (move.volatile === 'confusion') return !!foe.volatiles?.confusion;
  if (move.volatile === 'attract') return !!foe.volatiles?.attract;
  return false;
}

function viability(battle: BattleState, sideIndex: number, move: MoveData, me: BattleFighter, foe: BattleFighter, damage: number, threat: number): number {
  if (move.kind !== 'status' && move.category !== 'status') {
    let score = DAMAGE_WEIGHT * Math.min(1, damage / Math.max(1, foe.hp));
    if (move.selfDestruct) score -= 30;
    if (move.flags.includes('recharge') && damage < foe.hp) score -= 15;
    return score;
  }
  if (move.status) return move.status === 'par' && speedOf(foe) <= speedOf(me) ? -5 : ((STATUS_VALUE[move.status] ?? 30) - 40) / 2;
  if (move.heal) return hpShare(me) < 0.5 ? 25 : hpShare(me) < 0.7 ? 5 : -20;
  if (move.screen) return threat > 0.25 ? 12 : 0;
  if (move.weather || move.terrain) return (move.weather === 'rain' && me.types.includes('water')) || (move.weather === 'sun' && me.types.includes('fire')) ? 10 : -10;
  if (move.boosts && move.target === 'self') return hpShare(me) >= 0.6 && threat < 0.5 ? 12 : -12;
  if (move.boosts) return -8;
  if (move.volatile === 'leechseed') return 6;
  if (move.clearsScreens) return Object.keys(battle.sides[1 - sideIndex].screens ?? {}).length ? 12 : -15;
  return -15;
}

export function scoreMoves(battle: BattleState, sideIndex: number, profile: AiProfile, random: Random, legal: Action[] = validActions(battle, sideIndex)): { action: MoveAction; score: number }[] {
  const side = battle.sides[sideIndex];
  const me = side.team[side.active];
  const foeSide = battle.sides[1 - sideIndex];
  const foe = foeSide.team[foeSide.active];
  const actions = legal.filter((o): o is MoveAction => o.type === 'move');
  const smart = has(profile, 'tryToFaint') || has(profile, 'checkViability');
  if (!foe || foe.hp <= 0) return actions.map((action) => ({ action, score: BASE_SCORE }));
  const threat = smart ? bestDamage(battle, foe, me, true) / Math.max(1, me.hp) : 0;
  const damages = actions.map((action) => estimateDamage(battle, me, foe, moveAt(me, action.move), true));
  const strongest = Math.max(...damages);
  const firstTurn = !me.volatiles.acted;
  return actions.map((action, i) => {
    const move = moveAt(me, action.move);
    const damage = damages[i];
    const attacking = move.kind !== 'status' && move.category !== 'status';
    let score = BASE_SCORE;
    if (has(profile, 'checkBadMove') && badMove(battle, sideIndex, action.move, me, foe, true)) score += BAD_MOVE;
    if (has(profile, 'tryToFaint') && attacking && damage >= foe.hp) {
      score += KO_BONUS;
      if (move.priority > 0 && threat >= 1 && speedOf(foe) >= speedOf(me)) score += PRIORITY_KO_BONUS;
    }
    if (has(profile, 'checkViability')) score += viability(battle, sideIndex, move, me, foe, damage, threat);
    if (has(profile, 'preferHighestDamage') && attacking && damage > 0 && damage === strongest) score += HIGHEST_DAMAGE_BONUS;
    if (has(profile, 'tryTo2hko') && attacking && damage < foe.hp && damage * 2 >= foe.hp) score += TWO_HIT_BONUS;
    if (has(profile, 'speedRace') && threat >= 1 && speedOf(foe) > speedOf(me) && !(attacking && damage >= foe.hp && move.priority > 0)) score -= DOOMED_PENALTY;
    if (has(profile, 'hpAware') && hpShare(me) < LOW_HP) {
      if (!attacking && !move.heal) score -= 20;
      if (move.selfDestruct) score += 35;
    }
    if (has(profile, 'setupFirstTurn') && firstTurn && !attacking && ((move.boosts && move.target === 'self') || move.screen || move.sideCondition)) score += SETUP_FIRST_TURN_BONUS;
    return { action, score: score + random() * (profile.noise || 0.01) };
  });
}

export function scoreMove(battle: BattleState, sideIndex: number, idx: number): number {
  const scored = scoreMoves(battle, sideIndex, AI_PROFILES.veryhard, () => 0, battle.sides[sideIndex].team[battle.sides[sideIndex].active].moves.map((_, move) => ({ type: 'move', move })));
  return scored.find((x) => x.action.move === idx)?.score ?? 0;
}

function matchupScore(battle: BattleState, mon: BattleFighter, foe: BattleFighter | null | undefined, knowsAbilities: boolean): number {
  if (!foe || foe.hp <= 0) return hpShare(mon);
  const dealt = Math.min(1, bestDamage(battle, mon, foe, knowsAbilities) / foe.hp);
  const taken = Math.min(1, bestDamage(battle, foe, mon, knowsAbilities) / Math.max(1, mon.hp));
  const faster = speedOf(mon) > speedOf(foe) ? 0.15 : 0;
  return dealt - taken + faster + hpShare(mon) * 0.3;
}

function sideValue(side: BattleSide): number {
  return side.team.reduce((sum, f) => sum + (f.hp > 0 ? 0.35 + f.hp / f.stats.hp : 0), 0);
}

function evaluate(battle: BattleState, sideIndex: number): number {
  if (battle.status === 'finished') return battle.winner === sideIndex ? 100 : battle.winner === null ? 0 : -100;
  return sideValue(battle.sides[sideIndex]) - sideValue(battle.sides[1 - sideIndex]);
}

function simulate(battle: BattleState, sideIndex: number, mine: Action, theirs: Action | null, seed: string): number {
  const { random, ...state } = battle;
  const copy = structuredClone(state) as BattleState;
  copy.random = rng(seed);
  submit(copy, sideIndex, mine);
  if (theirs && needsAction(copy, 1 - sideIndex)) submit(copy, 1 - sideIndex, theirs);
  return evaluate(copy, sideIndex);
}

const SEARCH_SEEDS = 2;

function lookahead(battle: BattleState, sideIndex: number, options: Action[]): Action | null {
  const rival = battle.sides[1 - sideIndex].team;
  const theirs = validActions(battle, 1 - sideIndex).filter((a) => a.type !== 'switch' || rival[a.to].seen);
  const replies: (Action | null)[] = theirs.length ? theirs : [null];
  let best: Action | null = null;
  let bestValue = -Infinity;
  for (const mine of options) {
    const outcomes = replies.map((reply) => {
      let total = 0;
      for (let seed = 0; seed < SEARCH_SEEDS; seed++)
        total += simulate(battle, sideIndex, mine, reply, `${battle.turn}:${seed}:${JSON.stringify(mine)}:${JSON.stringify(reply)}`);
      return total / SEARCH_SEEDS;
    });
    // When every line looks the same (say, lost either way), the plain move score breaks the tie.
    const tiebreak = mine.type === 'move' ? scoreMove(battle, sideIndex, mine.move) / 1e5 : 0;
    const value = 0.6 * Math.min(...outcomes) + 0.4 * (outcomes.reduce((a, x) => a + x, 0) / outcomes.length) + tiebreak - (mine.type === 'switch' ? LOOKAHEAD_SWITCH_COST : 0);
    if (value > bestValue) [best, bestValue] = [mine, value];
  }
  return best;
}

function safeLookahead(battle: BattleState, sideIndex: number, options: Action[]): Action | null {
  try {
    return lookahead(battle, sideIndex, options);
  } catch {
    return null;
  }
}

function chooseReplacement(battle: BattleState, sideIndex: number, profile: AiProfile, switches: SwitchAction[], random: Random): SwitchAction {
  if (!has(profile, 'smartMonChoices')) return profile.noise >= AI_PROFILES.easy.noise ? switches[0] : pickOne(switches, random);
  const side = battle.sides[sideIndex];
  const foeSide = battle.sides[1 - sideIndex];
  const foe = foeSide.team[foeSide.active];
  if (foe && foe.hp > 0) {
    const revenge = switches.find((action) => {
      const mon = side.team[action.to];
      return speedOf(mon) > speedOf(foe) && bestDamage(battle, mon, foe, true) >= foe.hp;
    });
    if (revenge) return revenge;
  }
  return switches
    .map((action) => ({ action, score: matchupScore(battle, side.team[action.to], foe, true) + random() * profile.noise * 0.002 }))
    .sort((x, y) => y.score - x.score)[0].action;
}

const SWITCH_MARGIN = 0.35;
/** A switch gives the rival a free hit, and going back and forth reads as nonsense: the search needs a clear gain to make one. */
const LOOKAHEAD_SWITCH_COST = 0.25;

/**
 * A Pokémon that came in after the opening turn (as a replacement or by a switch) has not fought yet:
 * it stays at least one turn instead of being called back right away. The lead may still leave a bad
 * opening.
 */
const justCameIn = (battle: BattleState, me: BattleFighter): boolean => battle.turn > 1 && me.activeTurns < 1;

function shouldSwitch(battle: BattleState, sideIndex: number, profile: AiProfile, best: number, switches: SwitchAction[], random: Random): SwitchAction | null {
  if (!switches.length || !has(profile, 'smartSwitching') || random() < profile.switchFailure) return null;
  const side = battle.sides[sideIndex];
  const me = side.team[side.active];
  if (justCameIn(battle, me)) return null;
  const foeSide = battle.sides[1 - sideIndex];
  const foe = foeSide.team[foeSide.active];
  if (!foe || foe.hp <= 0) return null;
  const canKo = bestDamage(battle, me, foe, true) >= foe.hp;
  const doomed = bestDamage(battle, foe, me, true) >= me.hp && speedOf(foe) > speedOf(me);
  const stuck = best < BASE_SCORE;
  if (canKo || !(doomed || stuck)) return null;
  const here = matchupScore(battle, me, foe, true);
  const alt = switches
    .map((action) => ({ action, score: matchupScore(battle, side.team[action.to], foe, true) }))
    .sort((x, y) => y.score - x.score)[0];
  if (alt.score <= here + SWITCH_MARGIN) return null;
  return alt.action;
}

export function chooseAction(battle: BattleState, sideIndex: number, level: AiLevel, random: Random = Math.random): Action | null {
  const profile = AI_PROFILES[tactics(level)];
  const options = validActions(battle, sideIndex);
  if (!options.length) return null;
  if (options.length === 1) return options[0];
  const belief = beliefOf(battle, sideIndex);
  const switches = options.filter((o): o is SwitchAction => o.type === 'switch');
  const foeSide = belief.sides[1 - sideIndex];
  const foe = foeSide.team[foeSide.active];

  if (!options.some((o) => o.type === 'move')) return chooseReplacement(belief, sideIndex, profile, switches, random);
  const scored = scoreMoves(belief, sideIndex, profile, random, options).sort((x, y) => y.score - x.score);
  if (has(profile, 'lookahead') && belief.phase === 'choose' && foe && foe.hp > 0) {
    const me = belief.sides[sideIndex].team[belief.sides[sideIndex].active];
    const shortlist = [...scored.map((x) => x.action), ...(justCameIn(belief, me) ? [] : switches)];
    const chosen = safeLookahead(belief, sideIndex, shortlist);
    if (chosen) return chosen;
  }
  return shouldSwitch(belief, sideIndex, profile, scored[0].score, switches, random) ?? scored[0].action;
}

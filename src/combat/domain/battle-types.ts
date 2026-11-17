// The shapes the battle engine works on. The engine (battle.ts) mutates these in place; the rules of
// abilities (catalog/domain/abilities.ts) and moves (catalog/domain/move-rules.ts) receive them
// through the APIs battle.ts hands them (AbilityEngine and MoveRuleApi).
import type { BoostKey, Fighter, MoveData, Stats } from '../../catalog/domain/creatures.js';
import type { Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';

export interface MoveAction {
  type: 'move';
  /** Index in the active fighter's moves, or STRUGGLE_MOVE (-1). */
  move: number;
}

export interface SwitchAction {
  type: 'switch';
  /** Index in the team. */
  to: number;
}

export type Action = MoveAction | SwitchAction;

/** A chosen action; `auto` marks one the server played for the trainer (a locked move). */
export type SideAction = Action & { auto?: boolean };

/**
 * Volatile state of a fighter on the field: dozens of keys (confusion, substitute, encore,
 * illusion, lockedMove, stockpile…), each with its own shape, set and read by the engine and by many
 * move and ability rules, and wiped when the fighter leaves. It is deliberately loose: typing every
 * key precisely would mean a second copy of the rules. It never leaves the server as is
 * (publicState() picks what clients see).
 */
export type Volatiles = Record<string, any>;

/** How a fighter looks to the rival (also what Illusion copies). */
export interface Look {
  name: string;
  speciesName: string;
  sprite: string;
  floats: boolean;
  types: string[];
  shiny: boolean;
  rarity: Rarity;
}

/** A fighter in battle: the static Fighter plus everything that changes during the fight. */
export interface BattleFighter extends Fighter {
  hp: number;
  boosts: Record<BoostKey, number>;
  status: string | null;
  statusTurns: number;
  volatiles: Volatiles;
  activeTurns: number;
  form: string | null;
  permanentForm?: string | null;
  baseTypes: string[];
  baseStats: Stats;
  baseSprite: string;
  speciesStats: Stats;
  speciesTypes: string[];
  seen: boolean;
  seenAs: Look | null;
  baseAbility: string | null;
  revealedAbilities: Set<string | null>;
  revealedMoves: Set<string>;
  pp: Record<string, number>;
  fainted?: boolean;
  turnHit?: { by: BattleFighter; physical: boolean; special: boolean; amount: number };
  timesHit?: number;
  // Once-per-battle markers set by ability rules.
  onceUsed?: boolean;
  battleBondUsed?: boolean;
  disguiseBusted?: boolean;
  heroPending?: boolean;
  syrupUsed?: boolean;
}

/**
 * A move being used: a copy of the catalog move that this use may change (type, power, category)
 * plus where it comes from. Rules may tag it with their own markers (skinBoost, instructed…).
 */
export interface BattleMove extends MoveData {
  effectivePriority: number;
  /** Index in the user's moves, or null when another move called it. */
  slot: number | null;
  skinBoost?: boolean;
  instructed?: boolean;
  powerMult?: number;
  /** Bide: the damage it stored, doubled. */
  bideDamage?: number;
}

export interface FieldState {
  weather: string | null;
  weatherTurns: number;
  weatherSetter: BattleFighter | null;
  terrain: string | null;
  terrainTurns: number;
  /** Gravity, Trick Room… → turns left. */
  rooms: Record<string, number>;
}

export interface Hazards {
  spikes: number;
  stealthrock: boolean;
  stickyweb: boolean;
}

export interface BattleSide {
  trainerId: string;
  name: string;
  team: BattleFighter[];
  active: number;
  action: SideAction | null;
  mustSwitch: boolean;
  toxicSpikes: number;
  screens: Record<string, number>;
  hazards: Hazards;
  /** Side conditions (tailwind, safeguard, quickguard…) → turns left or the turn they were set. */
  conds: Record<string, number>;
  /** What Baton Pass and friends hand to the next fighter (boosts and volatiles). */
  pass?: Volatiles;
  healingWish?: string;
  faintedTurn?: number;
  wish?: { at: number; amount: number; name: string };
  future?: { at: number; user: BattleFighter; move: BattleMove; name: string };
}

/**
 * One thing that happened, for the browser to animate. `t` says what; the other fields depend on it
 * (side, name, amount, hp/max, status…). Events about HP carry `hp`/`max`; viewEvents() turns them
 * into percentages for whoever must not see exact numbers.
 */
export interface BattleEvent {
  t: string;
  side?: number | null;
  hp?: number;
  max?: number;
  amount?: number;
  stats?: unknown;
  [field: string]: unknown;
}

/** A fighter about to use its move this turn, with what decides the order. */
export interface Mover extends MoveAction {
  sideIndex: number;
  auto?: boolean;
  fighter: BattleFighter;
  prio: number;
  frac: number;
  spd: number;
  tie: number;
  why?: string | null;
}

export interface BattleState {
  id: string;
  levelCap: number | null;
  random: () => number;
  status: 'active' | 'finished';
  phase: 'choose' | 'replace' | 'switchout';
  turn: number;
  winner: number | null;
  field: FieldState;
  sides: BattleSide[];
  /** Events of the step being resolved. */
  events: BattleEvent[];
  moved: Set<BattleFighter>;
  /** Mold Breaker: the target whose breakable ability is ignored during this move. */
  moldBreaker: { target: BattleFighter } | null;
  intro: BattleEvent[];
  chosen?: (MoveData | null)[];
  lastMove?: string;
  echo?: { turn: number; count: number };
  pending?: { movers: Mover[]; next: number };
}

export interface BattleSideInput {
  trainerId: string;
  name: string;
  entries: RosterEntry[];
}

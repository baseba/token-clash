// The shapes the battle engine works on. The engine (battle.ts) mutates these in place; the rules of
// abilities (catalog/domain/abilities.ts) and moves (catalog/domain/move-rules.ts) receive them
// through the APIs battle.ts hands them (AbilityEngine and MoveRuleApi).
import type { BoostKey, Fighter, MajorStatus, MoveData, StatKey, Stats, Weather } from '../../catalog/domain/creatures.js';
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

/** A move that keeps its user locked in for several turns, by what it counts. */
export type LockedMove =
  | { kind: 'bide'; move: number | null; turns: number; damage: number }
  | { kind: 'rollout'; move: number | null; count: number }
  | { kind: 'uproar'; move: number | null; turns: number };

/**
 * Volatile state of a fighter on the field, set and read by the engine and by the move and ability
 * rules, and wiped when the fighter leaves. Numbers named after a move without "turns" are the turn
 * it was used. It never leaves the server as is (publicState() picks what clients see).
 */
export interface Volatiles {
  /** The turn this fighter came out. */
  enteredTurn?: number;
  /** Who it is disguised as (Illusion). */
  illusion?: Look;
  /** It already used a move since it came out. */
  acted?: boolean;
  aquaRing?: boolean;
  /** Who it is infatuated with. */
  attract?: BattleFighter;
  /** Caught by a binding move (Wrap, Fire Spin…) of `by`. */
  bound?: { turns: number; by: BattleFighter; move: string };
  charge?: boolean;
  /** Slot of the two-turn move it is charging (Fly, Solar Beam…). */
  charging?: number;
  /** Turns of confusion left. */
  confusion?: number;
  curse?: boolean;
  defenseCurl?: boolean;
  destinyBond?: boolean;
  disabled?: { key: string; name: string; turns: number };
  electrify?: number;
  encore?: { key: string; turns: number };
  endure?: number;
  flashFire?: boolean;
  flinch?: boolean;
  focusEnergy?: boolean;
  /** Id of the move it is focusing for (Focus Punch, Shell Trap, Beak Blast). */
  focusing?: string;
  foresight?: boolean;
  /** Fury Cutter hits in a row. */
  furyCutter?: number;
  gastroAcid?: boolean;
  glaiveRush?: number;
  grudge?: boolean;
  /** What Cramorant swallowed (Gulp Missile). */
  gulp?: 'arrokuda' | 'pikachu';
  healBlock?: { turns: number };
  imprison?: boolean;
  ingrain?: boolean;
  /** Last turn of Laser Focus. */
  laserFocus?: number;
  lastFailed?: boolean;
  /** Key of the last move it used. */
  lastMove?: string;
  leechSeed?: boolean;
  locked?: LockedMove;
  /** Key of the move Gorilla Tactics locks it into. */
  lockedMove?: string;
  /** The foe its next move can't miss (Lock-On, Mind Reader). */
  lockOn?: BattleFighter;
  magicCoat?: number;
  magnetRise?: { turns: number };
  /** The slot Mimic replaced and the move that was there. */
  mimic?: { slot: number; original: MoveData };
  miracleEye?: boolean;
  /** Slot of the move it must recharge from (Hyper Beam…). */
  mustRecharge?: number;
  nightmare?: boolean;
  noRetreat?: boolean;
  /** Who holds it with Octolock. */
  octolock?: BattleFighter;
  /** The stat Protosynthesis or Quark Drive raises. */
  paradoxStat?: StatKey;
  /** Perish Song count left. */
  perish?: number;
  powerTrick?: boolean;
  /** Key of the move it used before the last one. */
  prevMove?: string;
  proteanUsed?: boolean;
  protect?: { turn: number; kind: string };
  rage?: boolean;
  /** Outrage and friends: the slot, and how many more turns. */
  rampage?: { move: number; left: number };
  saltCure?: boolean;
  /** Turns of Slow Start left. */
  slowStart?: number;
  smackedDown?: boolean;
  snatch?: number;
  /** Protect-like moves used in a row. */
  stall?: number;
  /** Stockpile count and the defense boosts it gave, to take back. */
  stockpile?: { count: number; def: number; sdef: number };
  /** HP left in its substitute. */
  substitute?: number;
  /** It switches out at the end of this action (U-turn, Baton Pass, Emergency Exit…). */
  switchNow?: boolean;
  taunt?: { turns: number };
  telekinesis?: { turns: number };
  torment?: boolean;
  /** What Transform replaced, to restore when it leaves. */
  transformed?: Pick<BattleFighter, 'types' | 'stats' | 'moves' | 'sprite' | 'floats' | 'pp'>;
  /** Who keeps it from switching out (Mean Look, Jaw Lock…). */
  trappedBy?: BattleFighter;
  truantRest?: boolean;
  uproar?: boolean;
  /** Keys of the moves it used since it came out (Last Resort). */
  usedMoves?: Set<string>;
  /** Turns until Yawn puts it to sleep. */
  yawn?: number;
}

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
  status: MajorStatus | null;
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
  weather: Weather | null;
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

/** What a side's own moves set up for several turns (Tailwind, Safeguard, Mist, Lucky Chant). */
export type SideCondition = 'tailwind' | 'safeguard' | 'mist' | 'luckychant';
/** A guard shields its side for the turn it is raised (Quick Guard, Wide Guard, Crafty Shield, Mat Block). */
export type Guard = 'quickguard' | 'wideguard' | 'craftyshield' | 'matblock';

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
  /** Turns left of each side condition. */
  conds: Partial<Record<SideCondition, number>>;
  /** Guards raised this turn. */
  guards: Set<Guard>;
  /** What Baton Pass and friends hand to the next fighter. */
  pass?: Volatiles & { boosts?: Record<BoostKey, number> };
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

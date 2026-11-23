// The shapes the battle engine works on. The engine mutates these in place; the rules of abilities
// (ability-effects.ts) and moves (move-rules.ts) receive them through the APIs the engine hands them
// (AbilityEngine in ability-engine.ts, MoveRuleApi in move-rule-api.ts).
import type { AbilityInfo } from '../../catalog/domain/abilities.js';
import type { BoostKey, MajorStatus, MoveCategory, StatKey, Stats, Weather } from '../../catalog/domain/creatures.js';
import type { Fighter } from './fighter.js';
import type { MoveData, MoveTarget } from './moves.js';
import type { Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';
import type { FighterView, PublicMove } from './battle-view.js';

export interface MoveAction {
  type: 'move';
  /** Index in the active fighter's moves, or STRUGGLE_MOVE (-1). */
  move: number;
  target?: MoveTarget;
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
  roost?: number;
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

/** A move as engine functions take it: a catalog move, or the copy being used this turn. */
export type AnyMove = MoveData | BattleMove;

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
  avatar: string | null;
  frame: string | null;
  ball: string;
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

/** The fighter an event is about: its side, and its name as the rival sees it (Illusion's, when disguised). */
interface About {
  side: number;
  name: string;
}

/** An HP change: `hp` and `max` are exact here; viewEvents() turns a rival's into percentages. */
interface HpChange {
  side: number;
  hp: number;
  max: number;
}

/** Why the first of two attackers went first. */
export type OrderReason = 'priority' | 'speed' | 'tie';

export interface MoveEvent extends About {
  t: 'move';
  move: string;
  type: string | null;
  kind: MoveData['kind'];
  key: string;
  category: MoveCategory;
  target: string;
  flags: string[];
  /** What a status move does, for the animation. */
  effect?: 'heal' | 'weather' | 'boost' | 'debuff';
  stat?: string;
  multihit?: true;
  drain?: true;
  /** Another move called it (Metronome, Sleep Talk…). */
  called?: true;
  why?: OrderReason;
}

/**
 * One thing that happened, for the browser to animate (public/app.js reads each by its `t`). These
 * are the exact shapes sent over the wire; viewEvents() adapts them for each client.
 */
export type BattleEvent =
  | { t: 'turn'; turn: number }
  | MoveEvent
  | (About & { t: 'charging'; move: string; key: string; hidden: boolean })
  | (About & { t: 'focus'; move: string; key: string })
  | (About & { t: 'cant'; reason: string; move?: string })
  | { t: 'nothing'; side: number; reason?: string }
  | { t: 'notarget' | 'miss'; side: number }
  | { t: 'immune'; side: number; terrain?: string }
  | { t: 'fizzle'; side: number; weather: Weather }
  | (About & { t: 'protected' | 'protectBroken' | 'endured' | 'faint' | 'confused' | 'stickyWeb' | 'switchOut' | 'dragged' | 'boostsReset' | 'bide' | 'wish' })
  | (About & { t: 'bounced' | 'snatched' | 'grudge' | 'learned' | 'futureStart' | 'futureHit'; move: string })
  | (HpChange & { t: 'damage'; amount: number; eff: number; crit: boolean })
  | (About & { t: 'subDamage'; amount: number; eff: number; crit: boolean })
  | (HpChange & { t: 'hurt'; amount: number; cause?: string | null })
  | (HpChange & { t: 'heal'; amount: number; quiet?: true })
  | (HpChange & { t: 'revive'; index: number; name: string })
  | (HpChange & { t: 'form'; form: string | null; stats: Stats; types: string[]; sprite: string })
  | { t: 'hits'; side: number; count: number }
  | (About & { t: 'destinyBond'; from: string })
  | (About & { t: 'infatuated'; by: string })
  | (About & { t: 'perish'; count: number })
  | (About & { t: 'pp'; move?: string; lost: number })
  | (About & { t: 'status' | 'cure'; status: MajorStatus })
  | { t: 'boost'; side: number; name?: string; stat: BoostKey; by: number; stage: number }
  | (About & { t: 'boosts'; boosts: Record<BoostKey, number> })
  | (About & { t: 'stats'; stats: Stats })
  | (About & { t: 'volatile'; kind: string; move?: string; count?: number })
  | (About & { t: 'volatileEnd'; kind: string; move?: string })
  | (About & { t: 'protect' | 'healingWish'; kind: string })
  | { t: 'sideStart'; side: number; kind: string; layers?: number; name?: string }
  | { t: 'sideEnd'; side: number; kind: string }
  | { t: 'hazard'; side: number; layers: number }
  | { t: 'hazardEnd' | 'teamCured' | 'replace'; side: number }
  | { t: 'screen'; side: number; screen: string; turns: number }
  | { t: 'screenEnd'; side: number; screen: string; cause: string }
  | { t: 'fieldStart' | 'fieldEnd'; kind: string }
  | { t: 'weather' | 'weatherEnd'; weather: Weather }
  | { t: 'terrain' | 'terrainEnd'; terrain: string }
  | { t: 'courtChange' }
  | { t: 'magnitude'; side: number; n: number }
  | (About & { t: 'ability'; ability: string | null; info: AbilityInfo | null; note?: string } & AbilityDetails)
  /** A held item acted; `usedUp` when it is gone. */
  | (About & { t: 'item'; item: string; usedUp?: true })
  | { t: 'abilityChange'; side: number; ability: AbilityInfo | null }
  | { t: 'types'; side: number; types: string[] }
  | {
      t: 'transform';
      side: number;
      into: string;
      sprite: string;
      floats: boolean;
      types: string[];
      stats: Stats;
      moves: PublicMove[];
      boosts: Record<BoostKey, number>;
    }
  | (About & { t: 'switch'; to: number; from: string; forced: boolean; card: FighterView; seen: FighterView })
  | { t: 'end'; winner: number | null; reason?: 'limit' | 'forfeit' };

/** What an ability shows along with its name: the ability Trace copied, the move Forewarn found… */
export interface AbilityDetails {
  copied?: string;
  move?: string;
  look?: Look;
  stat?: StatKey;
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
  why?: OrderReason | null;
}

export interface BattleState {
  id: string;
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
  avatar?: string;
  frame?: string | null;
  ball?: string;
  entries: RosterEntry[];
}

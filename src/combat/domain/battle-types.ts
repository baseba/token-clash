import type { AbilityInfo } from '../../catalog/domain/abilities.js';
import type { BoostKey, Boosts, MajorStatus, MoveCategory, MoveEntry, MoveSecondary, NatureInfo, StatKey, Stats, Weather } from '../../catalog/domain/creatures.js';
import type { Gender, Ivs, Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';

export type MoveTarget = 'foe' | 'self';

export interface MoveData extends MoveEntry {
  key: string;
  id: string;
  kind: 'attack' | 'status';
  supported: boolean;
  weakenedByGrassyTerrain?: boolean;
  usesTargetAttack?: boolean;
  screen?: string;
  breaksScreens?: boolean;
  clearsScreens?: boolean;
  firstTurnOnly?: boolean;
  rampage?: boolean;
  binds?: boolean;
  traps?: boolean;
  selfSwitch?: boolean;
  forceSwitch?: boolean;
  leavesOne?: boolean;
  crashes?: boolean;
  ignoresDefBoosts?: boolean;
  hitsPhysicalDef?: boolean;
  losesType?: string;
  selfCost?: number;
  usesDefense?: boolean;
  extraType?: string;
  recoilMaxHp?: number;
  usableAsleep?: boolean;
  grounds?: boolean;
  hitsAirborne?: boolean;
  curls?: boolean;
  thaws?: boolean;
  aimable?: MoveTarget;
}

export interface Fighter {
  uid: string;
  name: string;
  speciesName: string;
  speciesId: number;
  types: string[];
  rarity: Rarity;
  shiny: boolean;
  level: number;
  stats: Stats;
  moves: MoveData[];
  sprite: string;
  floats: boolean;
  ability: string | null;
  abilityInfo: AbilityInfo | null;
  gender: Gender | null;
  nature: string | null;
  natureInfo: NatureInfo | null;
  evs: Ivs;
  speciesBase: Stats;
  ivs: Ivs;
  item?: string | null;
}

export interface PublicMove {
  name: string;
  type: string | null;
  power: number;
  accuracy: number | null;
  priority: number;
  kind: 'attack' | 'status';
  category: MoveCategory;
  desc: string;
  key: string;
  contact: boolean;
  pp: number;
  target: string;
  aimable?: MoveTarget;
  boosts?: Boosts;
  status?: MajorStatus;
  heal?: number;
  weather?: Weather;
  screen?: string;
  breaksScreens?: boolean;
  fixedDamage?: number | string;
  ohko?: boolean;
  charge?: boolean;
  recharge?: boolean;
  secondary?: MoveSecondary[];
  self?: Boosts;
  recoil?: number;
  drain?: number;
  crit?: number;
  multihit?: boolean;
}

export interface PublicVolatiles {
  confusion?: boolean;
  attract?: boolean;
  perish?: number;
  charge?: boolean;
  flashFire?: boolean;
  disabled?: string;
  slowStart?: number;
  bound?: string;
  trapped?: boolean;
  saltcure?: boolean;
  smackdown?: boolean;
  noRetreat?: boolean;
  substitute?: boolean;
  taunt?: number;
  encore?: string;
  torment?: boolean;
  healblock?: number;
  yawn?: boolean;
  nightmare?: boolean;
  curse?: boolean;
  focusenergy?: boolean;
  ingrain?: boolean;
  aquaring?: boolean;
  magnetrise?: number;
  telekinesis?: number;
  foresight?: boolean;
  miracleeye?: boolean;
  stockpile?: number;
  gastroacid?: boolean;
  uproar?: boolean;
  imprison?: boolean;
}

export interface VisibleFighterView {
  uid: string;
  hidden?: false;
  name: string;
  speciesName: string;
  types: string[];
  rarity: Rarity;
  shiny: boolean;
  level: number;
  stats: Pick<Stats, 'hp'> & Partial<Stats>;
  hp: number;
  hpPercent?: true;
  boosts: Record<BoostKey, number>;
  pp: Record<string, number>;
  gender: Gender | null;
  sprite: string;
  floats: boolean;
  status: string | null;
  volatiles: PublicVolatiles;
  abilityInfo: AbilityInfo | null;
  moves: PublicMove[];
  speciesBase?: Stats;
  evs?: Ivs;
  natureInfo?: NatureInfo | null;
}

export type HiddenFighterView = { uid: string; hidden: true } & { [K in Exclude<keyof VisibleFighterView, 'uid' | 'hidden'>]?: undefined };

export type FighterView = VisibleFighterView | HiddenFighterView;

export interface MoveAction {
  type: 'move';
  move: number;
  target?: MoveTarget;
}

export interface SwitchAction {
  type: 'switch';
  to: number;
}

export type Action = MoveAction | SwitchAction;

export type SideAction = Action & { auto?: boolean };

export type LockedMove =
  | { kind: 'bide'; move: number | null; turns: number; damage: number }
  | { kind: 'rollout'; move: number | null; count: number }
  | { kind: 'uproar'; move: number | null; turns: number };

export interface Volatiles {
  enteredTurn?: number;
  illusion?: Look;
  acted?: boolean;
  aquaRing?: boolean;
  attract?: BattleFighter;
  bound?: { turns: number; by: BattleFighter; move: string };
  charge?: boolean;
  charging?: number;
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
  focusing?: string;
  foresight?: boolean;
  furyCutter?: number;
  gastroAcid?: boolean;
  glaiveRush?: number;
  grudge?: boolean;
  gulp?: 'arrokuda' | 'pikachu';
  healBlock?: { turns: number };
  imprison?: boolean;
  ingrain?: boolean;
  laserFocus?: number;
  lastFailed?: boolean;
  lastMove?: string;
  leechSeed?: boolean;
  locked?: LockedMove;
  lockedMove?: string;
  lockOn?: BattleFighter;
  magicCoat?: number;
  magnetRise?: { turns: number };
  roost?: number;
  mimic?: { slot: number; original: MoveData };
  miracleEye?: boolean;
  mustRecharge?: number;
  nightmare?: boolean;
  noRetreat?: boolean;
  octolock?: BattleFighter;
  paradoxStat?: StatKey;
  perish?: number;
  powerTrick?: boolean;
  prevMove?: string;
  proteanUsed?: boolean;
  protect?: { turn: number; kind: string };
  rage?: boolean;
  rampage?: { move: number; left: number };
  saltCure?: boolean;
  slowStart?: number;
  smackedDown?: boolean;
  snatch?: number;
  stall?: number;
  stockpile?: { count: number; def: number; sdef: number };
  substitute?: number;
  switchNow?: boolean;
  taunt?: { turns: number };
  telekinesis?: { turns: number };
  torment?: boolean;
  transformed?: Pick<BattleFighter, 'types' | 'stats' | 'moves' | 'sprite' | 'floats' | 'pp'>;
  trappedBy?: BattleFighter;
  truantRest?: boolean;
  uproar?: boolean;
  usedMoves?: Set<string>;
  yawn?: number;
}

export interface Look {
  name: string;
  speciesName: string;
  sprite: string;
  floats: boolean;
  types: string[];
  shiny: boolean;
  rarity: Rarity;
}

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
  onceUsed?: boolean;
  battleBondUsed?: boolean;
  disguiseBusted?: boolean;
  heroPending?: boolean;
  syrupUsed?: boolean;
}

export interface BattleMove extends MoveData {
  effectivePriority: number;
  slot: number | null;
  skinBoost?: boolean;
  instructed?: boolean;
  powerMult?: number;
  bideDamage?: number;
}

export type AnyMove = MoveData | BattleMove;

export interface FieldState {
  weather: Weather | null;
  weatherTurns: number;
  weatherSetter: BattleFighter | null;
  terrain: string | null;
  terrainTurns: number;
  rooms: Record<string, number>;
}

export interface Hazards {
  spikes: number;
  stealthrock: boolean;
  stickyweb: boolean;
}

export type SideCondition = 'tailwind' | 'safeguard' | 'mist' | 'luckychant';
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
  conds: Partial<Record<SideCondition, number>>;
  guards: Set<Guard>;
  pass?: Volatiles & { boosts?: Record<BoostKey, number> };
  healingWish?: string;
  faintedTurn?: number;
  wish?: { at: number; amount: number; name: string };
  future?: { at: number; user: BattleFighter; move: BattleMove; name: string };
}

interface About {
  side: number;
  name: string;
}

interface HpChange {
  side: number;
  hp: number;
  max: number;
}

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
  effect?: 'heal' | 'weather' | 'boost' | 'debuff';
  stat?: string;
  multihit?: true;
  drain?: true;
  called?: true;
  why?: OrderReason;
}

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

export interface AbilityDetails {
  copied?: string;
  move?: string;
  look?: Look;
  stat?: StatKey;
}

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
  events: BattleEvent[];
  moved: Set<BattleFighter>;
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

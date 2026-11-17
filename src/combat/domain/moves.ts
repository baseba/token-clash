// A catalog move as Token Clash plays it. moveData() reads a movedex.json row the way the engine needs it
// (Foul Play attacks with the target's Attack, Outrage rampages…), and decides whether the engine can play the
// move at all: `supported`. Trainers, the AI and the browser ask this module, so the catalog never has to know
// what the engine can do.
import { moveEntry, type MoveEntry } from '../../catalog/domain/creatures.js';
import { IMPOSSIBLE_MOVES, MOVE_RULES } from './move-rules.js';

/** A move as the engine reads it: its movedex.json row, plus what the engine derives from it. */
export interface MoveData extends MoveEntry {
  key: string;
  id: string;
  kind: 'attack' | 'status';
  /** The engine plays it: the generic rules cover it or it has a rule of its own, and it isn't impossible here. */
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
}

const SUPPORTED_VOLATILES = new Set(['confusion', 'attract', 'leechseed']);
const SPECIAL_STATUS_MOVES = new Set(['rest', 'synthesis', 'morning-sun', 'moonlight', 'shore-up']);
const GRASSY_HALVED = new Set(['earthquake', 'bulldoze', 'magnitude']);
const SCREEN_MOVES: Record<string, string> = { reflect: 'reflect', 'light-screen': 'lightscreen', 'aurora-veil': 'auroraveil' };
const SCREEN_BREAKERS = new Set(['brick-break', 'psychic-fangs', 'raging-bull']);
const FIRST_TURN_ONLY = new Set(['fake-out', 'first-impression', 'mat-block']);
const RAMPAGE = new Set(['outrage', 'thrash', 'petal-dance', 'raging-fury']);
const BINDING = new Set(['bind', 'wrap', 'fire-spin', 'whirlpool', 'sand-tomb', 'clamp', 'infestation', 'magma-storm', 'thunder-cage', 'snap-trap']);
const TRAPPING = new Set(['jaw-lock', 'anchor-shot', 'spirit-shackle', 'thousand-waves']);
const SELF_SWITCH = new Set(['u-turn', 'volt-switch', 'flip-turn']);
const FORCE_SWITCH = new Set(['dragon-tail', 'circle-throw']);
const LEAVES_ONE = new Set(['false-swipe', 'hold-back']);
const CRASHES = new Set(['high-jump-kick', 'jump-kick', 'axe-kick', 'supercell-slam']);
const IGNORES_DEF_BOOSTS = new Set(['sacred-sword', 'darkest-lariat', 'chip-away']);
const HITS_PHYSICAL_DEF = new Set(['psyshock', 'psystrike', 'secret-sword']);
const LOSES_TYPE: Record<string, string> = { 'burn-up': 'fire', 'double-shock': 'electric' };
const SELF_COST: Record<string, number> = { 'fillet-away': 1 / 2, 'clangorous-soul': 1 / 3 };

/** What a fighter uses when it has no move left to use. STRUGGLE_MOVE stands for it in an action. */
export const STRUGGLE_MOVE = -1;
export const STRUGGLE: MoveData = {
  key: 'struggle', id: 'struggle', name: 'Forcejeo', desc: 'Ataque desesperado que solo se usa cuando no quedan PP; daña también al usuario.',
  type: null, category: 'physical', power: 50, accuracy: null, pp: 1, priority: 0, target: 'foe', flags: ['contact'], kind: 'attack', recoilMaxHp: 1 / 4, supported: true,
};

/** The move in a fighter's slot, or Struggle. */
export const moveAt = (fighter: { moves: MoveData[] }, slot: number): MoveData => (slot === STRUGGLE_MOVE ? STRUGGLE : fighter.moves[slot]);

function supportedMove(move: MoveData): boolean {
  if (move.category !== 'status') return move.power > 0 || !!move.fixedDamage || !!move.ohko;
  return !!(move.boosts
    || move.self
    || move.status
    || move.screen
    || SUPPORTED_VOLATILES.has(move.volatile as string)
    || move.heal
    || move.weather
    || move.terrain
    || SPECIAL_STATUS_MOVES.has(move.id));
}

export function moveData(id: string): MoveData | null {
  const raw = moveEntry(id);
  if (!raw) return null;
  const move: MoveData = { key: id, id, ...raw, flags: [...(raw.flags ?? [])], kind: raw.category === 'status' ? 'status' : 'attack', supported: false };
  if (GRASSY_HALVED.has(id)) move.weakenedByGrassyTerrain = true;
  if (id === 'foul-play') move.usesTargetAttack = true;
  if (id === 'toxic') move.status = 'tox';
  if (SCREEN_MOVES[id]) move.screen = SCREEN_MOVES[id];
  if (SCREEN_BREAKERS.has(id)) move.breaksScreens = true;
  if (id === 'defog') {
    move.boosts = { eva: -1 };
    move.clearsScreens = true;
  }
  if (FIRST_TURN_ONLY.has(id)) move.firstTurnOnly = true;
  if (RAMPAGE.has(id)) move.rampage = true;
  if (BINDING.has(id)) move.binds = true;
  if (TRAPPING.has(id)) move.traps = true;
  if (SELF_SWITCH.has(id)) move.selfSwitch = true;
  if (FORCE_SWITCH.has(id)) move.forceSwitch = true;
  if (LEAVES_ONE.has(id)) move.leavesOne = true;
  if (CRASHES.has(id)) move.crashes = true;
  if (IGNORES_DEF_BOOSTS.has(id)) move.ignoresDefBoosts = true;
  if (HITS_PHYSICAL_DEF.has(id)) move.hitsPhysicalDef = true;
  if (LOSES_TYPE[id]) move.losesType = LOSES_TYPE[id];
  if (SELF_COST[id]) move.selfCost = SELF_COST[id];
  if (id === 'body-press') move.usesDefense = true;
  if (id === 'flying-press') move.extraType = 'flying';
  if (id === 'clanging-scales') move.self = { def: -1 };
  if (id === 'scale-shot') move.self = { def: -1, spd: 1 };
  if (id === 'mind-blown' || id === 'steel-beam') move.recoilMaxHp = 1 / 2;
  if (id === 'memento') move.selfDestruct = true;
  if (id === 'snore') move.usableAsleep = true;
  if (id === 'smack-down' || id === 'thousand-arrows') move.grounds = true;
  if (id === 'thousand-arrows') move.hitsAirborne = true;
  if (id === 'defense-curl') move.curls = true;
  move.supported = !IMPOSSIBLE_MOVES.has(id) && (supportedMove(move) || !!MOVE_RULES[id]);
  return move;
}

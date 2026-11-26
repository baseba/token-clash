import { moveEntry } from '../../catalog/domain/creatures.js';
import { FULL_FRIENDSHIP_POWER, IMPOSSIBLE_MOVES, MOVE_RULES } from './rules/move-rules.js';
import { hiddenPowerType } from '../../../public/natures.js';
import type { MoveData, MoveTarget } from './battle-types.js';

export type { MoveData, MoveTarget };

const SUPPORTED_VOLATILES = new Set(['confusion', 'attract', 'leechseed']);
const IGNORES_ABILITY = new Set(['sunsteel-strike', 'moongeist-beam', 'photon-geyser']);
const CHECKS_EACH_HIT = new Set(['triple-axel', 'population-bomb']);
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
const AIMABLE: Record<string, MoveTarget> = {
  'heal-pulse': 'self', 'floral-healing': 'self', purify: 'self', decorate: 'self', 'aromatic-mist': 'self', coaching: 'self', acupressure: 'self', 'pollen-puff': 'foe',
};
const SELF_COST: Record<string, number> = { 'fillet-away': 1 / 2, 'clangorous-soul': 33 / 100 };

export const STRUGGLE_MOVE = -1;
export const STRUGGLE: MoveData = {
  key: 'struggle', id: 'struggle', name: 'Forcejeo', desc: 'Ataque desesperado que solo se usa cuando no quedan PP; daña también al usuario.',
  type: null, category: 'physical', power: 50, accuracy: null, pp: 1, priority: 0, target: 'foe', flags: ['contact'], kind: 'attack', recoilMaxHp: 1 / 4, supported: true,
};

export const aimedTarget = (move: MoveData, aim: MoveTarget | null | undefined): string => (move.aimable ? aim ?? move.aimable : move.target);

const HIDDEN_POWER = 60;

export { hiddenPowerType };

export function moveFor(id: string, owner: { nature?: string | null; types?: string[] }): MoveData | null {
  const move = moveData(id);
  if (!move) return null;
  if (id === 'hidden-power') return { ...move, type: hiddenPowerType(owner.nature), power: HIDDEN_POWER };
  if (id === 'revelation-dance' && owner.types?.length) return { ...move, type: owner.types[0] };
  if (id === 'return' || id === 'frustration') return { ...move, power: FULL_FRIENDSHIP_POWER };
  return move;
}

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
  if (IGNORES_ABILITY.has(id)) move.ignoresAbility = true;
  if (CHECKS_EACH_HIT.has(id)) move.checksEachHit = true;
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
  if (AIMABLE[id]) move.aimable = AIMABLE[id];
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

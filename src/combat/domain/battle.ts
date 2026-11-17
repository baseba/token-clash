// The battle engine's public API: start a battle (createBattle), see what each side may do (validActions), and play
// a turn (submit). Pure: no I/O and randomness injected, so a battle can be tested and replayed. The engine is
// split by question:
//   turn.ts            in what order a turn happens, once both sides have chosen
//   use-move.ts        what using a move does, up to the hit (and the whole effect of a status move)
//   damage.ts          whether an attack lands, and how hard
//   residual.ts        what happens at the end of each turn
//   switching.ts       a fighter coming in, going out and fainting
//   effects.ts         every change to a fighter, a side or the field, with its event; also who is where, and speed
//   ability-engine.ts  when an ability acts, and what its rules (ability-effects.ts) may do
//   move-rule-api.ts   what the special move rules (move-rules.ts) may do
//   battle-view.ts     what each client sees
//   moves.ts           a move as the engine reads it: its data, whether Token Clash supports it, Struggle
//   fighter.ts         a fighter built from a roster entry, and which moves it may carry
//   conditions.ts      weather, status and stat-stage facts several modules share
//   battle-types.ts    the types of all of the above
import { effectiveness } from '../../catalog/domain/creatures.js';
import { buildFighter } from './fighter.js';
import { moveAt, type MoveData, STRUGGLE_MOVE } from './moves.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { invalid } from '../../shared/domain/errors.js';
import type { Action, AnyMove, BattleEvent, BattleFighter, BattleSideInput, BattleState, MoveAction, SwitchAction } from './battle-types.js';
import { resolveReplacements, resolveSwitchOut, resolveTurn } from './turn.js';
import { failReason, lastResortReady, moveBlocked } from './use-move.js';
import { entryOrder, prepareEntry, runEntry, settle } from './switching.js';
import { activeOf, asleep, benchSlots, foeOf, freshBoosts, onField } from './effects.js';
import { abilityKey, run } from './ability-engine.js';

export type * from './battle-types.js';
export { STRUGGLE_MOVE } from './moves.js';
export { forfeit, TURN_LIMIT } from './turn.js';
export { type EventView, viewEvents, type PublicMove, type VisibleFighterView, type HiddenFighterView, type FighterView, shownTarget, publicState } from './battle-view.js';

/** How many Pokémon fight on each side. */
export const BATTLE_SIZE = 3;

function prepare(entry: RosterEntry): BattleFighter {
  const fighter = buildFighter(entry);
  return {
    ...fighter,
    hp: fighter.stats.hp,
    boosts: freshBoosts(),
    status: null,
    statusTurns: 0,
    volatiles: {},
    activeTurns: 0,
    form: null,
    baseTypes: [...fighter.types],
    baseStats: { ...fighter.stats },
    baseSprite: fighter.sprite,
    speciesStats: { ...fighter.stats },
    speciesTypes: [...fighter.types],
    seen: false,
    seenAs: null,
    baseAbility: fighter.ability,
    revealedAbilities: new Set(),
    revealedMoves: new Set(),
    pp: Object.fromEntries(fighter.moves.map((m) => [m.key, m.pp])),
  };
}

export function createBattle({ id, sides, random = Math.random }: { id: string; sides: BattleSideInput[]; random?: () => number }): BattleState {
  // `intro` is filled right below, with the events of the leads coming out.
  const init: Omit<BattleState, 'intro'> = {
    id,
    random,
    status: 'active',
    phase: 'choose',
    turn: 1,
    winner: null,
    field: { weather: null, weatherTurns: 0, weatherSetter: null, terrain: null, terrainTurns: 0, rooms: {} },
    sides: sides.map((s) => ({
      trainerId: s.trainerId,
      name: s.name,
      avatar: s.avatar ?? null,
      team: s.entries.slice(0, BATTLE_SIZE).map((e) => prepare(e)),
      active: 0,
      action: null,
      mustSwitch: false,
      toxicSpikes: 0,
      screens: {},
      hazards: { spikes: 0, stealthrock: false, stickyweb: false },
      conds: {},
      guards: new Set(),
    })),
    events: [],
    moved: new Set(),
    moldBreaker: null,
  };
  const battle = init as BattleState;
  battle.intro = withEvents(battle, () => {
    const leads = entryOrder(battle, [0, 1]);
    for (const sideIndex of leads) prepareEntry(battle, sideIndex);
    for (const sideIndex of leads) runEntry(battle, sideIndex);
    settle(battle);
  });
  return battle;
}

function withEvents(battle: BattleState, fn: () => void): BattleEvent[] {
  const events: BattleEvent[] = [];
  battle.events = events;
  fn();
  battle.events = [];
  return events;
}

export function needsAction(battle: BattleState, sideIndex: number): boolean {
  if (battle.status !== 'active') return false;
  const side = battle.sides[sideIndex];
  if (side.action) return false;
  return battle.phase === 'choose' ? true : side.mustSwitch;
}

function trapped(battle: BattleState, sideIndex: number): boolean {
  const me = activeOf(battle, sideIndex);
  const foe = foeOf(battle, me);
  if (!foe || me.types.includes('ghost')) return false;
  if (me.volatiles.noRetreat || me.volatiles.bound || me.volatiles.ingrain || battle.field.rooms.fairylock) return true;
  if (me.volatiles.trappedBy && onField(battle, me.volatiles.trappedBy)) return true;
  return run(battle, foe, 'onTrapFoe', me) === true;
}

function userCantUse(battle: BattleState, fighter: BattleFighter, move: AnyMove): boolean {
  if (move.id === 'last-resort') return !lastResortReady(fighter);
  if (move.id === 'snore' || move.id === 'sleep-talk') return !asleep(battle, fighter);
  if (move.id === 'spit-up' || move.id === 'swallow') return !fighter.volatiles.stockpile?.count;
  if (move.firstTurnOnly) return !!fighter.volatiles.acted;
  if (move.losesType) return !fighter.types.includes(move.losesType);
  if (move.selfCost) return fighter.hp <= Math.floor(fighter.stats.hp * move.selfCost);
  return false;
}

function usableMoves(battle: BattleState, fighter: BattleFighter): { move: MoveData; slot: number }[] {
  const ok = fighter.moves
    .map((move, slot) => ({ move, slot }))
    .filter(({ move }) =>
      (fighter.pp[move.key] ?? 0) > 0
        && fighter.volatiles.disabled?.key !== move.key
        && !moveBlocked(battle, fighter, move)
        && !userCantUse(battle, fighter, move));
  const lock = fighter.volatiles.lockedMove;
  if (lock != null && abilityKey(battle, fighter) === 'gorilla-tactics') {
    const locked = ok.filter(({ move }) => move.key === lock);
    if (locked.length) return locked;
  }
  return ok;
}

function encoreMove(fighter: BattleFighter): number | undefined {
  const { encore } = fighter.volatiles;
  if (!encore) return undefined;
  const slot = fighter.moves.findIndex((m) => m.key === encore.key);
  return slot >= 0 && (fighter.pp[encore.key] ?? 0) > 0 ? slot : undefined;
}

/** The move slot a fighter must use this turn (recharging, charging, rampaging or locked in), if any. */
function lockedInMove(fighter: BattleFighter): number | null | undefined {
  return fighter.volatiles.mustRecharge ?? fighter.volatiles.charging ?? fighter.volatiles.rampage?.move ?? fighter.volatiles.locked?.move;
}

export function forcedAction(battle: BattleState, sideIndex: number): Action | null {
  if (!needsAction(battle, sideIndex) || battle.phase !== 'choose') return null;
  const forced = lockedInMove(activeOf(battle, sideIndex));
  return forced == null ? null : { type: 'move', move: forced };
}

export function validActions(battle: BattleState, sideIndex: number): Action[] {
  if (!needsAction(battle, sideIndex)) return [];
  const side = battle.sides[sideIndex];
  const switches = benchSlots(side).map((to): SwitchAction => ({ type: 'switch', to }));
  if (battle.phase === 'replace' || battle.phase === 'switchout') return switches;
  const fighter = side.team[side.active];
  const forced = lockedInMove(fighter);
  if (forced != null) return [{ type: 'move', move: forced }];
  const encored = encoreMove(fighter);
  const usable: Action[] = encored != null
    ? [{ type: 'move', move: encored }]
    : usableMoves(battle, fighter).map(({ slot }): Action => ({ type: 'move', move: slot }));
  const moves: Action[] = usable.length ? usable : [{ type: 'move', move: STRUGGLE_MOVE }];
  return moves.concat(trapped(battle, sideIndex) ? [] : switches);
}

const sameAction = (a: Action, b: Action): boolean => (a.type === 'move' ? b.type === 'move' && a.move === b.move : b.type === 'switch' && a.to === b.to);

function moveAction(battle: BattleState, sideIndex: number, action: MoveAction): MoveAction {
  const aimable = moveAt(activeOf(battle, sideIndex), action.move).aimable;
  return aimable && (action.target === 'self' || action.target === 'foe') ? { type: 'move', move: action.move, target: action.target } : { type: 'move', move: action.move };
}

// Returns the events of the resolved turn, or null if still waiting on the other side.
export function submit(battle: BattleState, sideIndex: number, action: Action | null | undefined): BattleEvent[] | null {
  if (!action || !validActions(battle, sideIndex).some((v) => sameAction(v, action))) throw invalid('Acción inválida');
  battle.sides[sideIndex].action = action.type === 'move' ? moveAction(battle, sideIndex, action) : { type: 'switch', to: action.to };
  if (battle.sides.some((_, i) => needsAction(battle, i))) return null;
  if (battle.phase === 'switchout') return resolveSwitchOut(battle);
  return battle.phase === 'choose' ? resolveTurn(battle) : resolveReplacements(battle);
}

export function autoAction(battle: BattleState, sideIndex: number): Action | null {
  const opts = validActions(battle, sideIndex);
  if (!opts.length) return null;
  const moves = opts.filter((o) => o.type === 'move');
  if (moves.length) {
    const side = battle.sides[sideIndex];
    const me = side.team[side.active];
    const foe = battle.sides[1 - sideIndex].team[battle.sides[1 - sideIndex].active];
    let best = moves[0];
    let bestScore = -1;
    for (const action of moves) {
      const move = moveAt(me, action.move);
      const score = move.kind === 'status'
        ? 15 + battle.random() * 30
        : (move.power || 60)
          * effectiveness(move.type, foe.types)
          * ((move.accuracy ?? 100) / 100)
          * (move.type && me.types.includes(move.type) ? 1.5 : 1)
          + battle.random() * 10;
      if (score > bestScore) [best, bestScore] = [action, score];
    }
    return best;
  }
  return opts[Math.floor(battle.random() * opts.length)];
}

export function moveWillFail(battle: BattleState, sideIndex: number, idx: number): boolean {
  if (idx === STRUGGLE_MOVE) return false;
  const me = activeOf(battle, sideIndex);
  const move = me.moves[idx];
  if (!move || move.id === 'sucker-punch' || move.id === 'thunderclap' || move.id === 'focus-punch' || move.id === 'shell-trap') return false;
  return failReason(battle, me, foeOf(battle, me), move, !me.volatiles.acted) !== null;
}

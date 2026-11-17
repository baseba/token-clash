// How a turn resolves once both sides have chosen: switches first, then moves by priority and speed, then the end
// of the turn. A move that switches its user out (U-turn, Baton Pass) pauses the turn until that side picks who
// comes in, and fainted fighters are replaced before the next turn.
import { moveAt } from './moves.js';
import type { BattleEvent, BattleSide, BattleState, Mover, SwitchAction } from './battle-types.js';
import { useMove } from './use-move.js';
import { residual } from './residual.js';
import { doSwitch, entryOrder, runEntry, settle, wakeAbilities } from './switching.js';
import { activeFighters, activeOf, benchSlots, emit, hasBench, nameOf, speedOf } from './effects.js';
import { chain, run } from './ability-engine.js';

export const TURN_LIMIT = 100;
const FOCUS_MOVES = new Set(['focus-punch', 'shell-trap', 'beak-blast']);

function alive(side: BattleSide): boolean {
  return side.team.some((f) => f.hp > 0);
}

function finish(battle: BattleState, winner: number | null, reason: 'limit' | null = null): void {
  battle.status = 'finished';
  battle.winner = winner;
  emit(battle, { t: 'end', winner, ...(reason ? { reason } : {}) });
}

function checkEnd(battle: BattleState): boolean {
  const lost = battle.sides.map((side) => !alive(side));
  if (!lost[0] && !lost[1]) return false;
  finish(battle, lost[0] && lost[1] ? null : lost[0] ? 1 : 0);
  return true;
}

function hpShare(side: BattleSide): number {
  return side.team.reduce((sum, f) => sum + f.hp / f.stats.hp, 0);
}

export function resolveTurn(battle: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [{ t: 'turn', turn: battle.turn }];
  battle.events = events;
  battle.moved = new Set();
  for (const fighter of activeFighters(battle)) fighter.activeTurns += 1;
  // Both sides have chosen by now (submit() only resolves then).
  const acts = battle.sides.flatMap((side, sideIndex) => (side.action ? [{ sideIndex, ...side.action }] : []));
  battle.chosen = battle.sides.map((side) => (side.action?.type === 'move' ? moveAt(side.team[side.active], side.action.move) : null));
  for (const side of battle.sides) side.action = null;
  for (const side of battle.sides) for (const fighter of side.team) delete fighter.turnHit;

  const entered: number[] = [];
  for (const action of acts) {
    if (action.type !== 'switch') continue;
    if (doSwitch(battle, action.sideIndex, action.to)) wakeAbilities(battle, activeOf(battle, action.sideIndex));
    entered.push(action.sideIndex);
  }
  for (const sideIndex of entryOrder(battle, entered)) runEntry(battle, sideIndex);
  settle(battle);
  if (checkEnd(battle)) return done(battle, events);

  const movers: Mover[] = acts
    .filter((a) => a.type === 'move')
    .map((action) => {
      const fighter = activeOf(battle, action.sideIndex);
      const move = moveAt(fighter, action.move);
      const frac = run(battle, fighter, 'onFractionalPriority', move);
      return {
        ...action,
        fighter,
        prio: chain(battle, fighter, 'onModifyPriority', move.priority, move),
        frac: frac ?? 0,
        spd: speedOf(battle, fighter),
        tie: battle.random(),
      };
    })
    .sort((x, y) => y.prio - x.prio || y.frac - x.frac || (battle.field.rooms.trickroom ? x.spd - y.spd : y.spd - x.spd) || y.tie - x.tie);

  // When both attack, say why the first one went first (priority move, faster, or a coin flip).
  const why = movers.length === 2 ? (movers[0].prio !== movers[1].prio || movers[0].frac !== movers[1].frac ? 'priority' : movers[0].spd !== movers[1].spd ? 'speed' : 'tie') : null;
  movers.forEach((a, i) => (a.why = i === 0 ? why : null));

  for (const mover of movers) {
    const move = moveAt(mover.fighter, mover.move);
    if (FOCUS_MOVES.has(move.id) && mover.fighter.hp > 0) {
      mover.fighter.volatiles.focusing = move.id;
      emit(battle, { t: 'focus', side: mover.sideIndex, name: nameOf(mover.fighter), move: move.name, key: move.id });
    }
  }

  return continueTurn(battle, events, movers, 0);
}

function continueTurn(battle: BattleState, events: BattleEvent[], movers: Mover[], from: number): BattleEvent[] {
  for (let i = from; i < movers.length; i++) {
    const mover = movers[i];
    if (activeOf(battle, mover.sideIndex) !== mover.fighter) continue;
    useMove(battle, mover.sideIndex, mover.move, mover.prio, mover.why);
    settle(battle);
    if (checkEnd(battle)) return done(battle, events);
    if (pauseForSwitch(battle, [mover.sideIndex, 1 - mover.sideIndex], movers, i + 1)) return done(battle, events);
  }
  residual(battle);
  settle(battle);
  if (checkEnd(battle)) return done(battle, events);
  battle.turn += 1;
  if (battle.turn > TURN_LIMIT) {
    const [h0, h1] = battle.sides.map(hpShare);
    finish(battle, h0 === h1 ? null : h0 > h1 ? 0 : 1, 'limit');
    return done(battle, events);
  }
  afterTurn(battle);
  return done(battle, events);
}

function pauseForSwitch(battle: BattleState, sides: number[], movers: Mover[], next: number): boolean {
  for (const sideIndex of sides) {
    if (switchNow(battle, sideIndex)) {
      battle.pending = { movers, next };
      battle.phase = 'switchout';
      return true;
    }
  }
  return false;
}

function switchNow(battle: BattleState, sideIndex: number): boolean {
  const side = battle.sides[sideIndex];
  const fighter = activeOf(battle, sideIndex);
  if (!fighter.volatiles.switchNow) return false;
  delete fighter.volatiles.switchNow;
  const options = benchSlots(side);
  if (fighter.hp <= 0 || !options.length) {
    delete side.pass;
    return false;
  }
  emit(battle, { t: 'switchOut', side: sideIndex, name: nameOf(fighter) });
  if (options.length === 1) {
    selfSwitch(battle, sideIndex, options[0]);
    return false;
  }
  side.mustSwitch = true;
  return true;
}

function selfSwitch(battle: BattleState, sideIndex: number, to: number): void {
  if (doSwitch(battle, sideIndex, to)) wakeAbilities(battle, activeOf(battle, sideIndex));
  runEntry(battle, sideIndex);
  settle(battle);
}

export function resolveSwitchOut(battle: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];
  battle.events = events;
  const sideIndex = battle.sides.findIndex((side) => side.mustSwitch);
  const side = battle.sides[sideIndex];
  const to = (side.action as SwitchAction).to;
  for (const side of battle.sides) side.action = null;
  side.mustSwitch = false;
  const { movers, next } = battle.pending!;
  delete battle.pending;
  battle.phase = 'choose';
  selfSwitch(battle, sideIndex, to);
  if (checkEnd(battle)) return done(battle, events);
  if (pauseForSwitch(battle, [0, 1], movers, next)) return done(battle, events);
  return continueTurn(battle, events, movers, next);
}

function done(battle: BattleState, events: BattleEvent[]): BattleEvent[] {
  battle.events = [];
  return events;
}

function afterTurn(battle: BattleState): void {
  let anyReplace = false;
  battle.sides.forEach((side, sideIndex) => {
    const fighter = side.team[side.active];
    const escaping = fighter.hp > 0 && !!fighter.volatiles.switchNow && hasBench(battle, fighter);
    delete fighter.volatiles.switchNow;
    side.mustSwitch = fighter.hp <= 0 || escaping;
    if (side.mustSwitch) {
      anyReplace = true;
      emit(battle, { t: 'replace', side: sideIndex });
    }
  });
  battle.phase = anyReplace ? 'replace' : 'choose';
}

export function resolveReplacements(battle: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];
  battle.events = events;
  const entered: number[] = [];
  battle.sides.forEach((side, sideIndex) => {
    if (side.mustSwitch && side.action?.type === 'switch') {
      if (doSwitch(battle, sideIndex, side.action.to)) wakeAbilities(battle, activeOf(battle, sideIndex));
      entered.push(sideIndex);
    }
    side.action = null;
    side.mustSwitch = false;
  });
  for (const sideIndex of entryOrder(battle, entered)) runEntry(battle, sideIndex);
  settle(battle);
  battle.phase = 'choose';
  if (!checkEnd(battle)) {
    const pending = [0, 1].some((s) => activeOf(battle, s).hp <= 0);
    if (pending) afterTurn(battle);
  }
  return done(battle, events);
}

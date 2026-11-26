import { effectiveness } from '../../catalog/domain/creatures.js';
import type { BattleFighter, BattleMove, BattleState } from './battle-types.js';
import { clearToxicSpikes, cure, grounded, heal, hurt } from './effects.js';
import { activeFighters, activeOf, benchSlots, clamp, emit, freshBoosts, lookOf, nameOf, sideIndexOf } from './state.js';
import { boost, clearWeather, run, setStatus, speedOf } from './ability-engine.js';
import { flag } from './abilities.js';
import { fighterView } from './fighter-view.js';

export function prepareEntry(battle: BattleState, sideIndex: number): void {
  const fighter = activeOf(battle, sideIndex);
  fighter.volatiles = { enteredTurn: battle.turn };
  fighter.activeTurns = 0;
  if (flag(battle, fighter, 'disguisesOnEntry')) {
    const mate = [...battle.sides[sideIndex].team].reverse().find((o) => o !== fighter && o.hp > 0);
    if (mate) fighter.volatiles.illusion = lookOf(mate);
  }
  fighter.seen = true;
  fighter.seenAs = fighter.volatiles.illusion ?? null;
}

export function runEntry(battle: BattleState, sideIndex: number): void {
  const fighter = activeOf(battle, sideIndex);
  if (fighter.hp <= 0) return;
  const side = battle.sides[sideIndex];
  if (side.healingWish) {
    const kind = side.healingWish;
    delete side.healingWish;
    if (fighter.hp < fighter.stats.hp || fighter.status) {
      emit(battle, { t: 'healingWish', side: sideIndex, name: nameOf(fighter), kind });
      heal(battle, fighter, fighter.stats.hp);
      cure(battle, fighter);
      if (kind === 'lunardance') fighter.pp = Object.fromEntries(fighter.moves.map((m) => [m.key, m.pp]));
    }
  }
  const hz = side.hazards;
  if (hz.stealthrock && !flag(battle, fighter, 'noIndirectDamage'))
    hurt(battle, fighter, (fighter.stats.hp * effectiveness('rock', fighter.types)) / 8, 'stealthrock');
  if (hz.spikes && grounded(battle, fighter) && fighter.hp > 0) hurt(battle, fighter, fighter.stats.hp / [8, 6, 4][hz.spikes - 1], 'spikes');
  if (hz.stickyweb && grounded(battle, fighter) && fighter.hp > 0) {
    emit(battle, { t: 'stickyWeb', side: sideIndex, name: nameOf(fighter) });
    boost(battle, fighter, { spd: -1 }, null);
  }
  if (fighter.hp <= 0) return;
  if (side.toxicSpikes && grounded(battle, fighter)) {
    if (fighter.types.includes('poison')) clearToxicSpikes(battle, sideIndex);
    else setStatus(battle, fighter, side.toxicSpikes >= 2 ? 'tox' : 'psn', null);
  }
  run(battle, fighter, 'onStart');
}

function leave(battle: BattleState, fighter: BattleFighter): boolean {
  const hadGas = fighter.ability === 'neutralizing-gas';
  if (fighter.hp > 0) run(battle, fighter, 'onSwitchOut');
  const { mimic } = fighter.volatiles;
  if (mimic) fighter.moves = fighter.moves.map((m, i) => (i === mimic.slot ? mimic.original : m));
  if (fighter.volatiles.powerTrick) fighter.stats = { ...fighter.stats, atk: fighter.stats.def, def: fighter.stats.atk };
  if (fighter.volatiles.transformed) Object.assign(fighter, fighter.volatiles.transformed);
  fighter.boosts = freshBoosts();
  fighter.volatiles = {};
  fighter.types = [...fighter.baseTypes];
  fighter.ability = fighter.baseAbility;
  if (fighter.form !== (fighter.permanentForm ?? null)) {
    const max = fighter.stats.hp;
    fighter.stats = { ...fighter.baseStats };
    fighter.sprite = fighter.baseSprite;
    if (fighter.hp > 0) fighter.hp = clamp(fighter.hp + fighter.stats.hp - max, 1, fighter.stats.hp);
    fighter.form = fighter.permanentForm ?? null;
  }
  if (battle.field.weatherSetter === fighter) clearWeather(battle);
  return hadGas;
}

export function doSwitch(battle: BattleState, sideIndex: number, to: number): boolean {
  const side = battle.sides[sideIndex];
  const old = activeOf(battle, sideIndex);
  const pass = old.hp > 0 ? side.pass : null;
  delete side.pass;
  const hadGas = leave(battle, old);
  side.active = to;
  prepareEntry(battle, sideIndex);
  const fighter = activeOf(battle, sideIndex);
  if (pass) {
    const { boosts, ...vols } = pass;
    if (boosts) fighter.boosts = { ...boosts };
    Object.assign(fighter.volatiles, vols);
  }
  emit(battle, {
    t: 'switch',
    side: sideIndex,
    to,
    name: nameOf(fighter),
    from: old.seenAs?.name ?? old.name,
    forced: old.hp <= 0,
    card: fighterView(battle, sideIndex, to, true),
    seen: fighterView(battle, sideIndex, to, false),
  });
  return hadGas;
}

export function entryOrder(battle: BattleState, sides: number[]): number[] {
  const gas = (sideIndex: number) => (activeOf(battle, sideIndex).ability === 'neutralizing-gas' ? 1 : 0);
  return [...sides].sort((x, y) => gas(y) - gas(x) || speedOf(battle, activeOf(battle, y)) - speedOf(battle, activeOf(battle, x)));
}

export function wakeAbilities(battle: BattleState, except: BattleFighter): void {
  for (const fighter of activeFighters(battle)) if (fighter !== except) run(battle, fighter, 'onStart');
}

export function faint(battle: BattleState, fighter: BattleFighter, by: BattleFighter | null = null, move: BattleMove | null = null, lastHit = 0): void {
  if (fighter.fainted || fighter.hp > 0) return;
  fighter.fainted = true;
  battle.sides[sideIndexOf(battle, fighter)].faintedTurn = battle.turn;
  const hadGas = fighter.ability === 'neutralizing-gas';
  emit(battle, { t: 'faint', side: sideIndexOf(battle, fighter), name: nameOf(fighter) });
  if (by && by !== fighter && by.hp > 0 && fighter.volatiles.destinyBond) {
    emit(battle, { t: 'destinyBond', side: sideIndexOf(battle, by), name: nameOf(by), from: nameOf(fighter) });
    by.hp = 0;
    faint(battle, by);
  }
  if (by && by !== fighter && move && fighter.volatiles.grudge && by.pp[move.key] > 0) {
    by.pp[move.key] = 0;
    emit(battle, { t: 'grudge', side: sideIndexOf(battle, by), name: nameOf(by), move: move.name });
  }
  run(battle, fighter, 'onFaint', by, move, lastHit);
  if (by && by.hp > 0 && move) run(battle, by, 'onFoeFaint', fighter);
  for (const other of activeFighters(battle)) if (other !== fighter) run(battle, other, 'onAnyFaint', fighter);
  if (battle.field.weatherSetter === fighter) clearWeather(battle);
  if (hadGas) wakeAbilities(battle, fighter);
}

export function settle(battle: BattleState): void {
  for (const sideIndex of [0, 1]) {
    const fighter = activeOf(battle, sideIndex);
    if (fighter.hp <= 0 && !fighter.fainted) faint(battle, fighter);
  }
}

export function dragOut(battle: BattleState, target: BattleFighter): boolean {
  const sideIndex = sideIndexOf(battle, target);
  const bench = benchSlots(battle.sides[sideIndex]);
  if (!bench.length || flag(battle, target, 'suctionCups') || target.volatiles.ingrain) return false;
  const to = bench[Math.floor(battle.random() * bench.length)];
  emit(battle, { t: 'dragged', side: sideIndex, name: nameOf(target) });
  if (doSwitch(battle, sideIndex, to)) wakeAbilities(battle, activeOf(battle, sideIndex));
  runEntry(battle, sideIndex);
  return true;
}

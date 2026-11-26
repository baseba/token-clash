import type { Boosts, MajorStatus, Weather } from '../../../catalog/domain/creatures.js';
import type { AbilityEffect, AbilityEngine, AbilityHook, BoostOptions, ChainArgs, ChainHook, Hook, HookArgs, MultiplierHook } from '../rules/ability-effects.js';
import { HELD_ITEMS } from '../../../catalog/domain/held-items.js';
import type { AbilityDetails, AnyMove, BattleFighter, BattleState } from '../battle-types.js';
import { type AbilityTriggers, addToxicSpikes, addVolatileWithTriggers, asleep, boostWithTriggers, breakIllusion, changeForm, clearScreens, clearTerrainWithTriggers, clearWeatherWithTriggers, cure, currentWeather, grounded, heal, hurt, setStatusWithTriggers, setTerrainWithTriggers, setTypes, setWeatherWithTriggers, speedOfWithTriggers, transform, typeEffectiveness } from './effects.js';
import { emit, foeOf, hasBench, lookOf, nameOf, sideIndexOf } from './state.js';
import { abilityDef, abilityKey, anyActiveHas, itemDef, setAbility, showAbility } from './abilities.js';

export function run<H extends AbilityHook>(battle: BattleState, fighter: BattleFighter, hook: H, ...args: HookArgs<H>): ReturnType<Hook<H>> | undefined {
  return wiring(battle).triggers.run(fighter, hook, ...args);
}

function call<H extends AbilityHook>(engine: AbilityEngine, def: Partial<AbilityEffect> | null, fighter: BattleFighter, hook: H, args: HookArgs<H>): ReturnType<Hook<H>> | undefined {
  type AnyHook = (engine: AbilityEngine, me: BattleFighter, ...args: unknown[]) => unknown;
  return (def?.[hook] as AnyHook | undefined)?.(engine, fighter, ...args) as ReturnType<Hook<H>> | undefined;
}

export function mul<H extends MultiplierHook>(battle: BattleState, fighter: BattleFighter, hook: H, ...args: HookArgs<H>): number {
  const { engine } = wiring(battle);
  return (call(engine, abilityDef(battle, fighter), fighter, hook, args) ?? 1) * (call(engine, itemDef(fighter), fighter, hook, args) ?? 1);
}

export function chain<H extends ChainHook>(battle: BattleState, fighter: BattleFighter, hook: H, value: number, ...args: ChainArgs<H>): number {
  return wiring(battle).triggers.chain(fighter, hook, value, ...args);
}

export const boost = (battle: BattleState, fighter: BattleFighter, changes: Boosts, source?: BattleFighter | null, opts?: BoostOptions): Boosts =>
  boostWithTriggers(wiring(battle).triggers, battle, fighter, changes, source, opts);
export const setStatus = (battle: BattleState, fighter: BattleFighter, status: MajorStatus, source?: BattleFighter | null, opts?: { ability?: BattleFighter }): boolean =>
  setStatusWithTriggers(wiring(battle).triggers, battle, fighter, status, source, opts);
export const addVolatile = (
  battle: BattleState,
  fighter: BattleFighter,
  kind: string,
  source?: BattleFighter | null,
  opts?: { ability?: BattleFighter; move?: { key: string; name: string } },
): boolean => addVolatileWithTriggers(wiring(battle).triggers, battle, fighter, kind, source, opts);
export const setWeather = (battle: BattleState, weather: Weather, source: BattleFighter | null): boolean =>
  setWeatherWithTriggers(wiring(battle).triggers, battle, weather, source);
export const clearWeather = (battle: BattleState): void => clearWeatherWithTriggers(wiring(battle).triggers, battle);
export const setTerrain = (battle: BattleState, terrain: string, source: BattleFighter | null): boolean =>
  setTerrainWithTriggers(wiring(battle).triggers, battle, terrain, source);
export const clearTerrain = (battle: BattleState): void => clearTerrainWithTriggers(wiring(battle).triggers, battle);
export const speedOf = (battle: BattleState, fighter: BattleFighter): number => speedOfWithTriggers(wiring(battle).triggers, battle, fighter);

function showItem(battle: BattleState, fighter: BattleFighter, usedUp = false): void {
  if (!fighter.item) return;
  emit(battle, { t: 'item', side: sideIndexOf(battle, fighter), name: nameOf(fighter), item: HELD_ITEMS[fighter.item]?.name ?? fighter.item, ...(usedUp ? { usedUp: true as const } : {}) });
  if (usedUp) fighter.item = null;
}

interface AbilityWiring {
  engine: AbilityEngine;
  triggers: AbilityTriggers;
}

const wirings = new WeakMap<BattleState, AbilityWiring>();
function wiring(battle: BattleState): AbilityWiring {
  let wiring = wirings.get(battle);
  if (wiring) return wiring;
  wiring = makeWiring(battle);
  wirings.set(battle, wiring);
  return wiring;
}

function makeWiring(battle: BattleState): AbilityWiring {
  const triggers: AbilityTriggers = {
    run(fighter, hook, ...args) {
      const own = call(engine, abilityDef(battle, fighter), fighter, hook, args);
      const held = call(engine, itemDef(fighter), fighter, hook, args);
      return own ?? held;
    },
    chain(fighter, hook, value, ...args) {
      const byAbility = call(engine, abilityDef(battle, fighter), fighter, hook, [...args, value] as HookArgs<typeof hook>) ?? value;
      return call(engine, itemDef(fighter), fighter, hook, [...args, byAbility] as HookArgs<typeof hook>) ?? byAbility;
    },
  };
  const engine: AbilityEngine = {
    battle,
    rand: () => battle.random(),
    foe: (fighter: BattleFighter) => foeOf(battle, fighter),
    has: (fighter: BattleFighter, key: string) => abilityKey(battle, fighter) === key,
    anyActiveHas: (key: string) => anyActiveHas(battle, key),
    show: (fighter: BattleFighter, note?: string | null, details?: AbilityDetails) => showAbility(battle, fighter, note, details),
    immune: (fighter: BattleFighter) => emit(battle, { t: 'immune', side: sideIndexOf(battle, fighter) }),
    boost: (fighter: BattleFighter, changes: Boosts, source?: BattleFighter | null, opts?: BoostOptions) =>
      boostWithTriggers(triggers, battle, fighter, changes, source, opts),
    damage: (fighter: BattleFighter, amount: number, cause?: string) => hurt(battle, fighter, amount, cause),
    heal: (fighter: BattleFighter, amount: number, opts?: { silent?: boolean }) => heal(battle, fighter, amount, opts),
    setStatus: (fighter: BattleFighter, status: MajorStatus, source?: BattleFighter | null, opts?: { ability?: BattleFighter }) =>
      setStatusWithTriggers(triggers, battle, fighter, status, source, opts),
    addVolatile: (
      fighter: BattleFighter,
      kind: string,
      source?: BattleFighter | null,
      opts?: { ability?: BattleFighter; move?: { key: string; name: string } },
    ) =>
      addVolatileWithTriggers(triggers, battle, fighter, kind, source, opts),
    cure: (fighter: BattleFighter, announce?: boolean) => cure(battle, fighter, announce),
    weather: () => currentWeather(battle),
    terrain: () => battle.field.terrain,
    setWeather: (weather: Weather, source: BattleFighter | null) => setWeatherWithTriggers(triggers, battle, weather, source),
    setTerrain: (terrain: string, source: BattleFighter | null) => setTerrainWithTriggers(triggers, battle, terrain, source),
    grounded: (fighter: BattleFighter) => grounded(battle, fighter),
    asleep: (fighter: BattleFighter) => asleep(battle, fighter),
    effectiveness: (move: AnyMove, attacker: BattleFighter, target: BattleFighter) => typeEffectiveness(battle, move, attacker, target),
    setTypes: (fighter: BattleFighter, types: readonly string[]) => setTypes(battle, fighter, types),
    setAbility: (fighter: BattleFighter, key: string | null) => setAbility(battle, fighter, key),
    hasMoved: (fighter: BattleFighter) => battle.moved.has(fighter),
    hasBench: (fighter: BattleFighter) => hasBench(battle, fighter),
    faintedAllies: (fighter: BattleFighter) => battle.sides[sideIndexOf(battle, fighter)].team.filter((o) => o !== fighter && o.hp <= 0).length,
    addToxicSpikes: (fighter: BattleFighter) => addToxicSpikes(battle, sideIndexOf(battle, fighter)),
    clearScreens: (sideIndex: number, cause: string) => clearScreens(battle, sideIndex, cause),
    transform: (fighter: BattleFighter, into: BattleFighter) => transform(battle, fighter, into),
    changeForm: (fighter: BattleFighter, form: string | null, opts?: { permanent?: boolean }) => changeForm(battle, fighter, form, opts),
    breakIllusion: (fighter: BattleFighter) => breakIllusion(fighter),
    look: (fighter: BattleFighter) => lookOf(fighter),
    showItem: (fighter: BattleFighter) => showItem(battle, fighter),
    useUpItem: (fighter: BattleFighter) => showItem(battle, fighter, true),
  };
  return { engine, triggers };
}

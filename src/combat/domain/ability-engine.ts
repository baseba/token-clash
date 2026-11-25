import type { Boosts, MajorStatus, Weather } from '../../catalog/domain/creatures.js';
import { abilityInfo } from '../../catalog/domain/abilities.js';
import { ABILITIES, type AbilityEffect, type AbilityHook } from './ability-effects.js';
import { HELD_ITEMS } from '../../catalog/domain/held-items.js';
import { ITEMS } from './item-effects.js';
import type { AbilityDetails, AnyMove, BattleFighter, BattleState } from './battle-types.js';
import { typeEffectiveness } from './damage.js';
import { activeFighters, addToxicSpikes, addVolatile, asleep, boost, type BoostOptions, breakIllusion, changeForm, clearScreens, cure, currentWeather, emit, foeOf, grounded, hasBench, heal, hurt, lookOf, nameOf, setStatus, setTerrain, setTypes, setWeather, sideIndexOf, transform } from './effects.js';

export function abilityKey(battle: BattleState, fighter: BattleFighter): string | null {
  const key = fighter.ability;
  const def = key && ABILITIES[key as string];
  if (!def) return null;
  if (fighter.volatiles.gastroAcid && !def.unsuppressable) return null;
  if (!def.unsuppressable && activeFighters(battle).some((o) => o !== fighter && o.ability === 'neutralizing-gas')) return null;
  if (def.breakable && battle.moldBreaker && battle.moldBreaker.target === fighter) return null;
  return key;
}

export const abilityDef = (battle: BattleState, fighter: BattleFighter): AbilityEffect | null => ABILITIES[abilityKey(battle, fighter) as string] ?? null;
export const flag = (battle: BattleState, fighter: BattleFighter, name: keyof AbilityEffect): boolean => !!abilityDef(battle, fighter)?.[name];

type Hook<H extends AbilityHook> = NonNullable<AbilityEffect[H]>;
type HookArgs<H extends AbilityHook> = Parameters<Hook<H>> extends [AbilityEngine, BattleFighter, ...infer Args] ? Args : never;
type MultiplierHook = 'onBasePower' | 'onIncoming' | 'onAttack' | 'onDefense' | 'onAttackerFinal' | 'onDefenderFinal';
type ChainHook = 'onSpeed' | 'onAccuracy' | 'onEvasion' | 'onCritStage' | 'onEffectiveness' | 'onDamage' | 'onModifyPriority' | 'onStatusDamage';
type ChainArgs<H extends ChainHook> = HookArgs<H> extends [...infer Args, number] ? Args : never;

export function run<H extends AbilityHook>(battle: BattleState, fighter: BattleFighter, hook: H, ...args: HookArgs<H>): ReturnType<Hook<H>> | undefined {
  const own = call(battle, abilityDef(battle, fighter), fighter, hook, args);
  const held = call(battle, itemDef(fighter), fighter, hook, args);
  return own ?? held;
}

const itemDef = (fighter: BattleFighter): Partial<AbilityEffect> | null => (fighter.item ? ITEMS[fighter.item] ?? null : null);

function call<H extends AbilityHook>(battle: BattleState, def: Partial<AbilityEffect> | null, fighter: BattleFighter, hook: H, args: HookArgs<H>): ReturnType<Hook<H>> | undefined {
  type AnyHook = (engine: AbilityEngine, me: BattleFighter, ...args: unknown[]) => unknown;
  return (def?.[hook] as AnyHook | undefined)?.(engine(battle), fighter, ...args) as ReturnType<Hook<H>> | undefined;
}

export function mul<H extends MultiplierHook>(battle: BattleState, fighter: BattleFighter, hook: H, ...args: HookArgs<H>): number {
  return (call(battle, abilityDef(battle, fighter), fighter, hook, args) ?? 1) * (call(battle, itemDef(fighter), fighter, hook, args) ?? 1);
}

export function chain<H extends ChainHook>(battle: BattleState, fighter: BattleFighter, hook: H, value: number, ...args: ChainArgs<H>): number {
  const byAbility = call(battle, abilityDef(battle, fighter), fighter, hook, [...args, value] as HookArgs<H>) ?? value;
  return call(battle, itemDef(fighter), fighter, hook, [...args, byAbility] as HookArgs<H>) ?? byAbility;
}

function showItem(battle: BattleState, fighter: BattleFighter, usedUp = false): void {
  if (!fighter.item) return;
  emit(battle, { t: 'item', side: sideIndexOf(battle, fighter), name: nameOf(fighter), item: HELD_ITEMS[fighter.item]?.name ?? fighter.item, ...(usedUp ? { usedUp: true as const } : {}) });
  if (usedUp) fighter.item = null;
}

export const anyActiveHas = (battle: BattleState, key: string): boolean => activeFighters(battle).some((f) => abilityKey(battle, f) === key);
export const otherActiveHas = (battle: BattleState, fighter: BattleFighter, key: string): boolean =>
  activeFighters(battle).some((o) => o !== fighter && abilityKey(battle, o) === key);

const engines = new WeakMap<BattleState, AbilityEngine>();
function engine(battle: BattleState): AbilityEngine {
  let engine = engines.get(battle);
  if (engine) return engine;
  engine = makeEngine(battle);
  engines.set(battle, engine);
  return engine;
}

export type AbilityEngine = ReturnType<typeof makeEngine>;

function makeEngine(battle: BattleState) {
  return {
    battle,
    rand: () => battle.random(),
    foe: (fighter: BattleFighter) => foeOf(battle, fighter),
    has: (fighter: BattleFighter, key: string) => abilityKey(battle, fighter) === key,
    anyActiveHas: (key: string) => anyActiveHas(battle, key),
    show: (fighter: BattleFighter, note?: string | null, details?: AbilityDetails) => showAbility(battle, fighter, note, details),
    immune: (fighter: BattleFighter) => emit(battle, { t: 'immune', side: sideIndexOf(battle, fighter) }),
    boost: (fighter: BattleFighter, changes: Boosts, source?: BattleFighter | null, opts?: BoostOptions) =>
      boost(battle, fighter, changes, source, opts),
    damage: (fighter: BattleFighter, amount: number, cause?: string) => hurt(battle, fighter, amount, cause),
    heal: (fighter: BattleFighter, amount: number, opts?: { silent?: boolean }) => heal(battle, fighter, amount, opts),
    setStatus: (fighter: BattleFighter, status: MajorStatus, source?: BattleFighter | null, opts?: { ability?: BattleFighter }) =>
      setStatus(battle, fighter, status, source, opts),
    addVolatile: (
      fighter: BattleFighter,
      kind: string,
      source?: BattleFighter | null,
      opts?: { ability?: BattleFighter; move?: { key: string; name: string } },
    ) =>
      addVolatile(battle, fighter, kind, source, opts),
    cure: (fighter: BattleFighter, announce?: boolean) => cure(battle, fighter, announce),
    weather: () => currentWeather(battle),
    terrain: () => battle.field.terrain,
    setWeather: (weather: Weather, source: BattleFighter | null) => setWeather(battle, weather, source),
    setTerrain: (terrain: string, source: BattleFighter | null) => setTerrain(battle, terrain, source),
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
}

export function showAbility(
  battle: BattleState,
  fighter: BattleFighter,
  note: string | null = null,
  details: AbilityDetails = {},
): void {
  const info = abilityInfo(fighter.ability);
  fighter.revealedAbilities.add(fighter.ability);
  const foe = foeOf(battle, fighter);
  if (foe && details.copied && foe.ability === details.copied) foe.revealedAbilities.add(details.copied);
  const known = details.move && foe?.moves.find((m) => m.name === details.move);
  if (foe && known) foe.revealedMoves.add(known.key);
  emit(battle, {
    t: 'ability',
    side: sideIndexOf(battle, fighter),
    name: nameOf(fighter),
    ability: info?.name ?? fighter.ability,
    info,
    ...(note ? { note } : {}),
    ...details,
    ...(details.copied ? { copied: abilityInfo(details.copied)?.name } : {}),
  });
}

export function setAbility(battle: BattleState, fighter: BattleFighter, key: string | null): void {
  fighter.ability = key;
  fighter.revealedAbilities.add(key);
  emit(battle, { t: 'abilityChange', side: sideIndexOf(battle, fighter), ability: abilityInfo(key) });
}

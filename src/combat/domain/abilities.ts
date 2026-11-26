import { abilityInfo } from '../../catalog/domain/abilities.js';
import { ABILITIES, type AbilityEffect } from './rules/ability-effects.js';
import { ITEMS } from './rules/item-effects.js';
import type { AbilityDetails, BattleFighter, BattleState } from './battle-types.js';
import { activeFighters, emit, foeOf, nameOf, sideIndexOf } from './state.js';

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

export const itemDef = (fighter: BattleFighter): Partial<AbilityEffect> | null => (fighter.item ? ITEMS[fighter.item] ?? null : null);

export const anyActiveHas = (battle: BattleState, key: string): boolean => activeFighters(battle).some((f) => abilityKey(battle, f) === key);
export const otherActiveHas = (battle: BattleState, fighter: BattleFighter, key: string): boolean =>
  activeFighters(battle).some((o) => o !== fighter && abilityKey(battle, o) === key);

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

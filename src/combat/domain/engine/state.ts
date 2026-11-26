import type { BoostKey } from '../../../catalog/domain/creatures.js';
import type { BattleEvent, BattleFighter, BattleSide, BattleState, Look } from '../battle-types.js';

export const freshBoosts = (): Record<BoostKey, number> => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, acc: 0, eva: 0 });
export const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));

export const emit = (battle: BattleState, event: BattleEvent): number => battle.events.push(event);
export const activeOf = (battle: BattleState, sideIndex: number): BattleFighter => battle.sides[sideIndex].team[battle.sides[sideIndex].active];
export const sideIndexOf = (battle: BattleState, fighter: BattleFighter): number => battle.sides.findIndex((side) => side.team.includes(fighter));
export const onField = (battle: BattleState, fighter: BattleFighter): boolean =>
  fighter.hp > 0 && activeOf(battle, sideIndexOf(battle, fighter)) === fighter;
export const activeFighters = (battle: BattleState): BattleFighter[] => [0, 1].map((s) => activeOf(battle, s)).filter((f) => f.hp > 0);
export const foeOf = (battle: BattleState, fighter: BattleFighter): BattleFighter | null => {
  const foe = activeOf(battle, 1 - sideIndexOf(battle, fighter));
  return foe.hp > 0 ? foe : null;
};
export const nameOf = (fighter: BattleFighter): string => fighter.volatiles.illusion?.name ?? fighter.name;
export const hasBench = (battle: BattleState, fighter: BattleFighter): boolean =>
  battle.sides[sideIndexOf(battle, fighter)].team.some((other) => other !== fighter && other.hp > 0);
export const benchSlots = (side: BattleSide): number[] => side.team.flatMap((fighter, slot) => (slot !== side.active && fighter.hp > 0 ? [slot] : []));

export function lookOf(fighter: BattleFighter): Look {
  return {
    name: fighter.name,
    speciesName: fighter.speciesName,
    sprite: fighter.sprite,
    floats: fighter.floats,
    types: fighter.types,
    shiny: fighter.shiny,
    rarity: fighter.rarity,
  };
}

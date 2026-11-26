import { HELD_ITEMS } from '../../../catalog/domain/held-items.js';
import { abilityInfo } from '../../../catalog/domain/abilities.js';
import type { BattleFighter, BattleState, FighterView, MoveData, PublicMove, PublicVolatiles } from '../battle-types.js';

function publicMove(move: MoveData): PublicMove {
  return {
    name: move.name,
    type: move.type,
    power: move.power,
    accuracy: move.accuracy,
    priority: move.priority,
    kind: move.kind || 'attack',
    category: move.category,
    desc: move.desc,
    key: move.key,
    contact: move.flags.includes('contact'),
    pp: move.pp,
    target: move.target,
    ...(move.aimable ? { aimable: move.aimable } : {}),
    ...(move.boosts ? { boosts: move.boosts } : {}),
    ...(move.status ? { status: move.status } : {}),
    ...(move.heal ? { heal: move.heal } : {}),
    ...(move.weather ? { weather: move.weather } : {}),
    ...(move.screen ? { screen: move.screen } : {}),
    ...(move.breaksScreens ? { breaksScreens: true } : {}),
    ...(move.fixedDamage ? { fixedDamage: move.fixedDamage } : {}),
    ...(move.ohko ? { ohko: true } : {}),
    ...(move.flags.includes('charge') ? { charge: true } : {}),
    ...(move.flags.includes('recharge') ? { recharge: true } : {}),
    ...(move.secondary ? { secondary: move.secondary } : {}),
    ...(move.self ? { self: move.self } : {}),
    ...(move.recoil ? { recoil: move.recoil } : {}),
    ...(move.drain ? { drain: move.drain } : {}),
    ...(move.crit ? { crit: move.crit } : {}),
    ...(move.multihit ? { multihit: true } : {}),
  };
}

export function publicMoves(fighter: BattleFighter, known: Set<string> | null = null) {
  return fighter.moves.filter((m) => !known || known.has(m.key)).map(publicMove);
}

function publicVolatiles(fighter: BattleFighter): PublicVolatiles {
  const volatiles = fighter.volatiles;
  return {
    ...(volatiles.confusion ? { confusion: true } : {}),
    ...(volatiles.attract ? { attract: true } : {}),
    ...(volatiles.perish ? { perish: volatiles.perish } : {}),
    ...(volatiles.charge ? { charge: true } : {}),
    ...(volatiles.flashFire ? { flashFire: true } : {}),
    ...(volatiles.disabled ? { disabled: volatiles.disabled.name } : {}),
    ...(volatiles.slowStart ? { slowStart: volatiles.slowStart } : {}),
    ...(volatiles.bound ? { bound: volatiles.bound.move } : {}),
    ...(volatiles.trappedBy ? { trapped: true } : {}),
    ...(volatiles.saltCure ? { saltcure: true } : {}),
    ...(volatiles.smackedDown ? { smackdown: true } : {}),
    ...(volatiles.noRetreat ? { noRetreat: true } : {}),
    ...(volatiles.substitute ? { substitute: true } : {}),
    ...(volatiles.taunt ? { taunt: volatiles.taunt.turns } : {}),
    ...(volatiles.encore ? { encore: volatiles.encore.key } : {}),
    ...(volatiles.torment ? { torment: true } : {}),
    ...(volatiles.healBlock ? { healblock: volatiles.healBlock.turns } : {}),
    ...(volatiles.yawn ? { yawn: true } : {}),
    ...(volatiles.nightmare ? { nightmare: true } : {}),
    ...(volatiles.curse ? { curse: true } : {}),
    ...(volatiles.focusEnergy ? { focusenergy: true } : {}),
    ...(volatiles.ingrain ? { ingrain: true } : {}),
    ...(volatiles.aquaRing ? { aquaring: true } : {}),
    ...(volatiles.magnetRise ? { magnetrise: volatiles.magnetRise.turns } : {}),
    ...(volatiles.telekinesis ? { telekinesis: volatiles.telekinesis.turns } : {}),
    ...(volatiles.foresight ? { foresight: true } : {}),
    ...(volatiles.miracleEye ? { miracleeye: true } : {}),
    ...(volatiles.stockpile ? { stockpile: volatiles.stockpile.count } : {}),
    ...(volatiles.gastroAcid ? { gastroacid: true } : {}),
    ...(volatiles.uproar ? { uproar: true } : {}),
    ...(volatiles.imprison ? { imprison: true } : {}),
  };
}

export const percentOf = (hp: number, max: number): number => (hp <= 0 ? 0 : Math.max(1, Math.round((hp / max) * 100)));

const heldItemView = (key: string) => ({ key, name: HELD_ITEMS[key]?.name ?? key, desc: HELD_ITEMS[key]?.desc ?? '' });

export function fighterView(battle: BattleState, sideIndex: number, slot: number, own: boolean, spectator = false): FighterView {
  const side = battle.sides[sideIndex];
  const fighter = side.team[slot];
  if (!own && !spectator && !fighter.seen) return { uid: `hidden-${sideIndex}-${slot}`, hidden: true };
  const disguise = slot === side.active && fighter.hp > 0 && fighter.volatiles.illusion ? fighter.volatiles.illusion : own ? null : fighter.seenAs;
  const abilityKnown = own || fighter.revealedAbilities.has(fighter.ability);
  return {
    uid: fighter.uid,
    name: fighter.name,
    speciesName: fighter.speciesName,
    types: fighter.types,
    rarity: fighter.rarity,
    shiny: fighter.shiny,
    level: fighter.level,
    stats: own ? fighter.stats : { hp: 100 },
    hp: own ? fighter.hp : percentOf(fighter.hp, fighter.stats.hp),
    ...(own ? {} : { hpPercent: true }),
    boosts: fighter.boosts,
    pp: own ? fighter.pp : {},
    gender: fighter.gender,
    sprite: fighter.sprite,
    floats: fighter.floats,
    status: fighter.status,
    volatiles: publicVolatiles(fighter),
    abilityInfo: abilityKnown ? abilityInfo(fighter.ability) : null,
    moves: publicMoves(fighter, own ? null : fighter.revealedMoves),
    ...(own && !fighter.volatiles.transformed ? { speciesBase: fighter.speciesBase, evs: fighter.evs, natureInfo: fighter.natureInfo } : {}),
    ...(own && fighter.item ? { itemInfo: heldItemView(fighter.item) } : {}),
    ...(disguise ?? {}),
  };
}

export function shownTarget(me: Pick<BattleFighter, 'types'>, key: string, target: string): string {
  return key === 'curse' && !me.types.includes('ghost') ? 'self' : target;
}

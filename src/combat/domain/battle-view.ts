// What each client sees of a battle: its own side in full, the rival as revealed so far (HP in percent, moves and
// ability once used), and every event in those same terms. Pending choices stay hidden: only "ready" shows.
import type { BoostKey, Stats } from '../../catalog/domain/creatures.js';
import type { MoveData } from './moves.js';
import { abilityInfo, type AbilityInfo } from '../../catalog/domain/abilities.js';
import type { Gender, Rarity } from '../../catalog/domain/roster-entry.js';
import type { BattleEvent, BattleFighter, BattleState } from './battle-types.js';
import { needsAction } from './battle.js';
import { currentWeather } from './effects.js';

function publicMove(move: MoveData) {
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

function publicVolatiles(fighter: BattleFighter) {
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

const percentOf = (hp: number, max: number): number => (hp <= 0 ? 0 : Math.max(1, Math.round((hp / max) * 100)));

/** A rival's HP change, in percentages (`pct`), never exact numbers. */
function inPercent(event: Extract<BattleEvent, { hp: number }>) {
  const hp = percentOf(event.hp, event.max);
  const shown = { ...event, hp, max: 100, pct: true as const, ...('stats' in event ? { stats: { hp: 100 } } : {}) };
  if (!('amount' in event)) return shown;
  const before = event.t === 'heal' ? event.hp - event.amount : event.hp + event.amount;
  return { ...shown, amount: event.amount > 0 ? Math.max(1, Math.abs(percentOf(before, event.max) - hp)) : 0 };
}

/** A switch shows each client the card it may see; a rival's HP and stats come as percentages. */
function viewEvent(event: BattleEvent, viewer: number | null) {
  if (event.t === 'switch') {
    const { card, seen, ...rest } = event;
    return { ...rest, mon: event.side === viewer ? card : seen };
  }
  if (!('side' in event) || event.side === viewer) return event;
  if ('hp' in event) return inPercent(event);
  return 'stats' in event ? { ...event, stats: { hp: 100 } } : event;
}

/** A BattleEvent as one client receives it. */
export type EventView = ReturnType<typeof viewEvent>;

export function viewEvents(events: BattleEvent[], viewer: number | null = null): EventView[] {
  return events.map((e) => viewEvent(e, viewer));
}

export type PublicMove = ReturnType<typeof publicMove>;

/** A fighter as a client sees it: everything for its owner, what has been revealed for the rest. */
export interface VisibleFighterView {
  uid: string;
  hidden?: false;
  name: string;
  speciesName: string;
  types: string[];
  rarity: Rarity;
  shiny: boolean;
  level: number;
  /** Exact stats for the owner; only `{ hp: 100 }` for the others, who see percentages. */
  stats: Pick<Stats, 'hp'> & Partial<Stats>;
  hp: number;
  hpPercent?: true;
  boosts: Record<BoostKey, number>;
  pp: Record<string, number>;
  gender: Gender | null;
  sprite: string;
  floats: boolean;
  status: string | null;
  volatiles: ReturnType<typeof publicVolatiles>;
  abilityInfo: AbilityInfo | null;
  moves: PublicMove[];
}

/** A rival Pokémon that hasn't come out yet. */
export type HiddenFighterView = { uid: string; hidden: true } & { [K in Exclude<keyof VisibleFighterView, 'uid' | 'hidden'>]?: undefined };

export type FighterView = VisibleFighterView | HiddenFighterView;

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
    ...(disguise ?? {}),
  };
}

export function shownTarget(me: Pick<BattleFighter, 'types'>, key: string, target: string): string {
  return key === 'curse' && !me.types.includes('ghost') ? 'self' : target;
}

export function publicState(battle: BattleState, viewer: number | null = null) {
  return {
    id: battle.id,
    status: battle.status,
    phase: battle.phase,
    turn: battle.turn,
    winner: battle.winner,
    field: {
      weather: battle.field.weather,
      terrain: battle.field.terrain,
      weatherSuppressed: !!battle.field.weather && !currentWeather(battle),
      rooms: { ...battle.field.rooms },
    },
    intro: battle.turn === 1 && battle.phase === 'choose' ? viewEvents(battle.intro, viewer) : [],
    sides: battle.sides.map((side, s) => ({
      trainerId: side.trainerId,
      name: side.name,
      avatar: side.avatar,
      frame: side.frame,
      ball: side.ball,
      active: side.active,
      ready: !needsAction(battle, s),
      mustSwitch: side.mustSwitch,
      toxicSpikes: side.toxicSpikes,
      screens: { ...side.screens },
      hazards: { ...side.hazards },
      conds: { ...side.conds },
      ...(side.wish ? { wish: true } : {}),
      ...(side.future ? { future: side.future.name } : {}),
      team: side.team.map((f, i) => fighterView(battle, s, i, viewer === s || battle.status === 'finished', viewer === null)),
    })),
  };
}

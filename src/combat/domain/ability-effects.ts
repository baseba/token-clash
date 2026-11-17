// What each ability does in battle (EFFECTS). The effects are hooks the engine calls (onStart,
// onBasePower, onTryHit…) with the AbilityEngine of ability-engine.ts, so they never touch the
// battle state directly. Names and descriptions are catalog data: catalog/domain/abilities.ts.
import type { Boosts, BoostKey, MajorStatus, StatKey, Weather } from '../../catalog/domain/creatures.js';
import type { MoveData } from './moves.js';
import type { AbilityEngine } from './ability-engine.js';
import { isIcy, isMajorStatus, isRain, isSun, poisoned, stageMult } from './conditions.js';
import type { BattleFighter, BattleMove } from './battle-types.js';

/** Stat stage changes about to apply, which onTryBoost/onChangeBoost may edit in place. */
export type BoostChanges = Record<string, number>;

/** Extra facts a damaging hit hands to onDamagingHit. */
export interface HitInfo {
  crit: boolean;
  before: number;
  dmg: number;
}

/**
 * What an ability does. Flags are read by the engine (flag()); hooks are called by it (run(), mul(),
 * chain()). A hook returns a multiplier (mul), the new value of the number it was handed last (chain),
 * a boolean that blocks or allows, or nothing.
 */
export interface AbilityEffect {
  // Flags
  breakable?: boolean;
  noTrace?: boolean;
  unsuppressable?: boolean;
  actsInSun?: boolean;
  alwaysHits?: boolean;
  blocksSecondaries?: boolean;
  blocksStatusMoves?: boolean;
  bouncesStatus?: boolean;
  comatose?: boolean;
  corrosion?: boolean;
  critImmune?: boolean;
  disguisesOnEntry?: boolean;
  doublesSecondaries?: boolean;
  halvesBurn?: boolean;
  hitsGhost?: boolean;
  ignoresBurn?: boolean;
  ignoresEvasion?: boolean;
  ignoresParalysisSpeed?: boolean;
  infiltrates?: boolean;
  levitates?: boolean;
  maxHits?: boolean;
  moldBreaker?: boolean;
  noIndirectDamage?: boolean;
  noRecoil?: boolean;
  oozes?: boolean;
  parentalBond?: boolean;
  sheerForce?: boolean;
  stab?: number;
  suctionCups?: boolean;
  unaware?: boolean;
  wakesFaster?: boolean;
  wonderSkin?: boolean;
  weatherImmune?: string[];
  // Hooks
  onAccuracy?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, target: BattleFighter, acc: number): number;
  onAfterEachBoost?(engine: AbilityEngine, me: BattleFighter, applied: Boosts, source: BattleFighter | null, effect?: string): void;
  onAfterMoveHit?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, target: BattleFighter, total: number): void;
  onAfterMove?(engine: AbilityEngine, me: BattleFighter, move: BattleMove): void;
  onAfterSetStatus?(engine: AbilityEngine, me: BattleFighter, status: MajorStatus, source: BattleFighter | null): void;
  onAnyFaint?(engine: AbilityEngine, me: BattleFighter, fainted: BattleFighter): void;
  onAttackerFinal?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, target: BattleFighter, info: { eff: number; crit: boolean }): number;
  onAttack?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, target: BattleFighter): number;
  onBasePower?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, target: BattleFighter): number;
  onBeforeMoveForm?(engine: AbilityEngine, me: BattleFighter, move: BattleMove): void;
  onBeforeMove?(engine: AbilityEngine, me: BattleFighter, move: BattleMove): boolean;
  onChangeBoost?(engine: AbilityEngine, me: BattleFighter, changes: BoostChanges): void;
  onCritStage?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, target: BattleFighter, stage: number): number;
  onDamage?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, attacker: BattleFighter, dmg: number): number;
  onDamagingHit?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, attacker: BattleFighter, info: HitInfo): void;
  onDefenderFinal?(
    engine: AbilityEngine,
    me: BattleFighter,
    move: BattleMove,
    attacker: BattleFighter,
    info: { eff: number; crit: boolean },
  ): number;
  onDefense?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, attacker: BattleFighter): number;
  onEffectiveness?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, attacker: BattleFighter, eff: number): number;
  onEndTurn?(engine: AbilityEngine, me: BattleFighter): void;
  onEvasion?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, attacker: BattleFighter, acc: number): number;
  onFaint?(engine: AbilityEngine, me: BattleFighter, by: BattleFighter | null, move: BattleMove | null, lastHit: number): void;
  onFlinch?(engine: AbilityEngine, me: BattleFighter): void;
  onFoeBoost?(engine: AbilityEngine, me: BattleFighter, foe: BattleFighter, ups: Boosts, effect?: string): void;
  onFoeFaint?(engine: AbilityEngine, me: BattleFighter, fainted: BattleFighter): void;
  onFoeMove?(engine: AbilityEngine, me: BattleFighter, user: BattleFighter, move: BattleMove): void;
  onFractionalPriority?(engine: AbilityEngine, me: BattleFighter, move: MoveData): number;
  onIncoming?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, attacker: BattleFighter): number;
  onInflictStatus?(engine: AbilityEngine, me: BattleFighter, target: BattleFighter, status: MajorStatus): void;
  onModifyMove?(engine: AbilityEngine, me: BattleFighter, move: BattleMove): void;
  onModifyPriority?(engine: AbilityEngine, me: BattleFighter, move: MoveData, priority: number): number;
  onPrepareMove?(engine: AbilityEngine, me: BattleFighter, move: BattleMove): void;
  onSetStatus?(engine: AbilityEngine, me: BattleFighter, status: string, source: BattleFighter | null): boolean;
  onSpeed?(engine: AbilityEngine, me: BattleFighter, spd: number): number;
  onStart?(engine: AbilityEngine, me: BattleFighter): void;
  onStatusDamage?(engine: AbilityEngine, me: BattleFighter, status: MajorStatus, amount: number): number;
  onSwitchOut?(engine: AbilityEngine, me: BattleFighter): void;
  onTerrainChange?(engine: AbilityEngine, me: BattleFighter): void;
  onTrapFoe?(engine: AbilityEngine, me: BattleFighter, foe: BattleFighter): boolean;
  onTryBoost?(engine: AbilityEngine, me: BattleFighter, changes: BoostChanges, source: BattleFighter | null, effect?: string): void;
  onTryHit?(engine: AbilityEngine, me: BattleFighter, move: BattleMove, attacker: BattleFighter): boolean;
  onWeatherChange?(engine: AbilityEngine, me: BattleFighter): void;
}

/** Names of the hooks (the methods of AbilityEffect). */
export type AbilityHook = { [K in keyof AbilityEffect]-?: NonNullable<AbilityEffect[K]> extends (...args: never[]) => unknown ? K : never }[keyof AbilityEffect];



const isAttack = (move: MoveData): boolean => move.category !== 'status';
const physical = (move: MoveData): boolean => move.category === 'physical';
const special = (move: MoveData): boolean => move.category === 'special';
const has = (move: MoveData, flag: string): boolean => move.flags.includes(flag);
const contact = (engine: AbilityEngine, move: MoveData, attacker: BattleFighter): boolean =>
  has(move, 'contact') && !engine.has(attacker, 'long-reach');
const full = (fighter: BattleFighter): boolean => fighter.hp === fighter.stats.hp;
const fraction = (fighter: BattleFighter, share: number): number => Math.max(1, Math.floor(fighter.stats.hp * share));
const droppedBelowHalf = (fighter: BattleFighter, before: number): boolean =>
  before > fighter.stats.hp / 2 && fighter.hp > 0 && fighter.hp <= fighter.stats.hp / 2;
const highestStat = (fighter: BattleFighter): StatKey =>
  (['atk', 'def', 'satk', 'sdef', 'spd'] as const).reduce<StatKey>((best, k) => (fighter.stats[k] > fighter.stats[best] ? k : best), 'atk');

const typePower = (type: string, mult: number): AbilityEffect => ({ onBasePower: (engine, me, move) => (move.type === type ? mult : 1) });
const flagPower = (flag: string, mult: number): AbilityEffect => ({ onBasePower: (engine, me, move) => (has(move, flag) ? mult : 1) });
const pinch = (type: string): AbilityEffect => ({ onBasePower: (engine, me, move) => (move.type === type && me.hp <= me.stats.hp / 3 ? 1.5 : 1) });
const weatherSpeed = (test: (weather: Weather | null) => boolean): AbilityEffect => ({
  onSpeed: (engine, me, spd) => (test(engine.weather()) ? spd * 2 : spd),
});

const skin = (type: string): AbilityEffect => ({
  onModifyMove(engine, me, move) {
    if (move.type === 'normal' && isAttack(move)) {
      move.type = type;
      move.skinBoost = true;
    }
  },
  onBasePower: (engine, me, move) => (move.skinBoost ? 1.2 : 1),
});

const blockStatus = (blocked: (status: string, engine: AbilityEngine, me: BattleFighter) => boolean): AbilityEffect => ({
  breakable: true,
  onSetStatus(engine, me, status, source) {
    if (!blocked(status, engine, me)) return true;
    if (source && source !== me) engine.show(me);
    return false;
  },
  onEndTurn(engine, me) {
    if (me.status && blocked(me.status, engine, me)) engine.cure(me, true);
  },
});

const absorb = (type: string, effect: { heal?: number; boost?: Boosts; flashFire?: boolean }): AbilityEffect => ({
  breakable: true,
  onTryHit(engine, me, move) {
    if (move.type !== type) return false;
    engine.show(me);
    if (effect.heal && !engine.heal(me, fraction(me, effect.heal))) engine.immune(me);
    if (effect.boost) engine.boost(me, effect.boost, me);
    if (effect.flashFire) me.volatiles.flashFire = true;
    return true;
  },
});

const contactChance = (chance: number, apply: (engine: AbilityEngine, me: BattleFighter, attacker: BattleFighter) => void): AbilityEffect => ({
  onDamagingHit(engine, me, move, attacker) {
    if (!contact(engine, move, attacker) || attacker.hp <= 0 || engine.rand() >= chance) return;
    apply(engine, me, attacker);
  },
});

const contactStatus = (status: MajorStatus, chance = 0.3): AbilityEffect =>
  contactChance(chance, (E, me, attacker) => E.setStatus(attacker, status, me, { ability: me }));

const hitBoost = (test: (move: BattleMove) => boolean, boost: Boosts): AbilityEffect => ({
  onDamagingHit(engine, me, move, attacker) {
    if (me.hp > 0 && test(move)) engine.boost(me, boost, me, { ability: me });
  },
});

const hurtAttackerOnContact: AbilityEffect = {
  onDamagingHit(engine, me, move, attacker) {
    if (contact(engine, move, attacker) && attacker.hp > 0) {
      engine.show(me);
      engine.damage(attacker, fraction(attacker, 1 / 8), 'ability');
    }
  },
};

const onKoBoost = (boost: Boosts | ((me: BattleFighter) => Boosts)): AbilityEffect => ({
  onFoeFaint(engine, me) {
    engine.boost(me, typeof boost === 'function' ? boost(me) : boost, me, { ability: me });
  },
});

const setsWeather = (weather: Weather): AbilityEffect => ({ onStart: (engine, me) => engine.setWeather(weather, me) });
const setsTerrain = (terrain: string): AbilityEffect => ({ onStart: (engine, me) => engine.setTerrain(terrain, me) });
const announce = (note: string): AbilityEffect => ({ onStart: (engine, me) => engine.show(me, note) });

const blockDrops = (stats: BoostKey[] | null, { breakable = true, effects = null }: { breakable?: boolean; effects?: string[] | null } = {}): AbilityEffect => ({
  breakable,
  onTryBoost(engine, me, changes, source, effect) {
    if (!source || source === me) return;
    if (effects && !effects.includes(effect as string)) return;
    let blocked = false;
    for (const key of Object.keys(changes)) {
      if (changes[key] < 0 && (!stats || stats.includes(key as BoostKey))) {
        delete changes[key];
        blocked = true;
      }
    }
    if (blocked) engine.show(me, 'noDrop');
  },
});

const ignoresIntimidate: AbilityEffect = {
  onTryBoost(engine, me, changes, source, effect) {
    if (effect === 'intimidate' && changes.atk < 0) {
      delete changes.atk;
      engine.show(me, 'noDrop');
    }
  },
};

// Combines effects: hooks present in several parts all run (multipliers multiply, blocks combine).
type AnyHook = (...args: unknown[]) => unknown;
const merge = (...parts: AbilityEffect[]): AbilityEffect => {
  const out: Record<string, unknown> = {};
  for (const part of parts) {
    for (const [hook, next] of Object.entries(part) as [string, unknown][]) {
      const prev = out[hook];
      if (typeof next === 'function' && typeof prev === 'function') {
        out[hook] = (...args: unknown[]) => {
          const previousResult = (prev as AnyHook)(...args);
          const nextResult = (next as AnyHook)(...args);
          if (typeof previousResult === 'number' && typeof nextResult === 'number') return previousResult * nextResult;
          if (typeof previousResult === 'boolean' || typeof nextResult === 'boolean')
            return hook === 'onSetStatus' ? previousResult !== false && nextResult !== false : previousResult || nextResult;
          return nextResult ?? previousResult;
        };
      } else out[hook] = next;
    }
  }
  return out as AbilityEffect;
};

const formChanger = (decide: (engine: AbilityEngine, me: BattleFighter) => void): AbilityEffect => ({
  unsuppressable: true,
  noTrace: true,
  onStart: (engine, me) => decide(engine, me),
  onEndTurn: (engine, me) => decide(engine, me),
});

const MINIOR_CORES = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];
const miniorCore = (fighter: BattleFighter): string =>
  `minior-${MINIOR_CORES[[...String(fighter.uid)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % MINIOR_CORES.length]}`;

const EFFECTS: Record<string, AbilityEffect> = {
  stench: {
    onAfterMoveHit(engine, me, move, target) {
      if (target.hp > 0 && !move.secondary?.some((s) => s.flinch) && engine.rand() < 0.1) engine.addVolatile(target, 'flinch', me);
    },
  },
  drizzle: setsWeather('rain'),
  'speed-boost': {
    onEndTurn(engine, me) {
      if (me.activeTurns > 0) engine.boost(me, { spd: 1 }, me, { ability: me });
    },
  },
  'battle-armor': { breakable: true, critImmune: true },
  sturdy: {
    breakable: true,
    onDamage(engine, me, move, attacker, dmg) {
      if (full(me) && dmg >= me.hp && me.hp > 1) {
        engine.show(me, 'endure');
        return me.hp - 1;
      }
      return dmg;
    },
  },
  damp: { breakable: true },
  limber: blockStatus((s) => s === 'par'),
  'sand-veil': {
    breakable: true,
    weatherImmune: ['sand'],
    onEvasion: (engine, me, move, attacker, acc) => (engine.weather() === 'sand' ? acc * 0.8 : acc),
  },
  static: contactStatus('par'),
  'volt-absorb': absorb('electric', { heal: 1 / 4 }),
  'water-absorb': absorb('water', { heal: 1 / 4 }),
  oblivious: merge(blockStatus((s) => s === 'attract'), ignoresIntimidate),
  'cloud-nine': announce('weatherOff'),
  'compound-eyes': { onAccuracy: (engine, me, move, target, acc) => acc * 1.3 },
  insomnia: blockStatus((s) => s === 'slp'),
  'color-change': {
    onDamagingHit(engine, me, move) {
      if (me.hp > 0 && move.type && !(me.types.length === 1 && me.types[0] === move.type)) {
        engine.show(me);
        engine.setTypes(me, [move.type]);
      }
    },
  },
  immunity: blockStatus(poisoned),
  'flash-fire': merge(absorb('fire', { flashFire: true }), {
    onBasePower: (engine, me, move) => (me.volatiles.flashFire && move.type === 'fire' ? 1.5 : 1),
  }),
  'shield-dust': { breakable: true, blocksSecondaries: true },
  'own-tempo': merge(blockStatus((s) => s === 'confusion'), ignoresIntimidate),
  intimidate: {
    onStart(engine, me) {
      const foe = engine.foe(me);
      if (!foe) return;
      engine.show(me);
      engine.boost(foe, { atk: -1 }, me, { effect: 'intimidate' });
    },
  },
  'shadow-tag': { onTrapFoe: (engine, me, foe) => !engine.has(foe, 'shadow-tag') && !foe.types.includes('ghost') },
  'rough-skin': hurtAttackerOnContact,
  'wonder-guard': {
    breakable: true,
    noTrace: true,
    onTryHit(engine, me, move, attacker) {
      if (!isAttack(move) || !move.type || engine.effectiveness(move, attacker, me) > 1) return false;
      engine.show(me);
      engine.immune(me);
      return true;
    },
  },
  levitate: {
    breakable: true,
    levitates: true,
    onTryHit(engine, me, move) {
      if (move.type !== 'ground' || !isAttack(move)) return false;
      engine.show(me);
      engine.immune(me);
      return true;
    },
  },
  'effect-spore': {
    onDamagingHit(engine, me, move, attacker) {
      if (!contact(engine, move, attacker) || attacker.hp <= 0) return;
      if (attacker.types.includes('grass') || engine.has(attacker, 'overcoat')) return;
      const roll = engine.rand();
      const status = roll < 0.09 ? 'psn' : roll < 0.19 ? 'par' : roll < 0.3 ? 'slp' : null;
      if (status) engine.setStatus(attacker, status, me, { ability: me });
    },
  },
  synchronize: {
    onAfterSetStatus(engine, me, status, source) {
      if (source && source !== me && ['brn', 'par', 'psn', 'tox'].includes(status)) {
        engine.show(me);
        engine.setStatus(source, status, me);
      }
    },
  },
  'clear-body': blockDrops(null),
  'natural-cure': { onSwitchOut: (engine, me) => me.status && engine.cure(me, false) },
  'lightning-rod': absorb('electric', { boost: { satk: 1 } }),
  'serene-grace': { doublesSecondaries: true },
  'swift-swim': weatherSpeed(isRain),
  chlorophyll: weatherSpeed(isSun),
  illuminate: merge(blockDrops(['acc']), { ignoresEvasion: true }),
  trace: {
    noTrace: true,
    onStart(engine, me) {
      const foe = engine.foe(me);
      const key = foe?.ability;
      if (!key || !EFFECTS[key] || EFFECTS[key].noTrace) return;
      engine.show(me, 'trace', { copied: key });
      engine.setAbility(me, key);
      EFFECTS[key].onStart?.(engine, me);
    },
  },
  'huge-power': { onAttack: (engine, me, move) => (physical(move) ? 2 : 1) },
  'poison-point': contactStatus('psn'),
  'inner-focus': merge(blockStatus((s) => s === 'flinch'), ignoresIntimidate),
  'magma-armor': blockStatus((s) => s === 'frz'),
  'water-veil': blockStatus((s) => s === 'brn'),
  'magnet-pull': { onTrapFoe: (engine, me, foe) => foe.types.includes('steel') },
  soundproof: {
    breakable: true,
    onTryHit(engine, me, move) {
      if (!has(move, 'sound')) return false;
      engine.show(me);
      engine.immune(me);
      return true;
    },
  },
  'rain-dish': { onEndTurn: (engine, me) => isRain(engine.weather()) && engine.heal(me, fraction(me, 1 / 16)) },
  'sand-stream': setsWeather('sand'),
  pressure: announce('pressure'),
  'thick-fat': { breakable: true, onIncoming: (engine, me, move) => (move.type === 'fire' || move.type === 'ice' ? 0.5 : 1) },
  'early-bird': { wakesFaster: true },
  'flame-body': contactStatus('brn'),
  'keen-eye': merge(blockDrops(['acc']), { ignoresEvasion: true }),
  'hyper-cutter': blockDrops(['atk']),
  truant: {
    onStart(engine, me) {
      me.volatiles.truantRest = false;
    },
    onBeforeMove(engine, me) {
      if (me.volatiles.truantRest) {
        me.volatiles.truantRest = false;
        engine.show(me, 'loafing');
        return false;
      }
      me.volatiles.truantRest = true;
      return true;
    },
  },
  hustle: {
    onAttack: (engine, me, move) => (physical(move) ? 1.5 : 1),
    onAccuracy: (engine, me, move, target, acc) => (physical(move) ? acc * 0.8 : acc),
  },
  'cute-charm': contactChance(0.3, (E, me, attacker) => E.addVolatile(attacker, 'attract', me, { ability: me })),
  forecast: {
    noTrace: true,
    onStart: (engine, me) => forecastType(engine, me),
    onWeatherChange: (engine, me) => forecastType(engine, me),
  },
  'shed-skin': {
    onEndTurn(engine, me) {
      if (me.status && engine.rand() < 1 / 3) {
        engine.show(me);
        engine.cure(me, true);
      }
    },
  },
  guts: { ignoresBurn: true, onAttack: (engine, me, move) => (me.status && physical(move) ? 1.5 : 1) },
  'marvel-scale': { breakable: true, onDefense: (engine, me, move) => (me.status && physical(move) ? 1.5 : 1) },
  'liquid-ooze': { oozes: true },
  overgrow: pinch('grass'),
  blaze: pinch('fire'),
  torrent: pinch('water'),
  swarm: pinch('bug'),
  'rock-head': { noRecoil: true },
  drought: setsWeather('sun'),
  'arena-trap': { onTrapFoe: (engine, me, foe) => engine.grounded(foe) },
  'vital-spirit': blockStatus((s) => s === 'slp'),
  'white-smoke': blockDrops(null),
  'pure-power': { onAttack: (engine, me, move) => (physical(move) ? 2 : 1) },
  'shell-armor': { breakable: true, critImmune: true },
  'air-lock': announce('weatherOff'),
  'tangled-feet': { breakable: true, onEvasion: (engine, me, move, attacker, acc) => (me.volatiles.confusion ? acc * 0.5 : acc) },
  'motor-drive': absorb('electric', { boost: { spd: 1 } }),
  rivalry: {
    onBasePower(engine, me, move, target) {
      if (!me.gender || !target.gender) return 1;
      return me.gender === target.gender ? 1.25 : 0.75;
    },
  },
  steadfast: { onFlinch: (engine, me) => engine.boost(me, { spd: 1 }, me, { ability: me }) },
  'snow-cloak': {
    breakable: true,
    weatherImmune: ['snow', 'hail'],
    onEvasion: (engine, me, move, attacker, acc) => (isIcy(engine.weather()) ? acc * 0.8 : acc),
  },
  'anger-point': {
    onDamagingHit(engine, me, move, attacker, { crit }) {
      if (crit && me.hp > 0) {
        engine.show(me);
        engine.boost(me, { atk: 12 }, me);
      }
    },
  },
  heatproof: { breakable: true, halvesBurn: true, onIncoming: (engine, me, move) => (move.type === 'fire' ? 0.5 : 1) },
  simple: {
    breakable: true,
    onChangeBoost(engine, me, changes) {
      for (const key of Object.keys(changes)) changes[key] *= 2;
    },
  },
  'dry-skin': merge(absorb('water', { heal: 1 / 4 }), {
    onIncoming: (engine, me, move) => (move.type === 'fire' ? 1.25 : 1),
    onEndTurn(engine, me) {
      const weather = engine.weather();
      if (isRain(weather)) engine.heal(me, fraction(me, 1 / 8));
      else if (isSun(weather)) {
        engine.show(me);
        engine.damage(me, fraction(me, 1 / 8), 'ability');
      }
    },
  }),
  download: {
    onStart(engine, me) {
      const foe = engine.foe(me);
      if (!foe) return;
      engine.show(me);
      engine.boost(me, foe.stats.def * stageMult(foe.boosts.def) < foe.stats.sdef * stageMult(foe.boosts.sdef) ? { atk: 1 } : { satk: 1 }, me);
    },
  },
  'iron-fist': flagPower('punch', 1.2),
  'magic-bounce': { breakable: true, bouncesStatus: true },
  'good-as-gold': { breakable: true, blocksStatusMoves: true },
  'wonder-skin': { breakable: true, wonderSkin: true },
  'poison-heal': {
    onStatusDamage(engine, me, status, amount) {
      if (!poisoned(status)) return amount;
      if (!full(me)) {
        engine.show(me);
        engine.heal(me, fraction(me, 1 / 8));
      }
      return 0;
    },
  },
  adaptability: { stab: 2 },
  'skill-link': { maxHits: true },
  hydration: {
    onEndTurn(engine, me) {
      if (me.status && isRain(engine.weather())) {
        engine.show(me);
        engine.cure(me, true);
      }
    },
  },
  'solar-power': {
    onAttack: (engine, me, move) => (special(move) && isSun(engine.weather()) ? 1.5 : 1),
    onEndTurn(engine, me) {
      if (isSun(engine.weather())) {
        engine.show(me);
        engine.damage(me, fraction(me, 1 / 8), 'ability');
      }
    },
  },
  'quick-feet': { ignoresParalysisSpeed: true, onSpeed: (engine, me, spd) => (me.status ? spd * 1.5 : spd) },
  normalize: {
    onModifyMove(engine, me, move) {
      if (isAttack(move)) {
        move.type = 'normal';
        move.skinBoost = true;
      }
    },
    onBasePower: (engine, me, move) => (move.skinBoost ? 1.2 : 1),
  },
  sniper: { onAttackerFinal: (engine, me, move, target, { crit }) => (crit ? 1.5 : 1) },
  'magic-guard': { noIndirectDamage: true },
  'no-guard': { alwaysHits: true },
  stall: { onFractionalPriority: () => -1 },
  technician: { onBasePower: (engine, me, move) => (move.power <= 60 ? 1.5 : 1) },
  'leaf-guard': blockStatus((s, E) => isMajorStatus(s) && isSun(E.weather())),
  'mold-breaker': merge(announce('moldBreaker'), { moldBreaker: true }),
  'super-luck': { onCritStage: (engine, me, move, target, stage) => stage + 1 },
  aftermath: {
    onFaint(engine, me, attacker, move) {
      if (!attacker || attacker.hp <= 0 || !move || !contact(engine, move, attacker) || engine.anyActiveHas('damp')) return;
      engine.show(me);
      engine.damage(attacker, fraction(attacker, 1 / 4), 'ability');
    },
  },
  anticipation: {
    onStart(engine, me) {
      const foe = engine.foe(me);
      if (foe && foe.moves.some((m) => m.power && engine.effectiveness(m, foe, me) > 1)) engine.show(me, 'shudder');
    },
  },
  forewarn: {
    onStart(engine, me) {
      const foe = engine.foe(me);
      if (!foe) return;
      const best = foe.moves.reduce((a, m) => ((m.power || 0) > (a.power || 0) ? m : a), foe.moves[0]);
      engine.show(me, 'forewarn', { move: best.name });
    },
  },
  unaware: { breakable: true, unaware: true },
  'tinted-lens': { onAttackerFinal: (engine, me, move, target, { eff }) => (eff < 1 ? 2 : 1) },
  filter: { breakable: true, onDefenderFinal: (engine, me, move, attacker, { eff }) => (eff > 1 ? 0.75 : 1) },
  'slow-start': {
    onStart(engine, me) {
      me.volatiles.slowStart = 5;
      engine.show(me, 'slowStart');
    },
    onAttack: (engine, me, move) => (me.volatiles.slowStart && physical(move) ? 0.5 : 1),
    onSpeed: (engine, me, spd) => (me.volatiles.slowStart ? spd * 0.5 : spd),
    onEndTurn(engine, me) {
      if (!me.volatiles.slowStart) return;
      me.volatiles.slowStart -= 1;
      if (!me.volatiles.slowStart) engine.show(me, 'slowStartEnd');
    },
  },
  scrappy: merge(ignoresIntimidate, { hitsGhost: true }),
  'storm-drain': absorb('water', { boost: { satk: 1 } }),
  'ice-body': {
    weatherImmune: ['snow', 'hail'],
    onEndTurn: (engine, me) => isIcy(engine.weather()) && engine.heal(me, fraction(me, 1 / 16)),
  },
  'solid-rock': { breakable: true, onDefenderFinal: (engine, me, move, attacker, { eff }) => (eff > 1 ? 0.75 : 1) },
  'snow-warning': setsWeather('hail'),
  reckless: { onBasePower: (engine, me, move) => (move.recoil ? 1.2 : 1) },
  'flower-gift': {
    breakable: true,
    onAttack: (engine, me, move) => (physical(move) && isSun(engine.weather()) ? 1.5 : 1),
    onDefense: (engine, me, move) => (special(move) && isSun(engine.weather()) ? 1.5 : 1),
    onStart: (engine, me) => cherrimForm(engine, me),
    onWeatherChange: (engine, me) => cherrimForm(engine, me),
  },
  'bad-dreams': {
    onEndTurn(engine, me) {
      const foe = engine.foe(me);
      if (foe && engine.asleep(foe)) {
        engine.show(me);
        engine.damage(foe, fraction(foe, 1 / 8), 'ability');
      }
    },
  },
  'sheer-force': { sheerForce: true, onBasePower: (engine, me, move) => (move.secondary?.length ? 1.3 : 1) },
  contrary: {
    breakable: true,
    onChangeBoost(engine, me, changes) {
      for (const key of Object.keys(changes)) changes[key] = -changes[key];
    },
  },
  defiant: {
    onAfterEachBoost(engine, me, changes, source) {
      if (source && source !== me && Object.values(changes).some((v) => v < 0)) engine.boost(me, { atk: 2 }, me, { ability: me });
    },
  },
  defeatist: { onAttack: (engine, me) => (me.hp <= me.stats.hp / 2 ? 0.5 : 1) },
  'cursed-body': {
    onDamagingHit(engine, me, move, attacker) {
      if (attacker.hp > 0 && move.key && !attacker.volatiles.disabled && engine.rand() < 0.3)
        engine.addVolatile(attacker, 'disable', me, { ability: me, move });
    },
  },
  'weak-armor': hitBoost(physical, { def: -1, spd: 2 }),
  multiscale: { breakable: true, onDefenderFinal: (engine, me) => (full(me) ? 0.5 : 1) },
  'toxic-boost': { onBasePower: (engine, me, move) => (poisoned(me.status) && physical(move) ? 1.5 : 1) },
  'flare-boost': { onBasePower: (engine, me, move) => (me.status === 'brn' && special(move) ? 1.5 : 1) },
  moody: {
    onEndTurn(engine, me) {
      const stats: BoostKey[] = ['atk', 'def', 'satk', 'sdef', 'spd'];
      const up = stats.filter((k) => me.boosts[k] < 6);
      if (!up.length) return;
      const raised = up[Math.floor(engine.rand() * up.length)];
      const down = stats.filter((k) => k !== raised && me.boosts[k] > -6);
      const lowered = down.length ? down[Math.floor(engine.rand() * down.length)] : null;
      engine.show(me);
      engine.boost(me, lowered ? { [raised]: 2, [lowered]: -1 } : { [raised]: 2 }, me);
    },
  },
  overcoat: { breakable: true, weatherImmune: ['sand', 'snow', 'hail'] },
  'poison-touch': {
    onAfterMoveHit(engine, me, move, target) {
      if (target.hp > 0 && contact(engine, move, me) && engine.rand() < 0.3) engine.setStatus(target, 'psn', me, { ability: me });
    },
  },
  regenerator: { onSwitchOut: (engine, me) => me.hp > 0 && engine.heal(me, fraction(me, 1 / 3), { silent: true }) },
  'big-pecks': blockDrops(['def']),
  'sand-rush': merge(weatherSpeed((w) => w === 'sand'), { weatherImmune: ['sand'] }),
  analytic: { onBasePower: (engine, me, move, target) => (engine.hasMoved(target) ? 1.3 : 1) },
  illusion: {
    noTrace: true,
    disguisesOnEntry: true,
    onDamagingHit(engine, me) {
      if (!engine.breakIllusion(me)) return;
      engine.show(me, 'illusionBroken', { look: engine.look(me) });
    },
  },
  imposter: {
    noTrace: true,
    onStart(engine, me) {
      const foe = engine.foe(me);
      if (foe && !foe.volatiles.transformed && !foe.volatiles.illusion) {
        engine.show(me);
        engine.transform(me, foe);
      }
    },
  },
  mummy: {
    onDamagingHit(engine, me, move, attacker) {
      if (!contact(engine, move, attacker) || !attacker.ability || attacker.ability === 'mummy' || EFFECTS[attacker.ability]?.unsuppressable) return;
      engine.show(me);
      engine.setAbility(attacker, 'mummy');
    },
  },
  moxie: onKoBoost({ atk: 1 }),
  justified: hitBoost((m) => m.type === 'dark', { atk: 1 }),
  rattled: merge(hitBoost((m) => ['bug', 'ghost', 'dark'].includes(m.type as string), { spd: 1 }), {
    onAfterEachBoost(engine, me, changes, source, effect) {
      if (effect === 'intimidate') engine.boost(me, { spd: 1 }, me, { ability: me });
    },
  }),
  'sap-sipper': absorb('grass', { boost: { atk: 1 } }),
  prankster: { onModifyPriority: (engine, me, move, prio) => (move.category === 'status' ? prio + 1 : prio) },
  'sand-force': {
    weatherImmune: ['sand'],
    onBasePower: (engine, me, move) => (engine.weather() === 'sand' && ['rock', 'ground', 'steel'].includes(move.type as string) ? 1.3 : 1),
  },
  'iron-barbs': hurtAttackerOnContact,
  'zen-mode': formChanger((engine, me) => {
    if (me.speciesId !== 555 || me.hp <= 0) return;
    const want = me.hp <= me.stats.hp / 2 ? 'darmanitan-zen' : null;
    if ((me.form ?? null) !== want) {
      engine.show(me, want ? 'formZen' : 'formStandard');
      engine.changeForm(me, want);
    }
  }),
  'victory-star': { onAccuracy: (engine, me, move, target, acc) => acc * 1.1 },
  turboblaze: merge(announce('turboblaze'), { moldBreaker: true }),
  teravolt: merge(announce('teravolt'), { moldBreaker: true }),
  'aroma-veil': blockStatus((s) => s === 'disable'),
  'flower-veil': merge(
    {
      breakable: true,
      onSetStatus(engine, me, status, source) {
        if (!me.types.includes('grass') || !isMajorStatus(status) || !source || source === me) return true;
        engine.show(me);
        return false;
      },
    },
    {
      onTryBoost(engine, me, changes, source) {
        if (!me.types.includes('grass') || !source || source === me) return;
        let blocked = false;
        for (const key of Object.keys(changes)) {
          if (changes[key] < 0) {
            delete changes[key];
            blocked = true;
          }
        }
        if (blocked) engine.show(me, 'noDrop');
      },
    },
  ),
  protean: changesTypeBeforeMoving(),
  'fur-coat': { breakable: true, onDefense: (engine, me, move) => (physical(move) ? 2 : 1) },
  bulletproof: {
    breakable: true,
    onTryHit(engine, me, move) {
      if (!has(move, 'bullet')) return false;
      engine.show(me);
      engine.immune(me);
      return true;
    },
  },
  competitive: {
    onAfterEachBoost(engine, me, changes, source) {
      if (source && source !== me && Object.values(changes).some((v) => v < 0)) engine.boost(me, { satk: 2 }, me, { ability: me });
    },
  },
  'strong-jaw': flagPower('bite', 1.5),
  refrigerate: skin('ice'),
  'sweet-veil': blockStatus((s) => s === 'slp'),
  'stance-change': {
    unsuppressable: true,
    noTrace: true,
    onBeforeMoveForm(engine, me, move) {
      if (me.speciesId !== 681) return;
      const want = isAttack(move) ? 'aegislash-blade' : null;
      if ((me.form ?? null) !== want) {
        engine.show(me, want ? 'formBlade' : 'formShield');
        engine.changeForm(me, want);
      }
    },
  },
  'gale-wings': { onModifyPriority: (engine, me, move, prio) => (move.type === 'flying' && full(me) ? prio + 1 : prio) },
  'mega-launcher': flagPower('pulse', 1.5),
  'grass-pelt': { breakable: true, onDefense: (engine, me, move) => (engine.terrain() === 'grassy' && physical(move) ? 1.5 : 1) },
  'tough-claws': { onBasePower: (engine, me, move) => (contact(engine, move, me) ? 1.3 : 1) },
  pixilate: skin('fairy'),
  gooey: contactChance(1, (engine, me, attacker) => {
    engine.show(me);
    engine.boost(attacker, { spd: -1 }, me);
  }),
  aerilate: skin('flying'),
  'parental-bond': { parentalBond: true },
  'dark-aura': announce('darkAura'),
  'fairy-aura': announce('fairyAura'),
  'aura-break': announce('auraBreak'),
  'primordial-sea': setsWeather('heavyrain'),
  'desolate-land': setsWeather('harshsun'),
  'delta-stream': setsWeather('winds'),
  stamina: hitBoost(isAttack, { def: 1 }),
  'wimp-out': escapesBelowHalf(),
  'emergency-exit': escapesBelowHalf(),
  'water-compaction': hitBoost((m) => m.type === 'water', { def: 2 }),
  merciless: { onCritStage: (engine, me, move, target, stage) => (poisoned(target.status) ? 3 : stage) },
  'shields-down': merge(
    formChanger((engine, me) => {
      if (me.speciesId !== 774 || me.hp <= 0) return;
      const want = me.hp > me.stats.hp / 2 ? null : miniorCore(me);
      if ((me.form ?? null) !== want) {
        engine.show(me, want ? 'formCore' : 'formMeteor');
        engine.changeForm(me, want);
      }
    }),
    {
      onSetStatus(engine, me, status) {
        if (me.speciesId !== 774 || me.form || !isMajorStatus(status)) return true;
        engine.show(me);
        return false;
      },
    },
  ),
  stakeout: { onBasePower: (engine, me, move, target) => (target.volatiles.enteredTurn === engine.battle.turn ? 2 : 1) },
  'water-bubble': merge(blockStatus((s) => s === 'brn'), {
    onIncoming: (engine, me, move) => (move.type === 'fire' ? 0.5 : 1),
    onBasePower: (engine, me, move) => (move.type === 'water' ? 2 : 1),
  }),
  steelworker: typePower('steel', 1.5),
  berserk: {
    onDamagingHit(engine, me, move, attacker, { before }) {
      if (droppedBelowHalf(me, before)) engine.boost(me, { satk: 1 }, me, { ability: me });
    },
  },
  'slush-rush': weatherSpeed(isIcy),
  'long-reach': {},
  'suction-cups': { suctionCups: true },
  infiltrator: { infiltrates: true },
  'screen-cleaner': {
    onStart(engine, me) {
      const sides = [0, 1].filter((s) => Object.keys(engine.battle.sides[s].screens).length);
      if (!sides.length) return;
      engine.show(me);
      for (const sideIndex of sides) engine.clearScreens(sideIndex, 'cleaner');
    },
  },
  'liquid-voice': {
    onModifyMove(engine, me, move) {
      if (has(move, 'sound')) move.type = 'water';
    },
  },
  triage: { onModifyPriority: (engine, me, move, prio) => (has(move, 'heal') || move.drain ? prio + 3 : prio) },
  galvanize: skin('electric'),
  'surge-surfer': { onSpeed: (engine, me, spd) => (engine.terrain() === 'electric' ? spd * 2 : spd) },
  schooling: formChanger((engine, me) => {
    if (me.speciesId !== 746 || me.hp <= 0 || me.level < 20) return;
    const want = me.hp > me.stats.hp / 4 ? 'wishiwashi-school' : null;
    if ((me.form ?? null) !== want) {
      engine.show(me, want ? 'formSchool' : 'formSolo');
      engine.changeForm(me, want);
    }
  }),
  disguise: {
    unsuppressable: true,
    noTrace: true,
    breakable: true,
    onDamage(engine, me, move, attacker, dmg) {
      if (me.speciesId !== 778 || me.disguiseBusted || !isAttack(move)) return dmg;
      me.disguiseBusted = true;
      engine.show(me, 'disguise');
      engine.changeForm(me, 'mimikyu-busted', { permanent: true });
      return fraction(me, 1 / 8);
    },
  },
  'battle-bond': {
    onFoeFaint(engine, me) {
      if (me.battleBondUsed) return;
      me.battleBondUsed = true;
      engine.show(me);
      engine.boost(me, { atk: 1, satk: 1, spd: 1 }, me);
    },
  },
  'power-construct': formChanger((engine, me) => {
    if (me.speciesId !== 718 || me.hp <= 0 || me.form === 'zygarde-complete' || me.hp > me.stats.hp / 2) return;
    engine.show(me, 'formComplete');
    engine.changeForm(me, 'zygarde-complete', { permanent: true });
  }),
  corrosion: { corrosion: true },
  comatose: {
    unsuppressable: true,
    noTrace: true,
    comatose: true,
    onStart: (engine, me) => engine.show(me, 'comatose'),
    onSetStatus(engine, me, status) {
      if (!isMajorStatus(status)) return true;
      engine.show(me);
      return false;
    },
  },
  'queenly-majesty': blocksPriority(),
  'innards-out': {
    onFaint(engine, me, attacker, move, dmg) {
      if (!attacker || attacker.hp <= 0 || !dmg) return;
      engine.show(me);
      engine.damage(attacker, dmg, 'ability');
    },
  },
  dancer: {
    onFoeMove(engine, me, foe, move) {
      if (!has(move, 'dance') || me.hp <= 0 || move.kind !== 'status' || move.target !== 'self' || !move.boosts) return;
      engine.show(me);
      engine.boost(me, move.boosts, me);
    },
  },
  fluffy: {
    breakable: true,
    onIncoming(engine, me, move, attacker) {
      let multiplier = contact(engine, move, attacker) ? 0.5 : 1;
      if (move.type === 'fire') multiplier *= 2;
      return multiplier;
    },
  },
  dazzling: blocksPriority(),
  'soul-heart': {
    onAnyFaint(engine, me, fainted) {
      if (fainted !== me && me.hp > 0) engine.boost(me, { satk: 1 }, me, { ability: me });
    },
  },
  'tangling-hair': contactChance(1, (engine, me, attacker) => {
    engine.show(me);
    engine.boost(attacker, { spd: -1 }, me);
  }),
  'beast-boost': onKoBoost((me) => ({ [highestStat(me)]: 1 })),
  'electric-surge': setsTerrain('electric'),
  'psychic-surge': setsTerrain('psychic'),
  'misty-surge': setsTerrain('misty'),
  'grassy-surge': setsTerrain('grassy'),
  'full-metal-body': blockDrops(null, { breakable: false }),
  'shadow-shield': { onDefenderFinal: (engine, me) => (full(me) ? 0.5 : 1) },
  'prism-armor': { onDefenderFinal: (engine, me, move, attacker, { eff }) => (eff > 1 ? 0.75 : 1) },
  neuroforce: { onAttackerFinal: (engine, me, move, target, { eff }) => (eff > 1 ? 1.25 : 1) },
  'intrepid-sword': oncePerBattle({ atk: 1 }),
  'dauntless-shield': oncePerBattle({ def: 1 }),
  libero: changesTypeBeforeMoving(),
  'cotton-down': {
    onDamagingHit(engine, me, move, attacker) {
      if (attacker.hp <= 0) return;
      engine.show(me);
      engine.boost(attacker, { spd: -1 }, me);
    },
  },
  'mirror-armor': {
    breakable: true,
    onTryBoost(engine, me, changes, source) {
      if (!source || source === me) return;
      const reflected: BoostChanges = {};
      for (const key of Object.keys(changes)) {
        if (changes[key] < 0) {
          reflected[key] = changes[key];
          delete changes[key];
        }
      }
      if (!Object.keys(reflected).length) return;
      engine.show(me);
      if (source.hp > 0) engine.boost(source, reflected, me, { effect: 'mirror-armor' });
    },
  },
  'gulp-missile': {
    unsuppressable: true,
    noTrace: true,
    onAfterMove(engine, me, move) {
      if (me.speciesId !== 845 || me.volatiles.gulp || (move.key !== 'surf' && move.key !== 'dive')) return;
      me.volatiles.gulp = me.hp > me.stats.hp / 2 ? 'arrokuda' : 'pikachu';
      engine.show(me, me.volatiles.gulp === 'arrokuda' ? 'gulpArrokuda' : 'gulpPikachu');
      engine.changeForm(me, me.volatiles.gulp === 'arrokuda' ? 'cramorant-gulping' : 'cramorant-gorging');
    },
    onDamagingHit(engine, me, move, attacker) {
      if (!me.volatiles.gulp || attacker.hp <= 0) return;
      const prey = me.volatiles.gulp;
      delete me.volatiles.gulp;
      engine.show(me, 'gulpSpit');
      engine.changeForm(me, null);
      engine.damage(attacker, fraction(attacker, 1 / 4), 'ability');
      if (attacker.hp <= 0) return;
      if (prey === 'arrokuda') engine.boost(attacker, { def: -1 }, me);
      else engine.setStatus(attacker, 'par', me);
    },
  },
  'hunger-switch': {
    noTrace: true,
    onEndTurn(engine, me) {
      if (me.speciesId !== 877 || me.hp <= 0) return;
      engine.show(me, me.form ? 'formFullBelly' : 'formHangry');
      engine.changeForm(me, me.form ? null : 'morpeko-hangry');
    },
  },
  'steam-engine': hitBoost((m) => m.type === 'fire' || m.type === 'water', { spd: 6 }),
  'punk-rock': {
    breakable: true,
    onBasePower: (engine, me, move) => (has(move, 'sound') ? 1.3 : 1),
    onIncoming: (engine, me, move) => (has(move, 'sound') ? 0.5 : 1),
  },
  'sand-spit': {
    onDamagingHit(engine, me) {
      if (engine.weather() !== 'sand') engine.setWeather('sand', me);
    },
  },
  'ice-scales': { breakable: true, onIncoming: (engine, me, move) => (special(move) ? 0.5 : 1) },
  'ice-face': {
    unsuppressable: true,
    noTrace: true,
    breakable: true,
    onDamage(engine, me, move, attacker, dmg) {
      if (me.speciesId !== 875 || me.form || !physical(move)) return dmg;
      engine.show(me, 'iceFaceBroken');
      engine.changeForm(me, 'eiscue-noice', { permanent: true });
      return 0;
    },
    onWeatherChange(engine, me) {
      if (me.speciesId === 875 && me.form === 'eiscue-noice' && isIcy(engine.weather())) {
        engine.show(me, 'iceFaceRestored');
        engine.changeForm(me, null, { permanent: true });
      }
    },
  },
  mimicry: {
    onStart: (engine, me) => mimicryType(engine, me),
    onTerrainChange: (engine, me) => mimicryType(engine, me),
  },
  'steely-spirit': typePower('steel', 1.5),
  'perish-body': {
    onDamagingHit(engine, me, move, attacker) {
      if (!contact(engine, move, attacker) || attacker.volatiles.perish || attacker.hp <= 0) return;
      engine.show(me);
      engine.addVolatile(attacker, 'perish', me);
      if (!me.volatiles.perish && me.hp > 0) engine.addVolatile(me, 'perish', me);
    },
  },
  'wandering-spirit': {
    onDamagingHit(engine, me, move, attacker) {
      if (!contact(engine, move, attacker) || !attacker.ability || EFFECTS[attacker.ability]?.unsuppressable || EFFECTS[attacker.ability]?.noTrace)
        return;
      engine.show(me);
      const theirs = attacker.ability;
      engine.setAbility(attacker, me.ability);
      engine.setAbility(me, theirs);
    },
  },
  'gorilla-tactics': {
    onAttack: (engine, me, move) => (physical(move) ? 1.5 : 1),
    onAfterMove(engine, me, move) {
      if (move.key && me.volatiles.lockedMove == null) me.volatiles.lockedMove = move.key;
    },
  },
  'neutralizing-gas': { unsuppressable: true, noTrace: true, onStart: (engine, me) => engine.show(me, 'neutralizingGas') },
  'pastel-veil': blockStatus(poisoned),
  'quick-draw': {
    onFractionalPriority(engine, me, move) {
      if (!isAttack(move) || engine.rand() >= 0.3) return 0;
      engine.show(me);
      return 1;
    },
  },
  transistor: typePower('electric', 1.3),
  'dragons-maw': typePower('dragon', 1.5),
  'chilling-neigh': onKoBoost({ atk: 1 }),
  'grim-neigh': onKoBoost({ satk: 1 }),
  'as-one-glastrier': merge(announce('asOne'), onKoBoost({ atk: 1 }), { unsuppressable: true, noTrace: true }),
  'as-one-spectrier': merge(announce('asOne'), onKoBoost({ satk: 1 }), { unsuppressable: true, noTrace: true }),
  'lingering-aroma': {
    onDamagingHit(engine, me, move, attacker) {
      if (!contact(engine, move, attacker)
        || !attacker.ability
        || attacker.ability === 'lingering-aroma'
        || EFFECTS[attacker.ability]?.unsuppressable)
        return;
      engine.show(me);
      engine.setAbility(attacker, 'lingering-aroma');
    },
  },
  'seed-sower': {
    onDamagingHit(engine, me) {
      if (engine.terrain() !== 'grassy') engine.setTerrain('grassy', me);
    },
  },
  'thermal-exchange': merge(blockStatus((s) => s === 'brn'), hitBoost((m) => m.type === 'fire', { atk: 1 })),
  'anger-shell': {
    onDamagingHit(engine, me, move, attacker, { before }) {
      if (droppedBelowHalf(me, before)) {
        engine.show(me);
        engine.boost(me, { atk: 1, satk: 1, spd: 1, def: -1, sdef: -1 }, me);
      }
    },
  },
  'purifying-salt': merge(blockStatus(isMajorStatus), { onIncoming: (engine, me, move) => (move.type === 'ghost' ? 0.5 : 1) }),
  'well-baked-body': absorb('fire', { boost: { def: 2 } }),
  'wind-rider': {
    breakable: true,
    onTryHit(engine, me, move) {
      if (!has(move, 'wind') || !isAttack(move)) return false;
      engine.show(me);
      engine.boost(me, { atk: 1 }, me);
      return true;
    },
  },
  'guard-dog': {
    breakable: true,
    onTryBoost(engine, me, changes, source, effect) {
      if (effect === 'intimidate' && changes.atk < 0) {
        changes.atk = 1;
        engine.show(me);
      }
    },
  },
  'rocky-payload': typePower('rock', 1.5),
  'wind-power': {
    onDamagingHit(engine, me, move) {
      if (has(move, 'wind') && me.hp > 0) engine.addVolatile(me, 'charge', me, { ability: me });
    },
  },
  'zero-to-hero': {
    unsuppressable: true,
    noTrace: true,
    onSwitchOut(engine, me) {
      if (me.speciesId === 964 && me.form !== 'palafin-hero') me.heroPending = true;
    },
    onStart(engine, me) {
      if (me.speciesId !== 964 || !me.heroPending || me.form === 'palafin-hero') return;
      me.heroPending = false;
      engine.show(me, 'formHero');
      engine.changeForm(me, 'palafin-hero', { permanent: true });
    },
  },
  electromorphosis: {
    onDamagingHit(engine, me) {
      if (me.hp > 0) engine.addVolatile(me, 'charge', me, { ability: me });
    },
  },
  protosynthesis: paradox((E) => isSun(E.weather())),
  'quark-drive': paradox((E) => E.terrain() === 'electric'),
  'vessel-of-ruin': announce('ruin'),
  'sword-of-ruin': announce('ruin'),
  'tablets-of-ruin': announce('ruin'),
  'beads-of-ruin': announce('ruin'),
  'orichalcum-pulse': merge(setsWeather('sun'), { onAttack: (engine, me, move) => (physical(move) && isSun(engine.weather()) ? 4 / 3 : 1) }),
  'hadron-engine': merge(setsTerrain('electric'), { onAttack: (engine, me, move) => (special(move) && engine.terrain() === 'electric' ? 4 / 3 : 1) }),
  opportunist: {
    onFoeBoost(engine, me, foe, changes, effect) {
      if (effect === 'opportunist' || me.hp <= 0) return;
      const ups = Object.fromEntries(Object.entries(changes).filter(([, v]) => v > 0));
      if (!Object.keys(ups).length) return;
      engine.show(me);
      engine.boost(me, ups, me, { effect: 'opportunist' });
    },
  },
  sharpness: flagPower('slicing', 1.5),
  'supreme-overlord': {
    onStart(engine, me) {
      if (engine.faintedAllies(me) > 0) engine.show(me);
    },
    onBasePower: (engine, me) => 1 + 0.1 * Math.min(5, engine.faintedAllies(me)),
  },
  'toxic-debris': {
    onDamagingHit(engine, me, move, attacker) {
      if (!physical(move)) return;
      if (engine.addToxicSpikes(attacker)) engine.show(me);
    },
  },
  'armor-tail': blocksPriority(),
  'earth-eater': absorb('ground', { heal: 1 / 4 }),
  'mycelium-might': {
    onFractionalPriority: (engine, me, move) => (move.category === 'status' ? -1 : 0),
  },
  'minds-eye': merge(blockDrops(['acc']), { hitsGhost: true, ignoresEvasion: true }),
  'supersweet-syrup': {
    onStart(engine, me) {
      const foe = engine.foe(me);
      if (!foe || me.syrupUsed) return;
      me.syrupUsed = true;
      engine.show(me);
      engine.boost(foe, { eva: -1 }, me);
    },
  },
  'toxic-chain': {
    onAfterMoveHit(engine, me, move, target) {
      if (target.hp > 0 && engine.rand() < 0.3) engine.setStatus(target, 'tox', me, { ability: me });
    },
  },
  'tera-shift': {
    unsuppressable: true,
    noTrace: true,
    onStart(engine, me) {
      if (me.speciesId !== 1024 || me.form === 'terapagos-terastal') return;
      engine.show(me, 'formTerastal');
      engine.changeForm(me, 'terapagos-terastal', { permanent: true });
    },
  },
  'tera-shell': {
    breakable: true,
    onEffectiveness(engine, me, move, attacker, eff) {
      if (!full(me) || eff === 0) return eff;
      engine.show(me);
      return 0.5;
    },
  },
  'poison-puppeteer': {
    noTrace: true,
    onInflictStatus(engine, me, target, status) {
      if (poisoned(status) && target.hp > 0) engine.addVolatile(target, 'confusion', me);
    },
  },
  dragonize: skin('dragon'),
  'mega-sol': { actsInSun: true },
  'spicy-spray': {
    onDamagingHit(engine, me, move, attacker) {
      if (attacker.hp > 0) engine.setStatus(attacker, 'brn', me, { ability: me });
    },
  },
  eelevate: merge(
    {
      breakable: true,
      levitates: true,
      onTryHit(engine, me, move) {
        if (move.type !== 'ground' || !isAttack(move)) return false;
        engine.show(me);
        engine.immune(me);
        return true;
      },
    },
    onKoBoost((me) => ({ [highestStat(me)]: 1 })),
  ),
  'fire-mane': typePower('fire', 1.5),
  'aura-guard': { breakable: true, onIncoming: (engine, me, move, attacker) => (contact(engine, move, attacker) ? 0.5 : 1) },
};

function forecastType(engine: AbilityEngine, me: BattleFighter): void {
  if (me.speciesId !== 351) return;
  const weather = engine.weather();
  const want = isSun(weather) ? 'castform-sunny' : isRain(weather) ? 'castform-rainy' : isIcy(weather) ? 'castform-snowy' : null;
  if ((me.form ?? null) === want) return;
  engine.show(me);
  engine.changeForm(me, want);
}

function cherrimForm(engine: AbilityEngine, me: BattleFighter): void {
  if (me.speciesId !== 421) return;
  const want = isSun(engine.weather()) ? 'cherrim-sunshine' : null;
  if ((me.form ?? null) === want) return;
  engine.changeForm(me, want);
}

function mimicryType(engine: AbilityEngine, me: BattleFighter): void {
  const TERRAIN_TYPE: Record<string, string> = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };
  const type = TERRAIN_TYPE[engine.terrain() as string];
  const want = type ? [type] : me.baseTypes;
  if (want.join() !== me.types.join()) {
    engine.show(me);
    engine.setTypes(me, want);
  }
}

function changesTypeBeforeMoving(): AbilityEffect {
  return {
    onPrepareMove(engine, me, move) {
      if (me.volatiles.proteanUsed || !move.type || !isAttack(move)) return;
      if (me.types.length === 1 && me.types[0] === move.type) return;
      me.volatiles.proteanUsed = true;
      engine.show(me);
      engine.setTypes(me, [move.type]);
    },
  };
}

function blocksPriority(): AbilityEffect {
  return {
    breakable: true,
    onTryHit(engine, me, move, attacker) {
      if (move.effectivePriority <= 0 || attacker === me) return false;
      engine.show(me);
      engine.immune(me);
      return true;
    },
  };
}

function escapesBelowHalf(): AbilityEffect {
  return {
    onDamagingHit(engine, me, move, attacker, { before }) {
      if (droppedBelowHalf(me, before) && engine.hasBench(me)) {
        engine.show(me);
        me.volatiles.switchNow = true;
      }
    },
  };
}

function oncePerBattle(boost: Boosts): AbilityEffect {
  return {
    onStart(engine, me) {
      if (me.onceUsed) return;
      me.onceUsed = true;
      engine.show(me);
      engine.boost(me, boost, me);
    },
  };
}

function paradox(active: (engine: AbilityEngine) => boolean): AbilityEffect {
  const stat = (engine: AbilityEngine, me: BattleFighter): StatKey | null => {
    if (!active(engine)) return null;
    if (!me.volatiles.paradoxStat) {
      me.volatiles.paradoxStat = highestStat(me);
      engine.show(me, 'paradox', { stat: me.volatiles.paradoxStat });
    }
    return me.volatiles.paradoxStat;
  };
  const refresh = (engine: AbilityEngine, me: BattleFighter): void => {
    if (!active(engine)) delete me.volatiles.paradoxStat;
    else stat(engine, me);
  };
  return {
    noTrace: true,
    onStart: refresh,
    onWeatherChange: refresh,
    onTerrainChange: refresh,
    onAttack: (engine, me, move) => (active(engine) && me.volatiles.paradoxStat === (physical(move) ? 'atk' : 'satk') ? 1.3 : 1),
    onDefense: (engine, me, move) => (active(engine) && me.volatiles.paradoxStat === (physical(move) ? 'def' : 'sdef') ? 1.3 : 1),
    onSpeed: (engine, me, spd) => (active(engine) && me.volatiles.paradoxStat === 'spd' ? spd * 1.5 : spd),
  };
}

export const ABILITIES: Readonly<Record<string, AbilityEffect>> = EFFECTS;

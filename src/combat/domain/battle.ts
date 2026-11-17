// Turn-based battle engine. Pure: no I/O, randomness injected, so it can be tested and replayed.
import { buildFighter, effectiveness, formData, statsFor, speciesData, moveData, ALL_MOVE_IDS, STRUGGLE, type BoostKey, type Boosts, type MoveData, type Stats } from '../../catalog/domain/creatures.js';
import { MOVE_RULES } from '../../catalog/domain/move-rules.js';
import { abilityInfo, type AbilityInfo } from '../../catalog/domain/abilities.js';
import { ABILITIES, type AbilityEffect, type AbilityHook, type BoostChanges } from './ability-effects.js';
import type { Gender, Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { invalid } from '../../shared/domain/errors.js';
import type { Action, MoveAction, SwitchAction, SideAction, BattleEvent, BattleFighter, BattleMove, BattleSide, BattleSideInput, BattleState, Look, Mover } from './battle-types.js';

export type * from './battle-types.js';

/** A move as functions below accept it: a catalog move, or the copy being used this turn. */
type AnyMove = MoveData | BattleMove;

/** How many Pokémon fight on each side. */
export const BATTLE_SIZE = 3;
export const TURN_LIMIT = 100;
const STAGE_LIMIT = 6;
const FIELD_TURNS = 5;
const PRIMAL = new Set<string | null>(['heavyrain', 'harshsun', 'winds']);
const MAJOR = new Set(['brn', 'par', 'psn', 'tox', 'slp', 'frz']);
const SAND_PROOF = ['rock', 'ground', 'steel'];
const SCREEN_KINDS = ['reflect', 'lightscreen', 'auroraveil'];
const VEIL_WEATHER = new Set<string | null>(['hail', 'snow']);

const stageMult = (sideIndex: number): number => (sideIndex >= 0 ? (2 + sideIndex) / 2 : 2 / (2 - sideIndex));
const accuracyMult = (sideIndex: number): number => (sideIndex >= 0 ? (3 + sideIndex) / 3 : 3 / (3 - sideIndex));
const freshBoosts = (): Record<BoostKey, number> => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, acc: 0, eva: 0 });
const clamp = (value: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, value));
const isSun = (weather: string | null | undefined): boolean => weather === 'sun' || weather === 'harshsun';
const isRain = (weather: string | null | undefined): boolean => weather === 'rain' || weather === 'heavyrain';
const poisoned = (status: string | null | undefined): boolean => status === 'psn' || status === 'tox';
const isAttack = (move: AnyMove): boolean => move.category !== 'status';
export const STRUGGLE_MOVE = -1;
const HEALS_WITH_WEATHER: Record<string, string> = { synthesis: 'sun', 'morning-sun': 'sun', moonlight: 'sun', 'shore-up': 'sand' };

function prepare(entry: RosterEntry, levelCap: number | null): BattleFighter {
  const fighter = buildFighter(entry, { levelCap });
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

export function createBattle({ id, sides, levelCap = null, random = Math.random }: { id: string; sides: BattleSideInput[]; levelCap?: number | null; random?: () => number }): BattleState {
  // `intro` is filled right below, with the events of the leads coming out.
  const init: Omit<BattleState, 'intro'> = {
    id,
    levelCap,
    random,
    status: 'active',
    phase: 'choose',
    turn: 1,
    winner: null,
    field: { weather: null, weatherTurns: 0, weatherSetter: null, terrain: null, terrainTurns: 0, rooms: {} },
    sides: sides.map((s) => ({
      trainerId: s.trainerId,
      name: s.name,
      team: s.entries.slice(0, BATTLE_SIZE).map((e) => prepare(e, levelCap)),
      active: 0,
      action: null,
      mustSwitch: false,
      toxicSpikes: 0,
      screens: {},
      hazards: { spikes: 0, stealthrock: false, stickyweb: false },
      conds: {},
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

const emit = (battle: BattleState, event: BattleEvent): number => battle.events.push(event);
const activeOf = (battle: BattleState, sideIndex: number): BattleFighter => battle.sides[sideIndex].team[battle.sides[sideIndex].active];
const sideIndexOf = (battle: BattleState, fighter: BattleFighter): number => battle.sides.findIndex((side) => side.team.includes(fighter));
const onField = (battle: BattleState, fighter: BattleFighter): boolean => fighter.hp > 0 && activeOf(battle, sideIndexOf(battle, fighter)) === fighter;
const activeFighters = (battle: BattleState): BattleFighter[] => [0, 1].map((s) => activeOf(battle, s)).filter((f) => f.hp > 0);
const foeOf = (battle: BattleState, fighter: BattleFighter): BattleFighter | null => {
  const foe = activeOf(battle, 1 - sideIndexOf(battle, fighter));
  return foe.hp > 0 ? foe : null;
};
const nameOf = (fighter: BattleFighter): string => fighter.volatiles.illusion?.name ?? fighter.name;

// ---------- abilities ----------

function abilityKey(battle: BattleState, fighter: BattleFighter): string | null {
  const key = fighter.ability;
  const def = key && ABILITIES[key as string];
  if (!def) return null;
  if (fighter.volatiles.gastroAcid && !def.unsuppressable) return null;
  if (!def.unsuppressable && activeFighters(battle).some((o) => o !== fighter && o.ability === 'neutralizing-gas')) return null;
  if (def.breakable && battle.moldBreaker && battle.moldBreaker.target === fighter) return null;
  return key;
}

const abilityDef = (battle: BattleState, fighter: BattleFighter): AbilityEffect | null => ABILITIES[abilityKey(battle, fighter) as string] ?? null;
const run = (battle: BattleState, fighter: BattleFighter, hook: AbilityHook, ...args: unknown[]): unknown => (abilityDef(battle, fighter)?.[hook] as ((engine: AbilityEngine, me: BattleFighter, ...args: unknown[]) => unknown) | undefined)?.(engine(battle), fighter, ...args);
const flag = (battle: BattleState, fighter: BattleFighter, name: keyof AbilityEffect): boolean => !!abilityDef(battle, fighter)?.[name];

function mul(battle: BattleState, fighter: BattleFighter, hook: AbilityHook, ...args: unknown[]): number {
  const result = run(battle, fighter, hook, ...args);
  return typeof result === 'number' ? result : 1;
}

function chain(battle: BattleState, fighter: BattleFighter, hook: AbilityHook, value: number, ...args: unknown[]): number {
  const result = run(battle, fighter, hook, ...args, value);
  return typeof result === 'number' ? result : value;
}

const anyActiveHas = (battle: BattleState, key: string): boolean => activeFighters(battle).some((f) => abilityKey(battle, f) === key);
const otherActiveHas = (battle: BattleState, fighter: BattleFighter, key: string): boolean => activeFighters(battle).some((o) => o !== fighter && abilityKey(battle, o) === key);

interface BoostOptions {
  /** Highest stage a raise may reach (Belly Drum and friends go to +6 anyway). */
  cap?: number;
  /** Ability that caused the change, shown before it. */
  ability?: BattleFighter;
  /** What caused it (e.g. 'intimidate'), for the rules that react to it. */
  effect?: string;
}

const engines = new WeakMap<BattleState, AbilityEngine>();
function engine(battle: BattleState): AbilityEngine {
  let engine = engines.get(battle);
  if (engine) return engine;
  engine = makeEngine(battle);
  engines.set(battle, engine);
  return engine;
}

/** What ability rules may do to the battle (catalog/domain/abilities.ts). */
export type AbilityEngine = ReturnType<typeof makeEngine>;

function makeEngine(battle: BattleState) {
  return {
    battle,
    rand: () => battle.random(),
    foe: (fighter: BattleFighter) => foeOf(battle, fighter),
    has: (fighter: BattleFighter, key: string) => abilityKey(battle, fighter) === key,
    anyActiveHas: (key: string) => anyActiveHas(battle, key),
    show: (fighter: BattleFighter, note?: string | null, extra?: Record<string, unknown>) => showAbility(battle, fighter, note, extra),
    note: (fighter: BattleFighter, kind: string) => emit(battle, { t: kind, side: sideIndexOf(battle, fighter) }),
    boost: (fighter: BattleFighter, changes: Boosts, source?: BattleFighter | null, opts?: BoostOptions) => boost(battle, fighter, changes, source, opts),
    damage: (fighter: BattleFighter, amount: number, cause?: string) => hurt(battle, fighter, amount, cause),
    heal: (fighter: BattleFighter, amount: number, source?: BattleFighter | null, opts?: { silent?: boolean }) => heal(battle, fighter, amount, opts),
    setStatus: (fighter: BattleFighter, status: string, source?: BattleFighter | null, opts?: { ability?: BattleFighter }) => setStatus(battle, fighter, status, source, opts),
    addVolatile: (fighter: BattleFighter, kind: string, source?: BattleFighter | null, opts?: { ability?: BattleFighter; move?: { key: string; name: string } }) => addVolatile(battle, fighter, kind, source, opts),
    cure: (fighter: BattleFighter, announce?: boolean) => cure(battle, fighter, announce),
    weather: () => currentWeather(battle),
    terrain: () => battle.field.terrain,
    setWeather: (weather: string, source: BattleFighter | null) => setWeather(battle, weather, source),
    setTerrain: (terrain: string, source: BattleFighter | null) => setTerrain(battle, terrain, source),
    grounded: (fighter: BattleFighter) => grounded(battle, fighter),
    asleep: (fighter: BattleFighter) => fighter.status === 'slp' || flag(battle, fighter, 'comatose'),
    effectiveness: (move: AnyMove, attacker: BattleFighter, target: BattleFighter) => typeEffectiveness(battle, move, attacker, target),
    setTypes: (fighter: BattleFighter, types: readonly string[]) => setTypes(battle, fighter, types),
    setAbility: (fighter: BattleFighter, key: string | null) => setAbility(battle, fighter, key),
    hasMoved: (fighter: BattleFighter) => battle.moved.has(fighter),
    hasBench: (fighter: BattleFighter) => battle.sides[sideIndexOf(battle, fighter)].team.some((o) => o !== fighter && o.hp > 0),
    faintedAllies: (fighter: BattleFighter) => battle.sides[sideIndexOf(battle, fighter)].team.filter((o) => o !== fighter && o.hp <= 0).length,
    addToxicSpikes: (fighter: BattleFighter) => addToxicSpikes(battle, fighter),
    clearScreens: (sideIndex: number, cause: string) => clearScreens(battle, sideIndex, cause),
    transform: (fighter: BattleFighter, into: BattleFighter) => transform(battle, fighter, into),
    changeForm: (fighter: BattleFighter, form: string | null, opts?: { permanent?: boolean }) => changeForm(battle, fighter, form, opts),
    breakIllusion: (fighter: BattleFighter) => breakIllusion(battle, fighter),
    look: (fighter: BattleFighter) => lookOf(fighter),
  };
}

const moveApis = new WeakMap<BattleState, MoveRuleApi>();
const HAZARD_MAX: Record<string, number> = { spikes: 3, toxicspikes: 2 };

function moveApi(battle: BattleState): MoveRuleApi {
  let api = moveApis.get(battle);
  if (api) return api;
  api = makeMoveApi(battle);
  moveApis.set(battle, api);
  return api;
}

/** What move rules may do to the battle (catalog/domain/move-rules.ts). */
export type MoveRuleApi = ReturnType<typeof makeMoveApi>;

function makeMoveApi(battle: BattleState) {
  const sideOf = (fighter: BattleFighter) => sideIndexOf(battle, fighter);
  const api = {
    battle,
    random: () => battle.random(),
    turn: () => battle.turn,
    emit: (event: BattleEvent) => emit(battle, event),
    sideOf,
    side: (sideIndex: number) => battle.sides[sideIndex],
    actives: () => activeFighters(battle),
    name: nameOf,
    hurt: (fighter: BattleFighter, amount: number, cause?: string) => hurt(battle, fighter, amount, cause),
    heal: (fighter: BattleFighter, amount: number) => heal(battle, fighter, amount),
    boost: (fighter: BattleFighter, changes: Boosts, source?: BattleFighter | null) => boost(battle, fighter, changes, source),
    setStatus: (fighter: BattleFighter, status: string, source?: BattleFighter | null) => setStatus(battle, fighter, status, source),
    cure: (fighter: BattleFighter) => cure(battle, fighter),
    addVolatile: (fighter: BattleFighter, kind: string, source?: BattleFighter | null, opts?: { ability?: BattleFighter; move?: { key: string; name: string } }) => addVolatile(battle, fighter, kind, source, opts),
    setTypes: (fighter: BattleFighter, types: readonly string[]) => setTypes(battle, fighter, types),
    changeAbility: (fighter: BattleFighter, key: string | null) => {
      setAbility(battle, fighter, key);
      run(battle, fighter, 'onStart');
    },
    transform: (fighter: BattleFighter, into: BattleFighter) => transform(battle, fighter, into),
    dragOut: (fighter: BattleFighter) => dragOut(battle, fighter),
    faint: (fighter: BattleFighter) => {
      fighter.hp = 0;
      faint(battle, fighter);
    },
    weather: () => currentWeather(battle),
    grounded: (fighter: BattleFighter) => grounded(battle, fighter),
    effectiveness: (type: string | null | undefined, types: readonly string[]) => effectiveness(type, types),
    speed: (fighter: BattleFighter) => speedOf(battle, fighter),
    flag: (fighter: BattleFighter, name: keyof AbilityEffect) => flag(battle, fighter, name),
    abilityDef: (key: string | null): AbilityEffect | undefined => ABILITIES[key as string],
    stageMult,
    weight: (fighter: BattleFighter): number => speciesData(fighter.speciesId)?.weight ?? 50,
    baseAttack: (fighter: BattleFighter): number | undefined => speciesData(fighter.speciesId)?.stats?.[1],
    moved: (fighter: BattleFighter) => battle.moved.has(fighter),
    chosen: (sideIndex: number): MoveData | null => battle.chosen?.[sideIndex] ?? null,
    lastMove: (): string | null => battle.lastMove ?? null,
    nothing: (fighter: BattleFighter, reason: string | null = null): false => {
      emit(battle, { t: 'nothing', side: sideOf(fighter), ...(reason ? { reason } : {}) });
      return false;
    },
    volatile: (fighter: BattleFighter, kind: string, extra: Record<string, unknown> = {}) => emit(battle, { t: 'volatile', side: sideOf(fighter), name: nameOf(fighter), kind, ...extra }),
    volatileEnd: (fighter: BattleFighter, kind: string, extra: Record<string, unknown> = {}) => emit(battle, { t: 'volatileEnd', side: sideOf(fighter), name: nameOf(fighter), kind, ...extra }),
    sideStart: (sideIndex: number, kind: string, extra: Record<string, unknown> = {}) => emit(battle, { t: 'sideStart', side: sideIndex, kind, ...extra }),
    fieldStart: (kind: string) => emit(battle, { t: 'fieldStart', kind }),
    fieldEnd: (kind: string) => emit(battle, { t: 'fieldEnd', kind }),
    setBoosts: (fighter: BattleFighter, boosts: Boosts): void => {
      fighter.boosts = { ...freshBoosts(), ...boosts };
      emit(battle, { t: 'boosts', side: sideOf(fighter), name: nameOf(fighter), boosts: { ...fighter.boosts } });
    },
    setStats: (fighter: BattleFighter, stats: Partial<Stats>): void => {
      fighter.stats = { ...fighter.stats, ...stats };
      emit(battle, { t: 'stats', side: sideOf(fighter), name: nameOf(fighter), stats: { ...fighter.stats } });
    },
    swapBoosts: (user: BattleFighter, target: BattleFighter, keys: BoostKey[]): boolean => {
      const next = (from: BattleFighter, to: BattleFighter) => ({ ...to.boosts, ...Object.fromEntries(keys.map((k) => [k, from.boosts[k]])) });
      const forA = next(target, user);
      const forC = next(user, target);
      api.setBoosts(user, forA);
      api.setBoosts(target, forC);
      return true;
    },
    splitStats: (user: BattleFighter, target: BattleFighter, keys: Exclude<keyof Stats, 'hp'>[]): boolean => {
      const avg = Object.fromEntries(keys.map((k) => [k, Math.floor((user.stats[k] + target.stats[k]) / 2)]));
      api.setStats(user, avg);
      api.setStats(target, avg);
      return true;
    },
    protect: (fighter: BattleFighter, kind: string): boolean => {
      const stalls = fighter.volatiles.stall ?? 0;
      if (stalls > 0 && battle.random() >= 1 / 3 ** stalls) {
        delete fighter.volatiles.stall;
        return api.nothing(fighter);
      }
      fighter.volatiles.stall = stalls + 1;
      if (kind === 'endure') fighter.volatiles.endure = battle.turn;
      else fighter.volatiles.protect = { turn: battle.turn, kind };
      emit(battle, { t: 'protect', side: sideOf(fighter), name: nameOf(fighter), kind });
      return true;
    },
    guard: (fighter: BattleFighter, kind: string): boolean => {
      const conds = battle.sides[sideOf(fighter)].conds;
      if (kind === 'quickguard' || kind === 'wideguard') {
        const stalls = fighter.volatiles.stall ?? 0;
        if (stalls > 0 && battle.random() >= 1 / 3 ** stalls) {
          delete fighter.volatiles.stall;
          return api.nothing(fighter);
        }
        fighter.volatiles.stall = stalls + 1;
      }
      conds[kind] = battle.turn;
      emit(battle, { t: 'sideStart', side: sideOf(fighter), kind });
      return true;
    },
    hazard: (fighter: BattleFighter, kind: string): boolean => {
      const sideIndex = 1 - sideOf(fighter);
      const side = battle.sides[sideIndex];
      if (kind === 'toxicspikes') {
        if (side.toxicSpikes >= HAZARD_MAX.toxicspikes) return api.nothing(fighter);
        side.toxicSpikes += 1;
        emit(battle, { t: 'hazard', side: sideIndex, layers: side.toxicSpikes });
        return true;
      }
      const hazards = side.hazards as unknown as Record<string, number | boolean>;
      const cur = hazards[kind];
      if (kind === 'spikes' ? (cur as number) >= HAZARD_MAX.spikes : cur) return api.nothing(fighter);
      hazards[kind] = kind === 'spikes' ? (cur as number) + 1 : true;
      emit(battle, { t: 'sideStart', side: sideIndex, kind, ...(kind === 'spikes' ? { layers: side.hazards.spikes } : {}) });
      return true;
    },
    clearHazards: (sideIndex: number) => clearHazards(battle, sideIndex),
    courtChange: (): boolean => {
      const [first, second] = battle.sides;
      const swap = <K extends 'hazards' | 'conds' | 'screens' | 'toxicSpikes'>(key: K) => ([first[key], second[key]] = [second[key], first[key]]);
      for (const key of ['hazards', 'conds', 'screens', 'toxicSpikes'] as const) swap(key);
      emit(battle, { t: 'courtChange' });
      return true;
    },
    cureTeam: (fighter: BattleFighter): boolean => {
      let did = false;
      for (const ally of battle.sides[sideOf(fighter)].team) {
        if (ally.hp > 0 && ally.status) {
          if (ally === activeOf(battle, sideOf(fighter))) cure(battle, ally);
          else {
            ally.status = null;
            ally.statusTurns = 0;
          }
          did = true;
        }
      }
      if (did) emit(battle, { t: 'teamCured', side: sideOf(fighter) });
      return did || api.nothing(fighter);
    },
    switchOut: (fighter: BattleFighter, pass: { boosts?: boolean; volatiles?: boolean; substitute?: number } | null = null): void => {
      fighter.volatiles.switchNow = true;
      if (pass) {
        const kept: NonNullable<BattleSide['pass']> = {};
        if (pass.boosts) kept.boosts = { ...fighter.boosts };
        if (pass.volatiles) for (const key of ['confusion', 'focusEnergy', 'perish', 'leechSeed', 'curse', 'ingrain', 'aquaRing', 'magnetRise', 'substitute', 'trappedBy', 'gastroAcid']) if (fighter.volatiles[key]) kept[key] = fighter.volatiles[key];
        if (pass.substitute) kept.substitute = pass.substitute;
        battle.sides[sideOf(fighter)].pass = kept;
      }
    },
    sacrifice: (fighter: BattleFighter, kind: string): boolean => {
      if (!battle.sides[sideOf(fighter)].team.some((o) => o !== fighter && o.hp > 0)) return api.nothing(fighter, 'noBench');
      battle.sides[sideOf(fighter)].healingWish = kind;
      api.faint(fighter);
      return true;
    },
    revive: (fighter: BattleFighter): boolean => {
      const team = battle.sides[sideOf(fighter)].team;
      const down = team.map((o, i) => i).filter((i) => team[i].hp <= 0);
      if (!down.length) return api.nothing(fighter, 'noFainted');
      const slot = down[Math.floor(battle.random() * down.length)];
      const revived = team[slot];
      revived.hp = Math.floor(revived.stats.hp / 2);
      revived.fainted = false;
      revived.status = null;
      emit(battle, { t: 'revive', side: sideOf(fighter), index: slot, name: revived.name, hp: revived.hp, max: revived.stats.hp });
      return true;
    },
    future: (fighter: BattleFighter, move: BattleMove): boolean => {
      const sideIndex = 1 - sideOf(fighter);
      if (battle.sides[sideIndex].future) return api.nothing(fighter);
      battle.sides[sideIndex].future = { at: battle.turn + 2, user: fighter, move: { ...move, flags: [...move.flags] }, name: move.name };
      emit(battle, { t: 'futureStart', side: sideOf(fighter), name: nameOf(fighter), move: move.name });
      return true;
    },
    dropStockpile: (fighter: BattleFighter): void => {
      const pile = fighter.volatiles.stockpile;
      if (!pile) return;
      delete fighter.volatiles.stockpile;
      boost(battle, fighter, { def: -pile.def, sdef: -pile.sdef }, fighter);
      emit(battle, { t: 'volatileEnd', side: sideOf(fighter), name: nameOf(fighter), kind: 'stockpile' });
    },
    copyMove: (me: BattleFighter, foe: BattleFighter, move: BattleMove, { permanent }: { permanent?: boolean }): boolean => {
      const last = foe.volatiles.lastMove && moveData(foe.volatiles.lastMove);
      if (!last || !last.supported || me.moves.some((m) => m.key === last.key) || move.slot == null || (permanent ? last.flags.includes('nosketch') : last.flags.includes('failmimic'))) return api.nothing(me);
      if (!permanent) me.volatiles.mimic = { slot: move.slot, original: me.moves[move.slot] };
      me.moves = me.moves.map((m, i) => (i === move.slot ? last : m));
      me.pp[last.key] = permanent ? last.pp : Math.min(5, last.pp);
      emit(battle, { t: 'learned', side: sideOf(me), name: nameOf(me), move: last.name });
      return true;
    },
    callMove: (fighter: BattleFighter, key: string, opts?: { powerMult?: number; instructed?: boolean }) => runCalled(battle, fighter, key, opts),
    metronomePool: () => METRONOME_POOL(),
  };
  return api;
}

let metronomePool: string[] | null = null;
function METRONOME_POOL(): string[] {
  metronomePool ??= Object.keys(MOVE_RULES).concat(ALL_MOVE_IDS()).filter((id, i, all) => all.indexOf(id) === i).filter((id) => {
    const move = moveData(id);
    return move && move.supported && move.flags.includes('metronome') && !move.flags.includes('charge');
  });
  return metronomePool;
}

function showAbility(battle: BattleState, fighter: BattleFighter, note: string | null = null, extra: Record<string, unknown> & { copied?: string; move?: string } = {}): void {
  const info = abilityInfo(fighter.ability);
  fighter.revealedAbilities.add(fighter.ability);
  if (extra.copied) {
    const foe = foeOf(battle, fighter);
    if (foe && foe.ability === extra.copied) foe.revealedAbilities.add(extra.copied);
  }
  if (extra.move) {
    const foe = foeOf(battle, fighter);
    const known = foe?.moves.find((m) => m.name === extra.move);
    if (known) foe!.revealedMoves.add(known.key);
  }
  emit(battle, { t: 'ability', side: sideIndexOf(battle, fighter), name: nameOf(fighter), ability: info?.name ?? fighter.ability, info, ...(note ? { note } : {}), ...extra, ...(extra.copied ? { copied: abilityInfo(extra.copied)?.name } : {}) });
}

function setAbility(battle: BattleState, fighter: BattleFighter, key: string | null): void {
  fighter.ability = key;
  fighter.revealedAbilities.add(key);
  emit(battle, { t: 'abilityChange', side: sideIndexOf(battle, fighter), ability: abilityInfo(key) });
}

// ---------- stats, boosts and status ----------

function boost(battle: BattleState, fighter: BattleFighter, changes: Boosts, source: BattleFighter | null = null, opts: BoostOptions = {}): Boosts {
  if (fighter.hp <= 0) return {};
  const ch: BoostChanges = { ...changes } as BoostChanges;
  if (source && source !== fighter && battle.sides[sideIndexOf(battle, fighter)].conds.mist) for (const key of Object.keys(ch)) if (ch[key] < 0) delete ch[key];
  run(battle, fighter, 'onTryBoost', ch, source, opts.effect);
  run(battle, fighter, 'onChangeBoost', ch);
  const applied: Boosts = {};
  for (const [stat, by] of Object.entries(ch) as [BoostKey, number][]) {
    if (!by) continue;
    const cur = fighter.boosts[stat];
    const next = clamp(cur + by, -STAGE_LIMIT, by > 0 ? (opts.cap ?? STAGE_LIMIT) : STAGE_LIMIT);
    if (next !== cur) applied[stat] = next - cur;
  }
  const stats = Object.keys(applied) as BoostKey[];
  if (stats.length && opts.ability) showAbility(battle, opts.ability);
  for (const stat of stats) {
    fighter.boosts[stat] += applied[stat] as number;
    emit(battle, { t: 'boost', side: sideIndexOf(battle, fighter), stat, by: applied[stat], stage: fighter.boosts[stat] });
  }
  if (source && source !== fighter && ((Object.values(applied) as number[]).some((v) => v < 0) || opts.effect === 'intimidate')) run(battle, fighter, 'onAfterEachBoost', applied, source, opts.effect);
  const ups: Boosts = Object.fromEntries((Object.entries(applied) as [BoostKey, number][]).filter(([, v]) => v > 0));
  const foe = foeOf(battle, fighter);
  if (foe && Object.keys(ups).length) run(battle, foe, 'onFoeBoost', fighter, ups, opts.effect);
  return applied;
}

function grounded(battle: BattleState, fighter: BattleFighter): boolean {
  if (fighter.volatiles.smackedDown || fighter.volatiles.ingrain || battle.field.rooms.gravity) return true;
  if (fighter.volatiles.magnetRise || fighter.volatiles.telekinesis) return false;
  return !fighter.types.includes('flying') && !flag(battle, fighter, 'levitates');
}

function currentWeather(battle: BattleState): string | null {
  if (anyActiveHas(battle, 'cloud-nine') || anyActiveHas(battle, 'air-lock')) return null;
  return battle.field.weather;
}

function weatherFor(battle: BattleState, fighter: BattleFighter): string | null {
  const weather = currentWeather(battle);
  return !weather && flag(battle, fighter, 'actsInSun') ? 'harshsun' : weather;
}

function statusImmune(battle: BattleState, fighter: BattleFighter, status: string, source: BattleFighter | null): boolean {
  if (status === 'brn' && fighter.types.includes('fire')) return true;
  if (status === 'par' && fighter.types.includes('electric')) return true;
  if (status === 'frz' && (fighter.types.includes('ice') || isSun(currentWeather(battle)))) return true;
  if (poisoned(status) && (fighter.types.includes('poison') || fighter.types.includes('steel')) && !(source && flag(battle, source, 'corrosion'))) return true;
  if (grounded(battle, fighter) && battle.field.terrain === 'misty') return true;
  if (status === 'slp' && grounded(battle, fighter) && battle.field.terrain === 'electric') return true;
  return false;
}

function setStatus(battle: BattleState, fighter: BattleFighter, status: string, source: BattleFighter | null = null, opts: { ability?: BattleFighter } = {}): boolean {
  if (fighter.hp <= 0 || fighter.status || !MAJOR.has(status)) return false;
  if (statusImmune(battle, fighter, status, source)) return false;
  if (source && source !== fighter && battle.sides[sideIndexOf(battle, fighter)].conds.safeguard) return false;
  if (status === 'slp' && activeFighters(battle).some((o) => o.volatiles.uproar)) return false;
  if (run(battle, fighter, 'onSetStatus', status, source) === false) return false;
  if (opts.ability) showAbility(battle, opts.ability);
  fighter.status = status;
  fighter.statusTurns = status === 'slp' ? 1 + Math.floor(battle.random() * 3) : 0;
  emit(battle, { t: 'status', side: sideIndexOf(battle, fighter), name: nameOf(fighter), status });
  run(battle, fighter, 'onAfterSetStatus', status, source);
  if (source && source !== fighter) run(battle, source, 'onInflictStatus', fighter, status);
  return true;
}

function cure(battle: BattleState, fighter: BattleFighter, announce = true): void {
  if (!fighter.status) return;
  const status = fighter.status;
  fighter.status = null;
  fighter.statusTurns = 0;
  if (announce) emit(battle, { t: 'cure', side: sideIndexOf(battle, fighter), name: nameOf(fighter), status });
}

function addVolatile(battle: BattleState, fighter: BattleFighter, kind: string, source: BattleFighter | null = null, opts: { ability?: BattleFighter; move?: { key: string; name: string } } = {}): boolean {
  if (fighter.hp <= 0) return false;
  if (kind === 'confusion' && (fighter.volatiles.confusion || (grounded(battle, fighter) && battle.field.terrain === 'misty'))) return false;
  if (kind === 'attract' && (fighter.volatiles.attract || !fighter.gender || !source?.gender || fighter.gender === source.gender)) return false;
  if (kind === 'disable' && (fighter.volatiles.disabled || !opts.move?.key)) return false;
  if (kind === 'perish' && fighter.volatiles.perish) return false;
  if (kind === 'leechseed' && (fighter.volatiles.leechSeed || fighter.types.includes('grass'))) return false;
  if (run(battle, fighter, 'onSetStatus', kind, source) === false) return false;
  if (opts.ability) showAbility(battle, opts.ability);
  const sideIndex = sideIndexOf(battle, fighter);
  if (kind === 'flinch') fighter.volatiles.flinch = true;
  else if (kind === 'confusion') fighter.volatiles.confusion = 2 + Math.floor(battle.random() * 4);
  else if (kind === 'attract') fighter.volatiles.attract = source;
  else if (kind === 'disable') fighter.volatiles.disabled = { key: opts.move!.key, name: opts.move!.name, turns: 4 };
  else if (kind === 'perish') fighter.volatiles.perish = 4;
  else if (kind === 'charge') fighter.volatiles.charge = true;
  else if (kind === 'leechseed') fighter.volatiles.leechSeed = true;
  if (kind !== 'flinch') emit(battle, { t: 'volatile', side: sideIndex, name: nameOf(fighter), kind, ...(kind === 'disable' ? { move: opts.move!.name } : {}) });
  return true;
}

function hurt(battle: BattleState, fighter: BattleFighter, amount: number, cause?: string | null): number {
  if (fighter.hp <= 0) return 0;
  if (cause !== 'confusion' && flag(battle, fighter, 'noIndirectDamage')) return 0;
  const dealt = Math.min(fighter.hp, Math.max(1, Math.floor(amount)));
  fighter.hp -= dealt;
  emit(battle, { t: 'hurt', side: sideIndexOf(battle, fighter), amount: dealt, hp: fighter.hp, max: fighter.stats.hp, cause });
  return dealt;
}

function heal(battle: BattleState, fighter: BattleFighter, amount: number, opts: { silent?: boolean } = {}): number {
  if (fighter.hp <= 0 || fighter.hp >= fighter.stats.hp || fighter.volatiles.healBlock) return 0;
  const healed = Math.min(fighter.stats.hp - fighter.hp, Math.max(1, Math.floor(amount)));
  fighter.hp += healed;
  emit(battle, { t: 'heal', side: sideIndexOf(battle, fighter), amount: healed, hp: fighter.hp, max: fighter.stats.hp, ...(opts.silent ? { quiet: true } : {}) });
  return healed;
}

function setTypes(battle: BattleState, fighter: BattleFighter, types: readonly string[]): void {
  fighter.types = [...types];
  emit(battle, { t: 'types', side: sideIndexOf(battle, fighter), types: fighter.types });
}

function setWeather(battle: BattleState, weather: string, source: BattleFighter | null): boolean {
  const cur = battle.field.weather;
  if (cur === weather) return false;
  if (PRIMAL.has(cur) && !PRIMAL.has(weather)) return false;
  if (source) showAbility(battle, source);
  battle.field.weather = weather;
  battle.field.weatherTurns = PRIMAL.has(weather) ? Infinity : FIELD_TURNS;
  battle.field.weatherSetter = PRIMAL.has(weather) ? source : null;
  emit(battle, { t: 'weather', weather });
  for (const fighter of activeFighters(battle)) run(battle, fighter, 'onWeatherChange');
  return true;
}

function clearWeather(battle: BattleState): void {
  const weather = battle.field.weather;
  if (!weather) return;
  battle.field.weather = null;
  battle.field.weatherTurns = 0;
  battle.field.weatherSetter = null;
  emit(battle, { t: 'weatherEnd', weather });
  for (const fighter of activeFighters(battle)) run(battle, fighter, 'onWeatherChange');
}

function setTerrain(battle: BattleState, terrain: string, source: BattleFighter | null): boolean {
  if (battle.field.terrain === terrain) return false;
  if (source) showAbility(battle, source);
  battle.field.terrain = terrain;
  battle.field.terrainTurns = FIELD_TURNS;
  emit(battle, { t: 'terrain', terrain });
  for (const fighter of activeFighters(battle)) run(battle, fighter, 'onTerrainChange');
  return true;
}

function clearTerrain(battle: BattleState): void {
  const terrain = battle.field.terrain;
  if (!terrain) return;
  battle.field.terrain = null;
  battle.field.terrainTurns = 0;
  emit(battle, { t: 'terrainEnd', terrain });
  for (const fighter of activeFighters(battle)) run(battle, fighter, 'onTerrainChange');
}

function setScreen(battle: BattleState, sideIndex: number, kind: string): boolean {
  const side = battle.sides[sideIndex];
  if (side.screens[kind]) return false;
  if (kind === 'auroraveil' && !VEIL_WEATHER.has(currentWeather(battle))) return false;
  side.screens[kind] = FIELD_TURNS;
  emit(battle, { t: 'screen', side: sideIndex, screen: kind, turns: FIELD_TURNS });
  return true;
}

function clearScreens(battle: BattleState, sideIndex: number, cause: string): boolean {
  const side = battle.sides[sideIndex];
  const kinds = SCREEN_KINDS.filter((k) => side.screens[k]);
  for (const kind of kinds) {
    delete side.screens[kind];
    emit(battle, { t: 'screenEnd', side: sideIndex, screen: kind, cause });
  }
  return kinds.length > 0;
}

function clearHazards(battle: BattleState, sideIndex: number): boolean {
  const side = battle.sides[sideIndex];
  let did = clearToxicSpikes(battle, sideIndex);
  for (const kind of ['spikes', 'stealthrock', 'stickyweb']) {
    const hazards = side.hazards as unknown as Record<string, number | boolean>;
    if (!hazards[kind]) continue;
    hazards[kind] = kind === 'spikes' ? 0 : false;
    emit(battle, { t: 'sideEnd', side: sideIndex, kind });
    did = true;
  }
  return did;
}

function bypassesSub(battle: BattleState, me: BattleFighter, move: AnyMove): boolean {
  return move.flags.includes('sound') || move.flags.includes('bypasssub') || flag(battle, me, 'infiltrates');
}

function blockedByProtection(battle: BattleState, me: BattleFighter, target: BattleFighter | null, move: BattleMove): boolean {
  if (!target || target === me) return false;
  const sideIndex = sideIndexOf(battle, target);
  const conds = battle.sides[sideIndex].conds;
  const prot = target.volatiles.protect?.turn === battle.turn ? target.volatiles.protect.kind : null;
  const status = move.kind === 'status';
  const shielded = prot && move.flags.includes('protect') && !(status && ['kings-shield', 'obstruct', 'silk-trap'].includes(prot));
  const guarded =
    (conds.quickguard === battle.turn && move.effectivePriority > 0 && move.flags.includes('protect')) ||
    (conds.wideguard === battle.turn && move.spread) ||
    (conds.craftyshield === battle.turn && status) ||
    (conds.matblock === battle.turn && !status && move.flags.includes('protect'));
  if (!shielded && !guarded) return false;
  if (move.breaksProtect) {
    delete target.volatiles.protect;
    for (const key of ['quickguard', 'wideguard', 'craftyshield', 'matblock']) delete conds[key];
    emit(battle, { t: 'protectBroken', side: sideIndex, name: nameOf(target) });
    return false;
  }
  emit(battle, { t: 'protected', side: sideIndex, name: nameOf(target) });
  if (shielded && move.flags.includes('contact') && me.hp > 0) {
    if (prot === 'spiky-shield') hurt(battle, me, me.stats.hp / 8, 'spikyshield');
    if (prot === 'kings-shield') boost(battle, me, { atk: -1 }, target);
    if (prot === 'obstruct') boost(battle, me, { def: -2 }, target);
    if (prot === 'silk-trap') boost(battle, me, { spd: -1 }, target);
    if (prot === 'baneful-bunker') setStatus(battle, me, 'psn', target);
    if (prot === 'burning-bulwark') setStatus(battle, me, 'brn', target);
  }
  if (move.crashes && me.hp > 0) hurt(battle, me, me.stats.hp / 2, 'crash');
  return true;
}

function clearToxicSpikes(battle: BattleState, sideIndex: number): boolean {
  if (!battle.sides[sideIndex].toxicSpikes) return false;
  battle.sides[sideIndex].toxicSpikes = 0;
  emit(battle, { t: 'hazardEnd', side: sideIndex });
  return true;
}

function screened(battle: BattleState, me: BattleFighter, target: BattleFighter, move: AnyMove): boolean {
  if (flag(battle, me, 'infiltrates')) return false;
  const screens = battle.sides[sideIndexOf(battle, target)].screens;
  if (screens.auroraveil) return true;
  return move.category === 'physical' ? !!screens.reflect : !!screens.lightscreen;
}

function addToxicSpikes(battle: BattleState, fighter: BattleFighter): boolean {
  const side = battle.sides[sideIndexOf(battle, fighter)];
  if (side.toxicSpikes >= 2) return false;
  side.toxicSpikes += 1;
  emit(battle, { t: 'hazard', side: sideIndexOf(battle, fighter), layers: side.toxicSpikes });
  return true;
}

function lookOf(fighter: BattleFighter): Look {
  return { name: fighter.name, speciesName: fighter.speciesName, sprite: fighter.sprite, floats: fighter.floats, types: fighter.types, shiny: fighter.shiny, rarity: fighter.rarity };
}

function transform(battle: BattleState, fighter: BattleFighter, into: BattleFighter): void {
  fighter.volatiles.transformed = { types: fighter.types, stats: fighter.stats, moves: fighter.moves, sprite: fighter.sprite, floats: fighter.floats, pp: fighter.pp };
  fighter.types = [...into.types];
  fighter.stats = { ...into.stats, hp: fighter.stats.hp };
  fighter.moves = into.moves.map((m) => ({ ...m, flags: [...m.flags] }));
  fighter.pp = Object.fromEntries(fighter.moves.map((m) => [m.key, 5]));
  fighter.sprite = into.sprite;
  fighter.floats = into.floats;
  fighter.boosts = { ...into.boosts };
  fighter.ability = into.ability;
  emit(battle, { t: 'transform', side: sideIndexOf(battle, fighter), into: nameOf(into), sprite: fighter.sprite, floats: fighter.floats, types: fighter.types, stats: fighter.stats, moves: publicMoves(fighter), boosts: fighter.boosts });
}

function changeForm(battle: BattleState, fighter: BattleFighter, form: string | null, { permanent = false }: { permanent?: boolean } = {}): void {
  const data = form ? formData(form) : null;
  if (form && !data) return;
  const stats = data ? statsFor(data.base, fighter.ivs, fighter.level) : { ...fighter.speciesStats };
  const gained = stats.hp - fighter.stats.hp;
  fighter.stats = stats;
  fighter.hp = fighter.hp > 0 ? clamp(fighter.hp + gained, 1, stats.hp) : 0;
  fighter.types = data ? [...data.types] : [...fighter.speciesTypes];
  fighter.sprite = data ? data.sprite : String(fighter.speciesId);
  fighter.form = form;
  if (permanent) {
    fighter.baseStats = { ...stats };
    fighter.baseTypes = [...fighter.types];
    fighter.baseSprite = fighter.sprite;
    fighter.permanentForm = form;
  }
  emit(battle, { t: 'form', side: sideIndexOf(battle, fighter), form, stats, types: fighter.types, sprite: fighter.sprite, hp: fighter.hp, max: stats.hp });
}

function breakIllusion(battle: BattleState, fighter: BattleFighter): boolean {
  if (!fighter.volatiles.illusion) return false;
  delete fighter.volatiles.illusion;
  fighter.seenAs = null;
  return true;
}

function typeEffectiveness(battle: BattleState, move: AnyMove, attacker: BattleFighter, target: BattleFighter): number {
  if (!move.type) return 1;
  let eff = 1;
  for (const type of target.types) {
    let multiplier = effectiveness(move.type, [type]);
    if (move.extraType) multiplier *= effectiveness(move.extraType, [type]);
    if (multiplier === 0 && type === 'flying' && move.type === 'ground' && (move.hitsAirborne || target.volatiles.smackedDown || target.volatiles.ingrain || battle.field.rooms.gravity)) multiplier = 1;
    if (multiplier === 0 && type === 'ghost' && (move.type === 'normal' || move.type === 'fighting') && target.volatiles.foresight) multiplier = 1;
    if (multiplier === 0 && type === 'dark' && move.type === 'psychic' && target.volatiles.miracleEye) multiplier = 1;
    if (multiplier === 0 && type === 'ghost' && (move.type === 'normal' || move.type === 'fighting') && flag(battle, attacker, 'hitsGhost')) multiplier = 1;
    if (multiplier > 1 && type === 'flying' && currentWeather(battle) === 'winds') multiplier = 1;
    eff *= multiplier;
  }
  return eff;
}

function speedOf(battle: BattleState, fighter: BattleFighter): number {
  let spd = fighter.stats.spd * stageMult(fighter.boosts.spd);
  if (battle.sides[sideIndexOf(battle, fighter)]?.conds.tailwind) spd *= 2;
  spd = chain(battle, fighter, 'onSpeed', spd);
  if (fighter.status === 'par' && !flag(battle, fighter, 'ignoresParalysisSpeed')) spd *= 0.5;
  return spd;
}

// ---------- switching ----------

function prepareEntry(battle: BattleState, sideIndex: number): void {
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

function runEntry(battle: BattleState, sideIndex: number): void {
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
  if (hz.stealthrock && !flag(battle, fighter, 'noIndirectDamage')) hurt(battle, fighter, (fighter.stats.hp * effectiveness('rock', fighter.types)) / 8, 'stealthrock');
  if (hz.spikes && grounded(battle, fighter) && fighter.hp > 0) hurt(battle, fighter, fighter.stats.hp / [8, 6, 4][hz.spikes - 1], 'spikes');
  if (hz.stickyweb && grounded(battle, fighter) && fighter.hp > 0) {
    emit(battle, { t: 'stickyWeb', side: sideIndex, name: nameOf(fighter) });
    boost(battle, fighter, { spd: -1 }, null);
  }
  if (fighter.hp <= 0) return;
  if (side.toxicSpikes && grounded(battle, fighter)) {
    if (fighter.types.includes('poison')) {
      side.toxicSpikes = 0;
      emit(battle, { t: 'hazardEnd', side: sideIndex });
    } else setStatus(battle, fighter, side.toxicSpikes >= 2 ? 'tox' : 'psn', null);
  }
  run(battle, fighter, 'onStart');
}

function leave(battle: BattleState, fighter: BattleFighter): boolean {
  const hadGas = fighter.ability === 'neutralizing-gas';
  if (fighter.hp > 0) run(battle, fighter, 'onSwitchOut');
  if (fighter.volatiles.mimic) fighter.moves = fighter.moves.map((m, i) => (i === fighter.volatiles.mimic.slot ? fighter.volatiles.mimic.original : m));
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

function doSwitch(battle: BattleState, sideIndex: number, to: number): boolean {
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
  emit(battle, { t: 'switch', side: sideIndex, to, name: nameOf(fighter), from: old.seenAs?.name ?? old.name, forced: old.hp <= 0, card: fighterView(battle, sideIndex, to, true), seen: fighterView(battle, sideIndex, to, false) });
  return hadGas;
}

function entryOrder(battle: BattleState, sides: number[]): number[] {
  const gas = (sideIndex: number) => (activeOf(battle, sideIndex).ability === 'neutralizing-gas' ? 1 : 0);
  return [...sides].sort((x, y) => gas(y) - gas(x) || speedOf(battle, activeOf(battle, y)) - speedOf(battle, activeOf(battle, x)));
}

function wakeAbilities(battle: BattleState, except: BattleFighter): void {
  for (const fighter of activeFighters(battle)) if (fighter !== except) run(battle, fighter, 'onStart');
}

// ---------- faints ----------

function faint(battle: BattleState, fighter: BattleFighter, by: BattleFighter | null = null, move: BattleMove | null = null, lastHit = 0): void {
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

function settle(battle: BattleState): void {
  for (const sideIndex of [0, 1]) {
    const fighter = activeOf(battle, sideIndex);
    if (fighter.hp <= 0 && !fighter.fainted) faint(battle, fighter);
  }
}

// ---------- actions ----------

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

function moveBlocked(battle: BattleState, fighter: BattleFighter, move: AnyMove): string | null {
  if (fighter.volatiles.taunt && move.kind === 'status') return 'taunt';
  if (fighter.volatiles.torment && fighter.volatiles.lastMove === move.key && move.key !== STRUGGLE.key) return 'torment';
  if (fighter.volatiles.healBlock && (move.flags.includes('heal') || move.heal)) return 'healBlock';
  if (battle.field.rooms.gravity && move.flags.includes('gravity')) return 'gravity';
  const foe = foeOf(battle, fighter);
  if (foe?.volatiles.imprison && foe.moves.some((x) => x.key === move.key)) return 'imprison';
  if (move.flags.includes('cantusetwice') && fighter.volatiles.lastMove === move.key) return 'twice';
  return null;
}

function userCantUse(battle: BattleState, fighter: BattleFighter, move: AnyMove): boolean {
  if (move.id === 'last-resort') {
    const others = fighter.moves.filter((o) => o.key !== 'last-resort');
    return !others.length || others.some((o) => !fighter.volatiles.usedMoves?.has(o.key));
  }
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
    .filter(({ move }) => (fighter.pp[move.key] ?? 0) > 0 && fighter.volatiles.disabled?.key !== move.key && !moveBlocked(battle, fighter, move) && !userCantUse(battle, fighter, move));
  const lock = fighter.volatiles.lockedMove;
  if (lock != null && abilityKey(battle, fighter) === 'gorilla-tactics') {
    const locked = ok.filter(({ move }) => move.key === lock);
    if (locked.length) return locked;
  }
  return ok;
}

function encoreMove(fighter: BattleFighter): number | undefined {
  if (!fighter.volatiles.encore) return undefined;
  const slot = fighter.moves.findIndex((m) => m.key === fighter.volatiles.encore.key);
  return slot >= 0 && (fighter.pp[fighter.volatiles.encore.key] ?? 0) > 0 ? slot : undefined;
}

export function forcedAction(battle: BattleState, sideIndex: number): Action | null {
  if (!needsAction(battle, sideIndex) || battle.phase !== 'choose') return null;
  const fighter = activeOf(battle, sideIndex);
  const forced = fighter.volatiles.mustRecharge ?? fighter.volatiles.charging ?? fighter.volatiles.rampage?.move ?? fighter.volatiles.locked?.move;
  return forced == null ? null : { type: 'move', move: forced };
}

export function validActions(battle: BattleState, sideIndex: number): Action[] {
  if (!needsAction(battle, sideIndex)) return [];
  const side = battle.sides[sideIndex];
  const switches = side.team.map((f, i): SwitchAction => ({ type: 'switch', to: i })).filter((a) => a.to !== side.active && side.team[a.to].hp > 0);
  if (battle.phase === 'replace' || battle.phase === 'switchout') return switches;
  const fighter = side.team[side.active];
  const forced = fighter.volatiles.mustRecharge ?? fighter.volatiles.charging ?? fighter.volatiles.rampage?.move ?? fighter.volatiles.locked?.move;
  if (forced != null) return [{ type: 'move', move: forced }];
  const encored = encoreMove(fighter);
  const usable: Action[] = encored != null ? [{ type: 'move', move: encored }] : usableMoves(battle, fighter).map(({ slot }): Action => ({ type: 'move', move: slot }));
  const moves: Action[] = usable.length ? usable : [{ type: 'move', move: STRUGGLE_MOVE }];
  return moves.concat(trapped(battle, sideIndex) ? [] : switches);
}

const sameAction = (a: Action, b: Action): boolean => a.type === b.type && (a.type === 'move' ? a.move === (b as MoveAction).move : a.to === (b as SwitchAction).to);

// Returns the events of the resolved turn, or null if still waiting on the other side.
export function submit(battle: BattleState, sideIndex: number, action: Action | null | undefined): BattleEvent[] | null {
  if (!action || !validActions(battle, sideIndex).some((v) => sameAction(v, action))) throw invalid('Acción inválida');
  battle.sides[sideIndex].action = action.type === 'move' ? { type: 'move', move: action.move } : { type: 'switch', to: action.to };
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
      const move = action.move === STRUGGLE_MOVE ? STRUGGLE : me.moves[action.move];
      const score = move.kind === 'status' ? 15 + battle.random() * 30 : (move.power || 60) * effectiveness(move.type, foe.types) * ((move.accuracy ?? 100) / 100) * (move.type && me.types.includes(move.type) ? 1.5 : 1) + battle.random() * 10;
      if (score > bestScore) [best, bestScore] = [action, score];
    }
    return best;
  }
  return opts[Math.floor(battle.random() * opts.length)];
}

function canAct(battle: BattleState, me: BattleFighter, move: BattleMove): boolean {
  const sideIndex = sideIndexOf(battle, me);
  const cant = (reason: string) => {
    emit(battle, { t: 'cant', side: sideIndex, name: nameOf(me), reason });
    return false;
  };
  if (me.status === 'slp') {
    me.statusTurns -= flag(battle, me, 'wakesFaster') ? 2 : 1;
    if (me.statusTurns > 0) {
      if (!move.usableAsleep && !move.sleepUsable) return cant('slp');
    } else cure(battle, me);
  }
  if (me.status === 'frz') {
    if (!move.thaws && battle.random() >= 0.2) return cant('frz');
    cure(battle, me);
  }
  if (me.volatiles.flinch) {
    delete me.volatiles.flinch;
    cant('flinch');
    run(battle, me, 'onFlinch');
    return false;
  }
  if (run(battle, me, 'onBeforeMove', move) === false) return cant('truant');
  if (me.volatiles.confusion) {
    me.volatiles.confusion -= 1;
    if (!me.volatiles.confusion) emit(battle, { t: 'volatileEnd', side: sideIndex, name: nameOf(me), kind: 'confusion' });
    else {
      emit(battle, { t: 'confused', side: sideIndex, name: nameOf(me) });
      if (battle.random() < 1 / 3) {
        const attack = me.stats.atk * stageMult(me.boosts.atk);
        const defense = me.stats.def * stageMult(me.boosts.def);
        hurt(battle, me, (((2 * me.level) / 5 + 2) * 40 * (attack / defense)) / 50 + 2, 'confusion');
        return false;
      }
    }
  }
  if (me.volatiles.attract) {
    if (!onField(battle, me.volatiles.attract)) delete me.volatiles.attract;
    else {
      emit(battle, { t: 'infatuated', side: sideIndex, name: nameOf(me), by: nameOf(me.volatiles.attract) });
      if (battle.random() < 0.5) return cant('attract');
    }
  }
  if (me.status === 'par' && battle.random() < 0.25) return cant('par');
  return true;
}

function statusEffectOf(move: AnyMove): { effect: string; stat?: string } {
  if (move.heal || HEALS_WITH_WEATHER[move.id] || move.id === 'rest') return { effect: 'heal' };
  if (move.weather || move.terrain) return { effect: 'weather' };
  if (move.screen) return { effect: 'boost', stat: move.screen === 'lightscreen' ? 'sdef' : 'def' };
  if (move.target === 'self' && move.boosts) {
    const up = Object.entries(move.boosts).find(([, v]) => v > 0);
    return { effect: up ? 'boost' : 'debuff', stat: (up ?? Object.entries(move.boosts)[0])[0] };
  }
  return { effect: 'debuff' };
}

function spendPP(battle: BattleState, me: BattleFighter, move: AnyMove): void {
  if (move.key === STRUGGLE.key) return;
  const foe = foeOf(battle, me);
  me.pp[move.key] = Math.max(0, (me.pp[move.key] ?? 0) - (foe && abilityKey(battle, foe) === 'pressure' ? 2 : 1));
}

const FOCUS_MOVES = new Set(['focus-punch', 'shell-trap', 'beak-blast']);
const STATUSED = new Set<string | null>(['brn', 'par', 'psn', 'tox']);
const WEATHER_BALL: Record<string, string> = { sun: 'fire', harshsun: 'fire', rain: 'water', heavyrain: 'water', sand: 'rock', hail: 'ice', snow: 'ice' };
const TERRAIN_PULSE: Record<string, string> = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };

function moveOfAction(battle: BattleState, sideIndex: number, idx: number): MoveData {
  const fighter = activeOf(battle, sideIndex);
  return idx === STRUGGLE_MOVE ? STRUGGLE : fighter.moves[idx];
}

const asleep = (battle: BattleState, fighter: BattleFighter): boolean => fighter.status === 'slp' || flag(battle, fighter, 'comatose');

function failReason(battle: BattleState, me: BattleFighter, foe: BattleFighter | null, move: AnyMove, firstAction: boolean): string | null {
  const sideIndex = sideIndexOf(battle, me);
  if (move.firstTurnOnly && !firstAction) return 'notFirstTurn';
  if (move.id === 'sucker-punch' || move.id === 'thunderclap') {
    const theirs = battle.chosen?.[1 - sideIndex];
    if (!foe || battle.moved.has(foe) || !theirs || theirs.kind === 'status') return 'suckerPunch';
  }
  if (move.id === 'focus-punch' && me.turnHit) return 'lostFocus';
  if (move.id === 'shell-trap' && !me.turnHit?.physical) return 'shellTrap';
  if (move.id === 'last-resort') {
    const others = me.moves.filter((m) => m.key !== 'last-resort');
    if (!others.length || others.some((m) => !me.volatiles.usedMoves?.has(m.key))) return 'lastResort';
  }
  if (move.id === 'dream-eater' && (!foe || !asleep(battle, foe))) return 'notAsleep';
  if (move.id === 'snore' && !asleep(battle, me)) return 'notAsleepSelf';
  if (move.id === 'steel-roller' && !battle.field.terrain) return 'noTerrain';
  if (move.losesType && !me.types.includes(move.losesType)) return 'noType';
  if (move.id === 'synchronoise' && foe && !foe.types.some((t) => me.types.includes(t))) return 'noSharedType';
  if (move.id === 'captivate' && foe && (!foe.gender || !me.gender || foe.gender === me.gender)) return !foe.gender || !me.gender ? 'genderless' : 'sameGender';
  if (move.selfCost && me.hp <= Math.floor(me.stats.hp * move.selfCost)) return 'lowHp';
  return null;
}

export function moveWillFail(battle: BattleState, sideIndex: number, idx: number): boolean {
  if (idx === STRUGGLE_MOVE) return false;
  const me = activeOf(battle, sideIndex);
  const move = me.moves[idx];
  if (!move || move.id === 'sucker-punch' || move.id === 'thunderclap' || move.id === 'focus-punch' || move.id === 'shell-trap') return false;
  return failReason(battle, me, foeOf(battle, me), move, !me.volatiles.acted) !== null;
}

function adaptMove(battle: BattleState, me: BattleFighter, move: BattleMove): void {
  const weather = currentWeather(battle);
  if (move.id === 'weather-ball' && WEATHER_BALL[weather as string]) {
    move.type = WEATHER_BALL[weather as string];
    move.power = 100;
  }
  if (move.id === 'terrain-pulse' && battle.field.terrain && grounded(battle, me)) {
    move.type = TERRAIN_PULSE[battle.field.terrain];
    move.power = 100;
  }
  if (move.id === 'revelation-dance') move.type = me.types[0];
  if (move.id === 'photon-geyser' && me.stats.atk * stageMult(me.boosts.atk) > me.stats.satk * stageMult(me.boosts.satk)) move.category = 'physical';
}

function basePower(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove): number {
  const sideIndex = sideIndexOf(battle, me);
  const side = battle.sides[sideIndex];
  const power = move.power;
  switch (move.id) {
    case 'eruption':
    case 'water-spout':
    case 'dragon-energy':
      return Math.max(1, Math.floor((150 * me.hp) / me.stats.hp));
    case 'facade':
      return STATUSED.has(me.status) ? power * 2 : power;
    case 'hex':
      return target.status || flag(battle, target, 'comatose') ? power * 2 : power;
    case 'venoshock':
      return poisoned(target.status) ? power * 2 : power;
    case 'brine':
      return target.hp * 2 <= target.stats.hp ? power * 2 : power;
    case 'acrobatics':
      return power * 2;
    case 'payback':
      return battle.moved.has(target) ? power * 2 : power;
    case 'avalanche':
    case 'revenge':
      return me.turnHit?.by === target ? power * 2 : power;
    case 'assurance':
      return target.turnHit ? power * 2 : power;
    case 'stored-power':
    case 'power-trip':
      return power + 20 * Object.values(me.boosts).reduce((sum, v) => sum + Math.max(0, v), 0);
    case 'fury-cutter':
      return Math.min(160, power * 2 ** (me.volatiles.furyCutter ?? 0));
    case 'echoed-voice':
      return Math.min(200, power * (battle.echo?.turn === battle.turn ? battle.echo.count : 1));
    case 'retaliate':
      return side.faintedTurn === battle.turn - 1 ? power * 2 : power;
    case 'last-respects':
      return power + 50 * side.team.filter((o) => o !== me && o.hp <= 0).length;
    case 'rage-fist':
      return Math.min(350, power + 50 * (me.timesHit ?? 0));
    case 'rising-voltage':
      return battle.field.terrain === 'electric' && grounded(battle, target) ? power * 2 : power;
    case 'expanding-force':
      return battle.field.terrain === 'psychic' && grounded(battle, me) ? power * 1.5 : power;
    case 'psyblade':
      return battle.field.terrain === 'electric' ? power * 1.5 : power;
    case 'smelling-salts':
      return target.status === 'par' ? power * 2 : power;
    case 'wake-up-slap':
      return asleep(battle, target) ? power * 2 : power;
    case 'bolt-beak':
    case 'fishious-rend':
      return battle.moved.has(target) ? power : power * 2;
    case 'stomping-tantrum':
    case 'temper-flare':
      return me.volatiles.lastFailed ? power * 2 : power;
    case 'fickle-beam':
      return battle.random() < 0.3 ? power * 2 : power;
    default:
      return power;
  }
}

function afterHit(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove, total: number): void {
  const sideIndex = sideIndexOf(battle, me);
  if (target.hp > 0) {
    if (move.id === 'smelling-salts' && target.status === 'par') cure(battle, target);
    if (move.id === 'wake-up-slap' && target.status === 'slp') cure(battle, target);
    if (move.id === 'clear-smog' && Object.values(target.boosts).some(Boolean)) {
      target.boosts = freshBoosts();
      emit(battle, { t: 'boostsReset', side: 1 - sideIndex, name: nameOf(target) });
    }
    if (move.grounds && !target.volatiles.smackedDown && (target.types.includes('flying') || flag(battle, target, 'levitates'))) {
      target.volatiles.smackedDown = true;
      emit(battle, { t: 'volatile', side: 1 - sideIndex, name: nameOf(target), kind: 'smackdown' });
    }
    if (move.binds && !target.volatiles.bound) {
      target.volatiles.bound = { turns: 4 + Math.floor(battle.random() * 2), by: me, move: move.name };
      emit(battle, { t: 'volatile', side: 1 - sideIndex, name: nameOf(target), kind: 'bound', move: move.name });
    }
    if (move.traps && !target.volatiles.trappedBy) {
      target.volatiles.trappedBy = me;
      emit(battle, { t: 'volatile', side: 1 - sideIndex, name: nameOf(target), kind: 'trapped' });
      if (move.id === 'jaw-lock' && !me.volatiles.trappedBy) me.volatiles.trappedBy = target;
    }
    if (move.id === 'salt-cure' && !target.volatiles.saltCure) {
      target.volatiles.saltCure = true;
      emit(battle, { t: 'volatile', side: 1 - sideIndex, name: nameOf(target), kind: 'saltcure' });
    }
  }
  if (move.id === 'fell-stinger' && target.hp <= 0 && me.hp > 0) boost(battle, me, { atk: 3 }, me);
  afterSelf(battle, me, move);
  if (move.forceSwitch && target.hp > 0 && total > 0) dragOut(battle, target);
}

function afterSelf(battle: BattleState, me: BattleFighter, move: BattleMove): void {
  const sideIndex = sideIndexOf(battle, me);
  if (move.losesType && me.hp > 0) setTypes(battle, me, me.types.filter((t) => t !== move.losesType));
  if (move.id === 'steel-roller' && battle.field.terrain) clearTerrain(battle);
  if (move.id === 'glaive-rush') me.volatiles.glaiveRush = battle.turn;
  if (move.selfSwitch && me.hp > 0 && battle.sides[sideIndex].team.some((o) => o !== me && o.hp > 0)) me.volatiles.switchNow = true;
}

function stealBoosts(battle: BattleState, me: BattleFighter, target: BattleFighter): void {
  const stolen: Boosts = Object.fromEntries((Object.entries(target.boosts) as [BoostKey, number][]).filter(([, v]) => v > 0));
  if (!Object.keys(stolen).length) return;
  const sideIndex = sideIndexOf(battle, target);
  for (const [stat, stages] of Object.entries(stolen) as [BoostKey, number][]) {
    target.boosts[stat] = 0;
    emit(battle, { t: 'boost', side: sideIndex, name: nameOf(target), stat, by: -stages, stage: 0 });
  }
  boost(battle, me, stolen, me);
}

function dragOut(battle: BattleState, target: BattleFighter): boolean {
  const sideIndex = sideIndexOf(battle, target);
  const bench = battle.sides[sideIndex].team.map((f, i) => i).filter((i) => i !== battle.sides[sideIndex].active && battle.sides[sideIndex].team[i].hp > 0);
  if (!bench.length || flag(battle, target, 'suctionCups') || target.volatiles.ingrain) return false;
  const to = bench[Math.floor(battle.random() * bench.length)];
  emit(battle, { t: 'dragged', side: sideIndex, name: nameOf(target) });
  if (doSwitch(battle, sideIndex, to)) wakeAbilities(battle, activeOf(battle, sideIndex));
  runEntry(battle, sideIndex);
  return true;
}

function perform(battle: BattleState, sideIndex: number, me: BattleFighter, foe: BattleFighter | null, base: MoveData, move: BattleMove, moveIdx: number | null, firstAction: boolean, opts: { called?: boolean } = {}): void {
  const rules = MOVE_RULES[base.id];
  const failed = failReason(battle, me, foe, move, firstAction) ?? rules?.fail?.(moveApi(battle), me, foe as BattleFighter, move) ?? null;
  if (failed) {
    emit(battle, { t: 'nothing', side: sideIndex, reason: failed });
    me.volatiles.lastFailed = true;
    delete me.volatiles.rampage;
    delete me.volatiles.furyCutter;
    delete me.volatiles.locked;
    return;
  }
  if (rules?.call) {
    const called = rules.call(moveApi(battle), me, foe as BattleFighter, move);
    if (!called?.key) {
      emit(battle, { t: 'nothing', side: sideIndex, ...(called?.fail ? { reason: called.fail } : {}) });
      me.volatiles.lastFailed = true;
      return;
    }
    runCalled(battle, me, called.key, { powerMult: called.powerMult });
    return;
  }
  if (rules?.before && rules.before(moveApi(battle), me, foe as BattleFighter, move) === 'skip') return;
  if (base.id === 'echoed-voice') battle.echo = battle.echo?.turn === battle.turn ? battle.echo : { turn: battle.turn, count: battle.echo?.turn === battle.turn - 1 ? Math.min(5, battle.echo.count + 1) : 1 };
  if (!opts.called) (me.volatiles.usedMoves ??= new Set()).add(base.key);
  if (!move.flags.includes('failcopycat')) battle.lastMove = base.key;
  if (move.curls) me.volatiles.defenseCurl = true;
  let dealt = 0;
  if (move.kind === 'status') statusMove(battle, me, foe, move);
  else {
    dealt = attack(battle, me, foe, move) || 0;
    if (dealt && move.flags.includes('recharge') && me.hp > 0 && moveIdx != null) me.volatiles.mustRecharge = moveIdx;
    if (move.recoilMaxHp && me.hp > 0) hurt(battle, me, me.stats.hp * move.recoilMaxHp, 'recoil');
    me.volatiles.lastFailed = !dealt;
  }
  rules?.after?.(moveApi(battle), me, foe as BattleFighter, move, dealt);
  if (base.id === 'fury-cutter' && dealt) me.volatiles.furyCutter = Math.min(2, (me.volatiles.furyCutter ?? 0) + 1);
  else delete me.volatiles.furyCutter;
  if (base.rampage && me.hp > 0 && moveIdx != null) {
    if (!me.volatiles.rampage) me.volatiles.rampage = { move: moveIdx, left: 1 + Math.floor(battle.random() * 2) };
    else me.volatiles.rampage.left -= 1;
    if (me.volatiles.rampage.left <= 0) {
      delete me.volatiles.rampage;
      addVolatile(battle, me, 'confusion', me);
    }
  }
  if (move.selfDestruct && me.hp > 0) {
    me.hp = 0;
    faint(battle, me);
  }
}

function runCalled(battle: BattleState, me: BattleFighter, key: string, opts: { powerMult?: number; instructed?: boolean } = {}): void {
  const base = moveData(key);
  if (!base || me.hp <= 0) return;
  const sideIndex = sideIndexOf(battle, me);
  const move = { ...base, flags: [...base.flags], effectivePriority: base.priority, slot: null };
  if (opts.powerMult && move.power) move.power = Math.floor(move.power * opts.powerMult);
  adaptMove(battle, me, move);
  run(battle, me, 'onModifyMove', move);
  const status = move.kind === 'status' ? statusEffectOf(move) : {};
  emit(battle, { t: 'move', side: sideIndex, name: nameOf(me), move: move.name, type: move.type, kind: move.kind, key: base.key, category: move.category, target: shownTarget(me, base.key, move.target), flags: move.flags, called: true, ...status, ...(move.multihit ? { multihit: true } : {}), ...(move.drain ? { drain: true } : {}) });
  perform(battle, sideIndex, me, foeOf(battle, me), base, move, null, false, { called: true });
}

function useMove(battle: BattleState, sideIndex: number, moveIdx: number, priority: number, why: string | null = null): void {
  const me = activeOf(battle, sideIndex);
  if (me.hp <= 0) return;
  battle.moved.add(me);
  if (me.volatiles.mustRecharge != null) {
    delete me.volatiles.mustRecharge;
    emit(battle, { t: 'cant', side: sideIndex, name: nameOf(me), reason: 'recharge' });
    return;
  }
  const base = moveIdx === STRUGGLE_MOVE ? STRUGGLE : me.moves[moveIdx];
  const move = { ...base, flags: [...base.flags], effectivePriority: priority, slot: moveIdx };
  const charged = me.volatiles.charging === moveIdx;
  const continuing = me.volatiles.rampage?.move === moveIdx || me.volatiles.locked?.move === moveIdx;
  const firstAction = !me.volatiles.acted;
  me.volatiles.acted = true;
  delete me.volatiles.focusing;
  delete me.volatiles.destinyBond;
  if (!move.stalling) delete me.volatiles.stall;
  if (base.id !== 'rage') delete me.volatiles.rage;
  const blocked = moveIdx === STRUGGLE_MOVE ? null : moveBlocked(battle, me, base);
  if (blocked) {
    emit(battle, { t: 'cant', side: sideIndex, name: nameOf(me), reason: blocked, move: base.name });
    return;
  }
  if (!canAct(battle, me, move)) {
    delete me.volatiles.charging;
    delete me.volatiles.rampage;
    delete me.volatiles.furyCutter;
    return;
  }
  run(battle, me, 'onBeforeMoveForm', move);
  adaptMove(battle, me, move);
  if (me.volatiles.electrify === battle.turn) move.type = 'electric';
  run(battle, me, 'onModifyMove', move);
  run(battle, me, 'onPrepareMove', move);
  me.revealedMoves.add(base.key);
  me.volatiles.prevMove = me.volatiles.lastMove;
  me.volatiles.lastMove = base.key;
  const status = move.kind === 'status' ? statusEffectOf(move) : {};
  const startsCharge = move.flags.includes('charge') && !charged && !(isSun(currentWeather(battle)) && (base.id === 'solar-beam' || base.id === 'solar-blade'));
  if (startsCharge) {
    spendPP(battle, me, move);
    me.volatiles.charging = moveIdx;
    emit(battle, { t: 'charging', side: sideIndex, name: nameOf(me), move: move.name, key: base.key, hidden: !!HIDDEN_BY[base.id] });
    return;
  }
  emit(battle, { t: 'move', side: sideIndex, name: nameOf(me), move: move.name, type: move.type, kind: move.kind, key: base.key, category: move.category, target: shownTarget(me, base.key, move.target), flags: move.flags, ...status, ...(move.multihit ? { multihit: true } : {}), ...(move.drain ? { drain: true } : {}), ...(why ? { why } : {}) });

  const foe = foeOf(battle, me);
  delete me.volatiles.charging;
  if (!charged && !continuing) spendPP(battle, me, move);

  if (move.selfDestruct && move.kind !== 'status' && anyActiveHas(battle, 'damp')) {
    emit(battle, { t: 'nothing', side: sideIndex });
    return;
  }
  perform(battle, sideIndex, me, foe, base, move, moveIdx, firstAction);

  run(battle, me, 'onAfterMove', move);
  if (move.flags.includes('dance')) {
    const other = foeOf(battle, me);
    if (other) run(battle, other, 'onFoeMove', me, move);
  }
}

function selfStatus(battle: BattleState, me: BattleFighter, move: BattleMove): void {
  const sideIndex = sideIndexOf(battle, me);
  const snatcher = foeOf(battle, me);
  if (snatcher && snatcher.volatiles.snatch === battle.turn && move.flags.includes('snatch')) {
    delete snatcher.volatiles.snatch;
    emit(battle, { t: 'snatched', side: 1 - sideIndex, name: nameOf(snatcher), move: move.name });
    return selfStatus(battle, snatcher, move);
  }
  const rules = MOVE_RULES[move.id];
  if (rules?.use) {
    rules.use(moveApi(battle), me, foeOf(battle, me) as BattleFighter, move);
    return;
  }
  let did = false;
  if (move.selfCost) hurt(battle, me, me.stats.hp * move.selfCost, 'cost');
  if (move.id === 'no-retreat') {
    if (me.volatiles.noRetreat) {
      emit(battle, { t: 'nothing', side: sideIndexOf(battle, me) });
      return;
    }
    me.volatiles.noRetreat = true;
  }
  if (move.id === 'charge' && !me.volatiles.charge) {
    me.volatiles.charge = true;
    emit(battle, { t: 'volatile', side: sideIndexOf(battle, me), name: nameOf(me), kind: 'charge' });
    did = true;
  }
  if (move.id === 'growth' && isSun(currentWeather(battle))) move = { ...move, boosts: { atk: 2, satk: 2 } };
  if (move.weather) did = setWeather(battle, move.weather, null) || did;
  if (move.terrain) did = setTerrain(battle, move.terrain, null) || did;
  if (move.screen) did = setScreen(battle, sideIndexOf(battle, me), move.screen) || did;
  if (move.boosts) did = Object.keys(boost(battle, me, move.boosts, me)).length > 0 || did;
  if (move.heal) did = heal(battle, me, me.stats.hp * move.heal) > 0 || did;
  const weatherHeal = HEALS_WITH_WEATHER[move.id];
  if (weatherHeal) {
    const weather = currentWeather(battle);
    const share = weather === weatherHeal || (weatherHeal === 'sun' && isSun(weather)) ? 2 / 3 : weather && weather !== 'winds' ? 1 / 4 : 1 / 2;
    did = heal(battle, me, me.stats.hp * share) > 0 || did;
  }
  if (move.id === 'rest' && me.hp < me.stats.hp && me.status !== 'slp' && run(battle, me, 'onSetStatus', 'slp', me) !== false && !statusImmune(battle, me, 'slp', me)) {
    me.status = 'slp';
    me.statusTurns = 3;
    emit(battle, { t: 'status', side: sideIndexOf(battle, me), name: nameOf(me), status: 'slp' });
    heal(battle, me, me.stats.hp);
    did = true;
  }
  if (!did) emit(battle, { t: 'nothing', side: sideIndexOf(battle, me) });
}

function statusMove(battle: BattleState, me: BattleFighter, foe: BattleFighter | null, move: BattleMove): void {
  if (move.target !== 'foe') return selfStatus(battle, me, move);
  const sideIndex = sideIndexOf(battle, me);
  if (!foe) {
    emit(battle, { t: 'notarget', side: sideIndex });
    return;
  }
  if (blockedByProtection(battle, me, foe, move)) return;
  if (foe.volatiles.substitute && !bypassesSub(battle, me, move)) {
    emit(battle, { t: 'nothing', side: sideIndex, reason: 'substitute' });
    return;
  }
  let target = foe;
  battle.moldBreaker = flag(battle, me, 'moldBreaker') ? { target: foe } : null;
  try {
    if (move.effectivePriority > move.priority && foe.types.includes('dark')) {
      emit(battle, { t: 'immune', side: 1 - sideIndex });
      return;
    }
    if (move.id === 'thunder-wave' && typeEffectiveness(battle, move, me, foe) === 0) {
      emit(battle, { t: 'immune', side: 1 - sideIndex });
      return;
    }
    if (run(battle, foe, 'onTryHit', move, me)) return;
    if (flag(battle, foe, 'blocksStatusMoves')) {
      showAbility(battle, foe);
      emit(battle, { t: 'immune', side: 1 - sideIndex });
      return;
    }
    if ((move.accuracy != null || hiddenFrom(foe, move)) && !hits(battle, me, foe, move)) {
      emit(battle, { t: 'miss', side: sideIndex });
      return;
    }
    if (flag(battle, foe, 'bouncesStatus') && move.flags.includes('reflectable')) {
      showAbility(battle, foe, 'bounce');
      target = me;
    } else if (foe.volatiles.magicCoat === battle.turn && move.flags.includes('reflectable')) {
      emit(battle, { t: 'bounced', side: 1 - sideIndex, name: nameOf(foe), move: move.name });
      target = me;
    }
  } finally {
    battle.moldBreaker = null;
  }
  const source = target === me ? foe : me;
  const rules = MOVE_RULES[move.id];
  if (rules?.use) {
    rules.use(moveApi(battle), source, target, move);
    return;
  }
  let did = false;
  if (move.boosts) did = Object.keys(boost(battle, target, move.boosts, source)).length > 0 || did;
  if (move.status) did = setStatus(battle, target, move.status, source) || did;
  if (move.volatile === 'confusion') did = addVolatile(battle, target, 'confusion', source) || did;
  if (move.volatile === 'attract') did = addVolatile(battle, target, 'attract', source) || did;
  if (move.volatile === 'leechseed') did = addVolatile(battle, target, 'leechseed', source) || did;
  if (move.self) did = Object.keys(boost(battle, source, move.self, source)).length > 0 || did;
  if (!did && move.volatile === 'attract' && (!target.gender || !source.gender || target.gender === source.gender)) {
    emit(battle, { t: 'nothing', side: sideIndex, reason: !target.gender || !source.gender ? 'genderless' : 'sameGender' });
    return;
  }
  if (move.clearsScreens) {
    did = clearScreens(battle, sideIndexOf(battle, target), 'defog') || did;
    for (const side of [0, 1]) did = clearHazards(battle, side) || did;
  }
  if (!did) emit(battle, { t: 'nothing', side: sideIndex });
}

function rollHits(battle: BattleState, me: BattleFighter, move: BattleMove): number {
  if (move.multihit) {
    const [lo, hi] = move.multihit;
    if (lo === hi) return lo;
    if (flag(battle, me, 'maxHits')) return hi;
    const roll = battle.random();
    if (lo === 2 && hi === 5) return roll < 0.35 ? 2 : roll < 0.7 ? 3 : roll < 0.85 ? 4 : 5;
    return lo + Math.floor(roll * (hi - lo + 1));
  }
  return flag(battle, me, 'parentalBond') ? 2 : 1;
}

const HIDDEN_BY: Record<string, string> = { fly: 'air', bounce: 'air', 'sky-drop': 'air', dig: 'ground', dive: 'water', 'phantom-force': 'vanished', 'shadow-force': 'vanished' };
const REACHES_HIDDEN: Record<string, string[]> = { air: ['gust', 'twister', 'thunder', 'sky-uppercut', 'hurricane', 'smack-down', 'thousand-arrows'], ground: ['earthquake', 'magnitude', 'fissure'], water: ['surf', 'whirlpool'], vanished: [] };

export function hiddenFrom(target: BattleFighter, move: AnyMove): boolean {
  if (target.volatiles.charging == null) return false;
  const place = HIDDEN_BY[target.moves[target.volatiles.charging]?.id];
  return !!place && !REACHES_HIDDEN[place].includes(move.id);
}

function hits(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove): boolean {
  if (hiddenFrom(target, move)) return flag(battle, me, 'alwaysHits') || flag(battle, target, 'alwaysHits');
  if (move.ohko) return battle.random() * 100 < 30 + me.level - target.level;
  if (move.accuracy == null || flag(battle, me, 'alwaysHits') || flag(battle, target, 'alwaysHits')) return true;
  if (target.volatiles.telekinesis || me.volatiles.lockOn === target) return true;
  const weather = currentWeather(battle);
  if (move.id === 'blizzard' && (weather === 'hail' || weather === 'snow')) return true;
  if ((move.id === 'thunder' || move.id === 'hurricane') && isRain(weather)) return true;
  if ((move.id === 'thunder' || move.id === 'hurricane') && isSun(weather)) return battle.random() * 100 < 50;
  if (move.kind === 'status' && flag(battle, target, 'wonderSkin')) return battle.random() < 0.5;
  const accStage = flag(battle, target, 'unaware') ? 0 : me.boosts.acc;
  const evaStage = flag(battle, me, 'unaware') || flag(battle, me, 'ignoresEvasion') || target.volatiles.foresight || target.volatiles.miracleEye ? Math.min(0, target.boosts.eva) : target.boosts.eva;
  let acc = move.accuracy * accuracyMult(clamp(accStage - evaStage, -STAGE_LIMIT, STAGE_LIMIT));
  if (battle.field.rooms.gravity) acc *= 5 / 3;
  acc = chain(battle, me, 'onAccuracy', acc, move, target);
  acc = chain(battle, target, 'onEvasion', acc, move, me);
  return battle.random() * 100 < acc;
}

function rollCrit(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove): boolean {
  if (flag(battle, target, 'critImmune') || battle.sides[sideIndexOf(battle, target)].conds.luckychant) return false;
  if (me.volatiles.laserFocus != null && me.volatiles.laserFocus >= battle.turn) return true;
  const stage = chain(battle, me, 'onCritStage', (move.crit || 0) + (me.volatiles.focusEnergy ? 2 : 0), move, target);
  return battle.random() < [1 / 16, 1 / 8, 1 / 2, 1][clamp(stage, 0, 3)];
}

function ruin(battle: BattleState, fighter: BattleFighter, key: string): number {
  return otherActiveHas(battle, fighter, key) ? 0.75 : 1;
}

function powerMods(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove): number {
  let multiplier = mul(battle, me, 'onBasePower', move, target) * mul(battle, target, 'onIncoming', move, me);
  if ((move.type === 'dark' && anyActiveHas(battle, 'dark-aura')) || (move.type === 'fairy' && anyActiveHas(battle, 'fairy-aura'))) multiplier *= anyActiveHas(battle, 'aura-break') ? 0.75 : 4 / 3;
  const terrain = battle.field.terrain;
  if (grounded(battle, me) && ((terrain === 'electric' && move.type === 'electric') || (terrain === 'grassy' && move.type === 'grass') || (terrain === 'psychic' && move.type === 'psychic'))) multiplier *= 1.3;
  if (grounded(battle, target) && terrain === 'misty' && move.type === 'dragon') multiplier *= 0.5;
  if (grounded(battle, target) && terrain === 'grassy' && move.weakenedByGrassyTerrain) multiplier *= 0.5;
  if (me.volatiles.charge && move.type === 'electric') multiplier *= 2;
  if (battle.field.rooms.mudsport && move.type === 'electric') multiplier /= 3;
  if (battle.field.rooms.watersport && move.type === 'fire') multiplier /= 3;
  return multiplier;
}

function computeDamage(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove, eff: number, hitPower: number): { dmg: number; crit: boolean } {
  const crit = rollCrit(battle, me, target, move);
  const physical = move.category === 'physical';
  const atkKey = move.usesDefense ? 'def' : physical ? 'atk' : 'satk';
  const defKey = physical || move.hitsPhysicalDef ? 'def' : 'sdef';
  const attacker = move.usesTargetAttack ? target : me;
  let atkStage = flag(battle, target, 'unaware') ? 0 : attacker.boosts[atkKey];
  if (crit && atkStage < 0) atkStage = 0;
  let defStage = flag(battle, me, 'unaware') || move.ignoresDefBoosts ? 0 : target.boosts[defKey];
  if (crit && defStage > 0) defStage = 0;
  const weather = currentWeather(battle);

  const attack = attacker.stats[atkKey] * stageMult(atkStage) * mul(battle, me, 'onAttack', move, target) * ruin(battle, me, physical ? 'tablets-of-ruin' : 'vessel-of-ruin');
  const defStat = battle.field.rooms.wonderroom ? (defKey === 'def' ? 'sdef' : 'def') : defKey;
  let defense = target.stats[defStat] * stageMult(defStage) * mul(battle, target, 'onDefense', move, me) * ruin(battle, target, physical ? 'sword-of-ruin' : 'beads-of-ruin');
  if (weather === 'sand' && !physical && target.types.includes('rock')) defense *= 1.5;
  if (weather === 'snow' && physical && target.types.includes('ice')) defense *= 1.5;

  let dmg = (((2 * me.level) / 5 + 2) * hitPower * powerMods(battle, me, target, move) * (attack / defense)) / 50 + 2;
  const mw = weatherFor(battle, me);
  if (isSun(mw)) dmg *= move.type === 'fire' || move.id === 'hydro-steam' ? 1.5 : move.type === 'water' ? 0.5 : 1;
  if (isRain(mw)) dmg *= move.type === 'water' ? 1.5 : move.type === 'fire' ? 0.5 : 1;
  if (move.type && me.types.includes(move.type)) dmg *= flag(battle, me, 'stab') ? (abilityDef(battle, me)!.stab as number) : 1.5;
  dmg *= eff * (0.85 + battle.random() * 0.15) * (crit ? 1.5 : 1);
  if (me.status === 'brn' && physical && !flag(battle, me, 'ignoresBurn') && move.id !== 'facade') dmg *= 0.5;
  if (!crit && screened(battle, me, target, move)) dmg *= 0.5;
  if ((move.id === 'collision-course' || move.id === 'electro-drift') && eff > 1) dmg *= 5461 / 4096;
  if (target.volatiles.glaiveRush != null && battle.turn - target.volatiles.glaiveRush <= 1) dmg *= 2;
  dmg *= mul(battle, me, 'onAttackerFinal', move, target, { eff, crit }) * mul(battle, target, 'onDefenderFinal', move, me, { eff, crit });
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

function applySecondaries(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove): void {
  if (!move.secondary?.length || flag(battle, me, 'sheerForce')) return;
  const odds = flag(battle, me, 'doublesSecondaries') ? 2 : 1;
  for (const sec of move.secondary) {
    if (battle.random() * 100 >= sec.chance * odds) continue;
    if (sec.self) {
      if (me.hp > 0) boost(battle, me, sec.self, me);
      continue;
    }
    if (target.hp <= 0 || flag(battle, target, 'blocksSecondaries')) continue;
    if (sec.status) setStatus(battle, target, sec.status, me);
    if (sec.flinch) addVolatile(battle, target, 'flinch', me);
    if (sec.confuse) addVolatile(battle, target, 'confusion', me);
    if (sec.boosts) boost(battle, target, sec.boosts, me);
  }
}

function fixedDamage(me: BattleFighter, target: BattleFighter, move: AnyMove): number {
  if (move.ohko) return target.hp;
  if (move.fixedDamage === 'level') return me.level;
  return Number(move.fixedDamage);
}

function attack(battle: BattleState, me: BattleFighter, target: BattleFighter | null, move: BattleMove): number | undefined {
  const sideIndex = sideIndexOf(battle, me);
  if (!target) {
    emit(battle, { t: 'notarget', side: sideIndex });
    return 0;
  }
  if (move.ohko && target.level > me.level) {
    emit(battle, { t: 'nothing', side: sideIndex });
    return 0;
  }
  const weather = currentWeather(battle);
  if ((weather === 'heavyrain' && move.type === 'fire') || (weather === 'harshsun' && move.type === 'water')) {
    emit(battle, { t: 'fizzle', side: sideIndex, weather });
    return;
  }
  if (blockedByProtection(battle, me, target, move)) return 0;
  const rules = MOVE_RULES[move.id];
  const typeEff = typeEffectiveness(battle, move, me, target);
  const crash = () => move.crashes && me.hp > 0 && hurt(battle, me, me.stats.hp / 2, 'crash');
  battle.moldBreaker = flag(battle, me, 'moldBreaker') ? { target } : null;
  try {
    if (run(battle, target, 'onTryHit', move, me)) {
      crash();
      return;
    }
    if (typeEff === 0 && !move.ignoresImmunity) {
      emit(battle, { t: 'immune', side: 1 - sideIndex });
      crash();
      return;
    }
    if (battle.field.terrain === 'psychic' && move.effectivePriority > 0 && grounded(battle, target)) {
      emit(battle, { t: 'immune', side: 1 - sideIndex, terrain: 'psychic' });
      return;
    }
    if (!hits(battle, me, target, move)) {
      emit(battle, { t: 'miss', side: sideIndex });
      crash();
      return;
    }
    const fixed = rules?.damage ? rules.damage(moveApi(battle), me, target, move) : undefined;
    if (fixed === null) {
      emit(battle, { t: 'nothing', side: sideIndex });
      return 0;
    }
    if (move.breaksScreens) clearScreens(battle, sideIndexOf(battle, target), 'broken');
    move.power = rules?.power ? rules.power(moveApi(battle), me, target, move) : basePower(battle, me, target, move);
    if (move.id === 'spectral-thief') stealBoosts(battle, me, target);
    const eff = chain(battle, target, 'onEffectiveness', typeEff || 1, move, me);
    const count = rules?.hits ? rules.hits(moveApi(battle), me) : rollHits(battle, me, move);
    let total = 0;
    let lastHit = 0;
    let landed = 0;
    let toSub = false;
    for (let i = 0; i < count && target.hp > 0 && me.hp > 0; i++) {
      const hitPower = rules?.hitPower ? rules.hitPower(moveApi(battle), me, i) : i > 0 && !move.multihit ? move.power * 0.25 : move.power;
      const { dmg, crit } = fixed !== undefined ? { dmg: fixed, crit: false } : move.ohko || move.fixedDamage ? { dmg: fixedDamage(me, target, move), crit: false } : computeDamage(battle, me, target, move, eff, hitPower);
      if (target.volatiles.substitute && !bypassesSub(battle, me, move)) {
        const absorbed = Math.min(target.volatiles.substitute, dmg);
        target.volatiles.substitute -= absorbed;
        total += absorbed;
        landed += 1;
        toSub = true;
        emit(battle, { t: 'subDamage', side: 1 - sideIndex, name: nameOf(target), amount: absorbed, eff, crit });
        if (target.volatiles.substitute <= 0) {
          delete target.volatiles.substitute;
          emit(battle, { t: 'volatileEnd', side: 1 - sideIndex, name: nameOf(target), kind: 'substitute' });
        }
        continue;
      }
      let dealt = Math.min(target.hp, chain(battle, target, 'onDamage', dmg, move, me));
      if (move.leavesOne && dealt >= target.hp) dealt = Math.max(0, target.hp - 1);
      const endured = target.volatiles.endure === battle.turn && dealt >= target.hp && target.hp > 0;
      if (endured) dealt = target.hp - 1;
      const before = target.hp;
      target.hp -= dealt;
      total += dealt;
      lastHit = dealt;
      landed += 1;
      emit(battle, { t: 'damage', side: 1 - sideIndex, amount: dealt, hp: target.hp, max: target.stats.hp, eff, crit });
      if (endured) emit(battle, { t: 'endured', side: 1 - sideIndex, name: nameOf(target) });
      if (dealt > 0) {
        const prev = target.turnHit?.by === me ? target.turnHit.amount : 0;
        target.turnHit = { by: me, physical: move.category === 'physical', special: move.category === 'special', amount: prev + dealt };
        target.timesHit = (target.timesHit ?? 0) + 1;
        if (target.volatiles.locked?.kind === 'bide') target.volatiles.locked.damage += dealt;
        if (target.volatiles.rage && target.hp > 0) boost(battle, target, { atk: 1 }, target);
      }
      if (target.status === 'frz' && (move.type === 'fire' || move.flags.includes('defrost')) && target.hp > 0) cure(battle, target);
      if (target.volatiles.focusing === 'beak-blast' && move.flags.includes('contact') && me.hp > 0) setStatus(battle, me, 'brn', target);
      run(battle, target, 'onDamagingHit', move, me, { crit, before, dmg: dealt });
    }
    if (landed > 1) emit(battle, { t: 'hits', side: 1 - sideIndex, count: landed });
    if (me.volatiles.charge && move.type === 'electric') delete me.volatiles.charge;

    if (!toSub) applySecondaries(battle, me, target, move);
    if (move.self && me.hp > 0) boost(battle, me, move.self, me);
    if (move.recoil && total > 0 && !flag(battle, me, 'noRecoil')) hurt(battle, me, total * move.recoil, 'recoil');
    if (move.drain && total > 0 && me.hp > 0) {
      const amount = Math.max(1, Math.round(total * move.drain));
      if (flag(battle, target, 'oozes')) {
        showAbility(battle, target);
        hurt(battle, me, amount, 'ooze');
      } else heal(battle, me, amount);
    }
    if (me.hp > 0 && !toSub) run(battle, me, 'onAfterMoveHit', move, target, total);
    if (target.hp <= 0) faint(battle, target, me, move, lastHit);
    if (!toSub) afterHit(battle, me, target, move, total);
    else afterSelf(battle, me, move);
    if ((move.id === 'rapid-spin' || move.id === 'mortal-spin') && me.hp > 0) {
      clearHazards(battle, sideIndex);
      delete me.volatiles.bound;
      delete me.volatiles.leechSeed;
    }
    rules?.hit?.(moveApi(battle), me, target, move, total);
    return total;
  } finally {
    battle.moldBreaker = null;
  }
}

function alive(side: BattleSide): boolean {
  return side.team.some((f) => f.hp > 0);
}

function finish(battle: BattleState, winner: number | null, reason: string | null = null): void {
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

function resolveTurn(battle: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [{ t: 'turn', turn: battle.turn }];
  battle.events = events;
  battle.moved = new Set();
  for (const fighter of activeFighters(battle)) fighter.activeTurns += 1;
  // Both sides have chosen by now (submit() only resolves then).
  const acts = battle.sides.map((side, sideIndex) => ({ sideIndex, ...(side.action as SideAction) }));
  battle.chosen = acts.map((a) => (a.type === 'move' ? moveOfAction(battle, a.sideIndex, a.move) : null));
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
    .filter((a): a is { sideIndex: number } & MoveAction & { auto?: boolean } => a.type === 'move')
    .map((action) => {
      const fighter = activeOf(battle, action.sideIndex);
      const move = action.move === STRUGGLE_MOVE ? STRUGGLE : fighter.moves[action.move];
      const frac = run(battle, fighter, 'onFractionalPriority', move);
      return { ...action, fighter, prio: chain(battle, fighter, 'onModifyPriority', move.priority, move), frac: typeof frac === 'number' ? frac : 0, spd: speedOf(battle, fighter), tie: battle.random() };
    })
    .sort((x, y) => y.prio - x.prio || y.frac - x.frac || (battle.field.rooms.trickroom ? x.spd - y.spd : y.spd - x.spd) || y.tie - x.tie);

  // When both attack, say why the first one went first (priority move, faster, or a coin flip).
  const why = movers.length === 2 ? (movers[0].prio !== movers[1].prio || movers[0].frac !== movers[1].frac ? 'priority' : movers[0].spd !== movers[1].spd ? 'speed' : 'tie') : null;
  movers.forEach((a, i) => (a.why = i === 0 ? why : null));

  for (const mover of movers) {
    const move = moveOfAction(battle, mover.sideIndex, mover.move);
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
  const options = side.team.map((o, i) => i).filter((i) => i !== side.active && side.team[i].hp > 0);
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

function resolveSwitchOut(battle: BattleState): BattleEvent[] {
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

function statusDamage(battle: BattleState, fighter: BattleFighter): void {
  if (fighter.status !== 'brn' && !poisoned(fighter.status)) return;
  let amount: number;
  if (fighter.status === 'brn') amount = fighter.stats.hp / (flag(battle, fighter, 'halvesBurn') ? 32 : 16);
  else if (fighter.status === 'psn') amount = fighter.stats.hp / 8;
  else {
    fighter.statusTurns = Math.min(15, fighter.statusTurns + 1);
    amount = (fighter.stats.hp * fighter.statusTurns) / 16;
  }
  amount = chain(battle, fighter, 'onStatusDamage', Math.max(1, Math.floor(amount)), fighter.status);
  if (amount > 0) hurt(battle, fighter, amount, fighter.status);
}

function residual(battle: BattleState): void {
  const order = () => activeFighters(battle).sort((x, y) => speedOf(battle, y) - speedOf(battle, x));
  const weather = currentWeather(battle);
  for (const fighter of order()) {
    if (weather === 'sand' && !fighter.types.some((t) => SAND_PROOF.includes(t)) && !abilityDef(battle, fighter)?.weatherImmune?.includes('sand')) hurt(battle, fighter, fighter.stats.hp / 16, 'sand');
    if (weather === 'hail' && !fighter.types.includes('ice') && !abilityDef(battle, fighter)?.weatherImmune?.includes('hail')) hurt(battle, fighter, fighter.stats.hp / 16, 'hail');
    if (fighter.hp > 0 && battle.field.terrain === 'grassy' && grounded(battle, fighter)) heal(battle, fighter, fighter.stats.hp / 16);
    if (fighter.hp > 0) statusDamage(battle, fighter);
    if (fighter.hp > 0 && fighter.volatiles.leechSeed) {
      const seeder = foeOf(battle, fighter);
      const drained = hurt(battle, fighter, fighter.stats.hp / 8, 'leechseed');
      if (seeder && drained) {
        if (flag(battle, fighter, 'oozes')) hurt(battle, seeder, drained, 'ooze');
        else heal(battle, seeder, drained);
      }
    }
    if (fighter.hp > 0 && fighter.volatiles.bound) {
      const bound = fighter.volatiles.bound;
      if (!onField(battle, bound.by) || --bound.turns <= 0) {
        delete fighter.volatiles.bound;
        emit(battle, { t: 'volatileEnd', side: sideIndexOf(battle, fighter), name: nameOf(fighter), kind: 'bound', move: bound.move });
      } else hurt(battle, fighter, fighter.stats.hp / 8, 'bound');
    }
    if (fighter.hp > 0 && fighter.volatiles.saltCure) hurt(battle, fighter, fighter.stats.hp / (fighter.types.includes('water') || fighter.types.includes('steel') ? 4 : 8), 'saltcure');
    if (fighter.hp > 0 && fighter.volatiles.aquaRing) heal(battle, fighter, fighter.stats.hp / 16);
    if (fighter.hp > 0 && fighter.volatiles.ingrain) heal(battle, fighter, fighter.stats.hp / 16);
    if (fighter.hp > 0 && fighter.volatiles.curse) hurt(battle, fighter, fighter.stats.hp / 4, 'curse');
    if (fighter.hp > 0 && fighter.volatiles.nightmare) {
      if (fighter.status === 'slp') hurt(battle, fighter, fighter.stats.hp / 4, 'nightmare');
      else delete fighter.volatiles.nightmare;
    }
    if (fighter.hp > 0 && fighter.volatiles.octolock) {
      if (onField(battle, fighter.volatiles.octolock)) boost(battle, fighter, { def: -1, sdef: -1 }, fighter.volatiles.octolock);
      else delete fighter.volatiles.octolock;
    }
  }
  settle(battle);
  for (const fighter of order()) {
    if (fighter.volatiles.yawn && --fighter.volatiles.yawn <= 0) {
      delete fighter.volatiles.yawn;
      setStatus(battle, fighter, 'slp', null);
    }
    for (const [key, kind] of [['taunt', 'taunt'], ['encore', 'encore'], ['healBlock', 'healblock'], ['telekinesis', 'telekinesis'], ['magnetRise', 'magnetrise']]) {
      const effect = fighter.volatiles[key];
      if (!effect) continue;
      if (--effect.turns <= 0 || (key === 'encore' && !(fighter.pp[effect.key] > 0))) {
        delete fighter.volatiles[key];
        emit(battle, { t: 'volatileEnd', side: sideIndexOf(battle, fighter), name: nameOf(fighter), kind });
      }
    }
  }
  battle.sides.forEach((side, sideIndex) => {
    const fighter = activeOf(battle, sideIndex);
    if (side.wish && side.wish.at <= battle.turn) {
      const wish = side.wish;
      delete side.wish;
      if (fighter.hp > 0) {
        emit(battle, { t: 'wish', side: sideIndex, name: wish.name });
        heal(battle, fighter, wish.amount);
      }
    }
    if (side.future && side.future.at <= battle.turn) {
      const future = side.future;
      delete side.future;
      if (fighter.hp > 0) {
        emit(battle, { t: 'futureHit', side: sideIndex, name: nameOf(fighter), move: future.name });
        const eff = typeEffectiveness(battle, future.move, future.user, fighter);
        if (eff === 0) emit(battle, { t: 'immune', side: sideIndex });
        else {
          const { dmg } = computeDamage(battle, future.user, fighter, future.move, eff, future.move.power);
          hurt(battle, fighter, dmg, 'future');
        }
      }
    }
    for (const key of Object.keys(side.conds)) {
      const turns = side.conds[key];
      if (['quickguard', 'wideguard', 'craftyshield', 'matblock'].includes(key)) {
        if (turns < battle.turn + 1) delete side.conds[key];
        continue;
      }
      if (--side.conds[key] <= 0) {
        delete side.conds[key];
        emit(battle, { t: 'sideEnd', side: sideIndex, kind: key });
      }
    }
  });
  settle(battle);
  for (const key of Object.keys(battle.field.rooms)) {
    if (--battle.field.rooms[key] <= 0) {
      delete battle.field.rooms[key];
      emit(battle, { t: 'fieldEnd', kind: key });
    }
  }
  for (const fighter of order()) run(battle, fighter, 'onEndTurn');
  settle(battle);
  for (const fighter of order()) {
    if (fighter.volatiles.perish) {
      fighter.volatiles.perish -= 1;
      emit(battle, { t: 'perish', side: sideIndexOf(battle, fighter), name: nameOf(fighter), count: fighter.volatiles.perish });
      if (!fighter.volatiles.perish) {
        fighter.hp = 0;
        faint(battle, fighter);
        continue;
      }
    }
    if (fighter.volatiles.disabled && --fighter.volatiles.disabled.turns <= 0) {
      emit(battle, { t: 'volatileEnd', side: sideIndexOf(battle, fighter), name: nameOf(fighter), kind: 'disable', move: fighter.volatiles.disabled.name });
      delete fighter.volatiles.disabled;
    }
    delete fighter.volatiles.flinch;
  }
  battle.sides.forEach((side, sideIndex) => {
    for (const kind of SCREEN_KINDS) {
      if (!side.screens[kind] || --side.screens[kind] > 0) continue;
      delete side.screens[kind];
      emit(battle, { t: 'screenEnd', side: sideIndex, screen: kind, cause: 'time' });
    }
  });
  if (battle.field.weather && --battle.field.weatherTurns <= 0) clearWeather(battle);
  if (battle.field.terrain && --battle.field.terrainTurns <= 0) clearTerrain(battle);
}

function afterTurn(battle: BattleState): void {
  let anyReplace = false;
  battle.sides.forEach((side, sideIndex) => {
    const fighter = side.team[side.active];
    const escaping = fighter.hp > 0 && (fighter.volatiles.exitPending || fighter.volatiles.switchNow) && side.team.some((o) => o !== fighter && o.hp > 0);
    delete fighter.volatiles.switchNow;
    side.mustSwitch = fighter.hp <= 0 || escaping;
    if (side.mustSwitch) {
      anyReplace = true;
      emit(battle, { t: 'replace', side: sideIndex });
    }
  });
  battle.phase = anyReplace ? 'replace' : 'choose';
}

function resolveReplacements(battle: BattleState): BattleEvent[] {
  const events: BattleEvent[] = [];
  battle.events = events;
  const entered: number[] = [];
  battle.sides.forEach((side, sideIndex) => {
    if (side.mustSwitch && side.action) {
      if (doSwitch(battle, sideIndex, (side.action as SwitchAction).to)) wakeAbilities(battle, activeOf(battle, sideIndex));
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

// ---------- what clients see ----------

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

function publicMoves(fighter: BattleFighter, known: Set<string> | null = null) {
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

// What a client may see. Pending choices stay hidden; only "ready" is shown.
const percentOf = (hp: number, max: number): number => (hp <= 0 ? 0 : Math.max(1, Math.round((hp / max) * 100)));

function hiddenHp(event: BattleEvent): BattleEvent {
  if (event.max == null) return event.stats ? { ...event, stats: { hp: 100 } } : event;
  const before = event.t === 'damage' || event.t === 'hurt' ? event.hp! + event.amount! : event.hp! - event.amount!;
  const hp = percentOf(event.hp!, event.max);
  const out = { ...event, hp, max: 100, pct: true };
  if (event.amount != null) out.amount = event.amount > 0 ? Math.max(1, Math.abs(percentOf(before, event.max) - hp)) : 0;
  if (event.stats) out.stats = { hp: 100 };
  return out;
}

function viewEvent(event: BattleEvent, viewer: number | null): BattleEvent {
  if (event.card) {
    const { card, seen, ...rest } = event;
    return { ...rest, mon: event.side === viewer ? card : seen };
  }
  return event.side == null || event.side === viewer || (event.max == null && !event.stats) ? event : hiddenHp(event);
}

export function viewEvents(events: BattleEvent[], viewer: number | null = null): BattleEvent[] {
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

function fighterView(battle: BattleState, sideIndex: number, slot: number, own: boolean, spectator = false): FighterView {
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
    levelCap: battle.levelCap,
    field: { weather: battle.field.weather, terrain: battle.field.terrain, weatherSuppressed: !!battle.field.weather && !currentWeather(battle), rooms: { ...battle.field.rooms } },
    intro: battle.turn === 1 && battle.phase === 'choose' ? viewEvents(battle.intro, viewer) : [],
    sides: battle.sides.map((side, s) => ({
      trainerId: side.trainerId,
      name: side.name,
      active: side.active,
      ready: !needsAction(battle, s),
      mustSwitch: side.mustSwitch,
      toxicSpikes: side.toxicSpikes,
      screens: { ...side.screens },
      hazards: { ...side.hazards },
      conds: Object.fromEntries(Object.entries(side.conds).filter(([k]) => ['tailwind', 'safeguard', 'mist', 'luckychant'].includes(k))),
      ...(side.wish ? { wish: true } : {}),
      ...(side.future ? { future: side.future.name } : {}),
      team: side.team.map((f, i) => fighterView(battle, s, i, viewer === s || battle.status === 'finished', viewer === null)),
    })),
  };
}

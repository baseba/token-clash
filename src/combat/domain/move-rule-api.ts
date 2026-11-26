import { ALL_MOVE_IDS, type BoostKey, type Boosts, effectiveness, type MajorStatus, speciesData, type Stats } from '../../catalog/domain/creatures.js';
import { moveData, type MoveData } from './moves.js';
import { MOVE_RULES, type MoveRuleApi } from './rules/move-rules.js';
import { ABILITIES, type AbilityEffect } from './rules/ability-effects.js';
import type { BattleEvent, BattleFighter, BattleMove, BattleSide, BattleState, Guard, Hazards, Volatiles } from './battle-types.js';
import { runCalled } from './use-move.js';
import { dragOut, faint } from './switching.js';
import { activeFighters, activeOf, addToxicSpikes, addVolatile, boost, clearHazards, cure, currentWeather, emit, freshBoosts, grounded, hasBench, heal, hurt, nameOf, setStatus, setTypes, sideIndexOf, speedOf, transform } from './effects.js';
import { flag, run, setAbility } from './ability-engine.js';

const moveApis = new WeakMap<BattleState, MoveRuleApi>();
const BATON_PASSED = ['confusion', 'focusEnergy', 'perish', 'leechSeed', 'curse', 'ingrain', 'aquaRing', 'magnetRise', 'substitute', 'trappedBy', 'gastroAcid'] as const;
const MAX_SPIKES = 3;

export function moveApi(battle: BattleState): MoveRuleApi {
  let api = moveApis.get(battle);
  if (api) return api;
  api = makeMoveApi(battle);
  moveApis.set(battle, api);
  return api;
}

function makeMoveApi(battle: BattleState) {
  const sideOf = (fighter: BattleFighter) => sideIndexOf(battle, fighter);
  const stallFails = (fighter: BattleFighter): boolean => {
    const stalls = fighter.volatiles.stall ?? 0;
    if (stalls > 0 && battle.random() >= 1 / 3 ** stalls) {
      delete fighter.volatiles.stall;
      return true;
    }
    fighter.volatiles.stall = stalls + 1;
    return false;
  };
  const api: MoveRuleApi = {
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
    setStatus: (fighter: BattleFighter, status: MajorStatus, source?: BattleFighter | null) => setStatus(battle, fighter, status, source),
    cure: (fighter: BattleFighter) => cure(battle, fighter),
    addVolatile: (
      fighter: BattleFighter,
      kind: string,
      source?: BattleFighter | null,
      opts?: { ability?: BattleFighter; move?: { key: string; name: string } },
    ) =>
      addVolatile(battle, fighter, kind, source, opts),
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
    weight: (fighter: BattleFighter): number => speciesData(fighter.speciesId)?.weight ?? 50,
    baseAttack: (fighter: BattleFighter): number | undefined => speciesData(fighter.speciesId)?.base.attack,
    moved: (fighter: BattleFighter) => battle.moved.has(fighter),
    chosen: (sideIndex: number): MoveData | null => battle.chosen?.[sideIndex] ?? null,
    lastMove: (): string | null => battle.lastMove ?? null,
    nothing: (fighter: BattleFighter, reason: string | null = null): false => {
      emit(battle, { t: 'nothing', side: sideOf(fighter), ...(reason ? { reason } : {}) });
      return false;
    },
    volatile: (fighter: BattleFighter, kind: string, extra: { move?: string; count?: number } = {}) =>
      emit(battle, { t: 'volatile', side: sideOf(fighter), name: nameOf(fighter), kind, ...extra }),
    volatileEnd: (fighter: BattleFighter, kind: string, extra: { move?: string } = {}) =>
      emit(battle, { t: 'volatileEnd', side: sideOf(fighter), name: nameOf(fighter), kind, ...extra }),
    sideStart: (sideIndex: number, kind: string, extra: { name?: string } = {}) =>
      emit(battle, { t: 'sideStart', side: sideIndex, kind, ...extra }),
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
      if (stallFails(fighter)) return api.nothing(fighter);
      if (kind === 'endure') fighter.volatiles.endure = battle.turn;
      else fighter.volatiles.protect = { turn: battle.turn, kind };
      emit(battle, { t: 'protect', side: sideOf(fighter), name: nameOf(fighter), kind });
      return true;
    },
    guard: (fighter: BattleFighter, kind: Guard): boolean => {
      if ((kind === 'quickguard' || kind === 'wideguard') && stallFails(fighter)) return api.nothing(fighter);
      battle.sides[sideOf(fighter)].guards.add(kind);
      emit(battle, { t: 'sideStart', side: sideOf(fighter), kind });
      return true;
    },
    hazard: (fighter: BattleFighter, kind: keyof Hazards | 'toxicspikes'): boolean => {
      const sideIndex = 1 - sideOf(fighter);
      const side = battle.sides[sideIndex];
      if (kind === 'toxicspikes') return addToxicSpikes(battle, sideIndex) || api.nothing(fighter);
      const { hazards } = side;
      if (kind === 'spikes') {
        if (hazards.spikes >= MAX_SPIKES) return api.nothing(fighter);
        hazards.spikes += 1;
      } else {
        if (hazards[kind]) return api.nothing(fighter);
        hazards[kind] = true;
      }
      emit(battle, { t: 'sideStart', side: sideIndex, kind, ...(kind === 'spikes' ? { layers: hazards.spikes } : {}) });
      return true;
    },
    clearHazards: (sideIndex: number) => clearHazards(battle, sideIndex),
    courtChange: (): boolean => {
      const [first, second] = battle.sides;
      const swap = <K extends 'hazards' | 'conds' | 'guards' | 'screens' | 'toxicSpikes'>(key: K) => ([first[key], second[key]] = [second[key], first[key]]);
      for (const key of ['hazards', 'conds', 'guards', 'screens', 'toxicSpikes'] as const) swap(key);
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
        const keep = <K extends keyof Volatiles>(key: K) => (kept[key] = fighter.volatiles[key]);
        if (pass.volatiles) for (const key of BATON_PASSED) if (fighter.volatiles[key]) keep(key);
        if (pass.substitute) kept.substitute = pass.substitute;
        battle.sides[sideOf(fighter)].pass = kept;
      }
    },
    sacrifice: (fighter: BattleFighter, kind: string): boolean => {
      if (!hasBench(battle, fighter)) return api.nothing(fighter, 'noBench');
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
      if (!last
        || !last.supported
        || me.moves.some((m) => m.key === last.key)
        || move.slot == null
        || (permanent ? last.flags.includes('nosketch') : last.flags.includes('failmimic')))
        return api.nothing(me);
      if (!permanent) me.volatiles.mimic = { slot: move.slot, original: me.moves[move.slot] };
      me.moves = me.moves.map((m, i) => (i === move.slot ? last : m));
      me.pp[last.key] = permanent ? last.pp : Math.min(5, last.pp);
      emit(battle, { t: 'learned', side: sideOf(me), name: nameOf(me), move: last.name });
      return true;
    },
    moveData,
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

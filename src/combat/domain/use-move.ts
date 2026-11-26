import type { Weather } from '../../catalog/domain/creatures.js';
import { aimedTarget, hiddenPowerType, moveAt, moveData, type MoveData, type MoveTarget, STRUGGLE, STRUGGLE_MOVE } from './moves.js';
import { MOVE_RULES, type MoveRuleApi } from './rules/move-rules.js';
import { isSun, stageMult } from './conditions.js';
import type { AnyMove, BattleFighter, BattleMove, BattleState, MoveEvent, OrderReason } from './battle-types.js';
import { attack, baseDamage, blockedByProtection, bypassesSub, damageRoll, HIDDEN_BY, hiddenFrom, hits } from './damage.js';
import { faint } from './switching.js';
import { asleep, clearHazards, clearScreens, cure, currentWeather, grounded, heal, hurt, setScreen, statusImmune, typeEffectiveness } from './effects.js';
import { activeOf, emit, foeOf, nameOf, onField, sideIndexOf } from './state.js';
import { addVolatile, boost, run, setStatus, setTerrain, setWeather } from './ability-engine.js';
import { abilityKey, anyActiveHas, flag, showAbility } from './abilities.js';
import { makeMoveApi } from './move-rule-api.js';
import { shownTarget } from './fighter-view.js';

const CONFUSION_POWER = 40;

const moveApis = new WeakMap<BattleState, MoveRuleApi>();

const HEALS_WITH_WEATHER: Record<string, Weather> = { synthesis: 'sun', 'morning-sun': 'sun', moonlight: 'sun', 'shore-up': 'sand' };

export function moveBlocked(battle: BattleState, fighter: BattleFighter, move: AnyMove): string | null {
  if (fighter.volatiles.taunt && move.kind === 'status') return 'taunt';
  if (fighter.volatiles.torment && fighter.volatiles.lastMove === move.key && move.key !== STRUGGLE.key) return 'torment';
  if (fighter.volatiles.healBlock && (move.flags.includes('heal') || move.heal)) return 'healBlock';
  if (battle.field.rooms.gravity && move.flags.includes('gravity')) return 'gravity';
  const foe = foeOf(battle, fighter);
  if (foe?.volatiles.imprison && foe.moves.some((x) => x.key === move.key)) return 'imprison';
  if (move.flags.includes('cantusetwice') && fighter.volatiles.lastMove === move.key) return 'twice';
  return null;
}

export function lastResortReady(fighter: BattleFighter): boolean {
  const others = fighter.moves.filter((move) => move.key !== 'last-resort');
  return others.length > 0 && others.every((move) => fighter.volatiles.usedMoves?.has(move.key));
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
        const attack = Math.max(1, Math.floor(me.stats.atk * stageMult(me.boosts.atk)));
        const defense = Math.max(1, Math.floor(me.stats.def * stageMult(me.boosts.def)));
        const roll = damageRoll(battle.random());
        hurt(battle, me, Math.floor((baseDamage(me.level, CONFUSION_POWER, attack, defense) * roll) / 100), 'confusion');
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

function statusEffectOf(move: AnyMove): Pick<MoveEvent, 'effect' | 'stat'> {
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

const WEATHER_BALL: Partial<Record<Weather, string>> = { sun: 'fire', harshsun: 'fire', rain: 'water', heavyrain: 'water', sand: 'rock', hail: 'ice', snow: 'ice' };
const TERRAIN_PULSE: Record<string, string> = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };

export function failReason(battle: BattleState, me: BattleFighter, foe: BattleFighter | null, move: AnyMove, firstAction: boolean): string | null {
  const sideIndex = sideIndexOf(battle, me);
  if (move.firstTurnOnly && !firstAction) return 'notFirstTurn';
  if (move.id === 'sucker-punch' || move.id === 'thunderclap') {
    const theirs = battle.chosen?.[1 - sideIndex];
    if (!foe || battle.moved.has(foe) || !theirs || theirs.kind === 'status') return 'suckerPunch';
  }
  if (move.id === 'focus-punch' && me.turnHit) return 'lostFocus';
  if (move.id === 'shell-trap' && !me.turnHit?.physical) return 'shellTrap';
  if (move.id === 'last-resort' && !lastResortReady(me)) return 'lastResort';
  if (move.id === 'dream-eater' && (!foe || !asleep(battle, foe))) return 'notAsleep';
  if (move.id === 'snore' && !asleep(battle, me)) return 'notAsleepSelf';
  if (move.id === 'steel-roller' && !battle.field.terrain) return 'noTerrain';
  if (move.losesType && !me.types.includes(move.losesType)) return 'noType';
  if (move.id === 'synchronoise' && foe && !foe.types.some((t) => me.types.includes(t))) return 'noSharedType';
  if (move.id === 'captivate' && foe && (!foe.gender || !me.gender || foe.gender === me.gender)) return !foe.gender || !me.gender ? 'genderless' : 'sameGender';
  if (move.selfCost && me.hp <= Math.floor(me.stats.hp * move.selfCost)) return 'lowHp';
  return null;
}

function adaptMove(battle: BattleState, me: BattleFighter, move: BattleMove): void {
  const weather = currentWeather(battle);
  const ballType = weather && WEATHER_BALL[weather];
  if (move.id === 'weather-ball' && ballType) {
    move.type = ballType;
    move.power = 100;
  }
  if (move.id === 'terrain-pulse' && battle.field.terrain && grounded(battle, me)) {
    move.type = TERRAIN_PULSE[battle.field.terrain];
    move.power = 100;
  }
  if (move.id === 'revelation-dance') move.type = me.types[0];
  if (move.id === 'hidden-power') move.type = hiddenPowerType(me.nature);
  if (move.id === 'photon-geyser' && me.stats.atk * stageMult(me.boosts.atk) > me.stats.satk * stageMult(me.boosts.satk)) move.category = 'physical';
}

function moveApi(battle: BattleState): MoveRuleApi {
  let api = moveApis.get(battle);
  if (api) return api;
  api = makeMoveApi(battle, (fighter, key, opts) => runCalled(battle, fighter, key, opts));
  moveApis.set(battle, api);
  return api;
}

function perform(
  battle: BattleState,
  sideIndex: number,
  me: BattleFighter,
  foe: BattleFighter | null,
  base: MoveData,
  move: BattleMove,
  moveIdx: number | null,
  firstAction: boolean,
  opts: { called?: boolean } = {},
): void {
  const rules = MOVE_RULES[base.id];
  const failed = failReason(battle, me, foe, move, firstAction) ?? rules?.fail?.(moveApi(battle), me, foe, move) ?? null;
  if (failed) {
    emit(battle, { t: 'nothing', side: sideIndex, reason: failed });
    me.volatiles.lastFailed = true;
    delete me.volatiles.rampage;
    delete me.volatiles.furyCutter;
    delete me.volatiles.locked;
    return;
  }
  if (rules?.call) {
    const called = rules.call(moveApi(battle), me, foe, move);
    if (!called?.key) {
      emit(battle, { t: 'nothing', side: sideIndex, ...(called?.fail ? { reason: called.fail } : {}) });
      me.volatiles.lastFailed = true;
      return;
    }
    runCalled(battle, me, called.key, { powerMult: called.powerMult });
    return;
  }
  if (rules?.before?.(moveApi(battle), me, foe, move) === 'skip') return;
  if (base.id === 'echoed-voice')
    battle.echo = battle.echo?.turn === battle.turn
      ? battle.echo
      : { turn: battle.turn, count: battle.echo?.turn === battle.turn - 1 ? Math.min(5, battle.echo.count + 1) : 1 };
  if (!opts.called) (me.volatiles.usedMoves ??= new Set()).add(base.key);
  if (!move.flags.includes('failcopycat')) battle.lastMove = base.key;
  if (move.curls) me.volatiles.defenseCurl = true;
  let dealt = 0;
  let landed = true;
  if (move.kind === 'status') landed = statusMove(battle, me, foe, move);
  else if (move.aimable && move.target === 'self') {
    if (!heal(battle, me, me.stats.hp / 2)) emit(battle, { t: 'nothing', side: sideIndex });
  } else {
    dealt = attack(battle, me, foe, move, moveApi(battle)) || 0;
    if (dealt && move.flags.includes('recharge') && me.hp > 0 && moveIdx != null) me.volatiles.mustRecharge = moveIdx;
    if (move.recoilMaxHp && me.hp > 0) hurt(battle, me, Math.round(me.stats.hp * move.recoilMaxHp), 'recoil');
    me.volatiles.lastFailed = !dealt;
  }
  rules?.after?.(moveApi(battle), me, foe, move, dealt);
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
  if (move.selfDestruct && landed && me.hp > 0) {
    me.hp = 0;
    faint(battle, me);
  }
}

function announceMove(battle: BattleState, sideIndex: number, me: BattleFighter, base: MoveData, move: BattleMove, extra: Pick<MoveEvent, 'called' | 'why'>): void {
  emit(battle, {
    t: 'move',
    side: sideIndex,
    name: nameOf(me),
    move: move.name,
    type: move.type,
    kind: move.kind,
    key: base.key,
    category: move.category,
    target: shownTarget(me, base.key, move.target),
    flags: move.flags,
    ...(move.kind === 'status' ? statusEffectOf(move) : {}),
    ...(move.multihit ? { multihit: true } : {}),
    ...(move.drain ? { drain: true } : {}),
    ...extra,
  });
}

function runCalled(battle: BattleState, me: BattleFighter, key: string, opts: { powerMult?: number; instructed?: boolean } = {}): void {
  const base = moveData(key);
  if (!base || me.hp <= 0) return;
  const sideIndex = sideIndexOf(battle, me);
  const move = { ...base, flags: [...base.flags], effectivePriority: base.priority, slot: null, target: aimedTarget(base, null) };
  if (opts.powerMult && move.power) move.power = Math.floor(move.power * opts.powerMult);
  adaptMove(battle, me, move);
  run(battle, me, 'onModifyMove', move);
  announceMove(battle, sideIndex, me, base, move, { called: true });
  perform(battle, sideIndex, me, foeOf(battle, me), base, move, null, false, { called: true });
}

export function useMove(battle: BattleState, sideIndex: number, moveIdx: number, priority: number, why: OrderReason | null = null, aim: MoveTarget | null = null): void {
  const me = activeOf(battle, sideIndex);
  if (me.hp <= 0) return;
  battle.moved.add(me);
  if (me.volatiles.mustRecharge != null) {
    delete me.volatiles.mustRecharge;
    emit(battle, { t: 'cant', side: sideIndex, name: nameOf(me), reason: 'recharge' });
    return;
  }
  const base = moveAt(me, moveIdx);
  const move = { ...base, flags: [...base.flags], effectivePriority: priority, slot: moveIdx, target: aimedTarget(base, aim) };
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
  const startsCharge = move.flags.includes('charge')
    && !charged
    && !(isSun(currentWeather(battle)) && (base.id === 'solar-beam' || base.id === 'solar-blade'));
  if (startsCharge) {
    spendPP(battle, me, move);
    me.volatiles.charging = moveIdx;
    emit(battle, { t: 'charging', side: sideIndex, name: nameOf(me), move: move.name, key: base.key, hidden: !!HIDDEN_BY[base.id] });
    return;
  }
  announceMove(battle, sideIndex, me, base, move, why ? { why } : {});

  const foe = foeOf(battle, me);
  delete me.volatiles.charging;
  if (!charged && !continuing) spendPP(battle, me, move);

  if (((move.selfDestruct && move.kind !== 'status') || base.id === 'mind-blown') && anyActiveHas(battle, 'damp')) {
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
  if (rules?.use) return failLoudly(battle, me, () => rules.use!(moveApi(battle), me, foeOf(battle, me), move));
  if (rules?.useOn) return failLoudly(battle, me, () => rules.useOn!(moveApi(battle), me, me, move));
  let did = false;
  if (move.selfCost) {
    if (!Object.keys(boost(battle, me, move.boosts ?? {}, me)).length) {
      emit(battle, { t: 'nothing', side: sideIndexOf(battle, me) });
      return;
    }
    hurt(battle, me, me.stats.hp * move.selfCost, 'cost');
    return;
  }
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
  if (move.id === 'rest'
    && me.hp < me.stats.hp
    && me.status !== 'slp'
    && run(battle, me, 'onSetStatus', 'slp', me) !== false
    && !statusImmune(battle, me, 'slp', me)) {
    me.status = 'slp';
    me.statusTurns = 3;
    emit(battle, { t: 'status', side: sideIndexOf(battle, me), name: nameOf(me), status: 'slp' });
    heal(battle, me, me.stats.hp);
    did = true;
  }
  if (!did) emit(battle, { t: 'nothing', side: sideIndexOf(battle, me) });
}

function failLoudly(battle: BattleState, user: BattleFighter, rule: () => boolean): void {
  const before = battle.events.length;
  if (!rule() && battle.events.length === before) emit(battle, { t: 'nothing', side: sideIndexOf(battle, user) });
}

function statusMove(battle: BattleState, me: BattleFighter, foe: BattleFighter | null, move: BattleMove): boolean {
  if (move.target !== 'foe') {
    selfStatus(battle, me, move);
    return true;
  }
  const sideIndex = sideIndexOf(battle, me);
  if (!foe) {
    emit(battle, { t: 'notarget', side: sideIndex });
    return false;
  }
  if (blockedByProtection(battle, me, foe, move)) return false;
  if (foe.volatiles.substitute && !bypassesSub(battle, me, move)) {
    emit(battle, { t: 'nothing', side: sideIndex, reason: 'substitute' });
    return false;
  }
  let target = foe;
  battle.moldBreaker = flag(battle, me, 'moldBreaker') ? { target: foe } : null;
  try {
    if (move.effectivePriority > move.priority && foe.types.includes('dark')) {
      emit(battle, { t: 'immune', side: 1 - sideIndex });
      return false;
    }
    if (move.id === 'thunder-wave' && typeEffectiveness(battle, move, me, foe) === 0) {
      emit(battle, { t: 'immune', side: 1 - sideIndex });
      return false;
    }
    if (run(battle, foe, 'onTryHit', move, me)) return false;
    if (flag(battle, foe, 'blocksStatusMoves')) {
      showAbility(battle, foe);
      emit(battle, { t: 'immune', side: 1 - sideIndex });
      return false;
    }
    if ((move.accuracy != null || hiddenFrom(foe, move)) && !hits(battle, me, foe, move)) {
      emit(battle, { t: 'miss', side: sideIndex });
      return false;
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
  if (rules?.useOn) {
    failLoudly(battle, source, () => rules.useOn!(moveApi(battle), source, target, move));
    return true;
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
    return true;
  }
  if (move.clearsScreens) {
    did = clearScreens(battle, sideIndexOf(battle, target), 'defog') || did;
    for (const side of [0, 1]) did = clearHazards(battle, side) || did;
  }
  if (!did) emit(battle, { t: 'nothing', side: sideIndex });
  return true;
}

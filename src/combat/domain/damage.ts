import type { BoostKey, Boosts, MajorStatus } from '../../catalog/domain/creatures.js';
import { MOVE_RULES, type MoveRuleApi } from './rules/move-rules.js';
import { isRain, isSun, poisoned, stageMult } from './conditions.js';
import type { AnyMove, BattleFighter, BattleMove, BattleState } from './battle-types.js';
import { dragOut, faint } from './switching.js';
import { addVolatile, asleep, boost, clearHazards, clearScreens, clearTerrain, cure, currentWeather, grounded, heal, hurt, setStatus, setTypes, STAGE_LIMIT, typeEffectiveness, weatherFor } from './effects.js';
import { clamp, emit, freshBoosts, hasBench, nameOf, sideIndexOf } from './state.js';
import { chain, mul, run } from './ability-engine.js';
import { abilityDef, anyActiveHas, flag, otherActiveHas, showAbility } from './abilities.js';

const accuracyMult = (stage: number): number => (stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage));

export function bypassesSub(battle: BattleState, me: BattleFighter, move: AnyMove): boolean {
  return move.flags.includes('sound') || move.flags.includes('bypasssub') || flag(battle, me, 'infiltrates');
}

export function blockedByProtection(battle: BattleState, me: BattleFighter, target: BattleFighter | null, move: BattleMove): boolean {
  if (!target || target === me) return false;
  const sideIndex = sideIndexOf(battle, target);
  const guards = battle.sides[sideIndex].guards;
  const prot = target.volatiles.protect?.turn === battle.turn ? target.volatiles.protect.kind : null;
  const status = move.kind === 'status';
  const shielded = prot && move.flags.includes('protect') && !(status && ['kings-shield', 'obstruct', 'silk-trap'].includes(prot));
  const guarded =
    (guards.has('quickguard') && move.effectivePriority > 0 && move.flags.includes('protect')) ||
    (guards.has('wideguard') && move.spread) ||
    (guards.has('craftyshield') && status) ||
    (guards.has('matblock') && !status && move.flags.includes('protect'));
  if (!shielded && !guarded) return false;
  if (move.breaksProtect) {
    delete target.volatiles.protect;
    guards.clear();
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

function screened(battle: BattleState, me: BattleFighter, target: BattleFighter, move: AnyMove): boolean {
  if (flag(battle, me, 'infiltrates')) return false;
  const screens = battle.sides[sideIndexOf(battle, target)].screens;
  if (screens.auroraveil) return true;
  return move.category === 'physical' ? !!screens.reflect : !!screens.lightscreen;
}

const STATUSED = new Set<MajorStatus | null>(['brn', 'par', 'psn', 'tox']);

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
    case 'misty-explosion':
      return battle.field.terrain === 'misty' && grounded(battle, me) ? power * 1.5 : power;
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
    if (move.grounds && !target.volatiles.smackedDown && (target.types.includes('flying') || flag(battle, target, 'levitates') || target.volatiles.magnetRise || target.volatiles.telekinesis)) {
      target.volatiles.smackedDown = true;
      delete target.volatiles.magnetRise;
      delete target.volatiles.telekinesis;
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
  if (move.losesType && me.hp > 0) setTypes(battle, me, me.types.filter((t) => t !== move.losesType));
  if (move.id === 'steel-roller' && battle.field.terrain) clearTerrain(battle);
  if (move.id === 'glaive-rush') me.volatiles.glaiveRush = battle.turn;
  if (move.selfSwitch && me.hp > 0 && hasBench(battle, me)) me.volatiles.switchNow = true;
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

export const HIDDEN_BY: Record<string, string> = { fly: 'air', bounce: 'air', 'sky-drop': 'air', dig: 'ground', dive: 'water', 'phantom-force': 'vanished', 'shadow-force': 'vanished' };
const REACHES_HIDDEN: Record<string, string[]> = { air: ['gust', 'twister', 'thunder', 'sky-uppercut', 'hurricane', 'smack-down', 'thousand-arrows'], ground: ['earthquake', 'magnitude', 'fissure'], water: ['surf', 'whirlpool'], vanished: [] };

export function hiddenFrom(target: BattleFighter, move: AnyMove): boolean {
  if (target.volatiles.charging == null) return false;
  const place = HIDDEN_BY[target.moves[target.volatiles.charging]?.id];
  return !!place && !REACHES_HIDDEN[place].includes(move.id);
}

export function hits(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove): boolean {
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
  const evaStage = flag(battle, me, 'unaware') || flag(battle, me, 'ignoresEvasion') || target.volatiles.foresight || target.volatiles.miracleEye
    ? Math.min(0, target.boosts.eva)
    : target.boosts.eva;
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
  return battle.random() < [1 / 24, 1 / 8, 1 / 2, 1][clamp(stage, 0, 3)];
}

function ruin(battle: BattleState, fighter: BattleFighter, key: string): number {
  return otherActiveHas(battle, fighter, key) ? 0.75 : 1;
}

function powerMods(battle: BattleState, me: BattleFighter, target: BattleFighter, move: BattleMove): number {
  let multiplier = mul(battle, me, 'onBasePower', move, target) * mul(battle, target, 'onIncoming', move, me);
  if ((move.type === 'dark' && anyActiveHas(battle, 'dark-aura')) || (move.type === 'fairy' && anyActiveHas(battle, 'fairy-aura')))
    multiplier *= anyActiveHas(battle, 'aura-break') ? 0.75 : 4 / 3;
  const terrain = battle.field.terrain;
  if (grounded(battle, me)
    && ((terrain === 'electric' && move.type === 'electric')
      || (terrain === 'grassy' && move.type === 'grass')
      || (terrain === 'psychic' && move.type === 'psychic')))
    multiplier *= 1.3;
  if (grounded(battle, target) && terrain === 'misty' && move.type === 'dragon') multiplier *= 0.5;
  if (grounded(battle, target) && terrain === 'grassy' && move.weakenedByGrassyTerrain) multiplier *= 0.5;
  if (me.volatiles.charge && move.type === 'electric') multiplier *= 2;
  if (battle.field.rooms.mudsport && move.type === 'electric') multiplier /= 3;
  if (battle.field.rooms.watersport && move.type === 'fire') multiplier /= 3;
  return multiplier;
}

export function computeDamage(
  battle: BattleState,
  me: BattleFighter,
  target: BattleFighter,
  move: BattleMove,
  eff: number,
  hitPower: number,
): { dmg: number; crit: boolean } {
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

  const attack = Math.max(1, pokeRound(Math.floor(attacker.stats[atkKey] * stageMult(atkStage))
    * mul(battle, me, 'onAttack', move, target)
    * ruin(battle, me, physical ? 'tablets-of-ruin' : 'vessel-of-ruin')));
  const defStat = battle.field.rooms.wonderroom ? (defKey === 'def' ? 'sdef' : 'def') : defKey;
  let defense = Math.max(1, pokeRound(Math.floor(target.stats[defStat] * stageMult(defStage))
    * mul(battle, target, 'onDefense', move, me)
    * ruin(battle, target, physical ? 'sword-of-ruin' : 'beads-of-ruin')));
  if ((weather === 'sand' && !physical && target.types.includes('rock')) || (weather === 'snow' && physical && target.types.includes('ice'))) defense = pokeRound(defense * 1.5);

  const power = Math.max(1, pokeRound(hitPower * powerMods(battle, me, target, move)));
  const mw = weatherFor(battle, me);
  const weatherMod = isSun(mw)
    ? move.type === 'fire' || move.id === 'hydro-steam' ? 1.5 : move.type === 'water' ? 0.5 : 1
    : isRain(mw) ? (move.type === 'water' ? 1.5 : move.type === 'fire' ? 0.5 : 1) : 1;
  let final = !crit && screened(battle, me, target, move) ? 0.5 : 1;
  if ((move.id === 'collision-course' || move.id === 'electro-drift') && eff > 1) final *= 5461 / 4096;
  if (target.volatiles.glaiveRush != null && battle.turn - target.volatiles.glaiveRush <= 1) final *= 2;
  final *= mul(battle, me, 'onAttackerFinal', move, target, { eff, crit }) * mul(battle, target, 'onDefenderFinal', move, me, { eff, crit });
  const dmg = finishDamage(baseDamage(me.level, power, attack, defense), {
    weather: weatherMod,
    crit,
    roll: damageRoll(battle.random()),
    stab: move.type && me.types.includes(move.type) ? abilityDef(battle, me)?.stab ?? 1.5 : 1,
    eff,
    burned: me.status === 'brn' && physical && !flag(battle, me, 'ignoresBurn') && move.id !== 'facade',
    final,
  });
  return { dmg, crit };
}

export const pokeRound = (value: number): number => (value % 1 > 0.5 ? Math.ceil(value) : Math.floor(value));

export const damageRoll = (random: number): number => 85 + Math.min(15, Math.floor(random * 16));

export function baseDamage(level: number, power: number, attack: number, defense: number): number {
  return Math.floor(Math.floor(Math.floor((2 * level) / 5 + 2) * power * attack / defense) / 50) + 2;
}

export interface DamageModifiers {
  weather: number;
  crit: boolean;
  roll: number;
  stab: number;
  eff: number;
  burned: boolean;
  final: number;
}

export function finishDamage(base: number, mods: DamageModifiers): number {
  let dmg = pokeRound(base * mods.weather);
  if (mods.crit) dmg = Math.floor(dmg * 1.5);
  dmg = Math.floor((dmg * mods.roll) / 100);
  dmg = pokeRound(dmg * mods.stab);
  dmg = Math.floor(dmg * mods.eff);
  if (mods.burned) dmg = Math.floor(dmg / 2);
  dmg = pokeRound(dmg * mods.final);
  return Math.max(1, dmg);
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

export function attack(battle: BattleState, me: BattleFighter, target: BattleFighter | null, move: BattleMove, api: MoveRuleApi): number | undefined {
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
    const fixed = rules?.damage ? rules.damage(api, me, target, move) : undefined;
    if (fixed === null) {
      emit(battle, { t: 'nothing', side: sideIndex });
      return 0;
    }
    if (move.breaksScreens) clearScreens(battle, sideIndexOf(battle, target), 'broken');
    move.power = rules?.power ? rules.power(api, me, target, move) : basePower(battle, me, target, move);
    if (move.id === 'spectral-thief') stealBoosts(battle, me, target);
    const eff = chain(battle, target, 'onEffectiveness', typeEff || 1, move, me);
    const count = rules?.hits ? rules.hits(api, me) : rollHits(battle, me, move);
    let total = 0;
    let lastHit = 0;
    let landed = 0;
    let toSub = false;
    for (let i = 0; i < count && target.hp > 0 && me.hp > 0; i++) {
      const hitPower = rules?.hitPower ? rules.hitPower(api, me, i) : i > 0 && !move.multihit ? move.power * 0.25 : move.power;
      const { dmg, crit } = fixed !== undefined
        ? { dmg: fixed, crit: false }
        : move.ohko || move.fixedDamage
          ? { dmg: fixedDamage(me, target, move), crit: false }
          : computeDamage(battle, me, target, move, eff, hitPower);
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
    if (move.recoil && total > 0 && !flag(battle, me, 'noRecoil')) hurt(battle, me, Math.round(total * move.recoil), 'recoil');
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
    rules?.hit?.(api, me, target, move, total);
    return total;
  } finally {
    battle.moldBreaker = null;
  }
}

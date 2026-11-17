// Every change the engine makes to a fighter, a side or the field: HP, stat stages, status, volatiles, types,
// forms, weather, terrain, screens and hazards. Each one checks its own immunities, calls the ability hooks that
// react to it and emits its event. Also who is where: the active fighters, their sides and their bench.
import { type BoostKey, type Boosts, formData, type MajorStatus, statsFor, type Weather } from '../../catalog/domain/creatures.js';
import type { BoostChanges } from './ability-effects.js';
import { isSun, poisoned, stageMult } from './conditions.js';
import type { BattleEvent, BattleFighter, BattleSide, BattleState, Look } from './battle-types.js';
import { anyActiveHas, chain, flag, run, showAbility } from './ability-engine.js';
import { publicMoves } from './battle-view.js';

export const STAGE_LIMIT = 6;
const FIELD_TURNS = 5;
const PRIMAL = new Set<Weather | null>(['heavyrain', 'harshsun', 'winds']);
export const SCREEN_KINDS = ['reflect', 'lightscreen', 'auroraveil'];
const VEIL_WEATHER = new Set<Weather | null>(['hail', 'snow']);

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
/** Slots of the side's Pokémon that could come in. */
export const benchSlots = (side: BattleSide): number[] => side.team.flatMap((fighter, slot) => (slot !== side.active && fighter.hp > 0 ? [slot] : []));

export interface BoostOptions {
  /** Highest stage a raise may reach (Belly Drum and friends go to +6 anyway). */
  cap?: number;
  /** Ability that caused the change, shown before it. */
  ability?: BattleFighter;
  /** What caused it (e.g. 'intimidate'), for the rules that react to it. */
  effect?: string;
}

const MAX_TOXIC_SPIKES = 2;
const DIRECT_DAMAGE = new Set(['confusion', 'cost', 'painsplit']);

export function boost(battle: BattleState, fighter: BattleFighter, changes: Boosts, source: BattleFighter | null = null, opts: BoostOptions = {}): Boosts {
  if (fighter.hp <= 0) return {};
  const ch: BoostChanges = { ...changes } as BoostChanges;
  if (source && source !== fighter && battle.sides[sideIndexOf(battle, fighter)].conds.mist)
    for (const key of Object.keys(ch)) if (ch[key] < 0) delete ch[key];
  run(battle, fighter, 'onTryBoost', ch, source, opts.effect);
  run(battle, fighter, 'onChangeBoost', ch);
  const applied: Boosts = {};
  for (const [stat, by] of Object.entries(ch) as [BoostKey, number][]) {
    if (!by) continue;
    const cur = fighter.boosts[stat];
    const next = clamp(cur + by, -STAGE_LIMIT, by > 0 ? (opts.cap ?? STAGE_LIMIT) : STAGE_LIMIT);
    if (next !== cur) applied[stat] = next - cur;
  }
  const changed = Object.entries(applied) as [BoostKey, number][];
  if (changed.length && opts.ability) showAbility(battle, opts.ability);
  for (const [stat, by] of changed) {
    fighter.boosts[stat] += by;
    emit(battle, { t: 'boost', side: sideIndexOf(battle, fighter), stat, by, stage: fighter.boosts[stat] });
  }
  if (source && source !== fighter && ((Object.values(applied) as number[]).some((v) => v < 0) || opts.effect === 'intimidate'))
    run(battle, fighter, 'onAfterEachBoost', applied, source, opts.effect);
  const ups: Boosts = Object.fromEntries((Object.entries(applied) as [BoostKey, number][]).filter(([, v]) => v > 0));
  const foe = foeOf(battle, fighter);
  if (foe && Object.keys(ups).length) run(battle, foe, 'onFoeBoost', fighter, ups, opts.effect);
  return applied;
}

export function grounded(battle: BattleState, fighter: BattleFighter): boolean {
  if (fighter.volatiles.smackedDown || fighter.volatiles.ingrain || battle.field.rooms.gravity) return true;
  if (fighter.volatiles.magnetRise || fighter.volatiles.telekinesis) return false;
  return !defendingTypes(battle, fighter).includes('flying') && !flag(battle, fighter, 'levitates');
}

export function defendingTypes(battle: BattleState, fighter: BattleFighter): string[] {
  if (fighter.volatiles.roost !== battle.turn || !fighter.types.includes('flying')) return fighter.types;
  const landed = fighter.types.filter((type) => type !== 'flying');
  return landed.length ? landed : ['normal'];
}

export function currentWeather(battle: BattleState): Weather | null {
  if (anyActiveHas(battle, 'cloud-nine') || anyActiveHas(battle, 'air-lock')) return null;
  return battle.field.weather;
}

export function weatherFor(battle: BattleState, fighter: BattleFighter): Weather | null {
  const weather = currentWeather(battle);
  return !weather && flag(battle, fighter, 'actsInSun') ? 'harshsun' : weather;
}

export function statusImmune(battle: BattleState, fighter: BattleFighter, status: MajorStatus, source: BattleFighter | null): boolean {
  if (status === 'brn' && fighter.types.includes('fire')) return true;
  if (status === 'par' && fighter.types.includes('electric')) return true;
  if (status === 'frz' && (fighter.types.includes('ice') || isSun(currentWeather(battle)))) return true;
  if (poisoned(status) && (fighter.types.includes('poison') || fighter.types.includes('steel')) && !(source && flag(battle, source, 'corrosion')))
    return true;
  if (grounded(battle, fighter) && battle.field.terrain === 'misty') return true;
  if (status === 'slp' && grounded(battle, fighter) && battle.field.terrain === 'electric') return true;
  return false;
}

export function setStatus(
  battle: BattleState,
  fighter: BattleFighter,
  status: MajorStatus,
  source: BattleFighter | null = null,
  opts: { ability?: BattleFighter } = {},
): boolean {
  if (fighter.hp <= 0 || fighter.status) return false;
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

export function cure(battle: BattleState, fighter: BattleFighter, announce = true): void {
  if (!fighter.status) return;
  const status = fighter.status;
  fighter.status = null;
  fighter.statusTurns = 0;
  if (announce) emit(battle, { t: 'cure', side: sideIndexOf(battle, fighter), name: nameOf(fighter), status });
}

export function addVolatile(
  battle: BattleState,
  fighter: BattleFighter,
  kind: string,
  source: BattleFighter | null = null,
  opts: { ability?: BattleFighter; move?: { key: string; name: string } } = {},
): boolean {
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
  else if (kind === 'attract' && source) fighter.volatiles.attract = source;
  else if (kind === 'disable') fighter.volatiles.disabled = { key: opts.move!.key, name: opts.move!.name, turns: 4 };
  else if (kind === 'perish') fighter.volatiles.perish = 4;
  else if (kind === 'charge') fighter.volatiles.charge = true;
  else if (kind === 'leechseed') fighter.volatiles.leechSeed = true;
  if (kind !== 'flinch')
    emit(battle, { t: 'volatile', side: sideIndex, name: nameOf(fighter), kind, ...(kind === 'disable' ? { move: opts.move!.name } : {}) });
  return true;
}

export function hurt(battle: BattleState, fighter: BattleFighter, amount: number, cause?: string | null): number {
  if (fighter.hp <= 0) return 0;
  if (!DIRECT_DAMAGE.has(cause ?? '') && flag(battle, fighter, 'noIndirectDamage')) return 0;
  const dealt = Math.min(fighter.hp, Math.max(1, Math.floor(amount)));
  fighter.hp -= dealt;
  emit(battle, { t: 'hurt', side: sideIndexOf(battle, fighter), amount: dealt, hp: fighter.hp, max: fighter.stats.hp, cause });
  return dealt;
}

export function heal(battle: BattleState, fighter: BattleFighter, amount: number, opts: { silent?: boolean } = {}): number {
  if (fighter.hp <= 0 || fighter.hp >= fighter.stats.hp || fighter.volatiles.healBlock) return 0;
  const healed = Math.min(fighter.stats.hp - fighter.hp, Math.max(1, Math.floor(amount)));
  fighter.hp += healed;
  emit(battle, {
    t: 'heal',
    side: sideIndexOf(battle, fighter),
    amount: healed,
    hp: fighter.hp,
    max: fighter.stats.hp,
    ...(opts.silent ? { quiet: true } : {}),
  });
  return healed;
}

export function setTypes(battle: BattleState, fighter: BattleFighter, types: readonly string[]): void {
  fighter.types = [...types];
  emit(battle, { t: 'types', side: sideIndexOf(battle, fighter), types: fighter.types });
}

export function setWeather(battle: BattleState, weather: Weather, source: BattleFighter | null): boolean {
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

export function clearWeather(battle: BattleState): void {
  const weather = battle.field.weather;
  if (!weather) return;
  battle.field.weather = null;
  battle.field.weatherTurns = 0;
  battle.field.weatherSetter = null;
  emit(battle, { t: 'weatherEnd', weather });
  for (const fighter of activeFighters(battle)) run(battle, fighter, 'onWeatherChange');
}

export function setTerrain(battle: BattleState, terrain: string, source: BattleFighter | null): boolean {
  if (battle.field.terrain === terrain) return false;
  if (source) showAbility(battle, source);
  battle.field.terrain = terrain;
  battle.field.terrainTurns = FIELD_TURNS;
  emit(battle, { t: 'terrain', terrain });
  for (const fighter of activeFighters(battle)) run(battle, fighter, 'onTerrainChange');
  return true;
}

export function clearTerrain(battle: BattleState): void {
  const terrain = battle.field.terrain;
  if (!terrain) return;
  battle.field.terrain = null;
  battle.field.terrainTurns = 0;
  emit(battle, { t: 'terrainEnd', terrain });
  for (const fighter of activeFighters(battle)) run(battle, fighter, 'onTerrainChange');
}

export function setScreen(battle: BattleState, sideIndex: number, kind: string): boolean {
  const side = battle.sides[sideIndex];
  if (side.screens[kind]) return false;
  if (kind === 'auroraveil' && !VEIL_WEATHER.has(currentWeather(battle))) return false;
  side.screens[kind] = FIELD_TURNS;
  emit(battle, { t: 'screen', side: sideIndex, screen: kind, turns: FIELD_TURNS });
  return true;
}

export function clearScreens(battle: BattleState, sideIndex: number, cause: string): boolean {
  const side = battle.sides[sideIndex];
  const kinds = SCREEN_KINDS.filter((k) => side.screens[k]);
  for (const kind of kinds) {
    delete side.screens[kind];
    emit(battle, { t: 'screenEnd', side: sideIndex, screen: kind, cause });
  }
  return kinds.length > 0;
}

export function clearHazards(battle: BattleState, sideIndex: number): boolean {
  const side = battle.sides[sideIndex];
  let did = clearToxicSpikes(battle, sideIndex);
  const { hazards } = side;
  for (const kind of ['spikes', 'stealthrock', 'stickyweb'] as const) {
    if (!hazards[kind]) continue;
    if (kind === 'spikes') hazards.spikes = 0;
    else hazards[kind] = false;
    emit(battle, { t: 'sideEnd', side: sideIndex, kind });
    did = true;
  }
  return did;
}

export function clearToxicSpikes(battle: BattleState, sideIndex: number): boolean {
  if (!battle.sides[sideIndex].toxicSpikes) return false;
  battle.sides[sideIndex].toxicSpikes = 0;
  emit(battle, { t: 'hazardEnd', side: sideIndex });
  return true;
}

export function addToxicSpikes(battle: BattleState, sideIndex: number): boolean {
  const side = battle.sides[sideIndex];
  if (side.toxicSpikes >= MAX_TOXIC_SPIKES) return false;
  side.toxicSpikes += 1;
  emit(battle, { t: 'hazard', side: sideIndex, layers: side.toxicSpikes });
  return true;
}

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

export function transform(battle: BattleState, fighter: BattleFighter, into: BattleFighter): void {
  fighter.volatiles.transformed = {
    types: fighter.types,
    stats: fighter.stats,
    moves: fighter.moves,
    sprite: fighter.sprite,
    floats: fighter.floats,
    pp: fighter.pp,
  };
  fighter.types = [...into.types];
  fighter.stats = { ...into.stats, hp: fighter.stats.hp };
  fighter.moves = into.moves.map((m) => ({ ...m, flags: [...m.flags] }));
  fighter.pp = Object.fromEntries(fighter.moves.map((m) => [m.key, 5]));
  fighter.sprite = into.sprite;
  fighter.floats = into.floats;
  fighter.boosts = { ...into.boosts };
  fighter.ability = into.ability;
  emit(battle, {
    t: 'transform',
    side: sideIndexOf(battle, fighter),
    into: nameOf(into),
    sprite: fighter.sprite,
    floats: fighter.floats,
    types: fighter.types,
    stats: fighter.stats,
    moves: publicMoves(fighter),
    boosts: fighter.boosts,
  });
}

export function changeForm(battle: BattleState, fighter: BattleFighter, form: string | null, { permanent = false }: { permanent?: boolean } = {}): void {
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
  emit(battle, {
    t: 'form',
    side: sideIndexOf(battle, fighter),
    form,
    stats,
    types: fighter.types,
    sprite: fighter.sprite,
    hp: fighter.hp,
    max: stats.hp,
  });
}

export function breakIllusion(fighter: BattleFighter): boolean {
  if (!fighter.volatiles.illusion) return false;
  delete fighter.volatiles.illusion;
  fighter.seenAs = null;
  return true;
}

export function speedOf(battle: BattleState, fighter: BattleFighter): number {
  let spd = fighter.stats.spd * stageMult(fighter.boosts.spd);
  if (battle.sides[sideIndexOf(battle, fighter)]?.conds.tailwind) spd *= 2;
  spd = chain(battle, fighter, 'onSpeed', spd);
  if (fighter.status === 'par' && !flag(battle, fighter, 'ignoresParalysisSpeed')) spd *= 0.5;
  return spd;
}

export const asleep = (battle: BattleState, fighter: BattleFighter): boolean => fighter.status === 'slp' || flag(battle, fighter, 'comatose');

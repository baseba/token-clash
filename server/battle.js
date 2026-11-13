// Turn-based battle engine. Pure: no I/O, randomness injected, so it can be tested and replayed.
import { buildFighter, effectiveness, formData, statsFor, STRUGGLE } from './creatures.js';
import { ABILITIES, abilityInfo } from './abilities.js';

export const TEAM_SIZE = 3;
export const TURN_LIMIT = 100;
const STAGE_MAX = 3;
const STAGE_LIMIT = 6;
const FIELD_TURNS = 5;
const PRIMAL = new Set(['heavyrain', 'harshsun', 'winds']);
const MAJOR = new Set(['brn', 'par', 'psn', 'tox', 'slp', 'frz']);
const SAND_PROOF = ['rock', 'ground', 'steel'];
const SCREEN_KINDS = ['reflect', 'lightscreen', 'auroraveil'];
const VEIL_WEATHER = new Set(['hail', 'snow']);

const stageMult = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const accuracyMult = (s) => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));
const freshBoosts = () => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, acc: 0, eva: 0 });
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const isSun = (w) => w === 'sun' || w === 'harshsun';
const isRain = (w) => w === 'rain' || w === 'heavyrain';
const poisoned = (status) => status === 'psn' || status === 'tox';
const isAttack = (move) => move.category !== 'status';
export const STRUGGLE_MOVE = -1;
const HEALS_WITH_WEATHER = { synthesis: 'sun', 'morning-sun': 'sun', moonlight: 'sun', 'shore-up': 'sand' };

function prepare(entry, levelCap) {
  const f = buildFighter(entry, { levelCap });
  return {
    ...f,
    hp: f.stats.hp,
    boosts: freshBoosts(),
    status: null,
    statusTurns: 0,
    vol: {},
    activeTurns: 0,
    form: null,
    baseTypes: [...f.types],
    baseStats: { ...f.stats },
    baseSprite: f.sprite,
    speciesStats: { ...f.stats },
    speciesTypes: [...f.types],
    seen: false,
    seenAs: null,
    baseAbility: f.ability,
    revealedAbilities: new Set(),
    revealedMoves: new Set(),
    pp: Object.fromEntries(f.moves.map((m) => [m.key, m.pp])),
  };
}

export function createBattle({ id, sides, levelCap = null, random = Math.random }) {
  const b = {
    id,
    levelCap,
    random,
    status: 'active',
    phase: 'choose',
    turn: 1,
    winner: null,
    field: { weather: null, weatherTurns: 0, weatherSetter: null, terrain: null, terrainTurns: 0 },
    sides: sides.map((s) => ({
      trainerId: s.trainerId,
      name: s.name,
      team: s.entries.slice(0, TEAM_SIZE).map((e) => prepare(e, levelCap)),
      active: 0,
      action: null,
      mustSwitch: false,
      toxicSpikes: 0,
      screens: {},
    })),
    ev: [],
    moved: new Set(),
    mold: null,
  };
  b.intro = withEvents(b, () => {
    const leads = entryOrder(b, [0, 1]);
    for (const s of leads) prepareEntry(b, s);
    for (const s of leads) runEntry(b, s);
    settle(b);
  });
  return b;
}

function withEvents(b, fn) {
  const events = [];
  b.ev = events;
  fn();
  b.ev = [];
  return events;
}

const emit = (b, ev) => b.ev.push(ev);
const activeOf = (b, s) => b.sides[s].team[b.sides[s].active];
const sideIndex = (b, f) => b.sides.findIndex((side) => side.team.includes(f));
const onField = (b, f) => f.hp > 0 && activeOf(b, sideIndex(b, f)) === f;
const activeFighters = (b) => [0, 1].map((s) => activeOf(b, s)).filter((f) => f.hp > 0);
const foeOf = (b, f) => {
  const foe = activeOf(b, 1 - sideIndex(b, f));
  return foe.hp > 0 ? foe : null;
};
const nameOf = (f) => f.vol.illusion?.name ?? f.name;

// ---------- abilities ----------

function abilityKey(b, f) {
  const key = f.ability;
  const def = key && ABILITIES[key];
  if (!def) return null;
  if (!def.unsuppressable && activeFighters(b).some((o) => o !== f && o.ability === 'neutralizing-gas')) return null;
  if (def.breakable && b.mold && b.mold.target === f) return null;
  return key;
}

const abilityDef = (b, f) => ABILITIES[abilityKey(b, f)] ?? null;
const run = (b, f, hook, ...args) => abilityDef(b, f)?.[hook]?.(engine(b), f, ...args);
const flag = (b, f, name) => !!abilityDef(b, f)?.[name];

function mul(b, f, hook, ...args) {
  const r = run(b, f, hook, ...args);
  return typeof r === 'number' ? r : 1;
}

function chain(b, f, hook, value, ...args) {
  const r = run(b, f, hook, ...args, value);
  return typeof r === 'number' ? r : value;
}

const anyActiveHas = (b, key) => activeFighters(b).some((f) => abilityKey(b, f) === key);
const otherActiveHas = (b, f, key) => activeFighters(b).some((o) => o !== f && abilityKey(b, o) === key);

const engines = new WeakMap();
function engine(b) {
  let E = engines.get(b);
  if (E) return E;
  E = {
    b,
    rand: () => b.random(),
    foe: (f) => foeOf(b, f),
    has: (f, key) => abilityKey(b, f) === key,
    anyActiveHas: (key) => anyActiveHas(b, key),
    show: (f, note, extra) => showAbility(b, f, note, extra),
    note: (f, kind) => emit(b, { t: kind, side: sideIndex(b, f) }),
    boost: (f, changes, source, opts) => boost(b, f, changes, source, opts),
    damage: (f, amount, cause) => hurt(b, f, amount, cause),
    heal: (f, amount, source, opts) => heal(b, f, amount, opts),
    setStatus: (f, status, source, opts) => setStatus(b, f, status, source, opts),
    addVolatile: (f, kind, source, opts) => addVolatile(b, f, kind, source, opts),
    cure: (f, announce) => cure(b, f, announce),
    weather: () => weather(b),
    terrain: () => b.field.terrain,
    setWeather: (w, source) => setWeather(b, w, source),
    setTerrain: (t, source) => setTerrain(b, t, source),
    grounded: (f) => grounded(b, f),
    asleep: (f) => f.status === 'slp' || flag(b, f, 'comatose'),
    effectiveness: (move, attacker, target) => typeEffectiveness(b, move, attacker, target),
    setTypes: (f, types) => setTypes(b, f, types),
    setAbility: (f, key) => setAbility(b, f, key),
    hasMoved: (f) => b.moved.has(f),
    hasBench: (f) => b.sides[sideIndex(b, f)].team.some((o) => o !== f && o.hp > 0),
    faintedAllies: (f) => b.sides[sideIndex(b, f)].team.filter((o) => o !== f && o.hp <= 0).length,
    addToxicSpikes: (f) => addToxicSpikes(b, f),
    clearScreens: (s, cause) => clearScreens(b, s, cause),
    transform: (f, into) => transform(b, f, into),
    changeForm: (f, form, opts) => changeForm(b, f, form, opts),
    breakIllusion: (f) => breakIllusion(b, f),
    look: (f) => lookOf(f),
  };
  engines.set(b, E);
  return E;
}

function showAbility(b, f, note = null, extra = {}) {
  const info = abilityInfo(f.ability);
  f.revealedAbilities.add(f.ability);
  if (extra.copied) {
    const foe = foeOf(b, f);
    if (foe && foe.ability === extra.copied) foe.revealedAbilities.add(extra.copied);
  }
  if (extra.move) {
    const foe = foeOf(b, f);
    const known = foe?.moves.find((m) => m.name === extra.move);
    if (known) foe.revealedMoves.add(known.key);
  }
  emit(b, { t: 'ability', side: sideIndex(b, f), name: nameOf(f), ability: info?.name ?? f.ability, info, ...(note ? { note } : {}), ...extra, ...(extra.copied ? { copied: abilityInfo(extra.copied)?.name } : {}) });
}

function setAbility(b, f, key) {
  f.ability = key;
  f.revealedAbilities.add(key);
  emit(b, { t: 'abilityChange', side: sideIndex(b, f), ability: abilityInfo(key) });
}

// ---------- stats, boosts and status ----------

function boost(b, f, changes, source = null, opts = {}) {
  if (f.hp <= 0) return {};
  const ch = { ...changes };
  run(b, f, 'onTryBoost', ch, source, opts.effect);
  run(b, f, 'onChangeBoost', ch);
  const applied = {};
  for (const [stat, by] of Object.entries(ch)) {
    if (!by) continue;
    const cur = f.boosts[stat];
    const next = clamp(cur + by, -STAGE_LIMIT, by > 0 ? (opts.cap ?? STAGE_LIMIT) : STAGE_LIMIT);
    if (next !== cur) applied[stat] = next - cur;
  }
  const stats = Object.keys(applied);
  if (stats.length && opts.ability) showAbility(b, opts.ability);
  for (const stat of stats) {
    f.boosts[stat] += applied[stat];
    emit(b, { t: 'boost', side: sideIndex(b, f), stat, by: applied[stat], stage: f.boosts[stat] });
  }
  if (source && source !== f && (Object.values(applied).some((v) => v < 0) || opts.effect === 'intimidate')) run(b, f, 'onAfterEachBoost', applied, source, opts.effect);
  const ups = Object.fromEntries(Object.entries(applied).filter(([, v]) => v > 0));
  const foe = foeOf(b, f);
  if (foe && Object.keys(ups).length) run(b, foe, 'onFoeBoost', f, ups, opts.effect);
  return applied;
}

function grounded(b, f) {
  return !f.types.includes('flying') && !flag(b, f, 'levitates');
}

function weather(b) {
  if (anyActiveHas(b, 'cloud-nine') || anyActiveHas(b, 'air-lock')) return null;
  return b.field.weather;
}

function weatherFor(b, f) {
  const w = weather(b);
  return !w && flag(b, f, 'actsInSun') ? 'harshsun' : w;
}

function statusImmune(b, f, status, source) {
  if (status === 'brn' && f.types.includes('fire')) return true;
  if (status === 'par' && f.types.includes('electric')) return true;
  if (status === 'frz' && (f.types.includes('ice') || isSun(weather(b)))) return true;
  if (poisoned(status) && (f.types.includes('poison') || f.types.includes('steel')) && !(source && flag(b, source, 'corrosion'))) return true;
  if (grounded(b, f) && b.field.terrain === 'misty') return true;
  if (status === 'slp' && grounded(b, f) && b.field.terrain === 'electric') return true;
  return false;
}

function setStatus(b, f, status, source = null, opts = {}) {
  if (f.hp <= 0 || f.status || !MAJOR.has(status)) return false;
  if (statusImmune(b, f, status, source)) return false;
  if (run(b, f, 'onSetStatus', status, source) === false) return false;
  if (opts.ability) showAbility(b, opts.ability);
  f.status = status;
  f.statusTurns = status === 'slp' ? 1 + Math.floor(b.random() * 3) : 0;
  emit(b, { t: 'status', side: sideIndex(b, f), name: nameOf(f), status });
  run(b, f, 'onAfterSetStatus', status, source);
  if (source && source !== f) run(b, source, 'onInflictStatus', f, status);
  return true;
}

function cure(b, f, announce = true) {
  if (!f.status) return;
  const status = f.status;
  f.status = null;
  f.statusTurns = 0;
  if (announce) emit(b, { t: 'cure', side: sideIndex(b, f), name: nameOf(f), status });
}

function addVolatile(b, f, kind, source = null, opts = {}) {
  if (f.hp <= 0) return false;
  if (kind === 'confusion' && (f.vol.confusion || (grounded(b, f) && b.field.terrain === 'misty'))) return false;
  if (kind === 'attract' && (f.vol.attract || !f.gender || !source?.gender || f.gender === source.gender)) return false;
  if (kind === 'disable' && (f.vol.disabled || !opts.move?.key)) return false;
  if (kind === 'perish' && f.vol.perish) return false;
  if (kind === 'leechseed' && (f.vol.leechSeed || f.types.includes('grass'))) return false;
  if (run(b, f, 'onSetStatus', kind, source) === false) return false;
  if (opts.ability) showAbility(b, opts.ability);
  const side = sideIndex(b, f);
  if (kind === 'flinch') f.vol.flinch = true;
  else if (kind === 'confusion') f.vol.confusion = 2 + Math.floor(b.random() * 4);
  else if (kind === 'attract') f.vol.attract = source;
  else if (kind === 'disable') f.vol.disabled = { key: opts.move.key, name: opts.move.name, turns: 4 };
  else if (kind === 'perish') f.vol.perish = 4;
  else if (kind === 'charge') f.vol.charge = true;
  else if (kind === 'leechseed') f.vol.leechSeed = true;
  if (kind !== 'flinch') emit(b, { t: 'volatile', side, name: nameOf(f), kind, ...(kind === 'disable' ? { move: opts.move.name } : {}) });
  return true;
}

function hurt(b, f, amount, cause) {
  if (f.hp <= 0) return 0;
  if (cause !== 'confusion' && flag(b, f, 'noIndirectDamage')) return 0;
  const dealt = Math.min(f.hp, Math.max(1, Math.floor(amount)));
  f.hp -= dealt;
  emit(b, { t: 'hurt', side: sideIndex(b, f), amount: dealt, hp: f.hp, max: f.stats.hp, cause });
  return dealt;
}

function heal(b, f, amount, opts = {}) {
  if (f.hp <= 0 || f.hp >= f.stats.hp) return 0;
  const healed = Math.min(f.stats.hp - f.hp, Math.max(1, Math.floor(amount)));
  f.hp += healed;
  emit(b, { t: 'heal', side: sideIndex(b, f), amount: healed, hp: f.hp, max: f.stats.hp, ...(opts.silent ? { quiet: true } : {}) });
  return healed;
}

function setTypes(b, f, types) {
  f.types = [...types];
  emit(b, { t: 'types', side: sideIndex(b, f), types: f.types });
}

function setWeather(b, w, source) {
  const cur = b.field.weather;
  if (cur === w) return false;
  if (PRIMAL.has(cur) && !PRIMAL.has(w)) return false;
  if (source) showAbility(b, source);
  b.field.weather = w;
  b.field.weatherTurns = PRIMAL.has(w) ? Infinity : FIELD_TURNS;
  b.field.weatherSetter = PRIMAL.has(w) ? source : null;
  emit(b, { t: 'weather', weather: w });
  for (const f of activeFighters(b)) run(b, f, 'onWeatherChange');
  return true;
}

function clearWeather(b) {
  const w = b.field.weather;
  if (!w) return;
  b.field.weather = null;
  b.field.weatherTurns = 0;
  b.field.weatherSetter = null;
  emit(b, { t: 'weatherEnd', weather: w });
  for (const f of activeFighters(b)) run(b, f, 'onWeatherChange');
}

function setTerrain(b, t, source) {
  if (b.field.terrain === t) return false;
  if (source) showAbility(b, source);
  b.field.terrain = t;
  b.field.terrainTurns = FIELD_TURNS;
  emit(b, { t: 'terrain', terrain: t });
  for (const f of activeFighters(b)) run(b, f, 'onTerrainChange');
  return true;
}

function clearTerrain(b) {
  const t = b.field.terrain;
  if (!t) return;
  b.field.terrain = null;
  b.field.terrainTurns = 0;
  emit(b, { t: 'terrainEnd', terrain: t });
  for (const f of activeFighters(b)) run(b, f, 'onTerrainChange');
}

function setScreen(b, s, kind) {
  const side = b.sides[s];
  if (side.screens[kind]) return false;
  if (kind === 'auroraveil' && !VEIL_WEATHER.has(weather(b))) return false;
  side.screens[kind] = FIELD_TURNS;
  emit(b, { t: 'screen', side: s, screen: kind, turns: FIELD_TURNS });
  return true;
}

function clearScreens(b, s, cause) {
  const side = b.sides[s];
  const kinds = SCREEN_KINDS.filter((k) => side.screens[k]);
  for (const kind of kinds) {
    delete side.screens[kind];
    emit(b, { t: 'screenEnd', side: s, screen: kind, cause });
  }
  return kinds.length > 0;
}

function clearToxicSpikes(b, s) {
  if (!b.sides[s].toxicSpikes) return false;
  b.sides[s].toxicSpikes = 0;
  emit(b, { t: 'hazardEnd', side: s });
  return true;
}

function screened(b, me, target, move) {
  if (flag(b, me, 'infiltrates')) return false;
  const screens = b.sides[sideIndex(b, target)].screens;
  if (screens.auroraveil) return true;
  return move.category === 'physical' ? !!screens.reflect : !!screens.lightscreen;
}

function addToxicSpikes(b, f) {
  const side = b.sides[sideIndex(b, f)];
  if (side.toxicSpikes >= 2) return false;
  side.toxicSpikes += 1;
  emit(b, { t: 'hazard', side: sideIndex(b, f), layers: side.toxicSpikes });
  return true;
}

function lookOf(f) {
  return { name: f.name, speciesName: f.speciesName, sprite: f.sprite, floats: f.floats, types: f.types, shiny: f.shiny, rarity: f.rarity };
}

function transform(b, f, into) {
  f.vol.transformed = { types: f.types, stats: f.stats, moves: f.moves, sprite: f.sprite, floats: f.floats, pp: f.pp };
  f.types = [...into.types];
  f.stats = { ...into.stats, hp: f.stats.hp };
  f.moves = into.moves.map((m) => ({ ...m, flags: [...m.flags] }));
  f.pp = Object.fromEntries(f.moves.map((m) => [m.key, 5]));
  f.sprite = into.sprite;
  f.floats = into.floats;
  f.boosts = { ...into.boosts };
  f.ability = into.ability;
  emit(b, { t: 'transform', side: sideIndex(b, f), into: nameOf(into), sprite: f.sprite, floats: f.floats, types: f.types, stats: f.stats, moves: publicMoves(f), boosts: f.boosts });
}

function changeForm(b, f, form, { permanent = false } = {}) {
  const data = form ? formData(form) : null;
  if (form && !data) return;
  const stats = data ? statsFor(data.base, f.ivs, f.level) : { ...f.speciesStats };
  const gained = stats.hp - f.stats.hp;
  f.stats = stats;
  f.hp = f.hp > 0 ? clamp(f.hp + gained, 1, stats.hp) : 0;
  f.types = data ? [...data.types] : [...f.speciesTypes];
  f.sprite = data ? data.sprite : String(f.speciesId);
  f.form = form;
  if (permanent) {
    f.baseStats = { ...stats };
    f.baseTypes = [...f.types];
    f.baseSprite = f.sprite;
    f.permanentForm = form;
  }
  emit(b, { t: 'form', side: sideIndex(b, f), form, stats, types: f.types, sprite: f.sprite, hp: f.hp, max: stats.hp });
}

function breakIllusion(b, f) {
  if (!f.vol.illusion) return false;
  delete f.vol.illusion;
  f.seenAs = null;
  return true;
}

function typeEffectiveness(b, move, attacker, target) {
  if (!move.type) return 1;
  let eff = 1;
  for (const type of target.types) {
    let e = effectiveness(move.type, [type]);
    if (e === 0 && type === 'ghost' && (move.type === 'normal' || move.type === 'fighting') && flag(b, attacker, 'hitsGhost')) e = 1;
    if (e > 1 && type === 'flying' && weather(b) === 'winds') e = 1;
    eff *= e;
  }
  return eff;
}

function speedOf(b, f) {
  let spd = f.stats.spd * stageMult(f.boosts.spd);
  spd = chain(b, f, 'onSpeed', spd);
  if (f.status === 'par' && !flag(b, f, 'ignoresParalysisSpeed')) spd *= 0.5;
  return spd;
}

// ---------- switching ----------

function prepareEntry(b, s) {
  const f = activeOf(b, s);
  f.vol = { enteredTurn: b.turn };
  f.activeTurns = 0;
  if (flag(b, f, 'disguisesOnEntry')) {
    const mate = [...b.sides[s].team].reverse().find((o) => o !== f && o.hp > 0);
    if (mate) f.vol.illusion = lookOf(mate);
  }
  f.seen = true;
  f.seenAs = f.vol.illusion ?? null;
}

function runEntry(b, s) {
  const f = activeOf(b, s);
  if (f.hp <= 0) return;
  const side = b.sides[s];
  if (side.toxicSpikes && grounded(b, f)) {
    if (f.types.includes('poison')) {
      side.toxicSpikes = 0;
      emit(b, { t: 'hazardEnd', side: s });
    } else setStatus(b, f, side.toxicSpikes >= 2 ? 'tox' : 'psn', null);
  }
  run(b, f, 'onStart');
}

function leave(b, f) {
  const hadGas = f.ability === 'neutralizing-gas';
  if (f.hp > 0) run(b, f, 'onSwitchOut');
  if (f.vol.transformed) Object.assign(f, f.vol.transformed);
  f.boosts = freshBoosts();
  f.vol = {};
  f.types = [...f.baseTypes];
  f.ability = f.baseAbility;
  if (f.form !== (f.permanentForm ?? null)) {
    const max = f.stats.hp;
    f.stats = { ...f.baseStats };
    f.sprite = f.baseSprite;
    if (f.hp > 0) f.hp = clamp(f.hp + f.stats.hp - max, 1, f.stats.hp);
    f.form = f.permanentForm ?? null;
  }
  if (b.field.weatherSetter === f) clearWeather(b);
  return hadGas;
}

function doSwitch(b, s, to) {
  const side = b.sides[s];
  const old = activeOf(b, s);
  const hadGas = leave(b, old);
  side.active = to;
  prepareEntry(b, s);
  const f = activeOf(b, s);
  emit(b, { t: 'switch', side: s, to, name: nameOf(f), from: old.seenAs?.name ?? old.name, forced: old.hp <= 0, card: fighterView(b, s, to, true), seen: fighterView(b, s, to, false) });
  return hadGas;
}

function entryOrder(b, sides) {
  const gas = (s) => (activeOf(b, s).ability === 'neutralizing-gas' ? 1 : 0);
  return [...sides].sort((x, y) => gas(y) - gas(x) || speedOf(b, activeOf(b, y)) - speedOf(b, activeOf(b, x)));
}

function wakeAbilities(b, except) {
  for (const f of activeFighters(b)) if (f !== except) run(b, f, 'onStart');
}

// ---------- faints ----------

function faint(b, f, by = null, move = null, lastHit = 0) {
  if (f.fainted || f.hp > 0) return;
  f.fainted = true;
  const hadGas = f.ability === 'neutralizing-gas';
  emit(b, { t: 'faint', side: sideIndex(b, f), name: nameOf(f) });
  run(b, f, 'onFaint', by, move, lastHit);
  if (by && by.hp > 0 && move) run(b, by, 'onFoeFaint', f);
  for (const o of activeFighters(b)) if (o !== f) run(b, o, 'onAnyFaint', f);
  if (b.field.weatherSetter === f) clearWeather(b);
  if (hadGas) wakeAbilities(b, f);
}

function settle(b) {
  for (const s of [0, 1]) {
    const f = activeOf(b, s);
    if (f.hp <= 0 && !f.fainted) faint(b, f);
  }
}

// ---------- actions ----------

export function needsAction(b, s) {
  if (b.status !== 'active') return false;
  const side = b.sides[s];
  if (side.action) return false;
  return b.phase === 'choose' ? true : side.mustSwitch;
}

function trapped(b, s) {
  const me = activeOf(b, s);
  const foe = foeOf(b, me);
  if (!foe || me.types.includes('ghost')) return false;
  return run(b, foe, 'onTrapFoe', me) === true;
}

function usableMoves(b, f) {
  const ok = f.moves.map((m, i) => ({ m, i })).filter(({ m }) => (f.pp[m.key] ?? 0) > 0 && f.vol.disabled?.key !== m.key);
  const lock = f.vol.lockedMove;
  if (lock != null && abilityKey(b, f) === 'gorilla-tactics') {
    const locked = ok.filter(({ m }) => m.key === lock);
    if (locked.length) return locked;
  }
  return ok;
}

export function validActions(b, s) {
  if (!needsAction(b, s)) return [];
  const side = b.sides[s];
  const switches = side.team.map((f, i) => ({ type: 'switch', to: i })).filter((a) => a.to !== side.active && side.team[a.to].hp > 0);
  if (b.phase === 'replace') return switches;
  const f = side.team[side.active];
  const forced = f.vol.mustRecharge ?? f.vol.charging;
  if (forced != null) return [{ type: 'move', move: forced }];
  const usable = usableMoves(b, f).map(({ i }) => ({ type: 'move', move: i }));
  const moves = usable.length ? usable : [{ type: 'move', move: STRUGGLE_MOVE }];
  return moves.concat(trapped(b, s) ? [] : switches);
}

const sameAction = (a, b) => a.type === b.type && (a.type === 'move' ? a.move === b.move : a.to === b.to);

// Returns the events of the resolved turn, or null if still waiting on the other side.
export function submit(b, s, action) {
  if (!action || !validActions(b, s).some((v) => sameAction(v, action))) throw new Error('Acción inválida');
  b.sides[s].action = action.type === 'move' ? { type: 'move', move: action.move } : { type: 'switch', to: action.to };
  if (b.sides.some((_, i) => needsAction(b, i))) return null;
  return b.phase === 'choose' ? resolveTurn(b) : resolveReplacements(b);
}

export function autoAction(b, s) {
  const opts = validActions(b, s);
  if (!opts.length) return null;
  const moves = opts.filter((o) => o.type === 'move');
  if (moves.length) {
    const side = b.sides[s];
    const me = side.team[side.active];
    const foe = b.sides[1 - s].team[b.sides[1 - s].active];
    let best = moves[0];
    let bestScore = -1;
    for (const o of moves) {
      const m = o.move === STRUGGLE_MOVE ? STRUGGLE : me.moves[o.move];
      const score = m.kind === 'status' ? 15 + b.random() * 30 : (m.power || 60) * effectiveness(m.type, foe.types) * ((m.accuracy ?? 100) / 100) * (m.type && me.types.includes(m.type) ? 1.5 : 1) + b.random() * 10;
      if (score > bestScore) [best, bestScore] = [o, score];
    }
    return best;
  }
  return opts[Math.floor(b.random() * opts.length)];
}

function canAct(b, me, move) {
  const side = sideIndex(b, me);
  const cant = (reason) => {
    emit(b, { t: 'cant', side, name: nameOf(me), reason });
    return false;
  };
  if (me.status === 'slp') {
    me.statusTurns -= flag(b, me, 'wakesFaster') ? 2 : 1;
    if (me.statusTurns > 0) return cant('slp');
    cure(b, me);
  }
  if (me.status === 'frz') {
    if (!move.thaws && b.random() >= 0.2) return cant('frz');
    cure(b, me);
  }
  if (me.vol.flinch) {
    delete me.vol.flinch;
    cant('flinch');
    run(b, me, 'onFlinch');
    return false;
  }
  if (run(b, me, 'onBeforeMove', move) === false) return cant('truant');
  if (me.vol.confusion) {
    me.vol.confusion -= 1;
    if (!me.vol.confusion) emit(b, { t: 'volatileEnd', side, name: nameOf(me), kind: 'confusion' });
    else {
      emit(b, { t: 'confused', side, name: nameOf(me) });
      if (b.random() < 1 / 3) {
        const a = me.stats.atk * stageMult(me.boosts.atk);
        const d = me.stats.def * stageMult(me.boosts.def);
        hurt(b, me, (((2 * me.level) / 5 + 2) * 40 * (a / d)) / 50 + 2, 'confusion');
        return false;
      }
    }
  }
  if (me.vol.attract) {
    if (!onField(b, me.vol.attract)) delete me.vol.attract;
    else if (b.random() < 0.5) return cant('attract');
  }
  if (me.status === 'par' && b.random() < 0.25) return cant('par');
  return true;
}

function statusEffectOf(move) {
  if (move.heal || HEALS_WITH_WEATHER[move.id] || move.id === 'rest') return { effect: 'heal' };
  if (move.weather || move.terrain) return { effect: 'weather' };
  if (move.screen) return { effect: 'boost', stat: move.screen === 'lightscreen' ? 'sdef' : 'def' };
  if (move.target === 'self' && move.boosts) {
    const up = Object.entries(move.boosts).find(([, v]) => v > 0);
    return { effect: up ? 'boost' : 'debuff', stat: (up ?? Object.entries(move.boosts)[0])[0] };
  }
  return { effect: 'debuff' };
}

function spendPP(b, me, move) {
  if (move.key === STRUGGLE.key) return;
  const foe = foeOf(b, me);
  me.pp[move.key] = Math.max(0, (me.pp[move.key] ?? 0) - (foe && abilityKey(b, foe) === 'pressure' ? 2 : 1));
}

function useMove(b, s, moveIdx, priority, why = null) {
  const me = activeOf(b, s);
  if (me.hp <= 0) return;
  b.moved.add(me);
  if (me.vol.mustRecharge != null) {
    delete me.vol.mustRecharge;
    emit(b, { t: 'cant', side: s, name: nameOf(me), reason: 'recharge' });
    return;
  }
  const base = moveIdx === STRUGGLE_MOVE ? STRUGGLE : me.moves[moveIdx];
  const move = { ...base, flags: [...base.flags], effectivePriority: priority };
  const charged = me.vol.charging === moveIdx;
  if (!canAct(b, me, move)) {
    delete me.vol.charging;
    return;
  }
  run(b, me, 'onBeforeMoveForm', move);
  run(b, me, 'onModifyMove', move);
  run(b, me, 'onPrepareMove', move);
  me.revealedMoves.add(base.key);
  me.vol.lastMove = base.key;
  const status = move.kind === 'status' ? statusEffectOf(move) : {};
  emit(b, { t: 'move', side: s, name: nameOf(me), move: move.name, type: move.type, kind: move.kind, key: base.key, category: move.category, flags: move.flags, ...status, ...(move.multihit ? { multihit: true } : {}), ...(move.drain ? { drain: true } : {}), ...(why ? { why } : {}) });

  const foe = foeOf(b, me);
  if (move.flags.includes('charge') && !charged && !(isSun(weather(b)) && (base.id === 'solar-beam' || base.id === 'solar-blade'))) {
    spendPP(b, me, move);
    me.vol.charging = moveIdx;
    emit(b, { t: 'charging', side: s, name: nameOf(me), move: move.name });
    return;
  }
  delete me.vol.charging;
  if (!charged) spendPP(b, me, move);

  if (move.selfDestruct && anyActiveHas(b, 'damp')) {
    emit(b, { t: 'nothing', side: s });
    return;
  }
  if (move.kind === 'status') statusMove(b, me, foe, move);
  else {
    const dealt = attack(b, me, foe, move);
    if (dealt && move.flags.includes('recharge') && me.hp > 0) me.vol.mustRecharge = moveIdx;
    if (move.recoilMaxHp && me.hp > 0) hurt(b, me, me.stats.hp * move.recoilMaxHp, 'recoil');
  }
  if (move.selfDestruct && me.hp > 0) {
    me.hp = 0;
    faint(b, me);
  }

  run(b, me, 'onAfterMove', move);
  if (move.flags.includes('dance')) {
    const other = foeOf(b, me);
    if (other) run(b, other, 'onFoeMove', me, move);
  }
}

function selfStatus(b, me, move) {
  let did = false;
  if (move.weather) did = setWeather(b, move.weather, null) || did;
  if (move.terrain) did = setTerrain(b, move.terrain, null) || did;
  if (move.screen) did = setScreen(b, sideIndex(b, me), move.screen) || did;
  if (move.boosts) did = Object.keys(boost(b, me, move.boosts, me)).length > 0 || did;
  if (move.heal) did = heal(b, me, me.stats.hp * move.heal) > 0 || did;
  const weatherHeal = HEALS_WITH_WEATHER[move.id];
  if (weatherHeal) {
    const w = weather(b);
    const share = w === weatherHeal || (weatherHeal === 'sun' && isSun(w)) ? 2 / 3 : w && w !== 'winds' ? 1 / 4 : 1 / 2;
    did = heal(b, me, me.stats.hp * share) > 0 || did;
  }
  if (move.id === 'rest' && me.hp < me.stats.hp && me.status !== 'slp' && run(b, me, 'onSetStatus', 'slp', me) !== false && !statusImmune(b, me, 'slp', me)) {
    me.status = 'slp';
    me.statusTurns = 3;
    emit(b, { t: 'status', side: sideIndex(b, me), name: nameOf(me), status: 'slp' });
    heal(b, me, me.stats.hp);
    did = true;
  }
  if (!did) emit(b, { t: 'nothing', side: sideIndex(b, me) });
}

function statusMove(b, me, foe, move) {
  if (move.target !== 'foe') return selfStatus(b, me, move);
  const s = sideIndex(b, me);
  if (!foe) {
    emit(b, { t: 'notarget', side: s });
    return;
  }
  let target = foe;
  b.mold = flag(b, me, 'moldBreaker') ? { target: foe } : null;
  try {
    if (move.effectivePriority > move.priority && foe.types.includes('dark')) {
      emit(b, { t: 'immune', side: 1 - s });
      return;
    }
    if (move.id === 'thunder-wave' && typeEffectiveness(b, move, me, foe) === 0) {
      emit(b, { t: 'immune', side: 1 - s });
      return;
    }
    if (run(b, foe, 'onTryHit', move, me)) return;
    if (flag(b, foe, 'blocksStatusMoves')) {
      showAbility(b, foe);
      emit(b, { t: 'immune', side: 1 - s });
      return;
    }
    if (move.accuracy != null && !hits(b, me, foe, move)) {
      emit(b, { t: 'miss', side: s });
      return;
    }
    if (flag(b, foe, 'bouncesStatus')) {
      showAbility(b, foe, 'bounce');
      target = me;
    }
  } finally {
    b.mold = null;
  }
  const source = target === me ? foe : me;
  let did = false;
  if (move.boosts) did = Object.keys(boost(b, target, move.boosts, source)).length > 0 || did;
  if (move.status) did = setStatus(b, target, move.status, source) || did;
  if (move.volatile === 'confusion') did = addVolatile(b, target, 'confusion', source) || did;
  if (move.volatile === 'attract') did = addVolatile(b, target, 'attract', source) || did;
  if (move.volatile === 'leechseed') did = addVolatile(b, target, 'leechseed', source) || did;
  if (move.self) did = Object.keys(boost(b, source, move.self, source)).length > 0 || did;
  if (!did && move.volatile === 'attract' && (!target.gender || !source.gender || target.gender === source.gender)) {
    emit(b, { t: 'nothing', side: s, reason: !target.gender || !source.gender ? 'genderless' : 'sameGender' });
    return;
  }
  if (move.clearsScreens) {
    did = clearScreens(b, sideIndex(b, target), 'defog') || did;
    for (const side of [0, 1]) did = clearToxicSpikes(b, side) || did;
  }
  if (!did) emit(b, { t: 'nothing', side: s });
}

function rollHits(b, me, move) {
  if (move.multihit) {
    const [lo, hi] = move.multihit;
    if (lo === hi) return lo;
    if (flag(b, me, 'maxHits')) return hi;
    const r = b.random();
    if (lo === 2 && hi === 5) return r < 0.35 ? 2 : r < 0.7 ? 3 : r < 0.85 ? 4 : 5;
    return lo + Math.floor(r * (hi - lo + 1));
  }
  return flag(b, me, 'parentalBond') ? 2 : 1;
}

function hits(b, me, target, move) {
  if (move.ohko) return b.random() * 100 < 30 + me.level - target.level;
  if (move.accuracy == null || flag(b, me, 'alwaysHits') || flag(b, target, 'alwaysHits')) return true;
  const w = weather(b);
  if (move.id === 'blizzard' && (w === 'hail' || w === 'snow')) return true;
  if ((move.id === 'thunder' || move.id === 'hurricane') && isRain(w)) return true;
  if ((move.id === 'thunder' || move.id === 'hurricane') && isSun(w)) return b.random() * 100 < 50;
  if (move.kind === 'status' && flag(b, target, 'wonderSkin')) return b.random() < 0.5;
  const accStage = flag(b, target, 'unaware') ? 0 : me.boosts.acc;
  const evaStage = flag(b, me, 'unaware') || flag(b, me, 'ignoresEvasion') ? 0 : target.boosts.eva;
  let acc = move.accuracy * accuracyMult(clamp(accStage - evaStage, -STAGE_LIMIT, STAGE_LIMIT));
  acc = chain(b, me, 'onAccuracy', acc, move, target);
  acc = chain(b, target, 'onEvasion', acc, move, me);
  return b.random() * 100 < acc;
}

function rollCrit(b, me, target, move) {
  if (flag(b, target, 'critImmune')) return false;
  const stage = chain(b, me, 'onCritStage', move.crit || 0, move, target);
  return b.random() < [1 / 16, 1 / 8, 1 / 2, 1][clamp(stage, 0, 3)];
}

function ruin(b, f, key) {
  return otherActiveHas(b, f, key) ? 0.75 : 1;
}

function powerMods(b, me, target, move) {
  let m = mul(b, me, 'onBasePower', move, target) * mul(b, target, 'onIncoming', move, me);
  if ((move.type === 'dark' && anyActiveHas(b, 'dark-aura')) || (move.type === 'fairy' && anyActiveHas(b, 'fairy-aura'))) m *= anyActiveHas(b, 'aura-break') ? 0.75 : 4 / 3;
  const t = b.field.terrain;
  if (grounded(b, me) && ((t === 'electric' && move.type === 'electric') || (t === 'grassy' && move.type === 'grass') || (t === 'psychic' && move.type === 'psychic'))) m *= 1.3;
  if (grounded(b, target) && t === 'misty' && move.type === 'dragon') m *= 0.5;
  if (grounded(b, target) && t === 'grassy' && move.weakenedByGrassyTerrain) m *= 0.5;
  if (me.vol.charge && move.type === 'electric') m *= 2;
  return m;
}

function computeDamage(b, me, target, move, eff, hitPower) {
  const crit = rollCrit(b, me, target, move);
  const physical = move.category === 'physical';
  const atkKey = physical ? 'atk' : 'satk';
  const defKey = physical ? 'def' : 'sdef';
  const attacker = move.usesTargetAttack ? target : me;
  let atkStage = flag(b, target, 'unaware') ? 0 : attacker.boosts[atkKey];
  if (crit && atkStage < 0) atkStage = 0;
  let defStage = flag(b, me, 'unaware') ? 0 : target.boosts[defKey];
  if (crit && defStage > 0) defStage = 0;
  const w = weather(b);

  const a = attacker.stats[atkKey] * stageMult(atkStage) * mul(b, me, 'onAttack', move, target) * ruin(b, me, physical ? 'tablets-of-ruin' : 'vessel-of-ruin');
  let d = target.stats[defKey] * stageMult(defStage) * mul(b, target, 'onDefense', move, me) * ruin(b, target, physical ? 'sword-of-ruin' : 'beads-of-ruin');
  if (w === 'sand' && !physical && target.types.includes('rock')) d *= 1.5;
  if (w === 'snow' && physical && target.types.includes('ice')) d *= 1.5;

  let dmg = (((2 * me.level) / 5 + 2) * hitPower * powerMods(b, me, target, move) * (a / d)) / 50 + 2;
  const mw = weatherFor(b, me);
  if (isSun(mw)) dmg *= move.type === 'fire' ? 1.5 : move.type === 'water' ? 0.5 : 1;
  if (isRain(mw)) dmg *= move.type === 'water' ? 1.5 : move.type === 'fire' ? 0.5 : 1;
  if (move.type && me.types.includes(move.type)) dmg *= flag(b, me, 'stab') ? abilityDef(b, me).stab : 1.5;
  dmg *= eff * (0.85 + b.random() * 0.15) * (crit ? 1.5 : 1);
  if (me.status === 'brn' && physical && !flag(b, me, 'ignoresBurn')) dmg *= 0.5;
  if (!crit && screened(b, me, target, move)) dmg *= 0.5;
  dmg *= mul(b, me, 'onAttackerFinal', move, target, { eff, crit }) * mul(b, target, 'onDefenderFinal', move, me, { eff, crit });
  return { dmg: Math.max(1, Math.round(dmg)), crit };
}

function applySecondaries(b, me, target, move) {
  if (!move.secondary?.length || flag(b, me, 'sheerForce')) return;
  const odds = flag(b, me, 'doublesSecondaries') ? 2 : 1;
  for (const sec of move.secondary) {
    if (b.random() * 100 >= sec.chance * odds) continue;
    if (sec.self) {
      if (me.hp > 0) boost(b, me, sec.self, me);
      continue;
    }
    if (target.hp <= 0 || flag(b, target, 'blocksSecondaries')) continue;
    if (sec.status) setStatus(b, target, sec.status, me);
    if (sec.flinch) addVolatile(b, target, 'flinch', me);
    if (sec.confuse) addVolatile(b, target, 'confusion', me);
    if (sec.boosts) boost(b, target, sec.boosts, me);
  }
}

function fixedDamage(me, target, move) {
  if (move.ohko) return target.hp;
  if (move.fixedDamage === 'level') return me.level;
  return Number(move.fixedDamage);
}

function attack(b, me, target, move) {
  const s = sideIndex(b, me);
  if (!target) {
    emit(b, { t: 'notarget', side: s });
    return 0;
  }
  if (move.ohko && target.level > me.level) {
    emit(b, { t: 'nothing', side: s });
    return 0;
  }
  const w = weather(b);
  if ((w === 'heavyrain' && move.type === 'fire') || (w === 'harshsun' && move.type === 'water')) {
    emit(b, { t: 'fizzle', side: s, weather: w });
    return;
  }
  const typeEff = typeEffectiveness(b, move, me, target);
  if (typeEff === 0) {
    emit(b, { t: 'immune', side: 1 - s });
    return;
  }
  b.mold = flag(b, me, 'moldBreaker') ? { target } : null;
  try {
    if (run(b, target, 'onTryHit', move, me)) return;
    if (b.field.terrain === 'psychic' && move.effectivePriority > 0 && grounded(b, target)) {
      emit(b, { t: 'immune', side: 1 - s, terrain: 'psychic' });
      return;
    }
    if (!hits(b, me, target, move)) {
      emit(b, { t: 'miss', side: s });
      return;
    }
    if (move.breaksScreens) clearScreens(b, sideIndex(b, target), 'broken');
    const eff = chain(b, target, 'onEffectiveness', typeEff, move, me);
    const count = rollHits(b, me, move);
    let total = 0;
    let lastHit = 0;
    let landed = 0;
    for (let i = 0; i < count && target.hp > 0 && me.hp > 0; i++) {
      const hitPower = i > 0 && !move.multihit ? move.power * 0.25 : move.power;
      const { dmg, crit } = move.ohko || move.fixedDamage ? { dmg: fixedDamage(me, target, move), crit: false } : computeDamage(b, me, target, move, eff, hitPower);
      const dealt = Math.min(target.hp, chain(b, target, 'onDamage', dmg, move, me));
      const before = target.hp;
      target.hp -= dealt;
      total += dealt;
      lastHit = dealt;
      landed += 1;
      emit(b, { t: 'damage', side: 1 - s, amount: dealt, hp: target.hp, max: target.stats.hp, eff, crit });
      if (target.status === 'frz' && move.type === 'fire' && target.hp > 0) cure(b, target);
      run(b, target, 'onDamagingHit', move, me, { crit, before, dmg: dealt });
    }
    if (landed > 1) emit(b, { t: 'hits', side: 1 - s, count: landed });
    if (me.vol.charge && move.type === 'electric') delete me.vol.charge;

    applySecondaries(b, me, target, move);
    if (move.self && me.hp > 0) boost(b, me, move.self, me);
    if (move.recoil && total > 0 && !flag(b, me, 'noRecoil')) hurt(b, me, total * move.recoil, 'recoil');
    if (move.drain && total > 0 && me.hp > 0) {
      const amount = Math.max(1, Math.round(total * move.drain));
      if (flag(b, target, 'oozes')) {
        showAbility(b, target);
        hurt(b, me, amount, 'ooze');
      } else heal(b, me, amount);
    }
    if (me.hp > 0) run(b, me, 'onAfterMoveHit', move, target, total);
    if (target.hp <= 0) faint(b, target, me, move, lastHit);
    return total;
  } finally {
    b.mold = null;
  }
}

function alive(side) {
  return side.team.some((f) => f.hp > 0);
}

function finish(b, winner, reason = null) {
  b.status = 'finished';
  b.winner = winner;
  emit(b, { t: 'end', winner, ...(reason ? { reason } : {}) });
}

function checkEnd(b) {
  const lost = b.sides.map((side) => !alive(side));
  if (!lost[0] && !lost[1]) return false;
  finish(b, lost[0] && lost[1] ? null : lost[0] ? 1 : 0);
  return true;
}

function hpShare(side) {
  return side.team.reduce((sum, f) => sum + f.hp / f.stats.hp, 0);
}

function resolveTurn(b) {
  const events = [{ t: 'turn', turn: b.turn }];
  b.ev = events;
  b.moved = new Set();
  const acts = b.sides.map((side, s) => ({ s, ...side.action }));
  for (const side of b.sides) side.action = null;

  const entered = [];
  for (const a of acts) {
    if (a.type !== 'switch') continue;
    if (doSwitch(b, a.s, a.to)) wakeAbilities(b, activeOf(b, a.s));
    entered.push(a.s);
  }
  for (const s of entryOrder(b, entered)) runEntry(b, s);
  settle(b);
  if (checkEnd(b)) return done(b, events);

  const movers = acts
    .filter((a) => a.type === 'move')
    .map((a) => {
      const f = activeOf(b, a.s);
      const move = a.move === STRUGGLE_MOVE ? STRUGGLE : f.moves[a.move];
      const frac = run(b, f, 'onFractionalPriority', move);
      return { ...a, prio: chain(b, f, 'onModifyPriority', move.priority, move), frac: typeof frac === 'number' ? frac : 0, spd: speedOf(b, f), tie: b.random() };
    })
    .sort((x, y) => y.prio - x.prio || y.frac - x.frac || y.spd - x.spd || y.tie - x.tie);

  // When both attack, say why the first one went first (priority move, faster, or a coin flip).
  const why = movers.length === 2 ? (movers[0].prio !== movers[1].prio || movers[0].frac !== movers[1].frac ? 'priority' : movers[0].spd !== movers[1].spd ? 'speed' : 'tie') : null;
  movers.forEach((a, i) => (a.why = i === 0 ? why : null));

  for (const a of movers) {
    useMove(b, a.s, a.move, a.prio, a.why);
    settle(b);
    if (checkEnd(b)) return done(b, events);
  }
  residual(b);
  settle(b);
  if (checkEnd(b)) return done(b, events);
  b.turn += 1;
  if (b.turn > TURN_LIMIT) {
    const [h0, h1] = b.sides.map(hpShare);
    finish(b, h0 === h1 ? null : h0 > h1 ? 0 : 1, 'limit');
    return done(b, events);
  }
  afterTurn(b);
  return done(b, events);
}

function done(b, events) {
  b.ev = [];
  return events;
}

function statusDamage(b, f) {
  if (f.status !== 'brn' && !poisoned(f.status)) return;
  let amount;
  if (f.status === 'brn') amount = f.stats.hp / (flag(b, f, 'halvesBurn') ? 32 : 16);
  else if (f.status === 'psn') amount = f.stats.hp / 8;
  else {
    f.statusTurns = Math.min(15, f.statusTurns + 1);
    amount = (f.stats.hp * f.statusTurns) / 16;
  }
  amount = chain(b, f, 'onStatusDamage', Math.max(1, Math.floor(amount)), f.status);
  if (amount > 0) hurt(b, f, amount, f.status);
}

function residual(b) {
  const order = () => activeFighters(b).sort((x, y) => speedOf(b, y) - speedOf(b, x));
  const w = weather(b);
  for (const f of order()) {
    if (w === 'sand' && !f.types.some((t) => SAND_PROOF.includes(t)) && !abilityDef(b, f)?.weatherImmune?.includes('sand')) hurt(b, f, f.stats.hp / 16, 'sand');
    if (w === 'hail' && !f.types.includes('ice') && !abilityDef(b, f)?.weatherImmune?.includes('hail')) hurt(b, f, f.stats.hp / 16, 'hail');
    if (f.hp > 0 && b.field.terrain === 'grassy' && grounded(b, f)) heal(b, f, f.stats.hp / 16);
    if (f.hp > 0) statusDamage(b, f);
    if (f.hp > 0 && f.vol.leechSeed) {
      const seeder = foeOf(b, f);
      const drained = hurt(b, f, f.stats.hp / 8, 'leechseed');
      if (seeder && drained) {
        if (flag(b, f, 'oozes')) hurt(b, seeder, drained, 'ooze');
        else heal(b, seeder, drained);
      }
    }
  }
  settle(b);
  for (const f of order()) run(b, f, 'onEndTurn');
  settle(b);
  for (const f of order()) {
    if (f.vol.perish) {
      f.vol.perish -= 1;
      emit(b, { t: 'perish', side: sideIndex(b, f), name: nameOf(f), count: f.vol.perish });
      if (!f.vol.perish) {
        f.hp = 0;
        faint(b, f);
        continue;
      }
    }
    if (f.vol.disabled && --f.vol.disabled.turns <= 0) {
      emit(b, { t: 'volatileEnd', side: sideIndex(b, f), name: nameOf(f), kind: 'disable', move: f.vol.disabled.name });
      delete f.vol.disabled;
    }
    delete f.vol.flinch;
    f.activeTurns += 1;
  }
  b.sides.forEach((side, s) => {
    for (const kind of SCREEN_KINDS) {
      if (!side.screens[kind] || --side.screens[kind] > 0) continue;
      delete side.screens[kind];
      emit(b, { t: 'screenEnd', side: s, screen: kind, cause: 'time' });
    }
  });
  if (b.field.weather && --b.field.weatherTurns <= 0) clearWeather(b);
  if (b.field.terrain && --b.field.terrainTurns <= 0) clearTerrain(b);
}

function afterTurn(b) {
  let anyReplace = false;
  b.sides.forEach((side, s) => {
    const f = side.team[side.active];
    const escaping = f.hp > 0 && f.vol.exitPending && side.team.some((o) => o !== f && o.hp > 0);
    side.mustSwitch = f.hp <= 0 || escaping;
    if (side.mustSwitch) {
      anyReplace = true;
      emit(b, { t: 'replace', side: s });
    }
  });
  b.phase = anyReplace ? 'replace' : 'choose';
}

function resolveReplacements(b) {
  const events = [];
  b.ev = events;
  const entered = [];
  b.sides.forEach((side, s) => {
    if (side.mustSwitch && side.action) {
      if (doSwitch(b, s, side.action.to)) wakeAbilities(b, activeOf(b, s));
      entered.push(s);
    }
    side.action = null;
    side.mustSwitch = false;
  });
  for (const s of entryOrder(b, entered)) runEntry(b, s);
  settle(b);
  b.phase = 'choose';
  if (!checkEnd(b)) {
    const pending = [0, 1].some((s) => activeOf(b, s).hp <= 0);
    if (pending) afterTurn(b);
  }
  return done(b, events);
}

// ---------- what clients see ----------

function publicMove(m) {
  return {
    name: m.name,
    type: m.type,
    power: m.power,
    accuracy: m.accuracy,
    priority: m.priority,
    kind: m.kind || 'attack',
    category: m.category,
    desc: m.desc,
    key: m.key,
    contact: m.flags.includes('contact'),
    pp: m.pp,
    target: m.target,
    ...(m.boosts ? { boosts: m.boosts } : {}),
    ...(m.status ? { status: m.status } : {}),
    ...(m.heal ? { heal: m.heal } : {}),
    ...(m.weather ? { weather: m.weather } : {}),
    ...(m.screen ? { screen: m.screen } : {}),
    ...(m.breaksScreens ? { breaksScreens: true } : {}),
    ...(m.fixedDamage ? { fixedDamage: m.fixedDamage } : {}),
    ...(m.ohko ? { ohko: true } : {}),
    ...(m.flags.includes('charge') ? { charge: true } : {}),
    ...(m.flags.includes('recharge') ? { recharge: true } : {}),
    ...(m.secondary ? { secondary: m.secondary } : {}),
    ...(m.self ? { self: m.self } : {}),
    ...(m.recoil ? { recoil: m.recoil } : {}),
    ...(m.drain ? { drain: m.drain } : {}),
    ...(m.crit ? { crit: m.crit } : {}),
    ...(m.multihit ? { multihit: true } : {}),
  };
}

function publicMoves(f, known = null) {
  return f.moves.filter((m) => !known || known.has(m.key)).map(publicMove);
}

function publicVolatiles(f) {
  const v = f.vol;
  return {
    ...(v.confusion ? { confusion: true } : {}),
    ...(v.attract ? { attract: true } : {}),
    ...(v.perish ? { perish: v.perish } : {}),
    ...(v.charge ? { charge: true } : {}),
    ...(v.flashFire ? { flashFire: true } : {}),
    ...(v.disabled ? { disabled: v.disabled.name } : {}),
    ...(v.slowStart ? { slowStart: v.slowStart } : {}),
  };
}

// What a client may see. Pending choices stay hidden; only "ready" is shown.
const percentOf = (hp, max) => (hp <= 0 ? 0 : Math.max(1, Math.round((hp / max) * 100)));

function hiddenHp(e) {
  if (e.max == null) return e.stats ? { ...e, stats: { hp: 100 } } : e;
  const before = e.t === 'damage' || e.t === 'hurt' ? e.hp + e.amount : e.hp - e.amount;
  const hp = percentOf(e.hp, e.max);
  const out = { ...e, hp, max: 100, pct: true };
  if (e.amount != null) out.amount = e.amount > 0 ? Math.max(1, Math.abs(percentOf(before, e.max) - hp)) : 0;
  if (e.stats) out.stats = { hp: 100 };
  return out;
}

function viewEvent(e, viewer) {
  if (e.card) {
    const { card, seen, ...rest } = e;
    return { ...rest, mon: e.side === viewer ? card : seen };
  }
  return e.side == null || e.side === viewer || (e.max == null && !e.stats) ? e : hiddenHp(e);
}

export function viewEvents(events, viewer = null) {
  return events.map((e) => viewEvent(e, viewer));
}

function fighterView(b, s, i, own) {
  const side = b.sides[s];
  const f = side.team[i];
  if (!own && !f.seen) return { uid: `hidden-${s}-${i}`, hidden: true };
  const disguise = i === side.active && f.hp > 0 && f.vol.illusion ? f.vol.illusion : own ? null : f.seenAs;
  const abilityKnown = own || f.revealedAbilities.has(f.ability);
  return {
    uid: f.uid,
    name: f.name,
    speciesName: f.speciesName,
    types: f.types,
    rarity: f.rarity,
    shiny: f.shiny,
    level: f.level,
    stats: own ? f.stats : { hp: 100 },
    hp: own ? f.hp : percentOf(f.hp, f.stats.hp),
    ...(own ? {} : { hpPercent: true }),
    boosts: f.boosts,
    pp: own ? f.pp : {},
    gender: f.gender,
    sprite: f.sprite,
    floats: f.floats,
    status: f.status,
    volatiles: publicVolatiles(f),
    abilityInfo: abilityKnown ? abilityInfo(f.ability) : null,
    moves: publicMoves(f, own ? null : f.revealedMoves),
    ...(disguise ?? {}),
  };
}

export function publicState(b, viewer = null) {
  return {
    id: b.id,
    status: b.status,
    phase: b.phase,
    turn: b.turn,
    winner: b.winner,
    levelCap: b.levelCap,
    field: { weather: b.field.weather, terrain: b.field.terrain, weatherSuppressed: !!b.field.weather && !weather(b) },
    intro: b.turn === 1 && b.phase === 'choose' ? viewEvents(b.intro, viewer) : [],
    sides: b.sides.map((side, s) => ({
      trainerId: side.trainerId,
      name: side.name,
      active: side.active,
      ready: !needsAction(b, s),
      mustSwitch: side.mustSwitch,
      toxicSpikes: side.toxicSpikes,
      screens: { ...side.screens },
      team: side.team.map((f, i) => fighterView(b, s, i, viewer === s || b.status === 'finished')),
    })),
  };
}

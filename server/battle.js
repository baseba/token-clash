// Turn-based battle engine. Pure: no I/O, randomness injected, so it can be tested and replayed.
import { buildFighter, effectiveness, formData, statsFor, speciesData, moveData, ALL_MOVE_IDS, STRUGGLE } from './creatures.js';
import { MOVE_RULES } from './moves.js';
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
    field: { weather: null, weatherTurns: 0, weatherSetter: null, terrain: null, terrainTurns: 0, rooms: {} },
    sides: sides.map((s) => ({
      trainerId: s.trainerId,
      name: s.name,
      team: s.entries.slice(0, TEAM_SIZE).map((e) => prepare(e, levelCap)),
      active: 0,
      action: null,
      mustSwitch: false,
      toxicSpikes: 0,
      screens: {},
      hazards: { spikes: 0, stealthrock: false, stickyweb: false },
      conds: {},
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
  if (f.vol.gastroAcid && !def.unsuppressable) return null;
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

const moveApis = new WeakMap();
const PROTECT_STALL = ['protect', 'detect', 'kings-shield', 'spiky-shield', 'baneful-bunker', 'obstruct', 'silk-trap', 'burning-bulwark', 'endure'];
const HAZARD_MAX = { spikes: 3, toxicspikes: 2 };

function moveApi(b) {
  let A = moveApis.get(b);
  if (A) return A;
  const sideOfF = (f) => sideIndex(b, f);
  A = {
    b,
    random: () => b.random(),
    turn: () => b.turn,
    emit: (ev) => emit(b, ev),
    sideOf: sideOfF,
    side: (s) => b.sides[s],
    actives: () => activeFighters(b),
    name: nameOf,
    hurt: (f, amount, cause) => hurt(b, f, amount, cause),
    heal: (f, amount) => heal(b, f, amount),
    boost: (f, changes, source) => boost(b, f, changes, source),
    setStatus: (f, status, source) => setStatus(b, f, status, source),
    cure: (f) => cure(b, f),
    addVolatile: (f, kind, source, opts) => addVolatile(b, f, kind, source, opts),
    setTypes: (f, types) => setTypes(b, f, types),
    changeAbility: (f, key) => {
      setAbility(b, f, key);
      run(b, f, 'onStart');
    },
    transform: (f, into) => transform(b, f, into),
    dragOut: (f) => dragOut(b, f),
    faint: (f) => {
      f.hp = 0;
      faint(b, f);
    },
    weather: () => weather(b),
    grounded: (f) => grounded(b, f),
    effectiveness: (type, types) => effectiveness(type, types),
    speed: (f) => speedOf(b, f),
    flag: (f, name) => flag(b, f, name),
    abilityDef: (key) => ABILITIES[key],
    stageMult,
    weight: (f) => speciesData(f.speciesId)?.weight ?? 50,
    baseAttack: (f) => speciesData(f.speciesId)?.stats?.[1],
    moved: (f) => b.moved.has(f),
    chosen: (s) => b.chosen?.[s] ?? null,
    lastMove: () => b.lastMove ?? null,
    nothing: (f, reason = null) => {
      emit(b, { t: 'nothing', side: sideOfF(f), ...(reason ? { reason } : {}) });
      return false;
    },
    vol: (f, kind, extra = {}) => emit(b, { t: 'volatile', side: sideOfF(f), name: nameOf(f), kind, ...extra }),
    volEnd: (f, kind, extra = {}) => emit(b, { t: 'volatileEnd', side: sideOfF(f), name: nameOf(f), kind, ...extra }),
    sideStart: (s, kind, extra = {}) => emit(b, { t: 'sideStart', side: s, kind, ...extra }),
    fieldStart: (kind) => emit(b, { t: 'fieldStart', kind }),
    fieldEnd: (kind) => emit(b, { t: 'fieldEnd', kind }),
    setBoosts: (f, boosts) => {
      f.boosts = { ...freshBoosts(), ...boosts };
      emit(b, { t: 'boosts', side: sideOfF(f), name: nameOf(f), boosts: { ...f.boosts } });
    },
    setStats: (f, stats) => {
      f.stats = { ...f.stats, ...stats };
      emit(b, { t: 'stats', side: sideOfF(f), name: nameOf(f), stats: { ...f.stats } });
    },
    swapBoosts: (a, c, keys) => {
      const next = (from, to) => ({ ...to.boosts, ...Object.fromEntries(keys.map((k) => [k, from.boosts[k]])) });
      const forA = next(c, a);
      const forC = next(a, c);
      A.setBoosts(a, forA);
      A.setBoosts(c, forC);
      return true;
    },
    splitStats: (a, c, keys) => {
      const avg = Object.fromEntries(keys.map((k) => [k, Math.floor((a.stats[k] + c.stats[k]) / 2)]));
      A.setStats(a, avg);
      A.setStats(c, avg);
      return true;
    },
    protect: (f, kind) => {
      const n = f.vol.stall ?? 0;
      if (n > 0 && b.random() >= 1 / 3 ** n) {
        delete f.vol.stall;
        return A.nothing(f);
      }
      f.vol.stall = n + 1;
      if (kind === 'endure') f.vol.endure = b.turn;
      else f.vol.protect = { turn: b.turn, kind };
      emit(b, { t: 'protect', side: sideOfF(f), name: nameOf(f), kind });
      return true;
    },
    guard: (f, kind) => {
      const conds = b.sides[sideOfF(f)].conds;
      if (kind === 'quickguard' || kind === 'wideguard') {
        const n = f.vol.stall ?? 0;
        if (n > 0 && b.random() >= 1 / 3 ** n) {
          delete f.vol.stall;
          return A.nothing(f);
        }
        f.vol.stall = n + 1;
      }
      conds[kind] = b.turn;
      emit(b, { t: 'sideStart', side: sideOfF(f), kind });
      return true;
    },
    hazard: (f, kind) => {
      const s = 1 - sideOfF(f);
      const side = b.sides[s];
      if (kind === 'toxicspikes') {
        if (side.toxicSpikes >= HAZARD_MAX.toxicspikes) return A.nothing(f);
        side.toxicSpikes += 1;
        emit(b, { t: 'hazard', side: s, layers: side.toxicSpikes });
        return true;
      }
      const cur = side.hazards[kind];
      if (kind === 'spikes' ? cur >= HAZARD_MAX.spikes : cur) return A.nothing(f);
      side.hazards[kind] = kind === 'spikes' ? cur + 1 : true;
      emit(b, { t: 'sideStart', side: s, kind, ...(kind === 'spikes' ? { layers: side.hazards.spikes } : {}) });
      return true;
    },
    clearHazards: (s) => clearHazards(b, s),
    courtChange: () => {
      const [x, y] = b.sides;
      for (const key of ['hazards', 'conds', 'screens', 'toxicSpikes']) [x[key], y[key]] = [y[key], x[key]];
      emit(b, { t: 'courtChange' });
      return true;
    },
    cureTeam: (f) => {
      let did = false;
      for (const o of b.sides[sideOfF(f)].team) {
        if (o.hp > 0 && o.status) {
          if (o === activeOf(b, sideOfF(f))) cure(b, o);
          else {
            o.status = null;
            o.statusTurns = 0;
          }
          did = true;
        }
      }
      if (did) emit(b, { t: 'teamCured', side: sideOfF(f) });
      return did || A.nothing(f);
    },
    switchOut: (f, pass = null) => {
      f.vol.switchNow = true;
      if (pass) {
        const kept = {};
        if (pass.boosts) kept.boosts = { ...f.boosts };
        if (pass.volatiles) for (const k of ['confusion', 'focusEnergy', 'perish', 'leechSeed', 'curse', 'ingrain', 'aquaRing', 'magnetRise', 'substitute', 'trappedBy', 'gastroAcid']) if (f.vol[k]) kept[k] = f.vol[k];
        if (pass.substitute) kept.substitute = pass.substitute;
        b.sides[sideOfF(f)].pass = kept;
      }
    },
    sacrifice: (f, kind) => {
      if (!b.sides[sideOfF(f)].team.some((o) => o !== f && o.hp > 0)) return A.nothing(f, 'noBench');
      b.sides[sideOfF(f)].healingWish = kind;
      A.faint(f);
      return true;
    },
    revive: (f) => {
      const team = b.sides[sideOfF(f)].team;
      const down = team.map((o, i) => i).filter((i) => team[i].hp <= 0);
      if (!down.length) return A.nothing(f, 'noFainted');
      const i = down[Math.floor(b.random() * down.length)];
      const o = team[i];
      o.hp = Math.floor(o.stats.hp / 2);
      o.fainted = false;
      o.status = null;
      emit(b, { t: 'revive', side: sideOfF(f), index: i, name: o.name, hp: o.hp, max: o.stats.hp });
      return true;
    },
    future: (f, move) => {
      const s = 1 - sideOfF(f);
      if (b.sides[s].future) return A.nothing(f);
      b.sides[s].future = { at: b.turn + 2, user: f, move: { ...move, flags: [...move.flags] }, name: move.name };
      emit(b, { t: 'futureStart', side: sideOfF(f), name: nameOf(f), move: move.name });
      return true;
    },
    dropStockpile: (f) => {
      const pile = f.vol.stockpile;
      if (!pile) return;
      delete f.vol.stockpile;
      boost(b, f, { def: -pile.def, sdef: -pile.sdef }, f);
      emit(b, { t: 'volatileEnd', side: sideOfF(f), name: nameOf(f), kind: 'stockpile' });
    },
    copyMove: (me, foe, move, { permanent }) => {
      const last = foe.vol.lastMove && moveData(foe.vol.lastMove);
      if (!last || !last.supported || me.moves.some((m) => m.key === last.key) || move.slot == null || (permanent ? last.flags.includes('nosketch') : last.flags.includes('failmimic'))) return A.nothing(me);
      if (!permanent) me.vol.mimic = { slot: move.slot, original: me.moves[move.slot] };
      me.moves = me.moves.map((m, i) => (i === move.slot ? last : m));
      me.pp[last.key] = permanent ? last.pp : Math.min(5, last.pp);
      emit(b, { t: 'learned', side: sideOfF(me), name: nameOf(me), move: last.name });
      return true;
    },
    callMove: (f, key, opts) => runCalled(b, f, key, opts),
    metronomePool: () => METRONOME_POOL(),
  };
  moveApis.set(b, A);
  return A;
}

let metronomePool = null;
function METRONOME_POOL() {
  metronomePool ??= Object.keys(MOVE_RULES).concat(ALL_MOVE_IDS()).filter((id, i, all) => all.indexOf(id) === i).filter((id) => {
    const m = moveData(id);
    return m && m.supported && m.flags.includes('metronome') && !m.flags.includes('charge');
  });
  return metronomePool;
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
  if (source && source !== f && b.sides[sideIndex(b, f)].conds.mist) for (const k of Object.keys(ch)) if (ch[k] < 0) delete ch[k];
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
  if (f.vol.smackedDown || f.vol.ingrain || b.field.rooms.gravity) return true;
  if (f.vol.magnetRise || f.vol.telekinesis) return false;
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
  if (source && source !== f && b.sides[sideIndex(b, f)].conds.safeguard) return false;
  if (status === 'slp' && activeFighters(b).some((o) => o.vol.uproar)) return false;
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
  if (f.hp <= 0 || f.hp >= f.stats.hp || f.vol.healBlock) return 0;
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

function clearHazards(b, s) {
  const side = b.sides[s];
  let did = clearToxicSpikes(b, s);
  for (const kind of ['spikes', 'stealthrock', 'stickyweb']) {
    if (!side.hazards[kind]) continue;
    side.hazards[kind] = kind === 'spikes' ? 0 : false;
    emit(b, { t: 'sideEnd', side: s, kind });
    did = true;
  }
  return did;
}

function bypassesSub(b, me, move) {
  return move.flags.includes('sound') || move.flags.includes('bypasssub') || flag(b, me, 'infiltrates');
}

function blockedByProtection(b, me, target, move) {
  if (!target || target === me) return false;
  const s = sideIndex(b, target);
  const conds = b.sides[s].conds;
  const prot = target.vol.protect?.turn === b.turn ? target.vol.protect.kind : null;
  const status = move.kind === 'status';
  const shielded = prot && move.flags.includes('protect') && !(status && ['kings-shield', 'obstruct', 'silk-trap'].includes(prot));
  const guarded =
    (conds.quickguard === b.turn && move.effectivePriority > 0 && move.flags.includes('protect')) ||
    (conds.wideguard === b.turn && move.spread) ||
    (conds.craftyshield === b.turn && status) ||
    (conds.matblock === b.turn && !status && move.flags.includes('protect'));
  if (!shielded && !guarded) return false;
  if (move.breaksProtect) {
    delete target.vol.protect;
    for (const k of ['quickguard', 'wideguard', 'craftyshield', 'matblock']) delete conds[k];
    emit(b, { t: 'protectBroken', side: s, name: nameOf(target) });
    return false;
  }
  emit(b, { t: 'protected', side: s, name: nameOf(target) });
  if (shielded && move.flags.includes('contact') && me.hp > 0) {
    if (prot === 'spiky-shield') hurt(b, me, me.stats.hp / 8, 'spikyshield');
    if (prot === 'kings-shield') boost(b, me, { atk: -1 }, target);
    if (prot === 'obstruct') boost(b, me, { def: -2 }, target);
    if (prot === 'silk-trap') boost(b, me, { spd: -1 }, target);
    if (prot === 'baneful-bunker') setStatus(b, me, 'psn', target);
    if (prot === 'burning-bulwark') setStatus(b, me, 'brn', target);
  }
  if (move.crashes && me.hp > 0) hurt(b, me, me.stats.hp / 2, 'crash');
  return true;
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
    if (move.extraType) e *= effectiveness(move.extraType, [type]);
    if (e === 0 && type === 'flying' && move.type === 'ground' && (move.hitsAirborne || target.vol.smackedDown || target.vol.ingrain || b.field.rooms.gravity)) e = 1;
    if (e === 0 && type === 'ghost' && (move.type === 'normal' || move.type === 'fighting') && target.vol.foresight) e = 1;
    if (e === 0 && type === 'dark' && move.type === 'psychic' && target.vol.miracleEye) e = 1;
    if (e === 0 && type === 'ghost' && (move.type === 'normal' || move.type === 'fighting') && flag(b, attacker, 'hitsGhost')) e = 1;
    if (e > 1 && type === 'flying' && weather(b) === 'winds') e = 1;
    eff *= e;
  }
  return eff;
}

function speedOf(b, f) {
  let spd = f.stats.spd * stageMult(f.boosts.spd);
  if (b.sides[sideIndex(b, f)]?.conds.tailwind) spd *= 2;
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
  if (side.healingWish) {
    const kind = side.healingWish;
    delete side.healingWish;
    if (f.hp < f.stats.hp || f.status) {
      emit(b, { t: 'healingWish', side: s, name: nameOf(f), kind });
      heal(b, f, f.stats.hp);
      cure(b, f);
      if (kind === 'lunardance') f.pp = Object.fromEntries(f.moves.map((m) => [m.key, m.pp]));
    }
  }
  const hz = side.hazards;
  if (hz.stealthrock && !flag(b, f, 'noIndirectDamage')) hurt(b, f, (f.stats.hp * effectiveness('rock', f.types)) / 8, 'stealthrock');
  if (hz.spikes && grounded(b, f) && f.hp > 0) hurt(b, f, f.stats.hp / [8, 6, 4][hz.spikes - 1], 'spikes');
  if (hz.stickyweb && grounded(b, f) && f.hp > 0) {
    emit(b, { t: 'stickyWeb', side: s, name: nameOf(f) });
    boost(b, f, { spd: -1 }, null);
  }
  if (f.hp <= 0) return;
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
  if (f.vol.mimic) f.moves = f.moves.map((m, i) => (i === f.vol.mimic.slot ? f.vol.mimic.original : m));
  if (f.vol.powerTrick) f.stats = { ...f.stats, atk: f.stats.def, def: f.stats.atk };
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
  const pass = old.hp > 0 ? side.pass : null;
  delete side.pass;
  const hadGas = leave(b, old);
  side.active = to;
  prepareEntry(b, s);
  const f = activeOf(b, s);
  if (pass) {
    const { boosts, ...vols } = pass;
    if (boosts) f.boosts = { ...boosts };
    Object.assign(f.vol, vols);
  }
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
  b.sides[sideIndex(b, f)].faintedTurn = b.turn;
  const hadGas = f.ability === 'neutralizing-gas';
  emit(b, { t: 'faint', side: sideIndex(b, f), name: nameOf(f) });
  if (by && by !== f && by.hp > 0 && f.vol.destinyBond) {
    emit(b, { t: 'destinyBond', side: sideIndex(b, by), name: nameOf(by), from: nameOf(f) });
    by.hp = 0;
    faint(b, by);
  }
  if (by && by !== f && move && f.vol.grudge && by.pp[move.key] > 0) {
    by.pp[move.key] = 0;
    emit(b, { t: 'grudge', side: sideIndex(b, by), name: nameOf(by), move: move.name });
  }
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
  if (me.vol.noRetreat || me.vol.bound || me.vol.ingrain || b.field.rooms.fairylock) return true;
  if (me.vol.trappedBy && onField(b, me.vol.trappedBy)) return true;
  return run(b, foe, 'onTrapFoe', me) === true;
}

function moveBlocked(b, f, m) {
  if (f.vol.taunt && m.kind === 'status') return 'taunt';
  if (f.vol.torment && f.vol.lastMove === m.key && m.key !== STRUGGLE.key) return 'torment';
  if (f.vol.healBlock && (m.flags.includes('heal') || m.heal)) return 'healBlock';
  if (b.field.rooms.gravity && m.flags.includes('gravity')) return 'gravity';
  const foe = foeOf(b, f);
  if (foe?.vol.imprison && foe.moves.some((x) => x.key === m.key)) return 'imprison';
  if (m.flags.includes('cantusetwice') && f.vol.lastMove === m.key) return 'twice';
  return null;
}

function usableMoves(b, f) {
  const ok = f.moves.map((m, i) => ({ m, i })).filter(({ m }) => (f.pp[m.key] ?? 0) > 0 && f.vol.disabled?.key !== m.key && !moveBlocked(b, f, m));
  const lock = f.vol.lockedMove;
  if (lock != null && abilityKey(b, f) === 'gorilla-tactics') {
    const locked = ok.filter(({ m }) => m.key === lock);
    if (locked.length) return locked;
  }
  return ok;
}

function encoreMove(f) {
  if (!f.vol.encore) return undefined;
  const i = f.moves.findIndex((m) => m.key === f.vol.encore.key);
  return i >= 0 && (f.pp[f.vol.encore.key] ?? 0) > 0 ? i : undefined;
}

export function validActions(b, s) {
  if (!needsAction(b, s)) return [];
  const side = b.sides[s];
  const switches = side.team.map((f, i) => ({ type: 'switch', to: i })).filter((a) => a.to !== side.active && side.team[a.to].hp > 0);
  if (b.phase === 'replace' || b.phase === 'switchout') return switches;
  const f = side.team[side.active];
  const forced = f.vol.mustRecharge ?? f.vol.charging ?? f.vol.rampage?.move ?? f.vol.locked?.move;
  if (forced != null) return [{ type: 'move', move: forced }];
  const encored = encoreMove(f);
  const usable = encored != null ? [{ type: 'move', move: encored }] : usableMoves(b, f).map(({ i }) => ({ type: 'move', move: i }));
  const moves = usable.length ? usable : [{ type: 'move', move: STRUGGLE_MOVE }];
  return moves.concat(trapped(b, s) ? [] : switches);
}

const sameAction = (a, b) => a.type === b.type && (a.type === 'move' ? a.move === b.move : a.to === b.to);

// Returns the events of the resolved turn, or null if still waiting on the other side.
export function submit(b, s, action) {
  if (!action || !validActions(b, s).some((v) => sameAction(v, action))) throw new Error('Acción inválida');
  b.sides[s].action = action.type === 'move' ? { type: 'move', move: action.move } : { type: 'switch', to: action.to };
  if (b.sides.some((_, i) => needsAction(b, i))) return null;
  if (b.phase === 'switchout') return resolveSwitchOut(b);
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
    if (me.statusTurns > 0) {
      if (!move.usableAsleep && !move.sleepUsable) return cant('slp');
    } else cure(b, me);
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
    else {
      emit(b, { t: 'infatuated', side, name: nameOf(me), by: nameOf(me.vol.attract) });
      if (b.random() < 0.5) return cant('attract');
    }
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

const FOCUS_MOVES = new Set(['focus-punch', 'shell-trap', 'beak-blast']);
const STATUSED = new Set(['brn', 'par', 'psn', 'tox']);
const WEATHER_BALL = { sun: 'fire', harshsun: 'fire', rain: 'water', heavyrain: 'water', sand: 'rock', hail: 'ice', snow: 'ice' };
const TERRAIN_PULSE = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };

function moveOfAction(b, s, idx) {
  const f = activeOf(b, s);
  return idx === STRUGGLE_MOVE ? STRUGGLE : f.moves[idx];
}

const asleep = (b, f) => f.status === 'slp' || flag(b, f, 'comatose');

function failReason(b, me, foe, move, firstAction) {
  const s = sideIndex(b, me);
  if (move.firstTurnOnly && !firstAction) return 'notFirstTurn';
  if (move.id === 'sucker-punch' || move.id === 'thunderclap') {
    const theirs = b.chosen?.[1 - s];
    if (!foe || b.moved.has(foe) || !theirs || theirs.kind === 'status') return 'suckerPunch';
  }
  if (move.id === 'focus-punch' && me.turnHit) return 'lostFocus';
  if (move.id === 'shell-trap' && !me.turnHit?.physical) return 'shellTrap';
  if (move.id === 'last-resort') {
    const others = me.moves.filter((m) => m.key !== 'last-resort');
    if (!others.length || others.some((m) => !me.vol.usedMoves?.has(m.key))) return 'lastResort';
  }
  if (move.id === 'dream-eater' && (!foe || !asleep(b, foe))) return 'notAsleep';
  if (move.id === 'snore' && !asleep(b, me)) return 'notAsleepSelf';
  if (move.id === 'steel-roller' && !b.field.terrain) return 'noTerrain';
  if (move.losesType && !me.types.includes(move.losesType)) return 'noType';
  if (move.id === 'synchronoise' && foe && !foe.types.some((t) => me.types.includes(t))) return 'noSharedType';
  if (move.id === 'captivate' && foe && (!foe.gender || !me.gender || foe.gender === me.gender)) return !foe.gender || !me.gender ? 'genderless' : 'sameGender';
  if (move.selfCost && me.hp <= Math.floor(me.stats.hp * move.selfCost)) return 'lowHp';
  return null;
}

export function moveWillFail(b, s, idx) {
  if (idx === STRUGGLE_MOVE) return false;
  const me = activeOf(b, s);
  const move = me.moves[idx];
  if (!move || move.id === 'sucker-punch' || move.id === 'thunderclap' || move.id === 'focus-punch' || move.id === 'shell-trap') return false;
  return failReason(b, me, foeOf(b, me), move, !me.vol.acted) !== null;
}

function adaptMove(b, me, move) {
  const w = weather(b);
  if (move.id === 'weather-ball' && WEATHER_BALL[w]) {
    move.type = WEATHER_BALL[w];
    move.power = 100;
  }
  if (move.id === 'terrain-pulse' && b.field.terrain && grounded(b, me)) {
    move.type = TERRAIN_PULSE[b.field.terrain];
    move.power = 100;
  }
  if (move.id === 'revelation-dance') move.type = me.types[0];
  if (move.id === 'photon-geyser' && me.stats.atk * stageMult(me.boosts.atk) > me.stats.satk * stageMult(me.boosts.satk)) move.category = 'physical';
}

function basePower(b, me, target, move) {
  const s = sideIndex(b, me);
  const side = b.sides[s];
  const p = move.power;
  switch (move.id) {
    case 'eruption':
    case 'water-spout':
    case 'dragon-energy':
      return Math.max(1, Math.floor((150 * me.hp) / me.stats.hp));
    case 'facade':
      return STATUSED.has(me.status) ? p * 2 : p;
    case 'hex':
      return target.status || flag(b, target, 'comatose') ? p * 2 : p;
    case 'venoshock':
      return poisoned(target.status) ? p * 2 : p;
    case 'brine':
      return target.hp * 2 <= target.stats.hp ? p * 2 : p;
    case 'acrobatics':
      return p * 2;
    case 'payback':
      return b.moved.has(target) ? p * 2 : p;
    case 'avalanche':
    case 'revenge':
      return me.turnHit?.by === target ? p * 2 : p;
    case 'assurance':
      return target.turnHit ? p * 2 : p;
    case 'stored-power':
    case 'power-trip':
      return p + 20 * Object.values(me.boosts).reduce((sum, v) => sum + Math.max(0, v), 0);
    case 'fury-cutter':
      return Math.min(160, p * 2 ** (me.vol.furyCutter ?? 0));
    case 'echoed-voice':
      return Math.min(200, p * (b.echo?.turn === b.turn ? b.echo.count : 1));
    case 'retaliate':
      return side.faintedTurn === b.turn - 1 ? p * 2 : p;
    case 'last-respects':
      return p + 50 * side.team.filter((o) => o !== me && o.hp <= 0).length;
    case 'rage-fist':
      return Math.min(350, p + 50 * (me.timesHit ?? 0));
    case 'rising-voltage':
      return b.field.terrain === 'electric' && grounded(b, target) ? p * 2 : p;
    case 'expanding-force':
      return b.field.terrain === 'psychic' && grounded(b, me) ? p * 1.5 : p;
    case 'psyblade':
      return b.field.terrain === 'electric' ? p * 1.5 : p;
    case 'smelling-salts':
      return target.status === 'par' ? p * 2 : p;
    case 'wake-up-slap':
      return asleep(b, target) ? p * 2 : p;
    case 'bolt-beak':
    case 'fishious-rend':
      return b.moved.has(target) ? p : p * 2;
    case 'stomping-tantrum':
    case 'temper-flare':
      return me.vol.lastFailed ? p * 2 : p;
    case 'fickle-beam':
      return b.random() < 0.3 ? p * 2 : p;
    default:
      return p;
  }
}

function startEcho(b) {
  b.echo = b.echo?.turn === b.turn - 1 || b.echo?.turn === b.turn ? { turn: b.turn, count: Math.min(5, (b.echo.turn === b.turn ? b.echo.count : b.echo.count + 1)) } : { turn: b.turn, count: 1 };
}

function afterHit(b, me, target, move, total) {
  const s = sideIndex(b, me);
  if (target.hp > 0) {
    if (move.id === 'smelling-salts' && target.status === 'par') cure(b, target);
    if (move.id === 'wake-up-slap' && target.status === 'slp') cure(b, target);
    if (move.id === 'clear-smog' && Object.values(target.boosts).some(Boolean)) {
      target.boosts = freshBoosts();
      emit(b, { t: 'boostsReset', side: 1 - s, name: nameOf(target) });
    }
    if (move.grounds && !target.vol.smackedDown && (target.types.includes('flying') || flag(b, target, 'levitates'))) {
      target.vol.smackedDown = true;
      emit(b, { t: 'volatile', side: 1 - s, name: nameOf(target), kind: 'smackdown' });
    }
    if (move.binds && !target.vol.bound) {
      target.vol.bound = { turns: 4 + Math.floor(b.random() * 2), by: me, move: move.name };
      emit(b, { t: 'volatile', side: 1 - s, name: nameOf(target), kind: 'bound', move: move.name });
    }
    if (move.traps && !target.vol.trappedBy) {
      target.vol.trappedBy = me;
      emit(b, { t: 'volatile', side: 1 - s, name: nameOf(target), kind: 'trapped' });
      if (move.id === 'jaw-lock' && !me.vol.trappedBy) me.vol.trappedBy = target;
    }
    if (move.id === 'salt-cure' && !target.vol.saltCure) {
      target.vol.saltCure = true;
      emit(b, { t: 'volatile', side: 1 - s, name: nameOf(target), kind: 'saltcure' });
    }
  }
  if (move.id === 'fell-stinger' && target.hp <= 0 && me.hp > 0) boost(b, me, { atk: 3 }, me);
  afterSelf(b, me, move);
  if (move.forceSwitch && target.hp > 0 && total > 0) dragOut(b, target);
}

function afterSelf(b, me, move) {
  const s = sideIndex(b, me);
  if (move.losesType && me.hp > 0) setTypes(b, me, me.types.filter((t) => t !== move.losesType));
  if (move.id === 'steel-roller' && b.field.terrain) clearTerrain(b);
  if (move.id === 'glaive-rush') me.vol.glaiveRush = b.turn;
  if (move.selfSwitch && me.hp > 0 && b.sides[s].team.some((o) => o !== me && o.hp > 0)) me.vol.switchNow = true;
}

function stealBoosts(b, me, target) {
  const stolen = Object.fromEntries(Object.entries(target.boosts).filter(([, v]) => v > 0));
  if (!Object.keys(stolen).length) return;
  const s = sideIndex(b, target);
  for (const [k, v] of Object.entries(stolen)) {
    target.boosts[k] = 0;
    emit(b, { t: 'boost', side: s, name: nameOf(target), stat: k, by: -v, stage: 0 });
  }
  boost(b, me, stolen, me);
}

function dragOut(b, target) {
  const s = sideIndex(b, target);
  const bench = b.sides[s].team.map((f, i) => i).filter((i) => i !== b.sides[s].active && b.sides[s].team[i].hp > 0);
  if (!bench.length || flag(b, target, 'suctionCups') || target.vol.ingrain) return false;
  const to = bench[Math.floor(b.random() * bench.length)];
  emit(b, { t: 'dragged', side: s, name: nameOf(target) });
  if (doSwitch(b, s, to)) wakeAbilities(b, activeOf(b, s));
  runEntry(b, s);
  return true;
}

function perform(b, s, me, foe, base, move, moveIdx, firstAction, opts = {}) {
  const rules = MOVE_RULES[base.id];
  const failed = failReason(b, me, foe, move, firstAction) ?? rules?.fail?.(moveApi(b), me, foe, move) ?? null;
  if (failed) {
    emit(b, { t: 'nothing', side: s, reason: failed });
    me.vol.lastFailed = true;
    delete me.vol.rampage;
    delete me.vol.furyCutter;
    delete me.vol.locked;
    return;
  }
  if (rules?.call) {
    const called = rules.call(moveApi(b), me, foe, move);
    if (!called?.key) {
      emit(b, { t: 'nothing', side: s, ...(called?.fail ? { reason: called.fail } : {}) });
      me.vol.lastFailed = true;
      return;
    }
    runCalled(b, me, called.key, { powerMult: called.powerMult });
    return;
  }
  if (rules?.before && rules.before(moveApi(b), me, foe, move) === 'skip') return;
  if (base.id === 'echoed-voice') b.echo = b.echo?.turn === b.turn ? b.echo : { turn: b.turn, count: b.echo?.turn === b.turn - 1 ? Math.min(5, b.echo.count + 1) : 1 };
  if (!opts.called) (me.vol.usedMoves ??= new Set()).add(base.key);
  if (!move.flags.includes('failcopycat')) b.lastMove = base.key;
  if (move.curls) me.vol.defenseCurl = true;
  let dealt = 0;
  if (move.kind === 'status') statusMove(b, me, foe, move);
  else {
    dealt = attack(b, me, foe, move) || 0;
    if (dealt && move.flags.includes('recharge') && me.hp > 0 && moveIdx != null) me.vol.mustRecharge = moveIdx;
    if (move.recoilMaxHp && me.hp > 0) hurt(b, me, me.stats.hp * move.recoilMaxHp, 'recoil');
    me.vol.lastFailed = !dealt;
  }
  rules?.after?.(moveApi(b), me, foe, move, dealt);
  if (base.id === 'fury-cutter' && dealt) me.vol.furyCutter = Math.min(2, (me.vol.furyCutter ?? 0) + 1);
  else delete me.vol.furyCutter;
  if (base.rampage && me.hp > 0 && moveIdx != null) {
    if (!me.vol.rampage) me.vol.rampage = { move: moveIdx, left: 1 + Math.floor(b.random() * 2) };
    else me.vol.rampage.left -= 1;
    if (me.vol.rampage.left <= 0) {
      delete me.vol.rampage;
      addVolatile(b, me, 'confusion', me);
    }
  }
  if (move.selfDestruct && me.hp > 0) {
    me.hp = 0;
    faint(b, me);
  }
}

function runCalled(b, me, key, opts = {}) {
  const base = moveData(key);
  if (!base || me.hp <= 0) return;
  const s = sideIndex(b, me);
  const move = { ...base, flags: [...base.flags], effectivePriority: base.priority, slot: null };
  if (opts.powerMult && move.power) move.power = Math.floor(move.power * opts.powerMult);
  adaptMove(b, me, move);
  run(b, me, 'onModifyMove', move);
  const status = move.kind === 'status' ? statusEffectOf(move) : {};
  emit(b, { t: 'move', side: s, name: nameOf(me), move: move.name, type: move.type, kind: move.kind, key: base.key, category: move.category, flags: move.flags, called: true, ...status, ...(move.multihit ? { multihit: true } : {}), ...(move.drain ? { drain: true } : {}) });
  perform(b, s, me, foeOf(b, me), base, move, null, false, { called: true });
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
  const move = { ...base, flags: [...base.flags], effectivePriority: priority, slot: moveIdx };
  const charged = me.vol.charging === moveIdx;
  const continuing = me.vol.rampage?.move === moveIdx || me.vol.locked?.move === moveIdx;
  const firstAction = !me.vol.acted;
  me.vol.acted = true;
  delete me.vol.focusing;
  delete me.vol.destinyBond;
  if (!move.stalling) delete me.vol.stall;
  if (base.id !== 'rage') delete me.vol.rage;
  const blocked = moveIdx === STRUGGLE_MOVE ? null : moveBlocked(b, me, base);
  if (blocked) {
    emit(b, { t: 'cant', side: s, name: nameOf(me), reason: blocked, move: base.name });
    return;
  }
  if (!canAct(b, me, move)) {
    delete me.vol.charging;
    delete me.vol.rampage;
    delete me.vol.furyCutter;
    return;
  }
  run(b, me, 'onBeforeMoveForm', move);
  adaptMove(b, me, move);
  if (me.vol.electrify === b.turn) move.type = 'electric';
  run(b, me, 'onModifyMove', move);
  run(b, me, 'onPrepareMove', move);
  me.revealedMoves.add(base.key);
  me.vol.prevMove = me.vol.lastMove;
  me.vol.lastMove = base.key;
  const status = move.kind === 'status' ? statusEffectOf(move) : {};
  const startsCharge = move.flags.includes('charge') && !charged && !(isSun(weather(b)) && (base.id === 'solar-beam' || base.id === 'solar-blade'));
  if (startsCharge) {
    spendPP(b, me, move);
    me.vol.charging = moveIdx;
    emit(b, { t: 'charging', side: s, name: nameOf(me), move: move.name, key: base.key, hidden: !!HIDDEN_BY[base.id] });
    return;
  }
  emit(b, { t: 'move', side: s, name: nameOf(me), move: move.name, type: move.type, kind: move.kind, key: base.key, category: move.category, flags: move.flags, ...status, ...(move.multihit ? { multihit: true } : {}), ...(move.drain ? { drain: true } : {}), ...(why ? { why } : {}) });

  const foe = foeOf(b, me);
  delete me.vol.charging;
  if (!charged && !continuing) spendPP(b, me, move);

  if (move.selfDestruct && move.kind !== 'status' && anyActiveHas(b, 'damp')) {
    emit(b, { t: 'nothing', side: s });
    return;
  }
  perform(b, s, me, foe, base, move, moveIdx, firstAction);

  run(b, me, 'onAfterMove', move);
  if (move.flags.includes('dance')) {
    const other = foeOf(b, me);
    if (other) run(b, other, 'onFoeMove', me, move);
  }
}

function selfStatus(b, me, move) {
  const s = sideIndex(b, me);
  const snatcher = foeOf(b, me);
  if (snatcher && snatcher.vol.snatch === b.turn && move.flags.includes('snatch')) {
    delete snatcher.vol.snatch;
    emit(b, { t: 'snatched', side: 1 - s, name: nameOf(snatcher), move: move.name });
    return selfStatus(b, snatcher, move);
  }
  const rules = MOVE_RULES[move.id];
  if (rules?.use) {
    rules.use(moveApi(b), me, foeOf(b, me), move);
    return;
  }
  let did = false;
  if (move.selfCost) hurt(b, me, me.stats.hp * move.selfCost, 'cost');
  if (move.id === 'no-retreat') {
    if (me.vol.noRetreat) {
      emit(b, { t: 'nothing', side: sideIndex(b, me) });
      return;
    }
    me.vol.noRetreat = true;
  }
  if (move.id === 'charge' && !me.vol.charge) {
    me.vol.charge = true;
    emit(b, { t: 'volatile', side: sideIndex(b, me), name: nameOf(me), kind: 'charge' });
    did = true;
  }
  if (move.id === 'growth' && isSun(weather(b))) move = { ...move, boosts: { atk: 2, satk: 2 } };
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
  if (blockedByProtection(b, me, foe, move)) return;
  if (foe.vol.substitute && !bypassesSub(b, me, move)) {
    emit(b, { t: 'nothing', side: s, reason: 'substitute' });
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
    if ((move.accuracy != null || hiddenFrom(foe, move)) && !hits(b, me, foe, move)) {
      emit(b, { t: 'miss', side: s });
      return;
    }
    if (flag(b, foe, 'bouncesStatus') && move.flags.includes('reflectable')) {
      showAbility(b, foe, 'bounce');
      target = me;
    } else if (foe.vol.magicCoat === b.turn && move.flags.includes('reflectable')) {
      emit(b, { t: 'bounced', side: 1 - s, name: nameOf(foe), move: move.name });
      target = me;
    }
  } finally {
    b.mold = null;
  }
  const source = target === me ? foe : me;
  const rules = MOVE_RULES[move.id];
  if (rules?.use) {
    rules.use(moveApi(b), source, target, move);
    return;
  }
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
    for (const side of [0, 1]) did = clearHazards(b, side) || did;
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

const HIDDEN_BY = { fly: 'air', bounce: 'air', 'sky-drop': 'air', dig: 'ground', dive: 'water', 'phantom-force': 'vanished', 'shadow-force': 'vanished' };
const REACHES_HIDDEN = { air: ['gust', 'twister', 'thunder', 'sky-uppercut', 'hurricane', 'smack-down', 'thousand-arrows'], ground: ['earthquake', 'magnitude', 'fissure'], water: ['surf', 'whirlpool'], vanished: [] };

export function hiddenFrom(target, move) {
  if (target.vol.charging == null) return false;
  const place = HIDDEN_BY[target.moves[target.vol.charging]?.id];
  return !!place && !REACHES_HIDDEN[place].includes(move.id);
}

function hits(b, me, target, move) {
  if (hiddenFrom(target, move)) return flag(b, me, 'alwaysHits') || flag(b, target, 'alwaysHits');
  if (move.ohko) return b.random() * 100 < 30 + me.level - target.level;
  if (move.accuracy == null || flag(b, me, 'alwaysHits') || flag(b, target, 'alwaysHits')) return true;
  if (target.vol.telekinesis || me.vol.lockOn === target) return true;
  const w = weather(b);
  if (move.id === 'blizzard' && (w === 'hail' || w === 'snow')) return true;
  if ((move.id === 'thunder' || move.id === 'hurricane') && isRain(w)) return true;
  if ((move.id === 'thunder' || move.id === 'hurricane') && isSun(w)) return b.random() * 100 < 50;
  if (move.kind === 'status' && flag(b, target, 'wonderSkin')) return b.random() < 0.5;
  const accStage = flag(b, target, 'unaware') ? 0 : me.boosts.acc;
  const evaStage = flag(b, me, 'unaware') || flag(b, me, 'ignoresEvasion') || target.vol.foresight || target.vol.miracleEye ? Math.min(0, target.boosts.eva) : target.boosts.eva;
  let acc = move.accuracy * accuracyMult(clamp(accStage - evaStage, -STAGE_LIMIT, STAGE_LIMIT));
  if (b.field.rooms.gravity) acc *= 5 / 3;
  acc = chain(b, me, 'onAccuracy', acc, move, target);
  acc = chain(b, target, 'onEvasion', acc, move, me);
  return b.random() * 100 < acc;
}

function rollCrit(b, me, target, move) {
  if (flag(b, target, 'critImmune') || b.sides[sideIndex(b, target)].conds.luckychant) return false;
  if (me.vol.laserFocus != null && me.vol.laserFocus >= b.turn) return true;
  const stage = chain(b, me, 'onCritStage', (move.crit || 0) + (me.vol.focusEnergy ? 2 : 0), move, target);
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
  if (b.field.rooms.mudsport && move.type === 'electric') m /= 3;
  if (b.field.rooms.watersport && move.type === 'fire') m /= 3;
  return m;
}

function computeDamage(b, me, target, move, eff, hitPower) {
  const crit = rollCrit(b, me, target, move);
  const physical = move.category === 'physical';
  const atkKey = move.usesDefense ? 'def' : physical ? 'atk' : 'satk';
  const defKey = physical || move.hitsPhysicalDef ? 'def' : 'sdef';
  const attacker = move.usesTargetAttack ? target : me;
  let atkStage = flag(b, target, 'unaware') ? 0 : attacker.boosts[atkKey];
  if (crit && atkStage < 0) atkStage = 0;
  let defStage = flag(b, me, 'unaware') || move.ignoresDefBoosts ? 0 : target.boosts[defKey];
  if (crit && defStage > 0) defStage = 0;
  const w = weather(b);

  const a = attacker.stats[atkKey] * stageMult(atkStage) * mul(b, me, 'onAttack', move, target) * ruin(b, me, physical ? 'tablets-of-ruin' : 'vessel-of-ruin');
  const defStat = b.field.rooms.wonderroom ? (defKey === 'def' ? 'sdef' : 'def') : defKey;
  let d = target.stats[defStat] * stageMult(defStage) * mul(b, target, 'onDefense', move, me) * ruin(b, target, physical ? 'sword-of-ruin' : 'beads-of-ruin');
  if (w === 'sand' && !physical && target.types.includes('rock')) d *= 1.5;
  if (w === 'snow' && physical && target.types.includes('ice')) d *= 1.5;

  let dmg = (((2 * me.level) / 5 + 2) * hitPower * powerMods(b, me, target, move) * (a / d)) / 50 + 2;
  const mw = weatherFor(b, me);
  if (isSun(mw)) dmg *= move.type === 'fire' || move.id === 'hydro-steam' ? 1.5 : move.type === 'water' ? 0.5 : 1;
  if (isRain(mw)) dmg *= move.type === 'water' ? 1.5 : move.type === 'fire' ? 0.5 : 1;
  if (move.type && me.types.includes(move.type)) dmg *= flag(b, me, 'stab') ? abilityDef(b, me).stab : 1.5;
  dmg *= eff * (0.85 + b.random() * 0.15) * (crit ? 1.5 : 1);
  if (me.status === 'brn' && physical && !flag(b, me, 'ignoresBurn') && move.id !== 'facade') dmg *= 0.5;
  if (!crit && screened(b, me, target, move)) dmg *= 0.5;
  if ((move.id === 'collision-course' || move.id === 'electro-drift') && eff > 1) dmg *= 5461 / 4096;
  if (target.vol.glaiveRush != null && b.turn - target.vol.glaiveRush <= 1) dmg *= 2;
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
  if (blockedByProtection(b, me, target, move)) return 0;
  const rules = MOVE_RULES[move.id];
  const typeEff = typeEffectiveness(b, move, me, target);
  const crash = () => move.crashes && me.hp > 0 && hurt(b, me, me.stats.hp / 2, 'crash');
  b.mold = flag(b, me, 'moldBreaker') ? { target } : null;
  try {
    if (run(b, target, 'onTryHit', move, me)) {
      crash();
      return;
    }
    if (typeEff === 0 && !move.ignoresImmunity) {
      emit(b, { t: 'immune', side: 1 - s });
      crash();
      return;
    }
    if (b.field.terrain === 'psychic' && move.effectivePriority > 0 && grounded(b, target)) {
      emit(b, { t: 'immune', side: 1 - s, terrain: 'psychic' });
      return;
    }
    if (!hits(b, me, target, move)) {
      emit(b, { t: 'miss', side: s });
      crash();
      return;
    }
    const fixed = rules?.damage ? rules.damage(moveApi(b), me, target, move) : undefined;
    if (fixed === null) {
      emit(b, { t: 'nothing', side: s });
      return 0;
    }
    if (move.breaksScreens) clearScreens(b, sideIndex(b, target), 'broken');
    move.power = rules?.power ? rules.power(moveApi(b), me, target, move) : basePower(b, me, target, move);
    if (move.id === 'spectral-thief') stealBoosts(b, me, target);
    const eff = chain(b, target, 'onEffectiveness', typeEff || 1, move, me);
    const count = rules?.hits ? rules.hits(moveApi(b), me) : rollHits(b, me, move);
    let total = 0;
    let lastHit = 0;
    let landed = 0;
    let toSub = false;
    for (let i = 0; i < count && target.hp > 0 && me.hp > 0; i++) {
      const hitPower = rules?.hitPower ? rules.hitPower(moveApi(b), me, i) : i > 0 && !move.multihit ? move.power * 0.25 : move.power;
      const { dmg, crit } = fixed !== undefined ? { dmg: fixed, crit: false } : move.ohko || move.fixedDamage ? { dmg: fixedDamage(me, target, move), crit: false } : computeDamage(b, me, target, move, eff, hitPower);
      if (target.vol.substitute && !bypassesSub(b, me, move)) {
        const absorbed = Math.min(target.vol.substitute, dmg);
        target.vol.substitute -= absorbed;
        total += absorbed;
        landed += 1;
        toSub = true;
        emit(b, { t: 'subDamage', side: 1 - s, name: nameOf(target), amount: absorbed, eff, crit });
        if (target.vol.substitute <= 0) {
          delete target.vol.substitute;
          emit(b, { t: 'volatileEnd', side: 1 - s, name: nameOf(target), kind: 'substitute' });
        }
        continue;
      }
      let dealt = Math.min(target.hp, chain(b, target, 'onDamage', dmg, move, me));
      if (move.leavesOne && dealt >= target.hp) dealt = Math.max(0, target.hp - 1);
      const endured = target.vol.endure === b.turn && dealt >= target.hp && target.hp > 0;
      if (endured) dealt = target.hp - 1;
      const before = target.hp;
      target.hp -= dealt;
      total += dealt;
      lastHit = dealt;
      landed += 1;
      emit(b, { t: 'damage', side: 1 - s, amount: dealt, hp: target.hp, max: target.stats.hp, eff, crit });
      if (endured) emit(b, { t: 'endured', side: 1 - s, name: nameOf(target) });
      if (dealt > 0) {
        const prev = target.turnHit?.by === me ? target.turnHit.amount : 0;
        target.turnHit = { by: me, physical: move.category === 'physical', special: move.category === 'special', amount: prev + dealt };
        target.timesHit = (target.timesHit ?? 0) + 1;
        if (target.vol.locked?.kind === 'bide') target.vol.locked.damage += dealt;
        if (target.vol.rage && target.hp > 0) boost(b, target, { atk: 1 }, target);
      }
      if (target.status === 'frz' && (move.type === 'fire' || move.flags.includes('defrost')) && target.hp > 0) cure(b, target);
      if (target.vol.focusing === 'beak-blast' && move.flags.includes('contact') && me.hp > 0) setStatus(b, me, 'brn', target);
      run(b, target, 'onDamagingHit', move, me, { crit, before, dmg: dealt });
    }
    if (landed > 1) emit(b, { t: 'hits', side: 1 - s, count: landed });
    if (me.vol.charge && move.type === 'electric') delete me.vol.charge;

    if (!toSub) applySecondaries(b, me, target, move);
    if (move.self && me.hp > 0) boost(b, me, move.self, me);
    if (move.recoil && total > 0 && !flag(b, me, 'noRecoil')) hurt(b, me, total * move.recoil, 'recoil');
    if (move.drain && total > 0 && me.hp > 0) {
      const amount = Math.max(1, Math.round(total * move.drain));
      if (flag(b, target, 'oozes')) {
        showAbility(b, target);
        hurt(b, me, amount, 'ooze');
      } else heal(b, me, amount);
    }
    if (me.hp > 0 && !toSub) run(b, me, 'onAfterMoveHit', move, target, total);
    if (target.hp <= 0) faint(b, target, me, move, lastHit);
    if (!toSub) afterHit(b, me, target, move, total);
    else afterSelf(b, me, move);
    if ((move.id === 'rapid-spin' || move.id === 'mortal-spin') && me.hp > 0) {
      clearHazards(b, s);
      delete me.vol.bound;
      delete me.vol.leechSeed;
    }
    rules?.hit?.(moveApi(b), me, target, move, total);
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
  for (const f of activeFighters(b)) f.activeTurns += 1;
  const acts = b.sides.map((side, s) => ({ s, ...side.action }));
  b.chosen = acts.map((a) => (a.type === 'move' ? moveOfAction(b, a.s, a.move) : null));
  for (const side of b.sides) side.action = null;
  for (const side of b.sides) for (const f of side.team) delete f.turnHit;

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
      return { ...a, f, prio: chain(b, f, 'onModifyPriority', move.priority, move), frac: typeof frac === 'number' ? frac : 0, spd: speedOf(b, f), tie: b.random() };
    })
    .sort((x, y) => y.prio - x.prio || y.frac - x.frac || (b.field.rooms.trickroom ? x.spd - y.spd : y.spd - x.spd) || y.tie - x.tie);

  // When both attack, say why the first one went first (priority move, faster, or a coin flip).
  const why = movers.length === 2 ? (movers[0].prio !== movers[1].prio || movers[0].frac !== movers[1].frac ? 'priority' : movers[0].spd !== movers[1].spd ? 'speed' : 'tie') : null;
  movers.forEach((a, i) => (a.why = i === 0 ? why : null));

  for (const a of movers) {
    const move = moveOfAction(b, a.s, a.move);
    if (FOCUS_MOVES.has(move.id) && a.f.hp > 0) {
      a.f.vol.focusing = move.id;
      emit(b, { t: 'focus', side: a.s, name: nameOf(a.f), move: move.name, key: move.id });
    }
  }

  return continueTurn(b, events, movers, 0);
}

function continueTurn(b, events, movers, from) {
  for (let i = from; i < movers.length; i++) {
    const a = movers[i];
    if (activeOf(b, a.s) !== a.f) continue;
    useMove(b, a.s, a.move, a.prio, a.why);
    settle(b);
    if (checkEnd(b)) return done(b, events);
    if (pauseForSwitch(b, [a.s, 1 - a.s], movers, i + 1)) return done(b, events);
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

function pauseForSwitch(b, sides, movers, next) {
  for (const s of sides) {
    if (switchNow(b, s)) {
      b.pending = { movers, next };
      b.phase = 'switchout';
      return true;
    }
  }
  return false;
}

function switchNow(b, s) {
  const side = b.sides[s];
  const f = activeOf(b, s);
  if (!f.vol.switchNow) return false;
  delete f.vol.switchNow;
  const options = side.team.map((o, i) => i).filter((i) => i !== side.active && side.team[i].hp > 0);
  if (f.hp <= 0 || !options.length) {
    delete side.pass;
    return false;
  }
  emit(b, { t: 'switchOut', side: s, name: nameOf(f) });
  if (options.length === 1) {
    selfSwitch(b, s, options[0]);
    return false;
  }
  side.mustSwitch = true;
  return true;
}

function selfSwitch(b, s, to) {
  if (doSwitch(b, s, to)) wakeAbilities(b, activeOf(b, s));
  runEntry(b, s);
  settle(b);
}

function resolveSwitchOut(b) {
  const events = [];
  b.ev = events;
  const s = b.sides.findIndex((side) => side.mustSwitch);
  const side = b.sides[s];
  const to = side.action.to;
  for (const x of b.sides) x.action = null;
  side.mustSwitch = false;
  const { movers, next } = b.pending;
  delete b.pending;
  b.phase = 'choose';
  selfSwitch(b, s, to);
  if (checkEnd(b)) return done(b, events);
  if (pauseForSwitch(b, [0, 1], movers, next)) return done(b, events);
  return continueTurn(b, events, movers, next);
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
    if (f.hp > 0 && f.vol.bound) {
      const bound = f.vol.bound;
      if (!onField(b, bound.by) || --bound.turns <= 0) {
        delete f.vol.bound;
        emit(b, { t: 'volatileEnd', side: sideIndex(b, f), name: nameOf(f), kind: 'bound', move: bound.move });
      } else hurt(b, f, f.stats.hp / 8, 'bound');
    }
    if (f.hp > 0 && f.vol.saltCure) hurt(b, f, f.stats.hp / (f.types.includes('water') || f.types.includes('steel') ? 4 : 8), 'saltcure');
    if (f.hp > 0 && f.vol.aquaRing) heal(b, f, f.stats.hp / 16);
    if (f.hp > 0 && f.vol.ingrain) heal(b, f, f.stats.hp / 16);
    if (f.hp > 0 && f.vol.curse) hurt(b, f, f.stats.hp / 4, 'curse');
    if (f.hp > 0 && f.vol.nightmare) {
      if (f.status === 'slp') hurt(b, f, f.stats.hp / 4, 'nightmare');
      else delete f.vol.nightmare;
    }
    if (f.hp > 0 && f.vol.octolock) {
      if (onField(b, f.vol.octolock)) boost(b, f, { def: -1, sdef: -1 }, f.vol.octolock);
      else delete f.vol.octolock;
    }
  }
  settle(b);
  for (const f of order()) {
    if (f.vol.yawn && --f.vol.yawn <= 0) {
      delete f.vol.yawn;
      setStatus(b, f, 'slp', null);
    }
    for (const [key, kind] of [['taunt', 'taunt'], ['encore', 'encore'], ['healBlock', 'healblock'], ['telekinesis', 'telekinesis'], ['magnetRise', 'magnetrise']]) {
      const v = f.vol[key];
      if (!v) continue;
      if (--v.turns <= 0 || (key === 'encore' && !(f.pp[v.key] > 0))) {
        delete f.vol[key];
        emit(b, { t: 'volatileEnd', side: sideIndex(b, f), name: nameOf(f), kind });
      }
    }
  }
  b.sides.forEach((side, s) => {
    const f = activeOf(b, s);
    if (side.wish && side.wish.at <= b.turn) {
      const wish = side.wish;
      delete side.wish;
      if (f.hp > 0) {
        emit(b, { t: 'wish', side: s, name: wish.name });
        heal(b, f, wish.amount);
      }
    }
    if (side.future && side.future.at <= b.turn) {
      const future = side.future;
      delete side.future;
      if (f.hp > 0) {
        emit(b, { t: 'futureHit', side: s, name: nameOf(f), move: future.name });
        const eff = typeEffectiveness(b, future.move, future.user, f);
        if (eff === 0) emit(b, { t: 'immune', side: s });
        else {
          const { dmg } = computeDamage(b, future.user, f, future.move, eff, future.move.power);
          hurt(b, f, dmg, 'future');
        }
      }
    }
    for (const key of Object.keys(side.conds)) {
      const v = side.conds[key];
      if (['quickguard', 'wideguard', 'craftyshield', 'matblock'].includes(key)) {
        if (v < b.turn + 1) delete side.conds[key];
        continue;
      }
      if (--side.conds[key] <= 0) {
        delete side.conds[key];
        emit(b, { t: 'sideEnd', side: s, kind: key });
      }
    }
  });
  settle(b);
  for (const key of Object.keys(b.field.rooms)) {
    if (--b.field.rooms[key] <= 0) {
      delete b.field.rooms[key];
      emit(b, { t: 'fieldEnd', kind: key });
    }
  }
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
    const escaping = f.hp > 0 && (f.vol.exitPending || f.vol.switchNow) && side.team.some((o) => o !== f && o.hp > 0);
    delete f.vol.switchNow;
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
    ...(v.bound ? { bound: v.bound.move } : {}),
    ...(v.trappedBy ? { trapped: true } : {}),
    ...(v.saltCure ? { saltcure: true } : {}),
    ...(v.smackedDown ? { smackdown: true } : {}),
    ...(v.noRetreat ? { noRetreat: true } : {}),
    ...(v.substitute ? { substitute: true } : {}),
    ...(v.taunt ? { taunt: v.taunt.turns } : {}),
    ...(v.encore ? { encore: v.encore.key } : {}),
    ...(v.torment ? { torment: true } : {}),
    ...(v.healBlock ? { healblock: v.healBlock.turns } : {}),
    ...(v.yawn ? { yawn: true } : {}),
    ...(v.nightmare ? { nightmare: true } : {}),
    ...(v.curse ? { curse: true } : {}),
    ...(v.focusEnergy ? { focusenergy: true } : {}),
    ...(v.ingrain ? { ingrain: true } : {}),
    ...(v.aquaRing ? { aquaring: true } : {}),
    ...(v.magnetRise ? { magnetrise: v.magnetRise.turns } : {}),
    ...(v.telekinesis ? { telekinesis: v.telekinesis.turns } : {}),
    ...(v.foresight ? { foresight: true } : {}),
    ...(v.miracleEye ? { miracleeye: true } : {}),
    ...(v.stockpile ? { stockpile: v.stockpile.count } : {}),
    ...(v.gastroAcid ? { gastroacid: true } : {}),
    ...(v.uproar ? { uproar: true } : {}),
    ...(v.imprison ? { imprison: true } : {}),
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
    field: { weather: b.field.weather, terrain: b.field.terrain, weatherSuppressed: !!b.field.weather && !weather(b), rooms: { ...b.field.rooms } },
    intro: b.turn === 1 && b.phase === 'choose' ? viewEvents(b.intro, viewer) : [],
    sides: b.sides.map((side, s) => ({
      trainerId: side.trainerId,
      name: side.name,
      active: side.active,
      ready: !needsAction(b, s),
      mustSwitch: side.mustSwitch,
      toxicSpikes: side.toxicSpikes,
      screens: { ...side.screens },
      hazards: { ...side.hazards },
      conds: Object.fromEntries(Object.entries(side.conds).filter(([k]) => ['tailwind', 'safeguard', 'mist', 'luckychant'].includes(k))),
      ...(side.wish ? { wish: true } : {}),
      ...(side.future ? { future: side.future.name } : {}),
      team: side.team.map((f, i) => fighterView(b, s, i, viewer === s || b.status === 'finished')),
    })),
  };
}

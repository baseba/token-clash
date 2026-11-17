// Special rules of moves: what the generic engine (combat/domain/battle.ts) can't express with the
// move's data alone (Protect, Substitute, Metronome, Psych Up…). Each rule gets the MoveRuleApi that
// battle.ts hands it, so it never touches the battle state directly.
import { moveData, type BoostKey, type Boosts, type MoveData } from './creatures.js';
import { TYPES } from './type-chart.js';
import type { MoveRuleApi } from '../../combat/domain/battle.js';
import type { BattleFighter, BattleMove } from '../../combat/domain/battle-types.js';

type A = MoveRuleApi;
type F = BattleFighter;
type M = BattleMove;

/** What a calling move (Metronome, Copycat…) asks the engine to use instead. */
export interface CalledMove {
  key?: string;
  powerMult?: number;
  fail?: string | null;
}

/**
 * The hooks a move may define. `foe` is the rival on the field. The engine stops a move that targets
 * the foe when there is none, so rules that read it always get one; only self moves may run with no
 * foe on the field, and their rules don't read it (the engine passes it through unchecked).
 */
export interface MoveRule {
  /** Why it fails before doing anything (a reason for the browser), or nothing. */
  fail?(api: A, me: F, foe: F, move: M): string | null | undefined | false;
  /** Use another move instead. */
  call?(api: A, me: F, foe: F, move: M): CalledMove | null | undefined;
  /** Runs before the move; 'skip' stops it. */
  before?(api: A, me: F, foe: F, move: M): unknown;
  /** The whole effect of a status move. */
  use?(api: A, me: F, foe: F, move: M): unknown;
  /** After the move, with the damage it dealt. */
  after?(api: A, me: F, foe: F, move: M, dealt: number): unknown;
  /** Fixed damage of an attack (null: it does nothing). */
  damage?(api: A, me: F, target: F, move: M): number | null | undefined;
  /** Base power of an attack. */
  power?(api: A, me: F, target: F, move: M): number;
  /** How many times it hits. */
  hits?(api: A, me: F): number;
  /** Power of hit number i. */
  hitPower?(api: A, me: F, hit: number): number;
  /** After all hits landed, with the total damage. */
  hit?(api: A, me: F, target: F, move: M, total: number): unknown;
}


export const IMPOSSIBLE_MOVES = new Set([
  'belch', 'bestow', 'fling', 'natural-gift', 'recycle', 'stuff-cheeks', 'switcheroo', 'trick', 'teatime', 'embargo', 'magic-room',
  'after-you', 'ally-switch', 'follow-me', 'rage-powder', 'helping-hand', 'magnetic-flux',
]);

const SIDE_TURNS: Record<string, number> = { tailwind: 4, safeguard: 5, mist: 5, 'lucky-chant': 5 };
const ROOM_TURNS: Record<string, number> = { gravity: 5, 'trick-room': 5, 'wonder-room': 5, 'mud-sport': 5, 'water-sport': 5 };
const NO_COPY_ABILITY = new Set<string | null>(['wonder-guard', 'multitype', 'illusion', 'stance-change', 'schooling', 'comatose', 'shields-down', 'disguise', 'rks-system', 'battle-bond', 'power-construct', 'ice-face', 'gulp-missile', 'zen-mode', 'imposter', 'trace', 'receiver', 'power-of-alchemy', 'neutralizing-gas', 'as-one-glastrier', 'as-one-spectrier', 'commander', 'zero-to-hero', 'tera-shift', 'protosynthesis', 'quark-drive']);
const NO_ENCORE = new Set(['encore', 'transform', 'mimic', 'sketch', 'struggle', 'sleep-talk', 'metronome', 'assist', 'copycat', 'mirror-move', 'me-first', 'instruct']);
const STATS: BoostKey[] = ['atk', 'def', 'satk', 'sdef', 'spd', 'acc', 'eva'];
const NATURE_POWER: Record<string, string> = { electric: 'thunderbolt', grassy: 'energy-ball', misty: 'moonblast', psychic: 'psychic' };
const CAMOUFLAGE: Record<string, string> = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };
const MAGNITUDES: [number, number, number][] = [[4, 10, 0.05], [5, 30, 0.15], [6, 50, 0.35], [7, 70, 0.65], [8, 90, 0.85], [9, 110, 0.95], [10, 150, 1]];

const pick = <T>(api: A, list: readonly T[]): T => list[Math.floor(api.random() * list.length)];
const positive = (boosts: Boosts): number => (Object.values(boosts) as number[]).reduce((sum, v) => sum + Math.max(0, v), 0);
const lastMoveOf = (fighter: F | null | undefined): MoveData | null => (fighter?.vol.lastMove ? moveData(fighter.vol.lastMove) : null);
const benchAlive = (api: A, fighter: F): boolean => api.side(api.sideOf(fighter)).team.some((o) => o !== fighter && o.hp > 0);
const stockpiled = (fighter: F): number => fighter.vol.stockpile?.count ?? 0;

function fixedRatio(ratio: number, table: readonly (readonly [number, number])[]): number {
  for (const [min, power] of table) if (ratio >= min) return power;
  return table[table.length - 1][1];
}

function weightPower(kg: number): number {
  if (kg < 10) return 20;
  if (kg < 25) return 40;
  if (kg < 50) return 60;
  if (kg < 100) return 80;
  if (kg < 200) return 100;
  return 120;
}

function setSide(api: A, me: F, key: string, turns: number, target: F = me): boolean {
  const sideIndex = api.sideOf(target);
  const conds = api.side(sideIndex).conds;
  if (conds[key]) return false;
  conds[key] = turns;
  api.sideStart(sideIndex, key);
  return true;
}

function setRoom(api: A, key: string, turns: number): boolean {
  const rooms = api.b.field.rooms;
  if (rooms[key] && (key === 'trickroom' || key === 'wonderroom')) {
    delete rooms[key];
    api.fieldEnd(key);
    return true;
  }
  if (rooms[key]) return false;
  rooms[key] = turns;
  api.fieldStart(key);
  if (key === 'gravity') {
    for (const fighter of api.actives()) {
      if (fighter.vol.magnetRise || fighter.vol.telekinesis) {
        delete fighter.vol.magnetRise;
        delete fighter.vol.telekinesis;
        api.volEnd(fighter, 'airborne');
      }
    }
  }
  return true;
}

function setVol(api: A, fighter: F, key: string, value: unknown, kind: string = key, extra: Record<string, unknown> = {}): boolean {
  if (fighter.vol[key]) return false;
  fighter.vol[key] = value;
  api.vol(fighter, kind, extra);
  return true;
}

function copyAbility(api: A, to: F, key: string | null): boolean {
  if (!key || NO_COPY_ABILITY.has(key) || to.ability === key || NO_COPY_ABILITY.has(to.ability)) return false;
  api.changeAbility(to, key);
  return true;
}

function setBoosts(api: A, fighter: F, boosts: Boosts): boolean {
  api.setBoosts(fighter, boosts);
  return true;
}

const protect: MoveRule = { use: (api, me, foe, move) => api.protect(me, move.id) };

export const MOVE_RULES: Record<string, MoveRule> = {
  protect,
  detect: protect,
  'kings-shield': protect,
  'spiky-shield': protect,
  'baneful-bunker': protect,
  obstruct: protect,
  'silk-trap': protect,
  'burning-bulwark': protect,
  endure: { use: (api, me) => api.protect(me, 'endure') },
  'quick-guard': { use: (api, me) => api.guard(me, 'quickguard') },
  'wide-guard': { use: (api, me) => api.guard(me, 'wideguard') },
  'crafty-shield': { use: (api, me) => api.guard(me, 'craftyshield') },
  'mat-block': { use: (api, me) => api.guard(me, 'matblock') },

  substitute: {
    use(api, me) {
      if (me.vol.substitute || me.hp <= Math.floor(me.stats.hp / 4)) return api.nothing(me, me.vol.substitute ? null : 'lowHp');
      api.hurt(me, Math.floor(me.stats.hp / 4), 'cost');
      me.vol.substitute = Math.floor(me.stats.hp / 4);
      api.vol(me, 'substitute');
      return true;
    },
  },

  spikes: { use: (api, me, foe) => api.hazard(me, 'spikes') },
  'stealth-rock': { use: (api, me) => api.hazard(me, 'stealthrock') },
  'toxic-spikes': { use: (api, me) => api.hazard(me, 'toxicspikes') },
  'sticky-web': { use: (api, me) => api.hazard(me, 'stickyweb') },
  tailwind: { use: (api, me) => setSide(api, me, 'tailwind', SIDE_TURNS.tailwind) },
  safeguard: { use: (api, me) => setSide(api, me, 'safeguard', SIDE_TURNS.safeguard) },
  mist: { use: (api, me) => setSide(api, me, 'mist', SIDE_TURNS.mist) },
  'lucky-chant': { use: (api, me) => setSide(api, me, 'luckychant', SIDE_TURNS['lucky-chant']) },
  gravity: { use: (api) => setRoom(api, 'gravity', ROOM_TURNS.gravity) },
  'trick-room': { use: (api) => setRoom(api, 'trickroom', ROOM_TURNS['trick-room']) },
  'wonder-room': { use: (api) => setRoom(api, 'wonderroom', ROOM_TURNS['wonder-room']) },
  'mud-sport': { use: (api) => setRoom(api, 'mudsport', ROOM_TURNS['mud-sport']) },
  'water-sport': { use: (api) => setRoom(api, 'watersport', ROOM_TURNS['water-sport']) },
  'fairy-lock': { use: (api) => setRoom(api, 'fairylock', 2) },
  'court-change': { use: (api) => api.courtChange() },
  'tidy-up': {
    use(api, me) {
      for (const fighter of api.actives()) if (fighter.vol.substitute) { delete fighter.vol.substitute; api.volEnd(fighter, 'substitute'); }
      api.clearHazards(0);
      api.clearHazards(1);
      api.boost(me, { atk: 1, spd: 1 }, me);
      return true;
    },
  },

  haze: { use: (api) => { for (const fighter of api.actives()) setBoosts(api, fighter, Object.fromEntries(STATS.map((k) => [k, 0]))); return true; } },
  'psych-up': { use: (api, me, foe) => { setBoosts(api, me, foe.boosts); if (foe.vol.focusEnergy) me.vol.focusEnergy = true; return true; } },
  'topsy-turvy': { use: (api, me, foe) => (Object.values(foe.boosts).some(Boolean) ? setBoosts(api, foe, Object.fromEntries(STATS.map((k) => [k, -foe.boosts[k] || 0]))) : api.nothing(me)) },
  'guard-swap': { use: (api, me, foe) => api.swapBoosts(me, foe, ['def', 'sdef']) },
  'power-swap': { use: (api, me, foe) => api.swapBoosts(me, foe, ['atk', 'satk']) },
  'heart-swap': { use: (api, me, foe) => api.swapBoosts(me, foe, STATS) },
  'speed-swap': { use: (api, me, foe) => { const ownSpeed = me.stats.spd; api.setStats(me, { spd: foe.stats.spd }); api.setStats(foe, { spd: ownSpeed }); return true; } },
  'guard-split': { use: (api, me, foe) => api.splitStats(me, foe, ['def', 'sdef']) },
  'power-split': { use: (api, me, foe) => api.splitStats(me, foe, ['atk', 'satk']) },
  'power-trick': { use: (api, me) => { api.setStats(me, { atk: me.stats.def, def: me.stats.atk }); me.vol.powerTrick = !me.vol.powerTrick; return true; } },
  acupressure: {
    use(api, me) {
      const open = STATS.filter((k) => me.boosts[k] < 6);
      if (!open.length) return api.nothing(me);
      api.boost(me, { [pick(api, open)]: 2 }, me);
      return true;
    },
  },
  'belly-drum': {
    use(api, me) {
      if (me.hp <= Math.floor(me.stats.hp / 2) || me.boosts.atk >= 6) return api.nothing(me, me.boosts.atk >= 6 ? null : 'lowHp');
      api.hurt(me, Math.floor(me.stats.hp / 2), 'cost');
      api.boost(me, { atk: 12 }, me);
      return true;
    },
  },
  'focus-energy': { use: (api, me) => setVol(api, me, 'focusEnergy', true, 'focusenergy') },
  'laser-focus': { use: (api, me) => { me.vol.laserFocus = api.turn() + 1; api.vol(me, 'laserfocus'); return true; } },
  'lock-on': { use: (api, me, foe) => { me.vol.lockOn = foe; api.vol(me, 'lockon'); return true; } },
  'mind-reader': { use: (api, me, foe) => { me.vol.lockOn = foe; api.vol(me, 'lockon'); return true; } },
  'magnet-rise': { use: (api, me) => (api.b.field.rooms.gravity || me.vol.ingrain ? api.nothing(me) : setVol(api, me, 'magnetRise', { turns: 5 }, 'magnetrise')) },
  telekinesis: { use: (api, me, foe) => (api.b.field.rooms.gravity || foe.vol.ingrain ? api.nothing(me) : setVol(api, foe, 'telekinesis', { turns: 3 })) },
  ingrain: { use: (api, me) => setVol(api, me, 'ingrain', true) },
  'aqua-ring': { use: (api, me) => setVol(api, me, 'aquaRing', true, 'aquaring') },
  stockpile: {
    use(api, me) {
      if (stockpiled(me) >= 3) return api.nothing(me);
      const applied = api.boost(me, { def: 1, sdef: 1 }, me);
      me.vol.stockpile = { count: stockpiled(me) + 1, def: (me.vol.stockpile?.def ?? 0) + (applied.def ?? 0), sdef: (me.vol.stockpile?.sdef ?? 0) + (applied.sdef ?? 0) };
      api.vol(me, 'stockpile', { count: me.vol.stockpile.count });
      return true;
    },
  },
  swallow: {
    use(api, me) {
      const stockpile = stockpiled(me);
      if (!stockpile) return api.nothing(me, 'noStockpile');
      api.heal(me, me.stats.hp * [0.25, 0.5, 1][stockpile - 1]);
      api.dropStockpile(me);
      return true;
    },
  },

  taunt: { use: (api, me, foe) => setVol(api, foe, 'taunt', { turns: 3 }) },
  torment: { use: (api, me, foe) => setVol(api, foe, 'torment', true) },
  'heal-block': { use: (api, me, foe) => setVol(api, foe, 'healBlock', { turns: 5 }, 'healblock') },
  imprison: { use: (api, me, foe) => (foe && foe.moves.some((m) => me.moves.some((x) => x.key === m.key)) ? setVol(api, me, 'imprison', true) : api.nothing(me)) },
  encore: {
    use(api, me, foe) {
      const last = foe.vol.lastMove;
      if (!last || NO_ENCORE.has(last) || foe.vol.encore || !foe.moves.some((m) => m.key === last)) return api.nothing(me);
      return setVol(api, foe, 'encore', { key: last, turns: 3 }, 'encore', { move: moveData(last)?.name });
    },
  },
  disable: {
    use(api, me, foe) {
      const last = foe.vol.lastMove && foe.moves.find((m) => m.key === foe.vol.lastMove);
      return last ? api.addVolatile(foe, 'disable', me, { move: last }) : api.nothing(me);
    },
  },
  spite: {
    use(api, me, foe) {
      const last = foe.vol.lastMove;
      if (!last || !(foe.pp[last] > 0)) return api.nothing(me);
      const lost = Math.min(4, foe.pp[last]);
      foe.pp[last] -= lost;
      api.emit({ t: 'pp', side: api.sideOf(foe), name: api.name(foe), move: moveData(last)?.name, lost });
      return true;
    },
  },
  yawn: {
    use(api, me, foe) {
      if (foe.status || foe.vol.yawn || api.side(api.sideOf(foe)).conds.safeguard) return api.nothing(me);
      return setVol(api, foe, 'yawn', 2);
    },
  },
  nightmare: { use: (api, me, foe) => (foe.status === 'slp' ? setVol(api, foe, 'nightmare', true) : api.nothing(me, 'notAsleep')) },
  curse: {
    use(api, me, foe) {
      if (!me.types.includes('ghost')) return Object.keys(api.boost(me, { spd: -1, atk: 1, def: 1 }, me)).length > 0;
      if (!foe || foe.vol.curse) return api.nothing(me);
      api.hurt(me, Math.floor(me.stats.hp / 2), 'cost');
      return setVol(api, foe, 'curse', true);
    },
  },
  foresight: { use: (api, me, foe) => setVol(api, foe, 'foresight', true) },
  'odor-sleuth': { use: (api, me, foe) => setVol(api, foe, 'foresight', true) },
  'miracle-eye': { use: (api, me, foe) => setVol(api, foe, 'miracleEye', true, 'miracleeye') },
  'mean-look': { use: (api, me, foe) => (foe.vol.trappedBy ? api.nothing(me) : (foe.vol.trappedBy = me, api.vol(foe, 'trapped'), true)) },
  block: { use: (api, me, foe) => (foe.vol.trappedBy ? api.nothing(me) : (foe.vol.trappedBy = me, api.vol(foe, 'trapped'), true)) },
  'spider-web': { use: (api, me, foe) => (foe.vol.trappedBy ? api.nothing(me) : (foe.vol.trappedBy = me, api.vol(foe, 'trapped'), true)) },
  octolock: { use: (api, me, foe) => (foe.vol.octolock ? api.nothing(me) : ((foe.vol.trappedBy = me), (foe.vol.octolock = me), api.vol(foe, 'octolock'), true)) },
  electrify: { use: (api, me, foe) => (api.moved(foe) ? api.nothing(me) : ((foe.vol.electrify = api.turn()), api.vol(foe, 'electrify'), true)) },
  'gastro-acid': { use: (api, me, foe) => (api.abilityDef(foe.ability)?.unsuppressable ? api.nothing(me) : setVol(api, foe, 'gastroAcid', true, 'gastroacid')) },
  'destiny-bond': { use: (api, me) => (me.vol.prevMove === 'destiny-bond' ? api.nothing(me) : ((me.vol.destinyBond = true), api.vol(me, 'destinybond'), true)) },
  grudge: { use: (api, me) => setVol(api, me, 'grudge', true) },
  'perish-song': {
    use(api, me) {
      let did = false;
      for (const fighter of api.actives()) did = api.addVolatile(fighter, 'perish', me) || did;
      return did;
    },
  },
  snatch: { use: (api, me) => ((me.vol.snatch = api.turn()), api.vol(me, 'snatch'), true) },
  'magic-coat': { use: (api, me) => ((me.vol.magicCoat = api.turn()), api.vol(me, 'magiccoat'), true) },
  quash: { use: (api, me, foe) => (api.moved(foe) ? api.nothing(me) : (api.vol(foe, 'quash'), true)) },

  'role-play': { use: (api, me, foe) => copyAbility(api, me, foe.ability) || api.nothing(me) },
  doodle: { use: (api, me, foe) => copyAbility(api, me, foe.ability) || api.nothing(me) },
  entrainment: { use: (api, me, foe) => (api.abilityDef(foe.ability)?.unsuppressable ? api.nothing(me) : copyAbility(api, foe, me.ability) || api.nothing(me)) },
  'simple-beam': { use: (api, me, foe) => (api.abilityDef(foe.ability)?.unsuppressable || foe.ability === 'simple' ? api.nothing(me) : (api.changeAbility(foe, 'simple'), true)) },
  'worry-seed': {
    use(api, me, foe) {
      if (api.abilityDef(foe.ability)?.unsuppressable || foe.ability === 'insomnia') return api.nothing(me);
      api.changeAbility(foe, 'insomnia');
      if (foe.status === 'slp') api.cure(foe);
      return true;
    },
  },
  'skill-swap': {
    use(api, me, foe) {
      const mine = me.ability;
      const theirs = foe.ability;
      if (!mine || !theirs || NO_COPY_ABILITY.has(mine) || NO_COPY_ABILITY.has(theirs)) return api.nothing(me);
      api.changeAbility(me, theirs);
      api.changeAbility(foe, mine);
      return true;
    },
  },

  soak: { use: (api, me, foe) => (foe.types.length === 1 && foe.types[0] === 'water' ? api.nothing(me) : (api.setTypes(foe, ['water']), true)) },
  'magic-powder': { use: (api, me, foe) => (foe.types.length === 1 && foe.types[0] === 'psychic' ? api.nothing(me) : (api.setTypes(foe, ['psychic']), true)) },
  'forests-curse': { use: (api, me, foe) => (foe.types.includes('grass') ? api.nothing(me) : (api.setTypes(foe, [...foe.types, 'grass']), true)) },
  'trick-or-treat': { use: (api, me, foe) => (foe.types.includes('ghost') ? api.nothing(me) : (api.setTypes(foe, [...foe.types, 'ghost']), true)) },
  'reflect-type': { use: (api, me, foe) => (api.setTypes(me, [...foe.types]), true) },
  conversion: {
    use(api, me) {
      const type = me.moves[0]?.type;
      if (!type || (me.types.length === 1 && me.types[0] === type)) return api.nothing(me);
      api.setTypes(me, [type]);
      return true;
    },
  },
  'conversion-2': {
    use(api, me, foe) {
      const last = lastMoveOf(foe);
      if (!last?.type) return api.nothing(me);
      const resist = Object.keys(TYPES).filter((t) => api.effectiveness(last.type, [t]) < 1 && !(me.types.length === 1 && me.types[0] === t));
      if (!resist.length) return api.nothing(me);
      api.setTypes(me, [pick(api, resist)]);
      return true;
    },
  },
  camouflage: {
    use(api, me) {
      const type = CAMOUFLAGE[api.b.field.terrain as string] ?? 'normal';
      if (me.types.length === 1 && me.types[0] === type) return api.nothing(me);
      api.setTypes(me, [type]);
      return true;
    },
  },
  transform: { use: (api, me, foe) => (foe.vol.transformed || me.vol.transformed || foe.vol.substitute ? api.nothing(me) : (api.transform(me, foe), true)) },
  sketch: { use: (api, me, foe, move) => api.copyMove(me, foe, move, { permanent: true }) },
  mimic: { use: (api, me, foe, move) => api.copyMove(me, foe, move, { permanent: false }) },

  'venom-drench': { use: (api, me, foe) => (foe.status === 'psn' || foe.status === 'tox' ? Object.keys(api.boost(foe, { atk: -1, satk: -1, spd: -1 }, me)).length > 0 : api.nothing(me)) },
  'psycho-shift': {
    use(api, me, foe) {
      if (!me.status || foe.status) return api.nothing(me);
      const status = me.status;
      if (!api.setStatus(foe, status, me)) return api.nothing(me);
      api.cure(me);
      return true;
    },
  },
  purify: { use: (api, me, foe) => (foe.status ? (api.cure(foe), api.heal(me, me.stats.hp / 2), true) : api.nothing(me)) },
  'pain-split': {
    use(api, me, foe) {
      const avg = Math.floor((me.hp + foe.hp) / 2);
      for (const fighter of [me, foe]) {
        if (avg > fighter.hp) api.heal(fighter, avg - fighter.hp);
        else if (avg < fighter.hp) api.hurt(fighter, fighter.hp - Math.min(avg, fighter.stats.hp), 'painsplit');
      }
      return true;
    },
  },
  'strength-sap': {
    use(api, me, foe) {
      if (foe.boosts.atk <= -6) return api.nothing(me);
      const amount = Math.floor(foe.stats.atk * api.stageMult(foe.boosts.atk));
      api.boost(foe, { atk: -1 }, me);
      api.heal(me, amount);
      return true;
    },
  },
  'floral-healing': { use: (api, me, foe) => api.heal(foe, foe.stats.hp * (api.b.field.terrain === 'grassy' ? 2 / 3 : 1 / 2)) > 0 || api.nothing(me) },
  'heal-pulse': { use: (api, me, foe) => api.heal(foe, foe.stats.hp / 2) > 0 || api.nothing(me) },
  'jungle-healing': { use: (api, me) => { const healed = api.heal(me, me.stats.hp / 4); const cured = !!me.status; api.cure(me); return healed > 0 || cured || api.nothing(me); } },
  refresh: { use: (api, me) => ((['brn', 'par', 'psn', 'tox'] as (string | null)[]).includes(me.status) ? (api.cure(me), true) : api.nothing(me)) },
  'heal-bell': { use: (api, me) => api.cureTeam(me) },
  aromatherapy: { use: (api, me) => api.cureTeam(me) },
  wish: {
    use(api, me) {
      const side = api.side(api.sideOf(me));
      if (side.wish) return api.nothing(me);
      side.wish = { at: api.turn() + 1, amount: Math.floor(me.stats.hp / 2), name: api.name(me) };
      api.sideStart(api.sideOf(me), 'wish', { name: api.name(me) });
      return true;
    },
  },
  'healing-wish': { use: (api, me, foe, move) => api.sacrifice(me, 'healingwish') },
  'lunar-dance': { use: (api, me, foe, move) => api.sacrifice(me, 'lunardance') },
  'revival-blessing': { use: (api, me) => api.revive(me) },
  splash: { use: (api, me) => (api.nothing(me, 'splash'), true) },
  teleport: { use: (api, me) => (benchAlive(api, me) ? (api.switchOut(me), true) : api.nothing(me, 'noBench')) },
  'baton-pass': { use: (api, me) => (benchAlive(api, me) ? (api.switchOut(me, { boosts: true, volatiles: true }), true) : api.nothing(me, 'noBench')) },
  'shed-tail': {
    use(api, me) {
      if (!benchAlive(api, me)) return api.nothing(me, 'noBench');
      if (me.hp <= Math.floor(me.stats.hp / 2)) return api.nothing(me, 'lowHp');
      api.hurt(me, Math.ceil(me.stats.hp / 2), 'cost');
      api.switchOut(me, { substitute: Math.floor(me.stats.hp / 4) });
      return true;
    },
  },
  'parting-shot': {
    use(api, me, foe) {
      const applied = api.boost(foe, { atk: -1, satk: -1 }, me);
      if (!Object.keys(applied).length) return api.nothing(me);
      if (benchAlive(api, me)) api.switchOut(me);
      return true;
    },
  },
  roar: { use: (api, me, foe) => api.dragOut(foe) || api.nothing(me, 'noBench') },
  whirlwind: { use: (api, me, foe) => api.dragOut(foe) || api.nothing(me, 'noBench') },

  'super-fang': { damage: (api, me, target) => Math.max(1, Math.floor(target.hp / 2)) },
  'natures-madness': { damage: (api, me, target) => Math.max(1, Math.floor(target.hp / 2)) },
  ruination: { damage: (api, me, target) => Math.max(1, Math.floor(target.hp / 2)) },
  endeavor: { damage: (api, me, target) => (target.hp > me.hp ? target.hp - me.hp : null) },
  'final-gambit': { damage: (api, me) => me.hp, hit: (api, me) => api.faint(me) },
  psywave: { damage: (api, me) => Math.max(1, Math.floor((me.level * (50 + Math.floor(api.random() * 101))) / 100)) },
  counter: { damage: (api, me, target) => (me.turnHit?.by === target && me.turnHit.physical ? me.turnHit.amount * 2 : null) },
  'mirror-coat': { damage: (api, me, target) => (me.turnHit?.by === target && me.turnHit.special ? me.turnHit.amount * 2 : null) },
  'metal-burst': { damage: (api, me, target) => (me.turnHit?.by === target ? Math.floor(me.turnHit.amount * 1.5) : null) },
  comeuppance: { damage: (api, me, target) => (me.turnHit?.by === target ? Math.floor(me.turnHit.amount * 1.5) : null) },
  bide: {
    before(api, me, foe, move) {
      const lock = me.vol.locked;
      if (!lock) {
        me.vol.locked = { move: move.slot, kind: 'bide', turns: 2, damage: 0 };
        api.vol(me, 'bide');
        return 'skip';
      }
      if (--lock.turns > 0) {
        api.emit({ t: 'bide', side: api.sideOf(me), name: api.name(me) });
        return 'skip';
      }
      delete me.vol.locked;
      move.bideDamage = lock.damage * 2;
      return null;
    },
    damage: (api, me, target, move) => (move.bideDamage! > 0 ? move.bideDamage : null),
  },

  'crush-grip': { power: (api, me, target) => Math.max(1, Math.floor((120 * target.hp) / target.stats.hp)) },
  'wring-out': { power: (api, me, target) => Math.max(1, Math.floor((120 * target.hp) / target.stats.hp)) },
  flail: { power: (api, me) => fixedRatio(Math.floor((48 * me.hp) / me.stats.hp), [[33, 20], [17, 40], [10, 80], [5, 100], [2, 150], [0, 200]]) },
  reversal: { power: (api, me) => fixedRatio(Math.floor((48 * me.hp) / me.stats.hp), [[33, 20], [17, 40], [10, 80], [5, 100], [2, 150], [0, 200]]) },
  'electro-ball': { power: (api, me, target) => fixedRatio(api.speed(me) / Math.max(1, api.speed(target)), [[4, 150], [3, 120], [2, 80], [1, 60], [0, 40]]) },
  'gyro-ball': { power: (api, me, target) => Math.min(150, Math.floor((25 * api.speed(target)) / Math.max(1, api.speed(me))) + 1) },
  'low-kick': { power: (api, me, target) => weightPower(api.weight(target)) },
  'grass-knot': { power: (api, me, target) => weightPower(api.weight(target)) },
  'heavy-slam': { power: (api, me, target) => fixedRatio(api.weight(me) / api.weight(target), [[5, 120], [4, 100], [3, 80], [2, 60], [0, 40]]) },
  'heat-crash': { power: (api, me, target) => fixedRatio(api.weight(me) / api.weight(target), [[5, 120], [4, 100], [3, 80], [2, 60], [0, 40]]) },
  return: { power: () => 102 },
  frustration: { power: () => 102 },
  'trump-card': { power: (api, me, target, move) => [200, 80, 60, 50][me.pp[move.key] ?? 4] ?? 40 },
  punishment: { power: (api, me, target) => Math.min(200, 60 + 20 * positive(target.boosts)) },
  magnitude: {
    before(api, me, foe, move) {
      const roll = api.random();
      const [magnitude, power] = MAGNITUDES.find(([, , p]) => roll < p)!;
      move.power = power;
      api.emit({ t: 'magnitude', side: api.sideOf(me), n: magnitude });
      return null;
    },
    power: (api, me, target, move) => move.power,
  },
  present: {
    before(api, me, foe, move) {
      const roll = api.random();
      if (roll < 0.2) {
        api.heal(foe, foe.stats.hp / 4) || api.nothing(me);
        return 'skip';
      }
      move.power = roll < 0.6 ? 40 : roll < 0.9 ? 80 : 120;
      return null;
    },
    power: (api, me, target, move) => move.power,
  },
  'spit-up': {
    fail: (api, me) => (stockpiled(me) ? null : 'noStockpile'),
    power: (api, me) => 100 * stockpiled(me),
    hit: (api, me) => api.dropStockpile(me),
  },
  'beat-up': {
    hits: (api, me) => api.side(api.sideOf(me)).team.filter((o) => o.hp > 0 && !o.status).length || 1,
    hitPower: (api, me, hit) => {
      const crew = api.side(api.sideOf(me)).team.filter((o) => o.hp > 0 && !o.status);
      const fighter = crew[hit] ?? me;
      return 5 + Math.floor((api.baseAttack(fighter) ?? 50) / 10);
    },
  },
  rollout: {
    power(api, me, target, move) {
      const count = me.vol.locked?.kind === 'rollout' ? me.vol.locked.count : 0;
      return move.power * 2 ** count * (me.vol.defenseCurl ? 2 : 1);
    },
    after(api, me, foe, move, dealt) {
      const lock = me.vol.locked?.kind === 'rollout' ? me.vol.locked : null;
      if (!dealt) return delete me.vol.locked;
      if (!lock) me.vol.locked = { move: move.slot, kind: 'rollout', count: 1 };
      else if (++lock.count >= 5) delete me.vol.locked;
      return null;
    },
  },
  uproar: {
    after(api, me, foe, move) {
      const lock = me.vol.locked?.kind === 'uproar' ? me.vol.locked : null;
      if (!lock) {
        me.vol.locked = { move: move.slot, kind: 'uproar', turns: 2 };
        me.vol.uproar = true;
        api.vol(me, 'uproar');
        for (const fighter of api.actives()) if (fighter.status === 'slp') api.cure(fighter);
      } else if (--lock.turns <= 0) {
        delete me.vol.locked;
        delete me.vol.uproar;
        api.volEnd(me, 'uproar');
      }
      return null;
    },
  },
  rage: { after: (api, me) => ((me.vol.rage = true), null) },
  'future-sight': { before: (api, me, foe, move) => (api.future(me, move), 'skip') },
  'doom-desire': { before: (api, me, foe, move) => (api.future(me, move), 'skip') },

  'sleep-talk': {
    call(api, me) {
      if (me.status !== 'slp' && !api.flag(me, 'comatose')) return { fail: 'notAsleepSelf' };
      const options = me.moves.filter((m) => !m.flags.includes('nosleeptalk') && !m.flags.includes('charge') && m.key !== 'sleep-talk' && m.supported);
      return options.length ? { key: pick(api, options).key } : { fail: null };
    },
  },
  metronome: { call: (api) => ({ key: pick(api, api.metronomePool()) }) },
  assist: {
    call(api, me) {
      const options = api.side(api.sideOf(me)).team.filter((o) => o !== me).flatMap((o) => o.moves).filter((m) => m.supported && !m.flags.includes('noassist') && !m.flags.includes('charge'));
      return options.length ? { key: pick(api, options).key } : { fail: null };
    },
  },
  copycat: {
    call(api) {
      const last = api.lastMove();
      const move = last && moveData(last);
      return move && move.supported && !move.flags.includes('failcopycat') ? { key: last } : { fail: null };
    },
  },
  'mirror-move': {
    call(api, me, foe) {
      const move = lastMoveOf(foe);
      return move && move.supported && move.flags.includes('mirror') ? { key: move.key } : { fail: null };
    },
  },
  'me-first': {
    call(api, me, foe) {
      const theirs = api.chosen(api.sideOf(foe));
      if (!theirs || api.moved(foe) || theirs.kind === 'status' || theirs.flags.includes('failmefirst')) return { fail: null };
      return { key: theirs.key, powerMult: 1.5 };
    },
  },
  'nature-power': { call: (api) => ({ key: NATURE_POWER[api.b.field.terrain as string] ?? 'tri-attack' }) },
  instruct: {
    use(api, me, foe) {
      const last = lastMoveOf(foe);
      if (!last || !last.supported || last.flags.includes('failinstruct') || last.flags.includes('charge') || !foe.moves.some((m) => m.key === last.key)) return api.nothing(me);
      api.callMove(foe, last.key, { instructed: true });
      return true;
    },
  },
};

MOVE_RULES['ice-ball'] = MOVE_RULES.rollout;


import { moveData } from './creatures.js';
import { TYPES } from '../public/types.js';

export const IMPOSSIBLE_MOVES = new Set([
  'belch', 'bestow', 'fling', 'natural-gift', 'recycle', 'stuff-cheeks', 'switcheroo', 'trick', 'teatime', 'embargo', 'magic-room',
  'after-you', 'ally-switch', 'follow-me', 'rage-powder', 'helping-hand', 'magnetic-flux',
]);

const PROTECT_KINDS = new Set(['protect', 'detect', 'kings-shield', 'spiky-shield', 'baneful-bunker', 'obstruct', 'silk-trap', 'burning-bulwark']);
const SIDE_TURNS = { tailwind: 4, safeguard: 5, mist: 5, 'lucky-chant': 5 };
const ROOM_TURNS = { gravity: 5, 'trick-room': 5, 'wonder-room': 5, 'mud-sport': 5, 'water-sport': 5 };
const NO_COPY_ABILITY = new Set(['wonder-guard', 'multitype', 'illusion', 'stance-change', 'schooling', 'comatose', 'shields-down', 'disguise', 'rks-system', 'battle-bond', 'power-construct', 'ice-face', 'gulp-missile', 'zen-mode', 'imposter', 'trace', 'receiver', 'power-of-alchemy', 'neutralizing-gas', 'as-one-glastrier', 'as-one-spectrier', 'commander', 'zero-to-hero', 'tera-shift', 'protosynthesis', 'quark-drive']);
const NO_ENCORE = new Set(['encore', 'transform', 'mimic', 'sketch', 'struggle', 'sleep-talk', 'metronome', 'assist', 'copycat', 'mirror-move', 'me-first', 'instruct']);
const STATS = ['atk', 'def', 'satk', 'sdef', 'spd', 'acc', 'eva'];
const NATURE_POWER = { electric: 'thunderbolt', grassy: 'energy-ball', misty: 'moonblast', psychic: 'psychic' };
const CAMOUFLAGE = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };
const MAGNITUDES = [[4, 10, 0.05], [5, 30, 0.15], [6, 50, 0.35], [7, 70, 0.65], [8, 90, 0.85], [9, 110, 0.95], [10, 150, 1]];

const pick = (A, list) => list[Math.floor(A.random() * list.length)];
const positive = (boosts) => Object.values(boosts).reduce((sum, v) => sum + Math.max(0, v), 0);
const lastMoveOf = (f) => (f?.vol.lastMove ? moveData(f.vol.lastMove) : null);
const benchAlive = (A, f) => A.side(A.sideOf(f)).team.some((o) => o !== f && o.hp > 0);
const stockpiled = (f) => f.vol.stockpile?.count ?? 0;

function fixedRatio(ratio, table) {
  for (const [min, power] of table) if (ratio >= min) return power;
  return table[table.length - 1][1];
}

function weightPower(kg) {
  if (kg < 10) return 20;
  if (kg < 25) return 40;
  if (kg < 50) return 60;
  if (kg < 100) return 80;
  if (kg < 200) return 100;
  return 120;
}

function setSide(A, me, key, turns, target = me) {
  const s = A.sideOf(target);
  const conds = A.side(s).conds;
  if (conds[key]) return false;
  conds[key] = turns;
  A.sideStart(s, key);
  return true;
}

function setRoom(A, key, turns) {
  const rooms = A.b.field.rooms;
  if (rooms[key] && (key === 'trickroom' || key === 'wonderroom')) {
    delete rooms[key];
    A.fieldEnd(key);
    return true;
  }
  if (rooms[key]) return false;
  rooms[key] = turns;
  A.fieldStart(key);
  if (key === 'gravity') {
    for (const f of A.actives()) {
      if (f.vol.magnetRise || f.vol.telekinesis) {
        delete f.vol.magnetRise;
        delete f.vol.telekinesis;
        A.volEnd(f, 'airborne');
      }
    }
  }
  return true;
}

function setVol(A, f, key, value, kind = key, extra = {}) {
  if (f.vol[key]) return false;
  f.vol[key] = value;
  A.vol(f, kind, extra);
  return true;
}

function copyAbility(A, to, key) {
  if (!key || NO_COPY_ABILITY.has(key) || to.ability === key || NO_COPY_ABILITY.has(to.ability)) return false;
  A.changeAbility(to, key);
  return true;
}

function setBoosts(A, f, boosts) {
  A.setBoosts(f, boosts);
  return true;
}

const protect = { use: (A, me, foe, move) => A.protect(me, move.id) };

export const MOVE_RULES = {
  protect,
  detect: protect,
  'kings-shield': protect,
  'spiky-shield': protect,
  'baneful-bunker': protect,
  obstruct: protect,
  'silk-trap': protect,
  'burning-bulwark': protect,
  endure: { use: (A, me) => A.protect(me, 'endure') },
  'quick-guard': { use: (A, me) => A.guard(me, 'quickguard') },
  'wide-guard': { use: (A, me) => A.guard(me, 'wideguard') },
  'crafty-shield': { use: (A, me) => A.guard(me, 'craftyshield') },
  'mat-block': { use: (A, me) => A.guard(me, 'matblock') },

  substitute: {
    use(A, me) {
      if (me.vol.substitute || me.hp <= Math.floor(me.stats.hp / 4)) return A.nothing(me, me.vol.substitute ? null : 'lowHp');
      A.hurt(me, Math.floor(me.stats.hp / 4), 'cost');
      me.vol.substitute = Math.floor(me.stats.hp / 4);
      A.vol(me, 'substitute');
      return true;
    },
  },

  spikes: { use: (A, me, foe) => A.hazard(me, 'spikes') },
  'stealth-rock': { use: (A, me) => A.hazard(me, 'stealthrock') },
  'toxic-spikes': { use: (A, me) => A.hazard(me, 'toxicspikes') },
  'sticky-web': { use: (A, me) => A.hazard(me, 'stickyweb') },
  tailwind: { use: (A, me) => setSide(A, me, 'tailwind', SIDE_TURNS.tailwind) },
  safeguard: { use: (A, me) => setSide(A, me, 'safeguard', SIDE_TURNS.safeguard) },
  mist: { use: (A, me) => setSide(A, me, 'mist', SIDE_TURNS.mist) },
  'lucky-chant': { use: (A, me) => setSide(A, me, 'luckychant', SIDE_TURNS['lucky-chant']) },
  gravity: { use: (A) => setRoom(A, 'gravity', ROOM_TURNS.gravity) },
  'trick-room': { use: (A) => setRoom(A, 'trickroom', ROOM_TURNS['trick-room']) },
  'wonder-room': { use: (A) => setRoom(A, 'wonderroom', ROOM_TURNS['wonder-room']) },
  'mud-sport': { use: (A) => setRoom(A, 'mudsport', ROOM_TURNS['mud-sport']) },
  'water-sport': { use: (A) => setRoom(A, 'watersport', ROOM_TURNS['water-sport']) },
  'fairy-lock': { use: (A) => setRoom(A, 'fairylock', 2) },
  'court-change': { use: (A) => A.courtChange() },
  'tidy-up': {
    use(A, me) {
      for (const f of A.actives()) if (f.vol.substitute) { delete f.vol.substitute; A.volEnd(f, 'substitute'); }
      A.clearHazards(0);
      A.clearHazards(1);
      A.boost(me, { atk: 1, spd: 1 }, me);
      return true;
    },
  },

  haze: { use: (A) => { for (const f of A.actives()) setBoosts(A, f, Object.fromEntries(STATS.map((k) => [k, 0]))); return true; } },
  'psych-up': { use: (A, me, foe) => { setBoosts(A, me, foe.boosts); if (foe.vol.focusEnergy) me.vol.focusEnergy = true; return true; } },
  'topsy-turvy': { use: (A, me, foe) => (Object.values(foe.boosts).some(Boolean) ? setBoosts(A, foe, Object.fromEntries(STATS.map((k) => [k, -foe.boosts[k] || 0]))) : A.nothing(me)) },
  'guard-swap': { use: (A, me, foe) => A.swapBoosts(me, foe, ['def', 'sdef']) },
  'power-swap': { use: (A, me, foe) => A.swapBoosts(me, foe, ['atk', 'satk']) },
  'heart-swap': { use: (A, me, foe) => A.swapBoosts(me, foe, STATS) },
  'speed-swap': { use: (A, me, foe) => { const a = me.stats.spd; A.setStats(me, { spd: foe.stats.spd }); A.setStats(foe, { spd: a }); return true; } },
  'guard-split': { use: (A, me, foe) => A.splitStats(me, foe, ['def', 'sdef']) },
  'power-split': { use: (A, me, foe) => A.splitStats(me, foe, ['atk', 'satk']) },
  'power-trick': { use: (A, me) => { A.setStats(me, { atk: me.stats.def, def: me.stats.atk }); me.vol.powerTrick = !me.vol.powerTrick; return true; } },
  acupressure: {
    use(A, me) {
      const open = STATS.filter((k) => me.boosts[k] < 6);
      if (!open.length) return A.nothing(me);
      A.boost(me, { [pick(A, open)]: 2 }, me);
      return true;
    },
  },
  'belly-drum': {
    use(A, me) {
      if (me.hp <= Math.floor(me.stats.hp / 2) || me.boosts.atk >= 6) return A.nothing(me, me.boosts.atk >= 6 ? null : 'lowHp');
      A.hurt(me, Math.floor(me.stats.hp / 2), 'cost');
      A.boost(me, { atk: 12 }, me);
      return true;
    },
  },
  'focus-energy': { use: (A, me) => setVol(A, me, 'focusEnergy', true, 'focusenergy') },
  'laser-focus': { use: (A, me) => { me.vol.laserFocus = A.turn() + 1; A.vol(me, 'laserfocus'); return true; } },
  'lock-on': { use: (A, me, foe) => { me.vol.lockOn = foe; A.vol(me, 'lockon'); return true; } },
  'mind-reader': { use: (A, me, foe) => { me.vol.lockOn = foe; A.vol(me, 'lockon'); return true; } },
  'magnet-rise': { use: (A, me) => (A.b.field.rooms.gravity || me.vol.ingrain ? A.nothing(me) : setVol(A, me, 'magnetRise', { turns: 5 }, 'magnetrise')) },
  telekinesis: { use: (A, me, foe) => (A.b.field.rooms.gravity || foe.vol.ingrain ? A.nothing(me) : setVol(A, foe, 'telekinesis', { turns: 3 })) },
  ingrain: { use: (A, me) => setVol(A, me, 'ingrain', true) },
  'aqua-ring': { use: (A, me) => setVol(A, me, 'aquaRing', true, 'aquaring') },
  stockpile: {
    use(A, me) {
      if (stockpiled(me) >= 3) return A.nothing(me);
      const applied = A.boost(me, { def: 1, sdef: 1 }, me);
      me.vol.stockpile = { count: stockpiled(me) + 1, def: (me.vol.stockpile?.def ?? 0) + (applied.def ?? 0), sdef: (me.vol.stockpile?.sdef ?? 0) + (applied.sdef ?? 0) };
      A.vol(me, 'stockpile', { count: me.vol.stockpile.count });
      return true;
    },
  },
  swallow: {
    use(A, me) {
      const n = stockpiled(me);
      if (!n) return A.nothing(me, 'noStockpile');
      A.heal(me, me.stats.hp * [0.25, 0.5, 1][n - 1]);
      A.dropStockpile(me);
      return true;
    },
  },

  taunt: { use: (A, me, foe) => setVol(A, foe, 'taunt', { turns: 3 }) },
  torment: { use: (A, me, foe) => setVol(A, foe, 'torment', true) },
  'heal-block': { use: (A, me, foe) => setVol(A, foe, 'healBlock', { turns: 5 }, 'healblock') },
  imprison: { use: (A, me, foe) => (foe && foe.moves.some((m) => me.moves.some((x) => x.key === m.key)) ? setVol(A, me, 'imprison', true) : A.nothing(me)) },
  encore: {
    use(A, me, foe) {
      const last = foe.vol.lastMove;
      if (!last || NO_ENCORE.has(last) || foe.vol.encore || !foe.moves.some((m) => m.key === last)) return A.nothing(me);
      return setVol(A, foe, 'encore', { key: last, turns: 3 }, 'encore', { move: moveData(last)?.name });
    },
  },
  disable: {
    use(A, me, foe) {
      const last = foe.vol.lastMove && foe.moves.find((m) => m.key === foe.vol.lastMove);
      return last ? A.addVolatile(foe, 'disable', me, { move: last }) : A.nothing(me);
    },
  },
  spite: {
    use(A, me, foe) {
      const last = foe.vol.lastMove;
      if (!last || !(foe.pp[last] > 0)) return A.nothing(me);
      const lost = Math.min(4, foe.pp[last]);
      foe.pp[last] -= lost;
      A.emit({ t: 'pp', side: A.sideOf(foe), name: A.name(foe), move: moveData(last)?.name, lost });
      return true;
    },
  },
  yawn: {
    use(A, me, foe) {
      if (foe.status || foe.vol.yawn || A.side(A.sideOf(foe)).conds.safeguard) return A.nothing(me);
      return setVol(A, foe, 'yawn', 2);
    },
  },
  nightmare: { use: (A, me, foe) => (foe.status === 'slp' ? setVol(A, foe, 'nightmare', true) : A.nothing(me, 'notAsleep')) },
  curse: {
    use(A, me, foe) {
      if (!me.types.includes('ghost')) return Object.keys(A.boost(me, { spd: -1, atk: 1, def: 1 }, me)).length > 0;
      if (!foe || foe.vol.curse) return A.nothing(me);
      A.hurt(me, Math.floor(me.stats.hp / 2), 'cost');
      return setVol(A, foe, 'curse', true);
    },
  },
  foresight: { use: (A, me, foe) => setVol(A, foe, 'foresight', true) },
  'odor-sleuth': { use: (A, me, foe) => setVol(A, foe, 'foresight', true) },
  'miracle-eye': { use: (A, me, foe) => setVol(A, foe, 'miracleEye', true, 'miracleeye') },
  'mean-look': { use: (A, me, foe) => (foe.vol.trappedBy ? A.nothing(me) : (foe.vol.trappedBy = me, A.vol(foe, 'trapped'), true)) },
  block: { use: (A, me, foe) => (foe.vol.trappedBy ? A.nothing(me) : (foe.vol.trappedBy = me, A.vol(foe, 'trapped'), true)) },
  'spider-web': { use: (A, me, foe) => (foe.vol.trappedBy ? A.nothing(me) : (foe.vol.trappedBy = me, A.vol(foe, 'trapped'), true)) },
  octolock: { use: (A, me, foe) => (foe.vol.octolock ? A.nothing(me) : ((foe.vol.trappedBy = me), (foe.vol.octolock = me), A.vol(foe, 'octolock'), true)) },
  electrify: { use: (A, me, foe) => (A.moved(foe) ? A.nothing(me) : ((foe.vol.electrify = A.turn()), A.vol(foe, 'electrify'), true)) },
  'gastro-acid': { use: (A, me, foe) => (A.abilityDef(foe.ability)?.unsuppressable ? A.nothing(me) : setVol(A, foe, 'gastroAcid', true, 'gastroacid')) },
  'destiny-bond': { use: (A, me) => (me.vol.prevMove === 'destiny-bond' ? A.nothing(me) : ((me.vol.destinyBond = true), A.vol(me, 'destinybond'), true)) },
  grudge: { use: (A, me) => setVol(A, me, 'grudge', true) },
  'perish-song': {
    use(A, me) {
      let did = false;
      for (const f of A.actives()) did = A.addVolatile(f, 'perish', me) || did;
      return did;
    },
  },
  snatch: { use: (A, me) => ((me.vol.snatch = A.turn()), A.vol(me, 'snatch'), true) },
  'magic-coat': { use: (A, me) => ((me.vol.magicCoat = A.turn()), A.vol(me, 'magiccoat'), true) },
  quash: { use: (A, me, foe) => (A.moved(foe) ? A.nothing(me) : (A.vol(foe, 'quash'), true)) },

  'role-play': { use: (A, me, foe) => copyAbility(A, me, foe.ability) || A.nothing(me) },
  doodle: { use: (A, me, foe) => copyAbility(A, me, foe.ability) || A.nothing(me) },
  entrainment: { use: (A, me, foe) => (A.abilityDef(foe.ability)?.unsuppressable ? A.nothing(me) : copyAbility(A, foe, me.ability) || A.nothing(me)) },
  'simple-beam': { use: (A, me, foe) => (A.abilityDef(foe.ability)?.unsuppressable || foe.ability === 'simple' ? A.nothing(me) : (A.changeAbility(foe, 'simple'), true)) },
  'worry-seed': {
    use(A, me, foe) {
      if (A.abilityDef(foe.ability)?.unsuppressable || foe.ability === 'insomnia') return A.nothing(me);
      A.changeAbility(foe, 'insomnia');
      if (foe.status === 'slp') A.cure(foe);
      return true;
    },
  },
  'skill-swap': {
    use(A, me, foe) {
      const mine = me.ability;
      const theirs = foe.ability;
      if (!mine || !theirs || NO_COPY_ABILITY.has(mine) || NO_COPY_ABILITY.has(theirs)) return A.nothing(me);
      A.changeAbility(me, theirs);
      A.changeAbility(foe, mine);
      return true;
    },
  },

  soak: { use: (A, me, foe) => (foe.types.length === 1 && foe.types[0] === 'water' ? A.nothing(me) : (A.setTypes(foe, ['water']), true)) },
  'magic-powder': { use: (A, me, foe) => (foe.types.length === 1 && foe.types[0] === 'psychic' ? A.nothing(me) : (A.setTypes(foe, ['psychic']), true)) },
  'forests-curse': { use: (A, me, foe) => (foe.types.includes('grass') ? A.nothing(me) : (A.setTypes(foe, [...foe.types, 'grass']), true)) },
  'trick-or-treat': { use: (A, me, foe) => (foe.types.includes('ghost') ? A.nothing(me) : (A.setTypes(foe, [...foe.types, 'ghost']), true)) },
  'reflect-type': { use: (A, me, foe) => (A.setTypes(me, [...foe.types]), true) },
  conversion: {
    use(A, me) {
      const type = me.moves[0]?.type;
      if (!type || (me.types.length === 1 && me.types[0] === type)) return A.nothing(me);
      A.setTypes(me, [type]);
      return true;
    },
  },
  'conversion-2': {
    use(A, me, foe) {
      const last = lastMoveOf(foe);
      if (!last?.type) return A.nothing(me);
      const resist = Object.keys(TYPES).filter((t) => A.effectiveness(last.type, [t]) < 1 && !(me.types.length === 1 && me.types[0] === t));
      if (!resist.length) return A.nothing(me);
      A.setTypes(me, [pick(A, resist)]);
      return true;
    },
  },
  camouflage: {
    use(A, me) {
      const type = CAMOUFLAGE[A.b.field.terrain] ?? 'normal';
      if (me.types.length === 1 && me.types[0] === type) return A.nothing(me);
      A.setTypes(me, [type]);
      return true;
    },
  },
  transform: { use: (A, me, foe) => (foe.vol.transformed || me.vol.transformed || foe.vol.substitute ? A.nothing(me) : (A.transform(me, foe), true)) },
  sketch: { use: (A, me, foe, move) => A.copyMove(me, foe, move, { permanent: true }) },
  mimic: { use: (A, me, foe, move) => A.copyMove(me, foe, move, { permanent: false }) },

  'venom-drench': { use: (A, me, foe) => (foe.status === 'psn' || foe.status === 'tox' ? Object.keys(A.boost(foe, { atk: -1, satk: -1, spd: -1 }, me)).length > 0 : A.nothing(me)) },
  'psycho-shift': {
    use(A, me, foe) {
      if (!me.status || foe.status) return A.nothing(me);
      const status = me.status;
      if (!A.setStatus(foe, status, me)) return A.nothing(me);
      A.cure(me);
      return true;
    },
  },
  purify: { use: (A, me, foe) => (foe.status ? (A.cure(foe), A.heal(me, me.stats.hp / 2), true) : A.nothing(me)) },
  'pain-split': {
    use(A, me, foe) {
      const avg = Math.floor((me.hp + foe.hp) / 2);
      for (const f of [me, foe]) {
        if (avg > f.hp) A.heal(f, avg - f.hp);
        else if (avg < f.hp) A.hurt(f, f.hp - Math.min(avg, f.stats.hp), 'painsplit');
      }
      return true;
    },
  },
  'strength-sap': {
    use(A, me, foe) {
      if (foe.boosts.atk <= -6) return A.nothing(me);
      const amount = Math.floor(foe.stats.atk * A.stageMult(foe.boosts.atk));
      A.boost(foe, { atk: -1 }, me);
      A.heal(me, amount);
      return true;
    },
  },
  'floral-healing': { use: (A, me, foe) => A.heal(foe, foe.stats.hp * (A.b.field.terrain === 'grassy' ? 2 / 3 : 1 / 2)) > 0 || A.nothing(me) },
  'heal-pulse': { use: (A, me, foe) => A.heal(foe, foe.stats.hp / 2) > 0 || A.nothing(me) },
  'jungle-healing': { use: (A, me) => { const h = A.heal(me, me.stats.hp / 4); const c = !!me.status; A.cure(me); return h > 0 || c || A.nothing(me); } },
  refresh: { use: (A, me) => (['brn', 'par', 'psn', 'tox'].includes(me.status) ? (A.cure(me), true) : A.nothing(me)) },
  'heal-bell': { use: (A, me) => A.cureTeam(me) },
  aromatherapy: { use: (A, me) => A.cureTeam(me) },
  wish: {
    use(A, me) {
      const side = A.side(A.sideOf(me));
      if (side.wish) return A.nothing(me);
      side.wish = { at: A.turn() + 1, amount: Math.floor(me.stats.hp / 2), name: A.name(me) };
      A.sideStart(A.sideOf(me), 'wish', { name: A.name(me) });
      return true;
    },
  },
  'healing-wish': { use: (A, me, foe, move) => A.sacrifice(me, 'healingwish') },
  'lunar-dance': { use: (A, me, foe, move) => A.sacrifice(me, 'lunardance') },
  'revival-blessing': { use: (A, me) => A.revive(me) },
  splash: { use: (A, me) => (A.nothing(me, 'splash'), true) },
  teleport: { use: (A, me) => (benchAlive(A, me) ? (A.switchOut(me), true) : A.nothing(me, 'noBench')) },
  'baton-pass': { use: (A, me) => (benchAlive(A, me) ? (A.switchOut(me, { boosts: true, volatiles: true }), true) : A.nothing(me, 'noBench')) },
  'shed-tail': {
    use(A, me) {
      if (!benchAlive(A, me)) return A.nothing(me, 'noBench');
      if (me.hp <= Math.floor(me.stats.hp / 2)) return A.nothing(me, 'lowHp');
      A.hurt(me, Math.ceil(me.stats.hp / 2), 'cost');
      A.switchOut(me, { substitute: Math.floor(me.stats.hp / 4) });
      return true;
    },
  },
  'parting-shot': {
    use(A, me, foe) {
      const applied = A.boost(foe, { atk: -1, satk: -1 }, me);
      if (!Object.keys(applied).length) return A.nothing(me);
      if (benchAlive(A, me)) A.switchOut(me);
      return true;
    },
  },
  roar: { use: (A, me, foe) => A.dragOut(foe) || A.nothing(me, 'noBench') },
  whirlwind: { use: (A, me, foe) => A.dragOut(foe) || A.nothing(me, 'noBench') },

  'super-fang': { damage: (A, me, t) => Math.max(1, Math.floor(t.hp / 2)) },
  'natures-madness': { damage: (A, me, t) => Math.max(1, Math.floor(t.hp / 2)) },
  ruination: { damage: (A, me, t) => Math.max(1, Math.floor(t.hp / 2)) },
  endeavor: { damage: (A, me, t) => (t.hp > me.hp ? t.hp - me.hp : null) },
  'final-gambit': { damage: (A, me) => me.hp, hit: (A, me) => A.faint(me) },
  psywave: { damage: (A, me) => Math.max(1, Math.floor((me.level * (50 + Math.floor(A.random() * 101))) / 100)) },
  counter: { damage: (A, me, t) => (me.turnHit?.by === t && me.turnHit.physical ? me.turnHit.amount * 2 : null) },
  'mirror-coat': { damage: (A, me, t) => (me.turnHit?.by === t && me.turnHit.special ? me.turnHit.amount * 2 : null) },
  'metal-burst': { damage: (A, me, t) => (me.turnHit?.by === t ? Math.floor(me.turnHit.amount * 1.5) : null) },
  comeuppance: { damage: (A, me, t) => (me.turnHit?.by === t ? Math.floor(me.turnHit.amount * 1.5) : null) },
  bide: {
    before(A, me, foe, move) {
      const lock = me.vol.locked;
      if (!lock) {
        me.vol.locked = { move: move.slot, kind: 'bide', turns: 2, damage: 0 };
        A.vol(me, 'bide');
        return 'skip';
      }
      if (--lock.turns > 0) {
        A.emit({ t: 'bide', side: A.sideOf(me), name: A.name(me) });
        return 'skip';
      }
      delete me.vol.locked;
      move.bideDamage = lock.damage * 2;
      return null;
    },
    damage: (A, me, t, move) => (move.bideDamage > 0 ? move.bideDamage : null),
  },

  'crush-grip': { power: (A, me, t) => Math.max(1, Math.floor((120 * t.hp) / t.stats.hp)) },
  'wring-out': { power: (A, me, t) => Math.max(1, Math.floor((120 * t.hp) / t.stats.hp)) },
  flail: { power: (A, me) => fixedRatio(Math.floor((48 * me.hp) / me.stats.hp), [[33, 20], [17, 40], [10, 80], [5, 100], [2, 150], [0, 200]]) },
  reversal: { power: (A, me) => fixedRatio(Math.floor((48 * me.hp) / me.stats.hp), [[33, 20], [17, 40], [10, 80], [5, 100], [2, 150], [0, 200]]) },
  'electro-ball': { power: (A, me, t) => fixedRatio(A.speed(me) / Math.max(1, A.speed(t)), [[4, 150], [3, 120], [2, 80], [1, 60], [0, 40]]) },
  'gyro-ball': { power: (A, me, t) => Math.min(150, Math.floor((25 * A.speed(t)) / Math.max(1, A.speed(me))) + 1) },
  'low-kick': { power: (A, me, t) => weightPower(A.weight(t)) },
  'grass-knot': { power: (A, me, t) => weightPower(A.weight(t)) },
  'heavy-slam': { power: (A, me, t) => fixedRatio(A.weight(me) / A.weight(t), [[5, 120], [4, 100], [3, 80], [2, 60], [0, 40]]) },
  'heat-crash': { power: (A, me, t) => fixedRatio(A.weight(me) / A.weight(t), [[5, 120], [4, 100], [3, 80], [2, 60], [0, 40]]) },
  return: { power: () => 102 },
  frustration: { power: () => 102 },
  'trump-card': { power: (A, me, t, move) => [200, 80, 60, 50][me.pp[move.key] ?? 4] ?? 40 },
  punishment: { power: (A, me, t) => Math.min(200, 60 + 20 * positive(t.boosts)) },
  magnitude: {
    before(A, me, foe, move) {
      const r = A.random();
      const [n, power] = MAGNITUDES.find(([, , p]) => r < p);
      move.power = power;
      A.emit({ t: 'magnitude', side: A.sideOf(me), n });
      return null;
    },
    power: (A, me, t, move) => move.power,
  },
  present: {
    before(A, me, foe, move) {
      const r = A.random();
      if (r < 0.2) {
        A.heal(foe, foe.stats.hp / 4) || A.nothing(me);
        return 'skip';
      }
      move.power = r < 0.6 ? 40 : r < 0.9 ? 80 : 120;
      return null;
    },
    power: (A, me, t, move) => move.power,
  },
  'spit-up': {
    fail: (A, me) => (stockpiled(me) ? null : 'noStockpile'),
    power: (A, me) => 100 * stockpiled(me),
    hit: (A, me) => A.dropStockpile(me),
  },
  'beat-up': {
    hits: (A, me) => A.side(A.sideOf(me)).team.filter((o) => o.hp > 0 && !o.status).length || 1,
    hitPower: (A, me, i) => {
      const crew = A.side(A.sideOf(me)).team.filter((o) => o.hp > 0 && !o.status);
      const f = crew[i] ?? me;
      return 5 + Math.floor((A.baseAttack(f) ?? 50) / 10);
    },
  },
  rollout: {
    power(A, me, t, move) {
      const count = me.vol.locked?.kind === 'rollout' ? me.vol.locked.count : 0;
      return move.power * 2 ** count * (me.vol.defenseCurl ? 2 : 1);
    },
    after(A, me, foe, move, dealt) {
      const lock = me.vol.locked?.kind === 'rollout' ? me.vol.locked : null;
      if (!dealt) return delete me.vol.locked;
      if (!lock) me.vol.locked = { move: move.slot, kind: 'rollout', count: 1 };
      else if (++lock.count >= 5) delete me.vol.locked;
      return null;
    },
  },
  uproar: {
    after(A, me, foe, move) {
      const lock = me.vol.locked?.kind === 'uproar' ? me.vol.locked : null;
      if (!lock) {
        me.vol.locked = { move: move.slot, kind: 'uproar', turns: 2 };
        me.vol.uproar = true;
        A.vol(me, 'uproar');
        for (const f of A.actives()) if (f.status === 'slp') A.cure(f);
      } else if (--lock.turns <= 0) {
        delete me.vol.locked;
        delete me.vol.uproar;
        A.volEnd(me, 'uproar');
      }
      return null;
    },
  },
  rage: { after: (A, me) => ((me.vol.rage = true), null) },
  'future-sight': { before: (A, me, foe, move) => (A.future(me, move), 'skip') },
  'doom-desire': { before: (A, me, foe, move) => (A.future(me, move), 'skip') },

  'sleep-talk': {
    call(A, me) {
      if (me.status !== 'slp' && !A.flag(me, 'comatose')) return { fail: 'notAsleepSelf' };
      const options = me.moves.filter((m) => !m.flags.includes('nosleeptalk') && !m.flags.includes('charge') && m.key !== 'sleep-talk' && m.supported);
      return options.length ? { key: pick(A, options).key } : { fail: null };
    },
  },
  metronome: { call: (A) => ({ key: pick(A, A.metronomePool()) }) },
  assist: {
    call(A, me) {
      const options = A.side(A.sideOf(me)).team.filter((o) => o !== me).flatMap((o) => o.moves).filter((m) => m.supported && !m.flags.includes('noassist') && !m.flags.includes('charge'));
      return options.length ? { key: pick(A, options).key } : { fail: null };
    },
  },
  copycat: {
    call(A) {
      const last = A.lastMove();
      const m = last && moveData(last);
      return m && m.supported && !m.flags.includes('failcopycat') ? { key: last } : { fail: null };
    },
  },
  'mirror-move': {
    call(A, me, foe) {
      const m = lastMoveOf(foe);
      return m && m.supported && m.flags.includes('mirror') ? { key: m.key } : { fail: null };
    },
  },
  'me-first': {
    call(A, me, foe) {
      const theirs = A.chosen(A.sideOf(foe));
      if (!theirs || A.moved(foe) || theirs.kind === 'status' || theirs.flags.includes('failmefirst')) return { fail: null };
      return { key: theirs.key, powerMult: 1.5 };
    },
  },
  'nature-power': { call: (A) => ({ key: NATURE_POWER[A.b.field.terrain] ?? 'tri-attack' }) },
  instruct: {
    use(A, me, foe) {
      const last = lastMoveOf(foe);
      if (!last || !last.supported || last.flags.includes('failinstruct') || last.flags.includes('charge') || !foe.moves.some((m) => m.key === last.key)) return A.nothing(me);
      A.callMove(foe, last.key, { instructed: true });
      return true;
    },
  },
};

MOVE_RULES['ice-ball'] = MOVE_RULES.rollout;

export const supportsMove = (id) => !IMPOSSIBLE_MOVES.has(id) && !!MOVE_RULES[id];
export const isProtectKind = (id) => PROTECT_KINDS.has(id);

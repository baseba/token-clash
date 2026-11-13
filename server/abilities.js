import { readFileSync } from 'node:fs';

const CATALOG = JSON.parse(readFileSync(new URL('./abilities.json', import.meta.url), 'utf8'));

export const INERT_REASONS = {
  items: 'Token Clash no tiene objetos ni bayas.',
  doubles: 'Solo actúa sobre aliados, en combates dobles.',
  field: 'Solo actúa fuera del combate.',
  moves: 'Depende de movimientos que no existen en Token Clash.',
  tera: 'Depende de la teracristalización, que no existe en Token Clash.',
};

export const INERT = {
  'run-away': 'field', pickup: 'items', plus: 'doubles', minus: 'doubles',
  'sticky-hold': 'items', gluttony: 'items', unburden: 'items', klutz: 'items', 'honey-gather': 'field',
  frisk: 'items', multitype: 'items', pickpocket: 'items', unnerve: 'items', healer: 'doubles',
  'friend-guard': 'doubles', 'heavy-metal': 'moves', 'light-metal': 'moves', harvest: 'items',
  telepathy: 'doubles',
  'cheek-pouch': 'items', magician: 'items', symbiosis: 'items', battery: 'doubles', receiver: 'doubles',
  'power-of-alchemy': 'doubles', 'rks-system': 'items', 'ball-fetch': 'items', 'propeller-tail': 'doubles',
  stalwart: 'doubles', ripen: 'items', 'power-spot': 'doubles',
  'unseen-fist': 'moves', 'curious-medicine': 'doubles', commander: 'doubles',
  'cud-chew': 'items', costar: 'doubles', hospitality: 'doubles',
  'embody-aspect': 'tera', 'teraform-zero': 'tera', 'piercing-drill': 'moves',
};

const isAttack = (move) => move.category !== 'status';
const physical = (move) => move.category === 'physical';
const special = (move) => move.category === 'special';
const has = (move, flag) => move.flags.includes(flag);
const contact = (E, move, attacker) => has(move, 'contact') && !E.has(attacker, 'long-reach');
const full = (f) => f.hp === f.stats.hp;
const fraction = (f, n) => Math.max(1, Math.floor(f.stats.hp * n));
const droppedBelowHalf = (f, before) => before > f.stats.hp / 2 && f.hp > 0 && f.hp <= f.stats.hp / 2;
const STATUS_NAMES = new Set(['brn', 'par', 'psn', 'tox', 'slp', 'frz']);
const isMajor = (status) => STATUS_NAMES.has(status);
const poison = (status) => status === 'psn' || status === 'tox';
const highestStat = (f) => ['atk', 'def', 'satk', 'sdef', 'spd'].reduce((best, k) => (f.stats[k] > f.stats[best] ? k : best), 'atk');

const typePower = (type, mult) => ({ onBasePower: (E, me, move) => (move.type === type ? mult : 1) });
const flagPower = (flag, mult) => ({ onBasePower: (E, me, move) => (has(move, flag) ? mult : 1) });
const pinch = (type) => ({ onBasePower: (E, me, move) => (move.type === type && me.hp <= me.stats.hp / 3 ? 1.5 : 1) });
const weatherSpeed = (test) => ({ onSpeed: (E, me, spd) => (test(E.weather()) ? spd * 2 : spd) });
const isSun = (w) => w === 'sun' || w === 'harshsun';
const isRain = (w) => w === 'rain' || w === 'heavyrain';
const isIcy = (w) => w === 'snow' || w === 'hail';

const skin = (type) => ({
  onModifyMove(E, me, move) {
    if (move.type === 'normal' && isAttack(move)) {
      move.type = type;
      move.skinBoost = true;
    }
  },
  onBasePower: (E, me, move) => (move.skinBoost ? 1.2 : 1),
});

const blockStatus = (blocked) => ({
  breakable: true,
  onSetStatus(E, me, status, source) {
    if (!blocked(status, E, me)) return true;
    if (source && source !== me) E.show(me);
    return false;
  },
  onEndTurn(E, me) {
    if (me.status && blocked(me.status, E, me)) E.cure(me, true);
  },
});

const absorb = (type, effect) => ({
  breakable: true,
  onTryHit(E, me, move) {
    if (move.type !== type || !isAttack(move)) return false;
    E.show(me);
    if (effect.heal && !E.heal(me, fraction(me, effect.heal))) E.note(me, 'immune');
    if (effect.boost) E.boost(me, effect.boost, me);
    if (effect.flashFire) me.vol.flashFire = true;
    return true;
  },
});

const contactChance = (chance, apply) => ({
  onDamagingHit(E, me, move, attacker) {
    if (!contact(E, move, attacker) || attacker.hp <= 0 || E.rand() >= chance) return;
    apply(E, me, attacker);
  },
});

const contactStatus = (status, chance = 0.3) =>
  contactChance(chance, (E, me, attacker) => E.setStatus(attacker, status, me, { ability: me }));

const hitBoost = (test, boost) => ({
  onDamagingHit(E, me, move, attacker) {
    if (me.hp > 0 && test(move)) E.boost(me, boost, me, { ability: me });
  },
});

const hurtAttackerOnContact = {
  onDamagingHit(E, me, move, attacker) {
    if (contact(E, move, attacker) && attacker.hp > 0) {
      E.show(me);
      E.damage(attacker, fraction(attacker, 1 / 8), 'ability');
    }
  },
};

const onKoBoost = (boost) => ({
  onFoeFaint(E, me) {
    E.boost(me, typeof boost === 'function' ? boost(me) : boost, me, { ability: me });
  },
});

const setsWeather = (weather) => ({ onStart: (E, me) => E.setWeather(weather, me) });
const setsTerrain = (terrain) => ({ onStart: (E, me) => E.setTerrain(terrain, me) });
const announce = (note) => ({ onStart: (E, me) => E.show(me, note) });

const blockDrops = (stats, { breakable = true, effects = null } = {}) => ({
  breakable,
  onTryBoost(E, me, changes, source, effect) {
    if (!source || source === me) return;
    if (effects && !effects.includes(effect)) return;
    let blocked = false;
    for (const k of Object.keys(changes)) {
      if (changes[k] < 0 && (!stats || stats.includes(k))) {
        delete changes[k];
        blocked = true;
      }
    }
    if (blocked) E.show(me, 'noDrop');
  },
});

const ignoresIntimidate = {
  onTryBoost(E, me, changes, source, effect) {
    if (effect === 'intimidate' && changes.atk < 0) {
      delete changes.atk;
      E.show(me, 'noDrop');
    }
  },
};

const merge = (...parts) => {
  const out = {};
  for (const p of parts) {
    for (const [k, v] of Object.entries(p)) {
      const prev = out[k];
      if (typeof v === 'function' && typeof prev === 'function') {
        out[k] = (...args) => {
          const a = prev(...args);
          const b = v(...args);
          if (typeof a === 'number' && typeof b === 'number') return a * b;
          if (typeof a === 'boolean' || typeof b === 'boolean') return k === 'onSetStatus' ? a !== false && b !== false : a || b;
          return b ?? a;
        };
      } else out[k] = v;
    }
  }
  return out;
};

const formChanger = (decide) => ({
  unsuppressable: true,
  noTrace: true,
  onStart: (E, me) => decide(E, me),
  onEndTurn: (E, me) => decide(E, me),
});

const stageMult = (stage) => (stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage));
const MINIOR_CORES = ['red', 'orange', 'yellow', 'green', 'blue', 'indigo', 'violet'];
const miniorCore = (f) => `minior-${MINIOR_CORES[[...String(f.uid)].reduce((n, ch) => n + ch.charCodeAt(0), 0) % MINIOR_CORES.length]}`;

const EFFECTS = {
  stench: {
    onAfterMoveHit(E, me, move, target) {
      if (target.hp > 0 && !move.secondary?.some((s) => s.flinch) && E.rand() < 0.1) E.addVolatile(target, 'flinch', me);
    },
  },
  drizzle: setsWeather('rain'),
  'speed-boost': {
    onEndTurn(E, me) {
      if (me.activeTurns > 0) E.boost(me, { spd: 1 }, me, { ability: me });
    },
  },
  'battle-armor': { breakable: true, critImmune: true },
  sturdy: {
    breakable: true,
    onDamage(E, me, move, attacker, dmg) {
      if (full(me) && dmg >= me.hp && me.hp > 1) {
        E.show(me, 'endure');
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
    onEvasion: (E, me, move, attacker, acc) => (E.weather() === 'sand' ? acc * 0.8 : acc),
  },
  static: contactStatus('par'),
  'volt-absorb': absorb('electric', { heal: 1 / 4 }),
  'water-absorb': absorb('water', { heal: 1 / 4 }),
  oblivious: merge(blockStatus((s) => s === 'attract'), ignoresIntimidate),
  'cloud-nine': announce('weatherOff'),
  'compound-eyes': { onAccuracy: (E, me, move, target, acc) => acc * 1.3 },
  insomnia: blockStatus((s) => s === 'slp'),
  'color-change': {
    onDamagingHit(E, me, move) {
      if (me.hp > 0 && move.type && !(me.types.length === 1 && me.types[0] === move.type)) {
        E.show(me);
        E.setTypes(me, [move.type]);
      }
    },
  },
  immunity: blockStatus(poison),
  'flash-fire': merge(absorb('fire', { flashFire: true }), {
    onBasePower: (E, me, move) => (me.vol.flashFire && move.type === 'fire' ? 1.5 : 1),
  }),
  'shield-dust': { breakable: true, blocksSecondaries: true },
  'own-tempo': merge(blockStatus((s) => s === 'confusion'), ignoresIntimidate),
  intimidate: {
    onStart(E, me) {
      const foe = E.foe(me);
      if (!foe) return;
      E.show(me);
      E.boost(foe, { atk: -1 }, me, { effect: 'intimidate' });
    },
  },
  'shadow-tag': { onTrapFoe: (E, me, foe) => !E.has(foe, 'shadow-tag') && !foe.types.includes('ghost') },
  'rough-skin': hurtAttackerOnContact,
  'wonder-guard': {
    breakable: true,
    noTrace: true,
    onTryHit(E, me, move, attacker) {
      if (!isAttack(move) || !move.type || E.effectiveness(move, attacker, me) > 1) return false;
      E.show(me);
      E.note(me, 'immune');
      return true;
    },
  },
  levitate: {
    breakable: true,
    levitates: true,
    onTryHit(E, me, move) {
      if (move.type !== 'ground' || !isAttack(move)) return false;
      E.show(me);
      E.note(me, 'immune');
      return true;
    },
  },
  'effect-spore': {
    onDamagingHit(E, me, move, attacker) {
      if (!contact(E, move, attacker) || attacker.hp <= 0) return;
      if (attacker.types.includes('grass') || E.has(attacker, 'overcoat')) return;
      const r = E.rand();
      const status = r < 0.09 ? 'psn' : r < 0.19 ? 'par' : r < 0.3 ? 'slp' : null;
      if (status) E.setStatus(attacker, status, me, { ability: me });
    },
  },
  synchronize: {
    onAfterSetStatus(E, me, status, source) {
      if (source && source !== me && ['brn', 'par', 'psn', 'tox'].includes(status)) {
        E.show(me);
        E.setStatus(source, status, me);
      }
    },
  },
  'clear-body': blockDrops(null),
  'natural-cure': { onSwitchOut: (E, me) => me.status && E.cure(me, false) },
  'lightning-rod': absorb('electric', { boost: { satk: 1 } }),
  'serene-grace': { doublesSecondaries: true },
  'swift-swim': weatherSpeed(isRain),
  chlorophyll: weatherSpeed(isSun),
  illuminate: merge(blockDrops(['acc']), { ignoresEvasion: true }),
  trace: {
    noTrace: true,
    onStart(E, me) {
      const foe = E.foe(me);
      const key = foe?.ability;
      if (!key || !EFFECTS[key] || EFFECTS[key].noTrace) return;
      E.show(me, 'trace', { copied: key });
      E.setAbility(me, key);
      EFFECTS[key].onStart?.(E, me);
    },
  },
  'huge-power': { onAttack: (E, me, move) => (physical(move) ? 2 : 1) },
  'poison-point': contactStatus('psn'),
  'inner-focus': merge(blockStatus((s) => s === 'flinch'), ignoresIntimidate),
  'magma-armor': blockStatus((s) => s === 'frz'),
  'water-veil': blockStatus((s) => s === 'brn'),
  'magnet-pull': { onTrapFoe: (E, me, foe) => foe.types.includes('steel') },
  soundproof: {
    breakable: true,
    onTryHit(E, me, move) {
      if (!has(move, 'sound')) return false;
      E.show(me);
      E.note(me, 'immune');
      return true;
    },
  },
  'rain-dish': { onEndTurn: (E, me) => isRain(E.weather()) && E.heal(me, fraction(me, 1 / 16), me) },
  'sand-stream': setsWeather('sand'),
  pressure: announce('pressure'),
  'thick-fat': { breakable: true, onIncoming: (E, me, move) => (move.type === 'fire' || move.type === 'ice' ? 0.5 : 1) },
  'early-bird': { wakesFaster: true },
  'flame-body': contactStatus('brn'),
  'keen-eye': merge(blockDrops(['acc']), { ignoresEvasion: true }),
  'hyper-cutter': blockDrops(['atk']),
  truant: {
    onStart(E, me) {
      me.vol.truantRest = false;
    },
    onBeforeMove(E, me) {
      if (me.vol.truantRest) {
        me.vol.truantRest = false;
        E.show(me, 'loafing');
        return false;
      }
      me.vol.truantRest = true;
      return true;
    },
  },
  hustle: {
    onAttack: (E, me, move) => (physical(move) ? 1.5 : 1),
    onAccuracy: (E, me, move, target, acc) => (physical(move) ? acc * 0.8 : acc),
  },
  'cute-charm': contactChance(0.3, (E, me, attacker) => E.addVolatile(attacker, 'attract', me, { ability: me })),
  forecast: {
    noTrace: true,
    onStart: (E, me) => forecastType(E, me),
    onWeatherChange: (E, me) => forecastType(E, me),
  },
  'shed-skin': {
    onEndTurn(E, me) {
      if (me.status && E.rand() < 1 / 3) {
        E.show(me);
        E.cure(me, true);
      }
    },
  },
  guts: { ignoresBurn: true, onAttack: (E, me, move) => (me.status && physical(move) ? 1.5 : 1) },
  'marvel-scale': { breakable: true, onDefense: (E, me, move) => (me.status && physical(move) ? 1.5 : 1) },
  'liquid-ooze': { oozes: true },
  overgrow: pinch('grass'),
  blaze: pinch('fire'),
  torrent: pinch('water'),
  swarm: pinch('bug'),
  'rock-head': { noRecoil: true },
  drought: setsWeather('sun'),
  'arena-trap': { onTrapFoe: (E, me, foe) => E.grounded(foe) },
  'vital-spirit': blockStatus((s) => s === 'slp'),
  'white-smoke': blockDrops(null),
  'pure-power': { onAttack: (E, me, move) => (physical(move) ? 2 : 1) },
  'shell-armor': { breakable: true, critImmune: true },
  'air-lock': announce('weatherOff'),
  'tangled-feet': { breakable: true, onEvasion: (E, me, move, attacker, acc) => (me.vol.confusion ? acc * 0.5 : acc) },
  'motor-drive': absorb('electric', { boost: { spd: 1 } }),
  rivalry: {
    onBasePower(E, me, move, target) {
      if (!me.gender || !target.gender) return 1;
      return me.gender === target.gender ? 1.25 : 0.75;
    },
  },
  steadfast: { onFlinch: (E, me) => E.boost(me, { spd: 1 }, me, { ability: me }) },
  'snow-cloak': {
    breakable: true,
    weatherImmune: ['snow', 'hail'],
    onEvasion: (E, me, move, attacker, acc) => (isIcy(E.weather()) ? acc * 0.8 : acc),
  },
  'anger-point': {
    onDamagingHit(E, me, move, attacker, { crit }) {
      if (crit && me.hp > 0) {
        E.show(me);
        E.boost(me, { atk: 12 }, me);
      }
    },
  },
  heatproof: { breakable: true, halvesBurn: true, onIncoming: (E, me, move) => (move.type === 'fire' ? 0.5 : 1) },
  simple: {
    breakable: true,
    onChangeBoost(E, me, changes) {
      for (const k of Object.keys(changes)) changes[k] *= 2;
    },
  },
  'dry-skin': merge(absorb('water', { heal: 1 / 4 }), {
    onIncoming: (E, me, move) => (move.type === 'fire' ? 1.25 : 1),
    onEndTurn(E, me) {
      const w = E.weather();
      if (isRain(w)) E.heal(me, fraction(me, 1 / 8), me);
      else if (isSun(w)) {
        E.show(me);
        E.damage(me, fraction(me, 1 / 8), 'ability');
      }
    },
  }),
  download: {
    onStart(E, me) {
      const foe = E.foe(me);
      if (!foe) return;
      E.show(me);
      E.boost(me, foe.stats.def * stageMult(foe.boosts.def) < foe.stats.sdef * stageMult(foe.boosts.sdef) ? { atk: 1 } : { satk: 1 }, me);
    },
  },
  'iron-fist': flagPower('punch', 1.2),
  'magic-bounce': { breakable: true, bouncesStatus: true },
  'good-as-gold': { breakable: true, blocksStatusMoves: true },
  'wonder-skin': { breakable: true, wonderSkin: true },
  'poison-heal': {
    onStatusDamage(E, me, status) {
      if (!poison(status)) return undefined;
      if (!full(me)) {
        E.show(me);
        E.heal(me, fraction(me, 1 / 8), me);
      }
      return 0;
    },
  },
  adaptability: { stab: 2 },
  'skill-link': { maxHits: true },
  hydration: {
    onEndTurn(E, me) {
      if (me.status && isRain(E.weather())) {
        E.show(me);
        E.cure(me, true);
      }
    },
  },
  'solar-power': {
    onAttack: (E, me, move) => (special(move) && isSun(E.weather()) ? 1.5 : 1),
    onEndTurn(E, me) {
      if (isSun(E.weather())) {
        E.show(me);
        E.damage(me, fraction(me, 1 / 8), 'ability');
      }
    },
  },
  'quick-feet': { ignoresParalysisSpeed: true, onSpeed: (E, me, spd) => (me.status ? spd * 1.5 : spd) },
  normalize: {
    onModifyMove(E, me, move) {
      if (isAttack(move)) {
        move.type = 'normal';
        move.skinBoost = true;
      }
    },
    onBasePower: (E, me, move) => (move.skinBoost ? 1.2 : 1),
  },
  sniper: { onAttackerFinal: (E, me, move, target, { crit }) => (crit ? 1.5 : 1) },
  'magic-guard': { noIndirectDamage: true },
  'no-guard': { alwaysHits: true },
  stall: { onFractionalPriority: () => -1 },
  technician: { onBasePower: (E, me, move) => (move.power <= 60 ? 1.5 : 1) },
  'leaf-guard': blockStatus((s, E) => isMajor(s) && isSun(E.weather())),
  'mold-breaker': merge(announce('moldBreaker'), { moldBreaker: true }),
  'super-luck': { onCritStage: (E, me, move, target, stage) => stage + 1 },
  aftermath: {
    onFaint(E, me, attacker, move) {
      if (!attacker || attacker.hp <= 0 || !move || !contact(E, move, attacker) || E.anyActiveHas('damp')) return;
      E.show(me);
      E.damage(attacker, fraction(attacker, 1 / 4), 'ability');
    },
  },
  anticipation: {
    onStart(E, me) {
      const foe = E.foe(me);
      if (foe && foe.moves.some((m) => m.power && E.effectiveness(m, foe, me) > 1)) E.show(me, 'shudder');
    },
  },
  forewarn: {
    onStart(E, me) {
      const foe = E.foe(me);
      if (!foe) return;
      const best = foe.moves.reduce((a, m) => ((m.power || 0) > (a.power || 0) ? m : a), foe.moves[0]);
      E.show(me, 'forewarn', { move: best.name });
    },
  },
  unaware: { breakable: true, unaware: true },
  'tinted-lens': { onAttackerFinal: (E, me, move, target, { eff }) => (eff < 1 ? 2 : 1) },
  filter: { breakable: true, onDefenderFinal: (E, me, move, attacker, { eff }) => (eff > 1 ? 0.75 : 1) },
  'slow-start': {
    onStart(E, me) {
      me.vol.slowStart = 5;
      E.show(me, 'slowStart');
    },
    onAttack: (E, me, move) => (me.vol.slowStart && physical(move) ? 0.5 : 1),
    onSpeed: (E, me, spd) => (me.vol.slowStart ? spd * 0.5 : spd),
    onEndTurn(E, me) {
      if (!me.vol.slowStart) return;
      me.vol.slowStart -= 1;
      if (!me.vol.slowStart) E.show(me, 'slowStartEnd');
    },
  },
  scrappy: merge(ignoresIntimidate, { hitsGhost: true }),
  'storm-drain': absorb('water', { boost: { satk: 1 } }),
  'ice-body': {
    weatherImmune: ['snow', 'hail'],
    onEndTurn: (E, me) => isIcy(E.weather()) && E.heal(me, fraction(me, 1 / 16), me),
  },
  'solid-rock': { breakable: true, onDefenderFinal: (E, me, move, attacker, { eff }) => (eff > 1 ? 0.75 : 1) },
  'snow-warning': setsWeather('hail'),
  reckless: { onBasePower: (E, me, move) => (move.recoil ? 1.2 : 1) },
  'flower-gift': {
    breakable: true,
    onAttack: (E, me, move) => (physical(move) && isSun(E.weather()) ? 1.5 : 1),
    onDefense: (E, me, move) => (special(move) && isSun(E.weather()) ? 1.5 : 1),
    onStart: (E, me) => cherrimForm(E, me),
    onWeatherChange: (E, me) => cherrimForm(E, me),
  },
  'bad-dreams': {
    onEndTurn(E, me) {
      const foe = E.foe(me);
      if (foe && E.asleep(foe)) {
        E.show(me);
        E.damage(foe, fraction(foe, 1 / 8), 'ability');
      }
    },
  },
  'sheer-force': { sheerForce: true, onBasePower: (E, me, move) => (move.secondary?.length ? 1.3 : 1) },
  contrary: {
    breakable: true,
    onChangeBoost(E, me, changes) {
      for (const k of Object.keys(changes)) changes[k] = -changes[k];
    },
  },
  defiant: {
    onAfterEachBoost(E, me, changes, source) {
      if (source && source !== me && Object.values(changes).some((v) => v < 0)) E.boost(me, { atk: 2 }, me, { ability: me });
    },
  },
  defeatist: { onAttack: (E, me) => (me.hp <= me.stats.hp / 2 ? 0.5 : 1) },
  'cursed-body': {
    onDamagingHit(E, me, move, attacker) {
      if (attacker.hp > 0 && move.key && !attacker.vol.disabled && E.rand() < 0.3) E.addVolatile(attacker, 'disable', me, { ability: me, move });
    },
  },
  'weak-armor': hitBoost(physical, { def: -1, spd: 2 }),
  multiscale: { breakable: true, onDefenderFinal: (E, me) => (full(me) ? 0.5 : 1) },
  'toxic-boost': { onBasePower: (E, me, move) => (poison(me.status) && physical(move) ? 1.5 : 1) },
  'flare-boost': { onBasePower: (E, me, move) => (me.status === 'brn' && special(move) ? 1.5 : 1) },
  moody: {
    onEndTurn(E, me) {
      const stats = ['atk', 'def', 'satk', 'sdef', 'spd'];
      const up = stats.filter((k) => me.boosts[k] < 6);
      if (!up.length) return;
      const raised = up[Math.floor(E.rand() * up.length)];
      const down = stats.filter((k) => k !== raised && me.boosts[k] > -6);
      const lowered = down.length ? down[Math.floor(E.rand() * down.length)] : null;
      E.show(me);
      E.boost(me, lowered ? { [raised]: 2, [lowered]: -1 } : { [raised]: 2 }, me);
    },
  },
  overcoat: { breakable: true, weatherImmune: ['sand', 'snow', 'hail'] },
  'poison-touch': {
    onAfterMoveHit(E, me, move, target) {
      if (target.hp > 0 && contact(E, move, me) && E.rand() < 0.3) E.setStatus(target, 'psn', me, { ability: me });
    },
  },
  regenerator: { onSwitchOut: (E, me) => me.hp > 0 && E.heal(me, fraction(me, 1 / 3), null, { silent: true }) },
  'big-pecks': blockDrops(['def']),
  'sand-rush': merge(weatherSpeed((w) => w === 'sand'), { weatherImmune: ['sand'] }),
  analytic: { onBasePower: (E, me, move, target) => (E.hasMoved(target) ? 1.3 : 1) },
  illusion: {
    noTrace: true,
    disguisesOnEntry: true,
    onDamagingHit(E, me) {
      if (!E.breakIllusion(me)) return;
      E.show(me, 'illusionBroken', { look: E.look(me) });
    },
  },
  imposter: {
    noTrace: true,
    onStart(E, me) {
      const foe = E.foe(me);
      if (foe && !foe.vol.transformed && !foe.vol.illusion) {
        E.show(me);
        E.transform(me, foe);
      }
    },
  },
  mummy: {
    onDamagingHit(E, me, move, attacker) {
      if (!contact(E, move, attacker) || !attacker.ability || attacker.ability === 'mummy' || EFFECTS[attacker.ability]?.unsuppressable) return;
      E.show(me);
      E.setAbility(attacker, 'mummy');
    },
  },
  moxie: onKoBoost({ atk: 1 }),
  justified: hitBoost((m) => m.type === 'dark', { atk: 1 }),
  rattled: merge(hitBoost((m) => ['bug', 'ghost', 'dark'].includes(m.type), { spd: 1 }), {
    onAfterEachBoost(E, me, changes, source, effect) {
      if (effect === 'intimidate') E.boost(me, { spd: 1 }, me, { ability: me });
    },
  }),
  'sap-sipper': absorb('grass', { boost: { atk: 1 } }),
  prankster: { onModifyPriority: (E, me, move, prio) => (move.category === 'status' ? prio + 1 : prio) },
  'sand-force': {
    weatherImmune: ['sand'],
    onBasePower: (E, me, move) => (E.weather() === 'sand' && ['rock', 'ground', 'steel'].includes(move.type) ? 1.3 : 1),
  },
  'iron-barbs': hurtAttackerOnContact,
  'zen-mode': formChanger((E, me) => {
    if (me.speciesId !== 555 || me.hp <= 0) return;
    const want = me.hp <= me.stats.hp / 2 ? 'darmanitan-zen' : null;
    if ((me.form ?? null) !== want) {
      E.show(me, want ? 'formZen' : 'formStandard');
      E.changeForm(me, want);
    }
  }),
  'victory-star': { onAccuracy: (E, me, move, target, acc) => acc * 1.1 },
  turboblaze: merge(announce('turboblaze'), { moldBreaker: true }),
  teravolt: merge(announce('teravolt'), { moldBreaker: true }),
  'aroma-veil': blockStatus((s) => s === 'disable'),
  'flower-veil': merge(
    {
      breakable: true,
      onSetStatus(E, me, status, source) {
        if (!me.types.includes('grass') || !isMajor(status) || !source || source === me) return true;
        E.show(me);
        return false;
      },
    },
    {
      onTryBoost(E, me, changes, source) {
        if (!me.types.includes('grass') || !source || source === me) return;
        let blocked = false;
        for (const k of Object.keys(changes)) {
          if (changes[k] < 0) {
            delete changes[k];
            blocked = true;
          }
        }
        if (blocked) E.show(me, 'noDrop');
      },
    },
  ),
  protean: changesTypeBeforeMoving(),
  'fur-coat': { breakable: true, onDefense: (E, me, move) => (physical(move) ? 2 : 1) },
  bulletproof: {
    breakable: true,
    onTryHit(E, me, move) {
      if (!has(move, 'bullet')) return false;
      E.show(me);
      E.note(me, 'immune');
      return true;
    },
  },
  competitive: {
    onAfterEachBoost(E, me, changes, source) {
      if (source && source !== me && Object.values(changes).some((v) => v < 0)) E.boost(me, { satk: 2 }, me, { ability: me });
    },
  },
  'strong-jaw': flagPower('bite', 1.5),
  refrigerate: skin('ice'),
  'sweet-veil': blockStatus((s) => s === 'slp'),
  'stance-change': {
    unsuppressable: true,
    noTrace: true,
    onBeforeMoveForm(E, me, move) {
      if (me.speciesId !== 681) return;
      const want = isAttack(move) ? 'aegislash-blade' : null;
      if ((me.form ?? null) !== want) {
        E.show(me, want ? 'formBlade' : 'formShield');
        E.changeForm(me, want);
      }
    },
  },
  'gale-wings': { onModifyPriority: (E, me, move, prio) => (move.type === 'flying' && full(me) ? prio + 1 : prio) },
  'mega-launcher': flagPower('pulse', 1.5),
  'grass-pelt': { breakable: true, onDefense: (E, me, move) => (E.terrain() === 'grassy' && physical(move) ? 1.5 : 1) },
  'tough-claws': { onBasePower: (E, me, move) => (contact(E, move, me) ? 1.3 : 1) },
  pixilate: skin('fairy'),
  gooey: contactChance(1, (E, me, attacker) => {
    E.show(me);
    E.boost(attacker, { spd: -1 }, me);
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
  merciless: { onCritStage: (E, me, move, target, stage) => (poison(target.status) ? 3 : stage) },
  'shields-down': merge(
    formChanger((E, me) => {
      if (me.speciesId !== 774 || me.hp <= 0) return;
      const want = me.hp > me.stats.hp / 2 ? null : miniorCore(me);
      if ((me.form ?? null) !== want) {
        E.show(me, want ? 'formCore' : 'formMeteor');
        E.changeForm(me, want);
      }
    }),
    {
      onSetStatus(E, me, status) {
        if (me.speciesId !== 774 || me.form || !isMajor(status)) return true;
        E.show(me);
        return false;
      },
    },
  ),
  stakeout: { onBasePower: (E, me, move, target) => (target.vol.enteredTurn === E.b.turn ? 2 : 1) },
  'water-bubble': merge(blockStatus((s) => s === 'brn'), {
    onIncoming: (E, me, move) => (move.type === 'fire' ? 0.5 : 1),
    onBasePower: (E, me, move) => (move.type === 'water' ? 2 : 1),
  }),
  steelworker: typePower('steel', 1.5),
  berserk: {
    onDamagingHit(E, me, move, attacker, { before }) {
      if (droppedBelowHalf(me, before)) E.boost(me, { satk: 1 }, me, { ability: me });
    },
  },
  'slush-rush': weatherSpeed(isIcy),
  'long-reach': {},
  'suction-cups': { suctionCups: true },
  infiltrator: { infiltrates: true },
  'screen-cleaner': {
    onStart(E, me) {
      const sides = [0, 1].filter((s) => Object.keys(E.b.sides[s].screens).length);
      if (!sides.length) return;
      E.show(me);
      for (const s of sides) E.clearScreens(s, 'cleaner');
    },
  },
  'liquid-voice': {
    onModifyMove(E, me, move) {
      if (has(move, 'sound')) move.type = 'water';
    },
  },
  triage: { onModifyPriority: (E, me, move, prio) => (has(move, 'heal') || move.drain ? prio + 3 : prio) },
  galvanize: skin('electric'),
  'surge-surfer': { onSpeed: (E, me, spd) => (E.terrain() === 'electric' ? spd * 2 : spd) },
  schooling: formChanger((E, me) => {
    if (me.speciesId !== 746 || me.hp <= 0 || me.level < 20) return;
    const want = me.hp > me.stats.hp / 4 ? 'wishiwashi-school' : null;
    if ((me.form ?? null) !== want) {
      E.show(me, want ? 'formSchool' : 'formSolo');
      E.changeForm(me, want);
    }
  }),
  disguise: {
    unsuppressable: true,
    noTrace: true,
    breakable: true,
    onDamage(E, me, move, attacker, dmg) {
      if (me.speciesId !== 778 || me.disguiseBusted || !isAttack(move)) return dmg;
      me.disguiseBusted = true;
      E.show(me, 'disguise');
      E.changeForm(me, 'mimikyu-busted', { permanent: true });
      return fraction(me, 1 / 8);
    },
  },
  'battle-bond': {
    onFoeFaint(E, me) {
      if (me.battleBondUsed) return;
      me.battleBondUsed = true;
      E.show(me);
      E.boost(me, { atk: 1, satk: 1, spd: 1 }, me);
    },
  },
  'power-construct': formChanger((E, me) => {
    if (me.speciesId !== 718 || me.hp <= 0 || me.form === 'zygarde-complete' || me.hp > me.stats.hp / 2) return;
    E.show(me, 'formComplete');
    E.changeForm(me, 'zygarde-complete', { permanent: true });
  }),
  corrosion: { corrosion: true },
  comatose: {
    unsuppressable: true,
    noTrace: true,
    comatose: true,
    onStart: (E, me) => E.show(me, 'comatose'),
    onSetStatus(E, me, status) {
      if (!isMajor(status)) return true;
      E.show(me);
      return false;
    },
  },
  'queenly-majesty': blocksPriority(),
  'innards-out': {
    onFaint(E, me, attacker, move, dmg) {
      if (!attacker || attacker.hp <= 0 || !dmg) return;
      E.show(me);
      E.damage(attacker, dmg, 'ability');
    },
  },
  dancer: {
    onFoeMove(E, me, foe, move) {
      if (!has(move, 'dance') || me.hp <= 0 || move.kind !== 'status' || move.target !== 'self' || !move.boosts) return;
      E.show(me);
      E.boost(me, move.boosts, me);
    },
  },
  fluffy: {
    breakable: true,
    onIncoming(E, me, move, attacker) {
      let m = contact(E, move, attacker) ? 0.5 : 1;
      if (move.type === 'fire') m *= 2;
      return m;
    },
  },
  dazzling: blocksPriority(),
  'soul-heart': {
    onAnyFaint(E, me, fainted) {
      if (fainted !== me && me.hp > 0) E.boost(me, { satk: 1 }, me, { ability: me });
    },
  },
  'tangling-hair': contactChance(1, (E, me, attacker) => {
    E.show(me);
    E.boost(attacker, { spd: -1 }, me);
  }),
  'beast-boost': onKoBoost((me) => ({ [highestStat(me)]: 1 })),
  'electric-surge': setsTerrain('electric'),
  'psychic-surge': setsTerrain('psychic'),
  'misty-surge': setsTerrain('misty'),
  'grassy-surge': setsTerrain('grassy'),
  'full-metal-body': blockDrops(null, { breakable: false }),
  'shadow-shield': { onDefenderFinal: (E, me) => (full(me) ? 0.5 : 1) },
  'prism-armor': { onDefenderFinal: (E, me, move, attacker, { eff }) => (eff > 1 ? 0.75 : 1) },
  neuroforce: { onAttackerFinal: (E, me, move, target, { eff }) => (eff > 1 ? 1.25 : 1) },
  'intrepid-sword': oncePerBattle({ atk: 1 }),
  'dauntless-shield': oncePerBattle({ def: 1 }),
  libero: changesTypeBeforeMoving(),
  'cotton-down': {
    onDamagingHit(E, me, move, attacker) {
      if (attacker.hp <= 0) return;
      E.show(me);
      E.boost(attacker, { spd: -1 }, me);
    },
  },
  'mirror-armor': {
    breakable: true,
    onTryBoost(E, me, changes, source) {
      if (!source || source === me) return;
      const reflected = {};
      for (const k of Object.keys(changes)) {
        if (changes[k] < 0) {
          reflected[k] = changes[k];
          delete changes[k];
        }
      }
      if (!Object.keys(reflected).length) return;
      E.show(me);
      if (source.hp > 0) E.boost(source, reflected, me, { effect: 'mirror-armor' });
    },
  },
  'gulp-missile': {
    unsuppressable: true,
    noTrace: true,
    onAfterMove(E, me, move) {
      if (me.speciesId !== 845 || me.vol.gulp || (move.key !== 'surf' && move.key !== 'dive')) return;
      me.vol.gulp = me.hp > me.stats.hp / 2 ? 'arrokuda' : 'pikachu';
      E.show(me, me.vol.gulp === 'arrokuda' ? 'gulpArrokuda' : 'gulpPikachu');
      E.changeForm(me, me.vol.gulp === 'arrokuda' ? 'cramorant-gulping' : 'cramorant-gorging');
    },
    onDamagingHit(E, me, move, attacker) {
      if (!me.vol.gulp || attacker.hp <= 0) return;
      const prey = me.vol.gulp;
      delete me.vol.gulp;
      E.show(me, 'gulpSpit');
      E.changeForm(me, null);
      E.damage(attacker, fraction(attacker, 1 / 4), 'ability');
      if (attacker.hp <= 0) return;
      if (prey === 'arrokuda') E.boost(attacker, { def: -1 }, me);
      else E.setStatus(attacker, 'par', me);
    },
  },
  'hunger-switch': {
    noTrace: true,
    onEndTurn(E, me) {
      if (me.speciesId !== 877 || me.hp <= 0) return;
      E.show(me, me.form ? 'formFullBelly' : 'formHangry');
      E.changeForm(me, me.form ? null : 'morpeko-hangry');
    },
  },
  'steam-engine': hitBoost((m) => m.type === 'fire' || m.type === 'water', { spd: 6 }),
  'punk-rock': {
    breakable: true,
    onBasePower: (E, me, move) => (has(move, 'sound') ? 1.3 : 1),
    onIncoming: (E, me, move) => (has(move, 'sound') ? 0.5 : 1),
  },
  'sand-spit': {
    onDamagingHit(E, me) {
      if (E.weather() !== 'sand') E.setWeather('sand', me);
    },
  },
  'ice-scales': { breakable: true, onIncoming: (E, me, move) => (special(move) ? 0.5 : 1) },
  'ice-face': {
    unsuppressable: true,
    noTrace: true,
    breakable: true,
    onDamage(E, me, move, attacker, dmg) {
      if (me.speciesId !== 875 || me.form || !physical(move)) return dmg;
      E.show(me, 'iceFaceBroken');
      E.changeForm(me, 'eiscue-noice', { permanent: true });
      return 0;
    },
    onWeatherChange(E, me) {
      if (me.speciesId === 875 && me.form === 'eiscue-noice' && isIcy(E.weather())) {
        E.show(me, 'iceFaceRestored');
        E.changeForm(me, null, { permanent: true });
      }
    },
  },
  mimicry: {
    onStart: (E, me) => mimicryType(E, me),
    onTerrainChange: (E, me) => mimicryType(E, me),
  },
  'steely-spirit': typePower('steel', 1.5),
  'perish-body': {
    onDamagingHit(E, me, move, attacker) {
      if (!contact(E, move, attacker) || attacker.vol.perish || attacker.hp <= 0) return;
      E.show(me);
      E.addVolatile(attacker, 'perish', me);
      if (!me.vol.perish && me.hp > 0) E.addVolatile(me, 'perish', me);
    },
  },
  'wandering-spirit': {
    onDamagingHit(E, me, move, attacker) {
      if (!contact(E, move, attacker) || !attacker.ability || EFFECTS[attacker.ability]?.unsuppressable || EFFECTS[attacker.ability]?.noTrace) return;
      E.show(me);
      const theirs = attacker.ability;
      E.setAbility(attacker, me.ability);
      E.setAbility(me, theirs);
    },
  },
  'gorilla-tactics': {
    onAttack: (E, me, move) => (physical(move) ? 1.5 : 1),
    onAfterMove(E, me, move) {
      if (move.key && me.vol.lockedMove == null) me.vol.lockedMove = move.key;
    },
  },
  'neutralizing-gas': { unsuppressable: true, noTrace: true, onStart: (E, me) => E.show(me, 'neutralizingGas') },
  'pastel-veil': blockStatus(poison),
  'quick-draw': {
    onFractionalPriority(E, me, move) {
      if (!isAttack(move) || E.rand() >= 0.3) return 0;
      E.show(me);
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
    onDamagingHit(E, me, move, attacker) {
      if (!contact(E, move, attacker) || !attacker.ability || attacker.ability === 'lingering-aroma' || EFFECTS[attacker.ability]?.unsuppressable) return;
      E.show(me);
      E.setAbility(attacker, 'lingering-aroma');
    },
  },
  'seed-sower': {
    onDamagingHit(E, me) {
      if (E.terrain() !== 'grassy') E.setTerrain('grassy', me);
    },
  },
  'thermal-exchange': merge(blockStatus((s) => s === 'brn'), hitBoost((m) => m.type === 'fire', { atk: 1 })),
  'anger-shell': {
    onDamagingHit(E, me, move, attacker, { before }) {
      if (droppedBelowHalf(me, before)) {
        E.show(me);
        E.boost(me, { atk: 1, satk: 1, spd: 1, def: -1, sdef: -1 }, me);
      }
    },
  },
  'purifying-salt': merge(blockStatus(isMajor), { onIncoming: (E, me, move) => (move.type === 'ghost' ? 0.5 : 1) }),
  'well-baked-body': absorb('fire', { boost: { def: 2 } }),
  'wind-rider': {
    breakable: true,
    onTryHit(E, me, move) {
      if (!has(move, 'wind') || !isAttack(move)) return false;
      E.show(me);
      E.boost(me, { atk: 1 }, me);
      return true;
    },
  },
  'guard-dog': {
    breakable: true,
    onTryBoost(E, me, changes, source, effect) {
      if (effect === 'intimidate' && changes.atk < 0) {
        changes.atk = 1;
        E.show(me);
      }
    },
  },
  'rocky-payload': typePower('rock', 1.5),
  'wind-power': {
    onDamagingHit(E, me, move) {
      if (has(move, 'wind') && me.hp > 0) E.addVolatile(me, 'charge', me, { ability: me });
    },
  },
  'zero-to-hero': {
    unsuppressable: true,
    noTrace: true,
    onSwitchOut(E, me) {
      if (me.speciesId === 964 && me.form !== 'palafin-hero') me.heroPending = true;
    },
    onStart(E, me) {
      if (me.speciesId !== 964 || !me.heroPending || me.form === 'palafin-hero') return;
      me.heroPending = false;
      E.show(me, 'formHero');
      E.changeForm(me, 'palafin-hero', { permanent: true });
    },
  },
  electromorphosis: {
    onDamagingHit(E, me) {
      if (me.hp > 0) E.addVolatile(me, 'charge', me, { ability: me });
    },
  },
  protosynthesis: paradox((E) => isSun(E.weather())),
  'quark-drive': paradox((E) => E.terrain() === 'electric'),
  'vessel-of-ruin': announce('ruin'),
  'sword-of-ruin': announce('ruin'),
  'tablets-of-ruin': announce('ruin'),
  'beads-of-ruin': announce('ruin'),
  'orichalcum-pulse': merge(setsWeather('sun'), { onAttack: (E, me, move) => (physical(move) && isSun(E.weather()) ? 4 / 3 : 1) }),
  'hadron-engine': merge(setsTerrain('electric'), { onAttack: (E, me, move) => (special(move) && E.terrain() === 'electric' ? 4 / 3 : 1) }),
  opportunist: {
    onFoeBoost(E, me, foe, changes, effect) {
      if (effect === 'opportunist' || me.hp <= 0) return;
      const ups = Object.fromEntries(Object.entries(changes).filter(([, v]) => v > 0));
      if (!Object.keys(ups).length) return;
      E.show(me);
      E.boost(me, ups, me, { effect: 'opportunist' });
    },
  },
  sharpness: flagPower('slicing', 1.5),
  'supreme-overlord': {
    onStart(E, me) {
      if (E.faintedAllies(me) > 0) E.show(me);
    },
    onBasePower: (E, me) => 1 + 0.1 * Math.min(5, E.faintedAllies(me)),
  },
  'toxic-debris': {
    onDamagingHit(E, me, move, attacker) {
      if (!physical(move)) return;
      if (E.addToxicSpikes(attacker)) E.show(me);
    },
  },
  'armor-tail': blocksPriority(),
  'earth-eater': absorb('ground', { heal: 1 / 4 }),
  'mycelium-might': {
    onFractionalPriority: (E, me, move) => (move.category === 'status' ? -1 : 0),
  },
  'minds-eye': merge(blockDrops(['acc']), { hitsGhost: true, ignoresEvasion: true }),
  'supersweet-syrup': {
    onStart(E, me) {
      const foe = E.foe(me);
      if (!foe || me.syrupUsed) return;
      me.syrupUsed = true;
      E.show(me);
      E.boost(foe, { eva: -1 }, me);
    },
  },
  'toxic-chain': {
    onAfterMoveHit(E, me, move, target) {
      if (target.hp > 0 && E.rand() < 0.3) E.setStatus(target, 'tox', me, { ability: me });
    },
  },
  'tera-shift': {
    unsuppressable: true,
    noTrace: true,
    onStart(E, me) {
      if (me.speciesId !== 1024 || me.form === 'terapagos-terastal') return;
      E.show(me, 'formTerastal');
      E.changeForm(me, 'terapagos-terastal', { permanent: true });
    },
  },
  'tera-shell': {
    breakable: true,
    onEffectiveness(E, me, move, attacker, eff) {
      if (!full(me) || eff === 0) return eff;
      E.show(me);
      return 0.5;
    },
  },
  'poison-puppeteer': {
    noTrace: true,
    onInflictStatus(E, me, target, status) {
      if (poison(status) && target.hp > 0) E.addVolatile(target, 'confusion', me);
    },
  },
  dragonize: skin('dragon'),
  'mega-sol': { actsInSun: true },
  'spicy-spray': {
    onDamagingHit(E, me, move, attacker) {
      if (attacker.hp > 0) E.setStatus(attacker, 'brn', me, { ability: me });
    },
  },
  eelevate: merge(
    {
      breakable: true,
      levitates: true,
      onTryHit(E, me, move) {
        if (move.type !== 'ground' || !isAttack(move)) return false;
        E.show(me);
        E.note(me, 'immune');
        return true;
      },
    },
    onKoBoost((me) => ({ [highestStat(me)]: 1 })),
  ),
  'fire-mane': typePower('fire', 1.5),
  'aura-guard': { breakable: true, onIncoming: (E, me, move, attacker) => (contact(E, move, attacker) ? 0.5 : 1) },
};

function forecastType(E, me) {
  if (me.speciesId !== 351) return;
  const w = E.weather();
  const want = isSun(w) ? 'castform-sunny' : isRain(w) ? 'castform-rainy' : isIcy(w) ? 'castform-snowy' : null;
  if ((me.form ?? null) === want) return;
  E.show(me);
  E.changeForm(me, want);
}

function cherrimForm(E, me) {
  if (me.speciesId !== 421) return;
  const want = isSun(E.weather()) ? 'cherrim-sunshine' : null;
  if ((me.form ?? null) === want) return;
  E.changeForm(me, want);
}

function mimicryType(E, me) {
  const TERRAIN_TYPE = { electric: 'electric', grassy: 'grass', misty: 'fairy', psychic: 'psychic' };
  const type = TERRAIN_TYPE[E.terrain()];
  const want = type ? [type] : me.baseTypes;
  if (want.join() !== me.types.join()) {
    E.show(me);
    E.setTypes(me, want);
  }
}

function changesTypeBeforeMoving() {
  return {
    onPrepareMove(E, me, move) {
      if (me.vol.proteanUsed || !move.type || !isAttack(move)) return;
      if (me.types.length === 1 && me.types[0] === move.type) return;
      me.vol.proteanUsed = true;
      E.show(me);
      E.setTypes(me, [move.type]);
    },
  };
}

function blocksPriority() {
  return {
    breakable: true,
    onTryHit(E, me, move, attacker) {
      if (move.effectivePriority <= 0 || attacker === me) return false;
      E.show(me);
      E.note(me, 'immune');
      return true;
    },
  };
}

function escapesBelowHalf() {
  return {
    onDamagingHit(E, me, move, attacker, { before }) {
      if (droppedBelowHalf(me, before) && E.hasBench(me)) {
        E.show(me);
        me.vol.exitPending = true;
      }
    },
  };
}

function oncePerBattle(boost) {
  return {
    onStart(E, me) {
      if (me.onceUsed) return;
      me.onceUsed = true;
      E.show(me);
      E.boost(me, boost, me);
    },
  };
}

function paradox(active) {
  const stat = (E, me) => {
    if (!active(E)) return null;
    if (!me.vol.paradoxStat) {
      me.vol.paradoxStat = highestStat(me);
      E.show(me, 'paradox', { stat: me.vol.paradoxStat });
    }
    return me.vol.paradoxStat;
  };
  const refresh = (E, me) => {
    if (!active(E)) delete me.vol.paradoxStat;
    else stat(E, me);
  };
  return {
    noTrace: true,
    onStart: refresh,
    onWeatherChange: refresh,
    onTerrainChange: refresh,
    onAttack: (E, me, move) => (active(E) && me.vol.paradoxStat === (physical(move) ? 'atk' : 'satk') ? 1.3 : 1),
    onDefense: (E, me, move) => (active(E) && me.vol.paradoxStat === (physical(move) ? 'def' : 'sdef') ? 1.3 : 1),
    onSpeed: (E, me, spd) => (active(E) && me.vol.paradoxStat === 'spd' ? spd * 1.5 : spd),
  };
}

export const ABILITIES = EFFECTS;

export function abilityInfo(key) {
  if (!key) return null;
  const c = CATALOG[key];
  const inert = INERT[key];
  return {
    key,
    name: c?.name ?? key,
    desc: c?.desc ?? '',
    ...(inert ? { inert: INERT_REASONS[inert] } : {}),
  };
}

export function knownAbility(key) {
  return Object.hasOwn(CATALOG, key);
}

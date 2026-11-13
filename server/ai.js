import { buildFighter, speciesData, effectiveness, usableMovepool, abilityOptions, usableAbility, moveData, shuffled, rng, STRUGGLE, MOVES_PER_FIGHTER } from './creatures.js';
import { validActions, submit, needsAction, STRUGGLE_MOVE } from './battle.js';
import { randomize } from './random.js';
import { PARTY_SIZE, BATTLE_SIZE } from './preview.js';

export const AI_LEVELS = ['easy', 'mid', 'hard', 'veryhard', 'skynet'];
export const AI_LABELS = { easy: 'Fácil', mid: 'Media', hard: 'Difícil', veryhard: 'Muy difícil', skynet: 'Skynet' };
// Skynet's turns are decided by Jev (server/jev.js). Everything else, and its fallback when Jev
// can't answer, is the very hard AI.
export const JEV_LEVEL = 'skynet';
const tactics = (difficulty) => (difficulty === JEV_LEVEL ? 'veryhard' : difficulty);
export const AI_PREFIX = 'ai:';
export const LAST_AI_SPECIES = 649;

export const aiTrainerId = (level) => `${AI_PREFIX}${level}`;
export const aiLevelOf = (trainerId) => (typeof trainerId === 'string' && trainerId.startsWith(AI_PREFIX) ? trainerId.slice(AI_PREFIX.length) : null);
export const isAiLevel = (level) => AI_LEVELS.includes(level);

const IVS = { easy: 8, mid: 18, hard: 28, veryhard: 31 };
const PLAIN_NATURES = ['hardy', 'docile', 'serious', 'bashful', 'quirky'];
const STRONG_ABILITIES = new Set([
  'huge-power', 'pure-power', 'speed-boost', 'intimidate', 'levitate', 'drizzle', 'drought', 'sand-stream', 'snow-warning',
  'multiscale', 'technician', 'adaptability', 'regenerator', 'magic-guard', 'sheer-force', 'guts', 'thick-fat', 'swift-swim',
  'chlorophyll', 'sturdy', 'serene-grace', 'moxie', 'prankster', 'tinted-lens', 'skill-link', 'iron-fist', 'filter',
  'solid-rock', 'flash-fire', 'water-absorb', 'volt-absorb', 'natural-cure', 'poison-heal', 'unaware', 'wonder-guard',
]);
const IMMUNE_BY_ABILITY = {
  levitate: 'ground', 'volt-absorb': 'electric', 'lightning-rod': 'electric', 'motor-drive': 'electric', 'water-absorb': 'water',
  'storm-drain': 'water', 'dry-skin': 'water', 'flash-fire': 'fire', 'sap-sipper': 'grass',
};
const STATUS_IMMUNE_TYPES = { par: ['electric'], brn: ['fire'], psn: ['poison', 'steel'], tox: ['poison', 'steel'], frz: ['ice'], slp: [] };
const STATUS_VALUE = { slp: 70, par: 55, tox: 52, psn: 35, brn: 48, frz: 40 };

const lastSwitchTurn = new WeakMap();
const pickOne = (list, random) => list[Math.floor(random() * list.length)];
const stageMult = (s = 0) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const bst = (data) => data.stats.reduce((a, b) => a + b, 0);
const fullyEvolved = (data) => data.chainLen == null || data.stage == null || data.stage >= data.chainLen - 1;
const hpShare = (f) => f.hp / f.stats.hp;

function rarityOf(data) {
  const total = bst(data);
  return total >= 580 ? 'legendary' : total >= 500 ? 'rare' : total >= 400 ? 'uncommon' : 'common';
}

export function aiPool() {
  const ids = [];
  for (let id = 1; id <= LAST_AI_SPECIES; id++) if (speciesData(id)) ids.push(id);
  return ids;
}

function natureFor(data, difficulty, random) {
  if (difficulty === 'easy' || difficulty === 'mid') return pickOne(PLAIN_NATURES, random);
  const [, atk, , satk, , spd] = data.stats;
  const physical = atk >= satk;
  if (spd >= 90) return physical ? 'jolly' : 'timid';
  return physical ? 'adamant' : 'modest';
}

function moveValue(m, mon) {
  if (!m.supported) return 0;
  if (m.kind === 'status') {
    const ups = Object.entries(m.boosts ?? {}).filter(([k, v]) => v > 0 && m.target === 'self' && ['atk', 'satk', 'spd'].includes(k)).length;
    if (ups) return 55 + ups * 12;
    if (m.heal) return 60;
    if (m.status) return STATUS_VALUE[m.status] ?? 30;
    if (m.screen) return 45;
    if (m.weather === 'rain' && mon.types.includes('water')) return 50;
    if (m.weather === 'sun' && mon.types.includes('fire')) return 50;
    if (m.volatile === 'leechseed') return 40;
    if (m.volatile === 'confusion') return 30;
    return 12;
  }
  let power = m.power || (m.fixedDamage ? 55 : m.ohko ? 30 : 0);
  if (m.multihit) power *= (m.multihit[0] + m.multihit[1]) / 2;
  const physical = m.category === 'physical';
  const stat = physical ? mon.stats.atk : mon.stats.satk;
  let v = power * ((m.accuracy ?? 100) / 100) * (m.type && mon.types.includes(m.type) ? 1.5 : 1) * (stat / Math.max(1, (mon.stats.atk + mon.stats.satk) / 2));
  if (m.flags.includes('recharge')) v *= 0.55;
  if (m.flags.includes('charge')) v *= 0.55;
  if (m.selfDestruct) v *= 0.3;
  if (m.recoil) v *= 0.9;
  if (m.priority > 0) v *= 1.1;
  if (m.secondary?.length) v *= 1.05;
  return v;
}

export function pickMoveset(entry, difficulty, random) {
  const pool = usableMovepool(entry);
  if (difficulty === 'easy' || pool.length <= MOVES_PER_FIGHTER) return shuffled(pool, random).slice(0, MOVES_PER_FIGHTER);
  const mon = buildFighter({ ...entry, moveset: pool.slice(0, 1) });
  const scored = pool.map((id) => ({ id, m: moveData(id) })).map((x) => ({ ...x, v: moveValue(x.m, mon) * (difficulty === 'mid' ? 0.75 + random() * 0.5 : 1) }));
  if (difficulty === 'mid') return scored.sort((a, b) => b.v - a.v).slice(0, MOVES_PER_FIGHTER).map((x) => x.id);
  const maxStatus = difficulty === 'veryhard' ? 2 : 1;
  const chosen = [];
  while (chosen.length < MOVES_PER_FIGHTER) {
    const types = new Set(chosen.filter((x) => x.m.kind === 'attack').map((x) => x.m.type));
    const statusCount = chosen.filter((x) => x.m.kind === 'status').length;
    const attacks = chosen.length - statusCount;
    let best = null;
    let bestValue = -1;
    for (const x of scored) {
      if (chosen.includes(x)) continue;
      if (x.m.kind === 'status' && (statusCount >= maxStatus || attacks < 2)) continue;
      let v = x.v;
      if (x.m.kind === 'attack') v *= types.has(x.m.type) ? 0.4 : types.size ? 1.3 : 1;
      if (v > bestValue) [best, bestValue] = [x, v];
    }
    if (!best) break;
    chosen.push(best);
  }
  return chosen.map((x) => x.id);
}

function pickAbility(entry, difficulty, random) {
  const options = abilityOptions(entry).map((a) => a.key).filter(usableAbility);
  if (!options.length) return null;
  if (difficulty === 'hard' || difficulty === 'veryhard') {
    const strong = options.filter((k) => STRONG_ABILITIES.has(k));
    if (strong.length) return pickOne(strong, random);
  }
  return pickOne(options, random);
}

export function aiEntry(finalID, { level, difficulty, random, index }) {
  const data = speciesData(finalID);
  const iv = IVS[difficulty];
  const base = {
    id: `ai-${index}-${finalID}`,
    finalID,
    baseID: finalID,
    rarity: rarityOf(data),
    shiny: false,
    level,
    ivs: { hp: iv, atk: iv, def: iv, satk: iv, sdef: iv, spd: iv },
    nature: natureFor(data, difficulty, random),
    learned: [],
  };
  const moveset = pickMoveset(base, difficulty, random);
  const ability = pickAbility(base, difficulty, random);
  return { ...base, ...(moveset.length ? { moveset } : {}), ...(ability ? { abilityChoice: ability } : {}) };
}

function typeMatchup(attackTypes, defendTypes) {
  let best = 0;
  for (const t of attackTypes) best = Math.max(best, effectiveness(t, defendTypes));
  return best;
}

export function speciesMatchup(mine, theirs) {
  const offense = typeMatchup(mine.types, theirs.types);
  const defense = typeMatchup(theirs.types, mine.types);
  const score = (e) => (e === 0 ? -2 : e >= 4 ? 3 : e >= 2 ? 2 : e < 1 ? -1 : 0);
  return score(offense) - score(defense);
}

function usableAtLevel(id, level) {
  return usableMovepool({ id: 'probe', finalID: id, level, learned: [] }).some((k) => moveData(k).kind === 'attack');
}

function candidates(difficulty, level) {
  return aiPool().filter((id) => {
    const data = speciesData(id);
    if (!usableAtLevel(id, level)) return false;
    if (difficulty === 'easy') return true;
    if (!fullyEvolved(data)) return false;
    if (difficulty === 'mid') return true;
    const total = bst(data);
    if (difficulty === 'hard') return total >= 470 && total < 580;
    return total >= 500;
  });
}

function diversePick(ranked, count) {
  const picked = [];
  const types = new Set();
  for (const id of ranked) {
    if (picked.length >= count) break;
    const t = speciesData(id).types;
    if (t.some((x) => types.has(x))) continue;
    picked.push(id);
    t.forEach((x) => types.add(x));
  }
  for (const id of ranked) if (picked.length < count && !picked.includes(id)) picked.push(id);
  return picked;
}

function counterScore(id, foes) {
  const data = speciesData(id);
  const me = { types: data.types };
  return foes.reduce((sum, f) => sum + speciesMatchup(me, { types: speciesData(f.finalID)?.types ?? ['normal'] }), 0) + bst(data) / 120;
}

export function buildAiTeam({ difficulty: requested, level, foes = [], random = Math.random }) {
  const difficulty = tactics(requested);
  const pool = candidates(difficulty, level);
  let ids;
  if (difficulty === 'easy' || difficulty === 'mid') ids = shuffled(pool, random).slice(0, PARTY_SIZE);
  else if (difficulty === 'hard') ids = diversePick(shuffled(pool, random).sort((a, b) => bst(speciesData(b)) * (0.8 + random() * 0.4) - bst(speciesData(a)) * (0.8 + random() * 0.4)), PARTY_SIZE);
  else {
    const ranked = pool.map((id) => ({ id, s: counterScore(id, foes) + random() * 1.5 })).sort((a, b) => b.s - a.s).map((x) => x.id);
    ids = diversePick(ranked, PARTY_SIZE);
  }
  return ids.map((id, index) => aiEntry(id, { level, difficulty, random, index }));
}

export function buildAiRandomParty({ level, random = Math.random }) {
  const ids = shuffled(aiPool().filter((id) => usableAtLevel(id, level)), random).slice(0, PARTY_SIZE);
  return ids.map((id, index) => randomize({ id: `ai-${index}-${id}`, finalID: id, baseID: id, rarity: rarityOf(speciesData(id)), shiny: false, level, ivs: { hp: 15, atk: 15, def: 15, satk: 15, sdef: 15, spd: 15 }, learned: [] }, random));
}

export function aiPicks({ difficulty: level, own, foes, random = Math.random }) {
  const difficulty = tactics(level);
  const order = own.map((_, i) => i);
  if (difficulty === 'easy' || difficulty === 'mid') return shuffled(order, random).slice(0, Math.min(BATTLE_SIZE, own.length));
  const typesOf = (e) => ({ types: speciesData(e.finalID)?.types ?? ['normal'] });
  const score = (i) => foes.reduce((sum, f) => sum + speciesMatchup(typesOf(own[i]), typesOf(f)), 0) + bst(speciesData(own[i].finalID) ?? { stats: [0] }) / 150 + (difficulty === 'hard' ? random() * 2 : 0);
  return order.map((i) => ({ i, s: score(i) })).sort((a, b) => b.s - a.s).slice(0, Math.min(BATTLE_SIZE, own.length)).map((x) => x.i);
}

function moveOf(f, idx) {
  return idx === STRUGGLE_MOVE ? STRUGGLE : f.moves[idx];
}

function typeEffect(move, target, knowsAbilities) {
  if (!move.type) return 1;
  let e = effectiveness(move.type, target.types);
  if (knowsAbilities && IMMUNE_BY_ABILITY[target.ability] === move.type) e = 0;
  return e;
}

function speedOf(f) {
  return f.stats.spd * stageMult(f.boosts?.spd) * (f.status === 'par' ? 0.5 : 1);
}

export function estimateDamage(b, attacker, target, move, knowsAbilities = true) {
  if (!move || move.kind === 'status' || move.category === 'status') return 0;
  const eff = typeEffect(move, target, knowsAbilities);
  if (eff === 0) return 0;
  if (move.ohko) return target.level > attacker.level ? 0 : target.hp * ((move.accuracy ?? 30) / 100);
  if (move.fixedDamage) return move.fixedDamage === 'level' ? attacker.level : Number(move.fixedDamage) || 0;
  const physical = move.category === 'physical';
  const a = (physical ? attacker.stats.atk : attacker.stats.satk) * stageMult(attacker.boosts?.[physical ? 'atk' : 'satk']);
  const d = (physical ? target.stats.def : target.stats.sdef) * stageMult(target.boosts?.[physical ? 'def' : 'sdef']);
  let power = move.power || 0;
  if (move.multihit) power *= (move.multihit[0] + move.multihit[1]) / 2;
  let dmg = (((2 * attacker.level) / 5 + 2) * power * (a / Math.max(1, d))) / 50 + 2;
  if (move.type && attacker.types.includes(move.type)) dmg *= attacker.ability === 'adaptability' ? 2 : 1.5;
  dmg *= eff * 0.925 * ((move.accuracy ?? 100) / 100);
  const w = b.field?.weather;
  if (w === 'sun' || w === 'harshsun') dmg *= move.type === 'fire' ? 1.5 : move.type === 'water' ? 0.5 : 1;
  if (w === 'rain' || w === 'heavyrain') dmg *= move.type === 'water' ? 1.5 : move.type === 'fire' ? 0.5 : 1;
  if (attacker.status === 'brn' && physical && attacker.ability !== 'guts') dmg *= 0.5;
  const screens = b.sides[b.sides.findIndex((s) => s.team.includes(target))]?.screens ?? {};
  if (screens.auroraveil || (physical ? screens.reflect : screens.lightscreen)) dmg *= 0.5;
  return dmg;
}

function bestDamage(b, attacker, target, knowsAbilities) {
  let best = 0;
  for (const m of attacker.moves) best = Math.max(best, estimateDamage(b, attacker, target, m, knowsAbilities));
  return best;
}

function statusImmune(target, status) {
  if (target.status) return true;
  return (STATUS_IMMUNE_TYPES[status] ?? []).some((t) => target.types.includes(t));
}

export function scoreMove(b, s, idx, knowsAbilities = true, deep = true) {
  const side = b.sides[s];
  const me = side.team[side.active];
  const foeSide = b.sides[1 - s];
  const foe = foeSide.team[foeSide.active];
  const move = moveOf(me, idx);
  if (!foe || foe.hp <= 0) return 1;
  if (move.kind !== 'status' && move.category !== 'status') {
    const dmg = estimateDamage(b, me, foe, move, knowsAbilities);
    if (dmg <= 0) return 0;
    let score = Math.min(1, dmg / foe.hp) * 100;
    if (deep) score = Math.max(score, 100 / Math.ceil(foe.hp / dmg));
    if (dmg >= foe.hp) {
      score += 60;
      const threatened = bestDamage(b, foe, me, knowsAbilities) >= me.hp;
      if (deep && move.priority > 0 && threatened && speedOf(foe) >= speedOf(me)) score += 45;
    }
    if (move.selfDestruct) score *= hpShare(me) < 0.3 ? 1 : 0.3;
    if (move.flags.includes('recharge') && dmg < foe.hp) score *= 0.6;
    return score;
  }
  const threat = bestDamage(b, foe, me, knowsAbilities) / me.hp;
  if (move.status) {
    if (statusImmune(foe, move.status)) return 0;
    if (move.status === 'par' && speedOf(foe) <= speedOf(me)) return 25;
    return STATUS_VALUE[move.status] ?? 30;
  }
  if (move.heal) return hpShare(me) < 0.5 ? 75 : hpShare(me) < 0.7 ? 30 : 0;
  if (move.screen) {
    if (side.screens?.[move.screen]) return 0;
    if (move.screen === 'auroraveil' && !['hail', 'snow'].includes(b.field.weather)) return 0;
    return threat > 0.25 ? 50 : 25;
  }
  if (move.weather || move.terrain) {
    if (move.weather && b.field.weather === move.weather) return 0;
    if (move.terrain && b.field.terrain === move.terrain) return 0;
    const helps = (move.weather === 'rain' && me.types.includes('water')) || (move.weather === 'sun' && me.types.includes('fire'));
    return helps ? 45 : 8;
  }
  if (move.boosts && move.target === 'self') {
    const ups = Object.entries(move.boosts).filter(([, v]) => v > 0);
    if (!ups.length || ups.every(([k]) => (me.boosts[k] ?? 0) >= 4)) return 0;
    if (hpShare(me) < 0.6 || threat >= 0.5) return 10;
    return 50 + ups.length * 8;
  }
  if (move.boosts) {
    const downs = Object.keys(move.boosts);
    return downs.every((k) => (foe.boosts[k] ?? 0) <= -2) ? 0 : 15;
  }
  if (move.volatile === 'leechseed') return foe.types.includes('grass') || foe.vol?.leechSeed ? 0 : 35;
  if (move.volatile === 'confusion') return foe.vol?.confusion ? 0 : 28;
  if (move.volatile === 'attract') return foe.vol?.attract ? 0 : 20;
  if (move.clearsScreens) return Object.keys(foeSide.screens ?? {}).length ? 40 : 5;
  return 5;
}

function matchupScore(b, mon, foe, knowsAbilities) {
  if (!foe || foe.hp <= 0) return hpShare(mon);
  const dealt = Math.min(1, bestDamage(b, mon, foe, knowsAbilities) / foe.hp);
  const taken = Math.min(1, bestDamage(b, foe, mon, knowsAbilities) / Math.max(1, mon.hp));
  const faster = speedOf(mon) > speedOf(foe) ? 0.15 : 0;
  return dealt - taken + faster + hpShare(mon) * 0.3;
}

function weighted(items, random) {
  const total = items.reduce((sum, x) => sum + x.w, 0);
  if (total <= 0) return pickOne(items, random).a;
  let r = random() * total;
  for (const x of items) {
    r -= x.w;
    if (r <= 0) return x.a;
  }
  return items[items.length - 1].a;
}

function sideValue(side) {
  return side.team.reduce((sum, f) => sum + (f.hp > 0 ? 0.35 + f.hp / f.stats.hp : 0), 0);
}

function evaluate(b, s) {
  if (b.status === 'finished') return b.winner === s ? 100 : b.winner === null ? 0 : -100;
  return sideValue(b.sides[s]) - sideValue(b.sides[1 - s]);
}

function simulate(b, s, mine, theirs, seed) {
  const { random, ...state } = b;
  const copy = structuredClone(state);
  copy.random = rng(seed);
  submit(copy, s, mine);
  if (theirs && needsAction(copy, 1 - s)) submit(copy, 1 - s, theirs);
  return evaluate(copy, s);
}

const SEARCH_SEEDS = 2;

function lookahead(b, s, options) {
  const theirs = validActions(b, 1 - s);
  const replies = theirs.length ? theirs : [null];
  let best = null;
  let bestValue = -Infinity;
  for (const mine of options) {
    const outcomes = replies.map((reply) => {
      let total = 0;
      for (let k = 0; k < SEARCH_SEEDS; k++) total += simulate(b, s, mine, reply, `${b.turn}:${k}:${JSON.stringify(mine)}:${JSON.stringify(reply)}`);
      return total / SEARCH_SEEDS;
    });
    const value = 0.6 * Math.min(...outcomes) + 0.4 * (outcomes.reduce((a, x) => a + x, 0) / outcomes.length);
    if (value > bestValue) [best, bestValue] = [mine, value];
  }
  return best;
}

function safeLookahead(b, s, options) {
  try {
    return lookahead(b, s, options);
  } catch {
    return null;
  }
}

export function chooseAction(b, s, level, random = Math.random) {
  const difficulty = tactics(level);
  const options = validActions(b, s);
  if (!options.length) return null;
  if (options.length === 1) return options[0];
  const side = b.sides[s];
  const me = side.team[side.active];
  const foe = b.sides[1 - s].team[b.sides[1 - s].active];
  const smart = difficulty === 'hard' || difficulty === 'veryhard';
  const moves = options.filter((o) => o.type === 'move');
  const switches = options.filter((o) => o.type === 'switch');

  if (!moves.length) {
    if (!smart) return pickOne(switches, random);
    return switches.map((a) => ({ a, s: matchupScore(b, side.team[a.to], foe, true) + (difficulty === 'hard' ? random() * 0.3 : 0) })).sort((x, y) => y.s - x.s)[0].a;
  }
  if (difficulty === 'easy') return pickOne(moves, random);
  if (difficulty === 'veryhard' && b.phase === 'choose' && foe && foe.hp > 0) {
    const chosen = safeLookahead(b, s, options);
    if (chosen) return chosen;
  }

  const veryhard = difficulty === 'veryhard';
  const scored = moves.map((a) => ({ a, s: scoreMove(b, s, a.move, veryhard, veryhard) }));
  if (difficulty === 'mid') {
    const useful = scored.filter((x) => x.s > 0);
    return weighted((useful.length ? useful : scored).map((x) => ({ a: x.a, w: x.s + 5 })), random);
  }

  scored.sort((x, y) => y.s - x.s);
  const best = scored[0];
  if (switches.length) {
    const canKo = foe && foe.hp > 0 && scored.some((x) => moveOf(me, x.a.move).kind !== 'status' && estimateDamage(b, me, foe, moveOf(me, x.a.move)) >= foe.hp);
    const doomed = foe && foe.hp > 0 && bestDamage(b, foe, me, true) >= me.hp && speedOf(foe) > speedOf(me);
    const stuck = best.s < 15;
    const lastSwitched = lastSwitchTurn.get(side) === b.turn - 1;
    const willing = veryhard ? true : random() < 0.35;
    if (!canKo && (veryhard ? doomed || stuck : stuck) && !lastSwitched && willing) {
      const here = matchupScore(b, me, foe, true);
      const alt = switches.map((a) => ({ a, s: matchupScore(b, side.team[a.to], foe, true) })).sort((x, y) => y.s - x.s)[0];
      if (alt.s > here + 0.35) {
        lastSwitchTurn.set(side, b.turn);
        return alt.a;
      }
    }
  }
  if (difficulty === 'hard' && scored.length > 1 && scored[1].s > 0 && scored[1].s >= best.s * 0.6 && random() < 0.25) return scored[1].a;
  return best.a;
}

// The AI: builds its team, picks its three, and chooses what to do each turn. Randomness is injected.
import { buildFighter, speciesData, formData, statsFor, effectiveness, usableMovepool, moveData, shuffled, rng, STRUGGLE, MOVES_PER_FIGHTER, type MoveData, type Random, type SpeciesData } from '../../catalog/domain/creatures.js';
import { DEX_LIMIT } from '../../catalog/domain/pokedex.js';
import type { Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { validActions, submit, needsAction, moveWillFail, BATTLE_SIZE, STRUGGLE_MOVE } from './battle.js';
import type { Action, BattleFighter, BattleSide, BattleState, MoveAction, SwitchAction } from './battle-types.js';
import { randomize } from './random-party.js';
import { PARTY_SIZE } from './team-preview.js';

type F = BattleFighter;
type B = BattleState;

export const AI_LEVELS = ['easy', 'mid', 'hard', 'veryhard', 'skynet'];

// Skynet's turns are decided by Jev (combat/infrastructure/jev/jev.ts). Everything else, and its fallback when Jev
// can't answer, is the very hard AI.
export const JEV_LEVEL = 'skynet';
const tactics = (difficulty: string): string => (difficulty === JEV_LEVEL ? 'veryhard' : difficulty);
export const AI_PREFIX = 'ai:';
export const LAST_AI_SPECIES = DEX_LIMIT;

export const aiTrainerId = (level: string): string => `${AI_PREFIX}${level}`;
export const aiLevelOf = (trainerId: unknown): string | null => (typeof trainerId === 'string' && trainerId.startsWith(AI_PREFIX) ? trainerId.slice(AI_PREFIX.length).split('#')[0] : null);

const IMMUNE_BY_ABILITY: Record<string, string> = {
  levitate: 'ground', 'volt-absorb': 'electric', 'lightning-rod': 'electric', 'motor-drive': 'electric', 'water-absorb': 'water',
  'storm-drain': 'water', 'dry-skin': 'water', 'flash-fire': 'fire', 'sap-sipper': 'grass',
};
const STATUS_IMMUNE_TYPES: Record<string, string[]> = { par: ['electric'], brn: ['fire'], psn: ['poison', 'steel'], tox: ['poison', 'steel'], frz: ['ice'], slp: [] };
const STATUS_VALUE: Record<string, number> = { slp: 70, par: 55, tox: 52, psn: 35, brn: 48, frz: 40 };

const lastSwitchTurn = new WeakMap<BattleSide, number>();
const pickOne = <T>(list: readonly T[], random: Random): T => list[Math.floor(random() * list.length)];
const stageMult = (s = 0): number => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const bst = (data: { stats: readonly number[] }): number => data.stats.reduce((a, b) => a + b, 0);
const fullyEvolved = (data: SpeciesData): boolean => data.chainLen == null || data.stage == null || data.stage >= data.chainLen - 1;
const hpShare = (f: F): number => f.hp / f.stats.hp;

function rarityOf(data: SpeciesData): Rarity {
  const total = bst(data);
  return total >= 580 ? 'legendary' : total >= 500 ? 'rare' : total >= 400 ? 'uncommon' : 'common';
}

export function aiPool(): number[] {
  const ids: number[] = [];
  for (let id = 1; id <= LAST_AI_SPECIES; id++) if (speciesData(id)) ids.push(id);
  return ids;
}

function moveValue(m: MoveData, mon: { types: string[]; stats: { atk: number; satk: number } }): number {
  if (!m.supported) return 0;
  if (m.kind === 'status') {
    const ups = (Object.entries(m.boosts ?? {}) as [string, number][]).filter(([k, v]) => v > 0 && m.target === 'self' && ['atk', 'satk', 'spd'].includes(k)).length;
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

export function pickMoveset(entry: RosterEntry, difficulty: string, random: Random): string[] {
  const pool = usableMovepool(entry);
  if (difficulty === 'easy' || pool.length <= MOVES_PER_FIGHTER) return shuffled(pool, random).slice(0, MOVES_PER_FIGHTER);
  const mon = buildFighter({ ...entry, moveset: pool.slice(0, 1) });
  const scored = pool.map((id) => ({ id, m: moveData(id) as MoveData })).map((x) => ({ ...x, v: moveValue(x.m, mon) * (difficulty === 'mid' ? 0.75 + random() * 0.5 : 1) }));
  if (difficulty === 'mid') return scored.sort((a, b) => b.v - a.v).slice(0, MOVES_PER_FIGHTER).map((x) => x.id);
  const maxStatus = difficulty === 'veryhard' ? 2 : 1;
  const chosen: typeof scored = [];
  while (chosen.length < MOVES_PER_FIGHTER) {
    const types = new Set(chosen.filter((x) => x.m.kind === 'attack').map((x) => x.m.type));
    const statusCount = chosen.filter((x) => x.m.kind === 'status').length;
    const attacks = chosen.length - statusCount;
    let best: (typeof scored)[number] | null = null;
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

function usableAtLevel(id: number, level: number): boolean {
  return usableMovepool({ id: 'probe', finalID: id, level, learned: [] }).some((k) => (moveData(k) as MoveData).kind === 'attack');
}

export const AI_POOL_SHARE: Record<string, number> = { easy: 1, mid: 0.8, hard: 0.6, veryhard: 0.5, skynet: 0.4 };

const DICE_IVS = { hp: 15, atk: 15, def: 15, satk: 15, sdef: 15, spd: 15 };

function diceEntry(id: number, { level, random, index }: { level: number; random: Random; index: number }): RosterEntry {
  return randomize({ id: `ai-${index}-${id}`, finalID: id, baseID: id, rarity: rarityOf(speciesData(id) as SpeciesData), shiny: false, level, ivs: DICE_IVS, learned: [] }, random);
}

export function aiTeamPool(difficulty: string, level: number): number[] {
  const ranked = aiPool()
    .filter((id) => fullyEvolved(speciesData(id) as SpeciesData) && usableAtLevel(id, level))
    .sort((a, b) => bst(speciesData(b) as SpeciesData) - bst(speciesData(a) as SpeciesData) || a - b);
  const size = Math.max(PARTY_SIZE, Math.ceil(ranked.length * (AI_POOL_SHARE[difficulty] ?? 1)));
  return ranked.slice(0, size);
}

export function buildAiTeam({ difficulty, level, random = Math.random }: { difficulty: string; level: number; random?: Random }): RosterEntry[] {
  const ids = shuffled(aiTeamPool(difficulty, level), random).slice(0, PARTY_SIZE);
  return ids.map((id, index) => diceEntry(id, { level, random, index }));
}

export function buildAiRandomParty({ level, random = Math.random }: { level: number; random?: Random }): RosterEntry[] {
  const ids = shuffled(aiTeamPool('easy', level), random).slice(0, PARTY_SIZE);
  return ids.map((id, index) => diceEntry(id, { level, random, index }));
}

// The three for the battle are picked on a hunch, without looking at the rival's party: easier
// AIs at random, harder ones leaning towards their strongest.
export function aiPicks({ difficulty: level, own, random = Math.random }: { difficulty: string; own: RosterEntry[]; random?: Random }): number[] {
  const difficulty = tactics(level);
  const order = own.map((_, i) => i);
  const count = Math.min(BATTLE_SIZE, own.length);
  if (difficulty === 'easy' || difficulty === 'mid') return shuffled(order, random).slice(0, count);
  const strength = (i: number) => bst(speciesData(own[i].finalID) ?? { stats: [0] }) / 150;
  return order.map((i) => ({ i, s: strength(i) + random() * 2 })).sort((a, b) => b.s - a.s).slice(0, count).map((x) => x.i);
}

// ---------- what the AI may know ----------
// The AI decides on its belief of the battle, built only from what a human on its side sees:
// the rival's revealed moves and ability, its HP as a percentage, and its Pokémon once they've
// been out. The rest is a guess from the species, never the real thing. Its pending choice is
// never there.

const GUESS_IV = 15;
const GUESS_IVS = { hp: GUESS_IV, atk: GUESS_IV, def: GUESS_IV, satk: GUESS_IV, sdef: GUESS_IV, spd: GUESS_IV };
const guesses = new Map<string, MoveData[]>();

// The moves a seasoned player would expect from that species at that level.
function expectedMoves(speciesId: number, level: number): MoveData[] {
  const key = `${speciesId}:${level}`;
  if (!guesses.has(key)) {
    let moves: MoveData[] = [];
    try {
      const probe = { id: `guess-${speciesId}`, finalID: speciesId, baseID: speciesId, level, ivs: GUESS_IVS, learned: [] } as unknown as RosterEntry;
      moves = pickMoveset(probe, 'hard', () => 0.5).map(moveData) as MoveData[];
    } catch {
      moves = [];
    }
    guesses.set(key, moves);
  }
  return guesses.get(key)!;
}

function believedFoe(f: F): F {
  if (!f.seen) return f;
  const look = f.vol.illusion ?? f.seenAs;
  let moves = f.moves;
  let vol = f.vol;
  if (!f.vol.transformed) {
    // Revealed moves keep their slot; the unknown ones become guesses (or go, if there are none).
    const known = (m: MoveData) => f.revealedMoves.has(m.key);
    const extra = expectedMoves(f.speciesId, f.level).filter((g) => !f.moves.some((m) => known(m) && m.key === g.key));
    const slots = f.moves.map((m) => (known(m) ? m : extra.shift()));
    moves = slots.filter(Boolean) as MoveData[];
    const slotOf = (i: number | null | undefined) => (i == null || !slots[i] ? undefined : moves.indexOf(slots[i]));
    vol = { ...f.vol, charging: slotOf(f.vol.charging), mustRecharge: slotOf(f.vol.mustRecharge) };
    for (const k of ['charging', 'mustRecharge']) if (vol[k] === undefined) delete vol[k];
  }
  const base = f.form ? formData(f.form)?.base : speciesData(f.speciesId)?.stats;
  const stats = f.vol.transformed || !base ? { ...f.stats } : statsFor(base, GUESS_IVS, f.level);
  const share = f.hp / f.stats.hp;
  const ability = f.revealedAbilities.has(f.ability) ? f.ability : null;
  return {
    ...f,
    types: look?.types ?? f.types,
    stats,
    hp: f.hp > 0 ? Math.max(1, Math.round(stats.hp * share)) : 0,
    moves,
    vol,
    pp: Object.fromEntries(moves.map((m) => [m.key, m.pp])),
    ability,
    baseAbility: ability,
  };
}

export function beliefOf(b: B, s: number): B {
  const { random, ...state } = b;
  const copy = structuredClone(state) as B;
  const theirs = copy.sides[1 - s];
  theirs.action = null;
  theirs.team = theirs.team.map(believedFoe);
  return copy;
}

function moveOf(f: F, idx: number): MoveData {
  return idx === STRUGGLE_MOVE ? STRUGGLE : f.moves[idx];
}

function typeEffect(move: MoveData, target: F, knowsAbilities: boolean): number {
  if (!move.type) return 1;
  let e = effectiveness(move.type, target.types);
  if (knowsAbilities && IMMUNE_BY_ABILITY[target.ability as string] === move.type) e = 0;
  return e;
}

function speedOf(f: F): number {
  return f.stats.spd * stageMult(f.boosts?.spd) * (f.status === 'par' ? 0.5 : 1);
}

export function estimateDamage(b: B, attacker: F, target: F, move: MoveData | null | undefined, knowsAbilities = true): number {
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
  const screens: Record<string, number> = b.sides[b.sides.findIndex((s) => s.team.includes(target))]?.screens ?? {};
  if (screens.auroraveil || (physical ? screens.reflect : screens.lightscreen)) dmg *= 0.5;
  return dmg;
}

function bestDamage(b: B, attacker: F, target: F, knowsAbilities: boolean): number {
  let best = 0;
  for (const m of attacker.moves) best = Math.max(best, estimateDamage(b, attacker, target, m, knowsAbilities));
  return best;
}

function statusImmune(target: F, status: string): boolean {
  if (target.status) return true;
  return (STATUS_IMMUNE_TYPES[status] ?? []).some((t) => target.types.includes(t));
}

export function scoreMove(b: B, s: number, idx: number, knowsAbilities = true, deep = true): number {
  const side = b.sides[s];
  const me = side.team[side.active];
  const foeSide = b.sides[1 - s];
  const foe = foeSide.team[foeSide.active];
  const move = moveOf(me, idx);
  if (!foe || foe.hp <= 0) return 1;
  if (moveWillFail(b, s, idx)) return 0;
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
    if (move.screen === 'auroraveil' && !['hail', 'snow'].includes(b.field.weather as string)) return 0;
    return threat > 0.25 ? 50 : 25;
  }
  if (move.weather || move.terrain) {
    if (move.weather && b.field.weather === move.weather) return 0;
    if (move.terrain && b.field.terrain === move.terrain) return 0;
    const helps = (move.weather === 'rain' && me.types.includes('water')) || (move.weather === 'sun' && me.types.includes('fire'));
    return helps ? 45 : 8;
  }
  if (move.boosts && move.target === 'self') {
    const ups = (Object.entries(move.boosts) as [keyof F['boosts'], number][]).filter(([, v]) => v > 0);
    if (!ups.length || ups.every(([k]) => (me.boosts[k] ?? 0) >= 4)) return 0;
    if (hpShare(me) < 0.6 || threat >= 0.5) return 10;
    return 50 + ups.length * 8;
  }
  if (move.boosts) {
    const downs = Object.keys(move.boosts) as (keyof F['boosts'])[];
    return downs.every((k) => (foe.boosts[k] ?? 0) <= -2) ? 0 : 15;
  }
  if (move.volatile === 'leechseed') return foe.types.includes('grass') || foe.vol?.leechSeed ? 0 : 35;
  if (move.volatile === 'confusion') return foe.vol?.confusion ? 0 : 28;
  if (move.volatile === 'attract') return foe.vol?.attract ? 0 : 20;
  if (move.clearsScreens) return Object.keys(foeSide.screens ?? {}).length ? 40 : 5;
  return 5;
}

function matchupScore(b: B, mon: F, foe: F | null | undefined, knowsAbilities: boolean): number {
  if (!foe || foe.hp <= 0) return hpShare(mon);
  const dealt = Math.min(1, bestDamage(b, mon, foe, knowsAbilities) / foe.hp);
  const taken = Math.min(1, bestDamage(b, foe, mon, knowsAbilities) / Math.max(1, mon.hp));
  const faster = speedOf(mon) > speedOf(foe) ? 0.15 : 0;
  return dealt - taken + faster + hpShare(mon) * 0.3;
}

function weighted<T>(items: { a: T; w: number }[], random: Random): T {
  const total = items.reduce((sum, x) => sum + x.w, 0);
  if (total <= 0) return pickOne(items, random).a;
  let r = random() * total;
  for (const x of items) {
    r -= x.w;
    if (r <= 0) return x.a;
  }
  return items[items.length - 1].a;
}

function sideValue(side: BattleSide): number {
  return side.team.reduce((sum, f) => sum + (f.hp > 0 ? 0.35 + f.hp / f.stats.hp : 0), 0);
}

function evaluate(b: B, s: number): number {
  if (b.status === 'finished') return b.winner === s ? 100 : b.winner === null ? 0 : -100;
  return sideValue(b.sides[s]) - sideValue(b.sides[1 - s]);
}

function simulate(b: B, s: number, mine: Action, theirs: Action | null, seed: string): number {
  const { random, ...state } = b;
  const copy = structuredClone(state) as B;
  copy.random = rng(seed);
  submit(copy, s, mine);
  if (theirs && needsAction(copy, 1 - s)) submit(copy, 1 - s, theirs);
  return evaluate(copy, s);
}

const SEARCH_SEEDS = 2;

function lookahead(b: B, s: number, options: Action[]): Action | null {
  const rival = b.sides[1 - s].team;
  const theirs = validActions(b, 1 - s).filter((a) => a.type !== 'switch' || rival[a.to].seen);
  const replies: (Action | null)[] = theirs.length ? theirs : [null];
  let best: Action | null = null;
  let bestValue = -Infinity;
  for (const mine of options) {
    const outcomes = replies.map((reply) => {
      let total = 0;
      for (let k = 0; k < SEARCH_SEEDS; k++) total += simulate(b, s, mine, reply, `${b.turn}:${k}:${JSON.stringify(mine)}:${JSON.stringify(reply)}`);
      return total / SEARCH_SEEDS;
    });
    // When every line looks the same (say, lost either way), the plain move score breaks the tie.
    const tiebreak = mine.type === 'move' ? scoreMove(b, s, mine.move) / 1e4 : 0;
    const value = 0.6 * Math.min(...outcomes) + 0.4 * (outcomes.reduce((a, x) => a + x, 0) / outcomes.length) + tiebreak;
    if (value > bestValue) [best, bestValue] = [mine, value];
  }
  return best;
}

function safeLookahead(b: B, s: number, options: Action[]): Action | null {
  try {
    return lookahead(b, s, options);
  } catch {
    return null;
  }
}

export function chooseAction(battle: B, s: number, level: string, random: Random = Math.random): Action | null {
  const difficulty = tactics(level);
  const options = validActions(battle, s);
  if (!options.length) return null;
  if (options.length === 1) return options[0];
  const b = beliefOf(battle, s);
  const side = b.sides[s];
  const memory = battle.sides[s];
  const me = side.team[side.active];
  const foe = b.sides[1 - s].team[b.sides[1 - s].active];
  const smart = difficulty === 'hard' || difficulty === 'veryhard';
  const moves = options.filter((o): o is MoveAction => o.type === 'move');
  const switches = options.filter((o): o is SwitchAction => o.type === 'switch');

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
    const lastSwitched = lastSwitchTurn.get(memory) === b.turn - 1;
    const willing = veryhard ? true : random() < 0.35;
    if (!canKo && (veryhard ? doomed || stuck : stuck) && !lastSwitched && willing) {
      const here = matchupScore(b, me, foe, true);
      const alt = switches.map((a) => ({ a, s: matchupScore(b, side.team[a.to], foe, true) })).sort((x, y) => y.s - x.s)[0];
      if (alt.s > here + 0.35) {
        lastSwitchTurn.set(memory, b.turn);
        return alt.a;
      }
    }
  }
  if (difficulty === 'hard' && scored.length > 1 && scored[1].s > 0 && scored[1].s >= best.s * 0.6 && random() < 0.25) return scored[1].a;
  return best.a;
}

// What you can take after a floor, like the item shop between waves of PokeRogue: offers of three
// rarities, each telling every Pokémon of the party whether it fits and why. Machines and tutors teach
// a move, vitamins add EVs, a Mint changes the nature, a Capsule or a Patch unlocks an ability, Rare and
// Exp. Candies give levels up to the floor's cap, an evolution stone evolves now a Pokémon whose
// evolution has no level, and a Lucky Egg brings a recruit of your collection.
import { abilityOptions, moveOrigins, NATURE_KEYS, shuffled, speciesData, type Random } from '../../catalog/domain/creatures.js';
import type { Ivs } from '../../catalog/domain/roster-entry.js';
import { moveData } from '../../combat/domain/moves.js';
import { alwaysDamages } from '../../combat/domain/random-party.js';
import { evolutionLevel, evolutionPath } from './growth.js';

export const REWARD_KINDS = ['candy', 'expCandy', 'vitamin', 'tm', 'tutor', 'mint', 'capsule', 'patch', 'stone', 'egg'] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];
export type RewardTier = 'common' | 'rare' | 'epic';
export type StatKey = keyof Ivs;

export const REWARD_TIERS: Record<RewardKind, RewardTier> = {
  candy: 'common',
  expCandy: 'common',
  vitamin: 'common',
  tm: 'rare',
  tutor: 'rare',
  mint: 'rare',
  capsule: 'rare',
  patch: 'epic',
  stone: 'epic',
  egg: 'epic',
};

export interface Reward {
  id: string;
  kind: RewardKind;
  tier: RewardTier;
  move?: string;
  levels?: number;
  stat?: StatKey;
  /** The party members that can take it (a move only fits those that can learn it). */
  fits: string[];
  /** Why it fits or not, for each party member. */
  reasons: Record<string, string>;
}

export interface RewardTarget {
  uid: string;
  speciesId: number;
  finalId: number;
  level: number;
  known: readonly string[];
  abilities: readonly string[];
  evs: Ivs;
}

export interface RestContext {
  floor: number;
  boss: boolean;
  cap: number;
  /** The rarest tier one of the offers must reach (a boss or a tough room promise more). */
  minTier: RewardTier;
  /** The highest tier allowed (a calm room only gives common ones). */
  maxTier?: RewardTier;
  recruitable: boolean;
  count?: number;
}

export const REWARDS_PER_REST = 3;
export const VITAMIN_EVS = 32;
export const MAX_STAT_EVS = 252;
export const MAX_TOTAL_EVS = 510;
export const STONE_REACH = 6;
const CANDY_LEVELS = 2;
const BOSS_CANDY_LEVELS = 3;
const USEFUL_POWER = 60;
const MAX_ATTEMPTS = 40;
const TIER_WEIGHTS: Record<RewardTier, number> = { common: 55, rare: 35, epic: 10 };
export const TIER_ORDER: readonly RewardTier[] = ['common', 'rare', 'epic'];
export const STATS: readonly StatKey[] = ['hp', 'atk', 'def', 'satk', 'sdef', 'spd'];
const STAT_NAMES: Record<StatKey, string> = { hp: 'PS', atk: 'Ataque', def: 'Defensa', satk: 'At. Esp.', sdef: 'Def. Esp.', spd: 'Velocidad' };

const teachable = (target: RewardTarget, origins: readonly string[]): string[] =>
  [...moveOrigins({ finalID: target.speciesId })]
    .filter(([id, origin]) => origins.includes(origin.origin) && !target.known.includes(id) && moveData(id)?.supported)
    .map(([id]) => id);

const useful = (id: string): boolean => {
  const move = moveData(id);
  if (!move) return false;
  if (alwaysDamages(id)) return move.power >= USEFUL_POWER;
  const raisesOwnStats = move.target === 'self' && Object.values(move.boosts ?? {}).some((stages) => stages > 0);
  return raisesOwnStats || !!(move.heal || move.status || move.screen);
};

const totalEvs = (evs: Ivs): number => STATS.reduce((sum, stat) => sum + (evs[stat] ?? 0), 0);

/** How many EVs a vitamin adds to a stat: 32, or what is left under 252 for the stat and 510 in all. */
export const vitaminRoom = (evs: Ivs, stat: StatKey): number => Math.max(0, Math.min(VITAMIN_EVS, MAX_STAT_EVS - (evs[stat] ?? 0), MAX_TOTAL_EVS - totalEvs(evs)));

/** The next form towards the one you raised, when it evolves by a stone, a trade or friendship and is close to its fair level. */
export function stoneEvolution(target: Pick<RewardTarget, 'speciesId' | 'finalId' | 'level'>): number | null {
  const path = evolutionPath(target.finalId);
  const next = path[path.indexOf(target.speciesId) + 1];
  if (!next || speciesData(next)?.evolvesAt) return null;
  const level = evolutionLevel(next);
  return level !== null && target.level >= level - STONE_REACH ? next : null;
}

export const lockedAbilities = (target: Pick<RewardTarget, 'speciesId' | 'abilities'>, hidden: boolean): string[] =>
  abilityOptions({ finalID: target.speciesId })
    .filter((option) => option.hidden === hidden && !target.abilities.includes(option.key))
    .map((option) => option.key);

function judged(party: readonly RewardTarget[], fitsWhy: (target: RewardTarget) => string | null, whyNot: (target: RewardTarget) => string) {
  const reasons: Record<string, string> = {};
  const fits: string[] = [];
  for (const target of party) {
    const why = fitsWhy(target);
    if (why) fits.push(target.uid);
    reasons[target.uid] = why ?? whyNot(target);
  }
  return { fits, reasons };
}

function makeReward(kind: RewardKind, party: readonly RewardTarget[], context: RestContext, random: Random): Reward | null {
  const { floor, boss, cap, recruitable } = context;
  const base = { id: `${floor}:${kind}`, kind, tier: REWARD_TIERS[kind] };
  const atCap = () => `Ya está en el tope (Nv ${cap})`;
  switch (kind) {
    case 'candy': {
      const levels = boss ? BOSS_CANDY_LEVELS : CANDY_LEVELS;
      const judgement = judged(party, (target) => (target.level < cap ? `Nv ${target.level} → ${Math.min(cap, target.level + levels)}` : null), atCap);
      return judgement.fits.length ? { ...base, levels, ...judgement } : null;
    }
    case 'expCandy': {
      const judgement = judged(party, (target) => (target.level < cap ? `Nv ${target.level} → ${target.level + 1}` : null), atCap);
      return judgement.fits.length >= 2 ? { ...base, levels: 1, ...judgement } : null;
    }
    case 'vitamin': {
      const stat = STATS[Math.floor(random() * STATS.length)];
      const judgement = judged(
        party,
        (target) => {
          const room = vitaminRoom(target.evs, stat);
          return room ? `${STAT_NAMES[stat]}: ${target.evs[stat] ?? 0} → ${(target.evs[stat] ?? 0) + room} EVs` : null;
        },
        (target) => (totalEvs(target.evs) >= MAX_TOTAL_EVS ? `Ya tiene ${MAX_TOTAL_EVS} EVs` : `${STAT_NAMES[stat]} ya tiene ${MAX_STAT_EVS} EVs`),
      );
      return judgement.fits.length ? { ...base, id: `${base.id}:${stat}`, stat, ...judgement } : null;
    }
    case 'tm':
    case 'tutor': {
      const origins = kind === 'tm' ? ['machine'] : ['tutor', 'egg'];
      const move = shuffled([...new Set(party.flatMap((target) => teachable(target, origins)))].filter(useful), random)[0];
      if (!move) return null;
      const judgement = judged(party, (target) => (teachable(target, origins).includes(move) ? 'Puede aprenderlo' : null), (target) => (target.known.includes(move) ? 'Ya lo conoce' : 'No lo aprende'));
      return { ...base, id: `${base.id}:${move}`, move, ...judgement };
    }
    case 'mint':
      return { ...base, ...judged(party, () => 'Cambia su naturaleza', () => '') };
    case 'capsule':
    case 'patch': {
      const hidden = kind === 'patch';
      const judgement = judged(
        party,
        (target) => {
          const locked = lockedAbilities(target, hidden);
          return locked.length ? (locked.length === 1 ? 'Desbloquea 1 habilidad' : `Desbloquea ${locked.length} habilidades`) : null;
        },
        () => (hidden ? 'No tiene habilidad oculta por abrir' : 'Ya tiene sus habilidades'),
      );
      return judgement.fits.length ? { ...base, ...judgement } : null;
    }
    case 'stone': {
      const judgement = judged(
        party,
        (target) => {
          const next = stoneEvolution(target);
          return next ? `Evoluciona en ${speciesData(next)?.name ?? '?'} ya (normalmente Nv ${evolutionLevel(next)})` : null;
        },
        () => 'No evoluciona así o aún le falta',
      );
      return judgement.fits.length ? { ...base, ...judgement } : null;
    }
    case 'egg':
      return recruitable ? { ...base, fits: party.map((target) => target.uid), reasons: {} } : null;
  }
}

/** Three offers by weighted rarity, at least one of `minTier` and none above `maxTier`. */
export function restRewards(party: readonly RewardTarget[], context: RestContext, random: Random): Reward[] {
  const count = context.count ?? REWARDS_PER_REST;
  const maxIndex = TIER_ORDER.indexOf(context.maxTier ?? 'epic');
  const minIndex = Math.min(TIER_ORDER.indexOf(context.minTier), maxIndex);
  const rewards: Reward[] = [];
  const tried = new Set<RewardKind>();
  for (let attempt = 0; rewards.length < count && attempt < MAX_ATTEMPTS; attempt++) {
    const lastSlot = rewards.length === count - 1;
    const promised = rewards.some((reward) => TIER_ORDER.indexOf(reward.tier) >= minIndex);
    const tiers = TIER_ORDER.filter((_, i) => i <= maxIndex && (promised || !lastSlot || i >= minIndex));
    const open = tiers.filter((tier) => REWARD_KINDS.some((kind) => REWARD_TIERS[kind] === tier && !tried.has(kind)));
    if (!open.length) break;
    let roll = random() * open.reduce((sum, tier) => sum + TIER_WEIGHTS[tier], 0);
    const tier = open.find((option) => (roll -= TIER_WEIGHTS[option]) <= 0) ?? open[0];
    const kinds = REWARD_KINDS.filter((kind) => REWARD_TIERS[kind] === tier && !tried.has(kind));
    const kind = kinds[Math.floor(random() * kinds.length)];
    tried.add(kind);
    const reward = makeReward(kind, party, context, random);
    if (reward) rewards.push(reward);
  }
  return rewards;
}

export const isNature = (key: string): boolean => (NATURE_KEYS as readonly string[]).includes(key);

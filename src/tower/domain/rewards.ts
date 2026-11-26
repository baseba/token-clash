import { abilityOptions, moveOrigins, NATURE_KEYS, natureInfo, speciesData, statsFor } from '../../catalog/domain/creatures.js';
import { shuffled, type Random } from '../../shared/domain/random.js';
import type { Ivs } from '../../catalog/domain/roster-entry.js';
import type { TwistKey } from '../../catalog/domain/tower-cast.js';
import { HELD_ITEMS, boosterOf, type ItemTier } from '../../catalog/domain/held-items.js';
import { moveData } from '../../combat/domain/moves.js';
import { alwaysDamages } from '../../combat/domain/random-party.js';
import { evolutionLevel, evolutionPath, formAtLevel, levelMovesUpTo } from './growth.js';

export const REWARD_KINDS = [
  'candy', 'expCandy', 'vitamin', 'feather', 'mushroom', 'gem', 'weights', 'idealMint', 'expShare',
  'tm', 'tutor', 'eggMove', 'memory', 'supportTm', 'quickClaw', 'mint', 'capsule', 'bottleCap', 'machoBrace', 'vitaminBag', 'shinyCharm',
  'patch', 'stone', 'goldCap', 'powerTm', 'teraShard', 'candyJar', 'linkingCord', 'egg', 'goldenEgg',
  'commonItem', 'rareItem', 'epicItem',
] as const;
export type RewardKind = (typeof REWARD_KINDS)[number];
export type RewardTier = 'common' | 'rare' | 'epic';
export type StatKey = keyof Ivs;

export const REWARD_TIERS: Record<RewardKind, RewardTier> = {
  candy: 'common',
  expCandy: 'common',
  vitamin: 'common',
  feather: 'common',
  mushroom: 'common',
  gem: 'common',
  weights: 'common',
  idealMint: 'common',
  expShare: 'common',
  tm: 'rare',
  tutor: 'rare',
  eggMove: 'rare',
  memory: 'rare',
  supportTm: 'rare',
  quickClaw: 'rare',
  mint: 'rare',
  capsule: 'rare',
  bottleCap: 'rare',
  machoBrace: 'rare',
  vitaminBag: 'rare',
  shinyCharm: 'rare',
  patch: 'epic',
  goldCap: 'epic',
  stone: 'epic',
  powerTm: 'epic',
  teraShard: 'epic',
  candyJar: 'epic',
  linkingCord: 'epic',
  egg: 'epic',
  goldenEgg: 'epic',
  commonItem: 'common',
  rareItem: 'rare',
  epicItem: 'epic',
};

export const ITEM_REWARDS: Readonly<Partial<Record<RewardKind, ItemTier>>> = { commonItem: 'common', rareItem: 'rare', epicItem: 'epic' };

export const PARTY_REWARDS: readonly RewardKind[] = ['egg', 'goldenEgg', 'feather', 'expShare', 'candyJar'];
export const MOVE_REWARDS: readonly RewardKind[] = ['tm', 'tutor', 'eggMove', 'powerTm', 'mushroom', 'memory', 'gem', 'supportTm', 'quickClaw', 'teraShard'];
export const LEVEL_REWARDS: readonly RewardKind[] = ['candy', 'expCandy', 'expShare', 'candyJar'];

export interface Reward {
  id: string;
  kind: RewardKind;
  tier: RewardTier;
  move?: string;
  levels?: number;
  stat?: StatKey;
  natures?: Record<string, string>;
  item?: string;
  fits: string[];
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
  ivs: Ivs;
  nature: string | null;
  shiny: boolean;
  item?: string | null;
}

export interface RestContext {
  floor: number;
  boss: boolean;
  cap: number;
  minTier: RewardTier;
  maxTier?: RewardTier;
  recruitable: boolean;
  count?: number;
  extra?: number;
  favored?: readonly RewardKind[];
  candyBonus?: number;
}

export const TWIST_REWARDS: Partial<Record<TwistKey, Partial<RestContext>>> = {
  market: { extra: 1 },
  tutors: { favored: MOVE_REWARDS },
  sweet: { favored: LEVEL_REWARDS, candyBonus: 1 },
  caps: { favored: ['bottleCap', 'goldCap', 'weights'] },
  items: { favored: ['commonItem', 'rareItem', 'epicItem', 'quickClaw'] },
  meteor: { favored: ['stone', 'linkingCord', 'candyJar'] },
  breeding: { favored: ['egg', 'goldenEgg', 'eggMove'] },
  training: { favored: ['vitamin', 'feather', 'idealMint', 'mint', 'machoBrace', 'vitaminBag'] },
};
const FAVORED_CHANCE = 0.7;

export const REWARDS_PER_REST = 3;
export const VITAMIN_EVS = 64;
export const FEATHER_EVS = 24;
export const BRACE_EVS = 32;
export const WEIGHTS_IVS = 8;
const SHARE_LEVELS = 1;
const JAR_LEVELS = 3;
export const CORD_REACH = 5;
const LIGHT_MOVE = 75;
const TERA_MOVE = 80;
const FAST_SPEED = 80;
export const MUSHROOM_REACH = 10;
const POWERFUL_MOVE = 90;
const MORE_REWARDS_FROM = 25;
export const MAX_STAT_EVS = 252;
export const MAX_TOTAL_EVS = 510;
export const STONE_REACH = 6;
export const MAX_IV = 31;
const CANDY_LEVELS = 2;
const BOSS_CANDY_LEVELS = 3;
const USEFUL_POWER = 60;
const MAX_ATTEMPTS = 40;
const tierWeights = (floor: number): Record<RewardTier, number> => ({ common: Math.max(30, 55 - floor * 0.6), rare: 35, epic: Math.min(25, 10 + floor * 0.3) });
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

const power = (id: string): number => moveData(id)?.power ?? 0;
const ANY_ORIGIN = ['level', 'machine', 'tutor', 'egg'];
const MOVE_ORIGINS: Partial<Record<RewardKind, readonly string[]>> = { tm: ['machine'], powerTm: ['machine'], tutor: ['tutor'], eggMove: ['egg'], supportTm: ['machine', 'tutor'] };

function teachableBy(kind: RewardKind, target: RewardTarget): string[] {
  if (kind === 'mushroom') return levelMovesUpTo(target.speciesId, target.level + MUSHROOM_REACH).filter((id) => !target.known.includes(id));
  const moves = teachable(target, MOVE_ORIGINS[kind] ?? ANY_ORIGIN);
  const ownTypes = speciesData(target.speciesId)?.types ?? [];
  const attacks = moves.filter(alwaysDamages);
  const ofOwnType = (id: string) => ownTypes.includes(moveData(id)?.type ?? '');
  switch (kind) {
    case 'powerTm':
      return attacks.filter((id) => power(id) >= POWERFUL_MOVE);
    case 'tm':
      return moves.filter((id) => !alwaysDamages(id) || power(id) < POWERFUL_MOVE);
    case 'supportTm':
      return moves.filter((id) => !alwaysDamages(id));
    case 'memory':
      return attacks.filter((id) => !ofOwnType(id) && power(id) >= USEFUL_POWER);
    case 'gem':
      return attacks.filter((id) => !ofOwnType(id) && power(id) > 0 && power(id) <= LIGHT_MOVE);
    case 'quickClaw':
      return attacks.filter((id) => (moveData(id)?.priority ?? 0) > 0);
    case 'teraShard':
      return attacks.filter((id) => ofOwnType(id) && power(id) >= TERA_MOVE);
    default:
      return moves;
  }
}

const worthTeaching = (kind: RewardKind, id: string): boolean => (kind === 'gem' || kind === 'quickClaw' ? alwaysDamages(id) : useful(id));

export function idealNature(speciesId: number): string {
  const [, attack, , specialAttack, , speed] = speciesData(speciesId)?.stats ?? [0, 0, 0, 0, 0, 0];
  const physical = attack >= specialAttack;
  const fast = speed >= FAST_SPEED;
  return physical ? (fast ? 'jolly' : 'adamant') : fast ? 'timid' : 'modest';
}

export const attackStat = (speciesId: number): StatKey => {
  const [, attack, , specialAttack] = speciesData(speciesId)?.stats ?? [0, 0, 0, 0];
  return attack >= specialAttack ? 'atk' : 'satk';
};

export function evsAfter(kind: RewardKind, evs: Ivs, speciesId: number, stat: StatKey | undefined): Ivs {
  const plan: [StatKey, number][] =
    kind === 'machoBrace' ? STATS.map((key) => [key, BRACE_EVS]) : kind === 'vitaminBag' ? [[attackStat(speciesId), VITAMIN_EVS], ['spd', VITAMIN_EVS]] : [[stat as StatKey, kind === 'feather' ? FEATHER_EVS : VITAMIN_EVS]];
  const next = { ...evs };
  for (const [key, amount] of plan) next[key] = (next[key] ?? 0) + Math.min(amount, vitaminRoom(next, key));
  return next;
}

export function ivsAfter(kind: RewardKind, ivs: Ivs, stat: StatKey | undefined): Ivs {
  if (kind === 'goldCap') return Object.fromEntries(STATS.map((key) => [key, MAX_IV])) as unknown as Ivs;
  if (kind === 'bottleCap') return { ...ivs, [stat as StatKey]: MAX_IV };
  return Object.fromEntries(STATS.map((key) => [key, Math.min(MAX_IV, (ivs[key] ?? 0) + WEIGHTS_IVS)])) as unknown as Ivs;
}

export interface Training {
  ivs: Ivs;
  evs: Ivs;
  nature: string | null;
}

const EV_KINDS: readonly RewardKind[] = ['vitamin', 'feather', 'machoBrace', 'vitaminBag'];
const IV_KINDS: readonly RewardKind[] = ['weights', 'bottleCap', 'goldCap'];
export const STAT_REWARDS: readonly RewardKind[] = [...EV_KINDS, ...IV_KINDS, 'idealMint'];

export function trainingAfter(reward: Pick<Reward, 'kind' | 'stat' | 'natures'>, target: Pick<RewardTarget, 'uid' | 'speciesId' | 'ivs' | 'evs' | 'nature'>): Training | null {
  const now = { ivs: target.ivs, evs: target.evs, nature: target.nature };
  if (EV_KINDS.includes(reward.kind)) return { ...now, evs: evsAfter(reward.kind, target.evs, target.speciesId, reward.stat) };
  if (IV_KINDS.includes(reward.kind)) return { ...now, ivs: ivsAfter(reward.kind, target.ivs, reward.stat) };
  if (reward.kind === 'idealMint') return { ...now, nature: reward.natures?.[target.uid] ?? target.nature };
  return null;
}

export const statsWith = (target: Pick<RewardTarget, 'speciesId' | 'level'>, training: Training) =>
  statsFor(speciesData(target.speciesId)?.stats ?? [0, 0, 0, 0, 0, 0], training.ivs, target.level, training.nature, training.evs);

export function statShift(target: Pick<RewardTarget, 'speciesId' | 'level' | 'ivs' | 'evs' | 'nature'>, after: Training): string | null {
  const before = statsWith(target, { ivs: target.ivs, evs: target.evs, nature: target.nature });
  const next = statsWith(target, after);
  const changed = STATS.filter((stat) => next[stat] !== before[stat]).sort((a, b) => Math.abs(next[b] - before[b]) - Math.abs(next[a] - before[a]));
  if (!changed.length) return null;
  const shown = changed.slice(0, 2).map((stat) => `${STAT_NAMES[stat]} ${before[stat]} → ${next[stat]}`).join(' · ');
  return changed.length > 2 ? `${shown} y ${changed.length - 2} más` : shown;
}

function usefulStat(party: readonly RewardTarget[], random: Random): StatKey {
  const options = [...new Set([...party.map((target) => attackStat(target.speciesId)), 'spd', 'hp'] as StatKey[])];
  return options[Math.floor(random() * options.length)];
}

function levelsUp(target: RewardTarget, levels: number, cap: number): string | null {
  if (target.level >= cap) return null;
  const level = Math.min(cap, target.level + levels);
  const path = evolutionPath(target.finalId);
  const form = formAtLevel(target.finalId, level);
  const evolves = path.indexOf(form) > path.indexOf(target.speciesId);
  return `Nv ${target.level} → ${level}${evolves ? ` · ¡evoluciona en ${speciesData(form)?.name ?? '?'}!` : ''}`;
}

function moveGain(target: RewardTarget, id: string): string {
  const move = moveData(id);
  if (!move || !alwaysDamages(id)) return 'Movimiento de apoyo';
  const types = speciesData(target.speciesId)?.types ?? [];
  const covered = target.known.some((known) => alwaysDamages(known) && moveData(known)?.type === move.type);
  const kind = types.includes(move.type ?? '') ? 'De su tipo' : covered ? 'Otro tipo' : 'Cobertura nueva';
  return `${kind} · Poder ${move.power}`;
}

const canStillEvolve = (target: Pick<RewardTarget, 'speciesId' | 'finalId'>): boolean => {
  const path = evolutionPath(target.finalId);
  return path.indexOf(target.speciesId) < path.length - 1;
};

function heldItemFor(tier: ItemTier, party: readonly RewardTarget[], random: Random): string | null {
  const attackTypes = [...new Set(party.flatMap((target) => target.known.filter(alwaysDamages).map((id) => moveData(id)?.type ?? '')))];
  const boosters = new Set(attackTypes.map((type) => boosterOf(type)).filter((key): key is string => !!key));
  const options = Object.values(HELD_ITEMS).filter((item) => item.tier === tier && (!item.boosts || boosters.has(item.key)) && (!item.unevolved || party.some(canStillEvolve)));
  return options.length ? options[Math.floor(random() * options.length)].key : null;
}

function itemFit(key: string, target: RewardTarget): string | null {
  const item = HELD_ITEMS[key];
  if (target.item === key) return null;
  if (item.unevolved && !canStillEvolve(target)) return null;
  const boosted = item.boosts ? target.known.filter((id) => alwaysDamages(id) && moveData(id)?.type === item.boosts) : [];
  if (item.boosts && !boosted.length) return null;
  const why = boosted.length ? `Potencia ${boosted.map((id) => moveData(id)?.name ?? id).slice(0, 2).join(' y ')}` : 'Lo lleva en batalla';
  return target.item ? `${why} · deja ${HELD_ITEMS[target.item]?.name ?? target.item}` : why;
}

export function cordEvolution(target: Pick<RewardTarget, 'speciesId' | 'finalId' | 'level'>): number | null {
  const path = evolutionPath(target.finalId);
  const next = path[path.indexOf(target.speciesId) + 1];
  const at = next ? speciesData(next)?.evolvesAt : null;
  return next && at && target.level < at && target.level >= at - CORD_REACH ? next : null;
}

const evTotal = (evs: Ivs): number => STATS.reduce((sum, stat) => sum + (evs[stat] ?? 0), 0);
const gained = (before: Ivs, after: Ivs): number => evTotal(after) - evTotal(before);

const totalEvs = (evs: Ivs): number => STATS.reduce((sum, stat) => sum + (evs[stat] ?? 0), 0);

export const vitaminRoom = (evs: Ivs, stat: StatKey): number => Math.max(0, Math.min(VITAMIN_EVS, MAX_STAT_EVS - (evs[stat] ?? 0), MAX_TOTAL_EVS - totalEvs(evs)));

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
      const levels = (boss ? BOSS_CANDY_LEVELS : CANDY_LEVELS) + (context.candyBonus ?? 0);
      const judgement = judged(party, (target) => levelsUp(target, levels, cap), atCap);
      return judgement.fits.length ? { ...base, levels, ...judgement } : null;
    }
    case 'expCandy': {
      const levels = 1 + (context.candyBonus ?? 0);
      const judgement = judged(party, (target) => levelsUp(target, levels, cap), atCap);
      return judgement.fits.length >= 2 ? { ...base, levels, ...judgement } : null;
    }
    case 'expShare':
    case 'candyJar': {
      const levels = (kind === 'candyJar' ? JAR_LEVELS : SHARE_LEVELS) + (context.candyBonus ?? 0);
      const judgement = judged(party, (target) => levelsUp(target, levels, cap), atCap);
      return judgement.fits.length ? { ...base, levels, ...judgement } : null;
    }
    case 'weights': {
      const judgement = judged(
        party,
        (target) => (STATS.some((stat) => target.ivs[stat] < MAX_IV) ? statShift(target, trainingAfter({ kind }, target)!) ?? `Sus IVs suben hasta ${WEIGHTS_IVS}` : null),
        () => `Todos sus IVs ya son ${MAX_IV}`,
      );
      return judgement.fits.length ? { ...base, ...judgement } : null;
    }
    case 'idealMint': {
      const natures = Object.fromEntries(party.map((target) => [target.uid, idealNature(target.speciesId)]));
      const judgement = judged(
        party,
        (target) => (target.nature !== natures[target.uid] ? `${natureInfo(natures[target.uid]).name}: ${statShift(target, { ivs: target.ivs, evs: target.evs, nature: natures[target.uid] }) ?? 'mismos stats'}` : null),
        (target) => `Ya es ${natureInfo(natures[target.uid]).name}`,
      );
      return judgement.fits.length ? { ...base, natures, ...judgement } : null;
    }
    case 'machoBrace':
    case 'vitaminBag': {
      const judgement = judged(
        party,
        (target) => {
          const after = trainingAfter({ kind }, target)!;
          return gained(target.evs, after.evs) ? statShift(target, after) ?? `+${gained(target.evs, after.evs)} EVs` : null;
        },
        () => 'No le queda espacio para esos EVs',
      );
      return judgement.fits.length ? { ...base, ...judgement } : null;
    }
    case 'shinyCharm': {
      const judgement = judged(party, (target) => (target.shiny ? null : 'Se vuelve shiny'), () => 'Ya es shiny');
      return judgement.fits.length ? { ...base, ...judgement } : null;
    }
    case 'linkingCord': {
      const judgement = judged(
        party,
        (target) => {
          const next = cordEvolution(target);
          return next ? `Evoluciona en ${speciesData(next)?.name ?? '?'} ya (normalmente Nv ${speciesData(next)?.evolvesAt})` : null;
        },
        () => 'No evoluciona por nivel pronto',
      );
      return judgement.fits.length ? { ...base, ...judgement } : null;
    }
    case 'bottleCap': {
      const stat = usefulStat(party, random);
      const judgement = judged(party, (target) => (target.ivs[stat] < MAX_IV ? statShift(target, trainingAfter({ kind, stat }, target)!) ?? `IV de ${STAT_NAMES[stat]}: ${target.ivs[stat]} → ${MAX_IV}` : null), () => `Su IV de ${STAT_NAMES[stat]} ya es ${MAX_IV}`);
      return judgement.fits.length ? { ...base, id: `${base.id}:${stat}`, stat, ...judgement } : null;
    }
    case 'goldCap': {
      const below = (target: RewardTarget) => STATS.filter((stat) => target.ivs[stat] < MAX_IV).length;
      const judgement = judged(party, (target) => (below(target) ? statShift(target, trainingAfter({ kind }, target)!) ?? `${below(target)} IVs suben a ${MAX_IV}` : null), () => `Todos sus IVs ya son ${MAX_IV}`);
      return judgement.fits.length ? { ...base, ...judgement } : null;
    }
    case 'vitamin': {
      const stat = usefulStat(party, random);
      const judgement = judged(
        party,
        (target) => (vitaminRoom(target.evs, stat) ? statShift(target, trainingAfter({ kind, stat }, target)!) ?? `+${vitaminRoom(target.evs, stat)} EVs de ${STAT_NAMES[stat]}` : null),
        (target) => (totalEvs(target.evs) >= MAX_TOTAL_EVS ? `Ya tiene ${MAX_TOTAL_EVS} EVs` : `${STAT_NAMES[stat]} ya tiene ${MAX_STAT_EVS} EVs`),
      );
      return judgement.fits.length ? { ...base, id: `${base.id}:${stat}`, stat, ...judgement } : null;
    }
    case 'feather': {
      const stat = usefulStat(party, random);
      const room = (target: RewardTarget) => Math.min(FEATHER_EVS, vitaminRoom(target.evs, stat));
      const judgement = judged(party, (target) => (room(target) ? statShift(target, trainingAfter({ kind, stat }, target)!) ?? `${STAT_NAMES[stat]}: +${room(target)} EVs` : null), () => `${STAT_NAMES[stat]} ya no tiene espacio para EVs`);
      return judgement.fits.length >= 2 ? { ...base, id: `${base.id}:${stat}`, stat, ...judgement } : null;
    }
    case 'tm':
    case 'tutor':
    case 'eggMove':
    case 'powerTm':
    case 'mushroom':
    case 'memory':
    case 'gem':
    case 'supportTm':
    case 'quickClaw':
    case 'teraShard': {
      const move = shuffled([...new Set(party.flatMap((target) => teachableBy(kind, target)))].filter((id) => worthTeaching(kind, id)), random)[0];
      if (!move) return null;
      const judgement = judged(
        party,
        (target) => (teachableBy(kind, target).includes(move) ? `${kind === 'mushroom' ? 'Lo aprendería pronto · ' : ''}${moveGain(target, move)}` : null),
        (target) => (target.known.includes(move) ? 'Ya lo conoce' : 'No lo aprende'),
      );
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
    case 'goldenEgg':
      return recruitable ? { ...base, fits: party.map((target) => target.uid), reasons: {} } : null;
    case 'commonItem':
    case 'rareItem':
    case 'epicItem': {
      const item = heldItemFor(ITEM_REWARDS[kind]!, party, random);
      if (!item) return null;
      const judgement = judged(party, (target) => itemFit(item, target), (target) => (target.item === item ? 'Ya lo lleva' : HELD_ITEMS[item].unevolved ? 'Ya no evoluciona' : 'No tiene ataques de ese tipo'));
      return judgement.fits.length ? { ...base, id: `${base.id}:${item}`, item, ...judgement } : null;
    }
  }
}

export function restRewards(party: readonly RewardTarget[], context: RestContext, random: Random): Reward[] {
  const count = (context.count ?? REWARDS_PER_REST + (context.floor >= MORE_REWARDS_FROM ? 1 : 0)) + (context.extra ?? 0);
  const weights = tierWeights(context.floor);
  const favored = context.favored ?? [];
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
    const weight = (tier: RewardTier) => weights[tier] * (favored.some((kind) => REWARD_TIERS[kind] === tier && !tried.has(kind)) ? 2 : 1);
    let roll = random() * open.reduce((sum, tier) => sum + weight(tier), 0);
    const tier = open.find((option) => (roll -= weight(option)) <= 0) ?? open[0];
    const kinds = REWARD_KINDS.filter((kind) => REWARD_TIERS[kind] === tier && !tried.has(kind));
    const liked = kinds.filter((kind) => favored.includes(kind));
    const pool = liked.length && random() < FAVORED_CHANCE ? liked : kinds;
    const kind = pool[Math.floor(random() * pool.length)];
    tried.add(kind);
    const reward = makeReward(kind, party, context, random);
    if (reward) rewards.push(reward);
  }
  return rewards;
}

export const isNature = (key: string): boolean => (NATURE_KEYS as readonly string[]).includes(key);

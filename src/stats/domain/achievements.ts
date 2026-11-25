import { finalForms, lineage, speciesData, speciesIdByName } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { EARNED_VARIANTS, ELITE_FOUR, GYM_LEADERS, isShopTrainer, originalTier, SHINY_VARIANTS, TRAINER_SPRITES, TRAINER_VARIANTS, VARIANT_COLOR_NAMES, VARIANT_COLOR_TYPES, VILLAINS } from '../../catalog/domain/trainer-sprites.js';
import { CLASS_TRAINERS, SIGNATURE, SPECIES_NEED, STARTER_IDS, STARTER_NEED, TYPE_NEED, type ClassTrainer, type TrainerRarity } from '../../catalog/domain/trainer-goals.js';
import { RARITIES, shopItem, shopItemOf } from '../../catalog/domain/shop.js';
import { TYPES } from '../../catalog/domain/type-chart.js';
import type { ChallengeState } from '../../arena/domain/challenge.js';
import { isHumanDuel } from '../../arena/domain/challenge.js';
import type { TournamentState } from '../../arena/domain/tournament.js';
import { AI_LEVELS, type AiLevel } from '../../combat/domain/ai.js';
import { SHOP_TRAINER_NOT_BOUGHT } from '../../trainers/domain/trainer.js';

const REGIONS = { kanto: [1, 151], johto: [152, 251], hoenn: [252, 386], sinnoh: [387, 493], unova: [494, 649] } as const;
type Region = keyof typeof REGIONS;
const DEX_SIZE = 649;
const RED_DEX = 250;
const GYM_STEPS = [3, 6, 10, 15];
const ELITE_SPECIES = 12;
const ELITE_WINS = 10;
const LOW_LEVEL = 30;
const VARIANT_TYPE_COUNT = { class: 5, shop: 6, gym: 8, villain: 10, elite: 10, special: 10, champion: 12 } as const;

export interface PlayerRecord {
  speciesByType: Record<string, number>;
  shinyByType: Record<string, number>;
  dexByRegion: Record<Region, number>;
  dexTotal: number;
  hoennLegendaries: number;
  legendaries: number;
  shinies: number;
  tokens: number;
  rankedWins: number;
  rankedGames: number;
  bestStreak: number;
  rankedFirst: boolean;
  tournamentsWon: number;
  bigTournamentsWon: number;
  aiWinsAtLeast: Record<AiLevel, number>;
  aiRandomWins: number;
  flawlessWins: number;
  lowLevelWins: number;
  diverseTeam: boolean;
  owned: string[];
  species: number[];
  shinySpecies: number[];
}

export interface RecordSource {
  trainer: { id: string; roster: RosterEntry[]; wins: number; losses: number; totalTokens?: number; owned?: string[] };
  team: RosterEntry[];
  challenges: readonly ChallengeState[];
  tournaments: readonly TournamentState[];
  rankedFirst: boolean;
}

const typesOf = (entry: Pick<RosterEntry, 'finalID'>): string[] => speciesData(entry.finalID)?.types ?? [];
const inRegion = (id: number, region: Region) => id >= REGIONS[region][0] && id <= REGIONS[region][1];

function sideOf(challenge: ChallengeState, trainerId: string): 0 | 1 | null {
  if (challenge.hostId === trainerId) return 0;
  if (challenge.guestId === trainerId) return 1;
  return null;
}

function bestStreak(duels: ChallengeState[], trainerId: string): number {
  let best = 0;
  let run = 0;
  for (const duel of duels) {
    run = duel.winnerId === trainerId ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

function foughtEntries(challenge: ChallengeState, side: 0 | 1): RosterEntry[] {
  const party = (side === 0 ? challenge.hostTeam : challenge.guestTeam) ?? [];
  const uids = new Set((challenge.final?.sides[side]?.team ?? []).map((f) => f.uid).filter(Boolean));
  return party.filter((entry) => uids.has(entry.id));
}

export function recordOf({ trainer, team, challenges, tournaments, rankedFirst }: RecordSource): PlayerRecord {
  const speciesByType: Record<string, number> = {};
  const shinyByType: Record<string, number> = {};
  const species = new Map<number, RosterEntry[]>();
  for (const entry of trainer.roster) species.set(entry.finalID, [...(species.get(entry.finalID) ?? []), entry]);
  for (const [, entries] of species)
    for (const type of typesOf(entries[0])) {
      speciesByType[type] = (speciesByType[type] ?? 0) + 1;
      if (entries.some((entry) => entry.shiny)) shinyByType[type] = (shinyByType[type] ?? 0) + 1;
    }
  const registered = new Set(trainer.roster.flatMap((entry) => lineage(entry.finalID)).filter((id) => id <= DEX_SIZE));
  const dexByRegion = Object.fromEntries(Object.keys(REGIONS).map((region) => [region, [...registered].filter((id) => inRegion(id, region as Region)).length])) as Record<Region, number>;
  const shinySpecies = [...species].filter(([, entries]) => entries.some((entry) => entry.shiny)).map(([id]) => id);
  const legendary = [...species.values()].filter((entries) => entries.some((entry) => entry.rarity === 'legendary')).map((entries) => entries[0].finalID);

  const finished = challenges.filter((challenge) => challenge.status === 'finished' && sideOf(challenge, trainer.id) !== null).sort((a, b) => (a.finishedAt ?? a.createdAt) - (b.finishedAt ?? b.createdAt));
  const won = finished.filter((challenge) => challenge.winnerId === trainer.id);
  const aiWins = won.filter((challenge) => challenge.ai);
  const aiWinsAtLeast = Object.fromEntries(AI_LEVELS.map((level, rank) => [level, aiWins.filter((challenge) => AI_LEVELS.indexOf(challenge.ai as AiLevel) >= rank).length])) as Record<AiLevel, number>;
  const flawlessWins = won.filter((challenge) => {
    const team = challenge.final?.sides[sideOf(challenge, trainer.id)!]?.team ?? [];
    return team.length > 0 && team.every((fighter) => (fighter.hp ?? 0) > 0);
  }).length;
  const lowLevelWins = won.filter((challenge) => {
    const fought = foughtEntries(challenge, sideOf(challenge, trainer.id)!);
    return fought.length > 0 && fought.every((entry) => entry.level < LOW_LEVEL);
  }).length;
  const championOf = (tournament: TournamentState) => (tournament.status === 'finished' && tournament.champion != null ? tournament.seats[tournament.champion]?.id : undefined);
  const crowns = tournaments.filter((tournament) => championOf(tournament) === trainer.id);
  const teamTypes = team.flatMap(typesOf);

  return {
    speciesByType,
    shinyByType,
    dexByRegion,
    dexTotal: registered.size,
    hoennLegendaries: legendary.filter((id) => inRegion(id, 'hoenn')).length,
    legendaries: legendary.length,
    shinies: shinySpecies.length,
    tokens: trainer.totalTokens ?? 0,
    rankedWins: trainer.wins,
    rankedGames: trainer.wins + trainer.losses,
    bestStreak: bestStreak(finished.filter(isHumanDuel), trainer.id),
    rankedFirst,
    tournamentsWon: crowns.length,
    bigTournamentsWon: crowns.filter((tournament) => tournament.size >= 16).length,
    aiWinsAtLeast,
    aiRandomWins: aiWins.filter((challenge) => challenge.mode === 'random').length,
    flawlessWins,
    lowLevelWins,
    diverseTeam: team.length >= 6 && new Set(teamTypes).size === teamTypes.length,
    owned: trainer.owned ?? [],
    species: [...species.keys()],
    shinySpecies,
  };
}

export interface Goal {
  text: string;
  have: number;
  need: number;
  hint?: string;
}

type GoalRule = (r: PlayerRecord) => Goal;
interface Unlock {
  group: 'class' | 'gym' | 'elite' | 'champion' | 'villain' | 'special' | 'variant';
  title: string;
  ways: GoalRule[][];
}

const displayName = (key: string) =>
  key
    .replace(/_([mf])(?=$|_)/, (_, g: string) => (g === 'm' ? ' ♂' : ' ♀'))
    .replace(/_(\d)$/, ' $1')
    .replace(/_/g, ' ')
    .replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());
const typeName = (type: string) => TYPES[type]?.label ?? type;
const goal = (text: string, have: number | boolean, need = 1): Goal => ({ text, have: Math.min(Number(have), need), need });
const ofType = (type: string, need: number): GoalRule => (r) => goal(`Pokémon tipo ${typeName(type)} en tu colección`, r.speciesByType[type] ?? 0, need);
const shinyOfType = (type: string): GoalRule => (r) => goal(`Pokémon shiny tipo ${typeName(type)}`, r.shinyByType[type] ?? 0, 1);
const rankedWins = (need: number): GoalRule => (r) => goal('Victorias contra otros jugadores', r.rankedWins, need);
const dex = (region: Region, need: number): GoalRule => (r) => goal(`Especies de ${region[0].toUpperCase()}${region.slice(1)} registradas en la Pokédex`, r.dexByRegion[region], need);
const crowns = (need: number): GoalRule => (r) => goal('Torneos ganados', r.tournamentsWon, need);
const beatAi = (level: AiLevel, label: string): GoalRule => (r) => goal(`Ganarle a la IA en ${label} o más difícil`, r.aiWinsAtLeast[level], 1);
const shinies = (need: number): GoalRule => (r) => goal('Pokémon shiny en tu colección', r.shinies, need);
const tokens = (need: number, label: string): GoalRule => (r) => goal(`Tokens en PokeTokenBar (${label})`, r.tokens, need);
const available = (id: number | null): id is number => id !== null && id <= DEX_SIZE;
const nameOf = (id: number) => speciesData(id)?.name ?? `#${id}`;
const finalsOf = (ids: readonly number[]) => [...new Set(ids.filter(available).flatMap((id) => finalForms(id, DEX_SIZE)))];
const listNames = (ids: readonly number[]) => ids.map(nameOf).join(ids.length > 2 ? ', ' : ' o ').replace(/, ([^,]+)$/, ' o $1');
const ownsAnyOf = (ids: readonly number[]): GoalRule => {
  const finals = finalsOf(ids);
  return (r) => ({ ...goal(`Tener a ${listNames(finals)} en tu colección`, finals.some((id) => r.species.includes(id)), 1), ...(finals.length > 1 ? { hint: `Cuenta cualquiera: ${finals.map(nameOf).join(', ')}` } : {}) });
};
const ownsShinyOf = (id: number): GoalRule => {
  const finals = finalsOf([id]);
  return (r) => ({ ...goal(`Tener a ${listNames(finals)} shiny en tu colección`, finals.some((final) => r.shinySpecies.includes(final)), 1), ...(finals.length > 1 ? { hint: `Cuenta cualquiera en shiny: ${finals.map(nameOf).join(', ')}` } : {}) });
};
const ownsNamed = (name: string): GoalRule => ownsAnyOf([speciesIdByName(name) ?? 0]);
const REGION_NAMES: Readonly<Record<string, string>> = { kanto: 'Kanto', johto: 'Johto', hoenn: 'Hoenn', sinnoh: 'Sinnoh', unova: 'Teselia', kalos: 'Kalos', alola: 'Alola', galar: 'Galar', paldea: 'Paldea' };

function classRule({ rarity, goal: aim }: ClassTrainer): GoalRule {
  switch (aim.kind) {
    case 'type':
      return ofType(aim.type, TYPE_NEED[rarity]);
    case 'total':
      return (r) => goal('Especies en tu colección', r.species.length, aim.need);
    case 'tokens':
      return tokens(aim.need, aim.label);
    case 'species': {
      const ids = finalsOf(aim.names.map(speciesIdByName).filter(available));
      const need = Math.min(SPECIES_NEED[rarity], ids.length);
      const hint = `Cuentan: ${ids.map(nameOf).join(', ')}`;
      const team = aim.label.startsWith('Pokémon ');
      const text = need === ids.length ? `Tener a ${ids.map(nameOf).join(' y ')} en tu colección` : team ? (need === 1 ? `Tener ${aim.label} en tu colección` : `${aim.label} distintos en tu colección`) : `Tener a ${listNames(ids)} en tu colección`;
      return (r) => ({ ...goal(text, ids.filter((id) => r.species.includes(id)).length, need), ...(ids.length > 1 ? { hint } : {}) });
    }
    case 'starter': {
      const ranges = (aim.region ? [STARTER_IDS[aim.region]] : Object.values(STARTER_IDS)).filter(([from]) => from <= DEX_SIZE);
      const ids = finalsOf(ranges.flatMap(([from]) => [from, from + 3, from + 6]));
      const label = aim.region ? `Iniciales de ${REGION_NAMES[aim.region]} evolucionados en tu colección` : 'Iniciales evolucionados en tu colección';
      const hint = `Cuentan: ${ids.map(nameOf).join(', ')}`;
      return (r) => ({ ...goal(label, r.species.filter((id) => ids.includes(id)).length, STARTER_NEED[rarity]), hint });
    }
  }
}

const VARIANT_BASE = new Map(TRAINER_VARIANTS.map((variant) => [variant.key, variant.base]));
export const trainerRarity = (key: string): TrainerRarity => {
  const base = VARIANT_BASE.get(key) ?? key;
  return CLASS_TRAINERS[base]?.rarity ?? originalTier(base);
};

function buildUnlocks(): Map<string, Unlock> {
  const unlocks = new Map<string, Unlock>();
  const add = (keys: readonly string[], unlock: Unlock) => keys.forEach((key) => unlocks.set(key, unlock));
  const gymNeed = new Map<string, number>();
  for (const [type, leaders] of Object.entries(GYM_LEADERS))
    leaders.forEach((key, i) => {
      const step = i === 0 ? 0 : i === 1 ? 1 : i === leaders.length - 1 && leaders.length >= 4 ? 3 : 2;
      gymNeed.set(key, GYM_STEPS[step]);
      add([key], { group: 'gym', title: `Líder de gimnasio · ${typeName(type)}`, ways: [[ofType(type, GYM_STEPS[step]), ...(step === 3 ? [shinyOfType(type)] : [])]] });
    });
  for (const [key, type] of Object.entries(ELITE_FOUR)) add([key], { group: 'elite', title: `Alto Mando · ${typeName(type)}`, ways: [[ofType(type, ELITE_SPECIES), rankedWins(ELITE_WINS)]] });
  const champion = (key: string, ...ways: GoalRule[][]) => add([key], { group: 'champion', title: 'Campeón', ways });
  champion('blue', [dex('kanto', 45)]);
  champion('lance', [dex('johto', 30)]);
  champion('steven', [dex('hoenn', 40)]);
  champion('wallace', [(r) => goal('Pokémon legendario de Hoenn', r.hoennLegendaries, 1)]);
  champion('cynthia', [dex('sinnoh', 30)]);
  champion('alder', [dex('unova', 45)]);
  champion('iris', [crowns(1)]);
  champion('diantha', [crowns(2)]);
  champion('kukui', [rankedWins(25)]);
  champion('hau', [(r) => goal('Peleas contra otros jugadores', r.rankedGames, 50)]);
  champion('leon', [(r) => goal('Victorias seguidas contra otros jugadores', r.bestStreak, 10)]);
  champion('geeta', [crowns(3)]);
  champion('nemona', [(r) => goal('Peleas contra otros jugadores', r.rankedGames, 100)]);
  champion('kieran', [(r) => goal('Torneos de 16 jugadores ganados', r.bigTournamentsWon, 1)]);
  champion('red', [(r) => goal('Primer lugar del ranking', r.rankedFirst, 1), rankedWins(15)], [(r) => goal('Especies registradas en la Pokédex', r.dexTotal, RED_DEX)]);
  add(VILLAINS.admin, { group: 'villain', title: 'Comandante de equipo villano', ways: [[beatAi('hard', 'Difícil')]] });
  add(VILLAINS.boss, { group: 'villain', title: 'Jefe de equipo villano', ways: [[beatAi('veryhard', 'Muy difícil')]] });
  add(VILLAINS.legend, { group: 'villain', title: 'Jefe legendario', ways: [[beatAi('skynet', 'Skynet')]] });
  add(VILLAINS.star, { group: 'villain', title: 'Jefe del Team Star', ways: [[(r) => goal('Victorias contra la IA en batalla aleatoria', r.aiRandomWins, 5)]] });
  add(VILLAINS.partner, { group: 'villain', title: 'Compañero de Sinnoh', ways: [[(r) => goal('Victoria contra la IA en batalla aleatoria', r.aiRandomWins, 1)]] });
  const legendaries: GoalRule = (r) => goal('Pokémon legendarios en tu colección', r.legendaries, 3);
  unlocks.set('cyrus', { ...unlocks.get('cyrus')!, ways: [[beatAi('veryhard', 'Muy difícil')], [legendaries]] });
  unlocks.set('lusamine', { ...unlocks.get('lusamine')!, ways: [[beatAi('veryhard', 'Muy difícil')], [legendaries]] });
  unlocks.set('rose', { ...unlocks.get('rose')!, ways: [[beatAi('skynet', 'Skynet')], [tokens(10_000_000_000, '10.000 millones')]] });
  const special = (key: string, ways: GoalRule[][]) => add([key], { group: 'special', title: 'Especial', ways });
  for (const [key, trainer] of Object.entries(CLASS_TRAINERS)) add([key], { group: 'class', title: trainer.title, ways: [[classRule(trainer)]] });
  const typeOfGym = new Map(Object.entries(GYM_LEADERS).flatMap(([type, leaders]) => leaders.map((key) => [key, type] as const)));
  const villainLevel = (key: string): [AiLevel, string] =>
    VILLAINS.legend.includes(key) ? ['veryhard', 'Muy difícil'] : VILLAINS.boss.includes(key) ? ['hard', 'Difícil'] : ['mid', 'Normal'];
  for (const [key, ace] of Object.entries(SIGNATURE)) {
    const unlock = unlocks.get(key);
    if (!unlock || !available(speciesIdByName(ace))) continue;
    const gymType = typeOfGym.get(key);
    const second =
      unlock.group === 'gym' && gymType ? ofType(gymType, Math.max(2, Math.ceil((gymNeed.get(key) ?? 4) / 2)))
      : unlock.group === 'elite' ? ofType(ELITE_FOUR[key as keyof typeof ELITE_FOUR], ELITE_SPECIES / 2)
      : unlock.group === 'champion' ? rankedWins(10)
      : beatAi(...villainLevel(key));
    unlocks.set(key, { ...unlock, ways: [...unlock.ways, [ownsNamed(ace), second]] });
  }
  const ownsSpecies = (id: number): GoalRule => ownsAnyOf([id]);
  const reached = (rule: GoalRule, r: PlayerRecord) => {
    const g = rule(r);
    return g.have >= g.need;
  };
  const hasOriginal = (base: string): GoalRule => (r) => goal(`Desbloquear a ${displayName(base)}`, unlocks.get(base)?.ways.some((way) => way.every((rule) => reached(rule, r))) ?? true, 1);
  const variantOf = (key: string, base: string, extra: GoalRule) => {
    const original = unlocks.get(base)!;
    add([key], { group: original.group, title: `${original.title} · variante de colores`, ways: [[hasOriginal(base), extra]] });
  };

  special('collector', [[shinies(1)]]);
  special('colress', [[shinies(5)]]);
  special('mustard', [[shinies(15)]]);
  special('rich_m', [[tokens(1_000_000_000, '1.000 millones')]]);
  special('rich_f', [[tokens(1_000_000_000, '1.000 millones')]]);
  for (const key of ['cheren', 'hugh']) special(key, [[(r) => goal('Equipo de 6 sin tipos repetidos', r.diverseTeam, 1)]]);
  for (const key of ['emmet', 'ingo']) special(key, [[(r) => goal('Victoria sin que se debilite ninguno de tus Pokémon', r.flawlessWins, 1)]]);
  for (const key of ['bede', 'marnie']) special(key, [[(r) => goal(`Victoria con Pokémon de nivel menor a ${LOW_LEVEL} en tu save`, r.lowLevelWins, 1)]]);
  for (const variant of TRAINER_VARIANTS) if (variant.pokemon && !variant.shiny) variantOf(variant.key, variant.base, ownsSpecies(variant.pokemon));
  for (const variant of SHINY_VARIANTS) {
    const original = unlocks.get(variant.original)!;
    add([variant.key], { group: original.group, title: `${unlocks.get(variant.base)!.title} · variante shiny`, ways: [[hasOriginal(variant.base), ownsShinyOf(variant.pokemon)]] });
  }
  for (const variant of EARNED_VARIANTS) {
    const type = VARIANT_COLOR_TYPES[variant.color];
    const title = `Variante ${VARIANT_COLOR_NAMES[variant.color]}`;
    const original = unlocks.get(variant.base);
    const count = original ? VARIANT_TYPE_COUNT[original.group as keyof typeof VARIANT_TYPE_COUNT] ?? VARIANT_TYPE_COUNT.gym : VARIANT_TYPE_COUNT.class;
    const own = ofType(type, count);
    add([variant.key], { group: 'variant', title, ways: [[hasOriginal(variant.base), own]] });
  }
  return unlocks;
}

export const UNLOCKS = buildUnlocks();

export interface SpriteProgress {
  key: string;
  group: Unlock['group'] | 'shop';
  rarity: TrainerRarity;
  title: string | null;
  unlocked: boolean;
  goals: Goal[];
  ways: Goal[][];
}

const done = (goals: Goal[]) => goals.every((g) => g.have >= g.need);
const share = (goals: Goal[]) => goals.reduce((sum, g) => sum + g.have / g.need, 0) / goals.length;

export function spriteProgress(record: PlayerRecord): SpriteProgress[] {
  return TRAINER_SPRITES.map((key) => {
    if (isShopTrainer(key)) {
      const item = shopItemOf('trainer', key)!;
      const owned = record.owned.includes(item.id);
      const buy = { text: `Comprarlo en tu perfil por ${(item.price / 1_000_000).toLocaleString('es')} M de tokens`, have: owned ? 1 : 0, need: 1 };
      const first = item.requires ? [{ text: `Desbloquear a ${displayName(item.requires)}`, have: owned || isUnlocked(record, item.requires) ? 1 : 0, need: 1 }] : [];
      const goals = [...first, buy];
      return { key, group: 'shop', rarity: trainerRarity(key), title: `Tienda · ${RARITIES[item.rarity].label}`, unlocked: owned, goals, ways: [goals] };
    }
    const unlock = UNLOCKS.get(key);
    if (!unlock) return { key, group: 'class', rarity: trainerRarity(key), title: null, unlocked: true, goals: [], ways: [] };
    const ways = unlock.ways.map((way) => way.map((rule) => rule(record)));
    const best = ways.find(done) ?? ways.reduce((a, b) => (share(b) > share(a) ? b : a));
    return { key, group: unlock.group, rarity: trainerRarity(key), title: unlock.title, unlocked: record.owned.includes(`trainer:${key}`) || ways.some(done), goals: best, ways };
  });
}

export const isUnlocked = (record: PlayerRecord, key: string): boolean => {
  if (record.owned.includes(`trainer:${key}`)) return true;
  if (isShopTrainer(key)) return false;
  const unlock = UNLOCKS.get(key);
  return !unlock || unlock.ways.some((way) => done(way.map((rule) => rule(record))));
};

export function buyBlocker(record: PlayerRecord, itemId: string): string | null {
  const requires = shopItem(itemId)?.requires;
  if (requires && !isUnlocked(record, requires)) return 'Primero desbloquea al entrenador original.';
  return null;
}

export function lookBlocker(record: PlayerRecord, currentAvatar: string | null | undefined, key: string): string | null {
  if (key === currentAvatar || isUnlocked(record, key)) return null;
  return isShopTrainer(key) ? SHOP_TRAINER_NOT_BOUGHT : 'Todavía no desbloqueas a ese entrenador.';
}

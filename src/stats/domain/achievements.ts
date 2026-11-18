import { lineage, speciesData } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { EARNED_VARIANTS, ELITE_FOUR, GYM_LEADERS, isShopTrainer, TRAINER_SPRITES, VARIANT_COLOR_NAMES, VARIANT_COLOR_TYPES, VILLAINS } from '../../catalog/domain/trainer-sprites.js';
import { RARITIES, shopItemOf } from '../../catalog/domain/shop.js';
import { TYPES } from '../../catalog/domain/type-chart.js';
import type { ChallengeState } from '../../arena/domain/challenge.js';
import { isHumanDuel } from '../../arena/domain/challenge.js';
import type { TournamentState } from '../../arena/domain/tournament.js';
import { AI_LEVELS, type AiLevel } from '../../combat/domain/ai.js';

const REGIONS = { kanto: [1, 151], johto: [152, 251], hoenn: [252, 386], sinnoh: [387, 493], unova: [494, 649] } as const;
type Region = keyof typeof REGIONS;
const DEX_SIZE = 649;
const GYM_STEPS = [3, 6, 10, 15];
const ELITE_SPECIES = 12;
const ELITE_WINS = 10;
const LOW_LEVEL = 30;
const KYOGRE = 382;
const GROUDON = 383;
const RAYQUAZA = 384;
const VARIANT_TYPE_COUNT = { free: 5, shop: 6, locked: 8 };
const BLASTOISE = 9;
const CHARIZARD = 6;
const GENERATED_PARTNERS: Readonly<Record<string, number>> = { red__magenta: CHARIZARD };
const VARIANT_PARTNERS: readonly [string, string, number][] = [
  ['red_yellow', 'red', 25],
  ['red_green', 'red', 3],
  ['blue_red', 'blue', 6],
  ['lance_dragonite', 'lance', 149],
  ['misty_starmie', 'misty', 121],
  ['steven_metagross', 'steven', 376],
  ['wallace_milotic', 'wallace', 350],
  ['cynthia_garchomp', 'cynthia', 445],
  ['cynthia_platinum', 'cynthia', 487],
  ['iris_haxorus', 'iris', 612],
  ['diantha_gardevoir', 'diantha', 282],
];

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
      if (entries.some((e) => e.shiny)) shinyByType[type] = (shinyByType[type] ?? 0) + 1;
    }
  const registered = new Set(trainer.roster.flatMap((entry) => lineage(entry.finalID)).filter((id) => id <= DEX_SIZE));
  const dexByRegion = Object.fromEntries(Object.keys(REGIONS).map((region) => [region, [...registered].filter((id) => inRegion(id, region as Region)).length])) as Record<Region, number>;
  const legendary = [...species.values()].filter((entries) => entries.some((e) => e.rarity === 'legendary')).map((entries) => entries[0].finalID);

  const finished = challenges.filter((c) => c.status === 'finished' && sideOf(c, trainer.id) !== null).sort((a, b) => (a.finishedAt ?? a.createdAt) - (b.finishedAt ?? b.createdAt));
  const won = finished.filter((c) => c.winnerId === trainer.id);
  const aiWins = won.filter((c) => c.ai);
  const aiWinsAtLeast = Object.fromEntries(AI_LEVELS.map((level, rank) => [level, aiWins.filter((c) => AI_LEVELS.indexOf(c.ai as AiLevel) >= rank).length])) as Record<AiLevel, number>;
  const flawlessWins = won.filter((c) => {
    const team = c.final?.sides[sideOf(c, trainer.id)!]?.team ?? [];
    return team.length > 0 && team.every((f) => (f.hp ?? 0) > 0);
  }).length;
  const lowLevelWins = won.filter((c) => {
    const fought = foughtEntries(c, sideOf(c, trainer.id)!);
    return fought.length > 0 && fought.every((e) => e.level < LOW_LEVEL);
  }).length;
  const championOf = (t: TournamentState) => (t.status === 'finished' && t.champion != null ? t.seats[t.champion]?.id : undefined);
  const crowns = tournaments.filter((t) => championOf(t) === trainer.id);
  const teamTypes = team.flatMap(typesOf);

  return {
    speciesByType,
    shinyByType,
    dexByRegion,
    dexTotal: registered.size,
    hoennLegendaries: legendary.filter((id) => inRegion(id, 'hoenn')).length,
    legendaries: legendary.length,
    shinies: [...species.values()].filter((entries) => entries.some((e) => e.shiny)).length,
    tokens: trainer.totalTokens ?? 0,
    rankedWins: trainer.wins,
    rankedGames: trainer.wins + trainer.losses,
    bestStreak: bestStreak(finished.filter(isHumanDuel), trainer.id),
    rankedFirst,
    tournamentsWon: crowns.length,
    bigTournamentsWon: crowns.filter((t) => t.size >= 16).length,
    aiWinsAtLeast,
    aiRandomWins: aiWins.filter((c) => c.mode === 'random').length,
    flawlessWins,
    lowLevelWins,
    diverseTeam: team.length >= 6 && new Set(teamTypes).size === teamTypes.length,
    owned: trainer.owned ?? [],
    species: [...species.keys()],
  };
}

export interface Goal {
  text: string;
  have: number;
  need: number;
}

type GoalRule = (r: PlayerRecord) => Goal;
interface Unlock {
  group: 'gym' | 'elite' | 'champion' | 'villain' | 'special' | 'variant';
  title: string;
  ways: GoalRule[][];
}

const displayName = (key: string) => key.replace(/_/g, ' ').replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());
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

function buildUnlocks(): Map<string, Unlock> {
  const unlocks = new Map<string, Unlock>();
  const add = (keys: readonly string[], unlock: Unlock) => keys.forEach((key) => unlocks.set(key, unlock));
  for (const [type, leaders] of Object.entries(GYM_LEADERS))
    leaders.forEach((key, i) => {
      const step = i === 0 ? 0 : i === 1 ? 1 : i === leaders.length - 1 && leaders.length >= 4 ? 3 : 2;
      add([key], { group: 'gym', title: `Líder de gimnasio · ${typeName(type)}`, ways: [[ofType(type, GYM_STEPS[step]), ...(step === 3 ? [shinyOfType(type)] : [])]] });
    });
  for (const [key, type] of Object.entries(ELITE_FOUR)) add([key], { group: 'elite', title: `Alto Mando · ${typeName(type)}`, ways: [[ofType(type, ELITE_SPECIES), rankedWins(ELITE_WINS)]] });
  const champion = (key: string, ...ways: GoalRule[][]) => add([key], { group: 'champion', title: 'Campeón', ways });
  champion('blue', [dex('kanto', 75)]);
  champion('lance', [dex('johto', 75)]);
  champion('steven', [dex('hoenn', 100)]);
  champion('wallace', [(r) => goal('Pokémon legendario de Hoenn', r.hoennLegendaries, 1)]);
  champion('cynthia', [dex('sinnoh', 100)]);
  champion('alder', [dex('unova', 120)]);
  champion('iris', [crowns(1)]);
  champion('diantha', [crowns(2)]);
  champion('kukui', [rankedWins(25)]);
  champion('hau', [(r) => goal('Peleas contra otros jugadores', r.rankedGames, 50)]);
  champion('leon', [(r) => goal('Victorias seguidas contra otros jugadores', r.bestStreak, 10)]);
  champion('geeta', [crowns(3)]);
  champion('nemona', [(r) => goal('Peleas contra otros jugadores', r.rankedGames, 100)]);
  champion('kieran', [(r) => goal('Torneos de 16 jugadores ganados', r.bigTournamentsWon, 1)]);
  champion('red', [(r) => goal('Primer lugar del ranking', r.rankedFirst, 1), rankedWins(30)], [(r) => goal('Pokédex completa', r.dexTotal, DEX_SIZE)]);
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
  const ownsSpecies = (id: number): GoalRule => (r) => goal(`Tener a ${speciesData(id)?.name ?? `#${id}`} en tu colección`, r.species.includes(id), 1);
  const variantOf = (key: string, base: string, extra: GoalRule) => {
    const original = unlocks.get(base)!;
    add([key], { group: original.group, title: `${original.title} · variante de colores`, ways: original.ways.map((way) => [...way, extra]) });
  };
  variantOf('red_blue', 'red', ownsSpecies(BLASTOISE));
  variantOf('maxie_aqua', 'maxie', ownsSpecies(KYOGRE));
  variantOf('archie_magma', 'archie', ownsSpecies(GROUDON));
  variantOf('lance_emerald', 'lance', ownsSpecies(RAYQUAZA));
  for (const [key, base, species] of VARIANT_PARTNERS) variantOf(key, base, ownsSpecies(species));

  special('collector', [[shinies(1)]]);
  special('colress', [[shinies(5)]]);
  special('mustard', [[shinies(15)]]);
  special('rich_m', [[tokens(1_000_000_000, '1.000 millones')]]);
  special('rich_f', [[tokens(1_000_000_000, '1.000 millones')]]);
  for (const key of ['cheren', 'hugh']) special(key, [[(r) => goal('Equipo de 6 sin tipos repetidos', r.diverseTeam, 1)]]);
  for (const key of ['emmet', 'ingo']) special(key, [[(r) => goal('Victoria sin que se debilite ninguno de tus Pokémon', r.flawlessWins, 1)]]);
  for (const key of ['bede', 'marnie']) special(key, [[(r) => goal(`Victoria con Pokémon de nivel menor a ${LOW_LEVEL} en tu save`, r.lowLevelWins, 1)]]);
  for (const variant of EARNED_VARIANTS) {
    const type = VARIANT_COLOR_TYPES[variant.color];
    const title = `Variante ${VARIANT_COLOR_NAMES[variant.color]}`;
    const original = unlocks.get(variant.base);
    const partner = GENERATED_PARTNERS[variant.key];
    if (original) add([variant.key], { group: 'variant', title, ways: original.ways.map((way) => [...way, partner ? ownsSpecies(partner) : ofType(type, VARIANT_TYPE_COUNT.locked)]) });
    else if (isShopTrainer(variant.base)) add([variant.key], { group: 'variant', title, ways: [[(r) => goal(`Tener a ${displayName(variant.base)}, comprado en tu perfil`, r.owned.includes(`trainer:${variant.base}`), 1), ofType(type, VARIANT_TYPE_COUNT.shop)]] });
    else add([variant.key], { group: 'variant', title, ways: [[ofType(type, VARIANT_TYPE_COUNT.free)]] });
  }
  return unlocks;
}

export const UNLOCKS = buildUnlocks();

export interface SpriteProgress {
  key: string;
  group: Unlock['group'] | 'starter' | 'shop';
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
      const first = item.requires ? [{ text: `Desbloquear primero a ${displayName(item.requires)}`, have: owned || isUnlocked(record, item.requires) ? 1 : 0, need: 1 }] : [];
      const goals = [...first, buy];
      return { key, group: 'shop', title: `Tienda · ${RARITIES[item.rarity].label}`, unlocked: owned, goals, ways: [goals] };
    }
    const unlock = UNLOCKS.get(key);
    if (!unlock) return { key, group: 'starter', title: null, unlocked: true, goals: [], ways: [] };
    const ways = unlock.ways.map((way) => way.map((rule) => rule(record)));
    const best = ways.find(done) ?? ways.reduce((a, b) => (share(b) > share(a) ? b : a));
    return { key, group: unlock.group, title: unlock.title, unlocked: ways.some(done), goals: best, ways };
  });
}

export const isUnlocked = (record: PlayerRecord, key: string): boolean => {
  if (isShopTrainer(key)) return record.owned.includes(`trainer:${key}`);
  const unlock = UNLOCKS.get(key);
  return !unlock || unlock.ways.some((way) => done(way.map((rule) => rule(record))));
};

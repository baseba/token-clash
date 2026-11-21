// Who gives you Pokémon in the Tower, always from your own collection. At the start the professor
// offers a balanced handful (weaker, middling and stronger lines alike, a single legendary at most);
// after a boss, the leader you beat offers lines of its type. Every Pokémon starts as the form its
// level allows, on the way to the form you raised.
import { hash, NATURE_KEYS, shuffled, speciesData, type Random } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { LAB_OFFERS, PROFESSOR } from '../../catalog/domain/tower-cast.js';
import { baseStatTotal, evolutionPath, formAtLevel, movesAtLevel } from './growth.js';

export interface OfferGuide {
  key: string;
  title: string;
  line: string;
}

export interface Offer {
  id: string;
  guide: OfferGuide;
  entry: RosterEntry;
  speciesId: number;
  level: number;
}

const LEGENDARY_TOTAL = 580;
const RECRUIT_OFFERS = 3;

export const lineOf = (entry: RosterEntry): number => evolutionPath(entry.finalID)[0];

/** One entry per evolution line, of species the catalog knows. */
export function collectionLines(roster: readonly RosterEntry[], random: Random): RosterEntry[] {
  const byLine = new Map<number, RosterEntry>();
  for (const entry of shuffled(roster, random)) if (speciesData(entry.finalID) && !byLine.has(lineOf(entry))) byLine.set(lineOf(entry), entry);
  return [...byLine.values()];
}

const fits = (entry: RosterEntry, types: readonly string[]): boolean =>
  !types.length || evolutionPath(entry.finalID).some((id) => speciesData(id)?.types.some((type) => types.includes(type)));


/** Saves from before natures had none: the Tower gives each one a nature of its own, always the same. */
export const natureOf = (entry: RosterEntry): string => entry.natureChoice ?? entry.nature ?? NATURE_KEYS[hash(`nature:${entry.id}`) % NATURE_KEYS.length];

const offerOf = (guide: OfferGuide, entry: RosterEntry, level: number): Offer => ({
  id: `${guide.key}:${entry.id}`,
  guide,
  entry,
  speciesId: formAtLevel(entry.finalID, level),
  level,
});

/** The moves it comes with: what its form knows at this level, keeping the ones you chose if it already learned them. */
export const offerMoves = (offer: Offer): string[] => movesAtLevel(offer.speciesId, offer.level, offer.entry.moveset ?? []);

const isLegendary = (entry: RosterEntry): boolean => baseStatTotal(entry.finalID) >= LEGENDARY_TOTAL;
const STRENGTH_TIERS = 3;

/** The same number of lines from each third of your collection by strength, one legendary at most. */
export function labOffers(roster: readonly RosterEntry[], level: number, random: Random): Offer[] {
  const lines = collectionLines(roster, random).sort((a, b) => baseStatTotal(a.finalID) - baseStatTotal(b.finalID));
  const guide: OfferGuide = { key: PROFESSOR.key, title: PROFESSOR.name, line: '' };
  if (lines.length <= LAB_OFFERS) return lines.map((entry) => offerOf(guide, entry, level));
  const size = Math.ceil(lines.length / STRENGTH_TIERS);
  const tiers = Array.from({ length: STRENGTH_TIERS }, (_, tier) => shuffled(lines.slice(tier * size, (tier + 1) * size), random));
  const picked: RosterEntry[] = [];
  let legendaryTaken = false;
  for (let round = 0; picked.length < LAB_OFFERS && round < size; round++) {
    for (const tier of tiers) {
      const entry = tier.find((candidate) => !picked.includes(candidate) && !(legendaryTaken && isLegendary(candidate)));
      if (!entry || picked.length >= LAB_OFFERS) continue;
      legendaryTaken ||= isLegendary(entry);
      picked.push(entry);
    }
  }
  return picked.map((entry) => offerOf(guide, entry, level));
}

export function recruitOffers(roster: readonly RosterEntry[], partyLines: readonly number[], guide: OfferGuide & { type: string | null }, level: number, random: Random): Offer[] {
  const lines = collectionLines(roster, random).filter((entry) => !partyLines.includes(lineOf(entry)));
  const themed = guide.type ? lines.filter((entry) => fits(entry, [guide.type as string])) : [];
  const picked = [...shuffled(themed, random), ...shuffled(lines.filter((entry) => !themed.includes(entry)), random)].slice(0, RECRUIT_OFFERS);
  return picked.map((entry) => offerOf({ key: guide.key, title: guide.title, line: guide.line }, entry, level));
}

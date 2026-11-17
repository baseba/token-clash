// A Pokémon as the trainer raised it in PokeTokenBar: the only creature data we keep from a save.
// Everything else (name, stats, types, sprites, moves) is derived from the catalog by species number.
// It is a value object: battles, rooms and tournaments take copies of it ("snapshots").

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary';
export type Gender = 'male' | 'female';

export interface Ivs {
  hp: number;
  atk: number;
  def: number;
  satk: number;
  sdef: number;
  spd: number;
}

export interface RosterEntry {
  /** Instance id from the save (a UUID), stable across re-imports. */
  id: string;
  /** Species (national dex number) it is now. */
  finalID: number;
  /** First species of its evolution line. */
  baseID: number;
  rarity: Rarity;
  shiny: boolean;
  level: number;
  ivs: Ivs;
  ability?: string | null;
  abilitySlot?: 1 | 2 | 3 | null;
  gender?: Gender | null;
  nature?: string | null;
  /** Every move it learned in the save. */
  learned?: string[];
  /** Up to 4 moves chosen for battle (from the save, the collection screen or the dice). */
  moveset?: string[];
  /** Ability chosen in the collection screen (or by the dice). */
  abilityChoice?: string;
  nickname?: string;
  /** Position in its evolution chain (0 = first form) and the chain's length. */
  stage?: number;
  chainLen?: number;
  /** The one currently growing in PokeTokenBar. */
  active?: boolean;
}

const variantKey = (entry: Pick<RosterEntry, 'finalID' | 'shiny'>) => `${entry.finalID}:${entry.shiny ? 'shiny' : 'plain'}`;
export { variantKey };

function firstBy<T>(list: T[], key: (item: T) => string | number): T[] {
  const seen = new Set<string | number>();
  return list.filter((item) => {
    const itemKey = key(item);
    if (seen.has(itemKey)) return false;
    seen.add(itemKey);
    return true;
  });
}

/** One per species and variant: a shiny and a plain one of the same species can both stay. */
export const uniqueVariants = <T extends Pick<RosterEntry, 'finalID' | 'shiny'>>(roster: T[]): T[] => firstBy<T>(roster, variantKey);

/** One per species: a team never repeats a species. */
export const uniqueSpecies = <T extends Pick<RosterEntry, 'finalID'>>(roster: T[]): T[] => firstBy<T>(roster, (e) => e.finalID);

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
  id: string;
  finalID: number;
  baseID: number;
  rarity: Rarity;
  shiny: boolean;
  level: number;
  ivs: Ivs;
  ability?: string | null;
  abilitySlot?: 1 | 2 | 3 | null;
  gender?: Gender | null;
  nature?: string | null;
  learned?: string[];
  moveset?: string[];
  abilityChoice?: string;
  natureChoice?: string;
  evs?: Ivs;
  nickname?: string;
  stage?: number;
  chainLen?: number;
  active?: boolean;
  battleLevel?: number;
  battleIvs?: Ivs;
  heldItem?: string;
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

export const uniqueVariants = <T extends Pick<RosterEntry, 'finalID' | 'shiny'>>(roster: T[]): T[] => firstBy<T>(roster, variantKey);

export const uniqueSpecies = <T extends Pick<RosterEntry, 'finalID'>>(roster: T[]): T[] => firstBy<T>(roster, (e) => e.finalID);

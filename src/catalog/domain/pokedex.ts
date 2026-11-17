// The Pokédex of a trainer: which species of the 1st to 5th generation they have registered. A
// species counts once its Pokémon (or something that evolves from it) is in the collection.
import { lineage, family, speciesData } from './creatures.js';
import { abilityInfo } from './abilities.js';
import type { RosterEntry } from './roster-entry.js';

/** The game covers generations 1 to 5: the Pokédex and the AI's teams stop at #649 (Genesect). */
export const DEX_LIMIT = 649;

export const GENERATIONS: [number, number][] = [
  [1, 151],
  [152, 251],
  [252, 386],
  [387, 493],
  [494, 649],
];

export interface PokedexEntry {
  id: number;
  name: string;
  types: string[];
  stats: [number, number, number, number, number, number];
  genus: string | null;
  entry: string | null;
  height: number | null;
  weight: number | null;
  genderRate: number | null;
  abilities: { name: string; hidden: boolean }[];
  /** How many of this species the trainer has (not counting evolutions). */
  owned: number;
  shiny: boolean;
  levels: number[];
  family: { id: number; stage: number; name: string | null }[];
}

export interface Pokedex {
  total: number;
  generations: [number, number][];
  registered: number;
  shinies: number;
  entries: PokedexEntry[];
}

export function pokedexOf(roster: RosterEntry[]): Pokedex {
  const rows = new Map<number, Omit<PokedexEntry, 'family'>>();
  for (const entry of roster) {
    lineage(entry.finalID).forEach((id, depth) => {
      const species = speciesData(id);
      if (!species || id > DEX_LIMIT) return;
      if (!rows.has(id)) {
        rows.set(id, {
          id,
          name: species.name,
          types: species.types,
          stats: species.stats,
          genus: species.genus ?? null,
          entry: species.dexEntry ?? null,
          height: species.height ?? null,
          weight: species.weight ?? null,
          genderRate: species.genderRate ?? null,
          abilities: [
            ...(species.abilities ?? []).map((key) => ({ name: abilityInfo(key)?.name ?? key, hidden: false })),
            ...(species.hiddenAbility && !(species.abilities ?? []).includes(species.hiddenAbility)
              ? [{ name: abilityInfo(species.hiddenAbility)?.name ?? species.hiddenAbility, hidden: true }]
              : []),
          ],
          owned: 0,
          shiny: false,
          levels: [],
        });
      }
      const row = rows.get(id)!;
      if (depth === 0) {
        row.owned += 1;
        row.levels.push(entry.level);
      }
      if (entry.shiny) row.shiny = true;
    });
  }
  const entries = [...rows.values()]
    .sort((a, b) => a.id - b.id)
    .map((row) => ({ ...row, levels: row.levels.sort((a, b) => b - a), family: family(row.id).filter(({ id }) => id <= DEX_LIMIT).map(({ id, stage }) => ({ id, stage, name: rows.has(id) ? rows.get(id)!.name : null })) }));
  return { total: DEX_LIMIT, generations: GENERATIONS, registered: entries.length, shinies: entries.filter((e) => e.shiny).length, entries };
}

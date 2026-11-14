import { lineage, family, speciesData } from './creatures.js';
import { abilityInfo } from './abilities.js';
import { LAST_AI_SPECIES } from './ai.js';

export const DEX_LIMIT = LAST_AI_SPECIES;

export const GENERATIONS = [
  [1, 151],
  [152, 251],
  [252, 386],
  [387, 493],
  [494, 649],
];

export function pokedexOf(roster) {
  const rows = new Map();
  for (const e of roster) {
    lineage(e.finalID).forEach((id, depth) => {
      const d = speciesData(id);
      if (!d || id > DEX_LIMIT) return;
      if (!rows.has(id)) {
        rows.set(id, {
          id,
          name: d.name,
          types: d.types,
          stats: d.stats,
          genus: d.genus ?? null,
          entry: d.dexEntry ?? null,
          height: d.height ?? null,
          weight: d.weight ?? null,
          genderRate: d.genderRate ?? null,
          abilities: [...(d.abilities ?? []).map((key) => ({ name: abilityInfo(key)?.name ?? key, hidden: false })), ...(d.hiddenAbility && !(d.abilities ?? []).includes(d.hiddenAbility) ? [{ name: abilityInfo(d.hiddenAbility)?.name ?? d.hiddenAbility, hidden: true }] : [])],
          owned: 0,
          shiny: false,
          levels: [],
        });
      }
      const row = rows.get(id);
      if (depth === 0) {
        row.owned += 1;
        row.levels.push(e.level);
      }
      if (e.shiny) row.shiny = true;
    });
  }
  const entries = [...rows.values()]
    .sort((a, b) => a.id - b.id)
    .map((row) => ({ ...row, levels: row.levels.sort((a, b) => b - a), family: family(row.id).filter(({ id }) => id <= DEX_LIMIT).map(({ id, stage }) => ({ id, stage, name: rows.has(id) ? rows.get(id).name : null })) }));
  return { total: DEX_LIMIT, generations: GENERATIONS, registered: entries.length, shinies: entries.filter((e) => e.shiny).length, entries };
}

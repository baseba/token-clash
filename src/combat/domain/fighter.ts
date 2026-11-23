// A Pokémon ready to fight: its stats, ability and gender from the catalog, and the moves it carries into
// battle (up to four the engine can play).
import { abilityInfo, type AbilityInfo } from '../../catalog/domain/abilities.js';
import { abilityFor, genderFor, natureFor, PERFECT_IVS, natureInfo, type NatureInfo, learnedMoves, moveEntry, moveOrigins, rng, shuffled, species, statsFor, type EntryLike, type Stats } from '../../catalog/domain/creatures.js';
import type { Gender, Ivs, Rarity, RosterEntry } from '../../catalog/domain/roster-entry.js';
import { isHeldItem } from '../../catalog/domain/held-items.js';
import { moveData, moveFor, type MoveData } from './moves.js';

/** A fighter as the battle and the browser see it. */
export interface Fighter {
  uid: string;
  name: string;
  speciesName: string;
  speciesId: number;
  types: string[];
  rarity: Rarity;
  shiny: boolean;
  level: number;
  stats: Stats;
  moves: MoveData[];
  sprite: string;
  floats: boolean;
  ability: string | null;
  abilityInfo: AbilityInfo | null;
  gender: Gender | null;
  nature: string | null;
  natureInfo: NatureInfo | null;
  evs: Ivs;
  speciesBase: Stats;
  ivs: Ivs;
  /** The item it holds (only the Tower gives them), null once it is used up. Absent with none, so battles without items look as they always did. */
  item?: string | null;
}

export const MOVES_PER_FIGHTER = 4;
export const BATTLE_LEVEL = 100;
const NO_EVS: Ivs = { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 };

export function movepool(entry: EntryLike): MoveData[] {
  const owner = { nature: natureFor(entry), types: species(entry).types };
  return learnedMoves(entry).map((id) => moveFor(id, owner) as MoveData);
}

export function usableMovepool(entry: EntryLike): string[] {
  return learnedMoves(entry).filter((id) => (moveData(id) as MoveData).supported);
}

export function defaultMoveset(entry: EntryLike): string[] {
  const origins = moveOrigins(entry);
  const usable = usableMovepool(entry);
  const reached = usable.filter((id) => origins.get(id)!.origin === 'level' && origins.get(id)!.level! <= BATTLE_LEVEL);
  if (reached.length) return reached.slice(-MOVES_PER_FIGHTER);
  if (usable.length) return usable.slice(0, MOVES_PER_FIGHTER);
  return moveEntry('tackle') ? ['tackle'] : [];
}

export function validMoveset(entry: EntryLike, ids: unknown): ids is string[] {
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > MOVES_PER_FIGHTER || new Set(ids).size !== ids.length) return false;
  const pool = new Set(learnedMoves(entry));
  return ids.every((id) => typeof id === 'string' && pool.has(id) && (moveData(id) as MoveData).supported);
}

export function movesetFor(entry: EntryLike): string[] {
  if (!Array.isArray(entry.moveset) || !entry.moveset.length) return defaultMoveset(entry);
  const saved = [...new Set(entry.moveset)].slice(0, MOVES_PER_FIGHTER);
  const pool = new Set(usableMovepool(entry));
  const spares = shuffled([...pool].filter((id) => !saved.includes(id)), rng(`mv:${entry.id ?? entry.finalID}:${saved.join(',')}`));
  const moves = saved.map((id) => (pool.has(id) ? id : spares.shift())).filter(Boolean) as string[];
  return moves.length ? moves : defaultMoveset(entry);
}

export function buildFighter(entry: RosterEntry): Fighter {
  const sp = species(entry);
  const level = entry.battleLevel ?? BATTLE_LEVEL;
  const iv = entry.battleIvs ?? PERFECT_IVS;
  const evs = entry.evs ?? NO_EVS;
  const ability = abilityFor(entry);
  const { hp, atk, def, satk, sdef, spd } = sp.stats;
  const nature = natureFor(entry);
  const stats = statsFor([hp, atk, def, satk, sdef, spd], iv, level, nature, evs);
  return {
    uid: entry.id,
    name: entry.nickname || sp.name,
    speciesName: sp.name,
    speciesId: sp.id,
    types: sp.types,
    rarity: entry.rarity,
    shiny: entry.shiny,
    level,
    stats,
    moves: movesetFor(entry).map((id) => moveFor(id, { nature, types: sp.types }) as MoveData),
    sprite: sp.sprite,
    floats: sp.floats,
    ability,
    abilityInfo: abilityInfo(ability),
    gender: genderFor(entry),
    nature,
    natureInfo: nature ? natureInfo(nature) : null,
    ivs: iv,
    evs,
    speciesBase: sp.stats,
    ...(isHeldItem(entry.heldItem) ? { item: entry.heldItem } : {}),
  };
}

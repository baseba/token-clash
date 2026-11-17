// The JSON shapes the frontend reads for a trainer and their Pokémon. Presenters only read.
import { abilityInfo } from '../../catalog/domain/abilities.js';
import { abilityOptions, lineageLearnset, moveOrigins, speciesData } from '../../catalog/domain/creatures.js';
import { buildFighter, movepool, movesetFor, validMoveset, MOVES_PER_FIGHTER } from '../../combat/domain/fighter.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import type { Trainer } from '../domain/trainer.js';

export function trainerSummary(trainer: Trainer) {
  return {
    id: trainer.id,
    name: trainer.name,
    wins: trainer.wins,
    losses: trainer.losses,
    rosterSize: trainer.roster.length,
    shinies: trainer.shinies,
    totalTokens: trainer.totalTokens,
  };
}

/** What "Descargar save editado" writes back into the PokeTokenBar save for one Pokémon. */
export function saveEdit(entry: RosterEntry) {
  if (!entry.moveset && !entry.abilityChoice) return null;
  const data = speciesData(entry.finalID);
  const level = new Map([...lineageLearnset(entry.finalID)].map(([id, m]) => [id, m.level]));
  const out: { id: string; currentMoves?: { name: string; level: number }[]; ability?: { name: string; slot: number; hidden: boolean } } = {
    id: entry.id,
  };
  if (entry.moveset && validMoveset(entry, entry.moveset)) out.currentMoves = entry.moveset.map((name) => ({ name, level: level.get(name) ?? 1 }));
  if (entry.abilityChoice && data) {
    const hidden = data.hiddenAbility === entry.abilityChoice && !data.abilities.includes(entry.abilityChoice);
    out.ability = { name: entry.abilityChoice, slot: hidden ? 3 : data.abilities.indexOf(entry.abilityChoice) + 1, hidden };
  }
  return out.currentMoves || out.ability ? out : null;
}

/** The logged-in trainer, with their whole collection. */
export function myView(trainer: Trainer, aiLevels: string[]) {
  return {
    ...trainerSummary(trainer),
    team: trainer.team,
    aiLevels,
    roster: trainer.roster
      .map((e) => ({ ...buildFighter(e), active: !!e.active, nickname: e.nickname || null, saveEdit: saveEdit(e) }))
      .sort((a, b) => a.speciesId - b.speciesId),
  };
}

/** One Pokémon with everything the collection screen can change (moves, ability). */
export function monDetail(entry: RosterEntry) {
  const chosen = new Set(movesetFor(entry));
  const origins = moveOrigins(entry);
  return {
    ...buildFighter(entry),
    nickname: entry.nickname || null,
    movepool: movepool(entry).map((m) => ({
      ...origins.get(m.key),
      key: m.key,
      name: m.name,
      desc: m.desc,
      type: m.type,
      category: m.category,
      power: m.power,
      accuracy: m.accuracy,
      pp: m.pp,
      priority: m.priority,
      contact: m.flags.includes('contact'),
      supported: m.supported,
      chosen: chosen.has(m.key),
    })),
    abilityOptions: abilityOptions(entry).map((a) => ({ ...abilityInfo(a.key), hidden: a.hidden })),
    maxMoves: MOVES_PER_FIGHTER,
  };
}

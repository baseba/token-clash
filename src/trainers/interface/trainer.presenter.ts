// The JSON shapes the frontend reads for a trainer and their Pokémon. Presenters only read.
import { abilityInfo } from '../../catalog/domain/abilities.js';
import { abilityOptions, buildFighter, lineageLearnset, moveOrigins, movepool, movesetFor, speciesData, validMoveset, MOVES_PER_FIGHTER } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import type { Trainer } from '../domain/trainer.js';

export function trainerSummary(t: Trainer) {
  return { id: t.id, name: t.name, wins: t.wins, losses: t.losses, rosterSize: t.roster.length, shinies: t.shinies, totalTokens: t.totalTokens };
}

/** What "Descargar save editado" writes back into the PokeTokenBar save for one Pokémon. */
export function saveEdit(e: RosterEntry) {
  if (!e.moveset && !e.abilityChoice) return null;
  const data = speciesData(e.finalID);
  const level = new Map([...lineageLearnset(e.finalID)].map(([id, m]) => [id, m.level]));
  const out: { id: string; currentMoves?: { name: string; level: number }[]; ability?: { name: string; slot: number; hidden: boolean } } = { id: e.id };
  if (e.moveset && validMoveset(e, e.moveset)) out.currentMoves = e.moveset.map((name) => ({ name, level: level.get(name) ?? 1 }));
  if (e.abilityChoice && data) {
    const hidden = data.hiddenAbility === e.abilityChoice && !data.abilities.includes(e.abilityChoice);
    out.ability = { name: e.abilityChoice, slot: hidden ? 3 : data.abilities.indexOf(e.abilityChoice) + 1, hidden };
  }
  return out.currentMoves || out.ability ? out : null;
}

/** The logged-in trainer, with their whole collection. */
export function myView(t: Trainer, aiLevels: string[]) {
  return {
    ...trainerSummary(t),
    team: t.team,
    aiLevels,
    roster: t.roster.map((e) => ({ ...buildFighter(e), active: !!e.active, nickname: e.nickname || null, saveEdit: saveEdit(e) })).sort((a, b) => a.speciesId - b.speciesId),
  };
}

/** One Pokémon with everything the collection screen can change (moves, ability). */
export function monDetail(e: RosterEntry) {
  const chosen = new Set(movesetFor(e));
  const origins = moveOrigins(e);
  return {
    ...buildFighter(e),
    nickname: e.nickname || null,
    movepool: movepool(e).map((m) => ({ ...origins.get(m.key), key: m.key, name: m.name, desc: m.desc, type: m.type, category: m.category, power: m.power, accuracy: m.accuracy, pp: m.pp, priority: m.priority, contact: m.flags.includes('contact'), supported: m.supported, chosen: chosen.has(m.key) })),
    abilityOptions: abilityOptions(e).map((a) => ({ ...abilityInfo(a.key), hidden: a.hidden })),
    maxMoves: MOVES_PER_FIGHTER,
  };
}

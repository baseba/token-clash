// Random battle: the dice draw up to 6 of a collection, no repeated species, each with random
// moves and ability among the ones that work in Token Clash. Randomness is injected.
import { abilityOptions, usableAbility, shuffled, type Random } from '../../catalog/domain/creatures.js';
import { usableMovepool, MOVES_PER_FIGHTER } from './fighter.js';
import { uniqueSpecies, type RosterEntry } from '../../catalog/domain/roster-entry.js';
import { PARTY_SIZE } from './team-preview.js';

export { shuffled };

export function randomMoveset(entry: RosterEntry, random: Random = Math.random): string[] {
  return shuffled(usableMovepool(entry), random).slice(0, MOVES_PER_FIGHTER);
}

export function randomAbility(entry: RosterEntry, random: Random = Math.random): string | null {
  const options = abilityOptions(entry).filter((a) => usableAbility(a.key));
  return options.length ? options[Math.floor(random() * options.length)].key : null;
}

export function randomize(entry: RosterEntry, random: Random = Math.random): RosterEntry {
  const out = { ...entry };
  delete out.moveset;
  delete out.abilityChoice;
  const moveset = randomMoveset(entry, random);
  if (moveset.length) out.moveset = moveset;
  const ability = randomAbility(entry, random);
  if (ability) out.abilityChoice = ability;
  return out;
}

export function randomParty(roster: RosterEntry[], random: Random = Math.random): RosterEntry[] {
  return uniqueSpecies(shuffled(roster, random))
    .slice(0, PARTY_SIZE)
    .map((e) => randomize(e, random));
}

import { usableMovepool, abilityOptions, usableAbility, shuffled, MOVES_PER_FIGHTER } from './creatures.js';
import { PARTY_SIZE } from './preview.js';
import { uniqueSpecies } from './save.js';

export { shuffled };

export function randomMoveset(entry, random = Math.random) {
  return shuffled(usableMovepool(entry), random).slice(0, MOVES_PER_FIGHTER);
}

export function randomAbility(entry, random = Math.random) {
  const options = abilityOptions(entry).filter((a) => usableAbility(a.key));
  return options.length ? options[Math.floor(random() * options.length)].key : null;
}

export function randomize(entry, random = Math.random) {
  const out = { ...entry };
  delete out.moveset;
  delete out.abilityChoice;
  const moveset = randomMoveset(entry, random);
  if (moveset.length) out.moveset = moveset;
  const ability = randomAbility(entry, random);
  if (ability) out.abilityChoice = ability;
  return out;
}

export function randomParty(roster, random = Math.random) {
  return uniqueSpecies(shuffled(roster, random))
    .slice(0, PARTY_SIZE)
    .map((e) => randomize(e, random));
}

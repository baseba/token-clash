// Random battle: the dice draw up to 6 of a collection, no repeated species, each with random
// moves and ability among the ones that work in Token Clash. Randomness is injected.
import { abilityOptions, usableAbility, shuffled, NATURE_KEYS, type Random } from '../../catalog/domain/creatures.js';
import { usableMovepool, MOVES_PER_FIGHTER } from './fighter.js';
import { moveData } from './moves.js';
import { MOVE_RULES } from './move-rules.js';
import { uniqueSpecies, type Ivs, type RosterEntry } from '../../catalog/domain/roster-entry.js';
import { MAX_EV, MAX_EV_TOTAL, STAT_KEYS } from '../../../public/stat-formula.js';
import { conflict, invalid } from '../../shared/domain/errors.js';
import { PARTY_SIZE, type PreviewState } from './team-preview.js';

export { shuffled };

export const GUARANTEED_ATTACKS = 2;
const EV_STEP = 4;

const SITUATIONAL_ATTACKS = new Set([
  'dream-eater', 'snore', 'sucker-punch', 'thunderclap', 'focus-punch', 'shell-trap', 'last-resort', 'steel-roller',
  'synchronoise', 'spit-up', 'endeavor', 'counter', 'mirror-coat', 'metal-burst', 'comeuppance', 'bide',
]);

export function alwaysDamages(id: string): boolean {
  const move = moveData(id);
  if (!move || move.kind !== 'attack' || !move.supported) return false;
  if (SITUATIONAL_ATTACKS.has(id) || move.firstTurnOnly || move.losesType || move.selfCost) return false;
  const rule = MOVE_RULES[id];
  return move.power > 0 || move.fixedDamage !== undefined || !!rule?.damage || !!rule?.power;
}

export function randomMoveset(entry: RosterEntry, random: Random = Math.random): string[] {
  const pool = shuffled(usableMovepool(entry), random);
  const sure = pool.filter(alwaysDamages).slice(0, GUARANTEED_ATTACKS);
  const rest = pool.filter((id) => !sure.includes(id)).slice(0, MOVES_PER_FIGHTER - sure.length);
  return shuffled([...sure, ...rest], random);
}

export function randomAbility(entry: RosterEntry, random: Random = Math.random): string | null {
  const options = abilityOptions(entry).filter((a) => usableAbility(a.key));
  return options.length ? options[Math.floor(random() * options.length)].key : null;
}

export function randomEvs(random: Random = Math.random): Ivs {
  const evs: Ivs = { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 };
  const keys = STAT_KEYS as (keyof Ivs)[];
  let left = MAX_EV_TOTAL;
  while (left > 0) {
    const step = Math.min(EV_STEP, left);
    const open = keys.filter((key) => evs[key] + step <= MAX_EV);
    const key = open[Math.floor(random() * open.length)];
    evs[key] += step;
    left -= step;
  }
  return evs;
}

export const randomNature = (random: Random = Math.random): string => NATURE_KEYS[Math.floor(random() * NATURE_KEYS.length)];

export function randomize(entry: RosterEntry, random: Random = Math.random): RosterEntry {
  const out = { ...entry };
  delete out.moveset;
  delete out.abilityChoice;
  delete out.natureChoice;
  const moveset = randomMoveset(entry, random);
  if (moveset.length) out.moveset = moveset;
  const ability = randomAbility(entry, random);
  if (ability) out.abilityChoice = ability;
  out.natureChoice = randomNature(random);
  out.evs = randomEvs(random);
  return out;
}

export function randomParty(roster: RosterEntry[], random: Random = Math.random): RosterEntry[] {
  return uniqueSpecies(shuffled(roster, random))
    .slice(0, PARTY_SIZE)
    .map((e) => randomize(e, random));
}

export function reroll(preview: PreviewState, sideIndex: number, index: number, candidates: RosterEntry[], random: Random = Math.random): void {
  const side = preview.sides[sideIndex];
  if (preview.mode !== 'random') throw conflict('Solo se puede cambiar un Pokémon en las batallas aleatorias.');
  if (side.rerolled !== undefined) throw conflict('Ya usaste tu cambio de dados.');
  if (side.picks) throw conflict('Ya elegiste tu equipo.');
  if (!Number.isInteger(index) || index < 0 || index >= side.entries.length) throw invalid('Ese Pokémon no está en tu equipo.');
  const taken = new Set(side.entries.map((entry) => entry.finalID));
  const [fresh] = uniqueSpecies(shuffled(candidates.filter((entry) => !taken.has(entry.finalID)), random));
  side.entries = side.entries.map((entry, i) => (i === index ? randomize(fresh ?? entry, random) : entry));
  side.draft = side.draft?.filter((i) => i !== index);
  side.rerolled = index;
}

import { buildFighter } from './creatures.js';

export const PARTY_SIZE = 6;
export const BATTLE_SIZE = 3;

export function createPreview({ sides, levelCap = null, mode = 'team' }) {
  return {
    levelCap,
    mode,
    sides: sides.map((s) => ({ trainerId: s.trainerId, name: s.name, entries: s.entries.slice(0, PARTY_SIZE), picks: null })),
  };
}

export const picksNeeded = (p, s) => Math.min(BATTLE_SIZE, p.sides[s].entries.length);

export function validPicks(p, s, picks) {
  const n = picksNeeded(p, s);
  return Array.isArray(picks) && picks.length === n && new Set(picks).size === n && picks.every((i) => Number.isInteger(i) && i >= 0 && i < p.sides[s].entries.length);
}

export function pick(p, s, picks) {
  if (p.sides[s].picks) throw new Error('Ya elegiste tu equipo.');
  if (!validPicks(p, s, picks)) throw new Error(`Elige ${picksNeeded(p, s)} Pokémon distintos.`);
  p.sides[s].picks = [...picks];
}

export function randomPicks(p, s, random = Math.random) {
  const order = p.sides[s].entries.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order.slice(0, picksNeeded(p, s));
}

export function fillMissing(p, random = Math.random) {
  p.sides.forEach((side, s) => {
    if (!side.picks) side.picks = randomPicks(p, s, random);
  });
}

export const previewReady = (p) => p.sides.every((s) => s.picks);

export const chosenEntries = (p, s) => p.sides[s].picks.map((i) => p.sides[s].entries[i]);

function seenCard(f) {
  return { name: f.name, speciesName: f.speciesName, sprite: f.sprite, shiny: f.shiny, floats: f.floats, rarity: f.rarity, types: f.types };
}

export function previewView(p, viewer = null) {
  return {
    levelCap: p.levelCap,
    mode: p.mode ?? 'team',
    sides: p.sides.map((side, s) => {
      const fighters = side.entries.map((e) => buildFighter(e, { levelCap: p.levelCap }));
      const own = viewer === s;
      return {
        trainerId: side.trainerId,
        name: side.name,
        ready: !!side.picks,
        needed: picksNeeded(p, s),
        party: own ? fighters : fighters.map(seenCard),
        picks: own ? side.picks : null,
      };
    }),
  };
}

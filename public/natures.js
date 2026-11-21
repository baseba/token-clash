export const HIDDEN_POWER_BY_NATURE = {
  hardy: 'fighting', hasty: 'flying', naive: 'flying', sassy: 'poison', lax: 'ground',
  modest: 'ground', adamant: 'rock', timid: 'bug', lonely: 'ghost', bashful: 'ghost',
  serious: 'steel', careful: 'steel', brave: 'fire', rash: 'fire', docile: 'water',
  quiet: 'water', relaxed: 'grass', gentle: 'grass', impish: 'electric', quirky: 'psychic',
  calm: 'ice', bold: 'dragon', naughty: 'dark', jolly: 'fairy', mild: 'fairy',
};

export const DEFAULT_HIDDEN_POWER = 'fighting';

export const hiddenPowerType = (nature) => HIDDEN_POWER_BY_NATURE[nature] ?? DEFAULT_HIDDEN_POWER;

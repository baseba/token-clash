const TIERS = { free: 1, common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
const SFX = (name) => `prsfx-${name}.wav`;

const DARK = ['#c8c6d0', '#5c5966', '#22202a'];
const GOLD = ['#fff4c2', '#e6b422', '#a8740f'];

const THEMES = {
  gb: { sounds: [['swift1', 0, 0.6]], rarity: 'common', colors: ['#e3f0ff', '#409bf4', '#236ec1'], accent: ['#ffd0dd', '#de4173', '#a0284e'], shape: 'star', accentShape: 'dot', motion: 'twinkle' },
  mt: { sounds: [['magical-leaf1', 0, 0.7]], rarity: 'free', colors: ['#d8fff0', '#2fc28c', '#0f5c45'], accent: ['#ffffff', '#b8f5dc', '#2fc28c'], shape: 'leaf', accentShape: 'dot', motion: 'fall' },
  sk: { sounds: [['petal-dance', 0, 0.6]], rarity: 'free', colors: ['#ffe8f2', '#ff8fbf', '#b8336f'], accent: ['#ffffff', '#ffd0e4', '#ff6fae'], shape: 'petal', accentShape: 'petal', motion: 'fall' },
  gv: { sounds: [['fairy-wind', 0, 0.6]], rarity: 'common', colors: ['#ece0ff', '#9a62ec', '#5a24a0'], accent: ['#c8fff6', '#1fb3a1', '#0e6a60'], shape: 'star', accentShape: 'dot', motion: 'twinkle' },
  ub: { sounds: [['spark1', 0, 0.6]], rarity: 'rare', colors: ['#fff6c0', '#eaab1d', '#ab7807'], accent: DARK, shape: 'spark', accentShape: 'star', motion: 'twinkle' },
  lb: { sounds: [['charm', 0, 0.7]], rarity: 'rare', colors: ['#ffe0a0', '#ff9c08', '#e64a18'], accent: ['#8a8a80', '#414141', '#181818'], shape: 'star', accentShape: 'orb', motion: 'twinkle' },
  ic: { sounds: [['ice-shard', 0, 0.8]], rarity: 'rare', colors: ['#ffffff', '#6cc6ff', '#2f7fbf'], accent: ['#ffffff', '#d8f2ff', '#8fd4ff'], shape: 'shard', accentShape: 'flake', motion: 'fall' },
  vo: { sounds: [['flame-burst', 0, 0.7]], rarity: 'rare', colors: ['#ffe08a', '#ff6a1f', '#8a2a0c'], accent: ['#6a6a72', '#2a2a30', '#141418'], shape: 'flame', accentShape: 'chunk', motion: 'rise' },
  ge: { sounds: [['leafage-1', 0, 0.8]], rarity: 'rare', colors: ['#d0ffe4', '#36cf7c', '#1a7a48'], accent: ['#fff0b0', '#d9a51c', '#8a6510'], shape: 'leaf', accentShape: 'star', motion: 'fall' },
  ur: { sounds: [['spark1', 0, 0.6, 0.9]], rarity: 'rare', colors: ['#ffd0d8', '#ea1d3f', '#ab0722'], accent: DARK, shape: 'spark', accentShape: 'star', motion: 'twinkle' },
  lz: { sounds: [['bubble', 0, 0.8]], rarity: 'rare', colors: ['#c8e8ff', '#0898ff', '#183ae6'], accent: ['#ffffff', '#9fd8ff', '#0898ff'], shape: 'drop', accentShape: 'bubble', motion: 'rise' },
  le: { sounds: [['magical-leaf1', 0, 0.7, 1.1]], rarity: 'rare', colors: ['#d8ffe0', '#3df07a', '#2a9a18'], accent: ['#ffffff', '#c8ffd8', '#08ff5a'], shape: 'leaf', accentShape: 'star', motion: 'fall' },
  rb: { sounds: [['swift1', 0, 0.7], ['power-gem1', 120, 0.5]], rarity: 'epic', colors: ['#c9c4ff', '#3324a7', '#21167e'], accent: ['#ffd0d0', '#da3838', '#8a1a1a'], shape: 'shard', accentShape: 'star', motion: 'swirl' },
  sd: { sounds: [['shadow-ball1', 0, 0.8], ['night-shade', 150, 0.5]], rarity: 'epic', colors: ['#b8b4c8', '#4b2a73', '#1a1024'], accent: ['#e8dcff', '#8a6fd0', '#2e1b45'], shape: 'smoke', accentShape: 'orb', motion: 'drift', shadow: true },
  up: { sounds: [['ice-shard', 0, 0.7, 1.2], ['power-gem1', 120, 0.5]], rarity: 'epic', colors: ['#ffffff', '#9fb6e0', '#5f78a8'], accent: ['#ffffff', '#e8f0ff', '#b8c8e8'], shape: 'shard', accentShape: 'star', motion: 'twinkle' },
  rc: { sounds: [['swift1', 0, 0.7, 0.9], ['power-gem1', 120, 0.5]], rarity: 'epic', colors: ['#ffd0d8', '#a7243a', '#561923'], accent: ['#d0e8ff', '#3889da', '#1a4a8a'], shape: 'shard', accentShape: 'star', motion: 'swirl' },
  rj: { sounds: [['swift1', 0, 0.7, 1.1], ['power-gem1', 120, 0.5]], rarity: 'epic', colors: ['#c8fff0', '#24a786', '#167e64'], accent: ['#fff0b0', '#dab238', '#8a6a10'], shape: 'shard', accentShape: 'star', motion: 'swirl' },
  mb: { sounds: [['cosmic-power', 0, 0.7], ['moonblast1', 150, 0.5], ['flash', 0, 0.5]], rarity: 'legendary', colors: ['#f0d0ff', '#a441bd', '#73109c'], accent: ['#ffd0de', '#cf4166', '#8a2040'], shape: 'star', accentShape: 'orb', motion: 'swirl' },
  au: { sounds: [['pay-day1', 0, 0.8], ['pay-day2', 220, 0.6], ['flash', 0, 0.5]], rarity: 'legendary', colors: GOLD, accent: ['#ffffff', '#fff8e1', '#e6b422'], shape: 'coin', accentShape: 'star', motion: 'fall' },
  mc: { sounds: [['cosmic-power', 0, 0.7], ['aqua-ring1', 150, 0.6], ['flash', 0, 0.5]], rarity: 'legendary', colors: ['#d8f4ff', '#419ebd', '#10799c'], accent: ['#ffd0e8', '#cf4188', '#8a2050'], shape: 'star', accentShape: 'orb', motion: 'swirl' },
  mo: { sounds: [['dark-pulse1', 0, 0.7], ['night-shade', 150, 0.6], ['flash', 0, 0.4]], rarity: 'legendary', colors: ['#a8a0ac', '#504752', '#2a232e'], accent: ['#ffd0d0', '#d63a3a', '#7a1a1a'], shape: 'smoke', accentShape: 'spark', motion: 'drift', shadow: true },
  oc: { sounds: [['bubblebeam', 0, 0.7]], rarity: 'free', colors: ['#e0f6ff', '#2fa6dd', '#11679a'], accent: ['#ffffff', '#b6ecff', '#2fa6dd'], shape: 'drop', accentShape: 'bubble', motion: 'rise' },
  li: { sounds: [['magical-leaf1', 0, 0.7, 1.15]], rarity: 'free', colors: ['#f0ffd0', '#a6dd2f', '#6a9a11'], accent: ['#ffffff', '#e6ffb6', '#a6dd2f'], shape: 'leaf', accentShape: 'dot', motion: 'fall' },
  tr: { sounds: [['mud-slap', 0, 0.8]], rarity: 'common', colors: ['#f3e0c0', '#a86f3a', '#6b4220'], accent: ['#e8c79a', '#8a6a40', '#3d2410'], shape: 'chunk', accentShape: 'dot', motion: 'rise' },
  ma: { sounds: [['fairy-wind', 0, 0.6, 0.9]], rarity: 'free', colors: ['#f6ecff', '#b48fd4', '#7a5294'], accent: ['#ffffff', '#efe0ff', '#b48fd4'], shape: 'petal', accentShape: 'star', motion: 'fall' },
  gn: { sounds: [['swift1', 0, 0.6, 0.9]], rarity: 'common', colors: ['#ffe6c8', '#ff9a3c', '#c2560f'], accent: ['#d0e8ff', '#3f8fe0', '#1a4a8a'], shape: 'star', accentShape: 'dot', motion: 'twinkle' },
  tx: { sounds: [['sludge', 0, 0.8], ['acid', 150, 0.5]], rarity: 'rare', colors: ['#f0dcff', '#9b4fd1', '#5a1f86'], accent: ['#efffc8', '#a8e04a', '#5f8a1c'], shape: 'bubble', accentShape: 'drop', motion: 'rise' },
  el: { sounds: [['thunderbolt1', 0, 0.6], ['spark1', 120, 0.5]], rarity: 'rare', colors: ['#fffbe0', '#ffd21f', '#b38a00'], accent: ['#ffffff', '#fff4b0', '#ffd21f'], shape: 'spark', accentShape: 'star', motion: 'twinkle' },
  fn: { sounds: [['night-shade', 0, 0.7], ['confuse-ray', 150, 0.5]], rarity: 'rare', colors: ['#d6d0ff', '#7d74b8', '#24203a'], accent: ['#ffffff', '#c8c0ff', '#5a5294'], shape: 'smoke', accentShape: 'orb', motion: 'drift', shadow: true },
  ac: { sounds: [['metal-sound', 0, 0.6], ['iron-defense', 150, 0.5]], rarity: 'rare', colors: ['#ffffff', '#a7b3c0', '#66707c'], accent: ['#ffffff', '#eef3f8', '#a7b3c0'], shape: 'shard', accentShape: 'star', motion: 'twinkle' },
  ps: { sounds: [['psybeam', 0, 0.6], ['confusion', 150, 0.5]], rarity: 'rare', colors: ['#ffe0f2', '#f04ea3', '#a01868'], accent: ['#ffffff', '#ffd0ea', '#f04ea3'], shape: 'ring', accentShape: 'star', motion: 'swirl' },
  ua: { sounds: [['aqua-ring1', 0, 0.7]], rarity: 'rare', colors: ['#d8fffb', '#2fd6cf', '#0f7f7a'], accent: DARK, shape: 'drop', accentShape: 'star', motion: 'twinkle' },
  uv: { sounds: [['spark1', 0, 0.6, 0.85]], rarity: 'rare', colors: ['#f0dcff', '#a54ff0', '#5a1fa0'], accent: DARK, shape: 'spark', accentShape: 'star', motion: 'twinkle' },
  lr: { sounds: [['charm', 0, 0.7, 0.9]], rarity: 'rare', colors: ['#ffd8dc', '#ff4a5a', '#a0182a'], accent: ['#8a8a80', '#414141', '#181818'], shape: 'star', accentShape: 'orb', motion: 'twinkle' },
  dc: { sounds: [['dragon-pulse', 0, 0.7], ['twister', 180, 0.5]], rarity: 'epic', colors: ['#e0dcff', '#5a4ff0', '#2a2399'], accent: ['#fff4c8', '#ffd35e', '#c98a1a'], shape: 'flame', accentShape: 'star', motion: 'swirl' },
  cs: { sounds: [['cosmic-power', 0, 0.7], ['moonblast1', 180, 0.4]], rarity: 'epic', colors: ['#e8dcff', '#5a2f9a', '#1f1858'], accent: ['#ffffff', '#ffc8ec', '#ff9ad8'], shape: 'star', accentShape: 'orb', motion: 'swirl' },
  ro: { sounds: [['dark-pulse1', 0, 0.7], ['swift1', 150, 0.5]], rarity: 'epic', colors: ['#a8a4b0', '#4a4652', '#1e1c24'], accent: ['#ffd0d0', '#da3838', '#7a1a1a'], shape: 'smoke', accentShape: 'spark', motion: 'drift', shadow: true },
  rv: { sounds: [['swift1', 0, 0.7, 0.95], ['power-gem1', 120, 0.5]], rarity: 'epic', colors: ['#ecd8ff', '#8a3fd8', '#4a1a86'], accent: ['#fff4c8', '#ffd35e', '#a8740f'], shape: 'shard', accentShape: 'star', motion: 'swirl' },
  rs: { sounds: [['pay-day1', 0, 0.7], ['petal-dance', 150, 0.5], ['flash', 0, 0.5]], rarity: 'legendary', colors: ['#ffe8e2', '#e8a093', '#b05a4f'], accent: ['#ffffff', '#fff3e8', '#e8a093'], shape: 'coin', accentShape: 'petal', motion: 'fall' },
  ms: { sounds: [['cosmic-power', 0, 0.7], ['magical-leaf1', 150, 0.5], ['flash', 0, 0.5]], rarity: 'legendary', colors: ['#d8ffe6', '#2fcf7a', '#127a42'], accent: ['#fff4c8', '#ffd35e', '#a8740f'], shape: 'star', accentShape: 'leaf', motion: 'swirl' },
  mr: { sounds: [['cosmic-power', 0, 0.7], ['flame-burst', 150, 0.5], ['flash', 0, 0.5]], rarity: 'legendary', colors: ['#ffd8dc', '#e8293f', '#8a0c1e'], accent: ['#d0e8ff', '#3f8fe0', '#1a4a8a'], shape: 'star', accentShape: 'orb', motion: 'swirl' },
  mp: { sounds: [['ice-shard', 0, 0.7, 1.1], ['flash', 0, 0.6], ['healing-wish', 350, 0.6], ['sparkling-aria1', 700, 0.4]], rarity: 'mythic', colors: ['#ffffff', '#aab8e0', '#5f6c93'], accent: ['#ffffff', '#c9b4ff', '#5fd0ff'], shape: 'shard', accentShape: 'star', motion: 'swirl' },
  md: { sounds: [['pay-day1', 0, 0.8], ['pay-day2', 220, 0.7], ['flash', 0, 0.6], ['healing-wish', 350, 0.6], ['sparkling-aria1', 700, 0.4]], rarity: 'mythic', colors: GOLD, accent: ['#ffffff', '#ffd75e', '#c98a1a'], shape: 'star', accentShape: 'coin', motion: 'fall' },
};

export function ballFx(key) {
  const theme = THEMES[key];
  return theme ? { ...theme, tier: TIERS[theme.rarity] } : null;
}

export const BALL_FX_KEYS = Object.keys(THEMES);

export function ballSounds(key) {
  return (THEMES[key]?.sounds ?? []).map(([name, at, gain, rate = 1]) => ({ sound: SFX(name), at, gain, rate }));
}

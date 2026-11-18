const TIERS = { common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };

const DARK = ['#c8c6d0', '#5c5966', '#22202a'];
const GOLD = ['#fff4c2', '#e6b422', '#a8740f'];

const THEMES = {
  gb: { rarity: 'common', colors: ['#e3f0ff', '#409bf4', '#236ec1'], accent: ['#ffd0dd', '#de4173', '#a0284e'], shape: 'star', accentShape: 'dot', motion: 'twinkle' },
  mt: { rarity: 'common', colors: ['#d8fff0', '#2fc28c', '#0f5c45'], accent: ['#ffffff', '#b8f5dc', '#2fc28c'], shape: 'leaf', accentShape: 'dot', motion: 'fall' },
  sk: { rarity: 'common', colors: ['#ffe8f2', '#ff8fbf', '#b8336f'], accent: ['#ffffff', '#ffd0e4', '#ff6fae'], shape: 'petal', accentShape: 'petal', motion: 'fall' },
  gv: { rarity: 'common', colors: ['#ece0ff', '#9a62ec', '#5a24a0'], accent: ['#c8fff6', '#1fb3a1', '#0e6a60'], shape: 'star', accentShape: 'dot', motion: 'twinkle' },
  ub: { rarity: 'rare', colors: ['#fff6c0', '#eaab1d', '#ab7807'], accent: DARK, shape: 'spark', accentShape: 'star', motion: 'twinkle' },
  lb: { rarity: 'rare', colors: ['#ffe0a0', '#ff9c08', '#e64a18'], accent: ['#8a8a80', '#414141', '#181818'], shape: 'star', accentShape: 'orb', motion: 'twinkle' },
  ic: { rarity: 'rare', colors: ['#ffffff', '#6cc6ff', '#2f7fbf'], accent: ['#ffffff', '#d8f2ff', '#8fd4ff'], shape: 'shard', accentShape: 'flake', motion: 'fall' },
  vo: { rarity: 'rare', colors: ['#ffe08a', '#ff6a1f', '#8a2a0c'], accent: ['#6a6a72', '#2a2a30', '#141418'], shape: 'flame', accentShape: 'chunk', motion: 'rise' },
  ge: { rarity: 'rare', colors: ['#d0ffe4', '#36cf7c', '#1a7a48'], accent: ['#fff0b0', '#d9a51c', '#8a6510'], shape: 'leaf', accentShape: 'star', motion: 'fall' },
  ur: { rarity: 'rare', colors: ['#ffd0d8', '#ea1d3f', '#ab0722'], accent: DARK, shape: 'spark', accentShape: 'star', motion: 'twinkle' },
  lz: { rarity: 'rare', colors: ['#c8e8ff', '#0898ff', '#183ae6'], accent: ['#ffffff', '#9fd8ff', '#0898ff'], shape: 'drop', accentShape: 'bubble', motion: 'rise' },
  le: { rarity: 'rare', colors: ['#d8ffe0', '#3df07a', '#2a9a18'], accent: ['#ffffff', '#c8ffd8', '#08ff5a'], shape: 'leaf', accentShape: 'star', motion: 'fall' },
  rb: { rarity: 'epic', colors: ['#c9c4ff', '#3324a7', '#21167e'], accent: ['#ffd0d0', '#da3838', '#8a1a1a'], shape: 'shard', accentShape: 'star', motion: 'swirl' },
  sd: { rarity: 'epic', colors: ['#b8b4c8', '#4b2a73', '#1a1024'], accent: ['#e8dcff', '#8a6fd0', '#2e1b45'], shape: 'smoke', accentShape: 'orb', motion: 'drift', shadow: true },
  up: { rarity: 'epic', colors: ['#ffffff', '#9fb6e0', '#5f78a8'], accent: ['#ffffff', '#e8f0ff', '#b8c8e8'], shape: 'shard', accentShape: 'star', motion: 'twinkle' },
  rc: { rarity: 'epic', colors: ['#ffd0d8', '#a7243a', '#561923'], accent: ['#d0e8ff', '#3889da', '#1a4a8a'], shape: 'shard', accentShape: 'star', motion: 'swirl' },
  rj: { rarity: 'epic', colors: ['#c8fff0', '#24a786', '#167e64'], accent: ['#fff0b0', '#dab238', '#8a6a10'], shape: 'shard', accentShape: 'star', motion: 'swirl' },
  mb: { rarity: 'legendary', colors: ['#f0d0ff', '#a441bd', '#73109c'], accent: ['#ffd0de', '#cf4166', '#8a2040'], shape: 'star', accentShape: 'orb', motion: 'swirl' },
  au: { rarity: 'legendary', colors: GOLD, accent: ['#ffffff', '#fff8e1', '#e6b422'], shape: 'coin', accentShape: 'star', motion: 'fall' },
  mc: { rarity: 'legendary', colors: ['#d8f4ff', '#419ebd', '#10799c'], accent: ['#ffd0e8', '#cf4188', '#8a2050'], shape: 'star', accentShape: 'orb', motion: 'swirl' },
  mo: { rarity: 'legendary', colors: ['#a8a0ac', '#504752', '#2a232e'], accent: ['#ffd0d0', '#d63a3a', '#7a1a1a'], shape: 'smoke', accentShape: 'spark', motion: 'drift', shadow: true },
  md: { rarity: 'mythic', colors: GOLD, accent: ['#ffffff', '#ffd75e', '#c98a1a'], shape: 'star', accentShape: 'coin', motion: 'fall' },
};

export function ballFx(key) {
  const theme = THEMES[key];
  return theme ? { ...theme, tier: TIERS[theme.rarity] } : null;
}

export const BALL_FX_KEYS = Object.keys(THEMES);

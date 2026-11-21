const TIERS = { free: 1, common: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 };
export const SYNTH_PREFIX = 'synth:';
const SFX = (name) => (name.startsWith(SYNTH_PREFIX) ? name : `prsfx-${name}.wav`);

const DARK = ['#c8c6d0', '#5c5966', '#22202a'];
const GOLD = ['#fff4c2', '#e6b422', '#a8740f'];

const THEMES = {
  gb: { sounds: [['swift1', 0, 0.6]], rarity: 'common', colors: ['#e3f0ff', '#409bf4', '#236ec1'], accent: ['#ffd0dd', '#de4173', '#a0284e'], shape: 'star', accentShape: 'dot', motion: 'twinkle', signature: ['comet'] },
  mt: { sounds: [['aromatherapy', 0, 0.6]], rarity: 'free', colors: ['#d8fff0', '#2fc28c', '#0f5c45'], accent: ['#ffffff', '#b8f5dc', '#2fc28c'], shape: 'dot', accentShape: 'flake', motion: 'rise', signature: ['mint'] },
  sk: { sounds: [['petal-dance', 0, 0.6]], rarity: 'free', colors: ['#ffe8f2', '#ff8fbf', '#b8336f'], accent: ['#ffffff', '#ffd0e4', '#ff6fae'], shape: 'petal', accentShape: 'petal', motion: 'fall', signature: ['gust'] },
  ub: { sounds: [['agility', 0, 0.6], ['spark1', 150, 0.4]], rarity: 'rare', colors: ['#fff6c0', '#eaab1d', '#ab7807'], accent: DARK, shape: 'spark', accentShape: 'star', motion: 'twinkle', signature: ['chevrons'] },
  lb: { sounds: [['charm', 0, 0.6], ['attract1', 150, 0.4]], rarity: 'rare', colors: ['#ffe0a0', '#ff9c08', '#e64a18'], accent: ['#8a8a80', '#414141', '#181818'], shape: 'star', accentShape: 'orb', motion: 'twinkle', signature: ['ribbon'] },
  ic: { sounds: [['ice-shard', 0, 0.8], ['icy-wind1', 250, 0.4]], rarity: 'rare', colors: ['#ffffff', '#6cc6ff', '#2f7fbf'], accent: ['#ffffff', '#d8f2ff', '#8fd4ff'], shape: 'shard', accentShape: 'flake', motion: 'fall', signature: ['frost', 'snowfall'] },
  vo: { sounds: [['eruption1', 0, 0.7], ['rock-throw1', 200, 0.4]], rarity: 'rare', colors: ['#ffe08a', '#ff6a1f', '#8a2a0c'], accent: ['#6a6a72', '#2a2a30', '#141418'], shape: 'flame', accentShape: 'chunk', motion: 'rise', signature: ['eruption'] },
  ge: { sounds: [['lucky-chant', 0, 0.6]], rarity: 'common', colors: ['#d0ffe4', '#36cf7c', '#1a7a48'], accent: ['#fff0b0', '#d9a51c', '#8a6510'], shape: 'leaf', accentShape: 'star', motion: 'fall', signature: ['clover'] },
  ur: { sounds: [['bug-buzz', 0, 0.5]], rarity: 'rare', colors: ['#ffd0d8', '#ea1d3f', '#ab0722'], accent: DARK, shape: 'spark', accentShape: 'star', motion: 'twinkle', signature: ['ladybug'] },
  lz: { sounds: [['tail-glow', 0, 0.6]], rarity: 'rare', colors: ['#c8e8ff', '#0898ff', '#183ae6'], accent: ['#ffffff', '#9fd8ff', '#0898ff'], shape: 'dot', accentShape: 'dot', motion: 'drift', signature: ['firefly'] },
  le: { sounds: [['synth:geiger', 0, 0.9], ['poison-gas', 0, 0.45], ['eerie-impulse', 300, 0.35]], rarity: 'rare', colors: ['#f0ffc8', '#9be22c', '#2f5a0c'], accent: ['#ffffff', '#c8ffd8', '#08ff5a'], shape: 'dot', accentShape: 'spark', motion: 'rise', signature: ['radiation', 'hazard'] },
  rb: { sounds: [['techno-blast-1', 0, 0.5], ['rollout1', 350, 0.5]], rarity: 'epic', colors: ['#c9c4ff', '#3324a7', '#21167e'], accent: ['#ffd0d0', '#da3838', '#8a1a1a'], shape: 'shard', accentShape: 'star', motion: 'swirl', signature: ['pixels', 'dice'] },
  sd: { sounds: [['shadow-ball1', 0, 0.7], ['will-o-wisp1', 200, 0.5]], rarity: 'epic', colors: ['#b8b4c8', '#4b2a73', '#1a1024'], accent: ['#e8dcff', '#8a6fd0', '#2e1b45'], shape: 'smoke', accentShape: 'orb', motion: 'drift', shadow: true, signature: ['vortex', 'wisps'] },
  up: { sounds: [['cosmic-power', 0, 0.6], ['swift2', 300, 0.4]], rarity: 'epic', colors: ['#ffffff', '#9fb6e0', '#5f78a8'], accent: ['#ffffff', '#e8f0ff', '#b8c8e8'], shape: 'shard', accentShape: 'star', motion: 'twinkle', signature: ['galaxy'] },
  rc: { sounds: [['metronome', 0, 0.6], ['rock-tomb', 500, 0.35]], rarity: 'epic', colors: ['#ffd0d8', '#a7243a', '#561923'], accent: ['#d0e8ff', '#3889da', '#1a4a8a'], shape: 'square', accentShape: 'square', motion: 'swirl', signature: ['arcade', 'blocks'] },
  rj: { sounds: [['ancient-power1', 0, 0.6], ['rock-polish', 200, 0.4]], rarity: 'epic', starPoints: 5, colors: ['#c8fff0', '#24a786', '#167e64'], accent: ['#fff0b0', '#dab238', '#8a6a10'], shape: 'shard', accentShape: 'star', motion: 'swirl', signature: ['runes', 'relics'] },
  mb: { sounds: [['aura-sphere1', 0, 0.6], ['psystrike1', 150, 0.5], ['flash', 0, 0.5]], rarity: 'legendary', colors: ['#f0d0ff', '#a441bd', '#73109c'], accent: ['#ffd0de', '#cf4166', '#8a2040'], shape: 'star', accentShape: 'orb', motion: 'swirl', signature: ['aura', 'atom'] },
  au: { sounds: [['pay-day1', 0, 0.8], ['pay-day2', 220, 0.6], ['flash', 0, 0.5]], rarity: 'legendary', colors: GOLD, accent: ['#ffffff', '#fff8e1', '#e6b422'], shape: 'coin', accentShape: 'star', motion: 'fall', signature: ['fountain', 'goldrain'] },
  mc: { sounds: [['rain-dance', 0, 0.6], ['thunder', 200, 0.6], ['flash', 200, 0.5]], rarity: 'legendary', colors: ['#d8f4ff', '#419ebd', '#10799c'], accent: ['#ffd0e8', '#cf4188', '#8a2050'], shape: 'star', accentShape: 'orb', motion: 'swirl', signature: ['storm', 'bolts'] },
  mo: { sounds: [['hyperspace-hole1', 0, 0.7], ['dark-void', 150, 0.5], ['flash', 0, 0.4]], rarity: 'legendary', colors: ['#a8a0ac', '#504752', '#2a232e'], accent: ['#ead6ff', '#9a3ad6', '#3a1a7a'], shape: 'smoke', accentShape: 'spark', motion: 'drift', shadow: true, signature: ['blackhole', 'vortex'] },
  oc: { sounds: [['bubblebeam', 0, 0.7]], rarity: 'free', colors: ['#e0f6ff', '#2fa6dd', '#11679a'], accent: ['#ffffff', '#b6ecff', '#2fa6dd'], shape: 'drop', accentShape: 'bubble', motion: 'rise', signature: ['bubbles'] },
  li: { sounds: [['water-gun', 0, 0.6]], rarity: 'free', colors: ['#f0ffd0', '#a6dd2f', '#6a9a11'], accent: ['#ffffff', '#e6ffb6', '#a6dd2f'], shape: 'drop', accentShape: 'dot', motion: 'rise', signature: ['citrus'] },
  tr: { sounds: [['earthquake1', 0, 0.6], ['rock-slide', 150, 0.4]], rarity: 'rare', colors: ['#f3e0c0', '#a86f3a', '#6b4220'], accent: ['#e8c79a', '#8a6a40', '#3d2410'], shape: 'chunk', accentShape: 'dot', motion: 'rise', signature: ['quake'], shake: true },
  ma: { sounds: [['floral-healing1', 0, 0.6]], rarity: 'free', colors: ['#f6ecff', '#b48fd4', '#7a5294'], accent: ['#ffffff', '#efe0ff', '#b48fd4'], shape: 'petal', accentShape: 'star', motion: 'fall', signature: ['bloom'] },
  gn: { sounds: [['leaf-tornado1', 0, 0.6]], rarity: 'rare', colors: ['#ffe6a0', '#f0a21f', '#a8560c'], accent: ['#ffd0a0', '#e8641f', '#8a2a0c'], shape: 'leaf', accentShape: 'leaf', motion: 'fall', signature: ['autumn'] },
  tx: { sounds: [['sludge', 0, 0.8], ['sludge-bomb1', 300, 0.4]], rarity: 'rare', colors: ['#f0dcff', '#9b4fd1', '#5a1f86'], accent: ['#efffc8', '#a8e04a', '#5f8a1c'], shape: 'bubble', accentShape: 'drop', motion: 'rise', signature: ['toxic', 'sludge'] },
  el: { sounds: [['thunderbolt1', 0, 0.6], ['spark1', 120, 0.5]], rarity: 'rare', colors: ['#fffbe0', '#ffd21f', '#b38a00'], accent: ['#ffffff', '#fff4b0', '#ffd21f'], shape: 'spark', accentShape: 'star', motion: 'twinkle', signature: ['bolts'] },
  fn: { sounds: [['astonish1', 0, 0.6], ['will-o-wisp2', 150, 0.5]], rarity: 'rare', colors: ['#d6d0ff', '#7d74b8', '#24203a'], accent: ['#ffffff', '#c8c0ff', '#5a5294'], shape: 'smoke', accentShape: 'orb', motion: 'drift', shadow: true, signature: ['souls', 'wisps'] },
  ac: { sounds: [['metal-claw1', 0, 0.6], ['spark2', 150, 0.4]], rarity: 'common', colors: ['#ffffff', '#a7b3c0', '#66707c'], accent: ['#ffffff', '#eef3f8', '#a7b3c0'], shape: 'shard', accentShape: 'star', motion: 'twinkle', signature: ['grind'] },
  ps: { sounds: [['psybeam', 0, 0.6], ['kinesis', 150, 0.5]], rarity: 'rare', colors: ['#ffe0f2', '#f04ea3', '#a01868'], accent: ['#ffffff', '#ffd0ea', '#f04ea3'], shape: 'ring', accentShape: 'star', motion: 'swirl', signature: ['psywave', 'spoons'] },
  ua: { sounds: [['water-pulse', 0, 0.6]], rarity: 'rare', colors: ['#d8fffb', '#2fd6cf', '#0f7f7a'], accent: DARK, shape: 'drop', accentShape: 'star', motion: 'twinkle', signature: ['jellyfish'] },
  uv: { sounds: [['zing-zap1', 0, 0.5], ['agility', 150, 0.4]], rarity: 'rare', colors: ['#f0dcff', '#a54ff0', '#5a1fa0'], accent: DARK, shape: 'spark', accentShape: 'star', motion: 'twinkle', signature: ['lightstreaks'] },
  lr: { sounds: [['present1', 0, 0.5], ['explosion', 390, 0.3], ['explosion', 620, 0.25]], rarity: 'epic', colors: ['#ffd8dc', '#ff4a5a', '#a0182a'], accent: ['#8a8a80', '#414141', '#181818'], shape: 'star', accentShape: 'orb', motion: 'twinkle', signature: ['fireworks'] },
  dc: { sounds: [['dragon-pulse', 0, 0.6], ['draco-meteor1', 200, 0.5]], rarity: 'epic', colors: ['#e0dcff', '#5a4ff0', '#2a2399'], accent: ['#fff4c8', '#ffd35e', '#c98a1a'], shape: 'flame', accentShape: 'star', motion: 'swirl', signature: ['dragonspirit', 'stormhint'] },
  cs: { sounds: [['cosmic-power', 0, 0.7], ['moonblast1', 180, 0.4]], rarity: 'epic', colors: ['#e8dcff', '#5a2f9a', '#1f1858'], accent: ['#ffffff', '#ffc8ec', '#ff9ad8'], shape: 'star', accentShape: 'orb', motion: 'swirl', signature: ['cosmos', 'nebula'] },
  ro: { sounds: [['double-team', 0, 0.6], ['smokescreen', 120, 0.5]], rarity: 'epic', colors: ['#a8a4b0', '#4a4652', '#1e1c24'], accent: ['#ffd0d0', '#da3838', '#7a1a1a'], shape: 'smoke', accentShape: 'spark', motion: 'drift', shadow: true, signature: ['shuriken'] },
  rv: { sounds: [['trick', 0, 0.6], ['trump-card1', 150, 0.5]], rarity: 'epic', colors: ['#ecd8ff', '#8a3fd8', '#4a1a86'], accent: ['#fff4c8', '#ffd35e', '#a8740f'], shape: 'shard', accentShape: 'star', motion: 'swirl', signature: ['cards'] },
  rs: { sounds: [['sparkling-aria1', 0, 0.5], ['heal-bell', 200, 0.5], ['flash', 0, 0.4]], rarity: 'legendary', colors: ['#fff1ea', '#ebb8a3', '#b97563'], accent: ['#ffffff', '#fff3e8', '#e8a093'], shape: 'dot', accentShape: 'star', motion: 'twinkle', signature: ['shimmer', 'roseswirl', 'glitter'], soft: 0.65 },
  ms: { sounds: [['petal-blizzard1', 0, 0.6], ['aromatherapy', 150, 0.5], ['flash', 0, 0.5]], rarity: 'legendary', colors: ['#d8ffe6', '#2fcf7a', '#127a42'], accent: ['#fff4c8', '#ffd35e', '#a8740f'], shape: 'star', accentShape: 'leaf', motion: 'swirl', signature: ['bloom', 'mint'] },
  mr: { sounds: [['dark-pulse1', 0, 0.6], ['inferno', 150, 0.6], ['flash', 0, 0.4], ['night-daze1', 400, 0.5]], rarity: 'mythic', colors: ['#ff8a6a', '#c8101e', '#3a040a'], accent: ['#fff0c0', '#d9a43a', '#6a4410'], shape: 'spark', accentShape: 'dot', motion: 'rise', shadow: true, signature: ['runes', 'hellfire', 'ashfall'] },
  mp: { sounds: [['heal-bell', 0, 0.6], ['moonlight', 150, 0.5], ['flash', 0, 0.6], ['healing-wish', 350, 0.6], ['sparkling-aria1', 700, 0.4]], rarity: 'mythic', colors: ['#ffffff', '#aab8e0', '#5f6c93'], accent: ['#ffffff', '#c9b4ff', '#5fd0ff'], shape: 'dot', accentShape: 'star', motion: 'rise', bare: true, signature: ['seraph', 'sanctum', 'halo', 'feathers', 'blessing'], soft: 0.35 },
  mx: { sounds: [['dragon-dance', 0, 0.6], ['twister', 150, 0.6], ['flash', 0, 0.5], ['noble-roar1', 420, 0.6], ['dragon-pulse', 900, 0.4]], rarity: 'mythic', colors: ['#5e5a78', '#26243a', '#07060c'], accent: ['#fff0a8', '#f2c14a', '#c98a1e'], shape: 'flame', accentShape: 'star', motion: 'rise', shadow: true, bare: true, signature: ['skydragon', 'cloudhalo', 'skybolts'] },
  md: { sounds: [['pay-day1', 0, 0.8], ['pay-day2', 220, 0.7], ['flash', 0, 0.6], ['healing-wish', 350, 0.6], ['sparkling-aria1', 700, 0.4]], rarity: 'mythic', colors: GOLD, accent: ['#ffffff', '#ffd75e', '#c98a1a'], shape: 'star', accentShape: 'coin', motion: 'fall', signature: ['treasure', 'fountain', 'goldrain', 'aura'] },
};

export const SIGNATURE_LABELS = {
  comet: 'estrellas fugaces',
  chevrons: 'flechas que suben como un cohete',
  ribbon: 'cintas y corazones',
  pixels: 'píxeles y fallas de pantalla',
  aura: 'un aura de llamas y orbes en órbita',
  bolts: 'rayos eléctricos',
  frost: 'picos de hielo que se quiebran',
  eruption: 'lava, rocas y humo',
  vortex: 'un vórtice que lo traga todo',
  wisps: 'fuegos fatuos',
  fountain: 'una lluvia de monedas que rebotan',
  bubbles: 'burbujas y ondas de agua',
  toxic: 'un charco tóxico con vapores',
  gust: 'una ráfaga de viento con pétalos',
  quake: 'el suelo que se parte en grietas y placas',
  psywave: 'ondas psíquicas',
  serpent: 'un dragón que sube en espiral',
  cosmos: 'constelaciones y un planeta en órbita',
  skydragon: 'un dragón negro y dorado de ojos rojos que sube en espiral hasta perderse en el cielo',
  cloudhalo: 'un anillo de nubes que se abre en un halo de luz',
  skybolts: 'una tormenta de lluvia y rayos dorados y rojos',
  seraph: 'un haz de luz divina que oscurece todo alrededor, con luces que ascienden',
  sanctum: 'una estrella sagrada de siete puntas que enciende columnas de luz, halos que suben y polvo dorado',
  treasure: 'un torbellino de monedas que estalla entre destellos de gemas',
  dragonspirit: 'el espíritu de un dragón que da una vuelta y se desvanece hacia el cielo',
  stormhint: 'una nube cargada con llovizna y un relámpago lejano',
  hazard: 'franjas de radiación que giran en el suelo y trazas de partículas',
  clover: 'tréboles de cuatro hojas y monedas de la suerte',
  ladybug: 'mariquitas que salen volando',
  jellyfish: 'medusas y plancton que brilla',
  firefly: 'luciérnagas en la noche',
  fireworks: 'fuegos artificiales',
  arcade: 'corazones, estrellas y monedas de 8 bits',
  cards: 'naipes que giran a su alrededor',
  shuriken: 'shurikens, cortes y una bomba de humo',
  storm: 'nubes negras y lluvia',
  bloom: 'flores que brotan y sueltan pétalos',
  feathers: 'plumas blancas que caen del cielo',
  halo: 'un halo de luz sobre el Pokémon',
  blessing: 'luz que sube del suelo',
  ashfall: 'ceniza y brasas que caen',
  hellfire: 'llamas infernales que brotan del círculo, humo negro y brasas',
  citrus: 'rodajas de lima y jugo que salpica',
  glitter: 'un polvo fino que destella',
  souls: 'almas líquidas que escapan hacia arriba',
  spoons: 'cucharas que levitan a su alrededor',
  snowfall: 'una ventisca de copos y neblina helada',
  sludge: 'bolas de veneno que salpican el suelo',
  goldrain: 'una lluvia de oro y destellos',
  atom: 'órbitas de energía que se cruzan',
  radiation: 'gas radiactivo con chispas que parpadean',
  autumn: 'hojas de otoño que se lleva el viento',
  galaxy: 'una galaxia en espiral de estrellas',
  blackhole: 'un agujero negro con su disco de luz',
  shimmer: 'un brazalete de destellos que gira',
  roseswirl: 'un remolino de pétalos y brillos',
  relics: 'piedras antiguas que levitan entre polvo dorado',
  runes: 'un círculo de invocación con runas',
  lightstreaks: 'estelas de luz de neón',
  grind: 'chispas de metal y esquirlas de acero',
  nebula: 'nebulosas de colores',
  dice: 'dados que ruedan',
  blocks: 'bloques que caen y parpadean',
  meteors: 'meteoros en llamas que impactan el suelo',
  mint: 'hojas de menta y una brisa fresca',
};

export function ballFx(key) {
  const theme = THEMES[key];
  return theme ? { ...theme, tier: TIERS[theme.rarity] } : null;
}

export const BALL_FX_KEYS = Object.keys(THEMES);

export function ballSounds(key) {
  return (THEMES[key]?.sounds ?? []).map(([name, at, gain, rate = 1]) => ({ sound: SFX(name), at, gain, rate }));
}

export const ballFxBare = (key) => !!THEMES[key]?.bare;

export function ballFxNote(key) {
  const names = (THEMES[key]?.signature ?? []).map((name) => SIGNATURE_LABELS[name]);
  if (!names.length) return '';
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0];
  return `${list[0].toUpperCase()}${list.slice(1)}.`;
}

import { SHOP_TRAINERS } from './trainer-sprites.js?v=dev';

export const RARITIES = {
  common: { label: 'Común', price: 100_000_000 },
  rare: { label: 'Raro', price: 300_000_000 },
  epic: { label: 'Épico', price: 800_000_000 },
  legendary: { label: 'Legendario', price: 2_000_000_000 },
  mythic: { label: 'Mítico', price: 5_000_000_000 },
};

export const SHOP_KINDS = { ball: 'Poké Balls', window: 'Marcos de ventana', frame: 'Marcos de perfil', trainer: 'Entrenadores' };

export const DEFAULT_BALL = 'pb';

export const CUSTOM_BALLS = [
  { key: 'mt', name: 'Menta Ball', rarity: 'common', top: ['#0f5c45', '#178a64', '#2fc28c', '#a8f0d2'] },
  { key: 'sk', name: 'Sakura Ball', rarity: 'common', top: ['#7a1f4a', '#b8336f', '#ff6fae', '#ffc6de'] },
  { key: 'ic', name: 'Glaciar Ball', rarity: 'rare', top: ['#1d4f7a', '#2f7fbf', '#6cc6ff', '#e0f6ff'], bottom: ['#ffffff', '#a9c4d6'] },
  { key: 'vo', name: 'Volcán Ball', rarity: 'rare', top: ['#3a1208', '#8a2a0c', '#ff6a1f', '#ffd08a'], bottom: ['#4a4a52', '#2a2a30'] },
  { key: 'sd', name: 'Sombra Ball', rarity: 'epic', top: ['#1a1024', '#2e1b45', '#4b2a73', '#b46cff'], bottom: ['#b8b4c8', '#5e5872'] },
  { key: 'au', name: 'Dorada Ball', rarity: 'legendary', top: ['#6b4a08', '#a8740f', '#e6b422', '#fff1a8'], bottom: ['#fff8e1', '#c9b98a'] },
];

export const BALL_GROUPS = {
  gb: { primary: { closed: [2, 3, 4, 6], open: [2, 4] }, accent: { closed: [7, 8, 9], open: [] } },
  ub: { accent: { closed: [5, 6, 7, 8], open: [7] } },
  lb: { band: { closed: [6], open: [4, 6] }, accent: { closed: [7, 8, 9], open: [7, 8, 9] } },
  rb: { primary: { closed: [2, 3, 4, 5], open: [2, 3, 4] }, accent: { closed: [6, 7, 8], open: [5, 6, 7] } },
  mb: { primary: { closed: [2, 3, 5, 6], open: [4, 6] }, accent: { closed: [7, 8, 9], open: [] }, bottom: { closed: [10, 4], open: [7, 5] } },
};

export const BALL_VARIANTS = [
  { key: 'gv', name: 'Super Ball Violeta', rarity: 'common', base: 'gb', tint: { primary: { colors: { closed: ['#5a24a0', '#2e1260', '#9a62ec', '#ddc8fb'], open: ['#5a24a0', '#9a62ec'] } }, accent: { colors: { closed: ['#0f7468', '#1fb3a1', '#7ff0e0'], open: [] } } } },
  { key: 'ge', name: 'Super Ball Esmeralda', rarity: 'rare', base: 'gb', tint: { primary: { colors: { closed: ['#1a7a48', '#0b4527', '#36cf7c', '#c4f3d9'], open: ['#1a7a48', '#36cf7c'] } }, accent: { colors: { closed: ['#946209', '#d9a51c', '#fff1a8'], open: [] } } } },
  { key: 'ur', name: 'Ultra Ball Rubí', rarity: 'rare', base: 'ub', tint: { accent: { hue: 350 } } },
  { key: 'up', name: 'Ultra Ball Platino', rarity: 'epic', base: 'ub', tint: { accent: { colors: { closed: ['#5f78a8', '#9fb6e0', '#ffffff', '#d3e2fb'], open: ['#c5d8f7'] } } } },
  { key: 'lz', name: 'Lujo Ball Zafiro', rarity: 'rare', base: 'lb', tint: { accent: { hue: 205 }, band: { hue: 230 } } },
  { key: 'le', name: 'Lujo Ball Esmeralda', rarity: 'rare', base: 'lb', tint: { accent: { hue: 140 }, band: { hue: 100 } } },
  { key: 'rc', name: 'Rogue Ball Carmesí', rarity: 'epic', base: 'rb', tint: { primary: { hue: 350 }, accent: { hue: 210 } } },
  { key: 'rj', name: 'Rogue Ball Jade', rarity: 'epic', base: 'rb', tint: { primary: { hue: 165 }, accent: { hue: 45 } } },
  { key: 'mc', name: 'Master Ball Celeste', rarity: 'legendary', base: 'mb', tint: { primary: { hue: 195 }, accent: { hue: 330 } } },
  { key: 'mo', name: 'Master Ball Ónix', rarity: 'legendary', base: 'mb', tint: { primary: { sat: 0.15, light: 0.6 }, accent: { hue: 0, sat: 1.1 } } },
  { key: 'md', name: 'Master Ball Dorada', rarity: 'mythic', base: 'mb', tint: { primary: { colors: { closed: ['#6b4a08', '#a8740f', '#e6b422', '#fff1a8'], open: ['#a8740f', '#e6b422'] } }, accent: { colors: { closed: ['#c98a1a', '#ffd75e', '#fff4c2'], open: [] } }, bottom: { colors: { closed: ['#fff8e1', '#c9b98a'], open: ['#fff8e1', '#c9b98a'] } } } },
];

const item = (kind, key, name, rarity, desc) => ({ id: `${kind}:${key}`, kind, key, name, rarity, price: RARITIES[rarity].price, desc });

export const SHOP_ITEMS = [
  item('ball', 'gb', 'Super Ball', 'common', 'Tus Pokémon salen de una Super Ball. Tu rival también la ve.'),
  item('ball', 'ub', 'Ultra Ball', 'rare', 'Tus Pokémon salen de una Ultra Ball. Tu rival también la ve.'),
  item('ball', 'lb', 'Lujo Ball', 'rare', 'Tus Pokémon salen de una Lujo Ball. Tu rival también la ve.'),
  item('ball', 'rb', 'Rogue Ball', 'epic', 'La Ball original de PokeRogue. Tu rival también la ve.'),
  item('ball', 'mb', 'Master Ball', 'legendary', 'Tus Pokémon salen de una Master Ball. Tu rival también la ve.'),
  ...CUSTOM_BALLS.map((ball) => item('ball', ball.key, ball.name, ball.rarity, 'Una Ball de diseño propio de Token Clash. Tu rival también la ve.')),
  ...BALL_VARIANTS.map((ball) => item('ball', ball.key, ball.name, ball.rarity, 'Una versión de colores propia de Token Clash. Tu rival también la ve.')),
  item('window', '5', 'Ventana Grafito', 'common', 'El cuadro de texto y el registro de tus peleas, en grafito.'),
  item('window', '3', 'Ventana Plata', 'common', 'El cuadro de texto y el registro de tus peleas, en plata.'),
  item('window', '2', 'Ventana Turquesa', 'rare', 'El cuadro de texto y el registro de tus peleas, en turquesa.'),
  item('window', '1', 'Ventana Carmesí', 'rare', 'El cuadro de texto y el registro de tus peleas, en carmesí.'),
  item('window', '4', 'Ventana Ámbar', 'epic', 'El cuadro de texto y el registro de tus peleas, en ámbar.'),
  item('window', 'emerald', 'Ventana Esmeralda', 'common', 'El cuadro de texto y el registro de tus peleas, en verde esmeralda.'),
  item('window', 'sapphire', 'Ventana Zafiro', 'common', 'El cuadro de texto y el registro de tus peleas, en azul zafiro.'),
  item('window', 'coral', 'Ventana Coral', 'rare', 'El cuadro de texto y el registro de tus peleas, en coral.'),
  item('window', 'pink', 'Ventana Rosa', 'rare', 'El cuadro de texto y el registro de tus peleas, en rosa chicle.'),
  item('window', 'amethyst', 'Ventana Amatista', 'rare', 'El cuadro de texto y el registro de tus peleas, en amatista.'),
  item('window', 'ice', 'Ventana Hielo', 'epic', 'El cuadro de texto y el registro de tus peleas, en celeste helado.'),
  item('window', 'midnight', 'Ventana Medianoche', 'epic', 'El cuadro de texto y el registro de tus peleas, en azul medianoche.'),
  item('window', 'rainbow', 'Ventana Arcoíris', 'legendary', 'El cuadro de texto y el registro de tus peleas, con un color que va cambiando.'),
  item('window', 'stellar', 'Ventana Estelar', 'mythic', 'El cuadro de texto y el registro de tus peleas, con un brillo dorado que titila.'),
  item('frame', 'bronze', 'Marco de bronce', 'common', 'Un aro de bronce alrededor de tu foto, donde aparezca.'),
  item('frame', 'silver', 'Marco de plata', 'rare', 'Un aro de plata alrededor de tu foto, donde aparezca.'),
  item('frame', 'gold', 'Marco de oro', 'epic', 'Un aro de oro alrededor de tu foto, donde aparezca.'),
  item('frame', 'rainbow', 'Marco arcoíris', 'legendary', 'Un aro arcoíris que gira alrededor de tu foto.'),
  item('frame', 'shiny', 'Marco shiny', 'mythic', 'Un aro dorado con destellos shiny alrededor de tu foto.'),
  item('frame', 'emerald', 'Marco esmeralda', 'common', 'Un aro verde esmeralda alrededor de tu foto, donde aparezca.'),
  item('frame', 'sapphire', 'Marco zafiro', 'common', 'Un aro azul zafiro alrededor de tu foto, donde aparezca.'),
  item('frame', 'ruby', 'Marco rubí', 'rare', 'Un aro rojo rubí alrededor de tu foto, donde aparezca.'),
  item('frame', 'amethyst', 'Marco amatista', 'rare', 'Un aro amatista alrededor de tu foto, donde aparezca.'),
  item('frame', 'ice', 'Marco de hielo', 'rare', 'Un aro de hielo con un brillo frío alrededor de tu foto.'),
  item('frame', 'obsidian', 'Marco obsidiana', 'epic', 'Un aro negro con reflejos violeta alrededor de tu foto.'),
  item('frame', 'neon', 'Marco neón', 'epic', 'Un doble aro neón, cian y magenta, alrededor de tu foto.'),
  item('frame', 'fire', 'Marco de fuego', 'legendary', 'Un aro de fuego que parpadea alrededor de tu foto.'),
  item('frame', 'galaxy', 'Marco galaxia', 'mythic', 'Un aro de galaxia que gira entre violeta y azul alrededor de tu foto.'),
  ...Object.entries(SHOP_TRAINERS).map(([key, rarity]) => item('trainer', key, key, rarity, 'Un entrenador para tu perfil y tus peleas.')),
];

export const shopItem = (id) => SHOP_ITEMS.find((i) => i.id === id) ?? null;
export const shopItemOf = (kind, key) => shopItem(`${kind}:${key}`);

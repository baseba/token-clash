import { SHOP_TRAINERS, VARIANT_REQUIRES } from './trainer-sprites.js?v=dev';

export const RARITIES = {
  free: { label: 'Gratis', price: 0 },
  common: { label: 'Común', price: 100_000_000 },
  rare: { label: 'Raro', price: 300_000_000 },
  epic: { label: 'Épico', price: 800_000_000 },
  legendary: { label: 'Legendario', price: 2_000_000_000 },
  mythic: { label: 'Mítico', price: 5_000_000_000 },
};

export const SHOP_KINDS = { ball: 'Poké Balls', window: 'Marcos de ventana', frame: 'Marcos de perfil', trainer: 'Entrenadores' };

export const DEFAULT_BALL = 'pb';

export const CUSTOM_BALLS = [
  { key: 'mt', name: 'Menta Ball', rarity: 'free', top: ['#0f5c45', '#178a64', '#2fc28c', '#a8f0d2'] },
  { key: 'sk', name: 'Sakura Ball', rarity: 'free', top: ['#7a1f4a', '#b8336f', '#ff6fae', '#ffc6de'] },
  { key: 'ic', name: 'Glaciar Ball', rarity: 'rare', top: ['#1d4f7a', '#2f7fbf', '#6cc6ff', '#e0f6ff'], bottom: ['#ffffff', '#a9c4d6'] },
  { key: 'vo', name: 'Volcán Ball', rarity: 'rare', top: ['#3a1208', '#8a2a0c', '#ff6a1f', '#ffd08a'], bottom: ['#4a4a52', '#2a2a30'] },
  { key: 'sd', name: 'Sombra Ball', rarity: 'epic', top: ['#1a1024', '#2e1b45', '#4b2a73', '#b46cff'], bottom: ['#b8b4c8', '#5e5872'] },
  { key: 'au', name: 'Dorada Ball', rarity: 'legendary', top: ['#6b4a08', '#a8740f', '#e6b422', '#fff1a8'], bottom: ['#fff8e1', '#c9b98a'] },
  { key: 'oc', name: 'Océano Ball', rarity: 'free', top: ['#0b3b5c', '#11679a', '#2fa6dd', '#b6ecff'] },
  { key: 'li', name: 'Lima Ball', rarity: 'free', top: ['#3d5c0b', '#6a9a11', '#a6dd2f', '#e6ffb6'] },
  { key: 'tr', name: 'Tierra Ball', rarity: 'common', top: ['#3d2410', '#6b4220', '#a86f3a', '#e8c79a'], bottom: ['#f3e6cf', '#b39a78'] },
  { key: 'ma', name: 'Malva Ball', rarity: 'free', top: ['#4a2e5c', '#7a5294', '#b48fd4', '#efe0ff'] },
  { key: 'tx', name: 'Tóxica Ball', rarity: 'rare', top: ['#2e0f45', '#5a1f86', '#9b4fd1', '#e3c4ff'], bottom: ['#c8f27a', '#6f9a2c'] },
  { key: 'el', name: 'Eléctrica Ball', rarity: 'rare', top: ['#6b5200', '#b38a00', '#ffd21f', '#fff4b0'], bottom: ['#4a4a52', '#26262c'] },
  { key: 'fn', name: 'Fantasma Ball', rarity: 'rare', top: ['#24203a', '#3f3866', '#7d74b8', '#d6d0ff'], bottom: ['#e8e4ff', '#9a94c4'] },
  { key: 'ac', name: 'Acero Ball', rarity: 'rare', top: ['#3a4048', '#66707c', '#a7b3c0', '#eef3f8'], bottom: ['#ffffff', '#b8c0c8'] },
  { key: 'ps', name: 'Psíquica Ball', rarity: 'rare', top: ['#5c0b3a', '#a01868', '#f04ea3', '#ffd0ea'] },
  { key: 'dc', name: 'Draco Ball', rarity: 'epic', top: ['#120f45', '#2a2399', '#5a4ff0', '#cfc9ff'], bottom: ['#ffe08a', '#c98a1a'] },
  { key: 'cs', name: 'Cósmica Ball', rarity: 'epic', top: ['#0a0a2a', '#1f1858', '#5a2f9a', '#ff9ad8'], bottom: ['#3a2a6e', '#1a1440'] },
  { key: 'rs', name: 'Oro Rosa Ball', rarity: 'legendary', top: ['#6e2f2a', '#b05a4f', '#e8a093', '#ffe3dc'], bottom: ['#fff3e8', '#d8b8a4'] },
];

export const BALL_GROUPS = {
  gb: { primary: { closed: [2, 3, 4, 6], open: [2, 4] }, accent: { closed: [7, 8, 9], open: [] } },
  ub: { accent: { closed: [5, 6, 7, 8], open: [7] } },
  lb: { band: { closed: [6], open: [4, 6] }, accent: { closed: [7, 8, 9], open: [7, 8, 9] } },
  rb: { primary: { closed: [2, 3, 4, 5], open: [2, 3, 4] }, accent: { closed: [6, 7, 8], open: [5, 6, 7] } },
  mb: { primary: { closed: [2, 3, 5, 6], open: [4, 6] }, accent: { closed: [7, 8, 9], open: [] }, bottom: { closed: [10, 4], open: [7, 5] } },
};

export const BALL_VARIANTS = [
  { key: 'gv', name: 'Super Ball Violeta', rarity: 'common', base: 'gb', tint: { primary: { colors: { closed: ['#5a24a0', '#3a1470', '#9a62ec', '#ddc8fb'], open: ['#5a24a0', '#9a62ec'] } }, accent: { colors: { closed: ['#0f7468', '#1fb3a1', '#7ff0e0'], open: [] } } } },
  { key: 'ge', name: 'Super Ball Esmeralda', rarity: 'rare', base: 'gb', tint: { primary: { colors: { closed: ['#1a7a48', '#0d4f2c', '#36cf7c', '#c4f3d9'], open: ['#1a7a48', '#36cf7c'] } }, accent: { colors: { closed: ['#946209', '#d9a51c', '#fff1a8'], open: [] } } } },
  { key: 'ur', name: 'Ultra Ball Rubí', rarity: 'rare', base: 'ub', tint: { accent: { hue: 350 } } },
  { key: 'up', name: 'Ultra Ball Platino', rarity: 'epic', base: 'ub', tint: { accent: { colors: { closed: ['#5f78a8', '#9fb6e0', '#ffffff', '#d3e2fb'], open: ['#c5d8f7'] } } } },
  { key: 'lz', name: 'Lujo Ball Zafiro', rarity: 'rare', base: 'lb', tint: { band: { colors: { closed: ['#2a4fb8'], open: ['#1d3a8a', '#2a4fb8'] } }, accent: { colors: { closed: ['#2f6fd6', '#5c9ae8', '#a9cdf7'], open: ['#2f6fd6', '#5c9ae8', '#a9cdf7'] } } } },
  { key: 'le', name: 'Lujo Ball Esmeralda', rarity: 'rare', base: 'lb', tint: { band: { colors: { closed: ['#1f7a48'], open: ['#155a34', '#1f7a48'] } }, accent: { colors: { closed: ['#2fa865', '#5cc98a', '#a8ecc4'], open: ['#2fa865', '#5cc98a', '#a8ecc4'] } } } },
  { key: 'rc', name: 'Rogue Ball Carmesí', rarity: 'epic', base: 'rb', tint: { primary: { hue: 350 }, accent: { hue: 210 } } },
  { key: 'rj', name: 'Rogue Ball Jade', rarity: 'epic', base: 'rb', tint: { primary: { hue: 165 }, accent: { hue: 45 } } },
  { key: 'mc', name: 'Master Ball Celeste', rarity: 'legendary', base: 'mb', tint: { primary: { hue: 195 }, accent: { hue: 330 } } },
  { key: 'mo', name: 'Master Ball Ónix', rarity: 'legendary', base: 'mb', tint: { primary: { sat: 0.15, light: 0.6 }, accent: { hue: 0, sat: 1.1 } } },
  { key: 'gn', name: 'Super Ball Naranja', rarity: 'common', base: 'gb', tint: { primary: { colors: { closed: ['#c2560f', '#7e2f06', '#ff9a3c', '#ffd8b0'], open: ['#c2560f', '#ff9a3c'] } }, accent: { colors: { closed: ['#1a4a8a', '#3f8fe0', '#a8d4ff'], open: [] } } } },
  { key: 'ua', name: 'Ultra Ball Aqua', rarity: 'rare', base: 'ub', tint: { accent: { hue: 185 } } },
  { key: 'uv', name: 'Ultra Ball Violeta', rarity: 'rare', base: 'ub', tint: { accent: { hue: 280 } } },
  { key: 'lr', name: 'Lujo Ball Rubí', rarity: 'rare', base: 'lb', tint: { band: { colors: { closed: ['#9e1f35'], open: ['#741526', '#9e1f35'] } }, accent: { colors: { closed: ['#c2334b', '#df6679', '#f5b0ba'], open: ['#c2334b', '#df6679', '#f5b0ba'] } } } },
  { key: 'ro', name: 'Rogue Ball Ónix', rarity: 'epic', base: 'rb', tint: { primary: { sat: 0.12, light: 0.55 }, accent: { hue: 0, sat: 1.1 } } },
  { key: 'rv', name: 'Rogue Ball Violeta', rarity: 'epic', base: 'rb', tint: { primary: { hue: 280 }, accent: { hue: 50 } } },
  { key: 'ms', name: 'Master Ball Esmeralda', rarity: 'legendary', base: 'mb', tint: { primary: { hue: 145 }, accent: { hue: 48 } } },
  { key: 'mr', name: 'Master Ball Rubí', rarity: 'legendary', base: 'mb', tint: { primary: { hue: 352 }, accent: { hue: 205 } } },
  { key: 'mp', name: 'Master Ball Platino', rarity: 'mythic', base: 'mb', tint: { primary: { colors: { closed: ['#3d4566', '#6c79a3', '#b3c0e6', '#f7f9ff'], open: ['#6c79a3', '#b3c0e6'] } }, accent: { colors: { closed: ['#7d5cff', '#5fd0ff', '#f3e6ff'], open: [] } }, bottom: { colors: { closed: ['#f4f6ff', '#8f9abd'], open: ['#f4f6ff', '#8f9abd'] } } } },
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
  item('window', '5', 'Ventana Grafito', 'common', 'El cuadro de texto y los botones de movimientos de tus peleas, en grafito con doble línea interior.'),
  item('window', '3', 'Ventana Plata', 'rare', 'El cuadro de texto y los botones de movimientos de tus peleas, en plata con reflejo de metal cepillado.'),
  item('window', '2', 'Ventana Turquesa', 'rare', 'El cuadro de texto y los botones de movimientos de tus peleas, en turquesa con olas suaves al pie.'),
  item('window', '1', 'Ventana Carmesí', 'rare', 'El cuadro de texto y los botones de movimientos de tus peleas, en carmesí con esquinas ornamentales.'),
  item('window', '4', 'Ventana Ámbar', 'rare', 'El cuadro de texto y los botones de movimientos de tus peleas, en ámbar con una trama de panal.'),
  item('window', 'emerald', 'Ventana Esmeralda', 'common', 'El cuadro de texto y los botones de movimientos de tus peleas, en verde esmeralda con rayas finas.'),
  item('window', 'sapphire', 'Ventana Zafiro', 'common', 'El cuadro de texto y los botones de movimientos de tus peleas, en azul zafiro con cuadrícula.'),
  item('window', 'coral', 'Ventana Coral', 'common', 'El cuadro de texto y los botones de movimientos de tus peleas, en coral con un borde punteado.'),
  item('window', 'pink', 'Ventana Rosa', 'common', 'El cuadro de texto y los botones de movimientos de tus peleas, en rosa chicle con lunares.'),
  item('window', 'amethyst', 'Ventana Amatista', 'epic', 'El cuadro de texto y los botones de movimientos de tus peleas, en amatista con facetas de cristal.'),
  item('window', 'ice', 'Ventana Hielo', 'epic', 'El cuadro de texto y los botones de movimientos de tus peleas, en celeste helado con escarcha.'),
  item('window', 'midnight', 'Ventana Medianoche', 'epic', 'El cuadro de texto y los botones de movimientos de tus peleas, en azul medianoche con estrellas.'),
  item('window', 'rainbow', 'Ventana Arcoíris', 'legendary', 'El cuadro de texto y los botones de movimientos de tus peleas, con un color que va cambiando y el espectro en el borde.'),
  item('window', 'stellar', 'Ventana Estelar', 'mythic', 'El cuadro de texto y los botones de movimientos de tus peleas, con estrellas y un brillo dorado que titila.'),
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
  item('frame', 'compass', 'Marco rosa de los vientos', 'common', 'Una cruz cardinal plateada que asoma detrás de tu foto.'),
  item('frame', 'starfish', 'Marco playa', 'common', 'Un aro arena con una estrella de mar en el borde de tu foto.'),
  item('frame', 'leaves', 'Marco selva', 'rare', 'Un aro verde con hojas de selva asomando bajo tu foto.'),
  item('frame', 'flowers', 'Marco pradera', 'rare', 'Un aro claro con flores blancas asomando junto a tu foto.'),
  item('frame', 'star', 'Marco estrella', 'rare', 'Una estrella de ocho puntas plateada detrás de tu foto.'),
  item('frame', 'crystal', 'Marco cristal', 'epic', 'Un aro helado con cristales de hielo en el borde de tu foto.'),
  item('frame', 'amethyst-shard', 'Marco geoda', 'epic', 'Un aro amatista con cristales de la cueva de las hadas junto a tu foto.'),
  item('frame', 'mushroom', 'Marco hongo', 'epic', 'Hongos y cristales de la cueva de las hadas bajo tu foto, con esporas brillantes flotando.'),
  item('frame', 'sun', 'Marco solar', 'mythic', 'Rayos de sol dorados que giran lento alrededor de tu foto.'),
  item('frame', 'galaxy', 'Marco galaxia', 'mythic', 'Un aro de galaxia que gira entre violeta y azul alrededor de tu foto.'),
  ...Object.entries(SHOP_TRAINERS).map(([key, rarity]) => ({
    ...item('trainer', key, key, rarity, VARIANT_REQUIRES[key] ? 'Una variante de colores: primero necesitas tener al original.' : 'Un entrenador para tu perfil y tus peleas.'),
    ...(VARIANT_REQUIRES[key] ? { requires: VARIANT_REQUIRES[key] } : {}),
  })),
];

export const AI_BALLS = [DEFAULT_BALL, ...SHOP_ITEMS.filter((item) => item.kind === 'ball' && ['free', 'common'].includes(item.rarity)).map((item) => item.key)];

export const aiBallFor = (roll) => AI_BALLS[Math.min(AI_BALLS.length - 1, Math.floor(roll * AI_BALLS.length))];

export const shopItem = (id) => SHOP_ITEMS.find((i) => i.id === id) ?? null;
export const isFreeItem = (id) => shopItem(id)?.price === 0;
export const shopItemOf = (kind, key) => shopItem(`${kind}:${key}`);

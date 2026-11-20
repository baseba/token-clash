import { SHOP_TRAINERS, VARIANT_REQUIRES } from './trainer-sprites.js?v=dev';

export const RARITIES = {
  free: { label: 'Gratis', price: 0 },
  common: { label: 'Común', price: 100_000_000 },
  rare: { label: 'Raro', price: 300_000_000 },
  epic: { label: 'Épico', price: 800_000_000 },
  legendary: { label: 'Legendario', price: 2_000_000_000 },
  mythic: { label: 'Mítico', price: 5_000_000_000 },
};

export const RECOLOR_PRICES = {
  common: 20_000_000,
  rare: 60_000_000,
  epic: 150_000_000,
  legendary: 400_000_000,
  mythic: 1_000_000_000,
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
  { key: 'tr', name: 'Tierra Ball', rarity: 'rare', top: ['#3d2410', '#6b4220', '#a86f3a', '#e8c79a'], bottom: ['#f3e6cf', '#b39a78'] },
  { key: 'ma', name: 'Malva Ball', rarity: 'free', top: ['#4a2e5c', '#7a5294', '#b48fd4', '#efe0ff'] },
  { key: 'tx', name: 'Tóxica Ball', rarity: 'rare', top: ['#2e0f45', '#5a1f86', '#9b4fd1', '#e3c4ff'], bottom: ['#c8f27a', '#6f9a2c'] },
  { key: 'el', name: 'Eléctrica Ball', rarity: 'rare', top: ['#6b5200', '#b38a00', '#ffd21f', '#fff4b0'], bottom: ['#4a4a52', '#26262c'] },
  { key: 'fn', name: 'Fantasma Ball', rarity: 'rare', top: ['#24203a', '#3f3866', '#7d74b8', '#d6d0ff'], bottom: ['#e8e4ff', '#9a94c4'] },
  { key: 'ac', name: 'Acero Ball', rarity: 'common', top: ['#3a4048', '#66707c', '#a7b3c0', '#eef3f8'], bottom: ['#ffffff', '#b8c0c8'] },
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
  { key: 'gv', name: 'Aurora Ball', rarity: 'common', base: 'gb', tint: { primary: { colors: { closed: ['#5a24a0', '#3a1470', '#9a62ec', '#ddc8fb'], open: ['#5a24a0', '#9a62ec'] } }, accent: { colors: { closed: ['#0f7468', '#1fb3a1', '#7ff0e0'], open: [] } } } },
  { key: 'ge', name: 'Trébol Ball', rarity: 'common', base: 'gb', tint: { primary: { colors: { closed: ['#1a7a48', '#0d4f2c', '#36cf7c', '#c4f3d9'], open: ['#1a7a48', '#36cf7c'] } }, accent: { colors: { closed: ['#946209', '#d9a51c', '#fff1a8'], open: [] } } } },
  { key: 'ur', name: 'Mariquita Ball', rarity: 'rare', base: 'ub', tint: { accent: { hue: 350 } } },
  { key: 'up', name: 'Galaxia Ball', rarity: 'epic', base: 'ub', tint: { accent: { colors: { closed: ['#5f78a8', '#9fb6e0', '#ffffff', '#d3e2fb'], open: ['#c5d8f7'] } } } },
  { key: 'lz', name: 'Luciérnaga Ball', rarity: 'rare', base: 'lb', tint: { band: { colors: { closed: ['#2a4fb8'], open: ['#1d3a8a', '#2a4fb8'] } }, accent: { colors: { closed: ['#2f6fd6', '#5c9ae8', '#a9cdf7'], open: ['#2f6fd6', '#5c9ae8', '#a9cdf7'] } } } },
  { key: 'le', name: 'Radioactiva Ball', rarity: 'rare', base: 'lb', tint: { band: { colors: { closed: ['#1f7a48'], open: ['#155a34', '#1f7a48'] } }, accent: { colors: { closed: ['#2fa865', '#5cc98a', '#a8ecc4'], open: ['#2fa865', '#5cc98a', '#a8ecc4'] } } } },
  { key: 'rc', name: 'Arcade Ball', rarity: 'epic', base: 'rb', tint: { primary: { hue: 350 }, accent: { hue: 210 } } },
  { key: 'rj', name: 'Reliquia Ball', rarity: 'epic', base: 'rb', tint: { primary: { hue: 165 }, accent: { hue: 45 } } },
  { key: 'mc', name: 'Tormenta Ball', rarity: 'legendary', base: 'mb', tint: { primary: { hue: 195 }, accent: { hue: 330 } } },
  { key: 'mo', name: 'Agujero Negro Ball', rarity: 'legendary', base: 'mb', tint: { primary: { sat: 0.15, light: 0.6 }, accent: { hue: 275, sat: 1.1 } } },
  { key: 'gn', name: 'Otoño Ball', rarity: 'rare', base: 'gb', tint: { primary: { colors: { closed: ['#c2560f', '#7e2f06', '#ff9a3c', '#ffd8b0'], open: ['#c2560f', '#ff9a3c'] } }, accent: { colors: { closed: ['#1a4a8a', '#3f8fe0', '#a8d4ff'], open: [] } } } },
  { key: 'ua', name: 'Abismo Ball', rarity: 'rare', base: 'ub', tint: { accent: { hue: 185 } } },
  { key: 'uv', name: 'Neón Ball', rarity: 'rare', base: 'ub', tint: { accent: { hue: 280 } } },
  { key: 'lr', name: 'Pirotecnia Ball', rarity: 'epic', base: 'lb', tint: { band: { colors: { closed: ['#9e1f35'], open: ['#741526', '#9e1f35'] } }, accent: { colors: { closed: ['#c2334b', '#df6679', '#f5b0ba'], open: ['#c2334b', '#df6679', '#f5b0ba'] } } } },
  { key: 'ro', name: 'Ninja Ball', rarity: 'epic', base: 'rb', tint: { primary: { sat: 0.12, light: 0.55 }, accent: { hue: 0, sat: 1.1 } } },
  { key: 'rv', name: 'Arcana Ball', rarity: 'epic', base: 'rb', tint: { primary: { hue: 280 }, accent: { hue: 50 } } },
  { key: 'ms', name: 'Edén Ball', rarity: 'legendary', base: 'mb', tint: { primary: { hue: 145 }, accent: { hue: 48 } } },
  { key: 'mr', name: 'Ritual Ball', rarity: 'mythic', base: 'mb', tint: { primary: { colors: { closed: ['#08060a', '#1c1418', '#3a2a32', '#9a8a92'], open: ['#1c1418', '#3a2a32'] } }, accent: { colors: { closed: ['#7a0a18', '#d1121f', '#ff7a7a'], open: [] } } } },
  { key: 'mp', name: 'Celestial Ball', rarity: 'mythic', base: 'mb', tint: { primary: { colors: { closed: ['#3d4566', '#6c79a3', '#b3c0e6', '#f7f9ff'], open: ['#6c79a3', '#b3c0e6'] } }, accent: { colors: { closed: ['#7d5cff', '#5fd0ff', '#f3e6ff'], open: [] } }, bottom: { colors: { closed: ['#f4f6ff', '#8f9abd'], open: ['#f4f6ff', '#8f9abd'] } } } },
  { key: 'md', name: 'Tesoro Ball', rarity: 'mythic', base: 'mb', tint: { primary: { colors: { closed: ['#6b4a08', '#a8740f', '#e6b422', '#fff1a8'], open: ['#a8740f', '#e6b422'] } }, accent: { colors: { closed: ['#c98a1a', '#ffd75e', '#fff4c2'], open: [] } }, bottom: { colors: { closed: ['#fff8e1', '#c9b98a'], open: ['#fff8e1', '#c9b98a'] } } } },
];

const item = (kind, key, name, rarity, desc) => ({ id: `${kind}:${key}`, kind, key, name, rarity, price: RARITIES[rarity].price, desc });

export const SHOP_ITEMS = [
  item('ball', 'gb', 'Super Ball', 'common', 'Tus Pokémon salen de una Super Ball. Tu rival también la ve.'),
  item('ball', 'ub', 'Ultra Ball', 'rare', 'Tus Pokémon salen de una Ultra Ball. Tu rival también la ve.'),
  item('ball', 'lb', 'Lujo Ball', 'rare', 'Tus Pokémon salen de una Lujo Ball. Tu rival también la ve.'),
  item('ball', 'rb', 'Rogue Ball', 'epic', 'La Ball original de PokeRogue. Tu rival también la ve.'),
  item('ball', 'mb', 'Master Ball', 'legendary', 'Tus Pokémon salen de una Master Ball. Tu rival también la ve.'),
  ...CUSTOM_BALLS.map((ball) => item('ball', ball.key, ball.name, ball.rarity, 'Una Ball de diseño propio de Token Clash. Tu rival también la ve.')),
  ...BALL_VARIANTS.map((ball) => item('ball', ball.key, ball.name, ball.rarity, 'Una Ball con temática propia de Token Clash. Tu rival también la ve.')),
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
  item('frame', 'bronze', 'Marco de bronce', 'common', 'Un aro de bronce con motas de cobre alrededor de tu foto.'),
  item('frame', 'silver', 'Marco de plata', 'rare', 'Un aro de plata con destellos que orbitan alrededor de tu foto.'),
  item('frame', 'gold', 'Marco de oro', 'epic', 'Un aro de oro con polvo dorado que gira y destella alrededor de tu foto.'),
  item('frame', 'rainbow', 'Marco arcoíris', 'legendary', 'Un aro arcoíris con chispas de colores que giran alrededor de tu foto.'),
  item('frame', 'shiny', 'Marco shiny', 'mythic', 'Un aro dorado con destellos shiny que titilan y orbitan alrededor de tu foto.'),
  item('frame', 'emerald', 'Marco esmeralda', 'common', 'Un aro esmeralda con brillos verdes que titilan alrededor de tu foto.'),
  item('frame', 'sapphire', 'Marco zafiro', 'common', 'Un aro zafiro con burbujas azules que suben alrededor de tu foto.'),
  item('frame', 'ruby', 'Marco rubí', 'rare', 'Un aro rubí con destellos rojos que titilan alrededor de tu foto.'),
  item('frame', 'amethyst', 'Marco amatista', 'rare', 'Un aro amatista con motas violeta que orbitan alrededor de tu foto.'),
  item('frame', 'ice', 'Marco de hielo', 'rare', 'Un aro de hielo con nieve que cae alrededor de tu foto.'),
  item('frame', 'obsidian', 'Marco obsidiana', 'epic', 'Un aro negro con chispas violeta que suben alrededor de tu foto.'),
  item('frame', 'neon', 'Marco neón', 'epic', 'Un doble aro neón con luces cian y magenta que giran en sentidos opuestos.'),
  item('frame', 'fire', 'Marco de fuego', 'legendary', 'Un aro de fuego con brasas que suben alrededor de tu foto.'),
  item('frame', 'compass', 'Marco rosa de los vientos', 'common', 'Una cruz cardinal plateada que asoma detrás de tu foto.'),
  item('frame', 'starfish', 'Marco playa', 'common', 'Un aro arena con granos de arena y espuma que sube alrededor de tu foto.'),
  item('frame', 'leaves', 'Marco selva', 'rare', 'Un aro verde con hojas de selva que caen alrededor de tu foto.'),
  item('frame', 'flowers', 'Marco pradera', 'rare', 'Un aro claro con pétalos que caen y flores alrededor de tu foto.'),
  item('frame', 'star', 'Marco estrella', 'rare', 'Una estrella de ocho puntas detrás de tu foto, con estrellitas que titilan.'),
  item('frame', 'crystal', 'Marco cristal', 'epic', 'Un aro helado con cristales que destellan y escarcha que cae alrededor de tu foto.'),
  item('frame', 'amethyst-shard', 'Marco geoda', 'epic', 'Un aro amatista con cristales de geoda que destellan y polvo que gira.'),
  item('frame', 'mushroom', 'Marco hongo', 'epic', 'Un aro de la cueva de las hadas con esporas brillantes que suben alrededor de tu foto.'),
  item('frame', 'sun', 'Marco solar', 'mythic', 'Rayos de sol dorados y motas de luz que giran alrededor de tu foto.'),
  item('frame', 'galaxy', 'Marco galaxia', 'mythic', 'Un aro de galaxia con estrellas que giran en dos sentidos alrededor de tu foto.'),
  ...Object.entries(SHOP_TRAINERS).map(([key, rarity]) => ({
    ...item('trainer', key, key, rarity, VARIANT_REQUIRES[key] ? 'Una variante de colores: primero necesitas tener al original.' : 'Un entrenador para tu perfil y tus peleas.'),
    ...(VARIANT_REQUIRES[key] ? { requires: VARIANT_REQUIRES[key], price: RECOLOR_PRICES[rarity] } : {}),
  })),
];

export const AI_BALLS = [DEFAULT_BALL, ...SHOP_ITEMS.filter((item) => item.kind === 'ball' && ['free', 'common'].includes(item.rarity)).map((item) => item.key)];

export const aiBallFor = (roll) => AI_BALLS[Math.min(AI_BALLS.length - 1, Math.floor(roll * AI_BALLS.length))];

export const shopItem = (id) => SHOP_ITEMS.find((i) => i.id === id) ?? null;
export const isFreeItem = (id) => shopItem(id)?.price === 0;
export const shopItemOf = (kind, key) => shopItem(`${kind}:${key}`);

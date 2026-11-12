const P = 'physical';
const S = 'special';

const brn = (chance) => ({ chance, status: 'brn' });
const par = (chance) => ({ chance, status: 'par' });
const psn = (chance) => ({ chance, status: 'psn' });
const tox = (chance) => ({ chance, status: 'tox' });
const frz = (chance) => ({ chance, status: 'frz' });
const flinch = (chance) => ({ chance, flinch: true });
const confuse = (chance) => ({ chance, confuse: true });
const drop = (chance, stat, by = -1) => ({ chance, boosts: { [stat]: by } });
const raise = (chance, boosts) => ({ chance, self: boosts });

export const MOVE_INFO = {
  Placaje: { category: P, flags: ['contact'] },
  'Golpe Cabeza': { category: P, flags: ['contact'], secondary: [flinch(30)] },
  'Doble Filo': { category: P, flags: ['contact'], recoil: 1 / 3 },
  Hiperrayo: { category: S },
  Gigaimpacto: { category: P, flags: ['contact'] },
  'Última Baza': { category: P, flags: ['contact'] },

  Ascuas: { category: S, secondary: [brn(10)] },
  'Colmillo Ígneo': { category: P, flags: ['contact', 'bite'], secondary: [brn(10), flinch(10)] },
  'Rueda Fuego': { category: P, flags: ['contact'], secondary: [brn(10)], thaws: true },
  Lanzallamas: { category: S, secondary: [brn(10)] },
  Llamarada: { category: S, secondary: [brn(10)] },
  'Envite Ígneo': { category: P, flags: ['contact'], recoil: 1 / 3, secondary: [brn(10)], thaws: true },

  'Pistola Agua': { category: S },
  Hidropulso: { category: S, flags: ['pulse'], secondary: [confuse(20)] },
  Burbuja: { category: S, secondary: [drop(10, 'spd')] },
  Hidrobomba: { category: S },
  Cascada: { category: P, flags: ['contact'], secondary: [flinch(20)] },
  'Acua Cola': { category: P, flags: ['contact'] },

  'Látigo Cepa': { category: P, flags: ['contact'] },
  'Hoja Afilada': { category: P, flags: ['slicing'], crit: 1 },
  Megaagotar: { category: S, drain: 0.5 },
  'Rayo Solar': { category: S },
  'Bomba Germen': { category: P, flags: ['bullet'] },
  Lluevehojas: { category: S, self: { satk: -2 } },

  Impactrueno: { category: S, secondary: [par(10)] },
  Chispa: { category: P, flags: ['contact'], secondary: [par(30)] },
  'Colmillo Rayo': { category: P, flags: ['contact', 'bite'], secondary: [par(10), flinch(10)] },
  Rayo: { category: S, secondary: [par(10)] },
  Trueno: { category: S, secondary: [par(30)] },
  'Voltio Cruel': { category: P, flags: ['contact'], recoil: 1 / 3, secondary: [par(10)] },

  'Viento Hielo': { category: S, flags: ['wind'], secondary: [drop(100, 'spd')] },
  'Colmillo Hielo': { category: P, flags: ['contact', 'bite'], secondary: [frz(10), flinch(10)] },
  'Nieve Polvo': { category: S, flags: ['wind'], secondary: [frz(10)] },
  'Rayo Hielo': { category: S, secondary: [frz(10)] },
  Ventisca: { category: S, flags: ['wind'], secondary: [frz(10)] },
  'Frío Polar': { category: S },

  'Golpe Kárate': { category: P, flags: ['contact'], crit: 1 },
  'Patada Baja': { category: P, flags: ['contact'] },
  Demolición: { category: P, flags: ['contact'] },
  'A Bocajarro': { category: P, flags: ['contact'], self: { def: -1, sdef: -1 } },
  'Puño Dinámico': { category: P, flags: ['contact', 'punch'], secondary: [confuse(100)] },
  'Patada Salto Alta': { category: P, flags: ['contact'] },

  Ácido: { category: S, secondary: [drop(10, 'sdef')] },
  'Colmillo Veneno': { category: P, flags: ['contact', 'bite'], secondary: [tox(50)] },
  'Puya Nociva': { category: P, flags: ['contact'], secondary: [psn(30)] },
  'Bomba Lodo': { category: S, flags: ['bullet'], secondary: [psn(30)] },
  Lanzamugre: { category: S, secondary: [psn(30)] },
  'Onda Tóxica': { category: S, secondary: [psn(10)] },

  'Bofetón Lodo': { category: S, secondary: [drop(100, 'acc')] },
  'Disparo Lodo': { category: S, secondary: [drop(100, 'spd')] },
  Terratemblor: { category: P, secondary: [drop(100, 'spd')] },
  Terremoto: { category: P, weakenedByGrassyTerrain: true },
  'Fuerza Telúrica': { category: P },
  'Tierra Viva': { category: S, secondary: [drop(10, 'sdef')] },

  Picotazo: { category: P, flags: ['contact'] },
  'Ataque Ala': { category: P, flags: ['contact'] },
  'Tajo Aéreo': { category: S, flags: ['slicing'], secondary: [flinch(30)] },
  'Pájaro Osado': { category: P, flags: ['contact'], recoil: 1 / 3 },
  Vendaval: { category: S, flags: ['wind'], secondary: [confuse(30)] },
  Vuelo: { category: P, flags: ['contact'] },

  Confusión: { category: S, secondary: [confuse(10)] },
  Psicorrayo: { category: S, secondary: [confuse(10)] },
  'Cabezazo Zen': { category: P, flags: ['contact'], secondary: [flinch(20)] },
  Psíquico: { category: S, secondary: [drop(10, 'sdef')] },
  Psicocorte: { category: P, flags: ['slicing'], crit: 1 },
  Premonición: { category: S },

  Picadura: { category: P, flags: ['contact'] },
  'Tijera X': { category: P, flags: ['contact', 'slicing'] },
  'Pin Misil': { category: P, multihit: true },
  Megacuerno: { category: P, flags: ['contact'] },
  Zumbido: { category: S, flags: ['sound'], secondary: [drop(10, 'sdef')] },
  Chupavidas: { category: P, flags: ['contact'], drain: 0.5 },

  Lanzarrocas: { category: P },
  Pedrada: { category: P },
  Antiaéreo: { category: P },
  'Roca Afilada': { category: P, crit: 1 },
  Avalancha: { category: P, secondary: [flinch(30)] },
  'Poder Pasado': { category: S, secondary: [raise(10, { atk: 1, def: 1, satk: 1, sdef: 1, spd: 1 })] },

  Lengüetazo: { category: P, flags: ['contact'], secondary: [par(30)] },
  'Garra Umbría': { category: P, flags: ['contact'], crit: 1 },
  'Puño Sombra': { category: P, flags: ['contact', 'punch'] },
  'Bola Sombra': { category: S, flags: ['bullet'], secondary: [drop(20, 'sdef')] },
  'Golpe Fantasma': { category: P, flags: ['contact'] },
  Infortunio: { category: S },

  'Furia Dragón': { category: S },
  'Aliento Dragón': { category: S, secondary: [par(30)] },
  'Garra Dragón': { category: P, flags: ['contact'] },
  Enfado: { category: P, flags: ['contact'] },
  'Cometa Draco': { category: S, self: { satk: -2 } },
  'Carga Dragón': { category: P, flags: ['contact'], secondary: [flinch(20)] },

  Mordisco: { category: P, flags: ['contact', 'bite'], secondary: [flinch(30)] },
  Finta: { category: P, flags: ['contact'] },
  'Tajo Umbrío': { category: P, flags: ['contact', 'slicing'], crit: 1 },
  Triturar: { category: P, flags: ['contact', 'bite'], secondary: [drop(20, 'def')] },
  'Pulso Umbrío': { category: S, flags: ['pulse'], secondary: [flinch(20)] },
  'Juego Sucio': { category: P, flags: ['contact'], usesTargetAttack: true },

  'Garra Metal': { category: P, flags: ['contact'], secondary: [raise(10, { atk: 1 })] },
  'Cola Férrea': { category: P, flags: ['contact'], secondary: [drop(30, 'def')] },
  'Puño Bala': { category: P, flags: ['contact', 'punch'] },
  'Foco Resplandor': { category: S, secondary: [drop(10, 'sdef')] },
  'Cabeza de Hierro': { category: P, flags: ['contact'], secondary: [flinch(30)] },
  'Puño Meteoro': { category: P, flags: ['contact', 'punch'], secondary: [raise(20, { atk: 1 })] },

  'Viento Feérico': { category: S, flags: ['wind'] },
  'Beso Drenaje': { category: S, flags: ['contact'], drain: 0.75 },
  Carantoña: { category: P, flags: ['contact'], secondary: [drop(10, 'atk')] },
  'Fuerza Lunar': { category: S, secondary: [drop(30, 'satk')] },
  'Brillo Mágico': { category: S },
  'Voz Cautivadora': { category: S, flags: ['sound'] },

  'Acua Jet': { category: P, flags: ['contact'] },
  Ultrapuño: { category: P, flags: ['contact', 'punch'] },
  'Golpe Bajo': { category: P, flags: ['contact'] },
  'Sombra Vil': { category: P, flags: ['contact'] },
  'Esquirla Helada': { category: P },
  'Roca Veloz': { category: P, flags: ['contact'] },
  'Ataque Rápido': { category: P, flags: ['contact'] },

  'Defensa Férrea': { category: 'status' },
  'Danza Espada': { category: 'status', flags: ['dance'] },
  Recuperación: { category: 'status', flags: ['heal'] },
  Maquinación: { category: 'status' },
  Amnesia: { category: 'status' },
};

export function moveInfo(name) {
  const info = MOVE_INFO[name] ?? { category: P };
  return { category: info.category, flags: info.flags ?? [], ...info };
}

import { creatureHTML, loadSprites, preloadSprites, spritesLoaded, spriteURL } from './creature.js?v=dev';
import { TYPES, typeLabel, effectiveness } from './types.js?v=dev';
import { sceneFor } from './backgrounds.js?v=dev';
import { createPlayer } from './music.js?v=dev';
import { createFx, moveShape } from './fx.js?v=dev';
import { ballSounds } from './ball-fx.js?v=dev';
import { chargeAnim, COMMON_PRELOAD, hpTweenMs, moveLands } from './battle-anims.js?v=dev';
import { patchSave } from './savepatch.js?v=dev';
import { rememberSave, storedSave } from './savestore.js?v=dev';
import { TRAINER_SPRITES, TRAINER_VARIANTS, trainerSpriteFor, VARIANT_COLOR_NAMES } from './trainer-sprites.js?v=dev';
import { RADIO_KINDS, RADIO_REGIONS, RADIO_TRACKS, radioTrack } from './radio.js?v=dev';
import { createNotifier } from './notify.js?v=dev';
import { RARITIES, SHOP_KINDS } from './shop.js?v=dev';
import { fallBackToRaw } from './upstream.js?v=dev';

const $app = document.getElementById('app');
const $who = document.getElementById('who');
const $toast = document.getElementById('toast');

const ls = {
  get: (k) => {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set: (k, v) => {
    try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode: session only */ }
  },
};

// An access link (/#key=…) restores the session on another browser.
if (location.hash.startsWith('#key=')) {
  const k = location.hash.slice(5);
  if (/^[A-Za-z0-9_-]{20,100}$/.test(k)) ls.set('tc_token', k);
  history.replaceState(null, '', location.pathname + location.search);
}

let token = ls.get('tc_token');
const notifier = createNotifier();
let me = null;
let cleanup = null;

// ---------- utils ----------
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, val);
        else el.style[prop] = val;
      }
    } // CSSOM, so CSP-safe
    else if (k === 'html') el.innerHTML = v; // only ever creatureHTML(), which validates the sprite slug
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function playClass(el, cls, ms = 600) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const compact = (n) => new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
const SPRITE_CANVAS = 96;
const RARITY = { common: 'Común', uncommon: 'Poco común', rare: 'Rara', legendary: 'Legendaria' };

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 2600);
}

async function api(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `Error ${res.status}`), { status: res.status });
  return data;
}

async function copy(text, okMsg = 'Copiado') {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMsg);
  } catch {
    toast('No pude copiar; selecciónalo a mano');
  }
}

// A colored chip for one type. For a creature, pass its types array to render one chip per type.
function typeChip(t) {
  if (!t) return null;
  const c = TYPES[t];
  return h('span', { class: 'el', style: { background: c ? c.color : '#9099a1' } }, typeLabel(t));
}
function typeChips(types) {
  return h('span', { class: 'els' }, ...(types || []).map(typeChip));
}

const CHARGE_TEXT = {
  'solar-beam': 'absorbe luz solar.',
  'solar-blade': 'absorbe luz solar.',
  fly: 'vuela muy alto.',
  bounce: 'da un gran salto.',
  'sky-drop': 'se eleva por los aires.',
  dig: 'se esconde bajo tierra.',
  dive: 'se sumerge en el agua.',
  'phantom-force': 'desaparece de la vista.',
  'shadow-force': 'desaparece de la vista.',
  'skull-bash': 'agacha la cabeza.',
  'sky-attack': 'se envuelve en una luz intensa.',
  'razor-wind': 'crea un torbellino.',
  geomancy: 'absorbe energía del entorno.',
  'electro-shot': 'acumula electricidad.',
  'meteor-beam': 'concentra energía cósmica.',
  'freeze-shock': 'se rodea de un aire gélido.',
  'ice-burn': 'se rodea de un aire gélido.',
};

const STATUS_INFO = {
  brn: { icon: '🔥', name: 'Quemado', desc: 'Pierde 1/16 de sus PS al final de cada turno y sus ataques físicos hacen la mitad de daño.' },
  par: { icon: '⚡', name: 'Paralizado', desc: 'Su velocidad baja a la mitad y cada turno tiene 25% de probabilidad de no poder moverse.' },
  psn: { icon: '☠️', name: 'Envenenado', desc: 'Pierde 1/8 de sus PS al final de cada turno.' },
  tox: { icon: '☠️', name: 'Gravemente envenenado', short: 'Tóxico', desc: 'Pierde cada vez más PS al final de cada turno: 1/16, luego 2/16, 3/16…' },
  slp: { icon: '💤', name: 'Dormido', desc: 'No puede moverse durante 1 a 3 turnos.' },
  frz: { icon: '🧊', name: 'Congelado', desc: 'No puede moverse. Cada turno tiene 20% de probabilidad de descongelarse, y un ataque de Fuego lo descongela.' },
};
const VOLATILE_INFO = {
  confusion: () => ({ icon: '😵', name: 'Confuso', desc: 'Durante unos turnos puede golpearse a sí mismo en vez de atacar (1 de cada 3 veces).' }),
  attract: () => ({ icon: '💘', name: 'Enamorado', desc: 'Cada turno tiene 50% de probabilidad de no atacar.' }),
  perish: (v) => ({ icon: '🎵', name: `Canto mortal: ${v - 1}`, desc: `Se debilitará en ${v - 1} ${v - 1 === 1 ? 'turno' : 'turnos'} si no sale del combate.` }),
  charge: () => ({ icon: '🔋', name: 'Cargado', desc: 'Su próximo ataque Eléctrico tiene el doble de poder.' }),
  flashFire: () => ({ icon: '🔥', name: 'Absorbe Fuego', desc: 'Sus ataques de Fuego son 50% más fuertes.' }),
  disabled: (v) => ({ icon: '🚫', name: 'Anulación', desc: `No puede usar ${v} por unos turnos.` }),
  slowStart: () => ({ icon: '🐢', name: 'Inicio lento', desc: 'Su Ataque y su Velocidad están a la mitad durante unos turnos.' }),
  bound: (v) => ({ icon: '🪢', name: 'Apresado', desc: `${v} le quita 1/8 de sus PS cada turno y no lo deja cambiar, por 4 o 5 turnos.` }),
  trapped: () => ({ icon: '⛓️', name: 'Atrapado', desc: 'No puede cambiar mientras quien lo atrapó siga en combate.' }),
  saltcure: () => ({ icon: '🧂', name: 'Salazón', desc: 'Pierde 1/8 de sus PS cada turno (1/4 si es de tipo Agua o Acero).' }),
  smackdown: () => ({ icon: '⬇️', name: 'En el suelo', desc: 'Lo derribaron: los ataques de Tierra le afectan.' }),
  noRetreat: () => ({ icon: '🚩', name: 'Bastión Final', desc: 'No puede cambiar de Pokémon.' }),
  substitute: () => ({ icon: '🧸', name: 'Sustituto', desc: 'Un muñeco recibe los ataques en su lugar y bloquea los movimientos de estado del rival.' }),
  taunt: (v) => ({ icon: '😤', name: 'Provocado', desc: `Solo puede usar ataques (${v} turnos).` }),
  encore: () => ({ icon: '🔁', name: 'Otra Vez', desc: 'Tiene que repetir su último movimiento.' }),
  torment: () => ({ icon: '😣', name: 'Tormento', desc: 'No puede usar el mismo movimiento dos veces seguidas.' }),
  healblock: (v) => ({ icon: '🚫', name: 'Anticura', desc: `No puede curarse (${v} turnos).` }),
  yawn: () => ({ icon: '🥱', name: 'Bostezo', desc: 'Se dormirá al final del próximo turno.' }),
  nightmare: () => ({ icon: '👻', name: 'Pesadilla', desc: 'Pierde 1/4 de sus PS cada turno mientras duerme.' }),
  curse: () => ({ icon: '🕯️', name: 'Maldición', desc: 'Pierde 1/4 de sus PS cada turno.' }),
  focusenergy: () => ({ icon: '🎯', name: 'Foco Energía', desc: 'Más probabilidad de golpe crítico.' }),
  ingrain: () => ({ icon: '🌱', name: 'Arraigo', desc: 'Recupera 1/16 de sus PS cada turno, pero no puede cambiar.' }),
  aquaring: () => ({ icon: '💧', name: 'Acua Aro', desc: 'Recupera 1/16 de sus PS cada turno.' }),
  magnetrise: (v) => ({ icon: '🧲', name: 'Levitón', desc: `Inmune a los ataques de Tierra (${v} turnos).` }),
  telekinesis: (v) => ({ icon: '🪄', name: 'Telequinesis', desc: `Flota: los ataques no le fallan (${v} turnos).` }),
  foresight: () => ({ icon: '👁️', name: 'Identificado', desc: 'Pierde sus inmunidades de tipo Fantasma y su evasión no cuenta.' }),
  miracleeye: () => ({ icon: '👁️', name: 'Gran Ojo', desc: 'Los ataques Psíquicos le afectan aunque sea Siniestro.' }),
  stockpile: (v) => ({ icon: '📦', name: `Reserva ${v}`, desc: 'Energía acumulada para Escupir o Tragar.' }),
  gastroacid: () => ({ icon: '🧪', name: 'Bilis', desc: 'Su habilidad no tiene efecto.' }),
  uproar: () => ({ icon: '📢', name: 'Alboroto', desc: 'Nadie puede dormirse mientras dure.' }),
  imprison: () => ({ icon: '🔐', name: 'Sellado', desc: 'El rival no puede usar los movimientos que comparten.' }),
};
const NOTHING_WHY = {
  sameGender: 'los dos son del mismo género',
  genderless: 'uno de los dos no tiene género',
  notFirstTurn: 'solo funciona en su primer turno en combate',
  suckerPunch: 'el rival no iba a atacar',
  lostFocus: 'perdió la concentración al recibir un golpe',
  shellTrap: 'no recibió un golpe físico',
  lastResort: 'todavía no usa sus otros movimientos',
  notAsleep: 'el rival no está dormido',
  notAsleepSelf: 'solo se puede usar dormido',
  noTerrain: 'no hay ningún campo activo',
  noType: 'ya no tiene el tipo que necesita',
  noSharedType: 'no comparten ningún tipo',
  lowHp: 'no le quedan suficientes PS',
  substitute: 'el sustituto lo bloquea',
  noBench: 'no hay a quién cambiar',
  noFainted: 'no hay ningún Pokémon debilitado',
  noStockpile: 'no tiene energía reservada',
};
const GENDER = { male: { sym: '♂', name: 'Macho' }, female: { sym: '♀', name: 'Hembra' } };
const genderMark = (g) => (GENDER[g] ? h('span', { class: `gender ${g}`, 'data-tip': GENDER[g].name, 'aria-label': GENDER[g].name }, GENDER[g].sym) : null);
const statusLabel = (status) => `${STATUS_INFO[status].icon} ${STATUS_INFO[status].short ?? STATUS_INFO[status].name}`;
const conditionsOf = (f) => [
  ...(f.status ? [{ key: f.status, ...STATUS_INFO[f.status] }] : []),
  ...Object.entries(f.volatiles || {}).filter(([k, v]) => v && VOLATILE_INFO[k]).map(([k, v]) => ({ key: k, ...VOLATILE_INFO[k](v) })),
];
const STATUS_TEXT = { brn: 'se quema', par: 'queda paralizado', psn: 'queda envenenado', tox: 'queda gravemente envenenado', slp: 'se duerme', frz: 'se congela' };
const CURE_TEXT = { brn: 'ya no está quemado', par: 'ya no está paralizado', psn: 'ya no está envenenado', tox: 'ya no está envenenado', slp: 'se despierta', frz: 'se descongela' };
const WEATHER = { sun: '☀️ Sol', rain: '🌧️ Lluvia', sand: '🌪️ Tormenta de arena', snow: '❄️ Nieve', hail: '🧊 Granizo', harshsun: '🔆 Sol abrasador', heavyrain: '⛈️ Diluvio', winds: '🌀 Turbulencias' };
const WEATHER_START = { sun: 'El sol pega fuerte.', rain: 'Empieza a llover.', sand: 'Se desata una tormenta de arena.', snow: 'Empieza a nevar.', hail: 'Empieza a granizar.', harshsun: 'El sol abrasa: los ataques de Agua se evaporan.', heavyrain: 'Cae un diluvio: los ataques de Fuego se apagan.', winds: 'Soplan turbulencias que protegen a los Volador.' };
const SCREEN = { reflect: 'Reflejo', lightscreen: 'Pantalla de Luz', auroraveil: 'Velo Aurora' };
const SCREEN_GUARDS = { reflect: 'los ataques físicos', lightscreen: 'los ataques especiales', auroraveil: 'los ataques físicos y especiales' };
const SCREEN_END = {
  time: (name, team) => `${name} del equipo de ${team} se desvanece.`,
  broken: (name, team) => `¡Se rompe ${name} del equipo de ${team}!`,
  defog: (name, team) => `El viento se lleva ${name} del equipo de ${team}.`,
  cleaner: (name, team) => `Antibarrera elimina ${name} del equipo de ${team}.`,
};
const TERRAIN = { electric: '⚡ Campo Eléctrico', grassy: '🌿 Campo de Hierba', misty: '🌫️ Campo de Niebla', psychic: '🔮 Campo Psíquico' };
const STAT = { atk: ['ATQ', 'ataque'], def: ['DEF', 'defensa'], satk: ['AT.E', 'ataque especial'], sdef: ['DF.E', 'defensa especial'], spd: ['VEL', 'velocidad'], acc: ['PRE', 'precisión'], eva: ['EVA', 'evasión'] };
const CANT = {
  recharge: 'necesita recargarse.', slp: 'está dormido.', frz: 'está congelado.', par: 'está paralizado: no puede moverse.', flinch: '¡retrocede y no puede moverse!', attract: 'está enamorado y no ataca.',
  taunt: (ev) => `está provocado: no puede usar ${ev.move}.`,
  torment: (ev) => `no puede usar ${ev.move} dos veces seguidas.`,
  twice: (ev) => `no puede usar ${ev.move} dos veces seguidas.`,
  healBlock: (ev) => `no puede curarse: no usa ${ev.move}.`,
  gravity: (ev) => `no puede usar ${ev.move} con la gravedad.`,
  imprison: (ev) => `no puede usar ${ev.move}: está sellado.`,
};
const flinchNote = (m) => {
  const chance = m.secondary?.find((sec) => sec.flinch)?.chance;
  return chance ? `${chance}% de hacer retroceder al rival (pierde su turno) si golpeas antes que él.` : null;
};
const cantText = (ev) => {
  const c = CANT[ev.reason];
  return typeof c === 'function' ? c(ev) : c ?? 'no puede moverse.';
};
const SIDE_COND = {
  spikes: { icon: '📌', name: 'Púas', start: (t) => `Hay púas esparcidas alrededor del equipo de ${t}.`, end: (t) => `Desaparecen las púas del lado de ${t}.`, desc: 'Dañan al que entra y toca el suelo (1/8, 1/6 o 1/4 de los PS según las capas).' },
  stealthrock: { icon: '🪨', name: 'Trampa Rocas', start: (t) => `Rocas puntiagudas flotan alrededor del equipo de ${t}.`, end: (t) => `Desaparecen las rocas del lado de ${t}.`, desc: 'Dañan al que entra según su debilidad a Roca.' },
  stickyweb: { icon: '🕸️', name: 'Red Viscosa', start: (t) => `Una red viscosa se extiende bajo el equipo de ${t}.`, end: (t) => `Desaparece la red viscosa del lado de ${t}.`, desc: 'Baja la Velocidad del que entra y toca el suelo.' },
  tailwind: { icon: '🌬️', name: 'Viento Afín', start: (t) => `Sopla un viento afín a favor del equipo de ${t}.`, end: (t) => `Amaina el viento afín del equipo de ${t}.`, desc: 'Duplica la Velocidad del equipo.' },
  safeguard: { icon: '💠', name: 'Velo Sagrado', start: (t) => `Un velo sagrado protege al equipo de ${t}.`, end: (t) => `Se desvanece el velo sagrado del equipo de ${t}.`, desc: 'Protege al equipo de problemas de estado.' },
  mist: { icon: '🌫️', name: 'Neblina', start: (t) => `Una neblina cubre al equipo de ${t}.`, end: (t) => `Se disipa la neblina del equipo de ${t}.`, desc: 'Impide que el rival baje las características del equipo.' },
  luckychant: { icon: '🍀', name: 'Conjuro', start: (t) => `Un conjuro protege al equipo de ${t} de los golpes críticos.`, end: (t) => `Termina el conjuro del equipo de ${t}.`, desc: 'El rival no puede asestar golpes críticos al equipo.' },
  quickguard: { icon: '⚡', name: 'Anticipo', start: (t) => `El equipo de ${t} se protege de los ataques con prioridad.` },
  wideguard: { icon: '🧱', name: 'Vasta Guardia', start: (t) => `El equipo de ${t} se protege de los ataques en área.` },
  craftyshield: { icon: '🃏', name: 'Truco Defensa', start: (t) => `El equipo de ${t} se protege de los movimientos de estado.` },
  matblock: { icon: '🥋', name: 'Escudo Tatami', start: (t) => `El equipo de ${t} levanta un tatami.` },
  wish: { icon: '🌠', name: 'Deseo', start: (t, ev) => `${ev.name} pide un deseo.` },
};
const ROOM = {
  gravity: { label: '🌌 Gravedad', start: 'La gravedad se intensifica.', end: 'La gravedad vuelve a la normalidad.' },
  trickroom: { label: '🔄 Espacio Raro', start: 'El espacio se retuerce: los más lentos atacan primero.', end: 'El espacio vuelve a la normalidad.' },
  wonderroom: { label: '❓ Zona Extraña', start: 'Se intercambian la Defensa y la Defensa Especial de todos.', end: 'La Zona Extraña desaparece.' },
  mudsport: { label: '🟤 Chapoteo Lodo', start: 'Los ataques Eléctricos se debilitan.', end: 'El efecto de Chapoteo Lodo termina.' },
  watersport: { label: '💧 Hidrochorro', start: 'Los ataques de Fuego se debilitan.', end: 'El efecto de Hidrochorro termina.' },
  fairylock: { label: '🔒 Cerrojo Feérico', start: 'Nadie podrá huir durante el próximo turno.', end: 'El cerrojo feérico se abre.' },
};
const HURT = { leechseed: ' por las drenadoras', brn: ' por la quemadura', psn: ' por el veneno', tox: ' por el veneno', sand: ' por la tormenta de arena', hail: ' por el granizo', recoil: ' por el retroceso', ooze: ' por el lodo líquido', bound: ' por estar apresado', saltcure: ' por la salazón', crash: ' al estrellarse', cost: ' para potenciarse', stealthrock: ' por las rocas puntiagudas', spikes: ' por las púas', curse: ' por la maldición', nightmare: ' por la pesadilla', future: ' por el ataque anticipado', painsplit: ' al compartir el dolor', spikyshield: ' al chocar con el escudo de púas', ability: '' };
const VOLATILE = {
  confusion: () => 'queda confuso.',
  attract: () => 'se enamora.',
  disable: (ev) => `no puede usar ${ev.move}.`,
  perish: () => 'oye el canto mortal: caerá en 3 turnos.',
  charge: () => 'se carga de electricidad.',
  leechseed: () => 'queda sembrado con drenadoras.',
  bound: (ev) => `queda apresado por ${ev.move}.`,
  trapped: () => 'ya no puede huir.',
  saltcure: () => 'queda en salazón.',
  smackdown: () => 'cae al suelo.',
  substitute: () => 'crea un sustituto.',
  taunt: () => 'cae en la provocación.',
  encore: (ev) => `tendrá que repetir ${ev.move}.`,
  torment: () => 'queda atormentado.',
  healblock: () => 'ya no puede curarse.',
  yawn: () => 'empieza a tener sueño.',
  nightmare: () => 'tiene pesadillas.',
  curse: () => 'queda maldito.',
  focusenergy: () => 'se concentra al máximo.',
  laserfocus: () => 'afina la concentración.',
  lockon: () => 'fija al rival en la mira.',
  magnetrise: () => 'levita gracias al magnetismo.',
  telekinesis: () => 'flota por telequinesis.',
  ingrain: () => 'echa raíces.',
  aquaring: () => 'se rodea de un velo de agua.',
  foresight: () => 'queda identificado.',
  miracleeye: () => 'queda identificado.',
  stockpile: (ev) => `reserva energía (${ev.count}).`,
  octolock: () => 'queda atrapado por el pulpo.',
  electrify: () => 'queda electrificado.',
  gastroacid: () => 'pierde el efecto de su habilidad.',
  destinybond: () => 'intenta llevarse al rival consigo.',
  grudge: () => 'guarda rencor.',
  snatch: () => 'espera para robar un movimiento.',
  magiccoat: () => 'se cubre con una capa mágica.',
  quash: () => 'tendrá que actuar último.',
  uproar: () => 'arma un alboroto.',
  bide: () => 'empieza a aguantar.',
  imprison: () => 'sella los movimientos que comparte con el rival.',
};
const VOLATILE_END = {
  disable: (ev) => `vuelve a poder usar ${ev.move}.`,
  bound: (ev) => `se libera de ${ev.move}.`,
  confusion: () => 'ya no está confuso.',
  substitute: () => 'pierde su sustituto.',
  taunt: () => 'ya no está provocado.',
  encore: () => 'ya no tiene que repetir el movimiento.',
  healblock: () => 'puede volver a curarse.',
  telekinesis: () => 'deja de flotar.',
  magnetrise: () => 'deja de levitar.',
  airborne: () => 'cae al suelo por la gravedad.',
  uproar: () => 'se calma.',
  stockpile: () => 'gasta su energía reservada.',
};
const FOCUS_TEXT = { 'focus-punch': 'se concentra…', 'shell-trap': 'prepara una trampa de caparazón…', 'beak-blast': 'calienta su pico…' };
const ABILITY_NOTE = {
  noDrop: () => 'evita que le bajen las características.',
  bounce: () => 'devuelve el movimiento.',
  endure: () => 'aguanta el golpe.',
  weatherOff: () => 'anula los efectos del clima.',
  pressure: () => 'ejerce presión.',
  moldBreaker: () => 'rompe moldes.',
  turboblaze: () => 'desprende un aura llameante.',
  teravolt: () => 'desprende un aura chisporroteante.',
  loafing: () => 'está holgazaneando.',
  shudder: () => 'se estremece: el rival tiene un ataque peligroso.',
  forewarn: (ev) => `prevé ${ev.move}.`,
  trace: (ev) => `copia ${ev.copied}.`,
  slowStart: () => 'no logra ponerse en marcha.',
  slowStartEnd: () => 'por fin se pone en marcha.',
  darkAura: () => 'irradia un aura oscura.',
  fairyAura: () => 'irradia un aura feérica.',
  auraBreak: () => 'invierte las auras.',
  neutralizingGas: () => 'llena el campo de gas reactivo.',
  comatose: () => 'está en coma.',
  ruin: () => 'debilita a quienes lo rodean.',
  asOne: () => 'tiene dos habilidades a la vez.',
  disguise: () => 'su disfraz recibe el golpe.',
  illusionBroken: () => 'su ilusión se desvanece.',
  iceFaceBroken: () => 'su cara de hielo se rompe.',
  iceFaceRestored: () => 'recupera su cara de hielo.',
  gulpArrokuda: () => 'atrapa una presa.',
  gulpPikachu: () => 'atrapa una presa.',
  gulpSpit: () => 'escupe su presa.',
  formZen: () => 'entra en Modo Daruma.',
  formStandard: () => 'vuelve a su forma normal.',
  formBlade: () => 'cambia a forma filo.',
  formShield: () => 'cambia a forma escudo.',
  formSchool: () => 'forma un banco.',
  formSolo: () => 'deshace el banco.',
  formCore: () => 'pierde su coraza.',
  formMeteor: () => 'recupera su coraza.',
  formComplete: () => 'alcanza su forma completa.',
  formHero: () => 'se transforma en héroe.',
  formTerastal: () => 'adopta su forma teracristal.',
  formHangry: () => 'le entra el hambre.',
  formFullBelly: () => 'queda satisfecho.',
  paradox: (ev) => `potencia su ${STAT[ev.stat]?.[1] ?? 'fuerza'}.`,
};
const signed = (n) => `${n > 0 ? '+' : ''}${n}`;
const CATEGORY = { physical: 'Físico', special: 'Especial', status: 'Estado' };
const MOVE_ORIGIN = { machine: 'MT/MO', tutor: 'Tutor', egg: 'Huevo', other: 'Otro' };
const MOVE_ORIGIN_FILTER = { level: 'Por nivel', machine: 'MT / MO', tutor: 'Tutor', egg: 'Huevo', other: 'Otros' };
const INFLICT = { brn: 'quemar', par: 'paralizar', psn: 'envenenar', tox: 'envenenar gravemente', frz: 'congelar', slp: 'dormir' };
const STAT_THE = { atk: 'el ataque', def: 'la defensa', satk: 'el ataque especial', sdef: 'la defensa especial', spd: 'la velocidad', acc: 'la precisión', eva: 'la evasión' };
const stageMult = (k, s) => {
  const base = k === 'acc' || k === 'eva' ? 3 : 2;
  return s >= 0 ? (base + s) / base : base / (base - s);
};

const multText = (k, stage) => `×${stageMult(k, stage).toFixed(2).replace(/\.?0+$/, '')}`;
function boostChips(boosts, { long = false } = {}) {
  return Object.entries(STAT)
    .filter(([k]) => boosts?.[k])
    .map(([k, [label, word]]) => {
      const stage = boosts[k];
      const up = stage > 0;
      const tip = `${word.charAt(0).toUpperCase()}${word.slice(1)} ${signed(stage)}: ${up ? 'sube' : 'baja'} a ${multText(k, stage)}`;
      return h('span', { class: `boost ${up ? 'up' : 'down'}`, tabindex: 0, 'data-tip': tip }, h('i', { 'aria-hidden': 'true' }, up ? '▲' : '▼'), long ? `${word} ${signed(stage)} (${multText(k, stage)})` : `${label} ${signed(stage)}`);
    });
}

function moveEffects(m) {
  const out = [];
  if (m.kind && m.kind !== 'attack') out.push(m.desc);
  if (m.priority > 0) out.push('Ataca primero.');
  if (m.contact) out.push('Hace contacto.');
  if (m.multihit) out.push('Golpea de 2 a 5 veces.');
  if (m.crit) out.push('Alta probabilidad de golpe crítico.');
  for (const s of m.secondary || []) {
    if (s.status) out.push(`${s.chance}% de ${INFLICT[s.status]}.`);
    if (s.flinch) out.push(`${s.chance}% de hacer retroceder (solo si golpea antes que el rival).`);
    if (s.confuse) out.push(`${s.chance}% de confundir.`);
    for (const k of Object.keys(s.boosts || {})) out.push(`${s.chance}% de bajar ${STAT_THE[k]} del rival.`);
    if (s.self) out.push(`${s.chance}% de subir su ${Object.keys(s.self).map((k) => STAT[k][1]).join(', ')}.`);
  }
  for (const [k, v] of Object.entries(m.self || {})) out.push(`${v < 0 ? 'Baja' : 'Sube'} su ${STAT[k][1]}${Math.abs(v) > 1 ? ` ${Math.abs(v)} niveles` : ''}.`);
  if (m.recoil) out.push('El usuario recibe 1/3 del daño como retroceso.');
  if (m.drain) out.push(`Recupera el ${Math.round(m.drain * 100)}% del daño causado.`);
  if (m.key === 'attract') out.push('Solo funciona entre un macho y una hembra.');
  if (m.breaksScreens) out.push('Rompe Reflejo, Pantalla de Luz y Velo Aurora antes de golpear.');
  return out;
}

function infoCard(f, { own, owner, close }) {
  const pct = Math.max(0, Math.round((f.hp / f.stats.hp) * 100));
  const conditions = conditionsOf(f);
  const boosts = Object.entries(STAT).filter(([k]) => f.boosts?.[k]);
  const moves = own ? f.moves : [...f.moves, ...Array(Math.max(0, 4 - f.moves.length)).fill(null)];
  const ab = f.abilityInfo;

  return h(
    'div',
    { class: 'info-card' },
    h('button', { class: 'info-close', type: 'button', 'aria-label': 'Cerrar', onclick: close }, '×'),
    h(
      'header',
      null,
      h('div', { class: 'info-sprite', html: creatureHTML(f) }),
      h(
        'div',
        null,
        h('h2', null, f.shiny ? `✨ ${f.name}` : f.name, ' ', genderMark(f.gender) ?? h('span', { class: 'gender none', 'data-tip': 'Sin género: Atracción no le afecta ni la puede usar.' }, '∅')),
        h('p', { class: 'muted small' }, f.name !== f.speciesName ? `${f.speciesName} · ` : '', `Nv ${f.level} · de ${owner}`),
        typeChips(f.types),
      ),
    ),
    h('section', null, h('h3', null, 'PS'), h('p', null, own ? `${f.hp} / ${f.stats.hp} PV (${pct}%)` : `${pct}%`)),
    h(
      'section',
      null,
      h('h3', null, 'Estado'),
      conditions.length
        ? h('div', { class: 'cond-list' }, conditions.map((c) => h('div', { class: `cond-row ${c.key}` }, h('span', { class: 'cond-icon', 'aria-hidden': 'true' }, c.icon), h('div', null, h('b', null, c.name), h('small', null, c.desc)))))
        : h('p', { class: 'muted' }, 'Sin problemas de estado.'),
    ),
    h(
      'section',
      null,
      h('h3', null, 'Cambios de características'),
      boosts.length ? h('div', { class: 'boost-list' }, boostChips(f.boosts, { long: true })) : h('p', { class: 'muted' }, 'Sin cambios.'),
    ),
    own
      ? h('section', null, h('h3', null, 'Características'), h('div', { class: 'info-stats' }, [['PS', 'hp'], ['Ataque', 'atk'], ['Defensa', 'def'], ['At. Esp.', 'satk'], ['Def. Esp.', 'sdef'], ['Velocidad', 'spd']].map(([l, k]) => {
          const stage = k === 'hp' ? 0 : f.boosts?.[k] ?? 0;
          const now = Math.floor(f.stats[k] * stageMult(k, stage));
          return h('span', { class: stage > 0 ? 'up' : stage < 0 ? 'down' : null, 'data-tip': stage ? `${f.stats[k]} sin cambios · ${multText(k, stage)}` : null }, h('b', null, now, stage ? h('i', { 'aria-hidden': 'true' }, stage > 0 ? ' ▲' : ' ▼') : null), l);
        })))
      : null,
    h(
      'section',
      null,
      h('h3', null, 'Habilidad'),
      ab
        ? [h('p', null, abilityChip(ab)), h('p', null, ab.desc), ab.inert ? h('p', { class: 'muted small' }, ab.inert) : null]
        : [h('p', null, h('span', { class: 'ability inert' }, 'Desconocida')), h('p', { class: 'muted small' }, 'No sabes su habilidad hasta que se active en combate.')],
    ),
    h(
      'section',
      null,
      h('h3', null, own ? 'Movimientos' : 'Movimientos vistos'),
      h(
        'ul',
        { class: 'info-moves' },
        moves.map((m) =>
          m
            ? h(
                'li',
                null,
                h('div', { class: 'mv-head' }, h('b', null, m.name), typeChip(m.type), h('span', { class: 'muted small' }, CATEGORY[m.category] || ''), m.power ? h('span', { class: 'muted small' }, `Poder ${m.power} · ${m.accuracy}%`) : null),
                h('p', { class: 'muted small' }, moveEffects(m).join(' ') || 'Sin efectos adicionales.'),
              )
            : h('li', { class: 'muted' }, '???'),
        ),
      ),
    ),
  );
}

function abilityChip(info) {
  if (!info) return null;
  return h('span', { class: `ability${info.inert ? ' inert' : ''}`, tabindex: 0, 'data-tip': info.desc, 'data-tip-note': info.inert || null }, info.name);
}

function monCard(f, opts = {}) {
  const clickable = !!opts.onclick;
  return h(
    'div',
    {
      class: `mon${f.shiny ? ' shiny-card' : ''}${opts.picked ? ' picked' : ''}${opts.cls ? ` ${opts.cls}` : ''}`,
      'aria-label': opts.label ?? null,
      tabindex: clickable ? 0 : null,
      role: clickable ? 'button' : null,
      'aria-pressed': clickable ? String(!!opts.picked) : null,
      'data-sfx': opts.sfx ?? null,
      onclick: opts.onclick,
      onkeydown: clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onclick(); } } : null,
    },
    opts.badge ? h('span', { class: 'badge' }, opts.badge) : null,
    f.shiny ? h('span', { class: 'shiny', 'data-tip': 'Shiny' }, '✨') : null,
    h('div', { html: creatureHTML(f) }),
    h('div', { class: 'nm', title: f.name !== f.speciesName ? `${f.name} (${f.speciesName})` : f.name }, f.name, genderMark(f.gender)),
    h('div', { class: 'meta' }, typeChips(f.types), h('span', null, `Nv ${f.level}`), opts.rarity !== false ? h('span', null, RARITY[f.rarity] || '') : null),
    f.abilityInfo ? h('div', { class: 'ab-line' }, abilityChip(f.abilityInfo)) : null,
    opts.stats
      ? h('div', { class: 'stats' }, ...[['PV', 'hp'], ['ATQ', 'atk'], ['DEF', 'def'], ['AT.E', 'satk'], ['DF.E', 'sdef'], ['VEL', 'spd']].map(([l, k]) => h('span', null, h('b', null, f.stats[k]), l)))
      : null,
    opts.extra ?? null,
    opts.onEdit ? h('button', { class: 'edit', 'data-tip': 'Ponerle apodo', 'aria-label': `Apodo para ${f.name}`, onclick: (e) => { e.stopPropagation(); opts.onEdit(); } }, '✎') : null,
  );
}

function rosterFilters(onChange) {
  const by = { query: '', type: '', shiny: '' };
  const set = (k, v) => { by[k] = v; onChange(); };
  const el = h(
    'div',
    { class: 'coll-filters' },
    h('input', { type: 'search', placeholder: 'Buscar por nombre…', 'aria-label': 'Buscar Pokémon', oninput: (e) => set('query', e.target.value.trim().toLowerCase()) }),
    h('select', { 'aria-label': 'Filtrar por tipo', onchange: (e) => set('type', e.target.value) }, h('option', { value: '' }, 'Todos los tipos'), Object.keys(TYPES).map((t) => h('option', { value: t }, typeLabel(t)))),
    h('select', { 'aria-label': 'Filtrar shiny', onchange: (e) => set('shiny', e.target.value) }, h('option', { value: '' }, 'Shiny y normales'), h('option', { value: 'shiny' }, '✨ Solo shiny'), h('option', { value: 'plain' }, 'Solo normales')),
  );
  const match = (f) => (!by.query || f.name.toLowerCase().includes(by.query) || f.speciesName.toLowerCase().includes(by.query)) && (!by.type || f.types.includes(by.type)) && (!by.shiny || (by.shiny === 'shiny') === !!f.shiny);
  return { el, match };
}

function collectionBar(filters, countEl) {
  return h('div', { class: 'coll-bar' }, filters.el, countEl);
}

const shownCount = (el, shown, total) => {
  el.textContent = shown === total ? `${total} Pokémon` : `${shown} de ${total}`;
};

function toolButton({ icon, label, note, tip, ...attrs }) {
  return h(attrs.href ? 'a' : 'button', { ...(attrs.href ? {} : { type: 'button' }), class: 'tool-btn', 'data-tip': tip ?? null, ...attrs }, h('span', { class: 'tool-icon', 'aria-hidden': 'true' }, icon), h('span', { class: 'tool-text' }, h('b', null, label), note ? h('small', null, note) : null));
}

const trainerURL = (key) => `/trainers/${key}.png`;
function trainerImg(key, cls = '') {
  return h('img', { class: `trainer-img${cls ? ` ${cls}` : ''}`, src: trainerURL(key), alt: '', draggable: 'false', loading: 'lazy' });
}
let FACES = {};
const loadFaces = () => fetch('/trainers/faces.json?v=dev').then((res) => (res.ok ? res.json() : {})).then((faces) => { FACES = faces; }).catch(() => {});
const FACE_SHARE = 52;
function avatarPic(key, size = 'sm', frame = null) {
  if (!key) return null;
  const face = FACES[VARIANTS_BY_KEY.get(key)?.base ?? key];
  const style = face ? { '--fx': String(face[0]), '--fy': String(face[1]), '--zoom': String(Math.round(FACE_SHARE / face[2])) } : null;
  return h('span', { class: `avatar avatar-${size}${face ? ' has-face' : ''}${frame ? ` ring-${frame}` : ''}`, style, 'aria-hidden': 'true' }, h('span', { class: 'avatar-clip' }, trainerImg(key)));
}
const VARIANTS_BY_KEY = new Map(TRAINER_VARIANTS.map((variant) => [variant.key, variant]));
const byLabel = (a, b) => trainerLabel(a).localeCompare(trainerLabel(b), 'es', { numeric: true, sensitivity: 'base' });
const trainerLabel = (key) => {
  const variant = VARIANTS_BY_KEY.get(key);
  if (variant) return variant.name ?? `${baseTrainerLabel(variant.base)} ${VARIANT_COLOR_NAMES[variant.color] ?? variant.color}`;
  return baseTrainerLabel(key);
};
const baseTrainerLabel = (key) => key.replace(/_([mf])(?=$|_)/, (_, g) => (g === 'm' ? ' ♂' : ' ♀')).replace(/_(\d)$/, ' $1').replace(/_/g, ' ').replace(/\b\p{L}/gu, (ch) => ch.toUpperCase());

const TRAINER_GROUPS = { '': 'Todas las categorías', unlocked: 'Desbloqueados', locked: 'Bloqueados', class: 'Clases de entrenador', shop: 'En venta', variant: 'Variantes de colores', gym: 'Líderes de gimnasio', elite: 'Alto Mando', champion: 'Campeones', villain: 'Villanos', special: 'Especiales' };

async function loadAchievements() {
  if (!me) return null;
  let sprites;
  try {
    sprites = (await api('/api/me/achievements')).sprites;
  } catch {
    return null;
  }
  const storeKey = `tc_unlocked_${me.id}`;
  const unlocked = sprites.filter((p) => p.unlocked && p.group !== 'starter').map((p) => p.key);
  const known = ls.get(storeKey);
  if (known !== null) {
    const before = new Set(known.split(',').filter(Boolean));
    const fresh = unlocked.filter((key) => !before.has(key));
    if (fresh.length) toast(`🔓 Desbloqueaste a ${fresh.slice(0, 3).map(trainerLabel).join(', ')}${fresh.length > 3 ? ` y ${fresh.length - 3} más` : ''}. Elígelo en tu perfil.`);
  }
  ls.set(storeKey, unlocked.join(','));
  return sprites;
}

function renderWho() {
  $who.replaceChildren();
  if (!me) return;
  $who.append(h('a', { class: 'chip who-chip', href: '/perfil', 'data-link': true, 'data-tip': 'Tu perfil' }, avatarPic(me.avatar, 'sm', me.frame), me.name), h('span', { class: 'chip' }, h('span', { class: 'w' }, `${me.wins}V`), ' · ', h('span', { class: 'l' }, `${me.losses}D`)));
}

// ---------- routing ----------
let routeSeq = 0;
let shownPath = location.pathname + location.search;
let unsaved = null;
const UNSAVED_MSG = 'Tienes cambios sin guardar. ¿Descartarlos?';
const canLeave = () => !unsaved?.() || window.confirm(UNSAVED_MSG);
const stale = (seq) => seq !== routeSeq;

function nav(path) {
  if (!canLeave()) return;
  unsaved = null;
  history.pushState(null, '', path);
  route();
  if (!$app.classList.contains('page-leave')) window.scrollTo(0, 0);
}

const PAGE_FADE_MS = 320;
async function smoothNav(path) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return nav(path);
  $app.classList.remove('page-enter');
  $app.classList.add('page-leave');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  await sleep(PAGE_FADE_MS);
  nav(path);
  setTimeout(() => $app.classList.contains('page-leave') && revealPage(), 4000);
}

function revealPage() {
  $app.classList.remove('page-leave');
  playClass($app, 'page-enter', 500);
}

new MutationObserver(() => {
  if ($app.classList.contains('page-leave') && !$app.querySelector('.pad')) revealPage();
}).observe($app, { childList: true });
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || a.origin !== location.origin || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  nav(a.pathname + a.search);
});
window.addEventListener('popstate', () => {
  if (!canLeave()) return history.pushState(null, '', shownPath);
  unsaved = null;
  route();
});
window.addEventListener('beforeunload', (e) => {
  if (unsaved?.()) e.preventDefault();
});
window.addEventListener('pagehide', () => {
  closeRoomsFeed();
  cleanup?.();
  cleanup = null;
});
window.addEventListener('pageshow', (e) => {
  if (e.persisted) route();
});

const $tip = h('div', { class: 'tip', role: 'tooltip', hidden: true });
document.body.append($tip);
let tipTarget = null;
function showTip(el) {
  tipTarget = el;
  const layer = el.closest('dialog[open]') ?? document.body;
  if ($tip.parentElement !== layer) layer.append($tip);
  $tip.replaceChildren(el.dataset.tip, ...(el.dataset.tipNote ? [h('span', { class: 'tip-note' }, el.dataset.tipNote)] : []));
  $tip.hidden = false;
  const r = el.getBoundingClientRect();
  const t = $tip.getBoundingClientRect();
  const gap = 8;
  const left = Math.min(Math.max(16, r.left + r.width / 2 - t.width / 2), innerWidth - t.width - 16);
  const above = r.top - t.height - gap >= 8;
  $tip.style.left = `${left}px`;
  $tip.style.top = `${above ? r.top - t.height - gap : r.bottom + gap}px`;
  $tip.style.setProperty('--arrow-x', `${r.left + r.width / 2 - left}px`);
  $tip.classList.toggle('below', !above);
  requestAnimationFrame(() => $tip.classList.add('show'));
}
function hideTip() {
  tipTarget = null;
  $tip.classList.remove('show');
  $tip.hidden = true;
}
document.addEventListener('mouseover', (e) => {
  if (tipTarget && !tipTarget.isConnected) hideTip();
  const el = e.target.closest?.('[data-tip]');
  if (el === tipTarget) return;
  el ? showTip(el) : hideTip();
});
document.addEventListener('focusin', (e) => {
  const el = e.target.closest?.('[data-tip]');
  el ? showTip(el) : hideTip();
});
document.addEventListener('focusout', hideTip);
document.addEventListener('click', hideTip, true);
addEventListener('scroll', hideTip, { passive: true, capture: true });
document.addEventListener(
  'load',
  (e) => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.closest('.creature') || img.closest('.spot')) return;
    const native = img.naturalWidth !== SPRITE_CANVAS || img.naturalHeight !== SPRITE_CANVAS;
    img.classList.toggle('native', native);
    img.style.width = native ? `${(img.naturalWidth / SPRITE_CANVAS) * 100}%` : '';
    img.style.height = native ? `${(img.naturalHeight / SPRITE_CANVAS) * 100}%` : '';
  },
  true,
);

function markNav() {
  const current = { '/stats': 'stats', '/': 'home', '/coleccion': 'collection', '/pokedex': 'pokedex', '/perfil': 'profile', '/reciclaje': 'recycling' }[location.pathname] ?? null;
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

const TAB_MUSIC = { '/': 'tab:home', '/coleccion': 'tab:collection', '/pokedex': 'tab:pokedex', '/stats': 'tab:stats', '/perfil': 'tab:shop', '/reciclaje': 'tab:recycling' };
const music = createPlayer({
  storage: {
    getItem: (k) => ls.get(k),
    setItem: (k, v) => ls.set(k, v),
  },
});
['pointerdown', 'keydown'].forEach((type) => document.addEventListener(type, () => music.unlock(), { capture: true }));

const CLICKABLE = 'button, a[href], [role="button"], [role="tab"], summary';
const CLOSES = '.info-close, .dex-close, .seat-x, .cell-remove';

function clickSound(el) {
  if (el.dataset.sfx) return el.dataset.sfx === 'none' ? null : el.dataset.sfx;
  if (el.disabled || el.getAttribute('aria-disabled') === 'true') return null;
  if (el.matches('.danger')) return 'danger';
  if (el.matches(CLOSES)) return 'back';
  if (el.hasAttribute('aria-expanded')) return el.getAttribute('aria-expanded') === 'true' ? 'back' : 'open';
  if (el.hasAttribute('aria-haspopup')) return 'open';
  if (el.matches('.primary')) return 'confirm';
  return 'select';
}

document.addEventListener('click', (e) => {
  const el = e.target.closest?.(CLICKABLE);
  const kind = el && clickSound(el);
  if (kind) music.ui(kind);
}, { capture: true });

function radioButton() {
  let kind = '';
  let region = '';
  let query = '';
  const btn = h('button', { class: 'sound-btn radio-btn', type: 'button', 'aria-label': 'Radio', 'aria-haspopup': 'dialog', 'data-tip': 'Radio' }, '📻');
  const now = h('div', { class: 'radio-now' });
  const count = h('span', { class: 'muted small' });
  const list = h('div', { class: 'radio-list', role: 'listbox', 'aria-label': 'Canciones' });
  const dlg = h('dialog', { class: 'info-dlg radio-dlg', onclick: (e) => e.target === e.currentTarget && e.currentTarget.close() });
  const shown = () => {
    const words = query.toLowerCase();
    return RADIO_TRACKS.filter((t) => (!kind || t.kind === kind) && (!region || t.region === region) && (!words || `${t.title} ${RADIO_REGIONS[t.region]}`.toLowerCase().includes(words)));
  };
  const tune = (id) => {
    music.setRadio(id);
    paint();
  };
  function paint() {
    const on = radioTrack(music.radio);
    btn.classList.toggle('on', !!on);
    btn.dataset.tip = on ? `Radio: ${on.title}` : 'Radio';
    now.replaceChildren(
      on
        ? h('p', null, h('span', { class: 'live-dot on' }), ' Sonando ', h('b', null, on.title), h('span', { class: 'muted' }, ` · ${RADIO_REGIONS[on.region]}`))
        : h('p', { class: 'muted' }, 'Apagada: suena la música de cada pantalla. Elige una canción para que suene en todo el sitio.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn sm', type: 'button', onclick: () => { const pool = shown(); if (pool.length) tune(pool[Math.floor(Math.random() * pool.length)].id); } }, '🔀 Al azar'),
        on ? h('button', { class: 'btn sm danger', type: 'button', onclick: () => tune(null) }, '⏹ Apagar radio') : null,
      ),
    );
    const tracks = shown();
    count.textContent = `${tracks.length} canciones`;
    list.replaceChildren(...(tracks.length ? tracks.map((t) => h('button', { type: 'button', class: `radio-item${music.radio === t.id ? ' is-on' : ''}`, role: 'option', 'aria-selected': String(music.radio === t.id), onclick: () => tune(t.id) }, h('span', { class: 'radio-title' }, music.radio === t.id ? '▶ ' : '', t.title), h('span', { class: 'radio-tags' }, h('span', { class: `chip radio-kind ${t.kind}` }, RADIO_KINDS[t.kind]), h('span', { class: 'chip' }, RADIO_REGIONS[t.region])))) : [h('p', { class: 'muted' }, 'Ninguna canción coincide con el filtro.')]));
  }
  dlg.append(h('div', { class: 'radio-body' },
    h('div', { class: 'row between' }, h('h2', null, '📻 Radio'), h('button', { class: 'btn sm ghost', type: 'button', 'aria-label': 'Cerrar', onclick: () => dlg.close() }, '✕')),
    now,
    h('div', { class: 'radio-filters' },
      h('input', { type: 'search', placeholder: 'Buscar canción…', 'aria-label': 'Buscar canción', oninput: (e) => { query = e.target.value.trim(); paint(); } }),
      h('select', { 'aria-label': 'Tipo de canción', onchange: (e) => { kind = e.target.value; paint(); } }, h('option', { value: '' }, 'Batalla y otras'), Object.entries(RADIO_KINDS).map(([value, label]) => h('option', { value }, label))),
      h('select', { 'aria-label': 'Región o generación', onchange: (e) => { region = e.target.value; paint(); } }, h('option', { value: '' }, 'Todas las regiones'), Object.entries(RADIO_REGIONS).map(([value, label]) => h('option', { value }, label))),
      count,
    ),
    list,
  ));
  btn.addEventListener('click', () => {
    paint();
    if (!dlg.open) dlg.showModal();
  });
  paint();
  return [btn, dlg];
}

function renderSound() {
  const host = document.getElementById('sound');
  if (!host) return;
  const silent = () => music.muted || (music.volume('music') === 0 && music.volume('sfx') === 0);
  const icon = () => (silent() ? '🔇' : '🔊');
  const btn = h('button', { class: 'sound-btn', type: 'button', 'data-sfx': 'none', 'aria-label': 'Mezclador de sonido', 'aria-haspopup': 'true', 'aria-expanded': 'false' }, icon());
  const muteBox = h('input', { type: 'checkbox', checked: music.muted ? true : null });
  const notifyBox = h('input', { type: 'checkbox', checked: notifier.enabled ? true : null });
  const notifyNote = h('p', { class: 'muted small', hidden: true });
  const paintNotify = () => {
    const blocked = notifier.enabled && notifier.permission() === 'denied';
    const unsupported = notifier.enabled && notifier.permission() === 'unsupported';
    notifyNote.hidden = !blocked && !unsupported;
    notifyNote.textContent = blocked ? 'El navegador bloqueó los avisos: solo parpadeará la pestaña.' : unsupported ? 'Este navegador no tiene avisos: solo parpadeará la pestaña.' : '';
  };
  notifyBox.addEventListener('change', async () => {
    await notifier.setEnabled(notifyBox.checked);
    paintNotify();
  });
  paintNotify();
  const sliders = [];
  const channel = (kind, label, icon) => {
    const value = h('span', { class: 'mix-value' }, `${Math.round(music.volume(kind) * 100)}%`);
    const slider = h('input', { type: 'range', min: 0, max: 100, value: Math.round(music.volume(kind) * 100), 'aria-label': `Volumen de ${label.toLowerCase()}` });
    slider.addEventListener('input', () => {
      music.setVolume(kind, Number(slider.value) / 100);
      if (music.muted && Number(slider.value) > 0) {
        music.setMuted(false);
        muteBox.checked = false;
      }
      value.textContent = `${slider.value}%`;
      paint();
    });
    sliders.push(slider);
    return h('label', { class: 'mix-row' }, h('span', { class: 'mix-label' }, icon, ' ', label), slider, value);
  };
  const panel = h(
    'div',
    { class: 'mixer', hidden: true, role: 'group', 'aria-label': 'Mezclador de sonido' },
    h('b', { class: 'mix-title' }, 'Sonido'),
    channel('music', 'Música de fondo', '🎵'),
    channel('sfx', 'Combate', '💥'),
    h('label', { class: 'mix-mute' }, muteBox, ' Silenciar todo'),
    h('label', { class: 'mix-mute', 'data-tip': 'Te avisa cuando se llena tu sala, cuando solo faltas tú por estar listo y cuando te toca en una pelea, si estás en otra pestaña.' }, notifyBox, ' 🔔 Avisos'),
    notifyNote,
  );
  const paint = () => {
    btn.textContent = icon();
    sliders.forEach((sl) => (sl.disabled = music.muted));
  };
  muteBox.addEventListener('change', () => {
    music.setMuted(muteBox.checked);
    paint();
  });
  const close = () => {
    panel.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
  };
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.hidden = !panel.hidden;
    btn.setAttribute('aria-expanded', String(!panel.hidden));
  });
  panel.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', close);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close());
  paint();
  host.replaceChildren(...radioButton(), btn, panel);
}
renderSound();

// Without the sprite manifest every Pokémon would stay blank for the session, so each navigation
// asks for it again. One request at a time, and the repaint waits if it would drop unsaved edits.
// A battle the player moved into meanwhile is not repainted: that would reconnect its socket mid-fight.
let spritesRetry = null;
function retrySprites() {
  if (spritesLoaded() || spritesRetry) return;
  const startedOn = location.pathname;
  const enteredBattle = () => location.pathname !== startedOn && location.pathname.startsWith('/b/');
  spritesRetry = loadSprites()
    .finally(() => (spritesRetry = null))
    .then(() => spritesLoaded() && !unsaved?.() && !enteredBattle() && route(), () => {});
}

function route() {
  hideTip();
  retrySprites();
  if (TAB_MUSIC[location.pathname]) music.play(TAB_MUSIC[location.pathname]);
  else if (location.pathname.startsWith('/t/')) music.play('tab:home');
  else if (location.pathname.startsWith('/b/')) music.play('prep');
  closeRoomsFeed();
  cleanup?.();
  cleanup = null;
  unsaved = null;
  shownPath = location.pathname + location.search;
  const seq = ++routeSeq;
  markNav();
  const m = /^\/b\/([A-Za-z0-9_-]{4,20})$/.exec(location.pathname);
  if (m) return battlePage(m[1], seq);
  if (location.pathname === '/equipo') {
    history.replaceState(null, '', `/coleccion${location.search}`);
    return route();
  }
  if (location.pathname === '/coleccion') return teamPage(seq);
  if (location.pathname === '/pokedex') return pokedexPage(seq);
  if (location.pathname === '/stats') return statsPage(seq);
  if (location.pathname === '/tienda') {
    history.replaceState(null, '', `/perfil${location.search}`);
    return route();
  }
  if (location.pathname === '/perfil') return profilePage(seq);
  if (location.pathname === '/reciclaje') return recyclingPage(seq);
  const t = /^\/t\/([A-Za-z0-9_-]{4,20})$/.exec(location.pathname);
  if (t) return tournamentPage(t[1], seq);
  return homePage(seq);
}

async function loadMe() {
  if (!token) return;
  try {
    me = (await api('/api/me')).me;
  } catch (e) {
    if (e.status === 401) {
      token = null;
      ls.set('tc_token', null);
    }
  }
}

// ---------- import ----------
function importCard({ onDone, compact: small = false } = {}) {
  const err = h('p', { class: 'error', hidden: true });
  const nameInput = h('input', { type: 'text', id: 'tname', maxlength: 24, placeholder: 'Ej: Seba', value: me?.name || '', autocomplete: 'nickname' });
  const fileInput = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
  const dropText = h('span', { class: 'muted small' }, 'o haz clic para elegirlo');
  const drop = h('div', { class: 'drop', tabindex: 0, role: 'button' }, h('strong', null, '📦 Arrastra aquí tu save de PokeTokenBar'), dropText);

  async function handle(file) {
    err.hidden = true;
    if (!file) return;
    const name = nameInput.value.trim();
    if (!me && !name) {
      err.textContent = 'Primero ponte un nombre de entrenador.';
      err.hidden = false;
      nameInput.focus();
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      err.textContent = 'Ese archivo pesa más de 8 MB; no parece un save.';
      err.hidden = false;
      return;
    }
    dropText.textContent = 'Leyendo…';
    try {
      const save = await file.text();
      const data = await api('/api/import', { method: 'POST', body: { name, save } });
      await rememberSave(save);
      if (data.token) {
        token = data.token;
        ls.set('tc_token', token);
      }
      me = data.me;
      renderWho();
      toast(`¡Listo! ${me.rosterSize} Pokémon importados`);
      onDone?.();
    } catch (e) {
      err.textContent = e.message;
      err.hidden = false;
      dropText.textContent = 'o haz clic para elegirlo';
    }
  }

  fileInput.addEventListener('change', () => handle(fileInput.files[0]));
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); handle(e.dataTransfer.files[0]); });

  return h(
    'div',
    { class: 'card' },
    small ? null : h('h2', null, me ? 'Actualizar tu save' : 'Trae tu equipo'),
    h('div', { class: 'field' }, h('label', { for: 'tname' }, 'Nombre de entrenador'), nameInput),
    drop,
    fileInput,
    err,
    h(
      'ol',
      { class: 'steps' },
      h('li', null, 'En PokeTokenBar: Ajustes → Backup & Transfer → Exportar. Arrastra el ', h('code', null, 'PokeTokenBar-Save-….json'), '.'),
      h('li', null, 'O directo el archivo vivo: en Finder ⌘⇧G y pega ', h('code', null, '~/Library/Application Support/PokeTokenBar/companion-state.json')),
    ),
    h('p', { class: 'muted small' }, 'Solo guardamos números: especie, nivel, rareza, IVs y si es shiny. Nada de tu Mac ni de tus logs.'),
  );
}

// ---------- profile ----------
// ---------- shop ----------
const tokensM = (n) => `${Math.floor(n / 1_000_000).toLocaleString('es')} M`;
const FREE_ITEMS = [
  { id: 'ball:pb', kind: 'ball', key: 'pb', name: 'Poké Ball', rarity: null, price: 0, desc: 'La Poké Ball de siempre.', owned: true, free: true },
  { id: 'window:none', kind: 'window', key: null, name: 'Ventana normal', rarity: null, price: 0, desc: 'El cuadro de texto de siempre.', owned: true, free: true },
  { id: 'frame:none', kind: 'frame', key: null, name: 'Sin marco', rarity: null, price: 0, desc: 'Tu foto, sin aro.', owned: true, free: true },
];

const BALL_FX_NOTE = {
  free: 'Los destellos clásicos de PokeRogue.',
  common: 'Un destello y un anillo de partículas con su tema.',
  rare: 'Más partículas, un segundo anillo y brillo en el suelo.',
  epic: 'Ondas, espirales y detalles alrededor de tu Pokémon.',
  legendary: 'Rayos, un pilar de luz y ondas expansivas.',
  mythic: 'El efecto completo: rayos dobles, lluvia de destellos y una corona de estrellas.',
};

function shopPreview(item) {
  if (item.kind === 'ball') return h('span', { class: 'shop-ball' }, h('img', { src: `/anims/ui/${item.key}.png?v=dev`, alt: '', draggable: 'false' }), h('img', { src: `/anims/ui/${item.key}_open.png?v=dev`, alt: '', draggable: 'false' }));
  if (item.kind === 'window') return h('span', { class: `say-sample${item.key ? ` win-theme win-${item.key}` : ''}` }, h('b', null, '¿Qué hará tu Pokémon?'), h('small', null, 'Tu Pikachu usó Impactrueno.'));
  if (item.kind === 'frame') return avatarPic(me.avatar, 'lg', item.key);
  return h('span', { class: 'trainer-frame' }, trainerImg(item.key));
}

async function profilePage(seq) {
  document.title = 'Perfil · Token Clash';
  await loadMe();
  if (stale(seq)) return;
  renderWho();
  if (!me) return renderLanding();
  $app.replaceChildren(h('p', { class: 'muted center pad' }, 'Abriendo tu perfil…'));
  let shop;
  try {
    shop = (await api('/api/shop')).shop;
  } catch (e) {
    if (stale(seq)) return;
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'No pude abrir tu perfil'), h('p', { class: 'muted' }, e.message)));
    return;
  }
  if (stale(seq)) return;
  let kind = 'ball';
  let ownership = '';
  let rarity = '';
  let query = '';
  let group = '';
  let gender = '';
  let progress = new Map();
  const identity = h('div', { class: 'profile-identity' });
  const balance = h('div', { class: 'shop-balance' });
  const grid = h('div', { class: 'shop-grid' });
  const trainerFilters = h('div', { class: 'row trainer-filters', hidden: true },
    h('select', { 'aria-label': 'Filtrar por categoría', onchange: (e) => { group = e.target.value; paint(); } }, Object.entries(TRAINER_GROUPS).filter(([value]) => !['unlocked', 'locked'].includes(value)).map(([value, text]) => h('option', { value }, text))),
    h('select', { 'aria-label': 'Filtrar por género', onchange: (e) => { gender = e.target.value; paint(); } }, h('option', { value: '' }, 'Ambos géneros'), h('option', { value: '♂' }, '♂ Hombres'), h('option', { value: '♀' }, '♀ Mujeres')),
  );
  let editingName = false;
  function paintIdentity() {
    const nameInput = h('input', { type: 'text', maxlength: 24, value: me.name, 'aria-label': 'Nombre de entrenador', autocomplete: 'nickname' });
    const saveName = h('button', { class: 'btn sm primary', type: 'submit' }, 'Guardar');
    const nameLine = editingName
      ? h('form', { class: 'profile-name', onsubmit: async (e) => {
          e.preventDefault();
          const name = nameInput.value.trim();
          if (!name || name === me.name) {
            editingName = false;
            return paintIdentity();
          }
          saveName.disabled = true;
          try {
            me = { ...me, ...(await api('/api/me', { method: 'PUT', body: { name } })).me };
            editingName = false;
            renderWho();
            paintIdentity();
            toast('Nombre guardado');
          } catch (err) {
            toast(err.message);
            saveName.disabled = false;
          }
        } }, nameInput, saveName, h('button', { class: 'btn sm ghost', type: 'button', onclick: () => { editingName = false; paintIdentity(); } }, 'Cancelar'))
      : h('div', { class: 'profile-name-line' }, h('h1', null, me.name), h('button', { class: 'btn sm ghost icon-btn', type: 'button', 'data-tip': 'Cambiar nombre', 'aria-label': 'Cambiar nombre', onclick: () => { editingName = true; paintIdentity(); nameInput.focus(); } }, '✏️'));
    identity.replaceChildren(
      avatarPic(me.avatar, 'lg', me.frame),
      h('div', { class: 'profile-who' }, nameLine, h('div', { class: 'row profile-meta' }, skinTitle(me.avatar, 'span'), h('span', { class: 'chip' }, h('span', { class: 'w' }, `${me.wins}V`), ' · ', h('span', { class: 'l' }, `${me.losses}D`)))),
    );
    if (editingName) requestAnimationFrame(() => nameInput.focus());
  }
  const usable = (key) => key === me.avatar || progress.get(key)?.unlocked !== false;
  const goalState = (g) => (g.need === 1 ? (g.have >= 1 ? 'listo' : 'pendiente') : `${g.have.toLocaleString('es')}/${g.need.toLocaleString('es')}`);
  function unlockTip(key) {
    const p = progress.get(key);
    if (!p) return { tip: trainerLabel(key), note: null };
    if (p.group === 'starter') return { tip: `${trainerLabel(key)} · disponible desde el inicio`, note: null };
    if (p.unlocked) return { tip: `🔓 ${trainerLabel(key)} · ${p.title}`, note: `Lo desbloqueaste con: ${p.goals.map((g) => (g.need === 1 ? g.text : `${g.text} (${g.need.toLocaleString('es')})`)).join(' y ')}` };
    return { tip: `🔒 ${trainerLabel(key)} · ${p.title}`, note: `Te falta: ${p.goals.filter((g) => g.have < g.need).map((g) => `${g.text} ${goalState(g)}`).join(' · ')}` };
  }
  const goalList = (goals) => h('ul', { class: 'unlock-goals' }, goals.map((g) => h('li', { class: g.have >= g.need ? 'is-done' : null }, h('span', null, g.text, g.hint ? h('span', { class: 'goal-hint', tabindex: 0, 'data-tip': g.hint, 'aria-label': g.hint }, '?') : null), h('span', { class: 'unlock-bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': g.need, 'aria-valuenow': g.have }, h('i', { style: { width: `${(g.have / g.need) * 100}%` } })), h('small', { class: 'muted' }, g.need === 1 ? (g.have >= 1 ? 'Listo' : 'Pendiente') : `${g.have.toLocaleString('es')} / ${g.need.toLocaleString('es')}`))));
  const baseOf = (key) => VARIANTS_BY_KEY.get(key)?.base ?? key;
  const familyKeys = (base) => [base, ...TRAINER_VARIANTS.filter((variant) => variant.base === base).map((variant) => variant.key).sort(byLabel)];
  const versionName = (key) => {
    const variant = VARIANTS_BY_KEY.get(key);
    if (!variant) return 'Original';
    const base = trainerLabel(variant.base);
    return variant.name ? (variant.name.startsWith(`${base} `) ? variant.name.slice(base.length + 1) : variant.name) : VARIANT_COLOR_NAMES[variant.color] ?? variant.color;
  };
  let openBase = null;
  let focusKey = null;
  function versionState(item) {
    if (isEquipped(item)) return 'equipped';
    if (item.owned) return 'owned';
    if (item.locked || item.available === false) return 'locked';
    return 'buy';
  }
  const VERSION_STATUS = { equipped: '★ En uso', owned: '✓ Obtenido', locked: '🔒 Por desbloquear', buy: '🪙 En venta' };
  function versionAction(item, state) {
    if (state === 'equipped') return h('span', { class: 'chip ready-chip' }, 'En uso');
    if (state === 'owned') return h('button', { class: 'btn sm primary', type: 'button', onclick: (e) => { e.stopPropagation(); equip(item); } }, 'Equipar');
    if (state === 'locked') return item.key === focusKey ? h('small', { class: 'muted' }, 'Metas arriba ↑') : h('button', { class: 'btn sm ghost', type: 'button', onclick: (e) => { e.stopPropagation(); openFamily(baseOf(item.key), item.key); } }, 'Ver metas');
    if (state === 'buy' && item.key === focusKey) return action(item);
    return action(item);
  }
  function openFamily(base, focus = null) {
    const members = familyKeys(base).map(trainerItem);
    focus ??= members.find((item) => versionState(item) === 'locked')?.key ?? base;
    openBase = base;
    focusKey = focus;
    const focused = progress.get(focus);
    const ways = focused?.ways?.length ? focused.ways : focused?.goals?.length ? [focused.goals] : null;
    const p = progress.get(base);
    confirmDlg.replaceChildren(h('div', { class: 'confirm-body family' },
      h('button', { class: 'info-close', type: 'button', 'aria-label': 'Cerrar', onclick: () => confirmDlg.close() }, '×'),
      h('header', { class: 'family-head' }, h('h2', null, trainerLabel(base)), h('p', { class: 'muted small' }, [p?.rarity ? RARITIES[p.rarity].label : null, p?.title, members.length > 1 ? `${members.length - 1} ${members.length === 2 ? 'recolor' : 'recolores'}, después del original` : null].filter(Boolean).join(' · '))),
      ways ? h('div', { class: `family-goals${focused.unlocked ? ' is-done' : ''}` }, h('b', null, focused.unlocked ? `✓ Cómo conseguiste a ${trainerLabel(focus)}` : `🔒 Cómo conseguir a ${trainerLabel(focus)}`), ways.length > 1 ? h('div', { class: 'unlock-ways' }, ways.flatMap((goals, i) => [i ? h('p', { class: 'unlock-or' }, 'o bien') : null, h('div', { class: 'unlock-way' }, h('small', { class: 'muted' }, `Opción ${i + 1}`), goalList(goals))])) : goalList(ways[0])) : null,
      h('div', { class: 'family-grid' }, members.map((item) => {
        const state = versionState(item);
        const { tip, note } = unlockTip(item.key);
        const pickable = item.key !== focus && !!progress.get(item.key)?.goals?.length;
        return h('div', { class: `family-card state-${state}${item.key === focus ? ' is-focus' : ''}${pickable ? ' is-pickable' : ''}`, onclick: pickable ? () => openFamily(base, item.key) : null },
          h('div', { class: 'tile-stage', 'data-tip': tip, 'data-tip-note': note }, trainerImg(item.key)),
          h('b', null, versionName(item.key)),
          h('small', { class: `family-status state-${state}` }, VERSION_STATUS[state]),
          versionAction(item, state),
        );
      })),
    ));
    confirmDlg.addEventListener('close', () => { openBase = null; }, { once: true });
    if (!confirmDlg.open) confirmDlg.showModal();
  }
  function trainerItem(key) {
    const sold = shop.items.find((item) => item.kind === 'trainer' && item.key === key);
    if (sold) return sold;
    const p = progress.get(key);
    const open = usable(key);
    return { id: `trainer:${key}`, kind: 'trainer', key, name: trainerLabel(key), rarity: null, price: 0, desc: p?.title ?? 'Disponible desde el inicio', owned: open, free: true, locked: !open, tag: p?.title ?? 'Gratis', group: p?.group ?? 'starter' };
  }
  const confirmDlg = h('dialog', { class: 'info-dlg confirm-dlg', onclick: (e) => e.target === e.currentTarget && e.currentTarget.close() });
  const isEquipped = (item) => (item.kind === 'trainer' ? me.avatar === item.key : (shop.equipped[item.kind] ?? null) === item.key);
  const label = (item) => (item.kind === 'trainer' ? trainerLabel(item.key) : item.name);
  const refresh = (next) => {
    shop = next;
    me.shop = { balance: next.balance, earned: next.earned, spent: next.spent, owned: next.owned, equipped: next.equipped };
    me.frame = next.equipped.frame;
    me.avatar = next.avatar;
    renderWho();
    paintIdentity();
    paint(shownCount);
    if (openBase && confirmDlg.open) openFamily(openBase, focusKey);
  };
  async function equip(item) {
    try {
      if (item.kind === 'trainer') {
        me.avatar = (await api('/api/me/look', { method: 'PUT', body: { avatar: item.key } })).avatar;
        refresh({ ...shop, avatar: me.avatar });
      } else refresh((await api('/api/me/equip', { method: 'PUT', body: { kind: item.kind, key: item.free ? null : item.key } })).shop);
      toast(`Equipaste ${label(item)}`);
    } catch (e) {
      toast(e.message);
    }
  }
  function askBuy(item) {
    stopPreview?.();
    const go = h('button', { class: 'btn primary', type: 'button', onclick: async () => {
      go.disabled = true;
      try {
        refresh((await api('/api/shop/buy', { method: 'POST', body: { item: item.id } })).shop);
        music.ui('buy');
        confirmDlg.close();
        toast(`🛒 Compraste ${label(item)}`);
      } catch (e) {
        toast(e.message);
        go.disabled = false;
      }
    } }, 'Comprar');
    confirmDlg.replaceChildren(h('div', { class: 'confirm-body buy-confirm' },
      h('div', { class: `shop-confirm-preview kind-${item.kind}` }, shopPreview(item)),
      h('div', { class: 'buy-head' },
        item.rarity ? h('span', { class: `rarity-tag rarity-${item.rarity}` }, RARITIES[item.rarity].label) : null,
        h('h2', null, label(item)),
        h('p', null, item.desc),
      ),
      h('dl', { class: 'buy-summary' },
        h('div', null, h('dt', null, 'Precio'), h('dd', null, `🪙 ${tokensM(item.price)}`)),
        h('div', null, h('dt', null, 'Saldo después'), h('dd', null, tokensM(shop.balance - item.price))),
      ),
      h('div', { class: 'confirm-actions buy-actions' }, h('button', { class: 'btn', type: 'button', autofocus: true, onclick: () => confirmDlg.close() }, 'Cancelar'), go),
    ));
    if (!confirmDlg.open) confirmDlg.showModal();
  }
  let stopPreview = null;
  function previewBall(item) {
    const scene = sceneFor(`shop-${item.key}`);
    const spot = { me: h('div', { class: 'spot me' }), foe: h('div', { class: 'spot foe' }) };
    spot.me.innerHTML = creatureHTML({ sprite: '25' }, { back: true, eager: true });
    spot.foe.innerHTML = creatureHTML({ sprite: '133' }, { eager: true });
    const field = h('div', { class: 'battle-field' },
      h('img', { class: 'arena-bg', src: scene.image, alt: '', draggable: 'false' }),
      h('div', { class: 'battle-pad foe', 'aria-hidden': 'true' }),
      h('div', { class: 'battle-pad me', 'aria-hidden': 'true' }),
      spot.foe, spot.me,
    );
    const arena = h('div', { class: 'arena shop-arena' }, field);
    const stage = h('div', { class: 'shop-stage' }, arena);
    for (const side of ['me', 'foe']) {
      arena.style.setProperty(`--pad-${side}-fill`, scene[side][0]);
      arena.style.setProperty(`--pad-${side}-rim`, scene[side][1]);
    }
    const scale = () => arena.style.setProperty('--s', String(arena.clientWidth / 320));
    const fit = new ResizeObserver(scale);
    fit.observe(arena);
    const fx = createFx(arena, field);
    fx.warmBalls([item.key]);
    music.preloadCues(ballSounds(item.key));
    let running = false;
    let closed = false;
    const replay = h('button', { class: 'btn', type: 'button', onclick: () => run() }, '↻ Repetir');
    async function run() {
      if (running || closed) return;
      running = true;
      replay.disabled = true;
      for (const side of ['foe', 'me']) {
        if (closed) break;
        spot[side].classList.add('incoming');
        music.sfx('throw');
        await fx.sendOut(spot[side], side === 'me', () => {
          if (closed) return;
          music.sfx('switch');
          music.cues(ballSounds(item.key));
          spot[side].classList.remove('incoming');
        }, item.key ?? 'pb');
        await sleep(450);
      }
      running = false;
      replay.disabled = false;
    }
    confirmDlg.replaceChildren(h('div', { class: 'confirm-body ball-preview' },
      h('button', { class: 'info-close', type: 'button', 'aria-label': 'Cerrar', onclick: () => confirmDlg.close() }, '×'),
      h('header', { class: 'ball-preview-head' },
        h('span', { class: 'ball-preview-icon' }, h('img', { src: `/anims/ui/${item.key ?? 'pb'}.png?v=dev`, alt: '', draggable: 'false' })),
        h('div', null, h('h2', null, label(item)), h('span', { class: `chip rarity-chip${item.rarity ? ` rarity-${item.rarity}` : ''}` }, item.rarity ? RARITIES[item.rarity].label : 'Gratis')),
      ),
      stage,
      h('p', { class: 'ball-preview-note' }, `✨ ${BALL_FX_NOTE[item.rarity ?? 'free']}`),
      h('div', { class: 'row confirm-actions' }, replay, action(item)),
    ));
    const stop = () => {
      closed = true;
      fit.disconnect();
      music.stopCues();
    };
    stopPreview?.();
    stopPreview = stop;
    confirmDlg.addEventListener('close', stop, { once: true });
    if (!confirmDlg.open) confirmDlg.showModal();
    scale();
    requestAnimationFrame(() => requestAnimationFrame(() => run()));
  }
  function action(item) {
    if (item.locked) return h('button', { class: 'btn sm ghost', type: 'button', onclick: () => openFamily(baseOf(item.key), item.key) }, '🔒 ¿Cómo?');
    if (!item.owned && item.available === false) return h('span', { class: 'muted small shop-locked', 'data-tip': `Desbloquea a ${trainerLabel(item.requires)} para poder comprarla` }, `🔒 Primero ${trainerLabel(item.requires)} · 🪙 ${tokensM(item.price)}`);
    if (!item.owned) {
      const short = item.price - shop.balance;
      return h('button', { class: 'btn sm primary', type: 'button', disabled: short > 0 || null, 'data-tip': short > 0 ? `Te faltan ${tokensM(short)}` : null, onclick: () => askBuy(item) }, `🪙 ${tokensM(item.price)}`);
    }
    if (isEquipped(item)) {
      return h('span', { class: 'chip ready-chip' }, '✓ Equipado');
    }
    return h('button', { class: 'btn sm', type: 'button', onclick: () => equip(item) }, 'Equipar');
  }
  const RARITY_ORDER = Object.keys(RARITIES);
  const rankOf = (item) => {
    const rank = RARITY_ORDER.indexOf(rarityOf(item));
    return rank === -1 ? 0 : rank;
  };
  const byRarityThenName = (a, b) => rankOf(a) - rankOf(b) || label(a).localeCompare(label(b), 'es', { numeric: true, sensitivity: 'base' });
  function itemsFor() {
    if (kind !== 'trainer') return [...FREE_ITEMS, ...shop.items].filter((item) => item.kind === kind).sort(byRarityThenName);
    return TRAINER_SPRITES.filter((key) => !VARIANTS_BY_KEY.has(key))
      .filter((base) => (!group || familyKeys(base).some((key) => progress.get(key)?.group === group)) && (!gender || trainerLabel(base).includes(gender)))
      .map((base) => {
        const members = familyKeys(base).map(trainerItem);
        return { kind: 'trainer', key: base, members, owned: !!members[0].owned };
      })
      .sort(byRarityThenName);
  }
  function trainerTile(family) {
    const [original] = family.members;
    const shown = family.members.find(isEquipped) ?? original;
    const state = versionState(shown);
    const owned = family.members.filter((item) => item.owned).length;
    const p = progress.get(family.key);
    const sub = state === 'equipped' ? 'En uso' : p?.rarity ? RARITIES[p.rarity].label : 'Común';
    const { tip, note } = unlockTip(shown.key);
    return h('button', { type: 'button', class: `trainer-tile state-${state}${p?.rarity ? ` rarity-${p.rarity}` : ''}`, 'data-tip': tip, 'data-tip-note': note, 'aria-label': `${trainerLabel(family.key)}: ${VERSION_STATUS[state]}`, onclick: () => openFamily(family.key) },
      h('span', { class: `tile-corner state-${state}`, 'aria-hidden': 'true' }, CORNER[state]),
      h('span', { class: 'tile-stage' }, trainerImg(shown.key)),
      h('b', { class: 'tile-name' }, trainerLabel(family.key)),
      h('small', { class: 'tile-sub' }, sub),
      family.members.length > 1 ? h('small', { class: `tile-colors${owned === family.members.length ? ' is-complete' : ''}` }, `🎨 ${owned}/${family.members.length}`) : h('small', { class: 'tile-colors is-empty' }, ' '),
    );
  }
  const CORNER = { equipped: '★', owned: '✓', locked: '🔒', buy: '🪙' };
  const rarityOf = (item) => (item.kind === 'trainer' && !item.price ? progress.get(item.key)?.rarity ?? 'common' : item.rarity ?? 'free');
  const raritySelect = h('select', { class: 'rarity-select', 'aria-label': 'Filtrar por rareza', onchange: (e) => { rarity = e.target.value; paint(); } }, h('option', { value: '' }, 'Todas las rarezas'), Object.entries(RARITIES).map(([value, { label: text }]) => h('option', { value }, text)));
  function card(item) {
    const state = versionState(item);
    const tag = RARITIES[rarityOf(item)]?.label ?? 'Gratis';
    const cornerTip = { equipped: 'En uso', owned: 'Obtenido', locked: 'Bloqueado', buy: 'En venta' }[state];
    return h('div', { class: `shop-card state-${state}${isEquipped(item) ? ' is-equipped' : ''}${item.rarity ? ` rarity-${item.rarity}` : ''}` },
      h('div', { class: 'shop-preview' }, shopPreview(item), h('span', { class: `tile-corner state-${state}`, 'data-tip': cornerTip, 'aria-label': cornerTip }, CORNER[state])),
      h('div', { class: 'shop-info' }, h('b', { 'data-tip': item.desc }, label(item)), h('span', { class: `rarity-tag rarity-${rarityOf(item)}` }, tag)),
      h('div', { class: 'shop-action' }, item.kind === 'ball' ? h('button', { class: 'btn sm ghost shop-try', type: 'button', 'data-tip': 'Ver en combate', 'aria-label': `Ver ${label(item)} en combate`, onclick: () => previewBall(item) }, '▶ Probar') : null, action(item)),
    );
  }
  let shownCount = 0;
  const PAGE = 72;
  const more = h('button', { class: 'btn ghost shop-more', type: 'button', hidden: true, onclick: () => paint(shownCount + PAGE) }, 'Ver más');
  const OWNERSHIP = [['', 'Todo'], ['mine', 'Obtenidos'], ['missing', 'No obtenidos']];
  const ownCounts = OWNERSHIP.map(() => h('small', { class: 'pill-count' }));
  const ownPills = h('div', { class: 'pill-group', role: 'group', 'aria-label': 'Mostrar' }, OWNERSHIP.map(([value, text], i) => h('button', { type: 'button', class: 'pill', 'aria-pressed': String(value === ownership), onclick: (e) => {
    ownership = value;
    e.currentTarget.parentElement.querySelectorAll('.pill').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget)));
    paint();
  } }, text, ownCounts[i])));
  function paint(limit = PAGE) {
    const ledger = `${tokensM(shop.total)} de tu save${shop.updatedAt ? ` (subido ${ago(shop.updatedAt)})` : ''} + ${tokensM(shop.recycled ?? 0)} reciclados − ${tokensM(shop.spent)} gastados`;
    balance.replaceChildren(
      h('span', { class: 'shop-coins', tabindex: 0, 'data-tip': ledger, 'data-tip-note': 'Crece cuando subes tu save o reciclas repetidos.' }, `🪙 ${tokensM(shop.balance)}`),
      h('a', { class: 'btn sm ghost', href: '/reciclaje', 'data-link': true, 'data-tip': 'Tritura tus Pokémon repetidos para ganar tokens' }, '♻️ Reciclar'),
    );
    trainerFilters.hidden = kind !== 'trainer';
    const matchesText = (item) => !query || (item.members ?? [item]).some((member) => label(member).toLowerCase().includes(query));
    const matchesRarity = (item) => !rarity || rarityOf(item) === rarity;
    const matching = itemsFor().filter((item) => matchesText(item) && matchesRarity(item));
    const mine = matching.filter((item) => item.owned).length;
    [matching.length, mine, matching.length - mine].forEach((n, i) => (ownCounts[i].textContent = String(n)));
    const all = matching.filter((item) => !ownership || (ownership === 'mine') === !!item.owned);
    const list = kind === 'trainer' ? all.slice(0, limit) : all;
    shownCount = list.length;
    more.hidden = list.length >= all.length;
    more.textContent = `Ver más (${all.length - list.length})`;
    grid.className = kind === 'trainer' ? 'trainer-tiles' : 'shop-grid';
    grid.replaceChildren(...(list.length ? list.map(kind === 'trainer' ? trainerTile : card) : [h('p', { class: 'muted' }, 'No hay nada con ese filtro.')]));
  }
  paintIdentity();
  paint();
  loadAchievements().then((sprites) => {
    if (stale(seq) || !sprites) return;
    progress = new Map(sprites.map((p) => [p.key, p]));
    if (kind === 'trainer') paint(shownCount);
  });
  $app.replaceChildren(
    h('section', { class: 'card shop-head' }, identity, balance),
    h('section', { class: 'card' },
      h('div', { class: 'segmented shop-tabs', role: 'group', 'aria-label': 'Categoría' }, Object.entries(SHOP_KINDS).map(([value, text]) => h('button', { type: 'button', class: 'seg-item', 'aria-pressed': String(value === kind), onclick: (e) => { kind = value; e.currentTarget.parentElement.querySelectorAll('.seg-item').forEach((b) => b.setAttribute('aria-pressed', String(b === e.currentTarget))); paint(); } }, text))),
      h('div', { class: 'shop-toolbar' },
        h('label', { class: 'search-field' }, h('span', { 'aria-hidden': 'true' }, '🔍'), h('input', { type: 'search', placeholder: 'Buscar por nombre', 'aria-label': 'Buscar por nombre', oninput: (e) => { query = e.target.value.trim().toLowerCase(); paint(); } })),
        ownPills,
        raritySelect,
        trainerFilters,
      ),
      grid,
      more,
    ),
    confirmDlg,
  );
}

// ---------- recycling ----------
const RECYCLE_RARITY = { common: 'Común', uncommon: 'Poco común', rare: 'Raro', legendary: 'Legendario' };
const SHRED_SOUNDS = [
  { sound: 'prsfx-shift-gear.wav', at: 0, gain: 0.6 },
  { sound: 'prsfx-drill-run.wav', at: 120, gain: 0.55 },
  { sound: 'prsfx-gear-grind.wav', at: 200, gain: 0.7 },
  { sound: 'prsfx-crunch.wav', at: 420, gain: 0.65 },
  { sound: 'prsfx-pay-day1.wav', at: 950, gain: 0.7 },
];
const SHRED_CRY_MS = 380;
const SHRED_STRIPS = 9;

async function rescanSave() {
  const stored = await storedSave();
  if (!stored?.text) return;
  const mark = `${me.id}:${stored.savedAt}`;
  if (ls.get('tc_rescanned') === mark) return;
  try {
    me = (await api('/api/import', { method: 'POST', body: { save: stored.text } })).me;
    renderWho();
  } catch {
    return;
  }
  ls.set('tc_rescanned', mark);
}

async function recyclingPage(seq) {
  document.title = 'Reciclaje · Token Clash';
  await loadMe();
  if (stale(seq)) return;
  renderWho();
  if (!me) return renderLanding();
  $app.replaceChildren(h('p', { class: 'muted center pad' }, 'Buscando repetidos en tu save…'));
  let data;
  try {
    await rescanSave();
    data = (await api('/api/me/recycling')).recycling;
  } catch (e) {
    if (stale(seq)) return;
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'No pude abrir el reciclaje'), h('p', { class: 'muted' }, e.message)));
    return;
  }
  if (stale(seq)) return;
  music.preloadCues(SHRED_SOUNDS);
  music.preload({ sprites: data.duplicates.map((mon) => mon.sprite) });
  let busy = false;
  let shownBalance = data.balance;
  const coins = h('span', { class: 'shop-coins', tabindex: 0, 'data-tip': 'Tu saldo para comprar en tu perfil' }, `🪙 ${tokensM(shownBalance)}`);
  const pile = h('div', { class: 'duplicate-grid' });
  const history = h('div', { class: 'recycle-log' });
  const mouth = h('div', { class: 'shred-mouth' }, h('span', { class: 'shred-hint' }, 'Arrastra aquí'));
  const output = h('div', { class: 'shred-output' });
  const tray = h('div', { class: 'shred-tray' });
  const gain = h('div', { class: 'shred-gain', 'aria-live': 'polite' });
  const machine = h('div', { class: 'shredder', role: 'region', 'aria-label': 'Trituradora' },
    mouth,
    h('div', { class: 'shred-body' }, h('span', { class: 'shred-teeth' }), h('span', { class: 'shred-light' }), h('b', null, 'TRITURADORA'), h('small', null, 'Pokémon repetidos → tokens')),
    output,
    tray,
    gain,
  );

  function countTo(target) {
    const from = shownBalance;
    const start = performance.now();
    const step = (now) => {
      const k = Math.min(1, (now - start) / 900);
      shownBalance = Math.round(from + (target - from) * (1 - (1 - k) ** 3));
      coins.textContent = `🪙 ${tokensM(shownBalance)}`;
      if (k < 1) requestAnimationFrame(step);
    };
    coins.classList.add('is-bumping');
    setTimeout(() => coins.classList.remove('is-bumping'), 900);
    requestAnimationFrame(step);
  }

  function paintPile() {
    pile.replaceChildren(...(data.duplicates.length
      ? data.duplicates.map((mon) => h('div', {
          class: `duplicate-card rarity-${mon.rarity}${mon.shiny ? ' is-shiny' : ''}`,
          tabindex: 0,
          role: 'button',
          'aria-label': `${mon.name}${mon.shiny ? ' shiny' : ''}, ${RECYCLE_RARITY[mon.rarity]}, ${tokensM(mon.tokens)}. Arrástralo a la trituradora o presiona Enter.`,
          'data-tip': `${mon.name}${mon.shiny ? ' ✨' : ''} · Nv ${mon.level}`,
          'data-tip-note': 'Arrástralo a la trituradora',
          onpointerdown: (e) => startDrag(e, mon),
          onkeydown: (e) => e.key === 'Enter' && shred(mon, e.currentTarget),
        }, h('div', { html: creatureHTML({ sprite: mon.sprite, shiny: mon.shiny }) }), h('b', null, mon.name), h('span', { class: `rarity-tag recycle-${mon.rarity}` }, RECYCLE_RARITY[mon.rarity]), h('span', { class: 'duplicate-reward' }, `+${tokensM(mon.tokens)}`)))
      : [h('p', { class: 'muted recycle-empty' }, 'No tienes repetidos por triturar. Los repetidos son copias de la misma especie y variante que ya tienes en tu colección; aparecen al subir tu save. ', h('a', { href: '/coleccion', 'data-link': true }, 'Subir save en Colección →'))]));
  }

  function paintHistory() {
    history.replaceChildren(...(data.history.length
      ? data.history.slice(0, 50).map((row) => h('div', { class: 'recycle-row' }, h('div', { class: 'recycle-row-sprite', html: creatureHTML({ sprite: row.sprite, shiny: row.shiny }) }), h('span', null, h('b', null, row.name), row.shiny ? ' ✨' : '', h('small', { class: 'muted' }, ` · ${RECYCLE_RARITY[row.rarity]} · ${ago(row.at)}`)), h('b', { class: 'recycle-row-tokens' }, `+${tokensM(row.tokens)}`)))
      : [h('p', { class: 'muted' }, 'Todavía no trituras nada.')]));
  }

  function startDrag(e, mon) {
    if (busy || e.button !== 0) return;
    const source = e.currentTarget;
    const rect = source.getBoundingClientRect();
    const offset = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    let ghost = null;
    const begin = { x: e.clientX, y: e.clientY };
    const over = (x, y) => {
      const r = mouth.getBoundingClientRect();
      return x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 40 && y <= r.bottom + 30;
    };
    const move = (ev) => {
      if (!ghost) {
        if (Math.hypot(ev.clientX - begin.x, ev.clientY - begin.y) < 6) return;
        ghost = source.cloneNode(true);
        ghost.classList.add('drag-ghost');
        Object.assign(ghost.style, { width: `${rect.width}px`, height: `${rect.height}px` });
        document.body.append(ghost);
        source.classList.add('is-dragging');
        machine.classList.add('is-waiting');
      }
      ghost.style.transform = `translate(${ev.clientX - offset.x}px, ${ev.clientY - offset.y}px) rotate(${Math.max(-8, Math.min(8, (ev.movementX ?? 0) * 0.6))}deg)`;
      machine.classList.toggle('is-hot', over(ev.clientX, ev.clientY));
    };
    const end = (ev) => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', end);
      removeEventListener('pointercancel', end);
      machine.classList.remove('is-waiting', 'is-hot');
      if (!ghost) return;
      const drop = ev.type === 'pointerup' && over(ev.clientX, ev.clientY);
      if (drop) {
        ghost.remove();
        shred(mon, source);
        return;
      }
      const back = source.getBoundingClientRect();
      ghost.animate([{ transform: ghost.style.transform }, { transform: `translate(${back.left}px, ${back.top}px)` }], { duration: 220, easing: 'ease-out' }).finished.finally(() => {
        ghost.remove();
        source.classList.remove('is-dragging');
      });
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', end);
    addEventListener('pointercancel', end);
  }

  async function shred(mon, source) {
    if (busy) return;
    busy = true;
    source.classList.add('is-dragging');
    const request = api('/api/me/recycling', { method: 'POST', body: { entry: mon.id } });
    const spriteUrl = spriteURL({ sprite: mon.sprite, shiny: mon.shiny });
    const feed = h('img', { class: 'shred-feed', src: spriteUrl, alt: '', draggable: 'false' });
    mouth.append(feed);
    machine.classList.add('is-running');
    music.cues(SHRED_SOUNDS, { maxMs: 1900 });
    setTimeout(() => music.sfx('cry', { sprite: mon.sprite, faint: true }), SHRED_CRY_MS);
    const sink = feed.animate([{ transform: 'translate(-50%, -8%) scale(1.05)' }, { transform: 'translate(-50%, 4%) rotate(-3deg)', offset: 0.2 }, { transform: 'translate(-50%, 130%) rotate(2deg)' }], { duration: 900, easing: 'cubic-bezier(.5, 0, .7, 1)', fill: 'forwards' }).finished;
    const strips = Array.from({ length: SHRED_STRIPS }, (_, i) => {
      const strip = h('span', { class: 'shred-strip' });
      Object.assign(strip.style, { left: `${(i / SHRED_STRIPS) * 100}%`, width: `${100 / SHRED_STRIPS}%`, backgroundImage: `url("${spriteUrl}")`, backgroundSize: `${SHRED_STRIPS * 100}% 100%`, backgroundPosition: `${(i / (SHRED_STRIPS - 1)) * 100}% 0` });
      output.append(strip);
      // A CSS background never retries, so each strip follows the host the feed image loaded from.
      feed.addEventListener('load', () => (strip.style.backgroundImage = `url("${feed.currentSrc}")`));
      const sway = (i - (SHRED_STRIPS - 1) / 2) * 11 + (Math.random() - 0.5) * 24;
      const spin = (Math.random() - 0.5) * 70;
      return strip.animate([
        { transform: 'translateY(-105%) rotate(0deg)', opacity: 1 },
        { transform: `translate(${sway * 0.35}px, 15%) rotate(${spin * 0.3}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(${sway}px, 120%) rotate(${spin}deg)`, opacity: 1, offset: 0.75 },
        { transform: `translate(${sway * 1.2}px, 165%) rotate(${spin * 1.2}deg)`, opacity: 0 },
      ], { duration: 1400, delay: 300 + Math.random() * 260, easing: 'ease-in', fill: 'both' }).finished.then(() => strip.remove());
    });
    let result;
    try {
      [result] = await Promise.all([request, sink]);
    } catch (e) {
      toast(e.message);
      feed.remove();
      machine.classList.remove('is-running');
      source.classList.remove('is-dragging');
      busy = false;
      return;
    }
    feed.remove();
    dropCoins(result.tokens);
    await Promise.all(strips);
    machine.classList.remove('is-running');
    data = result.recycling;
    if (me.shop) me.shop.balance = data.balance;
    countTo(data.balance);
    paintPile();
    paintHistory();
    busy = false;
  }

  function dropCoins(tokens) {
    const count = Math.min(14, 3 + Math.round(Math.log2(tokens / 20_000_000 + 1) * 3));
    gain.textContent = `+${tokensM(tokens)}`;
    gain.animate([{ transform: 'translate(-50%, 0) scale(.6)', opacity: 0 }, { transform: 'translate(-50%, -18px) scale(1.15)', opacity: 1, offset: 0.25 }, { transform: 'translate(-50%, -40px) scale(1)', opacity: 0 }], { duration: 1500, easing: 'ease-out' });
    for (let i = 0; i < count; i++) {
      const coin = h('span', { class: 'shred-coin', 'aria-hidden': 'true' });
      tray.append(coin);
      const x = (Math.random() - 0.5) * 120;
      coin.animate([
        { transform: 'translate(0, -70px) scale(.5) rotate(0deg)', opacity: 0 },
        { transform: `translate(${x * 0.5}px, -40px) scale(1) rotate(180deg)`, opacity: 1, offset: 0.3 },
        { transform: `translate(${x}px, 0) scale(1) rotate(360deg)`, opacity: 1, offset: 0.75 },
        { transform: `translate(${x}px, 0) scale(.9) rotate(360deg)`, opacity: 0 },
      ], { duration: 1200, delay: 450 + i * 60, easing: 'cubic-bezier(.3, .7, .4, 1)', fill: 'both' }).finished.then(() => coin.remove());
    }
  }

  paintPile();
  paintHistory();
  $app.replaceChildren(
    h('section', { class: 'card shop-head' }, h('div', { class: 'profile-who' }, h('h1', null, '♻️ Reciclaje'), h('p', { class: 'muted small recycle-lead' }, 'Tritura tus Pokémon repetidos para ganar tokens. Mientras más raro, más tokens; un shiny vale el triple.')), h('div', { class: 'shop-balance' }, coins, h('a', { class: 'btn sm ghost', href: '/perfil', 'data-link': true }, '🧢 Ir al perfil'))),
    h('section', { class: 'card recycle-stage' },
      h('div', { class: 'recycle-pile' }, h('h2', null, `Tus repetidos`), pile),
      h('div', { class: 'recycle-machine' }, machine),
    ),
    h('section', { class: 'card recycle-history' }, h('h2', null, 'Registro'), history),
  );
}

// ---------- home ----------
async function homePage(seq) {
  document.title = 'Token Clash';
  await loadMe();
  if (stale(seq)) return;
  renderWho();
  if (!me) return renderLanding();
  renderHome();
  loadAchievements();
}

function demoMon(i) {
  return { sprite: ['4', '7', '1'][i], rarity: 'rare' };
}

function feedbackButton() {
  const dialog = h(
    'dialog',
    { class: 'feedback-dialog', 'aria-label': '¿Encontraste un bug o quieres proponer una mejora?' },
    h('img', { src: '/hazlo-tu.png', alt: 'Hazlo tú HDTPM, que aquí nadie es tu empleado', width: 498, height: 491 }),
    h('button', { class: 'btn sm', onclick: () => dialog.close() }, 'Ok 😔'),
  );
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  const btn = h('button', { class: 'feedback-btn', onclick: () => dialog.showModal() }, h('span', { class: 'feedback-icon', 'aria-hidden': 'true' }, '?'), '¿Encontraste un bug o quieres proponer una mejora?');
  return h('section', { class: 'feedback' }, btn, dialog);
}

function renderLanding() {
  $app.replaceChildren(
    h(
      'div',
      { class: 'hero' },
      h(
        'div',
        null,
        h('h1', null, 'Tus tokens criaron Pokémon. Ahora a pelear.'),
        h('p', { class: 'lead' }, 'Sube el save de PokeTokenBar, arma tu equipo y desafía a otro jugador con un link, o pelea contra la IA. Cada especie pelea con su tipo real, sus golpes y stats según el nivel que le diste a punta de tokens.'),
        h('div', { class: 'hero-mons' }, [0, 1, 2].map((i) => h('div', { html: creatureHTML(demoMon(i)) }))),
      ),
      importCard({ onDone: renderHome }),
    ),
  );
}

function renderHome() {
  const byId = new Map(me.roster.map((f) => [f.uid, f]));
  const team = me.team.map((id) => byId.get(id)).filter(Boolean);
  let mode = 'team';
  let rival = 'friend';
  let visibility = 'public';
  let size = 8;
  let aiLevel = 'mid';

  async function createChallenge(btn) {
    btn.disabled = true;
    try {
      if (rival === 'tournament') {
        const { tournament, joined } = await api('/api/tournaments', { method: 'POST', body: { mode, size, visibility } });
        if (joined) toast('Te uniste a un torneo abierto');
        return nav(`/t/${tournament.id}`);
      }
      const { challenge, joined } = await api('/api/challenges', { method: 'POST', body: { mode, ...(rival === 'ai' ? { ai: aiLevel } : { visibility }) } });
      if (joined) toast(`Te uniste a la sala de ${challenge.host.name}`);
      nav(`/b/${challenge.id}`);
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
    }
  }

  function choice(kind, options, current, onPick) {
    const items = options.map((o) =>
      h(
        'button',
        { type: 'button', class: `${kind}-item`, 'aria-pressed': String(o.value === current), onclick: () => { items.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i].value === o.value))); onPick(o.value); } },
        o.icon ? h('span', { class: `${kind}-icon`, 'aria-hidden': 'true' }, o.icon) : null,
        o.desc ? h('span', { class: `${kind}-text` }, h('b', null, o.label), h('small', null, o.desc)) : o.label,
      ),
    );
    return items;
  }
  const field = (label, control, ...rest) => h('div', { class: 'nb-field' }, h('span', { class: 'nb-label' }, label), control, ...rest);

  const aiNote = h('p', { class: 'nb-note' });
  const startBtn = h('button', { class: 'btn primary nb-start', onclick: (e) => createChallenge(e.currentTarget) });
  const aiField = field('Dificultad', h('div', { class: 'segmented', role: 'group', 'aria-label': 'Dificultad de la IA' }, choice('seg', AI_ORDER.filter((k) => (me.aiLevels ?? AI_ORDER).includes(k)).map((k) => ({ value: k, label: AI_LABEL[k] })), aiLevel, (v) => { aiLevel = v; paint(); })), aiNote);
  const roomNote = h('p', { class: 'nb-note' });
  const roomField = field('Sala', h('div', { class: 'segmented', role: 'group', 'aria-label': 'Tipo de sala' }, choice('seg', [{ value: 'public', label: '🌐 Pública' }, { value: 'private', label: '🔒 Privada' }], visibility, (v) => { visibility = v; paint(); })), roomNote);
  const sizeField = field('Jugadores', h('div', { class: 'segmented', role: 'group', 'aria-label': 'Jugadores del torneo' }, choice('seg', TOURNAMENT_SIZES.map((n) => ({ value: n, label: String(n) })), size, (v) => { size = v; paint(); })), h('p', { class: 'nb-note' }, 'Llaves de eliminación directa. El dueño puede rellenar los asientos libres con IAs.'));
  function paint() {
    const tour = rival === 'tournament';
    aiField.classList.toggle('is-hidden', rival !== 'ai');
    roomField.classList.toggle('is-hidden', rival === 'ai');
    sizeField.classList.toggle('is-hidden', !tour);
    aiNote.textContent = AI_NOTES[aiLevel][mode];
    roomNote.textContent = visibility === 'public'
      ? tour ? 'Si ya hay un torneo abierto con este modo y tamaño, entras a ese. Si no, abrimos el tuyo y aparece en Salas abiertas.' : 'Si ya hay una sala abierta con este modo, entras a esa. Si no, abrimos la tuya y aparece en Salas abiertas.'
      : 'No aparece en Salas abiertas: solo entra quien tenga el link que te damos.';
    startBtn.textContent = rival === 'ai' ? `🤖 Pelear contra la IA · ${AI_LABEL[aiLevel]}` : tour ? (visibility === 'public' ? `🏆 Buscar torneo de ${size}` : `🔒 Crear torneo privado de ${size}`) : visibility === 'public' ? '⚔︎ Buscar rival' : '🔒 Crear sala privada';
  }
  const battleForm = h(
    'div',
    { class: 'nb-form' },
    field('Modo', h('div', { class: 'cards2', role: 'group', 'aria-label': 'Modo de juego' }, choice('pick', [
      { value: 'team', icon: MODE_ICON.team, label: MODE_LABEL.team, desc: `Los ${PARTY_SIZE} que armaste.` },
      { value: 'random', icon: MODE_ICON.random, label: MODE_LABEL.random, desc: `Los dados sortean ${PARTY_SIZE} de tu colección, con movimientos y habilidad al azar.` },
    ], mode, (v) => { mode = v; paint(); }))),
    field('Rival', h('div', { class: 'cards3', role: 'group', 'aria-label': 'Rival' }, choice('pick', [
      { value: 'friend', icon: '👥', label: 'Contra otro jugador', desc: 'Entras a una sala abierta o abres una nueva.' },
      { value: 'ai', icon: '🤖', label: 'La IA', desc: 'Peleas ahora mismo, con Pokémon de la 1.ª a la 5.ª generación.' },
      { value: 'tournament', icon: '🏆', label: 'Torneo', desc: 'De 4, 8 o 16 jugadores, con IAs para rellenar.' },
    ], rival, (v) => { rival = v; paint(); }))),
    sizeField,
    roomField,
    aiField,
    startBtn,
  );
  paint();

  $app.replaceChildren(
    h(
      'section',
      null,
      h('div', { class: 'row between' }, h('h1', null, `Hola, ${me.name}`), h('div', { class: 'row' }, h('span', { class: 'chip' }, `📚 ${me.rosterSize} Pokémon`), h('span', { class: 'chip' }, `✨ ${me.shinies} shiny`), h('span', { class: 'chip', tabindex: 0, 'data-tip': 'Tokens totales según PokeTokenBar' }, `🪙 ${compact(me.totalTokens)} tokens`))),
    ),
    h(
      'section',
      null,
      h('div', { class: 'team-head' }, h('h2', null, 'Tu equipo ', h('span', { class: 'party-count' }, `${team.length}/${PARTY_SIZE}`)), h('a', { class: 'btn sm primary', href: '/coleccion', 'data-link': true }, '✎ Editar en Colección')),
      h('div', { class: 'party-board' }, partyRow(team), h('p', { class: 'hint' }, `En cada pelea eliges ${BATTLE_SIZE} de estos ${PARTY_SIZE}. Toca uno para editar sus movimientos y su habilidad en Colección.`)),
    ),
    h(
      'section',
      null,
      h(
        'div',
        { class: 'card' },
        h('div', { class: 'nb-head' }, h('h2', null, 'Nueva batalla'), h('p', { class: 'muted small' }, `Cada uno ve los ${PARTY_SIZE} del otro y elige ${BATTLE_SIZE} · turnos de 60 s`)),
        battleForm,
      ),
    ),
    ...openRoomsCard().map((card) => h('section', null, card)),
  );
}

const wsURL = () => `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`;
let roomsFeed = null;
function closeRoomsFeed() {
  roomsFeed?.();
  roomsFeed = null;
}

function openRoomsCard() {
  closeRoomsFeed();
  const list = h('div', { class: 'list' }, h('p', { class: 'muted' }, 'Buscando salas…'));
  const count = h('span', { class: 'chip', hidden: true });
  const live = h('span', { class: 'live-dot', 'data-tip': 'Se actualiza solo' });
  const card = h('div', { class: 'card rooms-card' }, h('div', { class: 'nb-head' }, h('h2', null, 'Salas abiertas ', count), h('p', { class: 'muted small' }, live, 'Jugadores esperando rival ahora mismo')), list);
  const liveList = h('div', { class: 'list' }, h('p', { class: 'muted' }, 'Buscando peleas…'));
  const liveCount = h('span', { class: 'chip', hidden: true });
  const liveCard = h('div', { class: 'card rooms-card' }, h('div', { class: 'nb-head' }, h('h2', null, 'Juegos en vivo ', liveCount), h('p', { class: 'muted small' }, 'Peleas que se están jugando ahora: entra a mirar')), liveList);
  let battles = [];
  const rows = new Map();
  let first = true;
  let rooms = [];
  let ws = null;
  let retry = 0;
  let closed = false;
  async function join(r, btn) {
    btn.disabled = true;
    btn.textContent = 'Entrando…';
    try {
      if (r.kind === 'tournament') {
        await api(`/api/tournaments/${r.id}/join`, { method: 'POST' });
        return nav(`/t/${r.id}`);
      }
      await api(`/api/challenges/${r.id}/accept`, { method: 'POST' });
      nav(`/b/${r.id}`);
    } catch (e) {
      toast(e.message);
      rows.get(key(r))?.classList.add('room-gone');
      btn.textContent = 'No disponible';
    }
  }
  const meta = (r) => `${r.kind === 'tournament' ? `🏆 Torneo de ${r.size} · ${r.filled}/${r.size} · ` : ''}${MODE_ICON[r.mode] ?? MODE_ICON.team} ${MODE_LABEL[r.mode] ?? MODE_LABEL.team} · ${ago(r.createdAt)}`;
  const key = (r) => `${r.kind}:${r.id}:${r.filled ?? ''}:${r.mine}`;
  function row(r) {
    const tour = r.kind === 'tournament';
    const href = tour ? `/t/${r.id}` : `/b/${r.id}`;
    const title = tour ? (r.mine ? 'Tu torneo' : `Torneo de ${r.host.name}`) : r.mine ? 'Tu sala' : r.host.name;
    return h(
      'div',
      { class: `item room${tour ? ' is-tour' : ''}${r.mine ? ' is-me' : ''}${first ? '' : ' room-new'}` },
      h('span', { class: 'room-who' }, h('b', null, r.host.avatar ? avatarPic(r.host.avatar, 'md', r.host.frame) : null, ' ', title), r.mine ? null : [' ', record(r.host)], h('span', { class: 'muted small room-meta' }, meta(r))),
      r.mine ? h('a', { class: 'btn sm', href, 'data-link': true }, 'Ver') : h('button', { class: 'btn sm primary', onclick: (e) => join(r, e.currentTarget) }, 'Entrar'),
    );
  }
  function paint(next) {
    rooms = next;
    count.hidden = !rooms.length;
    count.textContent = String(rooms.length);
    const keep = new Set(rooms.map(key));
    for (const k of rows.keys()) if (!keep.has(k)) rows.delete(k);
    for (const r of rooms) if (!rows.has(key(r))) rows.set(key(r), row(r));
    list.replaceChildren(...(rooms.length ? rooms.map((r) => rows.get(key(r))) : [h('p', { class: 'muted' }, 'No hay salas abiertas. Busca rival y la tuya aparecerá aquí para los demás.')]));
    first = false;
  }
  const liveMeta = (b) => `${b.tournament ? `🏆 Torneo de ${b.tournament.size} · ` : ''}${MODE_ICON[b.mode] ?? MODE_ICON.team} ${MODE_LABEL[b.mode] ?? MODE_LABEL.team} · ${b.sides.some((s) => s.ai) ? '🤖 Contra la IA · ' : ''}empezó ${ago(b.startedAt)}`;
  function liveRow(b) {
    return h(
      'div',
      { class: 'item room' },
      h('span', { class: 'room-who' }, h('b', null, avatarPic(b.sides[0].avatar, 'md', b.sides[0].frame), ` ${trainerShort(b.sides[0].name)} vs ${trainerShort(b.sides[1].name)} `, avatarPic(b.sides[1].avatar, 'md', b.sides[1].frame)), h('span', { class: 'muted small room-meta' }, liveMeta(b))),
      h('a', { class: 'btn sm', href: `/b/${b.id}`, 'data-link': true }, '👁 Mirar'),
    );
  }
  function paintLive(next) {
    battles = next;
    liveCount.hidden = !battles.length;
    liveCount.textContent = String(battles.length);
    liveList.replaceChildren(...(battles.length ? battles.map(liveRow) : [h('p', { class: 'muted' }, 'No hay peleas en vivo ahora mismo.')]));
  }
  function refreshAges() {
    for (const r of rooms) rows.get(key(r))?.querySelector('.room-meta')?.replaceChildren(meta(r));
    paintLive(battles);
  }
  function connect() {
    if (closed) return;
    ws = new WebSocket(wsURL());
    ws.onopen = () => {
      retry = 0;
      live.classList.add('on');
      ws.send(JSON.stringify({ t: 'lobby', token }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === 'rooms') {
        paint(msg.rooms);
        paintLive(msg.live ?? []);
      }
    };
    ws.onclose = () => {
      live.classList.remove('on');
      if (closed) return;
      if (!card.isConnected && !first) return stop();
      retry += 1;
      setTimeout(connect, Math.min(8000, 500 * 2 ** retry));
    };
  }
  const ageTimer = setInterval(() => {
    if (!card.isConnected && !first) return stop();
    refreshAges();
  }, 20_000);
  function stop() {
    closed = true;
    clearInterval(ageTimer);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  }
  roomsFeed = stop;
  connect();
  return [card, liveCard];
}

const HISTORY_PAGE = 6;
function myChallengesCard() {
  const list = h('div', { class: 'list history-list' }, h('p', { class: 'muted' }, 'Cargando…'));
  const sentinel = h('div', { class: 'history-more', 'aria-hidden': 'true' });
  let offset = 0;
  let loading = false;
  let done = false;
  const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && loadMore(), { root: list, rootMargin: '0px 0px 120px 0px' });
  async function loadMore() {
    if (loading || done) return;
    if (!list.isConnected && offset) return observer.disconnect();
    loading = true;
    sentinel.textContent = 'Cargando…';
    try {
      const { challenges, hasMore, tournaments = [] } = await api(`/api/me/challenges?offset=${offset}&limit=${HISTORY_PAGE}`);
      if (!offset) {
        if (tournaments.length) tourList.replaceChildren(...tournaments.map(tournamentItem));
        tourBox.hidden = !tournaments.length;
        list.replaceChildren();
        if (!challenges.length) list.append(h('p', { class: 'muted' }, 'Todavía no hay batallas. ¡Busca rival!'));
      }
      offset += challenges.length;
      done = !hasMore;
      list.append(...challenges.map(challengeItem));
      sentinel.textContent = '';
      if (!done) list.append(sentinel);
      else sentinel.remove();
      if (!done) observer.observe(sentinel);
    } catch {
      if (!offset) list.replaceChildren(h('p', { class: 'muted' }, 'No pude cargar tus batallas.'));
      sentinel.textContent = '';
    } finally {
      loading = false;
    }
  }
  loadMore();
  const tourList = h('div', { class: 'list' });
  const tourBox = h('div', { class: 'my-tours', hidden: true }, h('h3', null, '🏆 Tus torneos'), tourList);
  return h('div', { class: 'card' }, h('h2', null, 'Tus batallas'), list, tourBox);
}

function challengeItem(c) {
  const label = c.opponent ? `vs ${c.opponent}` : c.visibility === 'public' ? 'Sala pública · esperando rival' : 'Sala privada · esperando rival';
  const st =
    c.status === 'finished' ? (c.won ? h('span', { class: 'w' }, 'Ganaste') : h('span', { class: 'l' }, 'Perdiste'))
    : c.status === 'active' ? h('span', { class: 'pulse' }, 'En curso')
    : c.status === 'open' ? h('span', { class: 'muted' }, 'Abierta')
    : h('span', { class: 'muted' }, c.status === 'cancelled' ? 'Cancelado' : 'Cortado');
  return h('a', { class: 'item', href: `/b/${c.id}`, 'data-link': true }, h('span', null, label, h('span', { class: 'muted small' }, ` · ${MODE_ICON[c.mode] ?? MODE_ICON.team}`)), st);
}

function tournamentItem(t) {
  const st =
    t.status === 'open' ? h('span', { class: 'muted' }, 'Esperando jugadores')
    : t.status === 'running' ? h('span', { class: 'pulse' }, 'En juego')
    : t.champion ? h('span', { class: 'w' }, '🏆 Campeón')
    : h('span', { class: 'muted' }, t.reached ? `Llegaste a ${t.reached === 'Final' ? 'la Final' : t.reached}` : 'Terminado');
  return h('a', { class: 'item', href: `/t/${t.id}`, 'data-link': true }, h('span', null, `Torneo de ${t.size}`, h('span', { class: 'muted small' }, ` · ${MODE_ICON[t.mode] ?? MODE_ICON.team} · ${plural(t.humans, 'jugador', 'jugadores')}`)), st);
}

const percent = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function ago(ts) {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'recién';
  const m = Math.round(s / 60);
  if (m < 60) return `hace ${m} min`;
  const hr = Math.round(m / 60);
  if (hr < 48) return `hace ${hr} h`;
  return `hace ${Math.round(hr / 24)} días`;
}

const isMe = (t) => !!me && t.id === me.id;
const record = (t) => h('span', { class: 'record' }, h('span', { class: 'w' }, `${t.wins}V`), ' ', h('span', { class: 'l' }, `${t.losses}D`));
const rateBar = (t) => h('span', { class: 'rate', 'data-tip': t.games ? `${t.wins} de ${t.games} batallas ganadas` : 'Sin batallas todavía' }, h('span', { class: 'rate-bar' }, h('i', { style: { width: percent(t.winRate ?? 0) } })), h('span', { class: 'rate-num' }, percent(t.winRate)));
const trainerMeta = (t) => `${t.rosterSize} Pokémon · ${t.shinies} shiny · ${compact(t.totalTokens)} tokens`;

function podium(top) {
  const medals = ['🥇', '🥈', '🥉'];
  return h(
    'div',
    { class: 'podium' },
    top.map((t, i) =>
      h(
        'div',
        { class: `podium-card place-${i + 1}${isMe(t) ? ' is-me' : ''}` },
        h('span', { class: 'podium-medal', 'aria-label': `Puesto ${i + 1}` }, medals[i]),
        h('b', { class: 'podium-name' }, t.name, isMe(t) ? h('span', { class: 'muted small' }, ' (tú)') : null),
        record(t),
        rateBar(t),
        h('small', { class: 'muted' }, trainerMeta(t)),
      ),
    ),
  );
}

function rankingCard(ranking) {
  const body = !ranking.length
    ? [h('p', { class: 'muted' }, 'Todavía nadie ha peleado contra otro jugador. Crea un link y estrena el ranking.')]
    : [
        podium(ranking.slice(0, 3)),
        ranking.length > 3
          ? h(
              'div',
              { class: 'list rank-list' },
              ranking.slice(3).map((t, i) =>
                h(
                  'div',
                  { class: `item${isMe(t) ? ' is-me' : ''}` },
                  h('span', { class: 'row' }, h('span', { class: 'rank' }, `#${i + 4}`), h('span', { class: 'rank-who' }, h('strong', null, t.name, isMe(t) ? h('span', { class: 'muted small' }, ' (tú)') : null), h('small', { class: 'muted' }, trainerMeta(t)))),
                  h('span', { class: 'row rank-right' }, rateBar(t), record(t)),
                ),
              ),
            )
          : null,
      ];
  return h('div', { class: 'card' }, h('div', { class: 'row between' }, h('h2', null, '🏆 Ranking'), h('span', { class: 'muted small' }, 'Solo batallas entre jugadores')), ...body);
}

function tournamentStatsSection({ totals, ranking, recent }) {
  const head = h('div', { class: 'row between' }, h('h2', null, '🏆 Torneos'), h('span', { class: 'muted small', tabindex: 0, 'data-tip': 'Solo cuentan los torneos terminados con al menos 2 personas. No suman al ranking de batallas 1 contra 1.' }, 'Aparte del ranking 1 contra 1'));
  if (!totals.tournaments) return h('section', null, h('div', { class: 'card' }, head, h('p', { class: 'muted' }, 'Todavía no termina ningún torneo con al menos 2 personas. Arma uno desde el inicio.')));
  const champs = h(
    'div',
    { class: 'list rank-list' },
    ranking.slice(0, 10).map((t, i) =>
      h('div', { class: `item${me && t.id === me.id ? ' is-me' : ''}` }, h('span', { class: 'row' }, h('span', { class: 'rank' }, `#${i + 1}`), h('span', { class: 'rank-who' }, h('strong', null, t.name), h('small', { class: 'muted' }, `${plural(t.played, 'torneo', 'torneos')} · ${plural(t.finals, 'final', 'finales')}`))), h('span', { class: 'row rank-right' }, h('span', { class: 'chip' }, `🏆 ${t.titles}`), record(t))),
    ),
  );
  const last = h(
    'div',
    { class: 'list' },
    recent.map((t) => h('a', { class: 'item recent', href: `/t/${t.id}`, 'data-link': true }, h('span', null, h('span', { class: 'winner' }, `🏆 ${t.champion}`), h('span', { class: 'muted small' }, ` · Torneo de ${t.size}`)), h('span', { class: 'muted small recent-meta' }, `${MODE_ICON[t.mode] ?? MODE_ICON.team} · ${plural(t.humans, 'jugador', 'jugadores')} · ${ago(t.finishedAt)}`))),
  );
  return h(
    'section',
    null,
    h('div', { class: 'card' }, head, h('div', { class: 'row tour-totals' }, h('span', { class: 'chip' }, plural(totals.tournaments, 'torneo', 'torneos')), h('span', { class: 'chip' }, `${plural(totals.matches, 'pelea', 'peleas')} de torneo`), h('span', { class: 'chip', tabindex: 0, 'data-tip': 'Torneos que terminó ganando una IA' }, `🤖 ${plural(totals.aiTitles, 'título', 'títulos')} de la IA`)), h('div', { class: 'grid2 tour-stats' }, h('div', null, h('h3', null, 'Campeones'), champs), h('div', null, h('h3', null, 'Últimos torneos'), last))),
  );
}

function recentCard(recent) {
  const who = (name, won) => h('span', { class: won ? 'winner' : null }, won ? `🏆 ${name}` : name);
  const list = recent.length
    ? h(
        'div',
        { class: 'list' },
        recent.map((c) =>
          h(
            'a',
            { class: 'item recent', href: `/b/${c.id}`, 'data-link': true },
            h('span', { class: 'recent-vs' }, who(c.host, c.winner === 'host'), h('span', { class: 'muted' }, ' vs '), who(c.guest, c.winner === 'guest'), c.winner ? null : h('span', { class: 'muted small' }, ' · empate')),
            h('span', { class: 'muted small recent-meta' }, `${MODE_ICON[c.mode] ?? MODE_ICON.team}${c.turns ? ` · ${c.turns} turnos` : ''} · ${ago(c.finishedAt)}`),
          ),
        ),
      )
    : h('p', { class: 'muted' }, 'Todavía no hay batallas entre jugadores.');
  return h('div', { class: 'card' }, h('h2', null, '🕑 Batallas recientes'), list);
}

function numbersCard(totals) {
  const rows = [
    ['⚔︎', 'Batallas entre jugadores', totals.battles],
    [MODE_ICON.random, 'De ellas, aleatorias', totals.randomBattles],
    ['🤝', 'De ellas, empates', totals.draws],
    ['⏱', 'Turnos por batalla (promedio)', totals.avgTurns ?? '—'],
    ['🤖', 'Peleas contra la IA', totals.aiBattles, totals.aiBattles ? `los jugadores ganaron ${percent(totals.aiWins / totals.aiBattles)}` : null],
    ['📚', 'Especies distintas en el servidor', totals.species],
    ['🟢', 'Jugadores activos', totals.activeNow, 'en los últimos 15 min'],
    ['📅', 'Jugadores activos hoy', totals.activeToday, 'en las últimas 24 h'],
  ];
  return h(
    'div',
    { class: 'card' },
    h('h2', null, '📈 En números'),
    h('div', { class: 'list' }, rows.map(([icon, label, value, note]) => h('div', { class: 'item' }, h('span', { class: 'num-label' }, `${icon} ${label}`, note ? h('small', { class: 'muted' }, note) : null), h('strong', { class: 'num-value' }, value)))),
  );
}

function topMonsSection(mons) {
  const body = mons.length
    ? h(
        'div',
        { class: 'mons' },
        mons.map((m, i) =>
          h(
            'div',
            { class: 'mon top-mon' },
            h('span', { class: 'badge' }, `#${i + 1}`),
            h('div', { html: creatureHTML({ sprite: m.sprite }) }),
            h('div', { class: 'nm' }, m.name),
            h('div', { class: 'meta' }, typeChips(m.types ?? [])),
            h('div', { class: 'top-mon-line', tabindex: 0, 'data-tip': `Peleó en ${plural(m.uses, 'batalla', 'batallas')} y su equipo ganó ${plural(m.wins, 'vez', 'veces')}` }, h('b', null, plural(m.uses, 'batalla', 'batallas')), h('span', { class: 'muted' }, ` · ganó ${percent(m.wins / m.uses)}`)),
          ),
        ),
      )
    : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Aparecen cuando haya batallas entre jugadores.'));
  return h('section', null, h('div', { class: 'row between' }, h('h2', null, '🔥 Pokémon más usados'), h('span', { class: 'muted small' }, 'Los que salieron a pelear en batallas entre jugadores')), body);
}

async function statsPage(seq) {
  document.title = 'Stats · Token Clash';
  await loadMe();
  if (stale(seq)) return;
  renderWho();
  $app.replaceChildren(h('p', { class: 'muted center pad' }, 'Cargando…'));
  let data;
  try {
    data = await api('/api/stats');
  } catch (e) {
    if (stale(seq)) return;
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'No pude cargar las stats'), h('p', { class: 'muted' }, e.message)));
    return;
  }
  if (stale(seq)) return;
  const { totals, ranking, recent, topMons, live, tournaments } = data;
  $app.replaceChildren(
    h(
      'section',
      null,
      h(
        'div',
        { class: 'row between' },
        h('h1', null, 'Stats'),
        h(
          'div',
          { class: 'row' },
          h('span', { class: 'chip live-chip', tabindex: 0, 'data-tip': 'Preparaciones y batallas con alguien mirando, incluidas las peleas contra la IA' }, h('i', { class: 'live-dot', 'aria-hidden': 'true' }), `${plural(live.battles, 'batalla', 'batallas')} en vivo`),
          h('span', { class: 'chip', tabindex: 0, 'data-tip': totals.accounts > totals.trainers ? `${totals.accounts} cuentas: quien importó el mismo save en varias cuenta una sola vez` : 'Cada save cuenta una vez' }, `🧢 ${plural(totals.trainers, 'entrenador', 'entrenadores')}`),
          h('span', { class: 'chip', tabindex: 0, 'data-tip': 'Pokémon distintos de todos los saves, sin contar dos veces los que se repiten entre cuentas' }, `📚 ${compact(totals.pokemon)} Pokémon`),
          h('span', { class: 'chip' }, `✨ ${totals.shinies} shiny`),
          h('span', { class: 'chip', tabindex: 0, 'data-tip': 'Tokens de todos los saves según PokeTokenBar, una vez por save' }, `🪙 ${compact(totals.tokens)} tokens`),
        ),
      ),
    ),
    me ? h('section', null, myChallengesCard()) : '',
    h('section', null, rankingCard(ranking)),
    h('section', { class: 'grid2' }, recentCard(recent), numbersCard(totals)),
    tournaments ? tournamentStatsSection(tournaments) : '',
    topMonsSection(topMons),
    h('section', null, h('p', { class: 'muted small center' }, `Versión ${live.version} · servidor encendido ${ago(live.startedAt)}`)),
  );
  foldSections($app, STATS_OPEN);
}

const STATS_OPEN = new Set(['🏆 Ranking', 'Tus batallas']);
function foldSections(root, openByDefault) {
  let saved = {};
  try {
    saved = JSON.parse(ls.get('tc_stats_folds') || '{}');
  } catch {}
  for (const title of root.querySelectorAll('h2')) {
    const box = title.closest('.card') ?? title.closest('section');
    if (!box || box.classList.contains('foldable')) continue;
    const head = [...box.children].find((child) => child === title || child.contains(title));
    const key = title.textContent.trim();
    const setOpen = (open) => {
      box.classList.toggle('is-folded', !open);
      title.setAttribute('aria-expanded', String(open));
    };
    box.classList.add('foldable');
    head.classList.add('fold-head');
    title.classList.add('fold-title');
    title.tabIndex = 0;
    title.setAttribute('role', 'button');
    const toggle = () => {
      const open = box.classList.contains('is-folded');
      setOpen(open);
      saved[key] = open;
      ls.set('tc_stats_folds', JSON.stringify(saved));
    };
    title.addEventListener('click', toggle);
    title.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle()));
    setOpen(saved[key] ?? openByDefault.has(key));
  }
}

// ---------- pokedex ----------
const GEN_LABELS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX'];
const DEX_STATS = ['PS', 'Ataque', 'Defensa', 'At. esp.', 'Def. esp.', 'Velocidad'];
function genderText(rate) {
  if (rate == null) return '—';
  if (rate === -1) return 'Sin género';
  const female = (rate / 8) * 100;
  return `♂ ${(100 - female).toLocaleString('es')}% · ♀ ${female.toLocaleString('es')}%`;
}
const dexNumber = (id) => `N.º ${String(id).padStart(4, '0')}`;
const dexShiny = (() => {
  let set = new Set();
  try {
    set = new Set(JSON.parse(ls.get('tc_dex_shiny') || '[]'));
  } catch {}
  return {
    has: (id) => set.has(id),
    toggle(id, on) {
      if (on) set.add(id);
      else set.delete(id);
      ls.set('tc_dex_shiny', JSON.stringify([...set]));
    },
  };
})();

function shinySwitch(entry, onChange) {
  const can = entry.shiny;
  const input = h('input', { type: 'checkbox', role: 'switch', checked: can && dexShiny.has(entry.id) ? true : null, disabled: !can || null, 'aria-label': `Ver a ${entry.name} shiny`, onclick: (e) => e.stopPropagation(), onchange: (e) => { dexShiny.toggle(entry.id, e.target.checked); onChange(e.target.checked); } });
  return h('label', { class: `dex-switch${can ? '' : ' is-off'}`, 'data-tip': can ? 'Ver shiny' : 'Aún no tienes este shiny', onclick: (e) => e.stopPropagation() }, input, h('span', { class: 'dex-track', 'aria-hidden': 'true' }, h('i')), h('span', { class: 'dex-switch-label' }, '✨'));
}

async function pokedexPage(seq) {
  document.title = 'Pokédex · Token Clash';
  await loadMe();
  if (stale(seq)) return;
  renderWho();
  if (!me) {
    $app.replaceChildren(h('section', { class: 'card banner' }, h('h2', null, 'Tu Pokédex'), h('p', { class: 'muted' }, 'Importa tu save para ver qué Pokémon tienes registrados.')), importCard({ onDone: () => route() }));
    return;
  }
  $app.replaceChildren(h('p', { class: 'muted center pad' }, 'Abriendo la Pokédex…'));
  let dex;
  try {
    dex = (await api('/api/pokedex')).pokedex;
  } catch (e) {
    if (stale(seq)) return;
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'No pude abrir la Pokédex'), h('p', { class: 'muted' }, e.message)));
    return;
  }
  if (stale(seq)) return;
  const byId = new Map(dex.entries.map((e) => [e.id, e]));
  const genOf = (id) => dex.generations.findIndex(([a, b]) => id >= a && id <= b);
  const firstGen = Math.max(0, genOf(dex.entries[0]?.id ?? 1));
  let gen = Number(ls.get('tc_dex_gen') ?? firstGen);
  if (!(gen >= -1 && gen < dex.generations.length)) gen = 0;
  let show = 'all';
  let query = '';
  const grid = h('div', { class: 'dex-grid' });
  const countEl = h('span', { class: 'muted small' });
  const dialog = h('dialog', { class: 'dex-dlg', onclick: (e) => e.target === e.currentTarget && e.currentTarget.close() });

  const sprite = (id, shiny, cls = 'dex-sprite') => h('img', { class: cls, src: spriteURL({ sprite: String(id), shiny }), alt: '', loading: 'lazy', draggable: 'false' });

  function tile(id) {
    const e = byId.get(id);
    if (!e) return h('div', { class: 'dex-tile is-unknown', 'aria-label': `${dexNumber(id)}: sin registrar` }, h('span', { class: 'dex-num' }, dexNumber(id)), h('div', { class: 'dex-ball', 'aria-hidden': 'true' }), h('b', { class: 'dex-name' }, '???'));
    const img = sprite(id, e.shiny && dexShiny.has(id));
    const el = h(
      'button',
      { type: 'button', class: `dex-tile is-known${e.owned ? '' : ' by-evolution'}${e.shiny && dexShiny.has(id) ? ' is-shiny' : ''}`, onclick: () => openEntry(id), 'aria-label': `${dexNumber(id)} ${e.name}` },
      h('span', { class: 'dex-num' }, dexNumber(id)),
      e.shiny ? h('span', { class: 'dex-shiny-badge', 'data-tip': 'Lo tienes shiny' }, '✨') : null,
      h('div', { class: 'dex-pic' }, img),
      h('b', { class: 'dex-name' }, e.name),
      h('span', { class: 'dex-types' }, e.types.map((t) => h('i', { class: 'dex-type', style: { background: TYPES[t]?.color ?? '#9099a1' }, 'data-tip': typeLabel(t) }))),
      h('div', { class: 'dex-foot' }, h('small', { class: 'muted dex-have', 'data-tip': e.owned ? `Tienes ${e.owned}` : 'Registrado porque uno de tus Pokémon evolucionó de esta especie' }, e.owned ? `×${e.owned}` : 'Evolución'), shinySwitch(e, (on) => {
        img.src = spriteURL({ sprite: String(id), shiny: on });
        el.classList.toggle('is-shiny', on);
      })),
    );
    return el;
  }

  function openEntry(id) {
    const e = byId.get(id);
    if (!e) return;
    const big = sprite(id, e.shiny && dexShiny.has(id), 'dex-big');
    const stage = h('div', { class: `dex-stage${e.shiny && dexShiny.has(id) ? ' is-shiny' : ''}` }, big);
    const total = e.stats.reduce((a, b) => a + b, 0);
    dialog.replaceChildren(
      h(
        'div',
        { class: 'dex-detail' },
        h('button', { class: 'dex-close', type: 'button', 'aria-label': 'Cerrar', onclick: () => dialog.close() }, '✕'),
        h('div', { class: 'dex-detail-top' }, h('span', { class: 'dex-num' }, dexNumber(id)), h('h2', null, e.name), e.genus ? h('span', { class: 'dex-genus' }, e.genus) : null, typeChips(e.types)),
        stage,
        h('div', { class: 'row center' }, shinySwitch(e, (on) => {
          big.src = spriteURL({ sprite: String(id), shiny: on });
          stage.classList.toggle('is-shiny', on);
          paintGrid();
        }), h('span', { class: 'muted small' }, e.shiny ? 'Ver shiny' : 'Aún no lo tienes shiny')),
        e.entry ? h('blockquote', { class: 'dex-entry' }, e.entry) : null,
        h(
          'dl',
          { class: 'dex-facts' },
          h('div', null, h('dt', null, 'Altura'), h('dd', null, e.height != null ? `${e.height.toLocaleString('es')} m` : '—')),
          h('div', null, h('dt', null, 'Peso'), h('dd', null, e.weight != null ? `${e.weight.toLocaleString('es')} kg` : '—')),
          h('div', null, h('dt', null, 'Género'), h('dd', null, genderText(e.genderRate))),
          h('div', { class: 'wide' }, h('dt', null, 'Habilidades'), h('dd', null, e.abilities.map((a, i) => [i ? ' · ' : '', a.name, a.hidden ? h('small', { class: 'muted' }, ' (oculta)') : null]))),
        ),
        h('p', { class: 'dex-owned' }, e.owned ? `Tienes ${plural(e.owned, 'ejemplar', 'ejemplares')} · ${e.levels.map((l) => `Nv ${l}`).join(', ')}` : 'Registrado porque uno de tus Pokémon evolucionó de esta especie.'),
        h('h3', null, 'Stats base'),
        h('div', { class: 'stat-bars' }, e.stats.map((v, i) => h('div', { class: 'stat-row' }, h('span', null, DEX_STATS[i]), h('b', null, v), h('i', { style: { width: `${Math.min(100, (v / 200) * 100)}%` } }))), h('div', { class: 'stat-row total' }, h('span', null, 'Total'), h('b', null, total), h('span'))),
        e.family.length > 1
          ? [
              h('h3', null, 'Línea evolutiva'),
              h('div', { class: 'dex-family' }, [...new Set(e.family.map((f) => f.stage))].map((stage, i) => [
                i ? h('span', { class: 'dex-arrow', 'aria-hidden': 'true' }, '→') : null,
                h('div', { class: 'dex-stage-group' }, e.family.filter((f) => f.stage === stage).map((f) => h(f.name ? 'button' : 'div', { type: f.name ? 'button' : null, class: `dex-fam${f.name ? '' : ' is-unknown'}${f.id === id ? ' is-current' : ''}`, onclick: f.name && f.id !== id ? () => openEntry(f.id) : null }, f.name ? sprite(f.id, byId.get(f.id)?.shiny && dexShiny.has(f.id), 'dex-fam-pic') : h('div', { class: 'dex-ball small' }), h('small', null, f.name ?? '???')))),
              ])),
            ]
          : null,
      ),
    );
    if (!dialog.open) dialog.showModal();
  }

  function paintGrid() {
    const ids = (gen === -1 ? [[1, dex.total]] : [dex.generations[gen]]).flatMap(([a, b]) => Array.from({ length: Math.min(b, dex.total) - a + 1 }, (_, i) => a + i));
    const q = query.trim().toLowerCase();
    const list = ids.filter((id) => {
      const e = byId.get(id);
      if (show === 'have' && !e) return false;
      if (show === 'missing' && e) return false;
      if (show === 'shiny' && !e?.shiny) return false;
      if (q && !(String(id).includes(q.replace(/^#|^n\.?º?\s*/i, '')) || e?.name.toLowerCase().includes(q))) return false;
      return true;
    });
    const have = ids.filter((id) => byId.has(id)).length;
    countEl.textContent = `${have} de ${ids.length} registrados en ${gen === -1 ? 'total' : `la generación ${GEN_LABELS[gen]}`}`;
    grid.replaceChildren(...(list.length ? list.map(tile) : [h('p', { class: 'muted' }, 'Nada coincide con el filtro.')]));
  }

  const genTabs = h(
    'div',
    { class: 'dex-gens', role: 'tablist', 'aria-label': 'Generación' },
    [...dex.generations.map((range, i) => ({ i, range })), { i: -1, range: [1, dex.total] }].map(({ i, range: [a, b] }) => {
      const have = dex.entries.filter((e) => e.id >= a && e.id <= b).length;
      const size = Math.min(b, dex.total) - a + 1;
      return h(
        'button',
        { type: 'button', role: 'tab', class: 'dex-gen', 'aria-selected': String(i === gen), onclick: (e) => { gen = i; ls.set('tc_dex_gen', String(i)); genTabs.querySelectorAll('.dex-gen').forEach((b) => b.setAttribute('aria-selected', 'false')); e.currentTarget.setAttribute('aria-selected', 'true'); paintGrid(); } },
        h('b', null, i === -1 ? 'Todas' : `Gen ${GEN_LABELS[i]}`),
        h('small', null, `${have}/${size}`),
        h('i', { class: 'dex-gen-bar', style: { width: `${(have / size) * 100}%` } }),
      );
    }),
  );
  const pct = Math.round((dex.registered / dex.total) * 1000) / 10;
  $app.replaceChildren(
    h(
      'section',
      { class: 'dex-shell' },
      h('div', { class: 'dex-lights', 'aria-hidden': 'true' }, h('i', { class: 'big' }), h('i', { class: 'r' }), h('i', { class: 'y' }), h('i', { class: 'g' })),
      h('div', { class: 'dex-head' }, h('h1', null, 'Pokédex'), h('p', null, h('b', null, dex.registered), ` de ${dex.total} registrados · ${pct}%`, h('span', { class: 'dex-sep' }, '·'), `✨ ${plural(dex.shinies, 'shiny', 'shinies')}`)),
      h('div', { class: 'dex-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': dex.total, 'aria-valuenow': dex.registered }, h('i', { style: { width: `${Math.max(pct, 0.5)}%` } })),
    ),
    h('section', null, genTabs),
    h(
      'div',
      { class: 'coll-bar dex-bar' },
      h('input', { type: 'search', placeholder: 'Buscar por nombre o número…', 'aria-label': 'Buscar en la Pokédex', oninput: (e) => { query = e.target.value; paintGrid(); } }),
      h('select', { 'aria-label': 'Mostrar', onchange: (e) => { show = e.target.value; paintGrid(); } }, h('option', { value: 'all' }, 'Todos'), h('option', { value: 'have' }, 'Registrados'), h('option', { value: 'missing' }, 'Me faltan'), h('option', { value: 'shiny' }, 'Shiny')),
      countEl,
    ),
    grid,
    dialog,
  );
  paintGrid();
}

// ---------- team ----------
const PARTY_SIZE = 6;
const MODE_ICON = { team: '🎒', random: '🎲' };
const MODE_LABEL = { team: 'Batalla con tu equipo', random: 'Batalla aleatoria' };
const AI_ORDER = ['easy', 'mid', 'hard', 'veryhard', 'skynet'];
const TOURNAMENT_SIZES = [4, 8, 16];
const AI_LABEL = { easy: 'Fácil', mid: 'Media', hard: 'Difícil', veryhard: 'Muy difícil', skynet: 'Skynet' };
const AI_TITLE = / - (fácil|media|difícil|muy difícil|skynet)$/i;
const trainerShort = (name) => String(name ?? '').replace(AI_TITLE, '');
const trainerTitle = (name) => AI_TITLE.exec(String(name ?? ''))?.[1] ?? null;
const nameSize = (name) => {
  const length = trainerShort(name).length;
  return length > 16 ? 'name-xl' : length > 10 ? 'name-l' : null;
};
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const nameTitle = (name, avatar) => {
  const difficulty = trainerTitle(name);
  if (difficulty) return h('small', { class: 'trainer-title is-ai' }, `🤖 ${capitalize(difficulty)}`);
  return avatar ? skinTitle(avatar) : null;
};
const shortTrainer = (key) => {
  const label = baseTrainerLabel(key).replace(/ (\d+|Alternate)$/, '');
  const gender = label.match(/ [♂♀]$/)?.[0] ?? '';
  const words = label.replace(/ [♂♀]$/, '').split(' ');
  return `${words.length > 2 ? words.at(-1) : words.join(' ')}${gender}`;
};
function skinTitle(key, tag = 'small') {
  const variant = VARIANTS_BY_KEY.get(key);
  const text = variant?.name ?? (variant ? `${shortTrainer(variant.base)} ${VARIANT_COLOR_NAMES[variant.color] ?? variant.color}` : shortTrainer(key));
  return h(tag, { class: 'trainer-title skin-title', 'data-tip': trainerLabel(key) }, text);
}
function playerPill(side, by, you = false) {
  return h('span', { class: `who who-pill by-${by}` }, avatarPic(side.avatar, 'sm', side.frame), trainerName(side.name, {}, side.avatar), you ? h('span', { class: 'chip match-you' }, 'Tú') : null);
}
function trainerName(name, attrs = {}, avatar = null) {
  const title = nameTitle(name, avatar);
  if (!title) return h('b', { ...attrs, class: [attrs.class, nameSize(name)].filter(Boolean).join(' ') || null }, name);
  return h('span', { ...attrs, class: `trainer-name${attrs.class ? ` ${attrs.class}` : ''}` }, h('b', { class: nameSize(name) }, trainerShort(name)), title);
}
const AI_NOTES = {
  easy: {
    team: 'Los dados sortean sus 6 entre todos los Pokémon evolucionados de la 1.ª a la 5.ª generación. Ataca sin pensar, como un Pokémon salvaje.',
    random: 'Sus 6 también salen de los dados, solo entre Pokémon evolucionados. Ataca sin pensar, como un Pokémon salvaje.',
  },
  mid: {
    team: 'Los dados sortean sus 6 entre el 80 % más fuerte de los evolucionados. Evita movimientos inútiles, pero no cambia de Pokémon.',
    random: 'Sus 6 salen de los dados, solo entre Pokémon evolucionados. Evita movimientos inútiles, pero no cambia de Pokémon.',
  },
  hard: {
    team: 'Los dados sortean sus 6 entre el 60 % más fuerte de los evolucionados. Busca el KO y a veces cambia si va perdiendo.',
    random: 'Sus 6 salen de los dados, solo entre Pokémon evolucionados. Elige bien a quién sacar, busca el KO y a veces cambia si va perdiendo.',
  },
  veryhard: {
    team: 'Los dados sortean sus 6 entre el 50 % más fuerte de los evolucionados. Calcula velocidad y daño, y cambia cuando le conviene.',
    random: 'Sus 6 salen de los dados, solo entre Pokémon evolucionados, pero calcula velocidad y daño, elige el mejor enfrentamiento y cambia cuando le conviene.',
  },
  skynet: {
    team: 'Los dados sortean sus 6 entre el 40 % más fuerte de los evolucionados. En cada turno Jev, un modelo de decisiones, elige qué ataque usar o a quién sacar.',
    random: 'Sus 6 salen de los dados, solo entre Pokémon evolucionados. En cada turno Jev, un modelo de decisiones, elige qué ataque usar o a quién sacar.',
  },
};

function addToParty(ids, uid) {
  const byId = new Map(me.roster.map((f) => [f.uid, f]));
  const f = byId.get(uid);
  const twin = ids.findIndex((id) => byId.get(id)?.speciesId === f.speciesId);
  if (twin < 0) return { ids: [...ids, uid], swapped: null };
  const next = ids.slice();
  next[twin] = uid;
  return { ids: next, swapped: byId.get(ids[twin]) };
}

const swapNote = (from, to) => `Solo puedes llevar un ${to.speciesName}: cambié ${from.shiny ? 'el shiny' : 'el normal'} por ${to.shiny ? 'el shiny ✨' : 'el normal'}.`;
const BATTLE_SIZE = 3;
const CATEGORY_ICON = { physical: '💥', special: '🌀', status: '✦' };
const STAT_ROWS = [['PS', 'hp'], ['Ataque', 'atk'], ['Defensa', 'def'], ['At. Esp.', 'satk'], ['Def. Esp.', 'sdef'], ['Velocidad', 'spd']];

function partyOf() {
  const byId = new Map(me.roster.map((f) => [f.uid, f]));
  return me.team.map((id) => byId.get(id)).filter(Boolean);
}

async function savePartyIds(ids) {
  me = (await api('/api/me', { method: 'PUT', body: { team: ids } })).me;
}

function downloadText(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

async function downloadEditedSave() {
  const stored = await storedSave();
  if (!stored) return toast('Vuelve a subir tu save en este navegador para poder descargarlo editado.');
  const edits = me.roster.map((f) => f.saveEdit).filter(Boolean);
  if (!edits.length) return toast('Todavía no cambias movimientos ni habilidades.');
  try {
    const { text, missing } = patchSave(stored.text, edits);
    downloadText(`PokeTokenBar-Save-${new Date().toISOString().slice(0, 10)}-token-clash.json`, text);
    toast(missing.length ? `Save listo. ${missing.length} Pokémon no tienen perfil en ese save y quedaron sin cambios.` : 'Save listo: impórtalo en PokeTokenBar → Ajustes → Backup & Transfer.');
  } catch (e) {
    toast(`No pude editar ese save: ${e.message}`);
  }
}

function partyRow(team) {
  return h(
    'div',
    { class: 'party-row' },
    Array.from({ length: PARTY_SIZE }, (_, i) => {
      const f = team[i];
      if (!f) return h('a', { class: 'party-cell empty', href: '/coleccion', 'data-link': true, 'aria-label': 'Agregar un Pokémon' }, ballFrame(null), h('div', { class: 'name-plate' }, h('b', null, '???')));
      return h(
        'a',
        { class: 'party-cell', href: `/coleccion?p=${f.uid}`, 'data-sfx': 'none', 'aria-label': `Editar a ${f.name}`, onclick: (e) => { e.preventDefault(); nav(`/coleccion?p=${f.uid}`); } },
        h('span', { class: 'slot-num' }, i + 1),
        i === 0 ? h('span', { class: 'lead-tag' }, 'Líder') : null,
        ballFrame(f),
        h('div', { class: 'name-plate' }, h('b', null, f.shiny ? `✨ ${f.name}` : f.name, genderMark(f.gender)), h('small', null, `Nv ${f.level}`), typeChips(f.types)),
      );
    }),
  );
}

function ballFrame(f, { size = 'md', label = null } = {}) {
  return h('div', { class: `ball-frame ${size}${f ? '' : ' empty'}` }, h('span', { class: 'ball-band' }), f ? h('div', { class: 'ball-mon', html: creatureHTML(f) }) : h('span', { class: 'ball-plus' }, label ?? '+'));
}

function typeTint(type) {
  const c = TYPES[type]?.color ?? '#9099a1';
  return { '--type': c };
}

async function teamPage(seq) {
  await loadMe();
  if (stale(seq)) return;
  renderWho();
  if (!me) return nav('/');
  document.title = 'Colección · Token Clash';
  const params = new URLSearchParams(location.search);
  let selected = params.get('p') || me.team[0] || me.roster[0]?.uid;
  let dragFrom = null;
  let editor = null;

  const partyEl = h('div', { class: 'party-row' });
  const panel = h('section', { class: 'mon-panel' });
  const grid = h('div', { class: 'collection' });
  const countEl = h('span', { class: 'party-count' });

  async function setParty(ids, { pop = null } = {}) {
    try {
      await savePartyIds(ids);
      paintParty(pop);
      paintCollection();
      editor?.refreshPartyButton();
    } catch (e) {
      toast(e.message);
    }
  }
  function toggle(uid) {
    const ids = me.team.slice();
    const i = ids.indexOf(uid);
    if (i >= 0) {
      if (ids.length === 1) return toast('Tu equipo necesita al menos un Pokémon.');
      ids.splice(i, 1);
      return setParty(ids);
    }
    const added = addToParty(ids, uid);
    if (added.swapped) {
      toast(swapNote(added.swapped, me.roster.find((f) => f.uid === uid)));
      return setParty(added.ids, { pop: uid });
    }
    if (ids.length >= PARTY_SIZE) {
      playClass(partyEl, 'shake');
      return toast(`Tu equipo ya tiene ${PARTY_SIZE}: quita uno primero.`);
    }
    return setParty(added.ids, { pop: uid });
  }
  function cry(uid) {
    const picked = me.roster.find((f) => f.uid === uid);
    if (picked) music.sfx('cry', { sprite: picked.sprite });
  }
  function select(uid) {
    if (editor?.dirty() && !window.confirm(UNSAVED_MSG)) return;
    cry(uid);
    selected = uid;
    history.replaceState(null, '', `/coleccion?p=${uid}`);
    shownPath = `/coleccion?p=${uid}`;
    paintParty();
    paintCollection();
    openEditor();
  }

  function paintParty(pop = null) {
    const party = partyOf();
    countEl.textContent = `${party.length}/${PARTY_SIZE}`;
    partyEl.replaceChildren(
      ...Array.from({ length: PARTY_SIZE }, (_, i) => {
        const f = party[i];
        if (!f) return h('div', { class: 'party-cell empty', 'aria-label': 'Elige un Pokémon de tu colección' }, ballFrame(null), h('div', { class: 'name-plate' }, h('b', null, '???')));
        const cell = h(
          'div',
          {
            class: `party-cell${f.uid === selected ? ' selected' : ''}${f.uid === pop ? ' pop' : ''}`,
            draggable: 'true',
            tabindex: 0,
            role: 'button',
            'data-sfx': 'none',
            'aria-label': `${f.name}, puesto ${i + 1}. Enter para editar.`,
            onclick: () => select(f.uid),
            onkeydown: (e) => {
              if (e.key === 'Enter') select(f.uid);
              if (e.key === 'ArrowLeft' && i > 0) move(i, i - 1);
              if (e.key === 'ArrowRight' && i < party.length - 1) move(i, i + 1);
            },
            ondragstart: (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; cell.classList.add('dragging'); },
            ondragend: () => cell.classList.remove('dragging'),
            ondragover: (e) => { e.preventDefault(); cell.classList.add('drop-target'); },
            ondragleave: () => cell.classList.remove('drop-target'),
            ondrop: (e) => { e.preventDefault(); cell.classList.remove('drop-target'); if (dragFrom !== null && dragFrom !== i) move(dragFrom, i); dragFrom = null; },
          },
          h('span', { class: 'slot-num' }, i + 1),
          i === 0 ? h('span', { class: 'lead-tag' }, 'Líder') : null,
          ballFrame(f),
          h('div', { class: 'name-plate' }, h('b', null, f.shiny ? `✨ ${f.name}` : f.name, genderMark(f.gender)), h('small', null, `Nv ${f.level}`), typeChips(f.types)),
          h('button', { class: 'cell-remove', type: 'button', 'data-sfx': 'remove', 'data-tip': 'Quitar del equipo', 'aria-label': `Quitar a ${f.name}`, onclick: (e) => { e.stopPropagation(); toggle(f.uid); } }, '✕'),
        );
        return cell;
      }),
    );
  }
  function move(from, to) {
    const ids = me.team.slice();
    const [id] = ids.splice(from, 1);
    ids.splice(to, 0, id);
    setParty(ids);
  }

  async function rename(f) {
    const n = window.prompt(`Apodo para ${f.speciesName} (vacío para quitarlo)`, f.nickname || '');
    if (n === null) return;
    try {
      me = (await api('/api/me', { method: 'PUT', body: { nickname: { id: f.uid, name: n } } })).me;
      paintParty();
      paintCollection();
    } catch (e) {
      toast(e.message);
    }
  }

  function paintCollection() {
    const list = me.roster.filter(filters.match);
    shownCount(collCount, list.length, me.roster.length);
    grid.replaceChildren(
      ...(list.length
        ? list.map((f) => {
            const inParty = me.team.includes(f.uid);
            return monCard(f, {
              stats: true,
              badge: `#${f.speciesId}`,
              cls: `coll-card${inParty ? ' in-party' : ''}${f.uid === selected ? ' selected' : ''}`,
              label: `Editar a ${f.name}`,
              sfx: 'none',
              onclick: () => select(f.uid),
              onEdit: () => rename(f),
              extra: h('button', { class: `col-add${inParty ? ' on' : ''}`, type: 'button', 'data-sfx': inParty ? 'remove' : 'add', 'data-tip': inParty ? 'Quitar del equipo' : 'Agregar al equipo', 'aria-label': inParty ? `Quitar a ${f.name} del equipo` : `Agregar a ${f.name} al equipo`, onclick: (e) => { e.stopPropagation(); toggle(f.uid); }, onkeydown: (e) => e.stopPropagation() }, inParty ? '✓' : '+'),
            });
          })
        : [h('p', { class: 'muted' }, 'Ningún Pokémon coincide con el filtro.')]),
    );
  }

  async function openEditor() {
    if (!selected) return panel.replaceChildren(h('p', { class: 'muted' }, 'Elige un Pokémon para ver sus movimientos.'));
    panel.replaceChildren(h('div', { class: 'panel-loading pulse' }, 'Cargando…'));
    const want = selected;
    editor = null;
    editor = await monPanel(selected, panel, {
      isCurrent: () => want === selected && !stale(seq),
      inParty: () => me.team.includes(selected),
      toggleParty: () => toggle(selected),
      onSaved: () => {
        paintParty();
        paintCollection();
      },
    });
  }

  const filters = rosterFilters(() => paintCollection());
  const collCount = h('span', { class: 'coll-count' });
  const reimport = h('div', { class: 'reimport', hidden: true }, importCard({ onDone: () => route() }));
  const reimportBtn = toolButton({ icon: '↻', label: 'Actualizar save', note: 'Sube uno más nuevo', 'aria-expanded': 'false', onclick: () => {
    reimport.hidden = !reimport.hidden;
    reimportBtn.setAttribute('aria-expanded', String(!reimport.hidden));
  } });
  $app.replaceChildren(
    h('div', { class: 'coll-page-head' }, h('div', null, h('h1', null, 'Colección'), h('div', { class: 'row' }, h('span', { class: 'chip' }, `📚 ${me.rosterSize} Pokémon`), h('span', { class: 'chip' }, `✨ ${me.shinies} shiny`), h('span', { class: 'chip', tabindex: 0, 'data-tip': 'Tokens totales según PokeTokenBar' }, `🪙 ${compact(me.totalTokens)} tokens`))), h('div', { class: 'tools' }, toolButton({ icon: '⬇', label: 'Descargar save editado', note: 'Para importarlo en PokeTokenBar', tip: 'Baja tu save con los movimientos y habilidades que cambiaste', 'data-sfx': 'save', onclick: downloadEditedSave }), reimportBtn)),
    reimport,
    h('div', { class: 'team-head' }, h('h2', null, 'Tu equipo ', countEl)),
    h('section', { class: 'party-board' }, partyEl, h('p', { class: 'hint' }, `Arrastra para ordenar · el líder abre la pelea · antes de cada combate eliges ${BATTLE_SIZE} de estos ${PARTY_SIZE}`)),
    panel,
    h('section', { class: 'collection-board' }, h('div', { class: 'coll-head' }, h('h2', null, 'Tus Pokémon')), collectionBar(filters, collCount), grid),
    h('section', null, h('p', { class: 'muted small' }, 'Tu sesión vive en este navegador. Para entrar desde otro: ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); copy(`${location.origin}/#key=${token}`, 'Link de acceso copiado. No lo compartas: entra como tú.'); } }, 'copiar link de acceso'), '.')),
  );
  unsaved = () => !!editor?.dirty();
  paintParty();
  paintCollection();
  openEditor();
  if (params.get('p')) cry(selected);
}

async function monPanel(uid, panel, { isCurrent, inParty, toggleParty, onSaved }) {
  let mon;
  try {
    mon = (await api(`/api/me/mons/${uid}`)).mon;
  } catch (e) {
    if (isCurrent()) panel.replaceChildren(h('p', { class: 'error' }, e.message));
    return null;
  }
  if (!isCurrent()) return null;
  const original = { moves: mon.movepool.filter((m) => m.chosen).map((m) => m.key), ability: mon.ability };
  if (!original.moves.length) original.moves = mon.moves.map((m) => m.key);
  let moves = original.moves.slice();
  let ability = original.ability;
  let filter = '';
  let onlyUsable = true;
  let origin = 'all';
  const byKey = new Map(mon.movepool.map((m) => [m.key, m]));
  const dirty = () => ability !== original.ability || moves.join() !== original.moves.join();
  const partyBtn = h('button', { type: 'button', class: 'btn', onclick: async () => { await toggleParty(); refreshPartyButton(); } });
  function refreshPartyButton() {
    partyBtn.textContent = inParty() ? '− Quitar del equipo' : '+ Agregar al equipo';
  }

  const slotsEl = h('div', { class: 'move-slots' });
  const abilityEl = h('div', { class: 'ability-cards' });
  const tbody = h('tbody');
  const saveBar = h('div', { class: 'save-bar' });

  async function save(btn) {
    btn.disabled = true;
    try {
      mon = (await api(`/api/me/mons/${uid}`, { method: 'PUT', body: { ...(moves.length ? { moves } : {}), ...(ability ? { ability } : {}) } })).mon;
      me = (await api('/api/me')).me;
      original.moves = moves.slice();
      original.ability = ability;
      playClass(panel, 'saved', 900);
      toast(`${mon.name} quedó listo para pelear.`);
      onSaved?.();
      paint();
    } catch (e) {
      playClass(panel, 'shake');
      toast(e.message);
    } finally {
      btn.disabled = false;
    }
  }
  function toggleMove(key) {
    const i = moves.indexOf(key);
    if (i >= 0) {
      if (moves.length === 1) return toast('Necesita al menos un movimiento.');
      moves.splice(i, 1);
    } else if (moves.length >= mon.maxMoves) {
      playClass(slotsEl, 'shake');
      return toast(`Ya tiene ${mon.maxMoves}: quita uno de arriba primero.`);
    } else moves.push(key);
    paint();
  }

  function paint() {
    slotsEl.replaceChildren(
      ...Array.from({ length: mon.maxMoves }, (_, i) => {
        const m = byKey.get(moves[i]);
        if (!m) return h('div', { class: 'move-slot empty' }, h('span', null, 'Elige un movimiento de la tabla'));
        return h(
          'button',
          { type: 'button', class: 'move-slot', style: typeTint(m.type), 'data-tip': m.desc, 'data-tip-note': 'Clic para quitarlo', onclick: () => toggleMove(m.key) },
          h('span', { class: 'ms-top' }, h('b', null, m.name), h('span', { class: 'ms-x' }, '✕')),
          h('span', { class: 'ms-meta' }, h('span', { class: 'type-badge', style: typeTint(m.type) }, typeLabel(m.type)), h('span', null, `${CATEGORY[m.category]}${m.power ? ` · ${m.power}` : ''} · PP ${m.pp}`)),
        );
      }),
    );
    abilityEl.replaceChildren(
      ...(ability ? [] : [h('p', { class: 'muted small' }, 'Sin habilidad: ninguna de las de su especie tiene efecto en Token Clash.')]),
      ...mon.abilityOptions.map((a) =>
        h(
          'button',
          { type: 'button', class: `ability-card${a.key === ability ? ' on' : ''}${a.inert ? ' unusable' : ''}`, 'aria-pressed': String(a.key === ability), disabled: !!a.inert, 'data-tip': a.inert ? 'Esta habilidad no tiene efecto en Token Clash: no se puede elegir.' : null, onclick: () => { ability = a.key; paint(); } },
          h('span', { class: 'ac-head' }, h('span', { class: 'ac-radio' }), h('b', null, a.name), a.hidden ? h('span', { class: 'ac-tag' }, 'Oculta') : null),
          h('span', { class: 'ac-desc' }, a.desc),
          a.inert ? h('span', { class: 'ac-inert' }, a.inert) : null,
        ),
      ),
    );
    const q = filter.toLowerCase();
    const rows = mon.movepool.filter((m) => (!onlyUsable || m.supported) && (origin === 'all' || m.origin === origin) && (!q || m.name.toLowerCase().includes(q) || typeLabel(m.type).toLowerCase().includes(q)));
    tbody.replaceChildren(
      ...(rows.length
        ? rows.map((m) => {
            const on = moves.includes(m.key);
            return h(
              'tr',
              { class: `${on ? 'on' : ''}${m.supported ? '' : ' unsupported'}`, tabindex: m.supported ? 0 : -1, 'aria-disabled': m.supported ? null : 'true', onclick: () => m.supported && toggleMove(m.key), onkeydown: (e) => e.key === 'Enter' && m.supported && toggleMove(m.key) },
              h('td', { class: 'origin' }, m.origin === 'level' ? `Nv ${m.level}` : MOVE_ORIGIN[m.origin]),
              h('td', { class: 'mv-cell' }, h('span', { class: 'check' }, on ? '✓' : ''), h('b', null, m.name), h('small', null, m.supported ? m.desc : 'Sin efecto en Token Clash todavía')),
              h('td', null, h('span', { class: 'type-badge', style: typeTint(m.type) }, typeLabel(m.type))),
              h('td', { class: 'cat' }, h('span', { class: `cat-badge ${m.category}` }, CATEGORY[m.category])),
              h('td', { class: 'num' }, m.power || '—'),
              h('td', { class: 'num' }, m.accuracy ? `${m.accuracy}%` : '∞'),
              h('td', { class: 'num' }, m.pp),
            );
          })
        : [h('tr', null, h('td', { colspan: 7, class: 'muted empty-row' }, 'Ningún movimiento coincide.'))]),
    );
    saveBar.classList.toggle('dirty', dirty());
    saveBar.replaceChildren(
      h('span', { class: 'sb-status' }, dirty() ? '● Cambios sin guardar' : '✓ Todo guardado'),
      h('div', { class: 'row' }, partyBtn, h('button', { type: 'button', class: 'btn', disabled: !dirty(), onclick: () => { moves = original.moves.slice(); ability = original.ability; paint(); } }, 'Descartar'), h('button', { type: 'button', class: 'btn primary', disabled: !dirty(), onclick: (e) => save(e.currentTarget) }, 'Guardar cambios')),
    );
    refreshPartyButton();
  }

  panel.replaceChildren(
    h(
      'div',
      { class: 'panel-grid' },
      h(
        'aside',
        { class: 'panel-side' },
        ballFrame(mon, { size: 'lg' }),
        h('h2', null, mon.shiny ? `✨ ${mon.name}` : mon.name, ' ', genderMark(mon.gender)),
        h('p', { class: 'muted small' }, mon.name !== mon.speciesName ? `${mon.speciesName} · ` : '', `#${mon.speciesId} · Nv ${mon.level}`, mon.nature ? ` · ${mon.nature}` : ''),
        typeChips(mon.types),
        h('div', { class: 'stat-bars' }, STAT_ROWS.map(([label, k]) => h('div', { class: 'stat-row' }, h('span', null, label), h('b', null, mon.stats[k]), h('i', { style: { width: `${Math.min(100, (mon.stats[k] / (k === 'hp' ? 400 : 300)) * 100)}%` } })))),
      ),
      h(
        'div',
        { class: 'panel-main' },
        h('h3', null, 'Habilidad'),
        abilityEl,
        h('h3', null, 'Movimientos', h('span', { class: 'muted' }, ` · elige hasta ${mon.maxMoves}`)),
        slotsEl,
        h(
          'div',
          { class: 'table-tools' },
          h('input', { type: 'search', placeholder: 'Buscar movimiento o tipo…', 'aria-label': 'Buscar movimiento', oninput: (e) => { filter = e.target.value.trim(); paint(); } }),
          h(
            'select',
            { 'aria-label': 'Origen del movimiento', onchange: (e) => { origin = e.target.value; paint(); } },
            h('option', { value: 'all' }, 'Todos los orígenes'),
            ...Object.entries(MOVE_ORIGIN_FILTER)
              .filter(([key]) => mon.movepool.some((m) => m.origin === key))
              .map(([key, label]) => h('option', { value: key }, label)),
          ),
          h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { onlyUsable = e.target.checked; paint(); } }), ' Solo los que funcionan en Token Clash'),
        ),
        h('div', { class: 'move-table-wrap' }, h('table', { class: 'move-table' }, h('thead', null, h('tr', null, ['Origen', 'Movimiento', 'Tipo', 'Cat.', 'Poder', 'Prec.', 'PP'].map((t) => h('th', null, t)))), tbody)),
      ),
    ),
    saveBar,
  );
  paint();
  return { dirty, refreshPartyButton };
}

// ---------- battle ----------
async function battlePage(id, seq) {
  await loadMe();
  if (stale(seq)) return;
  renderWho();
  let c;
  try {
    c = (await api(`/api/challenges/${id}`)).challenge;
  } catch (e) {
    if (stale(seq)) return;
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'No encontré esa batalla'), h('p', { class: 'muted' }, e.message), h('a', { class: 'btn', href: '/', 'data-link': true }, 'Ir al inicio')));
    return;
  }
  if (stale(seq)) return;
  document.title = `${c.host.name} desafía · Token Clash`;

  if (c.status === 'cancelled') return roomClosedBanner(c, me && c.host.id === me.id);
  if (c.status === 'abandoned') {
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'Esta batalla se cortó'), h('p', { class: 'muted' }, 'El servidor se reinició a mitad de la pelea. Busca rival de nuevo desde el inicio.'), h('a', { class: 'btn primary', href: '/', 'data-link': true }, 'Ir al inicio')));
    return;
  }

  let closed = false;
  let ws = null;
  let retry = 0;
  let battle = null; // battle UI controller, once a battle exists
  let prep = null;
  let match = null;
  let duel = null;
  const bar = roomBar(c, () => send({ t: 'watch' }));
  const alerts = roomAlerts(c);
  const chat = chatPanel((msg) => send(msg));
  let dock = null;
  const stopFollow = c.tournament ? followTournament(c, seq, () => battle) : null;
  cleanup = () => {
    closed = true;
    ws?.close();
    battle?.destroy();
    prep?.destroy();
    match?.destroy();
    dock?.destroy();
    bar.destroy();
    stopFollow?.();
  };
  const send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));

  function connect() {
    if (closed) return;
    ws = new WebSocket(wsURL());
    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({ t: 'hello', room: id, token }));
    };
    ws.onmessage = (e) => {
      if (closed) return;
      const msg = JSON.parse(e.data);
      if (msg.t === 'error') return toast(msg.error);
      if (msg.t === 'chatLog') return chat.load(msg.messages);
      if (msg.t === 'chat') return chat.add(msg.message);
      if (msg.t === 'watch') return bar.setWatch(msg.open);
      dock ??= chatDock(chat);
      alerts.check(msg);
      if (msg.t === 'closed') {
        cleanup?.();
        cleanup = null;
        return roomClosedBanner(c, me && c.host.id === me.id);
      }
      if (msg.t === 'reopened') {
        if (!msg.host) return void nav('/');
        toast('Tu rival salió de la sala. Sigue abierta para que entre otro.');
        return void route();
      }
      if ('you' in msg) bar.update(msg.you, msg.players ?? msg.state?.sides ?? msg.preview?.sides);
      if (msg.t === 'lobby') {
        duel ??= duelLobbyUI(c, send);
        duel.update(msg);
        return;
      }
      duel = null;
      if (msg.t === 'countdown') {
        match ??= countdownUI(c);
        match.update(msg);
        return;
      }
      match?.destroy();
      match = null;
      if (msg.preview) {
        prep ??= previewUI(c, (picks) => send({ t: 'pick', picks }), (picks) => send({ t: 'choosing', picks }));
        prep.update(msg);
        return;
      }
      if (!msg.state) return;
      if (prep) {
        prep.destroy();
        prep = null;
      }
      if (!battle) {
        battle = battleUI(c, (action) => ws?.readyState === 1 && ws.send(JSON.stringify({ t: 'act', action })), (turn) => send({ t: 'seen', turn }), chat, bar, () => send({ t: 'surrender' }));
        music.play(`scene:${sceneFor(c.id).file}`);
      }
      battle.push(msg);
    };
    ws.onclose = () => {
      if (closed) return;
      retry += 1;
      setTimeout(connect, Math.min(8000, 500 * 2 ** retry));
    };
  }
  function reconnect() {
    const old = ws;
    ws = null;
    if (old) {
      old.onclose = null;
      old.close();
    }
    connect();
  }

  if (c.status === 'finished') {
    const you = me ? c.final.sides.findIndex((s) => s.trainerId === me.id) : -1;
    bar.update(you === -1 ? null : you, c.final.sides);
    battle = battleUI(c, () => {}, undefined, null, bar);
    music.play(`scene:${sceneFor(c.id).file}`);
    battle.push({ state: c.final, you: you === -1 ? null : you, actions: [], deadline: null });
    return;
  }

  if (c.status === 'open') renderLobby(c, { onAccepted: reconnect });
  connect();
}

function roomClosedBanner(c, mine) {
  $app.replaceChildren(
    h(
      'div',
      { class: 'card banner' },
      h('h2', null, 'Sala cerrada'),
      h('p', { class: 'muted' }, mine ? 'Cerraste esta sala o entraste a otra pelea.' : `${c.host.name} cerró la sala antes de que alguien entrara.`),
      h('a', { class: 'btn primary', href: '/', 'data-link': true }, mine ? 'Ir al inicio' : 'Buscar otra sala'),
    ),
  );
}

function renderLobby(c, { onAccepted }) {
  const mine = me && c.host.id === me.id;
  const open = c.visibility === 'public';
  const link = `${location.origin}/b/${c.id}`;
  const random = c.mode === 'random';
  const modeNote = [
    h('span', { class: 'chip' }, `${MODE_ICON[c.mode] ?? MODE_ICON.team} ${MODE_LABEL[c.mode] ?? MODE_LABEL.team}`),
  ];
  const diceTeam = (n) => h('div', { class: 'mini-team' }, Array.from({ length: n }, (_, i) => h('div', { class: 'mon mon-hidden', 'aria-label': 'Pokémon por sortear' }, h('span', { class: 'badge' }, i + 1), h('div', { class: 'die idle' }, DIE_FACES[i % DIE_FACES.length]), h('div', { class: 'nm' }, '???'))));
  const randomHint = h('p', { class: 'muted small' }, `Cuando los dos estén listos, los dados sortean ${PARTY_SIZE} Pokémon de la colección de cada uno, sin repetir, con movimientos y habilidad al azar.`);

  if (mine) {
    const input = h('input', { type: 'text', readonly: true, value: link, 'aria-label': 'Link de la sala', onfocus: (e) => e.target.select() });
    $app.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h('h1', { class: 'with-avatar' }, avatarPic(c.host.avatar, 'lg', c.host.frame), open ? '🌐 Tu sala está abierta' : '🔒 Tu sala privada está lista'),
        h('p', { class: 'muted' }, open ? 'Aparece en Salas abiertas del inicio y el primero que entre pelea contigo. También puedes mandar el link. Deja esta página abierta: si la cierras, la sala deja de aparecer.' : 'No aparece en Salas abiertas: mándale este link a quien quieras desafiar. La pelea parte apenas entre; deja esta página abierta para jugar en vivo.'),
        h('div', { class: 'share' }, input, h('button', { class: 'btn primary', onclick: () => copy(link, 'Link copiado, ¡a provocar!') }, 'Copiar')),
        h('div', { class: 'row', style: null }, modeNote, h('span', { class: 'muted pulse' }, '⏳ Esperando rival…')),
      ),
      random
        ? h('section', { class: 'card' }, h('h2', null, 'Tu equipo saldrá de los dados'), diceTeam(c.hostTeamSize), randomHint)
        : h('section', { class: 'card' }, h('h2', null, 'Tu equipo para esta pelea'), h('div', { class: 'mini-team' }, c.hostTeam.map((f, i) => monCard(f, { badge: i + 1, stats: true, rarity: false })))),
      h('section', null, h('button', {
        class: 'btn danger',
        onclick: async () => {
          try {
            await api(`/api/challenges/${c.id}`, { method: 'DELETE' });
            nav('/');
          } catch (e) {
            toast(e.message);
          }
        },
      }, 'Cerrar sala')),
    );
    return;
  }

  const accept = async (btn) => {
    btn.disabled = true;
    try {
      await api(`/api/challenges/${c.id}/accept`, { method: 'POST' });
      onAccepted();
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
    }
  };

  const myTeam = () => {
    const byId = new Map(me.roster.map((f) => [f.uid, f]));
    return me.team.map((id) => byId.get(id)).filter(Boolean);
  };
  const right = me && random
    ? h(
        'div',
        { class: 'card' },
        h('h2', null, 'Tu equipo saldrá de los dados'),
        diceTeam(Math.min(PARTY_SIZE, me.rosterSize)),
        randomHint,
        h('button', { class: 'btn primary', onclick: (e) => accept(e.currentTarget) }, '🎲 Aceptar y lanzar los dados'),
      )
    : me
    ? h(
        'div',
        { class: 'card' },
        h('h2', null, 'Tu equipo'),
        h('div', { class: 'mini-team' }, myTeam().map((f, i) => monCard(f, { badge: i + 1, stats: true, rarity: false }))),
        h('p', { class: 'muted small' }, '¿Otro equipo? ', h('a', { href: '/', target: '_blank', rel: 'noopener' }, 'Cámbialo en otra pestaña'), ' y recarga esta.'),
        h('button', { class: 'btn primary', onclick: (e) => accept(e.currentTarget) }, open ? '⚔︎ Entrar a la sala' : '⚔︎ Aceptar desafío'),
      )
    : importCard({ onDone: () => renderLobby(c, { onAccepted }) });

  $app.replaceChildren(
    h('section', null, h('h1', { class: 'with-avatar' }, avatarPic(c.host.avatar, 'lg', c.host.frame), open ? `Sala de ${c.host.name}` : `${c.host.name} te desafía`), h('div', { class: 'row' }, modeNote, h('span', { class: 'muted' }, 'Pelea en vivo por turnos. Si alguien no elige en 60 s, su Pokémon ataca solo.'))),
    h(
      'section',
      { class: 'vs' },
      h(
        'div',
        { class: 'card' },
        h('h2', null, `Equipo de ${c.host.name}`),
        random
          ? [diceTeam(c.hostTeamSize), h('p', { class: 'muted small' }, 'Nadie sabe qué le tocará hasta que rueden los dados.')]
          : c.hostTeam.length
          ? h('div', { class: 'mini-team' }, c.hostTeam.map((f, i) => monCard(f, { badge: i + 1, stats: true, rarity: false })))
          : [
              h('div', { class: 'mini-team' }, Array.from({ length: c.hostTeamSize ?? 3 }, (_, i) => h('div', { class: 'mon mon-hidden', 'aria-label': 'Pokémon oculto' }, h('span', { class: 'badge' }, i + 1), h('div', { class: 'ball' }), h('div', { class: 'nm' }, '???')))),
              h('p', { class: 'muted small' }, 'No sabrás qué Pokémon trae hasta que los saque al combate.'),
            ],
      ),
      h('div', { class: 'vs-mark' }, 'VS'),
      right,
    ),
  );
}

function confettiOn(host) {
  const colors = ['#ffcf4a', '#ff7a9c', '#5ec8ff', '#4fd18b', '#b45ae0', '#ffffff'];
  host.classList.add('has-confetti');
  for (let i = 0; i < 60; i++) {
    const bit = h('i', { class: 'confetti', style: { left: `${Math.random() * 100}%`, background: colors[i % colors.length] } });
    host.append(bit);
    bit.animate([{ transform: 'translateY(-10%) rotate(0deg)', opacity: 1 }, { transform: `translateY(${host.clientHeight * 1.2 + 40}px) rotate(${360 + Math.random() * 540}deg)`, opacity: 0 }], { duration: 1800 + Math.random() * 1400, delay: Math.random() * 600, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
  }
}

const AI_COLORS = { 'crubio ai': '#ef476f', 'andy ai': '#f78c6b', 'bryan ai': '#e9b949', 'esteban ai': '#06d6a0', 'ferlo ai': '#118ab2', 'gon ai': '#8338ec', 'joa ai': '#ff006e', 'nacho juan ai': '#3a86ff', 'nico santi ai': '#fb5607', 'nora ai': '#8ac926', 'valde ai': '#1982c4', 'mirror ai': '#9b5de5', 'tom ai': '#e76f51', 'yuwen ai': '#2a9d8f', 'alvaro ai': '#c77dff' };
const aiBase = (name) => name.replace(/ - [^-]+$/, '');
function aiColor(name) {
  const base = aiBase(name);
  if (AI_COLORS[base]) return AI_COLORS[base];
  let n = 0;
  for (const ch of base) n = (n * 31 + ch.charCodeAt(0)) >>> 0;
  return `hsl(${n % 360} 70% 55%)`;
}

const avatar = (p) => (p.avatar
  ? avatarPic(p.avatar, 'seat', p.frame)
  : h('div', { class: `match-avatar${p.ai ? ' is-ai' : ''}`, 'aria-hidden': 'true', style: p.ai ? { background: aiColor(p.name) } : null }, p.ai ? '🤖' : (p.name.trim()[0] ?? '?').toUpperCase()));

function seatCard(p, { you = false, host = false, onRemove = null } = {}) {
  const status = p.ready ? h('span', { class: 'seat-state ok' }, '✅ Listo') : h('span', { class: 'seat-state' }, '⏳ Esperando');
  return h(
    'div',
    { class: `seat${you ? ' is-you' : ''}${p.ready ? ' is-ready' : ''}${p.online === false ? ' is-away' : ''}` },
    avatar(p),
    h('div', { class: 'seat-body' }, h('span', { class: 'seat-name' }, trainerName(p.name, {}, p.avatar), host ? h('span', { 'data-tip': 'Dueño de la sala' }, '👑') : null, you ? h('span', { class: 'chip match-you' }, 'Tú') : null), h('span', { class: 'seat-meta' }, p.ai ? null : record(p), status), p.online === false ? h('span', { class: 'muted small' }, 'Desconectado') : null),
    onRemove ? h('button', { class: 'btn sm ghost seat-x', type: 'button', 'aria-label': `Quitar a ${trainerShort(p.name)}`, 'data-tip': 'Quitar', onclick: (e) => { e.currentTarget.disabled = true; onRemove(); } }, '✕') : null,
  );
}

function readyButton(ready, onToggle) {
  return h('button', { class: `btn ${ready ? '' : 'primary'} ready-btn`, 'aria-pressed': String(ready), onclick: (e) => { e.currentTarget.disabled = true; onToggle(!ready); } }, ready ? 'Ya no estoy listo' : '✋ ¡Estoy listo!');
}

/** Watches a room's frames and alerts the player when the game is waiting on them. */
function roomAlerts(c) {
  let open = c.status === 'open';
  let waitingOnYou = false;
  let times = 0;
  const rivalOf = (sides, you) => sides?.find((_, i) => i !== you)?.name ?? 'Tu rival';
  return {
    check(msg) {
      const you = msg.you ?? null;
      if (msg.t !== 'lobby') waitingOnYou = false;
      if (you === null) return;
      if (msg.t === 'lobby') {
        const rival = rivalOf(msg.players, you);
        if (open && you === 0) notifier.notify(`full:${c.id}:${++times}`, '¡Tu sala se llenó!', `${rival} entró a tu sala. Aprieta «¡Estoy listo!» para empezar.`);
        open = false;
        const othersReady = msg.players.every((p, i) => i === you || p.ready);
        const onlyYou = !msg.players[you].ready && othersReady;
        if (onlyYou && !waitingOnYou) notifier.notify(`ready:${c.id}:${++times}`, 'Solo faltas tú', `${rival} está listo. Aprieta «¡Estoy listo!» para que parta la pelea.`);
        waitingOnYou = onlyYou;
        return;
      }
      if (msg.preview && !msg.preview.sides[you]?.ready) {
        notifier.notify(`pick:${c.id}`, '¡Elige tu equipo!', `Tu pelea contra ${rivalOf(msg.preview.sides, you)} está por empezar.`);
        return;
      }
      const st = msg.state;
      if (!st || st.status !== 'active' || !msg.actions?.length || msg.forced) return;
      const mustSwitch = !!st.sides[you]?.mustSwitch;
      notifier.notify(`turn:${c.id}:${st.turn}:${mustSwitch}`, mustSwitch ? '¡Elige quién entra!' : '¡Te toca!', `Turno ${st.turn} contra ${rivalOf(st.sides, you)}.`);
    },
  };
}

function duelLobbyUI(c, send) {
  const root = h('section', { class: 'card match duel-lobby' });
  return {
    update(msg) {
      const you = msg.you;
      const mine = you !== null;
      const others = msg.players.filter((_, i) => i !== you);
      const pending = msg.players.filter((p) => !p.ready);
      const youPending = mine && !msg.players[you].ready;
      const otherPending = pending.filter((p) => msg.players.indexOf(p) !== you).map((p) => p.name);
      const waitingText = !pending.length ? null : youPending && otherPending.length ? 'Faltan los dos.' : youPending ? 'Falta que tú aprietes «¡Estoy listo!».' : `Esperando a ${otherPending.join(' y ')}…`;
      root.replaceChildren(...[
        h('h1', null, mine ? '¡Sala completa!' : 'Sala llena'),
        h('p', { class: 'muted' }, mine ? 'Cuando los dos aprieten «¡Estoy listo!» parte la cuenta regresiva.' : `${msg.players[0].name} y ${msg.players[1].name} se están preparando. Puedes quedarte mirando.`),
        h('div', { class: 'seats seats-2' }, msg.players.map((p, i) => seatCard(p, { you: i === you, host: i === 0 }))),
        waitingText ? h('p', { class: 'match-caption' }, waitingText) : null,
        mine
          ? h('div', { class: 'row center' }, readyButton(msg.players[you].ready, (ready) => send({ t: 'set-ready', ready })), you === 0
            ? h('button', { class: 'btn danger', onclick: async () => { try { await api(`/api/challenges/${c.id}`, { method: 'DELETE' }); nav('/'); } catch (e) { toast(e.message); } } }, 'Cerrar sala')
            : h('button', { class: 'btn', onclick: () => { send({ t: 'leave' }); nav('/'); } }, 'Salir de la sala'))
          : null,
        others.some((p) => p.online === false) && mine ? h('p', { class: 'muted small' }, 'Tu rival se desconectó. Si no vuelve en 30 s, la sala se libera.') : null,
      ].filter(Boolean));
      if (!root.isConnected) $app.replaceChildren(root);
    },
  };
}

function watchControl(request) {
  const el = h('span', { class: 'watch-control' });
  let open = false;
  let asked = false;
  const paint = () => el.replaceChildren(open
    ? h('span', { class: 'chip watch-on', 'data-tip': 'Tu pelea aparece en Juegos en vivo' }, '👁 Espectadores habilitados')
    : h('button', { type: 'button', class: 'btn sm ghost watch-btn', disabled: asked || null, 'data-tip': 'Deja que tu pelea aparezca en Juegos en vivo para que otros entren a mirar', onclick: () => { asked = true; paint(); request(); } }, '👁 Habilitar espectadores'));
  paint();
  return {
    el,
    set(next) {
      open = next;
      asked = false;
      paint();
    },
  };
}

function roomBar(c, requestWatchers) {
  const watch = watchControl(requestWatchers);
  const el = h('div', { class: 'room-bar', hidden: true });
  const header = document.querySelector('header.top');
  const menuBtn = h('button', { class: 'menu-btn', type: 'button', 'aria-label': 'Menú', 'aria-expanded': 'false', onclick: () => setMenu(!document.body.classList.contains('menu-open')) }, '☰');
  let status = null;
  let last = null;
  const setMenu = (open) => {
    document.body.classList.toggle('menu-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
  };
  const onClick = (e) => {
    if (!document.body.classList.contains('menu-open') || menuBtn.contains(e.target)) return;
    if (!header.contains(e.target) || e.target.closest('a[href]')) setMenu(false);
  };
  const onKey = (e) => e.key === 'Escape' && setMenu(false);
  document.addEventListener('click', onClick);
  document.addEventListener('keydown', onKey);
  $app.before(el);
  function render() {
    if (!last) return;
    const { you, names } = last;
    const watching = you === null;
    document.body.dataset.watching = String(watching);
    const byOf = (i) => ((watching ? i === 0 : i === you) ? 'me' : 'foe');
    const vs = !status && names?.length === 2 ? h('span', { class: 'vs-line' }, playerPill(names[0], byOf(0), you === 0), h('span', { class: 'muted' }, 'vs'), playerPill(names[1], byOf(1), you === 1)) : null;
    const tour = c.tournament;
    el.hidden = false;
    document.body.classList.add('in-room');
    const windowSkin = !watching && me?.shop?.equipped?.window;
    el.className = `room-bar ${watching ? 'is-watching' : 'is-playing'}${status ? ' is-battle' : ''}${windowSkin ? ` win-bar win-${windowSkin}` : ''}`;
    el.replaceChildren(
      menuBtn,
      h('span', { class: 'room-bar-tag' }, watching ? '👁 Estás mirando' : '⚔︎ Tu pelea'),
      ...(status ? [status.turn, status.vs] : []),
      h('span', { class: 'room-bar-text' }, tour ? `🏆 ${tour.round} · Pelea ${tour.number} de ${tour.total}` : null, tour && vs ? ' · ' : null, vs),
      ...(status ? [status.field, status.timer, status.forfeit] : []),
      ...(tour ? [h('a', { class: 'btn sm', href: `/t/${tour.id}`, 'data-link': true }, 'Ver llaves')] : []),
      watching ? null : watch.el,
    );
  }
  return {
    setWatch(open) {
      watch.set(open);
    },
    update(you, names = null) {
      last = { you, names };
      render();
    },
    setStatus(parts) {
      status = parts;
      render();
    },
    destroy() {
      el.remove();
      setMenu(false);
      document.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('in-room');
      delete document.body.dataset.watching;
    },
  };
}

function tournamentFeed(id, onFrame, chat = null, onWatch = null) {
  let ws = null;
  let closed = false;
  let retry = 0;
  function connect() {
    if (closed) return;
    ws = new WebSocket(wsURL());
    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({ t: 'tour', id, token }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === 'tour') onFrame(msg.tournament);
      else if (msg.t === 'watch') onWatch?.(msg.open);
      else if (msg.t === 'chatLog') chat?.load(msg.messages);
      else if (msg.t === 'chat') chat?.add(msg.message);
      else if (msg.t === 'error') toast(msg.error);
    };
    ws.onclose = () => {
      if (closed) return;
      retry += 1;
      setTimeout(connect, Math.min(8000, 500 * 2 ** retry));
    };
  }
  connect();
  const stop = () => {
    closed = true;
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  };
  stop.send = (msg) => ws?.readyState === 1 && ws.send(JSON.stringify(msg));
  return stop;
}

const RESULT_HOLD_MS = 4500;
let cameFromMatch = null;

function followTournament(c, seq, getBattle) {
  let prev = null;
  let leaving = false;
  const leave = async (T) => {
    if (leaving) return;
    leaving = true;
    const b = getBattle();
    if (b) await Promise.race([b.resultShown(), sleep(120_000)]);
    await sleep(RESULT_HOLD_MS);
    if (stale(seq)) return;
    cameFromMatch = { tournamentId: T.id, challengeId: c.id };
    smoothNav(`/t/${T.id}`);
  };
  return tournamentFeed(c.tournament.id, (T) => {
    const cur = T.current?.challengeId ?? null;
    const was = prev;
    prev = { cur, status: T.status };
    if (!was || stale(seq)) return;
    if (was.cur === c.id && cur !== c.id) return void leave(T);
    if (cur && cur !== c.id && cur !== was.cur && !leaving) smoothNav(`/b/${cur}`);
  });
}

async function tournamentPage(id, seq) {
  await loadMe();
  if (stale(seq)) return;
  renderWho();
  let T;
  try {
    T = (await api(`/api/tournaments/${id}`)).tournament;
  } catch (e) {
    if (stale(seq)) return;
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'No encontré ese torneo'), h('p', { class: 'muted' }, e.message), h('a', { class: 'btn', href: '/', 'data-link': true }, 'Ir al inicio')));
    return;
  }
  if (stale(seq)) return;
  document.title = `Torneo de ${T.size} · Token Clash`;
  const arrived = cameFromMatch?.tournamentId === id ? cameFromMatch : null;
  cameFromMatch = null;
  const ui = tournamentUI(id, arrived?.challengeId ?? null);
  let lastCurrent = arrived ? null : T.current?.challengeId ?? null;
  const shownAt = Date.now();
  let timer = null;
  const follow = (cur) => {
    clearTimeout(timer);
    timer = setTimeout(() => !stale(seq) && smoothNav(`/b/${cur}`), Math.max(0, (arrived ? shownAt + BRACKET_HOLD_MS : 0) - Date.now(), ui.busyUntil() - Date.now()));
  };
  ui.update(T);
  const chat = chatPanel((msg) => stop.send(msg));
  const dock = chatDock(chat);
  const alerts = tournamentAlerts(T);
  const stop = tournamentFeed(id, (next) => {
    if (stale(seq)) return;
    const cur = next.current?.challengeId ?? null;
    alerts.check(next);
    ui.update(next);
    if (cur && cur !== lastCurrent) follow(cur);
    lastCurrent = cur;
  }, chat, (open) => ui.setWatch(open));
  ui.onWatchRequest(() => stop.send({ t: 'watch' }));
  cleanup = () => {
    clearTimeout(timer);
    stop();
    dock.destroy();
    ui.destroy();
  };
}

/** Alerts a seated player when the tournament lobby fills up and when everyone but them is ready. */
function tournamentAlerts(initial) {
  const full = (T) => T.seats.length === T.size;
  let wasFull = full(initial);
  let waitingOnYou = false;
  let times = 0;
  return {
    check(T) {
      const seated = T.status === 'open' && T.you !== null && T.you !== undefined;
      const isFull = full(T);
      if (seated && isFull && !wasFull) notifier.notify(`tour-full:${T.id}:${++times}`, '¡Tu torneo se llenó!', `Los ${T.size} asientos están ocupados. Aprieta «¡Estoy listo!» para empezar.`);
      wasFull = isFull;
      const onlyYou = seated && isFull && !T.seats[T.you].ready && T.seats.every((s, i) => i === T.you || s.ready);
      if (onlyYou && !waitingOnYou) notifier.notify(`tour-ready:${T.id}:${++times}`, 'Solo faltas tú', 'Todos en el torneo están listos. Aprieta «¡Estoy listo!» para que parta.');
      waitingOnYou = onlyYou;
    },
  };
}

const BRACKET_HOLD_MS = 4000;
const DRAW_SPIN_MS = 1200;
const DRAW_STEP_MS = 220;

function tournamentUI(id, justPlayed = null) {
  let T = null;
  let celebrated = false;
  let partied = false;
  let drawingUntil = 0;
  const timers = [];
  let painted = '';
  const celebrateUntil = Date.now() + BRACKET_HOLD_MS;
  let offset = 0;
  let drew = false;
  let tick = null;
  let aiChoice = 'mid';
  let requestWatch = null;
  const watch = watchControl(() => requestWatch?.());
  const act = async (path, opts = {}, after = null) => {
    try {
      await api(`/api/tournaments/${id}${path}`, { method: 'POST', ...opts });
      after?.();
    } catch (e) {
      toast(e.message);
      paint();
    }
  };
  const nowServer = () => Date.now() + offset;
  const seatName = (i) => (i === null || i === undefined ? null : T.seats[i]?.name);

  function header() {
    const status = { open: 'Esperando jugadores', running: 'En juego', finished: 'Terminado', cancelled: 'Cerrado', abandoned: 'Cortado' }[T.status];
    return h(
      'section',
      { class: 'tour-head' },
      h('div', { class: 'row between' }, h('h1', null, `🏆 Torneo de ${T.size}`), T.you !== null && T.status !== 'finished' ? watch.el : null),
      h('div', { class: 'row' }, h('span', { class: 'chip' }, `${MODE_ICON[T.mode]} ${MODE_LABEL[T.mode]}`), h('span', { class: 'chip' }, T.visibility === 'public' ? '🌐 Público' : '🔒 Privado'), h('span', { class: `chip${T.status === 'running' ? ' pulse' : ''}` }, status)),
    );
  }

  function lobby() {
    const link = `${location.origin}/t/${T.id}`;
    const seated = T.you !== null;
    const free = T.size - T.seats.length;
    const readyCount = T.seats.filter((s) => s.ready).length;
    const levelSel = h('select', { class: 'ai-level', 'aria-label': 'Dificultad de la IA', onchange: (e) => (aiChoice = e.target.value) }, T.aiLevels.map((k) => h('option', { value: k, selected: k === aiChoice ? true : null }, AI_LABEL[k])));
    const addAi = (count) => act('/ai', { body: { level: levelSel.value, count } });
    const slots = Array.from({ length: T.size }, (_, i) => {
      const p = T.seats[i];
      if (p) return seatCard(p, { you: i === T.you, host: i === 0, onRemove: T.host && i > 0 ? () => act(`/seats/${i}`, { method: 'DELETE' }) : null });
      return h('div', { class: 'seat is-free' }, h('div', { class: 'match-avatar is-free', 'aria-hidden': 'true' }, '?'), h('div', { class: 'seat-body' }, h('b', null, 'Asiento libre'), h('span', { class: 'muted small' }, 'Esperando jugador')), T.host ? h('button', { class: 'btn sm', type: 'button', onclick: () => addAi(1) }, '+ IA') : null);
    });
    const missing = free ? `Faltan ${free} ${free === 1 ? 'jugador' : 'jugadores'}` : `${readyCount} de ${T.size} listos`;
    return [
      h(
        'section',
        { class: 'card' },
        h('div', { class: 'nb-head' }, h('h2', null, 'Sala del torneo'), h('p', { class: 'muted small' }, `${T.seats.length}/${T.size} jugadores · ${missing}`)),
        h('p', { class: 'muted' }, 'El torneo parte cuando la sala está llena y todos aprietan «¡Estoy listo!». Las IAs siempre están listas.'),
        h('div', { class: 'share' }, h('input', { type: 'text', readonly: true, value: link, 'aria-label': 'Link del torneo', onfocus: (e) => e.target.select() }), h('button', { class: 'btn primary', onclick: () => copy(link, 'Link del torneo copiado') }, 'Copiar')),
        T.host
          ? h('div', { class: 'host-tools' }, h('span', { class: 'nb-label' }, 'Rellenar con IA'), levelSel, h('button', { class: 'btn sm', disabled: !free, onclick: () => addAi(1) }, '+ 1 IA'), h('button', { class: 'btn sm', disabled: !free, onclick: () => addAi(free) }, `Llenar ${free || ''} asientos`.trim()))
          : null,
        h('div', { class: `seats seats-${T.size}` }, slots),
        h(
          'div',
          { class: 'row center tour-actions' },
          seated ? readyButton(T.seats[T.you].ready, (ready) => act('/ready', { body: { ready } })) : me ? h('button', { class: 'btn primary', disabled: !free, onclick: () => act('/join') }, free ? '⚔︎ Entrar al torneo' : 'Torneo lleno') : null,
          T.host ? h('button', { class: 'btn danger', onclick: () => act('', { method: 'DELETE' }, () => nav('/')) }, 'Cerrar torneo') : seated ? h('button', { class: 'btn', onclick: () => act('/leave', {}, () => nav('/')) }, 'Salir del torneo') : null,
        ),
      ),
      me ? null : h('section', null, importCard({ onDone: () => route() })),
    ];
  }

  function seedOf(i) {
    const pos = T.rounds[0]?.matches.flatMap((m) => [m.a, m.b]).indexOf(i);
    return pos === undefined || pos === -1 ? null : pos + 1;
  }

  function slot(i, m, side, round, hide = false) {
    if (hide) return h('div', { class: 'bk-slot is-drawing', 'data-round': round, 'data-side': side }, h('span', { class: 'bk-seed' }, ''), h('span', { class: 'bk-av is-empty', 'aria-hidden': 'true' }, '?'), h('span', { class: 'bk-who' }, h('span', { class: 'bk-name' }, '…'), h('small', { class: 'bk-sub' }, 'Sorteando')), h('span', { class: 'bk-mark' }));
    const seat = i === null ? null : T.seats[i];
    const done = m.winner !== null;
    const won = done && m.winner === i;
    const cls = ['bk-slot', seat ? '' : 'is-tbd', seat && i === T.you ? 'is-you' : '', won ? 'won' : '', done && !won ? 'lost' : ''].filter(Boolean).join(' ');
    const sub = !seat ? 'Espera ganador' : seat.ai ? `🤖 ${capitalize(trainerTitle(seat.name) ?? AI_LABEL[seat.ai] ?? 'IA')}` : seat.avatar ? skinTitle(seat.avatar, 'span') : `${seat.wins}V ${seat.losses}D`;
    return h(
      'div',
      { class: cls, 'data-round': round, 'data-side': side },
      h('span', { class: 'bk-seed' }, seat ? seedOf(i) : ''),
      seat?.avatar ? h('span', { class: 'bk-av has-sprite', 'aria-hidden': 'true' }, avatarPic(seat.avatar, 'sm', seat.frame)) : h('span', { class: `bk-av${seat?.ai ? ' is-ai' : ''}${!seat ? ' is-empty' : ''}`, 'aria-hidden': 'true', style: seat?.ai ? { background: aiColor(seat.name) } : null }, !seat ? '?' : seat.ai ? '🤖' : (seat.name.trim()[0] ?? '?').toUpperCase()),
      h('span', { class: 'bk-who', title: seat?.name ?? null }, h('span', { class: `bk-name${seat && nameSize(seat.name) ? ` ${nameSize(seat.name)}` : ''}` }, seat ? (trainerShort(seat.name)) : 'Por definir'), h('small', { class: 'bk-sub' }, sub)),
      h('span', { class: 'bk-mark', 'aria-label': won ? 'Ganó' : done && seat ? 'Perdió' : null }, won ? (m.coinFlip ? h('span', { 'data-tip': 'Empate: avanzó por sorteo' }, '🪙') : '✔') : done && seat ? '✕' : ''),
    );
  }

  function bracket(drawing = false) {
    const champion = T.champion !== null ? T.seats[T.champion] : null;
    const final = T.rounds.at(-1)?.matches[0];
    const runnerUp = final && final.winner !== null ? T.seats[final.winner === final.a ? final.b : final.a] : null;
    const upcoming = T.current ? null : T.rounds.flatMap((round, r) => round.matches.map((m, i) => ({ m, r, i }))).find(({ m }) => m.winner === null && m.a !== null && m.b !== null);
    const last = T.rounds.length - 1;
    const cols = T.rounds.map((round, r) => {
      const played = round.matches.filter((m) => m.winner !== null).length;
      const state = played === round.matches.length ? 'done' : T.current?.round === r || upcoming?.r === r ? 'now' : 'later';
      return h(
        'div',
        { class: `bk-col is-${state}` },
        h('div', { class: 'bk-round' }, h('b', null, round.name), h('small', null, `${played}/${round.matches.length} jugadas`)),
        h('div', { class: 'bk-matches' }, round.matches.map((m, i) => {
          const live = T.current && T.current.round === r && T.current.index === i;
          const next = upcoming && upcoming.r === r && upcoming.i === i;
          const hide = drawing && r === 0;
          const mineMatch = !hide && T.you !== null && (m.a === T.you || m.b === T.you);
          const yourPath = m.winner !== null && m.winner === T.you;
          const number = T.rounds.slice(0, r).reduce((n, x) => n + x.matches.length, 0) + i + 1;
          const status = live
            ? h('a', { class: 'bk-status is-live', href: `/b/${m.challengeId}`, 'data-link': true }, h('i', { class: 'bk-dot' }), mineMatch ? 'Entrar' : 'Mirar')
            : m.winner !== null
            ? h('a', { class: 'bk-status is-done', href: `/b/${m.challengeId}`, 'data-link': true }, 'Ver pelea')
            : next
            ? h('span', { class: 'bk-status is-next' }, 'Próxima')
            : h('span', { class: 'bk-status' }, hide ? 'Sorteando' : m.a !== null && m.b !== null ? 'En espera' : '—');
          return h(
            'div',
            { class: ['bk-cell', r === last ? 'is-solo' : i % 2 ? 'is-bottom' : 'is-top', m.winner !== null ? 'is-decided' : '', yourPath ? 'is-your-path' : ''].filter(Boolean).join(' ') },
            h(
              'div',
              { class: ['bk-match', live ? 'is-live' : '', next ? 'is-next' : '', mineMatch ? 'is-mine' : '', m.winner !== null ? 'is-done' : ''].filter(Boolean).join(' ') },
              h('div', { class: 'bk-head' }, h('span', null, `Pelea ${number}`), status),
              slot(m.a, m, 'a', r, hide),
              slot(m.b, m, 'b', r, hide),
            ),
          );
        })),
      );
    });
    cols.push(
      h(
        'div',
        { class: 'bk-col bk-champ' },
        h('div', { class: 'bk-round' }, h('b', null, 'Campeón'), h('small', null, champion ? '¡Terminado!' : 'Por decidir')),
        h(
          'div',
          { class: 'bk-matches' },
          h(
            'div',
            { class: `bk-cell is-solo${champion ? ' is-decided' : ''}` },
            h(
              'div',
              { class: `bk-trophy${champion ? ' has-champ' : ''}${T.champion !== null && T.champion === T.you ? ' is-you' : ''}` },
              h('span', { class: 'bk-cup', 'aria-hidden': 'true' }, '🏆'),
              champion ? h('span', { class: `bk-av big${champion.ai ? ' is-ai' : ''}`, 'aria-hidden': 'true', style: champion.ai ? { background: aiColor(champion.name) } : null }, champion.ai ? '🤖' : (champion.name.trim()[0] ?? '?').toUpperCase()) : null,
              h('b', { class: 'bk-champ-name' }, champion?.name ?? '¿Quién será?'),
              runnerUp ? h('small', { class: 'muted' }, `🥈 ${trainerShort(runnerUp.name)}`) : h('small', { class: 'muted' }, `${T.size} jugadores · ${T.total} peleas`),
            ),
          ),
        ),
      ),
    );
    const progress = h(
      'div',
      { class: 'bk-top' },
      h('div', { class: 'bk-progress', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': T.total, 'aria-valuenow': T.played }, h('i', { style: { width: `${(T.played / T.total) * 100}%` } })),
      h('span', { class: 'muted small' }, `${T.played} de ${T.total} peleas`),
      h('span', { class: 'bk-legend' }, h('span', null, h('i', { class: 'bk-dot' }), 'En vivo'), h('span', { class: 'lg-win' }, '✔ Avanza'), T.you !== null ? h('span', { class: 'lg-you' }, '★ Tu camino') : null, h('span', null, '🤖 IA')),
    );
    return h('div', { class: 'bracket-box' }, progress, h('div', { class: 'bracket-wrap' }, h('div', { class: `bracket rounds-${T.rounds.length} size-${T.size}` }, cols)));
  }

  function liveCard() {
    const left = T.nextAt ? Math.max(0, Math.ceil((T.nextAt - nowServer()) / 1000)) : null;
    if (T.status === 'finished') {
      const champ = T.seats[T.champion];
      return h('section', { class: 'card tour-live is-champ' }, h('h2', null, T.champion === T.you ? '🏆 ¡Ganaste el torneo!' : `🏆 ¡${trainerShort(champ.name)} gana el torneo!`), h('p', { class: 'muted' }, `${T.total} peleas jugadas.`), h('a', { class: 'btn primary', href: '/', 'data-link': true }, 'Volver al inicio'));
    }
    if (T.current) {
      const m = T.rounds[T.current.round].matches[T.current.index];
      const mine = T.you !== null && (m.a === T.you || m.b === T.you);
      return h('section', { class: `card tour-live${mine ? ' is-mine' : ''}` }, h('div', null, h('span', { class: 'chip pulse' }, '● EN VIVO'), ' ', h('b', null, `${seatName(m.a)} vs ${seatName(m.b)}`), h('span', { class: 'muted small' }, ` · ${T.rounds[T.current.round].name} · Pelea ${T.played + 1} de ${T.total}`)), h('a', { class: 'btn primary', href: `/b/${m.challengeId}`, 'data-link': true }, mine ? '⚔︎ ¡Ir a tu pelea!' : '👁 Mirar la pelea'));
    }
    const drawing = T.drawAt && nowServer() - T.drawAt < 5000;
    if (left !== null) return h('section', { class: 'card tour-live' }, h('b', { class: 'tour-next' }, drawing ? '🎲 Sorteando las llaves…' : `Siguiente pelea en ${left}s`), h('span', { class: 'muted small' }, `${T.played} de ${T.total} peleas jugadas`));
    return null;
  }

  function animateAdvance(root, challengeId, scroll) {
    const r = T.rounds.findIndex((round) => round.matches.some((m) => m.challengeId === challengeId));
    if (r === -1) return;
    const i = T.rounds[r].matches.findIndex((m) => m.challengeId === challengeId);
    const match = root.querySelectorAll('.bk-col')[r]?.querySelectorAll('.bk-match')[i];
    match?.classList.add('just-played');
    const next = r + 1 < T.rounds.length ? root.querySelectorAll('.bk-col')[r + 1]?.querySelectorAll('.bk-match')[Math.floor(i / 2)]?.querySelectorAll('.bk-slot')[i % 2] : root.querySelector('.bk-trophy');
    next?.classList.add('just-advanced');
    const wrap = root.querySelector('.bracket-wrap') ?? root;
    if (scroll && match && wrap.scrollWidth > wrap.clientWidth) wrap.scrollTo({ left: Math.max(0, match.getBoundingClientRect().left - wrap.getBoundingClientRect().left + wrap.scrollLeft - wrap.clientWidth / 2 + match.offsetWidth / 2), behavior: 'smooth' });
  }

  function animateDraw(root) {
    const names = T.seats.map((s) => trainerShort(s.name));
    const order = T.rounds[0].matches.flatMap((m) => [[m.a, m], [m.b, m]]);
    const slots = [...root.querySelectorAll('.bk-slot[data-round="0"]')];
    slots.forEach((el, i) => {
      const label = el.querySelector('.bk-name');
      const spin = setInterval(() => (label.textContent = names[Math.floor(Math.random() * names.length)]), 70);
      timers.push(spin);
      timers.push(setTimeout(() => {
        clearInterval(spin);
        const [seat, m] = order[i];
        const real = slot(seat, m, i % 2 ? 'b' : 'a', 0);
        el.replaceWith(real);
        playClass(real, 'is-landed', 700);
      }, DRAW_SPIN_MS + i * DRAW_STEP_MS));
    });
  }

  function paint() {
    if (!T) return;
    if (T.status === 'cancelled' || T.status === 'abandoned') {
      $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, T.status === 'cancelled' ? 'Torneo cerrado' : 'Este torneo se cortó'), h('p', { class: 'muted' }, T.status === 'cancelled' ? 'El dueño cerró el torneo antes de partir.' : 'El servidor se reinició a mitad del torneo.'), h('a', { class: 'btn primary', href: '/', 'data-link': true }, 'Ir al inicio')));
      return;
    }
    if (T.status === 'open') {
      $app.replaceChildren(header(), ...lobby().filter(Boolean));
      return;
    }
    const startDraw = !drew && T.drawAt && nowServer() - T.drawAt < 4000;
    if (startDraw) {
      drawingUntil = Date.now() + DRAW_SPIN_MS + T.size * DRAW_STEP_MS + 400;
      timers.push(setTimeout(paint, drawingUntil - Date.now()));
    }
    drew = true;
    const board = bracket(Date.now() < drawingUntil);
    const live = liveCard();
    $app.replaceChildren(...[header(), live, h('section', { class: 'card' }, h('h2', null, 'Llaves'), board)].filter(Boolean));
    if (startDraw) animateDraw(board);
    if (justPlayed && Date.now() < celebrateUntil) animateAdvance(board, justPlayed, !celebrated);
    celebrated = true;
    if (T.status === 'finished' && live && !partied) {
      partied = true;
      confettiOn(live);
    }
  }

  return {
    setWatch(open) {
      watch.set(open);
    },
    onWatchRequest(fn) {
      requestWatch = fn;
    },
    update(next) {
      offset = next.serverNow - Date.now();
      const key = JSON.stringify({ ...next, serverNow: 0 });
      if (key === painted) return;
      painted = key;
      T = next;
      if (Date.now() < drawingUntil) return;
      document.body.dataset.watching = String(T.you === null && T.status === 'running');
      paint();
      clearInterval(tick);
      if (T.nextAt) tick = setInterval(() => {
        const el = $app.querySelector('.tour-next');
        if (!el) return;
        const drawing = T.drawAt && nowServer() - T.drawAt < 5000;
        el.textContent = drawing ? '🎲 Sorteando las llaves…' : `Siguiente pelea en ${Math.max(0, Math.ceil((T.nextAt - nowServer()) / 1000))}s`;
      }, 250);
    },
    busyUntil: () => Math.max(drawingUntil, justPlayed ? celebrateUntil : 0),
    destroy() {
      clearInterval(tick);
      timers.forEach((t) => (clearTimeout(t), clearInterval(t)));
      delete document.body.dataset.watching;
    },
  };
}

function countdownUI(c) {
  const number = h('div', { class: 'match-count', 'aria-live': 'assertive' });
  const caption = h('p', { class: 'match-caption' }, 'La preparación parte en…');
  const cards = h('div', { class: 'match-vs' });
  const heading = h('h1', null, '¡Rival encontrado!');
  const late = h('div', { class: 'match-late', hidden: true }, h('p', null, 'Llegaste tarde: otro jugador entró primero a esta sala. Puedes quedarte mirando la pelea o buscar otra.'), h('a', { class: 'btn primary sm', href: '/', 'data-link': true }, 'Buscar otra sala'));
  const root = h(
    'section',
    { class: 'card match' },
    heading,
    late,
    h('div', { class: 'row match-chips' }, h('span', { class: 'chip' }, `${MODE_ICON[c.mode] ?? MODE_ICON.team} ${MODE_LABEL[c.mode] ?? MODE_LABEL.team}`)),
    cards,
    caption,
  );
  const previousTitle = document.title;
  let endsAt = 0;
  let shown = null;
  let timer = null;
  let waiting = null;
  const player = (p, side, you) =>
    h(
      'div',
      { class: `match-player side-${side}${you ? ' is-you' : ''}` },
      avatar(p),
      trainerName(p.name, { class: 'match-name' }, p.avatar),
      you ? h('span', { class: 'chip match-you' }, 'Tú') : null,
      p.ai ? h('span', { class: 'chip' }, '🤖 IA') : record(p),
      p.ai ? null : h('span', { class: 'muted small' }, `📚 ${p.rosterSize} Pokémon · ✨ ${p.shinies} shiny`),
    );
  function tick() {
    if (waiting) {
      number.textContent = '⏳';
      return;
    }
    const left = Math.max(0, endsAt - Date.now());
    const sec = Math.ceil(left / 1000);
    if (sec === shown) return;
    shown = sec;
    number.textContent = sec > 0 ? String(sec) : '¡Ya!';
    document.title = sec > 0 ? `⚔︎ ${sec}… ¡Rival encontrado!` : '⚔︎ ¡A pelear!';
    if (sec === 0) caption.textContent = '¡A pelear!';
    playClass(number, 'tick', 700);
  }
  return {
    update(msg) {
      endsAt = Date.now() + msg.ms;
      const watching = msg.you === null;
      const tour = msg.tournament;
      heading.textContent = tour ? (watching ? `👁 Próxima pelea · ${tour.round}` : `⚔︎ ¡Te toca! · ${tour.round}`) : watching ? 'Sala llena' : '¡Rival encontrado!';
      waiting = msg.waiting?.length ? msg.waiting.map(trainerShort) : null;
      caption.textContent = waiting
        ? `Esperando a ${waiting.length > 2 ? `${waiting.slice(0, 2).join(', ')} y ${waiting.length - 2} más` : waiting.join(' y ')}…`
        : tour ? `Pelea ${tour.number} de ${tour.total} · parte en…` : 'La preparación parte en…';
      late.hidden = !watching || !me || !!tour;
      cards.replaceChildren(player(msg.players[0], 0, msg.you === 0), h('div', { class: 'match-center' }, h('div', { class: 'vs-mark' }, 'VS'), number), player(msg.players[1], 1, msg.you === 1));
      if (!root.isConnected) $app.replaceChildren(root);
      shown = null;
      tick();
      clearInterval(timer);
      timer = setInterval(tick, 100);
    },
    destroy() {
      clearInterval(timer);
      document.title = previousTitle;
    },
  };
}

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ROLL_START_MS = 700;
const ROLL_STEP_MS = 450;
const rolledRooms = new Set();

function preloadFor(you, parties) {
  parties.forEach((party, s) => preloadSprites([...(party ?? []), { sprite: 'substitute' }], { back: s === you }));
}

function matchupOf(f, foes) {
  const attacking = f.moves?.length ? [...new Set(f.moves.filter((m) => m.category !== 'status' && m.power).map((m) => m.type))] : f.types ?? [];
  const strong = foes.filter((o) => attacking.some((t) => effectiveness(t, o.types) >= 2));
  const weak = foes.filter((o) => (o.types ?? []).some((t) => effectiveness(t, f.types) >= 2));
  return { strong, weak, byMoves: !!f.moves?.length };
}

function matchupBadges(f, foes) {
  if (!foes?.length) return null;
  const { strong, weak, byMoves } = matchupOf(f, foes);
  const names = (list) => list.map((o) => o.name).join(', ');
  return h(
    'span',
    { class: 'matchup' },
    h('span', { class: `mu up${strong.length ? '' : ' none'}`, tabindex: 0, 'data-tip': strong.length ? `${byMoves ? 'Sus movimientos' : 'Sus tipos'} pegan súper eficaz a: ${names(strong)}` : 'No tiene ventaja de tipo contra el rival' }, `⚔️ ${strong.length}`),
    h('span', { class: `mu down${weak.length ? '' : ' none'}`, tabindex: 0, 'data-tip': weak.length ? `Lo amenazan por tipo: ${names(weak)}` : 'Ningún rival le pega súper eficaz por tipo' }, `⚠️ ${weak.length}`),
  );
}

function previewUI(c, sendPick, sendDraft = () => {}) {
  let last = null;
  let revealSeen = false;
  let total = 0;
  let picks = [];
  let sent = false;
  let entered = false;
  let rolling = false;
  let rollSides = new Set();
  let revealed = 0;
  let justRevealed = -1;
  const rollTimers = [];
  let dieTick = null;
  const bar = h('i');
  const timerText = h('span', { class: 'timer' });
  const root = h('div', { class: 'prep' });
  const title = h('b', null, '⚔︎ Preparación de batalla');
  $app.replaceChildren(h('div', { class: 'status-line' }, title, timerText), h('div', { class: 'prep-timer' }, bar), root);
  const tick = setInterval(() => {
    if (!last?.deadline) return;
    const left = Math.max(0, last.deadline - Date.now());
    timerText.textContent = `⏱ ${Math.ceil(left / 1000)}s`;
    timerText.classList.toggle('urgent', left <= 10_000);
    bar.style.width = `${total ? Math.min(100, (left / total) * 100) : 100}%`;
  }, 200);

  function startRoll(n) {
    rolling = true;
    revealed = 0;
    root.classList.add('rolling');
    dieTick = setInterval(() => {
      for (const d of root.querySelectorAll('.die.spin')) d.textContent = DIE_FACES[Math.floor(Math.random() * DIE_FACES.length)];
    }, 90);
    for (let i = 0; i < n; i++) {
      rollTimers.push(setTimeout(() => {
        revealed = i + 1;
        justRevealed = i;
        render();
        revealEffects(i);
      }, ROLL_START_MS + i * ROLL_STEP_MS));
    }
    rollTimers.push(setTimeout(() => {
      rolling = false;
      justRevealed = -1;
      clearInterval(dieTick);
      root.classList.remove('rolling');
      rolledRooms.add(c.id);
      render();
    }, ROLL_START_MS + n * ROLL_STEP_MS + 300));
  }

  const dieCard = (i) => h('div', { class: 'prep-card dice-slot', 'aria-label': 'Lanzando dados' }, h('div', { class: 'die spin', style: { animationDelay: `${-i * 110}ms` } }, DIE_FACES[i % DIE_FACES.length]), h('b', null, '???'));
  const rollingOn = (s) => rolling && rollSides.has(s);
  const cardAnim = (s, i) => `${entered || rollingOn(s) ? '' : ' enter'}${rollingOn(s) && i === justRevealed ? ' reveal' : ''}`;
  let view = null;

  function revealEffects(step) {
    const cards = [...root.querySelectorAll('.prep-card.reveal:not([data-revealed])')];
    if (!cards.length) return;
    music.sfx('reveal', { rate: 2 ** ((step * 2) / 12) });
    for (const card of cards) {
      card.dataset.revealed = '1';
      card.querySelector('.creature')?.classList.add('revealed-flash');
    }
  }

  function choose(i, needed) {
    if (sent || rollingOn(last?.you)) return;
    const at = picks.indexOf(i);
    if (at >= 0) picks.splice(at, 1);
    else if (picks.length < needed) {
      picks.push(i);
      const f = last?.preview.sides[last.you]?.party[i];
      if (f) music.sfx('cry', { sprite: f.sprite });
    } else return toast(`Ya elegiste ${needed}: toca uno para sacarlo.`);
    sendDraft(picks.slice());
    render();
  }

  function syncGrid(grid, slots, party, s, make) {
    party.forEach((f, i) => {
      const kind = rollingOn(s) && i >= revealed ? 'die' : 'card';
      if (slots[i]?.kind === kind) return;
      const slot = kind === 'die' ? { kind, el: dieCard(i) } : { kind, ...make(f, i) };
      if (slots[i]) slots[i].el.replaceWith(slot.el);
      else grid.append(slot.el);
      slots[i] = slot;
    });
  }

  function seenCard(f, s, i) {
    const badge = h('span', { class: 'badge', hidden: true });
    const full = !!f.moves;
    const el = h(
      'div',
      { class: `prep-card seen${full ? ' full' : ''}${cardAnim(s, i)}`, style: { animationDelay: `${i * 70}ms` } },
      badge,
      h('div', { html: creatureHTML(f) }),
      h('b', null, f.name, genderMark(f.gender)),
      full ? h('small', { class: 'muted' }, `Nv ${f.level}`) : null,
      typeChips(f.types ?? []),
      full && f.abilityInfo ? abilityChip(f.abilityInfo) : null,
      full ? h('small', { class: 'prep-moves muted' }, f.moves.map((m) => m.name).join(' · ')) : null,
      matchupBadges(f, last.preview.sides[1 - s].party),
    );
    return { el, badge };
  }

  function ownCard(f, i, own, random) {
    const badge = h('span', { class: 'badge', hidden: true });
    const el = h(
      'button',
      { type: 'button', class: `prep-card${cardAnim(last.you, i)}`, style: { animationDelay: entered ? '0ms' : `${i * 70}ms` }, onclick: () => choose(i, own.needed) },
      badge,
      h('div', { html: creatureHTML(f) }),
      h('b', null, f.name, genderMark(f.gender)),
      h('small', { class: 'muted' }, `Nv ${f.level}`),
      typeChips(f.types),
      random && f.abilityInfo ? abilityChip(f.abilityInfo) : null,
      h('small', { class: 'prep-moves muted' }, f.moves.map((m) => m.name).join(' · ')),
      matchupBadges(f, last.preview.sides[1 - last.you].party),
    );
    return { el, badge };
  }

  function sideView(s, title) {
    const v = { s, grid: h('div', { class: 'prep-grid' }), status: h('span'), statusKey: null, slots: [] };
    v.el = h('div', { class: 'card prep-side' }, h('div', { class: 'row between' }, h('h2', { class: 'with-avatar' }, title), v.status), v.grid);
    return v;
  }

  function paintSide(v, side) {
    syncGrid(v.grid, v.slots, side.party, v.s, (f, i) => seenCard(f, v.s, i));
    const shown = side.picks ?? side.locked ?? side.draft ?? null;
    const drafting = !side.picks && !side.locked && !!side.draft;
    v.slots.forEach((slot, i) => {
      if (slot.kind !== 'card' || !slot.badge) return;
      const order = shown ? shown.indexOf(i) : -1;
      slot.el.classList.toggle('chosen', order >= 0 && !drafting);
      slot.el.classList.toggle('drafting', order >= 0 && drafting);
      slot.el.classList.toggle('benched', !!side.picks && order < 0);
      slot.badge.hidden = order < 0;
      slot.badge.textContent = order >= 0 ? String(order + 1) : '';
    });
    const key = rollingOn(v.s) ? 'roll' : side.picks ? 'revealed' : side.ready ? 'ready' : side.draft ? `picking:${side.draft.length}` : 'picking';
    if (key === v.statusKey) return;
    v.statusKey = key;
    v.status.replaceChildren(key === 'roll' ? h('span', { class: 'muted small pulse' }, '🎲 Sorteando…') : key === 'revealed' ? h('span', { class: 'chip ready-chip' }, '👁 Eligió estos 3') : key === 'ready' ? h('span', { class: 'chip ready-chip' }, '✓ Listo') : h('span', { class: 'muted small pulse' }, side.draft ? `Eligiendo… ${side.draft.length}/${side.needed}` : 'Eligiendo…'));
  }

  function build(p, you) {
    if (you == null) {
      const sides = [0, 1].map((s) => sideView(s, [playerPill(p.sides[s], s === 0 ? 'me' : 'foe')]));
      root.replaceChildren(sides[0].el, h('div', { class: 'vs-mark' }, 'VS'), sides[1].el);
      return { sides, mine: null };
    }
    const foeSide = 1 - you;
    const foe = sideView(foeSide, [playerPill(p.sides[foeSide], 'foe')]);
    const mine = { title: h('h2'), note: h('p', { class: 'muted small' }), grid: h('div', { class: 'prep-grid' }), foot: h('div', { class: 'prep-foot' }), footMode: null, footNote: h('p', { class: 'pulse' }), slots: [] };
    mine.pickBtn = h('button', { type: 'button', class: 'btn primary', onclick: () => { sent = true; sendPick(picks.slice()); render(); } });
    root.replaceChildren(h('div', { class: 'card prep-side mine' }, h('div', { class: 'with-avatar' }, playerPill(p.sides[you], 'me', true), mine.title), mine.note, mine.grid, mine.foot), h('div', { class: 'vs-mark' }, 'VS'), foe.el);
    return { sides: [foe], mine };
  }

  function paintMine(m, own, foe, random) {
    const you = last.you;
    const rollingMe = rollingOn(you);
    const done = own.ready || sent;
    const chosen = own.picks ?? picks;
    m.title.textContent = rollingMe ? '🎲 Lanzando los dados…' : done ? 'Tu equipo para esta pelea' : `Elige ${own.needed} de tus ${own.party.length}`;
    m.note.textContent = rollingMe ? 'Sorteando Pokémon, movimientos y habilidades de tu colección.' : done ? 'El primero sale a pelear.' : 'Tócalos en el orden en que quieres usarlos: el primero sale a pelear. Si se acaba el tiempo, se eligen al azar.';
    syncGrid(m.grid, m.slots, own.party, you, (f, i) => ownCard(f, i, own, random));
    m.slots.forEach((slot, i) => {
      if (slot.kind !== 'card') return;
      const order = chosen.indexOf(i);
      slot.el.classList.toggle('chosen', order >= 0);
      slot.el.classList.toggle('benched', done && order < 0);
      slot.el.disabled = done || rollingMe;
      slot.badge.hidden = order < 0;
      slot.badge.textContent = order >= 0 ? String(order + 1) : '';
    });
    const mode = rollingMe || done ? 'note' : 'pick';
    if (m.footMode !== mode) {
      m.footMode = mode;
      m.foot.replaceChildren(mode === 'pick' ? m.pickBtn : m.footNote);
    }
    m.footNote.textContent = rollingMe ? '🎲 Los dados están rodando…' : last.preview.revealed || foe.ready ? '¡Los dos eligieron! La batalla parte en segundos.' : `Esperando a ${foe.name}…`;
    m.pickBtn.disabled = picks.length !== own.needed || rolling;
    m.pickBtn.textContent = `Continuar (${picks.length}/${own.needed})`;
  }

  function render() {
    const p = last.preview;
    const you = last.you;
    view ??= build(p, you);
    root.classList.toggle('is-revealed', !!p.revealed);
    title.textContent = you == null ? (p.revealed ? '👁 Elecciones reveladas' : '👁 Preparación de batalla · eligiendo') : p.revealed ? '⚔︎ ¡Todo listo!' : '⚔︎ Preparación de batalla';
    for (const v of view.sides) paintSide(v, p.sides[v.s]);
    if (view.mine) paintMine(view.mine, p.sides[you], p.sides[1 - you], p.mode === 'random');
    entered = true;
  }

  return {
    update(msg) {
      const first = !last;
      last = msg;
      preloadFor(msg.you, msg.preview.sides.map((side) => side.party));
      if (msg.preview.revealed && !revealSeen) {
        revealSeen = true;
        total = Math.max(1, (msg.deadline ?? Date.now()) - Date.now());
      }
      if (!total && msg.deadline) total = Math.max(1, msg.deadline - Date.now());
      if (first && !rolledRooms.has(c.id)) {
        const sides = msg.preview.sides;
        const rolled = sides.map((side, i) => (msg.preview.mode === 'random' || side.trainerId?.startsWith('ai:') ? i : null)).filter((i) => i !== null);
        if (rolled.length) {
          rollSides = new Set(rolled);
          startRoll(Math.max(...rolled.map((i) => sides[i].party.length)));
        }
      }
      render();
    },
    destroy() {
      clearInterval(tick);
      clearInterval(dieTick);
      rollTimers.forEach(clearTimeout);
    },
  };
}

const ACTION_GAP_MS = 750;
const WEATHER_TYPE = { sun: 'fire', harshsun: 'fire', rain: 'water', heavyrain: 'water', sand: 'ground', hail: 'ice', snow: 'ice', wind: 'flying' };

function moveSound(ev, byPlayer) {
  const shape = moveShape(ev);
  const self = ev.kind === 'status' && ev.target === 'self' && shape !== 'heal' && shape !== 'weather';
  music.sfx('move', { key: ev.key, byPlayer, shape: self ? (shape === 'boost' ? 'boost' : 'aura') : shape, type: ev.type });
}

function chatPanel(send) {
  const COOLDOWN_MS = 800;
  let lastSent = 0;
  const seen = new Set();
  const listeners = new Set();
  const list = h('div', { class: 'chat-list', role: 'log', 'aria-live': 'polite', 'aria-label': 'Mensajes del chat' });
  const empty = h('p', { class: 'chat-empty muted small' }, 'Nadie ha escrito todavía.');
  const input = h('input', { type: 'text', maxlength: 200, placeholder: 'Escribe algo…', 'aria-label': 'Mensaje para el chat', autocomplete: 'off' });
  const form = me
    ? h('form', { class: 'chat-form', onsubmit: (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || Date.now() - lastSent < COOLDOWN_MS) return;
        if (send({ t: 'chat', text }) === false) return toast('Sin conexión: espera un momento y vuelve a enviar.');
        lastSent = Date.now();
        input.value = '';
      } }, input, h('button', { class: 'btn sm', type: 'submit' }, 'Enviar'))
    : h('p', { class: 'chat-login muted small' }, 'Importa tu save para escribir en el chat.');
  const isMine = (m) => !!me && m.trainerId === me.id;
  const line = (m) => {
    const watcher = (m.role ?? (m.side == null ? 'watcher' : 'player')) === 'watcher';
    return h(
      'p',
      { class: `chat-msg${watcher ? ' watcher' : ''}${m.side != null ? ` side-${m.side}` : ''}${isMine(m) ? ' mine' : ''}` },
      h('b', { class: 'chat-name', title: watcher ? 'Espectador' : 'Jugador' }, watcher ? `👁 ${m.name}:` : `${m.name}:`),
      ' ',
      h('span', { class: 'chat-text' }, m.text),
    );
  };
  list.append(empty);
  const el = h('section', { class: 'card chat', 'aria-label': 'Chat' }, h('h3', { class: 'chat-title' }, '💬 Chat'), list, form);
  const show = (messages) => {
    const fresh = messages.filter((m) => !seen.has(m.id));
    if (!fresh.length) return [];
    fresh.forEach((m) => seen.add(m.id));
    const atBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 24;
    empty.remove();
    list.append(...fresh.map(line));
    if (atBottom || fresh.some(isMine)) list.scrollTop = list.scrollHeight;
    return fresh;
  };
  return {
    el,
    setLeftSide(side) {
      el.dataset.left = String(side);
    },
    load(messages) {
      show(messages);
    },
    add(message) {
      const fresh = show([message]);
      if (fresh.length && !isMine(message)) listeners.forEach((fn) => fn(message));
    },
    render: line,
    onNew(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    scrollToEnd() {
      list.scrollTop = list.scrollHeight;
    },
  };
}

function chatDock(chat) {
  const KEY = 'tc_chat_open';
  const saved = ls.get(KEY);
  let open = saved === '1';
  let unread = 0;
  const badge = h('span', { class: 'chat-badge', hidden: true });
  const toggle = h('button', { class: 'chat-dock-toggle', type: 'button', 'aria-expanded': String(open), onclick: () => setOpen(!open) }, '💬 Chat', badge);
  const dock = h('div', { class: 'chat-dock' }, chat.el, toggle);
  const paint = () => {
    dock.classList.toggle('collapsed', !open);
    toggle.setAttribute('aria-expanded', String(open));
    badge.hidden = open || !unread;
    badge.textContent = String(unread);
  };
  const setOpen = (value) => {
    open = value;
    if (open) peeks.replaceChildren();
    ls.set(KEY, open ? '1' : '0');
    if (open) {
      unread = 0;
      chat.scrollToEnd();
    }
    paint();
  };
  const PEEK_LIMIT = 4;
  const peeks = h('div', { class: 'chat-peeks', 'aria-hidden': 'true' });
  const showPeek = (message) => {
    const line = chat.render(message);
    const peek = h('button', { class: 'chat-peek', type: 'button', tabindex: -1, 'data-left': chat.el.dataset.left ?? null, onclick: () => setOpen(true) }, line);
    line.addEventListener('animationend', (e) => e.animationName === 'chat-peek-life' && peek.remove());
    peeks.append(peek);
    while (peeks.childElementCount > PEEK_LIMIT) peeks.firstElementChild.remove();
  };
  dock.insertBefore(peeks, toggle);
  const off = chat.onNew((message) => {
    if (open || !dock.isConnected) return;
    unread += 1;
    paint();
    showPeek(message);
  });
  document.body.append(dock);
  paint();
  return {
    destroy() {
      off();
      dock.remove();
    },
  };
}

function battleUI(c, sendAction, sendSeen = () => {}, chat = null, bar = null, sendSurrender = null) {
  let frame = null; // last frame from the server
  let view = null; // what is on screen (lags behind frame while events play)
  let playing = false;
  let mine = 0;
  let sent = null; // label of the action we sent this turn, until the turn resolves
  let aiming = null;
  let queue = Promise.resolve();
  let resultShown;
  const shown = new Promise((r) => (resultShown = r));
  let dead = false;
  const sound = (kind, opts) => !dead && music.sfx(kind, opts);

  const sideAt = (p) => (p === 'me' ? mine : 1 - mine);
  const hud = (p) => {
    const r = { name: h('span'), lvl: h('span'), sub: h('div', { class: 'sub' }), bar: h('i'), num: h('div', { class: 'hpnum' }), conds: h('div', { class: 'conds' }) };
    const info = h('button', { class: 'info-btn', type: 'button', 'data-tip': 'Ver info', 'aria-label': 'Ver info del Pokémon', onclick: () => openInfo(sideAt(p)) }, 'i');
    r.el = h('div', { class: `hud ${p}` }, h('div', { class: 'nm' }, r.name, h('span', { class: 'nm-end' }, r.lvl, info)), r.sub, h('div', { class: 'hp' }, r.bar), r.num, r.conds);
    return r;
  };
  const els = {
    turn: h('span', null, ''),
    vs: h('span', { class: 'vs-line' }),
    timer: h('span', { class: 'timer' }, ''),
    field: h('span', { class: 'field' }),
    sky: h('div', { class: 'sky', 'aria-hidden': 'true' }),
    ground: h('div', { class: 'terrain-glow', 'aria-hidden': 'true' }),
    spot: { foe: h('div', { class: 'spot foe', onclick: () => openInfo(sideAt('foe')) }), me: h('div', { class: 'spot me', onclick: () => openInfo(sideAt('me')) }) },
    trainer: { foe: h('div', { class: 'field-trainer foe', 'aria-hidden': 'true' }, h('img', { class: 'trainer-img', alt: '', draggable: 'false' })), me: h('div', { class: 'field-trainer me', 'aria-hidden': 'true' }, h('img', { class: 'trainer-img', alt: '', draggable: 'false' })) },
    hud: { foe: hud('foe'), me: hud('me') },
    team: { me: h('aside', { class: 'team-panel me', 'aria-label': 'Equipo de la izquierda' }), foe: h('aside', { class: 'team-panel foe', 'aria-label': 'Equipo de la derecha' }) },
    info: h('dialog', { class: 'info-dlg', onclick: (e) => e.target === e.currentTarget && e.currentTarget.close() }),
    say: h('div', { class: 'say', 'aria-live': 'polite' }),
    controls: h('div', { class: 'card' }),
    log: h('div', { class: 'card log' }),
    forfeit: h('button', { class: 'btn sm ghost danger forfeit-btn', type: 'button', hidden: true, 'data-tip': 'Abandonar esta pelea', onclick: () => askForfeit() }, '🏳 Rendirse'),
    forfeitDlg: h('dialog', { class: 'info-dlg confirm-dlg', onclick: (e) => e.target === e.currentTarget && e.currentTarget.close() }),
  };
  function askForfeit() {
    const consequence = c.tournament ? 'Quedas fuera del torneo y tu rival avanza.' : c.ai ? 'Las peleas contra la IA no cuentan para el ranking.' : 'Cuenta como derrota en el ranking.';
    const stay = h('button', { class: 'btn', type: 'button', autofocus: true, onclick: () => els.forfeitDlg.close() }, 'Seguir peleando');
    const give = h('button', { class: 'btn primary danger-fill', type: 'button', onclick: () => {
      els.forfeitDlg.close();
      els.forfeit.disabled = true;
      sendSurrender?.();
    } }, '🏳 Me rindo');
    els.forfeitDlg.replaceChildren(h('div', { class: 'confirm-body' }, h('h2', null, '¿Rendirte?'), h('p', null, `Pierdes esta pelea y ${trainerShort(view?.sides[1 - mine]?.name ?? 'tu rival')} gana. `, consequence), h('div', { class: 'row confirm-actions' }, stay, give)));
    if (!els.forfeitDlg.open) els.forfeitDlg.showModal();
  }
  const windowSkin = me?.shop?.equipped?.window;
  const skinClass = windowSkin ? ` win-theme win-${windowSkin}` : '';
  els.say.className += skinClass;
  els.controls.className += windowSkin ? ` win-moves win-${windowSkin}` : '';
  const scene = sceneFor(c.id);
  const field = h(
    'div',
    { class: 'battle-field' },
    h('img', { class: 'arena-bg', src: scene.image, alt: '', draggable: 'false' }),
    h('div', { class: 'battle-pad foe', 'aria-hidden': 'true' }),
    h('div', { class: 'battle-pad me', 'aria-hidden': 'true' }),
    els.ground,
    els.spot.foe,
    els.spot.me,
    els.trainer.foe,
    els.trainer.me,
    els.sky,
  );
  const arena = h('div', { class: 'arena' }, field, els.hud.foe.el, els.hud.me.el, els.say);
  for (const side of ['me', 'foe']) {
    arena.style.setProperty(`--pad-${side}-fill`, scene[side][0]);
    arena.style.setProperty(`--pad-${side}-rim`, scene[side][1]);
  }
  const fitField = () => arena.style.setProperty('--s', String(arena.clientWidth / 320));
  const resize = new ResizeObserver(fitField);
  resize.observe(arena);
  const fx = createFx(arena, field);
  $app.replaceChildren(
    ...(bar ? [] : [h('div', { class: 'status-line' }, els.turn, els.vs, els.field, els.timer, els.forfeit)]),
    h('div', { class: 'stage battle-stage' }, els.team.me, arena, els.team.foe),
    h('div', { class: 'battle-layout wide' }, els.controls, h('div', { class: 'fixed-slot' }, els.log)),
    els.info,
    els.forfeitDlg,
  );
  fitField();
  bar?.setStatus({ turn: els.turn, vs: els.vs, field: els.field, timer: els.timer, forfeit: els.forfeit });

  const tick = setInterval(() => {
    if (!frame?.deadline || frame.state.status !== 'active') {
      els.timer.textContent = '';
      return;
    }
    const s = Math.max(0, Math.ceil((frame.deadline - Date.now()) / 1000));
    els.timer.textContent = `⏱ ${s}s`;
    els.timer.classList.toggle('urgent', s <= 10);
  }, 250);

  const pos = (side) => (side === mine ? 'me' : 'foe');
  const calm = () => document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TRAINER_OFFSTAGE = { me: -150, foe: 150 };
  const trainerLook = (side) => view.sides[side].avatar ?? trainerSpriteFor(view.sides[side].name);
  function paintTrainer(side) {
    const img = els.trainer[pos(side)].querySelector('img');
    const src = trainerURL(trainerLook(side));
    if (img.getAttribute('src') !== src) img.src = src;
  }
  async function trainerSlide(p, show) {
    const el = els.trainer[p];
    const away = `${TRAINER_OFFSTAGE[p]}px 0`;
    el.classList.add('shown');
    await el.animate(show ? [{ translate: away }, { translate: '0 0' }] : [{ translate: '0 0' }, { translate: away }], { duration: calm() ? 1 : 500, easing: show ? 'cubic-bezier(.2, .8, .3, 1)' : 'cubic-bezier(.5, 0, .8, .4)', fill: 'forwards' }).finished.catch(() => {});
    if (!show) el.classList.remove('shown');
  }
  function trainerThrow(p) {
    if (calm()) return Promise.resolve();
    const img = els.trainer[p].querySelector('img');
    return img.animate([{ translate: '0 0', rotate: '0deg' }, { translate: '6px -2px', rotate: '7deg' }, { translate: '-2px 0', rotate: '-3deg' }, { translate: '0 0', rotate: '0deg' }], { duration: 420, easing: 'ease-out' }).finished.catch(() => {});
  }
  async function trainersReturn(winner) {
    for (const side of [0, 1]) {
      paintTrainer(side);
      els.trainer[pos(side)].classList.toggle('lost', winner !== null && side !== winner);
    }
    await Promise.all(['foe', 'me'].map((p) => trainerSlide(p, true)));
  }
  const sendOut = async (side) => {
    const spot = els.spot[pos(side)];
    spot.classList.add('incoming');
    if (els.trainer[pos(side)].classList.contains('shown')) trainerThrow(pos(side));
    sound('throw');
    await fx.sendOut(spot, pos(side) === 'me', () => {
      sound('switch');
      if (!dead) music.cues(ballSounds(view.sides[side].ball));
      spot.classList.remove('incoming');
      cry(side);
    }, view.sides[side].ball);
    spot.classList.remove('incoming');
  };
  const cry = (side, faint = false) => {
    const f = activeOf(side);
    if (f) sound('cry', { sprite: f.sprite, faint });
  };
  const activeOf = (side) => view.sides[side].team[view.sides[side].active];
  const isYou = (side) => frame?.you === side;
  // "tu Bigfin" / "Bigfin de Pedro": the same creature can be on both teams, so always say whose.
  const mon = (side, name) => (isYou(side) ? ['tu ', h('b', null, name)] : [h('b', null, name), ` de ${trainerShort(view.sides[side].name)}`]);
  const capFirst = (parts) => {
    const [first, ...rest] = parts.flat();
    return typeof first === 'string' ? [first.replace(/\p{L}/u, (ch) => ch.toUpperCase()), ...rest] : [first, ...rest];
  };
  // Skip the show when the tab is hidden, so coming back doesn't replay a backlog.
  let backlog = 0;
  const wait = (ms) => (document.hidden ? Promise.resolve() : sleep(backlog > 1 ? ms / Math.min(4, backlog) : ms));
  const settle = (r) => (typeof r === 'number' ? wait(r) : r);

  function log(parts, cls) {
    els.log.append(h('p', { class: cls || null }, parts));
    els.log.scrollTop = els.log.scrollHeight;
  }
  function say(parts, side, sub = false) {
    // The same nodes also go to the log, so the banner gets copies.
    const line = h('span', { class: sub ? 'say-detail' : 'say-main' }, [parts].flat(Infinity).map((n) => (n instanceof Node ? n.cloneNode(true) : n)));
    const main = els.say.querySelector('.say-main');
    if (sub && main) {
      els.say.querySelector('.say-detail')?.remove();
      els.say.append(line);
      return;
    }
    els.say.className = `say${side == null ? '' : ` by-${pos(side)}`}${skinClass}`;
    els.say.replaceChildren(line);
  }
  function tell(parts, { side = null, cls = null, sub = false } = {}) {
    const text = capFirst(parts);
    say(text, side, sub);
    log(sub ? ['↳ ', ...text] : text, [side == null ? '' : `by-${pos(side)}`, sub ? 'sub' : '', cls || ''].filter(Boolean).join(' '));
  }

  function anim(el, cls, ms = 600) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }
  function popNumber(side, text, cls = '') {
    const spot = els.spot[pos(side)];
    const img = spot.querySelector('.creature img');
    const top = spot.offsetTop - (img?.offsetHeight ?? 40) * 0.6;
    const el = h('span', { class: `dmg-num ${cls}`, 'aria-hidden': 'true' }, text);
    el.style.left = `${spot.offsetLeft}px`;
    el.style.top = `${top}px`;
    field.append(el);
    setTimeout(() => el.remove(), 1300);
  }
  const amountLabel = (ev, sign) => `${sign}${ev.amount}${ev.pct ? '%' : ''}`;

  function abilityPop(side, ev) {
    arena.querySelector(`.ab-pop.${pos(side)}`)?.remove();
    const el = h('div', { class: `ab-pop ${pos(side)}`, 'aria-hidden': 'true' }, h('small', null, ev.name), h('b', null, ev.ability));
    arena.append(el);
    setTimeout(() => el.remove(), 1900);
  }

  async function splash() {
    const who = (side, p) => h('div', { class: `vs-who ${p}` }, avatarPic(view.sides[side].avatar, 'xl', view.sides[side].frame), trainerName(view.sides[side].name, {}, view.sides[side].avatar));
    const el = h('div', { class: 'vs-splash' }, who(mine, 'me'), h('span', null, 'VS'), who(1 - mine, 'foe'));
    arena.append(el);
    await wait(1700);
    el.remove();
  }

  function confetti(host) {
    const colors = ['#ffcf4a', '#ff7a9c', '#5ec8ff', '#4fd18b', '#b45ae0', '#ffffff'];
    for (let i = 0; i < 70; i++) {
      const bit = h('i', { class: 'confetti', style: { left: `${Math.random() * 100}%`, background: colors[i % colors.length] } });
      host.append(bit);
      bit.animate([{ transform: `translateY(-10%) rotate(0deg)`, opacity: 1 }, { transform: `translateY(${host.clientHeight * 1.1}px) rotate(${360 + Math.random() * 540}deg)`, opacity: 0.9 }], { duration: 1600 + Math.random() * 1400, delay: Math.random() * 600, easing: 'cubic-bezier(.2,.6,.4,1)', fill: 'forwards' });
    }
  }

  function showResult(winner) {
    arena.querySelector('.result')?.remove();
    const watching = frame?.you == null;
    const kind = winner === null ? 'draw' : watching ? 'watch' : isYou(winner) ? 'win' : 'lose';
    const tour = c.tournament;
    const loser = winner === null ? null : view.sides[1 - winner]?.name;
    const champ = tour?.final && winner !== null;
    const title = { win: champ ? '¡CAMPEÓN!' : '¡VICTORIA!', lose: 'DERROTA', draw: 'EMPATE', watch: `¡Gana ${view.sides[winner]?.name ?? ''}!` }[kind];
    const sub = tour
      ? {
          win: champ ? '¡Ganaste el torneo!' : `Avanzas a ${tour.next === 'Final' ? 'la Final' : tour.next}.`,
          lose: `${trainerShort(view.sides[1 - mine].name)} sigue en el torneo. Quedaste fuera en ${tour.round}.`,
          draw: 'Empate: el que avanza se decide por sorteo.',
          watch: champ ? `${view.sides[winner]?.name} es campeón del torneo · ${loser} queda segundo.` : `${view.sides[winner]?.name} avanza a ${tour.next === 'Final' ? 'la Final' : tour.next} · ${loser} queda fuera.`,
        }[kind]
      : { win: `Venciste a ${trainerShort(view.sides[1 - mine].name)}.`, lose: `${trainerShort(view.sides[1 - mine].name)} ganó esta vez.`, draw: 'Nadie quedó en pie.', watch: `${trainerShort(view.sides[0].name)} vs ${trainerShort(view.sides[1].name)}` }[kind];
    const icon = { win: '🏆', lose: '💀', draw: '🤝', watch: champ ? '🏆' : '🏁' }[kind];
    const duel = winner === null ? null : h('div', { class: 'result-duel' }, [0, 1].map((side) => h('span', { class: `result-side ${side === winner ? 'won' : 'lost'}` }, side === winner ? '👑 ' : '', playerPill(view.sides[side], pos(side), isYou(side)))));
    const el = h('div', { class: `result ${kind}`, onclick: () => el.remove() }, h('div', { class: 'result-card' }, h('span', { class: 'result-icon' }, icon), h('h2', null, title), duel, h('p', null, sub), h('small', null, tour ? 'Siguen las llaves del torneo' : 'Toca para cerrar')));
    arena.append(el);
    if (kind === 'win' || kind === 'watch') confetti(el);
    if (kind === 'win' && !dead) music.victory(champ ? 'champion' : 'win');
    if (kind === 'lose' && !dead) music.stop();
    resultShown();
  }

  function openInfo(side, index = view?.sides[side].active) {
    if (!view) return;
    const f = view.sides[side].team[index];
    if (!f || f.hidden) return;
    const own = isYou(side) || view.status === 'finished';
    els.info.replaceChildren(infoCard(f, { own, owner: trainerShort(view.sides[side].name), close: () => els.info.close() }));
    if (!els.info.open) els.info.showModal();
  }

  function setActing(side) {
    for (const p of ['me', 'foe']) els.hud[p].el.classList.toggle('acting', side != null && pos(side) === p);
    for (const p of ['me', 'foe']) els.spot[p].classList.toggle('acting', side != null && pos(side) === p);
  }

  const amountText = (ev) => (ev.pct ? `${ev.amount}%` : `${ev.amount} PV`);
  const hpText = (ev, v) => (ev.pct ? `${v}%` : `${v}`);

  function countTo(el, from, to, max, percent = false, ms = hpTweenMs(from, to)) {
    const label = (n) => (percent ? `${n}%` : `${n} / ${max} PV`);
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      const eased = Math.sin((k * Math.PI) / 2);
      el.textContent = label(Math.round(from + (to - from) * eased));
      if (k < 1 && el.dataset.to === String(to)) requestAnimationFrame(step);
    };
    el.dataset.to = String(to);
    if (document.hidden || from === to) el.textContent = label(to);
    else requestAnimationFrame(step);
  }

  function paint(side, enter = false) {
    const p = pos(side);
    const sd = view.sides[side];
    const f = activeOf(side);
    const spot = els.spot[p];
    const r = els.hud[p];
    const key = `${side}:${sd.active}:${f.uid}:${f.sprite}`;
    const fresh = spot.dataset.key !== key;
    if (fresh) {
      spot.dataset.key = key;
      spot.innerHTML = creatureHTML(f, { back: p === 'me', eager: true });
      enter = true;
    }
    spot.classList.toggle('faint', f.hp <= 0);
    const screens = sd.screens || {};
    for (const kind of Object.keys(SCREEN)) spot.classList.toggle(`screen-${kind}`, !!screens[kind] && f.hp > 0);
    const shownStatus = f.hp > 0 && f.status ? f.status : '';
    if (shownStatus) spot.dataset.status = shownStatus;
    else delete spot.dataset.status;
    if (!spot.querySelector('.sub-doll')) spot.append(h('div', { class: 'sub-doll', 'aria-hidden': 'true', html: creatureHTML({ sprite: 'substitute' }, { back: p === 'me', eager: true }) }));
    spot.classList.toggle('has-sub', !!f.volatiles?.substitute && f.hp > 0);

    const pct = Math.max(0, (f.hp / f.stats.hp) * 100);
    r.bar.className = pct < 20 ? 'low' : pct < 50 ? 'mid' : '';
    const before = parseFloat(r.bar.style.width);
    const snap = fresh || Number.isNaN(before);
    const shown = Number(r.num.dataset.to);
    const from = fresh || Number.isNaN(shown) ? f.hp : shown;
    const ms = snap || from === f.hp ? 0 : hpTweenMs(from, f.hp);
    r.bar.style.transitionDuration = `${ms}ms`;
    r.bar.style.width = `${pct}%`;
    countTo(r.num, from, f.hp, f.stats.hp, !!f.hpPercent, Math.max(1, ms));

    r.name.replaceChildren(f.shiny ? `✨ ${f.name}` : f.name, genderMark(f.gender) ?? '');
    r.lvl.textContent = `Nv ${f.level}`;
    const volatiles = conditionsOf({ volatiles: f.volatiles }).filter((c) => !['flashFire', 'disabled', 'slowStart', 'smackdown', 'noRetreat', 'foresight', 'miracleeye', 'focusenergy', 'gastroacid', 'imprison'].includes(c.key));
    r.sub.replaceChildren(
      ...[
        typeChips(f.types),
        f.status && f.hp > 0 ? h('span', { class: `cond ${f.status}`, tabindex: 0, 'data-tip': STATUS_INFO[f.status].name, 'data-tip-note': STATUS_INFO[f.status].desc }, statusLabel(f.status)) : null,
        h('span', { class: 'dots', 'aria-label': `Equipo: ${sd.team.filter((t) => t.hp > 0).length} de ${sd.team.length} en pie`, 'data-tip': `${sd.team.filter((t) => t.hp > 0).length} de ${sd.team.length} en pie` }, sd.team.map((t) => h('i', { class: t.hp <= 0 ? 'out' : null }))),
      ].filter(Boolean),
    );
    const condChips = [
      ...(f.hp > 0 ? boostChips(f.boosts) : []),
      ...(f.hp > 0 ? volatiles : []).map((c) => h('span', { class: 'vol-chip', tabindex: 0, 'data-tip': c.name, 'data-tip-note': c.desc }, `${c.icon} ${c.name}`)),
      ...Object.entries(sd.screens || {}).map(([kind, turns]) => h('span', { class: `screen-chip ${kind}`, tabindex: 0, 'data-tip': `Reduce a la mitad el daño de ${SCREEN_GUARDS[kind]} contra este equipo. Quedan ${turns} turnos.` }, `🛡️ ${SCREEN[kind]} ${turns}`)),
      ...sideChips(sd),
    ];
    r.conds.replaceChildren(...condChips);
    r.conds.hidden = !condChips.length;
    paintTeams();
    return ms;
  }

  function sideChips(sd) {
    const out = [];
    const hz = sd.hazards || {};
    if (hz.spikes) out.push(['spikes', `×${hz.spikes}`]);
    if (hz.stealthrock) out.push(['stealthrock', '']);
    if (hz.stickyweb) out.push(['stickyweb', '']);
    for (const [k, turns] of Object.entries(sd.conds || {})) out.push([k, turns]);
    if (sd.wish) out.push(['wish', '']);
    const chips = out.filter(([k]) => SIDE_COND[k]).map(([k, extra]) => h('span', { class: 'side-chip', tabindex: 0, 'data-tip': SIDE_COND[k].name, 'data-tip-note': SIDE_COND[k].desc ?? null }, `${SIDE_COND[k].icon} ${SIDE_COND[k].name}${extra ? ` ${extra}` : ''}`));
    if (sd.toxicSpikes) chips.push(h('span', { class: 'side-chip', tabindex: 0, 'data-tip': 'Púas Tóxicas', 'data-tip-note': 'Envenenan al que entra y toca el suelo.' }, `☠️ Púas Tóxicas ×${sd.toxicSpikes}`));
    if (sd.future) chips.push(h('span', { class: 'side-chip', tabindex: 0, 'data-tip': `${sd.future} viene en camino` }, `🔮 ${sd.future}`));
    return chips;
  }

  function paintField() {
    const fl = view.field || {};
    const parts = [fl.weather ? `${WEATHER[fl.weather] ?? fl.weather}${fl.weatherSuppressed ? ' (sin efecto)' : ''}` : null, fl.terrain ? TERRAIN[fl.terrain] ?? fl.terrain : null, ...Object.keys(fl.rooms || {}).map((k) => ROOM[k]?.label)].filter(Boolean);
    els.field.textContent = parts.join(' · ');
    els.sky.className = `sky${fl.weather ? ` ${fl.weather}` : ''}${fl.weatherSuppressed ? ' suppressed' : ''}`;
    els.ground.className = `terrain-glow${fl.terrain ? ` ${fl.terrain}` : ''}`;
  }

  const switchOptions = () => (frame?.you == null || playing || sent || frame.state?.status !== 'active' ? [] : (frame.actions ?? []).filter((a) => a.type === 'switch'));
  function switchTo(i) {
    const action = switchOptions().find((a) => a.to === i);
    if (!action) return false;
    sent = `cambiar a ${frame.state.sides[frame.you].team[i].name}`;
    sendAction(action);
    renderControls();
    return true;
  }

  function switchBlockReason(i) {
    if (switchOptions().some((a) => a.to === i)) return null;
    const st = frame?.state;
    const mine = st?.sides[frame.you];
    if (!mine) return 'No puedes cambiar ahora.';
    const f = mine.team[i];
    if (st.status !== 'active') return 'La batalla terminó.';
    if (playing) return 'Espera a que termine de verse el turno.';
    if (sent) return `Ya elegiste: ${sent}.`;
    if (f.hp <= 0) return `${f.name} está debilitado.`;
    if (i === mine.active) return `${f.name} ya está en combate.`;
    if (!frame.actions?.length) return st.sides[1 - frame.you].mustSwitch ? 'Espera a que tu rival elija quién entra.' : 'Espera a que tu rival elija.';
    const active = mine.team[mine.active];
    if (active?.volatiles?.bound || active?.volatiles?.trapped) return `${active.name} está atrapado y no puede cambiar.`;
    return 'No puedes cambiar ahora.';
  }

  function closeTeamChoice() {
    arena.closest('.battle-stage')?.querySelector('.team-choice')?.remove();
    document.removeEventListener('pointerdown', onOutsideChoice, true);
  }
  function onOutsideChoice(e) {
    if (!e.target.closest?.('.team-choice')) closeTeamChoice();
  }
  function openTeamChoice(card, side, i) {
    closeTeamChoice();
    const f = view.sides[side].team[i];
    const blocked = switchBlockReason(i);
    const switchBtn = blocked
      ? h('button', { type: 'button', class: 'btn sm is-disabled', role: 'menuitem', 'aria-disabled': 'true', 'data-tip': blocked, onclick: () => toast(blocked) }, '⇄ Cambiar')
      : h('button', { type: 'button', class: 'btn primary sm', role: 'menuitem', onclick: () => { closeTeamChoice(); switchTo(i); } }, '⇄ Cambiar');
    const menu = h(
      'div',
      { class: 'team-choice', role: 'menu', 'aria-label': `Opciones de ${f.name}` },
      switchBtn,
      h('button', { type: 'button', class: 'btn sm', role: 'menuitem', onclick: () => { closeTeamChoice(); openInfo(side, i); } }, 'Ver info'),
    );
    card.append(menu);
    menu.querySelector('button').focus();
    setTimeout(() => document.addEventListener('pointerdown', onOutsideChoice, true));
  }

  const teamSigs = { me: '', foe: '' };
  function paintTeams() {
    if (!view) return;
    const watching = frame?.you == null;
    for (const p of ['me', 'foe']) {
      const side = sideAt(p);
      const sd = view.sides[side];
      const showHp = watching || isYou(side);
      const switchable = new Set(isYou(side) ? switchOptions().map((a) => a.to) : []);
      els.team[p].classList.toggle('must-pick', switchable.size > 0 && frame?.state?.phase !== 'choose');
      const sig = JSON.stringify([sd.name, sd.active, showHp, [...switchable], sd.team.map((f) => (f?.hidden ? 0 : [f.uid, f.sprite, f.shiny, f.hp, f.stats?.hp, f.level, f.name]))]);
      if (sig === teamSigs[p]) continue;
      teamSigs[p] = sig;
      const cards = sd.team.map((f, i) => {
        if (!f || f.hidden) return h('div', { class: 'team-mon unknown', 'aria-label': 'Pokémon sin revelar' }, h('span', { class: 'team-q', 'aria-hidden': 'true' }, '?'), h('div', { class: 'team-info' }, h('b', null, '???'), h('small', { class: 'muted' }, 'Sin ver')));
        const pct = Math.max(0, Math.min(100, (f.hp / f.stats.hp) * 100));
        const fainted = f.hp <= 0;
        const canSwitch = switchable.has(i);
        const card = h(
          'div',
          { class: `team-mon${fainted ? ' fainted' : ''}${i === sd.active && !fainted ? ' active' : ''}${canSwitch ? ' can-switch' : ''}` },
          h(
            'button',
            { type: 'button', class: 'team-main', 'aria-label': isYou(side) ? `Opciones de ${f.name}` : `Ver info de ${f.name}`, 'aria-haspopup': isYou(side) ? 'menu' : null, onclick: () => (isYou(side) ? openTeamChoice(card, side, i) : openInfo(side, i)) },
            h('div', { class: 'team-sprite', html: creatureHTML(f) }),
            h(
              'div',
              { class: 'team-info' },
              h('b', null, f.name, genderMark(f.gender) ?? ''),
              h('small', { class: 'muted' }, fainted ? 'Debilitado' : `Nv ${f.level}`),
              showHp ? h('div', { class: 'team-hp', 'aria-label': `${Math.round(pct)}% de PV` }, h('i', { class: pct < 20 ? 'low' : pct < 50 ? 'mid' : null, style: { width: `${pct}%` } })) : null,
              canSwitch ? h('span', { class: 'switch-chip' }, '⇄ Puede entrar') : null,
            ),
          ),
        );
        return card;
      });
      const alive = sd.team.filter((f) => f && !f.hidden && f.hp > 0).length + sd.team.filter((f) => !f || f.hidden).length;
      const role = isYou(side) ? 'Tú' : watching ? `Jugador ${side + 1}` : 'Rival';
      const head = h(
        'header',
        { class: 'team-panel-head' },
        h('span', { class: 'team-role' }, role),
        h('span', { class: 'team-owner-wrap' }, playerPill(sd, pos(side))),
        h('span', { class: 'team-alive', 'aria-label': `${alive} de ${sd.team.length} en pie` }, sd.team.map((f, i) => h('i', { class: f && !f.hidden && f.hp <= 0 ? 'out' : i === sd.active ? 'on' : null }))),
      );
      els.team[p].replaceChildren(head, ...cards);
    }
  }

  function paintAll() {
    paint(0);
    paint(1);
    paintField();
    els.turn.textContent = view.status === 'finished' ? 'Fin de la batalla' : `Turno ${view.turn}`;
    const tag = (side) => playerPill(view.sides[side], pos(side), isYou(side));
    els.vs.replaceChildren(tag(mine), h('span', { class: 'muted' }, ' vs '), tag(1 - mine));
  }

  function renderControls() {
    els.forfeit.hidden = !sendSurrender || frame?.you == null || frame?.state.status !== 'active';
    if (els.forfeit.hidden && els.forfeitDlg.open) els.forfeitDlg.close();
    paintTeams();
    const st = frame.state;
    const you = frame.you;
    const foeName = trainerShort(st.sides[1 - mine].name);
    const box = els.controls;
    box.replaceChildren();

    if (st.status === 'finished') {
      if (playing) {
        box.append(h('p', { class: 'pulse' }, 'Mirando el turno…'));
        return;
      }
      const won = st.winner === you;
      const title = st.winner === null ? 'Empate' : you === null ? `¡Gana ${trainerShort(st.sides[st.winner].name)}!` : won ? '¡Ganaste! 🏆' : 'Perdiste… 😵';
      box.append(
        h('div', { class: 'banner' }, h('h2', null, title), h('p', { class: 'muted' }, `${trainerShort(st.sides[0].name)} vs ${trainerShort(st.sides[1].name)} · ${st.turn} turnos`)),
        c.tournament ? h('p', { class: 'muted pulse' }, 'Volviendo a las llaves del torneo…') : '',
        h(
          'div',
          { class: 'row', style: null },
          me && !c.tournament
            ? h('button', {
                class: 'btn primary',
                onclick: async (e) => {
                  e.currentTarget.disabled = true;
                  try {
                    const { challenge, joined } = await api('/api/challenges', { method: 'POST', body: { mode: c.mode, ...(c.ai ? { ai: c.ai } : { visibility: c.visibility }) } });
                    if (joined) toast(`Te uniste a la sala de ${challenge.host.name}`);
                    nav(`/b/${challenge.id}`);
                  } catch (err) {
                    toast(err.message);
                  }
                },
              }, c.ai ? '⚔︎ Revancha' : c.visibility === 'public' ? '⚔︎ Buscar otra pelea' : '⚔︎ Revancha (sala privada)')
            : null,
          c.tournament ? h('a', { class: 'btn primary', href: `/t/${c.tournament.id}`, 'data-link': true }, 'Ver llaves') : null,
          h('a', { class: 'btn', href: '/', 'data-link': true }, 'Inicio'),
        ),
      );
      return;
    }

    if (you === null) {
      if (c.tournament) box.append(h('h2', null, '👁 Estás mirando'), h('p', { class: 'muted' }, `${trainerShort(st.sides[0].name)} vs ${trainerShort(st.sides[1].name)} · ${c.tournament.round}. Cuando termine te llevamos a las llaves y a la siguiente pelea.`), h('a', { class: 'btn', href: `/t/${c.tournament.id}`, 'data-link': true }, 'Ver llaves'));
      else box.append(h('h2', null, 'Estás mirando'), h('p', { class: 'muted' }, `${trainerShort(st.sides[0].name)} vs ${trainerShort(st.sides[1].name)}. Para pelear tú, busca rival desde el inicio.`), h('a', { class: 'btn', href: '/', 'data-link': true }, 'Ir al inicio'));
      return;
    }

    if (playing) {
      box.append(h('p', { class: 'pulse' }, 'Mirando el turno…'));
      return;
    }
    const acts = frame.actions;
    const foeReady = st.sides[1 - you].ready;
    if (!acts.length || sent) {
      const waitingFor = st.phase !== 'choose' && st.sides[1 - you].mustSwitch ? `Esperando a que ${foeName} elija quién entra…` : `Esperando a ${foeName}…`;
      if (sent) box.append(h('p', null, 'Elegiste: ', h('b', null, sent), '.'));
      else if (frame.forced) box.append(h('p', null, 'Tu Pokémon está obligado a seguir con su movimiento este turno.'));
      box.append(h('p', { class: 'pulse' }, waitingFor));
      return;
    }
    const meSide = st.sides[you];
    const f = meSide.team[meSide.active];
    const foe = st.sides[1 - you].team[st.sides[1 - you].active];
    const act = (a, label) => {
      sent = label;
      aiming = null;
      sendAction(a);
      renderControls();
    };

    if (st.phase === 'replace') box.append(h('h2', null, f.hp > 0 ? `${f.name} se retira. ¿Quién entra?` : `${f.name} no puede seguir. ¿Quién entra?`));
    else if (st.phase === 'switchout') box.append(h('h2', null, `${f.name} vuelve. ¿Quién entra en su lugar?`));
    else {
      const moveSet = new Set(acts.filter((a) => a.type === 'move').map((a) => a.move));
      if (aiming !== null && moveSet.has(aiming)) {
        const slot = aiming;
        const m = f.moves[slot];
        const aimAt = (target, who, note) => h('button', { class: 'move', onclick: () => act({ type: 'move', move: slot, target }, `${m.name} sobre ${who.name}`) }, h('span', { class: 'mv' }, who.name), h('span', { class: 'mi' }, note));
        box.append(
          h('h2', null, `¿Sobre quién usa ${f.name} ${m.name}?`),
          h('div', { class: 'moves' }, aimAt('self', f, 'Tu Pokémon'), aimAt('foe', foe, 'Rival')),
          h('button', { class: 'btn', onclick: () => { aiming = null; renderControls(); } }, 'Volver'),
        );
        return;
      }
      box.append(h('h2', null, `¿Qué hace ${f.name}?`));
      box.append(
        h(
          'div',
          { class: 'moves' },
          f.moves.map((m, i) => {
            const eff = m.kind === 'attack' ? effectiveness(m.type, foe.types) : 1;
            const effTag =
              eff === 0 ? h('span', { class: 'tag-weak' }, 'No afecta ×0')
                : eff > 1 ? h('span', { class: 'tag-strong' }, `Fuerte ×${eff}`)
                  : eff < 1 ? h('span', { class: 'tag-weak' }, `Débil ×${eff}`)
                    : null;
            const pp = f.pp?.[m.key] ?? m.pp;
            const info =
              m.kind === 'attack'
                ? [h('span', null, `${CATEGORY_ICON[m.category] ?? ''} ${m.power ? `Poder ${m.power}` : 'Especial'}`), h('span', null, m.accuracy ? `${m.accuracy}%` : '∞'), m.priority > 0 ? h('span', null, 'Va primero') : null, effTag]
                : [h('span', null, `${CATEGORY_ICON.status} Estado`)];
            if (m.aimable) info.push(h('span', null, '🎯 Eliges sobre quién'));
            return h(
              'button',
              { class: `move${pp === 0 ? ' no-pp' : ''}`, 'data-tip': m.desc, 'data-tip-note': pp === 0 ? 'Sin PP: no se puede usar.' : flinchNote(m), disabled: !moveSet.has(i), onclick: () => (m.aimable ? ((aiming = i), renderControls()) : act({ type: 'move', move: i }, m.name)) },
              h('span', { class: 'mv' }, m.name, h('small', { class: `pp${pp <= Math.ceil(m.pp / 4) ? ' low' : ''}` }, `PP ${pp}/${m.pp}`)),
              h('span', { class: 'mi' }, typeChip(m.type), info),
            );
          }),
          moveSet.has(-1) ? h('button', { class: 'move struggle', onclick: () => act({ type: 'move', move: -1 }, 'Forcejeo') }, h('span', { class: 'mv' }, 'Forcejeo'), h('span', { class: 'mi' }, h('span', null, 'Sin PP: daña al rival y a ti'))) : null,
        ),
      );
    }
    const canSwitch = acts.some((a) => a.type === 'switch');
    const forced = st.phase !== 'choose';
    if (canSwitch && forced) box.append(h('p', { class: 'switch-hint forced' }, '👉 Elige en el panel de tu equipo quién entra.'));
    if (foeReady && st.phase === 'choose') box.append(h('p', { class: 'muted small' }, `${foeName} ya eligió.`));
  }

  const WHY = {
    priority: 'golpe rápido, va primero',
    speed: 'es más veloz, ataca primero',
    tie: 'misma velocidad, le tocó primero',
  };

  // Plays one event on screen and in the log; returns how long to linger on it.
  let currentMove = null;
  let draggedSide = null;

  async function showDamage(ev, linger) {
    const f = activeOf(ev.side);
    const before = f.hp;
    anim(els.spot[pos(ev.side)], 'hit', 700);
    const notes = [ev.crit ? '¡Golpe crítico!' : '', ev.eff > 1 ? '¡Es muy eficaz!' : ev.eff < 1 ? 'No es muy eficaz…' : ''].filter(Boolean).join(' ');
    tell([...mon(ev.side, f.name), ` pierde ${amountText(ev)} (${hpText(ev, before)} → ${hpText(ev, ev.hp)})`, notes ? h('span', { class: ev.eff < 1 && !ev.crit ? 'weak' : 'strong' }, ` ${notes}`) : ''], { side: ev.side, sub: true });
    await wait(700);
    f.hp = ev.hp;
    popNumber(ev.side, amountLabel(ev, '−'), ev.crit ? 'crit' : ev.eff > 1 ? 'strong' : ev.eff < 1 ? 'weak' : '');
    await wait(paint(ev.side) + linger);
  }

  async function playHit(ev, hit) {
    const move = currentMove.ev;
    const from = els.spot[pos(move.side)];
    moveSound({ ...move, multihit: false }, move.side === mine);
    await fx.move({ ...move, multihit: false }, from, els.spot[pos(ev.side)]);
    await showDamage(ev, hit > 1 ? 200 : 300);
  }

  function play(ev, lands = true) {
    const sd = (s) => view.sides[s];
    switch (ev.t) {
      case 'turn':
        currentMove = null;
        setActing(null);
        els.turn.textContent = `Turno ${ev.turn}`;
        log(`Turno ${ev.turn}`, 'turn');
        return 350;
      case 'move': {
        els.spot[pos(ev.side)].classList.remove('is-hidden-move');
        setActing(ev.side);
        currentMove = ev.kind === 'attack' ? { ev, hits: 0 } : null;
        tell([...mon(ev.side, ev.name), ' usa ', h('b', { class: 'mvname' }, ev.move), ev.type ? ' ' : '', ev.type ? typeChip(ev.type) : '', ev.why ? h('small', { class: 'why' }, ` · ${WHY[ev.why]}`) : ''], { side: ev.side });
        if (ev.multihit || !lands) return sleep(350);
        return Promise.all([sleep(450), wait(250).then(() => {
          moveSound(ev, ev.side === mine);
          return fx.move(ev, els.spot[pos(ev.side)], els.spot[pos(1 - ev.side)]);
        })]);
      }
      case 'damage': {
        sound('hit', { eff: ev.eff, crit: ev.crit });
        const hit = currentMove && currentMove.ev.side === 1 - ev.side ? ++currentMove.hits : 0;
        const repeated = hit > 0 && (currentMove.ev.multihit || hit > 1);
        if (repeated) return playHit(ev, hit);
        return showDamage(ev, 600);
      }
      case 'miss': {
        sound('miss');
        const t = 1 - ev.side;
        tell(['falla: ', ...mon(t, activeOf(t).name), ' lo esquiva.'], { side: ev.side, sub: true, cls: 'weak' });
        return 900;
      }
      case 'nothing':
        if (ev.reason === 'splash') {
          tell(['¡Pero no pasa nada!'], { side: ev.side, sub: true, cls: 'weak' });
          return 800;
        }
        tell(['¡pero falló!', ev.reason ? h('small', { class: 'why' }, ` · ${NOTHING_WHY[ev.reason]}`) : ''], { side: ev.side, sub: true, cls: 'weak' });
        return ev.reason ? 1100 : 800;
      case 'focus':
        tell([...mon(ev.side, ev.name), ` ${FOCUS_TEXT[ev.key] ?? 'se prepara…'}`], { side: ev.side, sub: true });
        return 800;
      case 'dragged':
        draggedSide = ev.side;
        tell(['¡', ...mon(ev.side, ev.name), ' es arrastrado fuera del combate!'], { side: ev.side, cls: 'weak' });
        return 800;
      case 'boostsReset': {
        const f = activeOf(ev.side);
        f.boosts = Object.fromEntries(Object.keys(f.boosts || {}).map((k) => [k, 0]));
        paint(ev.side);
        tell(['Se anulan los cambios de características de ', ...mon(ev.side, ev.name), '.'], { side: ev.side, sub: true });
        return 800;
      }
      case 'charging': {
        const spot = els.spot[pos(ev.side)];
        if (ev.hidden) spot.classList.add('is-hidden-move');
        const text = CHARGE_TEXT[ev.key];
        tell([...capFirst(mon(ev.side, ev.name)), text ? ` ${text}` : ` se prepara para usar ${ev.move}…`], { side: ev.side });
        log([...capFirst(mon(ev.side, ev.name)), ` carga ${ev.move}: atacará el próximo turno.`], 'weak');
        sound('charge', { key: ev.key, byPlayer: ev.side === mine });
        return Promise.all([sleep(1300), fx.charge(ev.key, spot, els.spot[pos(1 - ev.side)])]);
      }
      case 'boost': {
        const f = activeOf(ev.side);
        const [label, word] = STAT[ev.stat] ?? [ev.stat, ev.stat];
        const up = (ev.by ?? 1) > 0;
        sound(up ? 'up' : 'down');
        fx.stat(up, els.spot[pos(ev.side)]);
        f.boosts[ev.stat] = ev.stage;
        paint(ev.side);
        tell([...mon(ev.side, f.name), ` ${up ? 'sube' : 'baja'} su ${word}${Math.abs(ev.by ?? 1) >= 2 ? ' mucho' : ''} `, h('span', { class: `stat-delta ${up ? 'up' : 'down'}` }, `${up ? '▲' : '▼'} ${signed(ev.stage)}`), '.'], { side: ev.side, sub: true });
        return 900;
      }
      case 'ability': {
        const f = activeOf(ev.side);
        if (ev.look) {
          Object.assign(f, ev.look);
          paint(ev.side);
        }
        if (ev.info) f.abilityInfo = ev.info;
        abilityPop(ev.side, ev);
        const note = ev.note && ABILITY_NOTE[ev.note] ? ` ${ABILITY_NOTE[ev.note](ev)}` : '';
        tell([h('span', { class: 'ab-tag' }, ev.ability), ' de ', ...mon(ev.side, ev.name), note ? `:${note}` : '.'], { side: ev.side, sub: true });
        return note ? 1400 : 1200;
      }
      case 'abilityChange': {
        const f = activeOf(ev.side);
        f.abilityInfo = ev.ability;
        paint(ev.side);
        tell([...mon(ev.side, f.name), ` ahora tiene la habilidad ${ev.ability?.name ?? '—'}.`], { side: ev.side, sub: true });
        return 800;
      }
      case 'status': {
        sound('status', { status: ev.status });
        const f = activeOf(ev.side);
        f.status = ev.status;
        paint(ev.side);
        tell([...mon(ev.side, f.name), ` ${STATUS_TEXT[ev.status]}.`], { side: ev.side, sub: true, cls: 'weak' });
        return Promise.all([sleep(700), fx.status(ev.status, els.spot[pos(ev.side)])]);
      }
      case 'cure': {
        const f = activeOf(ev.side);
        f.status = null;
        paint(ev.side);
        tell([...mon(ev.side, f.name), ` ${CURE_TEXT[ev.status] ?? 'se recupera'}.`], { side: ev.side, sub: true });
        return Promise.all([sleep(800), fx.impact('fairy', els.spot[pos(ev.side)])]);
      }
      case 'cant': {
        if (ev.reason === 'truant') return 0;
        const spot = els.spot[pos(ev.side)];
        tell([...mon(ev.side, ev.name), ` ${cantText(ev)}`], { side: ev.side, cls: ev.reason === 'flinch' ? null : 'weak' });
        if (STATUS_INFO[ev.reason]) {
          return Promise.all([sleep(900), fx.status(ev.reason, spot)]);
        }
        if (ev.reason === 'attract') {
          return 900;
        }
        if (ev.reason === 'flinch') {
          popNumber(ev.side, '¡Retrocede!', 'status');
          anim(spot, 'flinch', 500);
          return Promise.all([sleep(1000), fx.condition('flinch', spot)]);
        }
        return 900;
      }
      case 'confused': {
        const spot = els.spot[pos(ev.side)];
        tell([...mon(ev.side, ev.name), ' está confuso…'], { side: ev.side, sub: true, cls: 'weak' });
        sound('condition', { kind: 'confusion' });
        return Promise.all([sleep(800), fx.condition('confusion', spot)]);
      }
      case 'infatuated': {
        const spot = els.spot[pos(ev.side)];
        tell([...mon(ev.side, ev.name), ` está enamorado de ${ev.by}.`], { side: ev.side, sub: true, cls: 'weak' });
        sound('condition', { kind: 'attract' });
        return Promise.all([sleep(800), fx.condition('attract', spot)]);
      }
      case 'volatile': {
        const f = activeOf(ev.side);
        f.volatiles = { ...f.volatiles, [ev.kind]: ev.kind === 'perish' ? 4 : ev.kind === 'bound' ? ev.move : true };
        paint(ev.side);
        tell([...mon(ev.side, ev.name), ` ${VOLATILE[ev.kind]?.(ev) ?? ''}`], { side: ev.side, sub: true, cls: 'weak' });
        sound('condition', { kind: ev.kind });
        return Promise.all([sleep(900), fx.condition(ev.kind, els.spot[pos(ev.side)])]);
      }
      case 'volatileEnd': {
        const f = activeOf(ev.side);
        if (f.volatiles) delete f.volatiles[ev.kind];
        paint(ev.side);
        tell([...mon(ev.side, ev.name), ` ${(VOLATILE_END[ev.kind] ?? VOLATILE_END.confusion)(ev)}`], { side: ev.side, sub: true });
        return 700;
      }
      case 'perish': {
        const f = activeOf(ev.side);
        f.volatiles = { ...f.volatiles, perish: ev.count + 1 };
        paint(ev.side);
        tell(['Canto mortal: a ', ...mon(ev.side, ev.name), ` le quedan ${ev.count}.`], { side: ev.side, sub: true, cls: 'weak' });
        return Promise.all([sleep(800), fx.condition('perish', els.spot[pos(ev.side)])]);
      }
      case 'hurt': {
        sound('cause', { cause: ev.cause });
        const f = activeOf(ev.side);
        const before = f.hp;
        const spot = els.spot[pos(ev.side)];
        const why = ev.cause === 'confusion' ? ' se hiere a sí mismo' : ` pierde ${amountText(ev)}${HURT[ev.cause] ?? ''}`;
        tell([...mon(ev.side, f.name), `${why} (${hpText(ev, before)} → ${hpText(ev, ev.hp)}).`], { side: ev.side, sub: true, cls: 'weak' });
        return (async () => {
          await (ev.cause === 'confusion' ? fx.condition('confusion', spot) : fx.hurt(ev.cause, spot, els.spot[pos(1 - ev.side)]));
          if (!STATUS_INFO[ev.cause]) {
            anim(spot, 'hit', 700);
            await wait(700);
          }
          f.hp = ev.hp;
          popNumber(ev.side, amountLabel(ev, '−'), 'weak');
          await wait(paint(ev.side) + 300);
        })();
      }
      case 'immune':
        tell(['no afecta a ', ...mon(ev.side, activeOf(ev.side).name), '.'], { side: 1 - ev.side, sub: true, cls: 'weak' });
        return 900;
      case 'hits':
        tell([`¡${ev.count} golpes!`], { side: 1 - ev.side, sub: true });
        return 600;
      case 'fizzle':
        tell([ev.weather === 'heavyrain' ? 'el ataque se apaga con el diluvio.' : 'el ataque se evapora con el sol abrasador.'], { side: ev.side, sub: true, cls: 'weak' });
        return 800;
      case 'notarget':
        tell(['no hay a quién atacar.'], { side: ev.side, sub: true, cls: 'weak' });
        return 600;
      case 'weather':
        view.field = { ...view.field, weather: ev.weather, weatherSuppressed: false };
        paintField();
        tell([WEATHER_START[ev.weather] ?? 'Cambia el clima.']);
        sound('weather', { weather: ev.weather, type: WEATHER_TYPE[ev.weather] });
        return Promise.all([sleep(900), fx.weather(ev.weather, WEATHER_TYPE[ev.weather] ?? 'normal')]);
      case 'weatherEnd':
        view.field = { ...view.field, weather: null };
        paintField();
        tell(['El clima vuelve a la normalidad.'], { cls: 'weak' });
        return 700;
      case 'terrain':
        view.field = { ...view.field, terrain: ev.terrain };
        paintField();
        tell([`Aparece un ${TERRAIN[ev.terrain] ?? 'campo'}.`]);
        sound('terrain', { terrain: ev.terrain });
        return Promise.all([sleep(900), fx.terrain(ev.terrain)]);
      case 'terrainEnd':
        view.field = { ...view.field, terrain: null };
        paintField();
        tell(['El campo vuelve a la normalidad.'], { cls: 'weak' });
        return 700;
      case 'screen': {
        const side = sd(ev.side);
        side.screens = { ...(side.screens || {}), [ev.screen]: ev.turns };
        paint(ev.side);
        tell([`${SCREEN[ev.screen]} protege al equipo de ${trainerShort(side.name)} contra ${SCREEN_GUARDS[ev.screen]}.`], { side: ev.side });
        return 900;
      }
      case 'screenEnd': {
        const side = sd(ev.side);
        const { [ev.screen]: _gone, ...rest } = side.screens || {};
        side.screens = rest;
        paint(ev.side);
        if (ev.cause === 'broken') anim(els.spot[pos(ev.side)], 'hit', 700);
        tell([(SCREEN_END[ev.cause] ?? SCREEN_END.time)(SCREEN[ev.screen], trainerShort(side.name))], { side: ev.side, cls: ev.cause === 'time' ? 'weak' : null });
        return 800;
      }
      case 'hazard':
        tell([`Púas tóxicas rodean al equipo de ${trainerShort(sd(ev.side).name)}.`], { side: ev.side, cls: 'weak' });
        return 800;
      case 'hazardEnd':
        tell([`Desaparecen las púas tóxicas del lado de ${trainerShort(sd(ev.side).name)}.`], { side: ev.side });
        return 700;
      case 'types': {
        const f = activeOf(ev.side);
        f.types = ev.types;
        paint(ev.side);
        tell([...mon(ev.side, f.name), ' ahora es de tipo ', typeChips(ev.types), '.'], { side: ev.side, sub: true });
        return 800;
      }
      case 'form': {
        const f = activeOf(ev.side);
        Object.assign(f, { stats: ev.stats, types: ev.types, hp: ev.hp, ...(ev.sprite ? { sprite: ev.sprite } : {}) });
        paint(ev.side);
        return 700;
      }
      case 'transform': {
        const f = activeOf(ev.side);
        Object.assign(f, { sprite: ev.sprite, floats: ev.floats, types: ev.types, stats: ev.stats, moves: ev.moves, boosts: ev.boosts });
        paint(ev.side);
        tell([...mon(ev.side, f.name), ` se transforma en ${ev.into}.`], { side: ev.side, sub: true });
        return 1000;
      }
      case 'heal': {
        sound('heal');
        const f = activeOf(ev.side);
        const before = f.hp;
        f.hp = ev.hp;
        popNumber(ev.side, amountLabel(ev, '+'), 'heal');
        const hpMs = paint(ev.side);
        tell([...mon(ev.side, f.name), ` recupera ${amountText(ev)} (${hpText(ev, before)} → ${hpText(ev, ev.hp)}).`], { side: ev.side, sub: true });
        return Math.max(1000, hpMs + 300);
      }
      case 'faint': {
        els.spot[pos(ev.side)].classList.remove('is-hidden-move');
        const f = activeOf(ev.side);
        setActing(null);
        return (async () => {
          cry(ev.side, true);
          await wait(900);
          sound('faint');
          f.hp = 0;
          paint(ev.side);
          await wait(500);
          tell(['💀 ', ...mon(ev.side, f.name), ' cae rendido.'], { side: ev.side, cls: 'ko' });
          await wait(700);
        })();
      }
      case 'switch': {
        const s = ev.side;
        const spot = els.spot[pos(s)];
        const from = ev.from || activeOf(s).name;
        const dragged = draggedSide === s;
        const recalling = !ev.forced && !dragged && activeOf(s)?.hp > 0;
        const who = isYou(s) ? 'mandas' : `${trainerShort(sd(s).name)} manda`;
        if (dragged) {
          draggedSide = null;
          tell(['Sale ', h('b', null, ev.name), ' en su lugar.'], { side: s });
        } else if (ev.forced) tell([isYou(s) ? 'Mandas a ' : `${trainerShort(sd(s).name)} manda a `, h('b', null, ev.name), '.'], { side: s });
        else tell([isYou(s) ? 'Retiras a ' : `${trainerShort(sd(s).name)} retira a `, h('b', null, from), ` y ${who} a `, h('b', null, ev.name), '.'], { side: s });
        return (async () => {
          if (recalling) {
            sound('switch');
            await fx.recall(spot);
            await wait(250);
          }
          spot.classList.remove('is-hidden-move');
          sd(s).active = ev.to;
          if (ev.mon) sd(s).team[ev.to] = ev.mon;
          if (ev.look) Object.assign(activeOf(s), ev.look);
          spot.classList.add('incoming');
          paint(s);
          await Promise.all([sendOut(s), sleep(1000)]);
        })();
      }
      case 'switchOut':
        tell([...mon(ev.side, ev.name), ' vuelve con su entrenador.'], { side: ev.side, sub: true });
        sound('switch');
        return Promise.all([sleep(700), fx.recall(els.spot[pos(ev.side)])]);
      case 'replace':
        tell([isYou(ev.side) ? 'Elige quién entra.' : `${trainerShort(sd(ev.side).name)} elige quién entra…`], { side: ev.side, cls: 'weak' });
        return 500;
      case 'protect':
        tell([...mon(ev.side, ev.name), ev.kind === 'endure' ? ' se prepara para aguantar.' : ' se protege.'], { side: ev.side, sub: true });
        return 700;
      case 'protected':
        sound('condition', { kind: 'protect' });
        tell(['¡', ...mon(ev.side, ev.name), ' se protegió!'], { side: ev.side, sub: true, cls: 'weak' });
        return Promise.all([sleep(800), fx.condition('protect', els.spot[pos(ev.side)])]);
      case 'protectBroken':
        tell(['¡Rompe la protección de ', ...mon(ev.side, ev.name), '!'], { side: ev.side, sub: true });
        return 700;
      case 'endured':
        tell(['¡', ...mon(ev.side, ev.name), ' aguantó el golpe!'], { side: ev.side, sub: true });
        return 800;
      case 'subDamage':
        anim(els.spot[pos(ev.side)], 'hit', 700);
        tell(['El sustituto de ', ...mon(ev.side, ev.name), ' recibe el golpe.'], { side: ev.side, sub: true });
        return 800;
      case 'sideStart': {
        const side = sd(ev.side);
        if (['spikes', 'stealthrock', 'stickyweb'].includes(ev.kind)) side.hazards = { ...(side.hazards || {}), [ev.kind]: ev.kind === 'spikes' ? ev.layers : true };
        else if (ev.kind === 'wish') side.wish = true;
        else if (!['quickguard', 'wideguard', 'craftyshield', 'matblock'].includes(ev.kind)) side.conds = { ...(side.conds || {}), [ev.kind]: true };
        paint(ev.side);
        tell([SIDE_COND[ev.kind]?.start(trainerShort(side.name), ev) ?? ''], { side: ev.side });
        return 900;
      }
      case 'sideEnd': {
        const side = sd(ev.side);
        if (side.hazards && ev.kind in side.hazards) side.hazards = { ...side.hazards, [ev.kind]: ev.kind === 'spikes' ? 0 : false };
        if (side.conds) delete side.conds[ev.kind];
        paint(ev.side);
        tell([SIDE_COND[ev.kind]?.end?.(trainerShort(side.name)) ?? ''], { side: ev.side, cls: 'weak' });
        return 700;
      }
      case 'fieldStart':
        view.field = { ...view.field, rooms: { ...(view.field.rooms || {}), [ev.kind]: true } };
        paintField();
        tell([ROOM[ev.kind]?.start ?? '']);
        return 900;
      case 'fieldEnd': {
        const rooms = { ...(view.field.rooms || {}) };
        delete rooms[ev.kind];
        view.field = { ...view.field, rooms };
        paintField();
        tell([ROOM[ev.kind]?.end ?? ''], { cls: 'weak' });
        return 700;
      }
      case 'boosts': {
        const f = activeOf(ev.side);
        f.boosts = { ...ev.boosts };
        paint(ev.side);
        tell(['Cambian las características de ', ...mon(ev.side, ev.name), '.'], { side: ev.side, sub: true });
        return 800;
      }
      case 'stats': {
        const f = activeOf(ev.side);
        if (!f.hpPercent) f.stats = { ...ev.stats };
        paint(ev.side);
        tell(['Cambian las stats de ', ...mon(ev.side, ev.name), '.'], { side: ev.side, sub: true });
        return 800;
      }
      case 'courtChange':
        [view.sides[0].hazards, view.sides[1].hazards] = [view.sides[1].hazards, view.sides[0].hazards];
        [view.sides[0].conds, view.sides[1].conds] = [view.sides[1].conds, view.sides[0].conds];
        [view.sides[0].screens, view.sides[1].screens] = [view.sides[1].screens, view.sides[0].screens];
        [view.sides[0].toxicSpikes, view.sides[1].toxicSpikes] = [view.sides[1].toxicSpikes, view.sides[0].toxicSpikes];
        paint(0);
        paint(1);
        tell(['Los dos equipos intercambian sus efectos de campo.']);
        return 900;
      case 'teamCured':
        for (const t of sd(ev.side).team) if (t.hp > 0) t.status = null;
        paint(ev.side);
        tell([`El equipo de ${trainerShort(sd(ev.side).name)} se cura de sus problemas de estado.`], { side: ev.side });
        return 900;
      case 'revive': {
        const t = sd(ev.side).team[ev.index];
        if (t) Object.assign(t, { hp: t.hpPercent ? Math.round((ev.hp / ev.max) * 100) : ev.hp, status: null });
        paint(ev.side);
        tell(['¡', h('b', null, ev.name), ' vuelve a la vida!'], { side: ev.side });
        return 1000;
      }
      case 'futureStart':
        tell([...mon(ev.side, ev.name), ` prevé un ataque: ${ev.move}.`], { side: ev.side, sub: true });
        return 800;
      case 'futureHit':
        anim(els.spot[pos(ev.side)], 'hit', 700);
        tell(['¡', h('b', null, ev.move), ' golpea a ', ...mon(ev.side, ev.name), '!'], { side: ev.side });
        return Promise.all([sleep(700), fx.move({ kind: 'attack', type: 'psychic', key: 'future-sight', flags: [] }, els.spot[pos(1 - ev.side)], els.spot[pos(ev.side)])]);
      case 'wish':
        tell([`¡Se cumple el deseo de ${ev.name}!`], { side: ev.side });
        return 700;
      case 'healingWish':
        tell([...mon(ev.side, ev.name), ev.kind === 'lunardance' ? ' recibe el baile lunar.' : ' recibe el deseo de cura.'], { side: ev.side });
        return 800;
      case 'stickyWeb':
        tell([...mon(ev.side, ev.name), ' queda atrapado en la red viscosa.'], { side: ev.side, sub: true, cls: 'weak' });
        return 700;
      case 'destinyBond':
        tell([`${ev.from} se lleva consigo a `, ...mon(ev.side, ev.name), '.'], { side: ev.side, cls: 'weak' });
        return 900;
      case 'grudge':
        tell(['Por el rencor, ', ...mon(ev.side, ev.name), ` pierde todos los PP de ${ev.move}.`], { side: ev.side, cls: 'weak' });
        return 800;
      case 'pp':
        tell([...mon(ev.side, ev.name), ` pierde ${ev.lost} PP de ${ev.move}.`], { side: ev.side, sub: true, cls: 'weak' });
        return 700;
      case 'learned':
        tell([...mon(ev.side, ev.name), ` aprende ${ev.move}.`], { side: ev.side, sub: true });
        return 800;
      case 'snatched':
        tell(['¡', ...mon(ev.side, ev.name), ` roba ${ev.move}!`], { side: ev.side });
        return 800;
      case 'bounced':
        tell(['¡', ...mon(ev.side, ev.name), ` devuelve ${ev.move}!`], { side: ev.side });
        return 800;
      case 'bide':
        tell([...mon(ev.side, ev.name), ' está aguantando.'], { side: ev.side, sub: true });
        return 700;
      case 'magnitude':
        tell([`¡Magnitud ${ev.n}!`], { side: ev.side, sub: true });
        return 600;
      case 'end':
        setActing(null);
        if (ev.reason === 'limit') log('Se llegó al límite de turnos: gana quien conserva más vida.', 'weak');
        if (ev.reason === 'forfeit' && ev.winner !== null) tell([`🏳 ${isYou(1 - ev.winner) ? 'Te rendiste' : `${trainerShort(sd(1 - ev.winner).name)} se rindió`}.`], { cls: 'weak' });
        tell([ev.winner === null ? 'Empate.' : isYou(ev.winner) ? '¡Ganaste la batalla! 🏆' : `¡${sd(ev.winner).name} gana la batalla!`], { cls: 'win' });
        return (async () => {
          await trainersReturn(ev.winner);
          await wait(600);
          showResult(ev.winner);
          await wait(1500);
        })();
    }
    return 0;
  }

  async function apply(msg) {
    if (dead) return;
    // A viewer who just accepted reconnects as a player: redraw from their side.
    const first = !frame || (msg.you != null && msg.you !== mine);
    frame = msg;
    if (first) {
      mine = msg.you ?? 0;
      chat?.setLeftSide(mine);
      view = clone(msg.state);
      const fighters = view.sides.flatMap((side) => side.team.filter(Boolean));
      const moveKeys = fighters.flatMap((f) => (f.moves ?? []).map((m) => m.key)).filter(Boolean);
      const animKeys = [...moveKeys, ...moveKeys.map(chargeAnim), ...COMMON_PRELOAD];
      music.preload({ sprites: fighters.map((f) => f.sprite), moves: animKeys });
      fx.preload(animKeys);
      const balls = view.sides.map((side) => side.ball ?? 'pb');
      fx.warmBalls(balls);
      music.preloadCues(balls.flatMap(ballSounds));
      for (const p of ['me', 'foe']) delete els.spot[p].dataset.key;
      paintAll();
      if (msg.state.status === 'active' && !els.log.childElementCount) {
        log(`${trainerShort(view.sides[0].name)} vs ${trainerShort(view.sides[1].name)}. ¡A pelear!`, 'turn');
        say(msg.you == null ? `${trainerShort(view.sides[0].name)} vs ${trainerShort(view.sides[1].name)}` : '¡A pelear! Elige tu jugada.');
        if (msg.state.turn === 1) {
          playing = true;
          renderControls();
          els.spot.foe.classList.add('incoming');
          els.spot.me.classList.add('incoming');
          await splash();
          paintTrainer(0);
          paintTrainer(1);
          await Promise.all([trainerSlide('foe', true), trainerSlide('me', true)]);
          await sendOut(1 - mine);
          trainerSlide('foe', false);
          await sendOut(mine);
          await trainerSlide('me', false);
          playing = false;
        }
        if (msg.state.intro?.length) {
          playing = true;
          renderControls();
          for (const ev of msg.state.intro) await settle(play(ev));
          setActing(null);
          playing = false;
          view = clone(msg.state);
          paintAll();
          say(msg.you == null ? 'Eligiendo…' : '¿Qué haces?');
        }
      }
      if (msg.state.status === 'finished') {
        const w = msg.state.winner;
        tell([w === null ? 'Empate.' : isYou(w) ? '¡Ganaste esta batalla! 🏆' : `¡${trainerShort(view.sides[w].name)} ganó esta batalla!`], { cls: 'win' });
        await trainersReturn(w);
        showResult(w);
      }
    } else if (msg.events?.length) {
      playing = true;
      sent = null;
      aiming = null;
      renderControls();
      if (msg.timedOut) log('⏱ Se acabó el tiempo: la máquina eligió por quien no alcanzó.', 'weak');
      let acted = false;
      for (const [i, ev] of msg.events.entries()) {
        if (dead) return;
        if (ev.t === 'move' || ev.t === 'switch' || ev.t === 'charging') {
          if (acted) await wait(ACTION_GAP_MS);
          acted = true;
        }
        await settle(play(ev, ev.t !== 'move' || moveLands(msg.events, i)));
      }
      setActing(null);
      playing = false;
      view = clone(msg.state);
      paintAll();
      if (view.status === 'active') say(frame.you == null ? 'Eligiendo…' : view.phase !== 'choose' && !view.sides[frame.you].mustSwitch ? `${trainerShort(view.sides[1 - frame.you].name)} elige quién entra…` : '¿Qué haces ahora?');
    } else if (msg.t === 'start' || msg.t === 'presence') {
      view = clone(msg.state);
      paintAll();
    }
    // Keep "Elegiste: …" while the server has our choice; a 'ready'/'presence' frame may race our own submit.
    if (msg.you != null && !msg.state.sides[msg.you].ready && msg.t !== 'ready' && msg.t !== 'presence') sent = null;
    renderControls();
  }

  return {
    push(msg) {
      if (msg.state) preloadFor(msg.you, msg.state.sides.map((side) => side.team.filter((f) => !f.hidden)));
      backlog += 1;
      queue = queue
        .then(() => apply(msg))
        .then(() => msg.state && !dead && sendSeen(msg.state.turn))
        .catch((e) => console.error(e))
        .finally(() => (backlog -= 1));
    },
    resultShown: () => shown,
    destroy() {
      dead = true;
      clearInterval(tick);
      resize.disconnect();
    },
  };
}

fallBackToRaw(document);
document.querySelector('footer.credits')?.append(feedbackButton());
// The first paint waits for the manifests only a moment: a request that stalls between Cloudflare
// and the tunnel would keep the page on "Cargando…" for as long as it lasts. A late sprite manifest
// repaints through retrySprites, which joins the request already in flight. Late faces only refresh
// the header, since a repaint would drop what the player typed, and the next page crops every
// avatar. A battle keeps waiting: repainting it would reconnect its socket mid-fight.
const MANIFEST_WAIT_MS = 1000;
const manifests = Promise.all([loadSprites(), loadFaces().then(renderWho)]);
(location.pathname.startsWith('/b/') ? manifests : Promise.race([manifests, sleep(MANIFEST_WAIT_MS)])).finally(route);

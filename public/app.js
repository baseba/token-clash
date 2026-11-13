import { creatureHTML, loadAnimatedSprites } from './creature.js?v=dev';
import { TYPES, typeLabel, effectiveness } from './types.js?v=dev';
import { sceneFor } from './backgrounds.js?v=dev';
import { createFx } from './fx.js?v=dev';
import { patchSave } from './savepatch.js?v=dev';
import { rememberSave, storedSave } from './savestore.js?v=dev';

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
const CANT = { recharge: 'necesita recargarse.', slp: 'está dormido.', frz: 'está congelado.', par: 'está paralizado: no puede moverse.', flinch: 'retrocede y no se mueve.', attract: 'está enamorado y no ataca.' };
const HURT = { leechseed: ' por las drenadoras', brn: ' por la quemadura', psn: ' por el veneno', tox: ' por el veneno', sand: ' por la tormenta de arena', hail: ' por el granizo', recoil: ' por el retroceso', ooze: ' por el lodo líquido', bound: ' por estar apresado', saltcure: ' por la salazón', crash: ' al estrellarse', cost: ' para potenciarse', ability: '' };
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
};
const VOLATILE_END = {
  disable: (ev) => `vuelve a poder usar ${ev.move}.`,
  bound: (ev) => `se libera de ${ev.move}.`,
  confusion: () => 'ya no está confuso.',
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
const INFLICT = { brn: 'quemar', par: 'paralizar', psn: 'envenenar', tox: 'envenenar gravemente', frz: 'congelar', slp: 'dormir' };
const STAT_THE = { atk: 'el ataque', def: 'la defensa', satk: 'el ataque especial', sdef: 'la defensa especial', spd: 'la velocidad', acc: 'la precisión', eva: 'la evasión' };
const stageMult = (k, s) => {
  const base = k === 'acc' || k === 'eva' ? 3 : 2;
  return s >= 0 ? (base + s) / base : base / (base - s);
};

function moveEffects(m) {
  const out = [];
  if (m.kind && m.kind !== 'attack') out.push(m.desc);
  if (m.priority > 0) out.push('Ataca primero.');
  if (m.contact) out.push('Hace contacto.');
  if (m.multihit) out.push('Golpea de 2 a 5 veces.');
  if (m.crit) out.push('Alta probabilidad de golpe crítico.');
  for (const s of m.secondary || []) {
    if (s.status) out.push(`${s.chance}% de ${INFLICT[s.status]}.`);
    if (s.flinch) out.push(`${s.chance}% de hacer retroceder.`);
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
      boosts.length
        ? h('p', null, boosts.map(([k, [label]]) => `${label} ${signed(f.boosts[k])} (×${stageMult(k, f.boosts[k]).toFixed(2).replace(/\.?0+$/, '')})`).join(' · '))
        : h('p', { class: 'muted' }, 'Sin cambios.'),
    ),
    own
      ? h('section', null, h('h3', null, 'Características'), h('div', { class: 'info-stats' }, [['PS', 'hp'], ['Ataque', 'atk'], ['Defensa', 'def'], ['At. Esp.', 'satk'], ['Def. Esp.', 'sdef'], ['Velocidad', 'spd']].map(([l, k]) => h('span', null, h('b', null, f.stats[k]), l))))
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

function renderWho() {
  $who.replaceChildren();
  if (!me) return;
  $who.append(h('span', { class: 'chip' }, `🧢 ${me.name}`), h('span', { class: 'chip' }, h('span', { class: 'w' }, `${me.wins}V`), ' · ', h('span', { class: 'l' }, `${me.losses}D`)));
}

// ---------- routing ----------
function nav(path) {
  history.pushState(null, '', path);
  route();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-link]');
  if (!a || a.origin !== location.origin || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault();
  nav(a.pathname);
});
window.addEventListener('popstate', route);

const $tip = h('div', { class: 'tip', role: 'tooltip', hidden: true });
document.body.append($tip);
let tipTarget = null;
function showTip(el) {
  tipTarget = el;
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
    if (!(img instanceof HTMLImageElement) || !img.closest('.creature')) return;
    const native = img.naturalWidth !== SPRITE_CANVAS || img.naturalHeight !== SPRITE_CANVAS;
    img.classList.toggle('native', native);
    img.style.width = native ? `${(img.naturalWidth / SPRITE_CANVAS) * 100}%` : '';
    img.style.height = native ? `${(img.naturalHeight / SPRITE_CANVAS) * 100}%` : '';
  },
  true,
);

function markNav() {
  const current = location.pathname === '/stats' ? 'stats' : location.pathname === '/' ? 'home' : null;
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function route() {
  hideTip();
  cleanup?.();
  cleanup = null;
  markNav();
  const m = /^\/b\/([A-Za-z0-9_-]{4,20})$/.exec(location.pathname);
  if (m) return battlePage(m[1]);
  if (location.pathname === '/equipo') return teamPage();
  if (location.pathname === '/stats') return statsPage();
  return homePage();
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

// ---------- home ----------
async function homePage() {
  document.title = 'Token Clash';
  await loadMe();
  renderWho();
  if (!me) return renderLanding();
  renderHome();
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
    feedbackButton(),
  );
}

function renderHome() {
  const byId = new Map(me.roster.map((f) => [f.uid, f]));
  const team = me.team.map((id) => byId.get(id)).filter(Boolean);
  let levelCap = null;
  let mode = 'team';
  let rival = 'friend';
  let aiLevel = 'mid';

  async function saveTeam(next) {
    try {
      me = (await api('/api/me', { method: 'PUT', body: { team: next } })).me;
      renderHome();
    } catch (e) {
      toast(e.message);
    }
  }
  function toggle(f) {
    const ids = me.team.slice();
    const i = ids.indexOf(f.uid);
    if (i >= 0) {
      if (ids.length === 1) return toast('Tu equipo necesita al menos un Pokémon');
      ids.splice(i, 1);
      return saveTeam(ids);
    }
    const added = addToParty(ids, f.uid);
    if (!added.swapped && ids.length >= PARTY_SIZE) return toast(`Tu equipo ya tiene ${PARTY_SIZE}: quita uno primero`);
    if (added.swapped) toast(swapNote(added.swapped, f));
    saveTeam(added.ids);
  }
  async function rename(f) {
    const n = window.prompt(`Apodo para ${f.speciesName} (vacío para quitarlo)`, f.nickname || '');
    if (n === null) return;
    try {
      me = (await api('/api/me', { method: 'PUT', body: { nickname: { id: f.uid, name: n } } })).me;
      renderHome();
    } catch (e) {
      toast(e.message);
    }
  }
  async function createChallenge(btn) {
    btn.disabled = true;
    try {
      const { challenge } = await api('/api/challenges', { method: 'POST', body: { levelCap, mode, ...(rival === 'ai' ? { ai: aiLevel } : {}) } });
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
  function paint() {
    aiField.classList.toggle('is-hidden', rival !== 'ai');
    aiNote.textContent = AI_NOTES[aiLevel][mode];
    startBtn.textContent = rival === 'ai' ? `🤖 Pelear contra la IA · ${AI_LABEL[aiLevel]}` : '⚔︎ Crear link de desafío';
  }
  const battleForm = h(
    'div',
    { class: 'nb-form' },
    field('Modo', h('div', { class: 'cards2', role: 'group', 'aria-label': 'Modo de juego' }, choice('pick', [
      { value: 'team', icon: MODE_ICON.team, label: MODE_LABEL.team, desc: `Los ${PARTY_SIZE} que armaste.` },
      { value: 'random', icon: MODE_ICON.random, label: MODE_LABEL.random, desc: `Los dados sortean ${PARTY_SIZE} de tu colección, con movimientos y habilidad al azar.` },
    ], mode, (v) => { mode = v; paint(); }))),
    field('Rival', h('div', { class: 'cards2', role: 'group', 'aria-label': 'Rival' }, choice('pick', [
      { value: 'friend', icon: '👥', label: 'Contra otro jugador', desc: 'Te damos un link para mandarle.' },
      { value: 'ai', icon: '🤖', label: 'La IA', desc: 'Peleas ahora mismo, con Pokémon de la 1.ª a la 5.ª generación.' },
    ], rival, (v) => { rival = v; paint(); }))),
    aiField,
    field('Nivel', h('div', { class: 'segmented', role: 'group', 'aria-label': 'Nivel' }, choice('seg', [{ value: null, label: 'Nivel real' }, { value: 50, label: 'Todos a nivel 50' }], levelCap, (v) => { levelCap = v; })), h('p', { class: 'nb-note' }, 'Nivel 50 empareja la pelea: gana la estrategia, no quién quemó más tokens.')),
    startBtn,
  );
  paint();

  const reimport = h('div', { hidden: true }, importCard({ onDone: renderHome }));

  $app.replaceChildren(
    h(
      'section',
      null,
      h('div', { class: 'row between' }, h('h1', null, `Hola, ${me.name}`), h('div', { class: 'row' }, h('span', { class: 'chip' }, `📚 ${me.rosterSize} Pokémon`), h('span', { class: 'chip' }, `✨ ${me.shinies} shiny`), h('span', { class: 'chip', tabindex: 0, 'data-tip': 'Tokens totales según PokeTokenBar' }, `🪙 ${compact(me.totalTokens)} tokens`))),
    ),
    h(
      'section',
      null,
      h('div', { class: 'team-head' }, h('h2', null, 'Tu equipo ', h('span', { class: 'party-count' }, `${team.length}/${PARTY_SIZE}`)), h('a', { class: 'btn sm primary', href: '/equipo', 'data-link': true }, '✎ Editar equipo')),
      h('div', { class: 'party-board' }, partyRow(team), h('p', { class: 'hint' }, `En cada pelea eliges ${BATTLE_SIZE} de estos ${PARTY_SIZE}. Toca uno para editar sus movimientos y su habilidad.`)),
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
    h(
      'section',
      null,
      h('div', { class: 'row between' }, h('h2', null, `Tu colección (${me.rosterSize})`), h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: downloadEditedSave }, '⬇ Descargar save editado'), h('button', { class: 'btn sm', onclick: () => { reimport.hidden = !reimport.hidden; } }, '↻ Actualizar save'))),
      reimport,
      h('div', { class: 'mons', style: null }, me.roster.map((f) => monCard(f, { picked: me.team.includes(f.uid), stats: true, badge: f.active ? 'Criando' : null, onclick: () => nav(`/equipo?p=${f.uid}`), onEdit: () => rename(f) }))),
    ),
    h('section', null, myChallengesCard()),
    h(
      'section',
      null,
      h('p', { class: 'muted small' }, 'Tu sesión vive en este navegador. Para entrar desde otro: ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); copy(`${location.origin}/#key=${token}`, 'Link de acceso copiado. No lo compartas: entra como tú.'); } }, 'copiar link de acceso'), '.'),
    ),
    feedbackButton(),
  );
}

function myChallengesCard() {
  const list = h('div', { class: 'list' }, h('p', { class: 'muted' }, 'Cargando…'));
  api('/api/me/challenges')
    .then(({ challenges }) => {
      if (!challenges.length) return list.replaceChildren(h('p', { class: 'muted' }, 'Todavía no hay batallas. ¡Crea un link!'));
      list.replaceChildren(
        ...challenges.map((c) => {
          const label = c.opponent ? `vs ${c.opponent}` : 'Esperando rival';
          const st =
            c.status === 'finished' ? (c.won ? h('span', { class: 'w' }, 'Ganaste') : h('span', { class: 'l' }, 'Perdiste'))
            : c.status === 'active' ? h('span', { class: 'pulse' }, 'En curso')
            : c.status === 'open' ? h('span', { class: 'muted' }, 'Abierto')
            : h('span', { class: 'muted' }, c.status === 'cancelled' ? 'Cancelado' : 'Cortado');
          return h('a', { class: 'item', href: `/b/${c.id}`, 'data-link': true }, h('span', null, label, h('span', { class: 'muted small' }, ` · ${MODE_ICON[c.mode] ?? MODE_ICON.team}`), c.levelCap ? h('span', { class: 'muted small' }, ' · Nv 50') : null), st);
        }),
      );
    })
    .catch(() => list.replaceChildren(h('p', { class: 'muted' }, 'No pude cargar tus batallas.')));
  return h('div', { class: 'card' }, h('h2', null, 'Tus batallas'), list);
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
    ? [h('p', { class: 'muted' }, 'Nadie ha llegado todavía. Sé el primero.')]
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
            h('span', { class: 'muted small recent-meta' }, `${MODE_ICON[c.mode] ?? MODE_ICON.team}${c.levelCap ? ' · Nv 50' : ''}${c.turns ? ` · ${c.turns} turnos` : ''} · ${ago(c.finishedAt)}`),
          ),
        ),
      )
    : h('p', { class: 'muted' }, 'Todavía no hay batallas entre jugadores.');
  return h('div', { class: 'card' }, h('h2', null, '🕑 Batallas recientes'), list);
}

function numbersCard(totals, live) {
  const rows = [
    ['⚔︎', 'Batallas entre jugadores', totals.battles],
    [MODE_ICON.random, 'De ellas, aleatorias', totals.randomBattles],
    ['⏱', 'Turnos por batalla (promedio)', totals.avgTurns ?? '—'],
    ['🤖', 'Peleas contra la IA', totals.aiBattles],
    ['📚', 'Especies distintas en el servidor', totals.species],
    ['🟢', 'Conectados ahora', live.online],
  ];
  return h('div', { class: 'card' }, h('h2', null, '📈 En números'), h('div', { class: 'list' }, rows.map(([icon, label, value]) => h('div', { class: 'item' }, h('span', null, `${icon} ${label}`), h('strong', { class: 'num-value' }, value)))));
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
            h('div', { class: 'top-mon-line' }, h('b', null, plural(m.uses, 'uso', 'usos')), h('span', { class: 'muted' }, ` · gana ${percent(m.wins / m.uses)}`)),
          ),
        ),
      )
    : h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Aparecen cuando haya batallas entre jugadores.'));
  return h('section', null, h('div', { class: 'row between' }, h('h2', null, '🔥 Pokémon más usados'), h('span', { class: 'muted small' }, 'En batallas entre jugadores')), body);
}

async function statsPage() {
  document.title = 'Stats · Token Clash';
  await loadMe();
  renderWho();
  $app.replaceChildren(h('p', { class: 'muted center pad' }, 'Cargando…'));
  let data;
  try {
    data = await api('/api/stats');
  } catch (e) {
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'No pude cargar las stats'), h('p', { class: 'muted' }, e.message)));
    return;
  }
  const { totals, ranking, recent, topMons, live } = data;
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
          h('span', { class: 'chip live-chip' }, h('i', { class: 'live-dot', 'aria-hidden': 'true' }), `${plural(live.battles, 'batalla', 'batallas')} en vivo`),
          h('span', { class: 'chip' }, `🧢 ${plural(totals.trainers, 'entrenador', 'entrenadores')}`),
          h('span', { class: 'chip' }, `📚 ${compact(totals.pokemon)} Pokémon`),
          h('span', { class: 'chip' }, `✨ ${totals.shinies} shiny`),
          h('span', { class: 'chip', tabindex: 0, 'data-tip': 'Tokens de todos los entrenadores según PokeTokenBar' }, `🪙 ${compact(totals.tokens)} tokens`),
        ),
      ),
    ),
    h('section', null, rankingCard(ranking)),
    h('section', { class: 'grid2' }, recentCard(recent), numbersCard(totals, live)),
    topMonsSection(topMons),
    h('section', null, h('p', { class: 'muted small center' }, `Versión ${live.version} · servidor encendido ${ago(live.startedAt)}`)),
    feedbackButton(),
  );
}

// ---------- team ----------
const PARTY_SIZE = 6;
const MODE_ICON = { team: '🎒', random: '🎲' };
const MODE_LABEL = { team: 'Batalla con tu equipo', random: 'Batalla aleatoria' };
const AI_ORDER = ['easy', 'mid', 'hard', 'veryhard', 'skynet'];
const AI_LABEL = { easy: 'Fácil', mid: 'Media', hard: 'Difícil', veryhard: 'Muy difícil', skynet: 'Skynet' };
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
      if (!f) return h('a', { class: 'party-cell empty', href: '/equipo', 'data-link': true, 'aria-label': 'Agregar un Pokémon' }, ballFrame(null), h('div', { class: 'name-plate' }, h('b', null, '???')));
      return h(
        'a',
        { class: 'party-cell', href: `/equipo?p=${f.uid}`, 'aria-label': `Editar a ${f.name}`, onclick: (e) => { e.preventDefault(); nav(`/equipo?p=${f.uid}`); } },
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

async function teamPage() {
  await loadMe();
  renderWho();
  if (!me) return nav('/');
  document.title = 'Tu equipo · Token Clash';
  const params = new URLSearchParams(location.search);
  let selected = params.get('p') || me.team[0] || me.roster[0]?.uid;
  let query = '';
  let typeFilter = '';
  let shinyFilter = '';
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
  function select(uid) {
    if (editor?.dirty() && !window.confirm('Tienes cambios sin guardar. ¿Descartarlos?')) return;
    selected = uid;
    history.replaceState(null, '', `/equipo?p=${uid}`);
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
          h('button', { class: 'cell-remove', type: 'button', 'data-tip': 'Quitar del equipo', 'aria-label': `Quitar a ${f.name}`, onclick: (e) => { e.stopPropagation(); toggle(f.uid); } }, '✕'),
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

  function paintCollection() {
    const q = query.toLowerCase();
    const list = me.roster.filter((f) => (!q || f.name.toLowerCase().includes(q) || f.speciesName.toLowerCase().includes(q)) && (!typeFilter || f.types.includes(typeFilter)) && (!shinyFilter || (shinyFilter === 'shiny') === !!f.shiny));
    grid.replaceChildren(
      ...(list.length
        ? list.map((f) => {
            const inParty = me.team.includes(f.uid);
            return monCard(f, {
              stats: true,
              badge: `#${f.speciesId}`,
              cls: `coll-card${inParty ? ' in-party' : ''}${f.uid === selected ? ' selected' : ''}`,
              label: `Editar a ${f.name}`,
              onclick: () => select(f.uid),
              extra: h('button', { class: `col-add${inParty ? ' on' : ''}`, type: 'button', 'data-tip': inParty ? 'Quitar del equipo' : 'Agregar al equipo', 'aria-label': inParty ? `Quitar a ${f.name} del equipo` : `Agregar a ${f.name} al equipo`, onclick: (e) => { e.stopPropagation(); toggle(f.uid); }, onkeydown: (e) => e.stopPropagation() }, inParty ? '✓' : '+'),
            });
          })
        : [h('p', { class: 'muted' }, 'Ningún Pokémon coincide con el filtro.')]),
    );
  }

  async function openEditor() {
    if (!selected) return panel.replaceChildren(h('p', { class: 'muted' }, 'Elige un Pokémon para ver sus movimientos.'));
    panel.replaceChildren(h('div', { class: 'panel-loading pulse' }, 'Cargando…'));
    editor = await monPanel(selected, panel, {
      inParty: () => me.team.includes(selected),
      toggleParty: () => toggle(selected),
      onSaved: () => {
        paintParty();
        paintCollection();
      },
    });
  }

  const shinySelect = h('select', { 'aria-label': 'Filtrar shiny', onchange: (e) => { shinyFilter = e.target.value; paintCollection(); } }, h('option', { value: '' }, 'Shiny y normales'), h('option', { value: 'shiny' }, '✨ Solo shiny'), h('option', { value: 'plain' }, 'Solo normales'));
  const typeSelect = h('select', { 'aria-label': 'Filtrar por tipo', onchange: (e) => { typeFilter = e.target.value; paintCollection(); } }, h('option', { value: '' }, 'Todos los tipos'), Object.keys(TYPES).map((t) => h('option', { value: t }, typeLabel(t))));
  $app.replaceChildren(
    h('div', { class: 'team-head' }, h('h1', null, 'Tu equipo ', countEl), h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: downloadEditedSave, 'data-tip': 'Baja tu save con los movimientos y habilidades que cambiaste, para importarlo en PokeTokenBar' }, '⬇ Descargar save editado'), h('a', { class: 'btn sm', href: '/', 'data-link': true }, '← Inicio'))),
    h('section', { class: 'party-board' }, partyEl, h('p', { class: 'hint' }, `Arrastra para ordenar · el líder abre la pelea · antes de cada combate eliges ${BATTLE_SIZE} de estos ${PARTY_SIZE}`)),
    panel,
    h('section', { class: 'collection-board' }, h('div', { class: 'row between' }, h('h2', null, `Colección `, h('span', { class: 'muted' }, `(${me.rosterSize})`)), h('div', { class: 'coll-filters' }, h('input', { type: 'search', placeholder: 'Buscar por nombre…', 'aria-label': 'Buscar Pokémon', oninput: (e) => { query = e.target.value.trim(); paintCollection(); } }), typeSelect, shinySelect)), grid),
  );
  paintParty();
  paintCollection();
  openEditor();
}

async function monPanel(uid, panel, { inParty, toggleParty, onSaved }) {
  let mon;
  try {
    mon = (await api(`/api/me/mons/${uid}`)).mon;
  } catch (e) {
    panel.replaceChildren(h('p', { class: 'error' }, e.message));
    return null;
  }
  const original = { moves: mon.movepool.filter((m) => m.chosen).map((m) => m.key), ability: mon.ability };
  if (!original.moves.length) original.moves = mon.moves.map((m) => m.key);
  let moves = original.moves.slice();
  let ability = original.ability;
  let filter = '';
  let onlyUsable = true;
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
    const rows = mon.movepool.filter((m) => (!onlyUsable || m.supported) && (!q || m.name.toLowerCase().includes(q) || typeLabel(m.type).toLowerCase().includes(q)));
    tbody.replaceChildren(
      ...(rows.length
        ? rows.map((m) => {
            const on = moves.includes(m.key);
            return h(
              'tr',
              { class: `${on ? 'on' : ''}${m.supported ? '' : ' unsupported'}`, tabindex: m.supported ? 0 : -1, 'aria-disabled': m.supported ? null : 'true', onclick: () => m.supported && toggleMove(m.key), onkeydown: (e) => e.key === 'Enter' && m.supported && toggleMove(m.key) },
              h('td', { class: 'num' }, m.level ?? '—'),
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
          h('label', { class: 'toggle' }, h('input', { type: 'checkbox', checked: true, onchange: (e) => { onlyUsable = e.target.checked; paint(); } }), ' Solo los que funcionan en Token Clash'),
        ),
        h('div', { class: 'move-table-wrap' }, h('table', { class: 'move-table' }, h('thead', null, h('tr', null, ['Nv', 'Movimiento', 'Tipo', 'Cat.', 'Poder', 'Prec.', 'PP'].map((t) => h('th', null, t)))), tbody)),
      ),
    ),
    saveBar,
  );
  paint();
  return { dirty, refreshPartyButton };
}

// ---------- battle ----------
async function battlePage(id) {
  await loadMe();
  renderWho();
  let c;
  try {
    c = (await api(`/api/challenges/${id}`)).challenge;
  } catch (e) {
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, 'No encontré esa batalla'), h('p', { class: 'muted' }, e.message), h('a', { class: 'btn', href: '/', 'data-link': true }, 'Ir al inicio')));
    return;
  }
  document.title = `${c.host.name} desafía · Token Clash`;

  if (c.status === 'cancelled' || c.status === 'abandoned') {
    $app.replaceChildren(h('div', { class: 'card banner' }, h('h2', null, c.status === 'cancelled' ? 'Desafío cancelado' : 'Esta batalla se cortó'), h('p', { class: 'muted' }, c.status === 'cancelled' ? `${c.host.name} lo canceló.` : 'El servidor se reinició a mitad de la pelea. Pide un link nuevo.'), h('a', { class: 'btn primary', href: '/', 'data-link': true }, 'Ir al inicio')));
    return;
  }

  let closed = false;
  let ws = null;
  let retry = 0;
  let battle = null; // battle UI controller, once a battle exists
  let prep = null;
  cleanup = () => {
    closed = true;
    ws?.close();
    battle?.destroy();
    prep?.destroy();
  };

  function connect() {
    if (closed) return;
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
    ws.onopen = () => {
      retry = 0;
      ws.send(JSON.stringify({ t: 'hello', room: id, token }));
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === 'error') return toast(msg.error);
      if (msg.preview) {
        prep ??= previewUI(c, (picks) => ws?.readyState === 1 && ws.send(JSON.stringify({ t: 'pick', picks })));
        prep.update(msg);
        return;
      }
      if (!msg.state) return;
      if (prep) {
        prep.destroy();
        prep = null;
      }
      if (!battle) {
        battle = battleUI(c, (action) => ws?.readyState === 1 && ws.send(JSON.stringify({ t: 'act', action })));
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
    battle = battleUI(c, () => {});
    battle.push({ state: c.final, you: you === -1 ? null : you, actions: [], deadline: null });
    return;
  }

  if (c.status === 'open') renderLobby(c, { onAccepted: reconnect });
  connect();
}

function renderLobby(c, { onAccepted }) {
  const mine = me && c.host.id === me.id;
  const link = `${location.origin}/b/${c.id}`;
  const random = c.mode === 'random';
  const capNote = [
    h('span', { class: 'chip' }, `${MODE_ICON[c.mode] ?? MODE_ICON.team} ${MODE_LABEL[c.mode] ?? MODE_LABEL.team}`),
    c.levelCap ? h('span', { class: 'chip' }, 'Todos a nivel 50') : h('span', { class: 'chip' }, 'Nivel real'),
  ];
  const diceTeam = (n) => h('div', { class: 'mini-team' }, Array.from({ length: n }, (_, i) => h('div', { class: 'mon mon-hidden', 'aria-label': 'Pokémon por sortear' }, h('span', { class: 'badge' }, i + 1), h('div', { class: 'die idle' }, DIE_FACES[i % DIE_FACES.length]), h('div', { class: 'nm' }, '???'))));
  const randomHint = h('p', { class: 'muted small' }, `Cuando los dos estén listos, los dados sortean ${PARTY_SIZE} Pokémon de la colección de cada uno, sin repetir, con movimientos y habilidad al azar.`);

  if (mine) {
    const input = h('input', { type: 'text', readonly: true, value: link, 'aria-label': 'Link del desafío', onfocus: (e) => e.target.select() });
    $app.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h('h1', null, 'Tu desafío está listo'),
        h('p', { class: 'muted' }, 'Mándale este link a otro jugador. La pelea parte apenas lo acepte; deja esta página abierta para jugar en vivo.'),
        h('div', { class: 'share' }, input, h('button', { class: 'btn primary', onclick: () => copy(link, 'Link copiado, ¡a provocar!') }, 'Copiar')),
        h('div', { class: 'row', style: null }, capNote, h('span', { class: 'muted pulse' }, '⏳ Esperando rival…')),
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
      }, 'Cancelar desafío')),
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
        h('button', { class: 'btn primary', onclick: (e) => accept(e.currentTarget) }, '⚔︎ Aceptar desafío'),
      )
    : importCard({ onDone: () => renderLobby(c, { onAccepted }) });

  $app.replaceChildren(
    h('section', null, h('h1', null, `${c.host.name} te desafía`), h('div', { class: 'row' }, capNote, h('span', { class: 'muted' }, 'Pelea en vivo por turnos. Si alguien no elige en 60 s, su Pokémon ataca solo.'))),
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

const DIE_FACES = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const ROLL_START_MS = 700;
const ROLL_STEP_MS = 450;
const rolledRooms = new Set();

function previewUI(c, sendPick) {
  let last = null;
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
  $app.replaceChildren(h('div', { class: 'status-line' }, h('b', null, '⚔︎ Preparación de batalla'), timerText), h('div', { class: 'prep-timer' }, bar), root);
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
  const revealClass = (s, i) => (rollingOn(s) && i === justRevealed ? ' reveal' : '');

  function choose(i, needed) {
    if (sent || rollingOn(last?.you)) return;
    const at = picks.indexOf(i);
    if (at >= 0) picks.splice(at, 1);
    else if (picks.length < needed) picks.push(i);
    else return toast(`Ya elegiste ${needed}: toca uno para sacarlo.`);
    render();
  }

  function render() {
    const p = last.preview;
    const you = last.you;
    const own = you != null ? p.sides[you] : null;
    const foe = p.sides[you == null ? 1 : 1 - you];
    const seen = (side, title, s) =>
      h(
        'div',
        { class: 'card prep-side' },
        h('div', { class: 'row between' }, h('h2', null, title), rollingOn(s) ? h('span', { class: 'muted small pulse' }, '🎲 Sorteando…') : side.ready ? h('span', { class: 'chip ready-chip' }, '✓ Listo') : h('span', { class: 'muted small pulse' }, 'Eligiendo…')),
        h('div', { class: 'prep-grid' }, side.party.map((f, i) => (rollingOn(s) && i >= revealed ? dieCard(i) : h('div', { class: `prep-card seen${entered || rollingOn(s) ? '' : ' enter'}${revealClass(s, i)}`, style: { animationDelay: `${i * 70}ms` } }, h('div', { html: creatureHTML(f) }), h('b', null, f.name, genderMark(f.gender)), typeChips(f.types ?? []))))),
      );
    if (!own) {
      root.replaceChildren(seen(p.sides[0], p.sides[0].name, 0), h('div', { class: 'vs-mark' }, 'VS'), seen(p.sides[1], p.sides[1].name, 1));
      entered = true;
      return;
    }
    const done = own.ready || sent;
    const random = p.mode === 'random';
    const chosen = own.picks ?? picks;
    const mine = h(
      'div',
      { class: 'card prep-side mine' },
      h('h2', null, rollingOn(you) ? '🎲 Lanzando los dados…' : done ? 'Tu equipo para esta pelea' : `Elige ${own.needed} de tus ${own.party.length}`),
      h('p', { class: 'muted small' }, rollingOn(you) ? 'Sorteando Pokémon, movimientos y habilidades de tu colección.' : done ? 'El primero sale a pelear.' : 'Tócalos en el orden en que quieres usarlos: el primero sale a pelear. Si se acaba el tiempo, se eligen al azar.'),
      h(
        'div',
        { class: 'prep-grid' },
        own.party.map((f, i) => {
          if (rollingOn(you) && i >= revealed) return dieCard(i);
          const order = chosen.indexOf(i);
          return h(
            'button',
            { type: 'button', class: `prep-card${entered || rollingOn(you) ? '' : ' enter'}${revealClass(you, i)}${order >= 0 ? ' chosen' : ''}${done && order < 0 ? ' benched' : ''}`, style: { animationDelay: entered ? '0ms' : `${i * 70}ms` }, disabled: done || rollingOn(you), onclick: () => choose(i, own.needed) },
            order >= 0 ? h('span', { class: 'badge' }, order + 1) : null,
            h('div', { html: creatureHTML(f) }),
            h('b', null, f.name, genderMark(f.gender)),
            h('small', { class: 'muted' }, `Nv ${f.level}`),
            typeChips(f.types),
            random && f.abilityInfo ? abilityChip(f.abilityInfo) : null,
            h('small', { class: 'prep-moves muted' }, f.moves.map((m) => m.name).join(' · ')),
          );
        }),
      ),
      rollingOn(you)
        ? h('p', { class: 'pulse' }, '🎲 Los dados están rodando…')
        : done
        ? h('p', { class: 'pulse' }, foe.ready ? '¡Comienza la batalla!' : `Esperando a ${foe.name}…`)
        : h('button', { type: 'button', class: 'btn primary', disabled: picks.length !== own.needed || rolling, onclick: () => { sent = true; sendPick(picks.slice()); render(); } }, `Continuar (${picks.length}/${own.needed})`),
    );
    root.replaceChildren(mine, h('div', { class: 'vs-mark' }, 'VS'), seen(foe, `Equipo de ${foe.name}`, p.sides.indexOf(foe)));
    entered = true;
  }

  return {
    update(msg) {
      const first = !last;
      last = msg;
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

function battleUI(c, sendAction) {
  let frame = null; // last frame from the server
  let view = null; // what is on screen (lags behind frame while events play)
  let playing = false;
  let mine = 0;
  let sent = null; // label of the action we sent this turn, until the turn resolves
  let queue = Promise.resolve();

  const sideAt = (p) => (p === 'me' ? mine : 1 - mine);
  const hud = (p) => {
    const r = { name: h('span'), lvl: h('span'), sub: h('div', { class: 'sub' }), bar: h('i'), num: h('div', { class: 'hpnum' }) };
    const info = h('button', { class: 'info-btn', type: 'button', 'data-tip': 'Ver info', 'aria-label': 'Ver info del Pokémon', onclick: () => openInfo(sideAt(p)) }, 'i');
    r.el = h('div', { class: `hud ${p}` }, h('div', { class: 'nm' }, r.name, h('span', { class: 'nm-end' }, r.lvl, info)), r.sub, h('div', { class: 'hp' }, r.bar), r.num);
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
    hud: { foe: hud('foe'), me: hud('me') },
    info: h('dialog', { class: 'info-dlg', onclick: (e) => e.target === e.currentTarget && e.currentTarget.close() }),
    say: h('div', { class: 'say', 'aria-live': 'polite' }),
    controls: h('div', { class: 'card' }),
    log: h('div', { class: 'card log' }),
  };
  const scene = sceneFor(c.id);
  const arena = h('div', { class: 'arena', style: { backgroundImage: `url(${scene.image})` } }, els.ground, els.spot.foe, els.spot.me, els.sky, els.hud.foe.el, els.hud.me.el);
  arena.style.setProperty('--pad-me-fill', scene.me[0]);
  arena.style.setProperty('--pad-me-rim', scene.me[1]);
  arena.style.setProperty('--pad-foe-fill', scene.foe[0]);
  arena.style.setProperty('--pad-foe-rim', scene.foe[1]);
  const fx = createFx(arena);
  $app.replaceChildren(
    h('div', { class: 'status-line' }, els.turn, els.vs, els.field, els.timer),
    h('div', { class: 'stage' }, arena, els.say),
    h('div', { class: 'battle-layout' }, els.controls, els.log),
    els.info,
  );

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
  const activeOf = (side) => view.sides[side].team[view.sides[side].active];
  const isYou = (side) => frame?.you === side;
  // "tu Bigfin" / "Bigfin de Pedro": the same creature can be on both teams, so always say whose.
  const mon = (side, name) => (isYou(side) ? ['tu ', h('b', null, name)] : [h('b', null, name), ` de ${view.sides[side].name}`]);
  const capFirst = (parts) => {
    const [first, ...rest] = parts.flat();
    return typeof first === 'string' ? [first.replace(/\p{L}/u, (ch) => ch.toUpperCase()), ...rest] : [first, ...rest];
  };
  // Skip the show when the tab is hidden, so coming back doesn't replay a backlog.
  const wait = (ms) => (document.hidden ? Promise.resolve() : sleep(ms));
  const settle = (r) => (typeof r === 'number' ? wait(r) : r);

  function log(parts, cls) {
    els.log.append(h('p', { class: cls || null }, parts));
    els.log.scrollTop = els.log.scrollHeight;
  }
  function say(parts, side) {
    els.say.className = `say${side == null ? '' : ` by-${pos(side)}`}`;
    // The same nodes also go to the log, so the banner gets copies.
    els.say.replaceChildren(h('span', null, [parts].flat(Infinity).map((n) => (n instanceof Node ? n.cloneNode(true) : n))));
  }
  function tell(parts, { side = null, cls = null, sub = false } = {}) {
    const text = capFirst(parts);
    say(text, side);
    log(sub ? ['↳ ', ...text] : text, [side == null ? '' : `by-${pos(side)}`, sub ? 'sub' : '', cls || ''].filter(Boolean).join(' '));
  }

  function anim(el, cls, ms = 600) {
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }
  // Floating text over a creature: damage numbers, "¡Falla!", "+20 PV"…
  function float(side, text, cls) {
    const spot = els.spot[pos(side)];
    const el = h('span', { class: `float ${cls || ''}` }, text);
    spot.append(el);
    setTimeout(() => el.remove(), 1400);
  }
  function abilityPop(side, ev) {
    const spot = els.spot[pos(side)];
    spot.querySelector('.ab-pop')?.remove();
    const el = h('div', { class: `ab-pop ${pos(side)}`, 'aria-hidden': 'true' }, h('small', null, ev.name), h('b', null, ev.ability));
    spot.append(el);
    anim(spot, 'power', 600);
    setTimeout(() => el.remove(), 1900);
  }

  async function splash() {
    const el = h('div', { class: 'vs-splash' }, h('b', { class: 'me' }, view.sides[mine].name), h('span', null, 'VS'), h('b', { class: 'foe' }, view.sides[1 - mine].name));
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
    const title = { win: '¡VICTORIA!', lose: 'DERROTA', draw: 'EMPATE', watch: `¡Gana ${view.sides[winner]?.name ?? ''}!` }[kind];
    const sub = { win: `Venciste a ${view.sides[1 - mine].name}.`, lose: `${view.sides[1 - mine].name} ganó esta vez.`, draw: 'Nadie quedó en pie.', watch: `${view.sides[0].name} vs ${view.sides[1].name}` }[kind];
    const icon = { win: '🏆', lose: '💀', draw: '🤝', watch: '🏁' }[kind];
    const el = h('div', { class: `result ${kind}`, onclick: () => el.remove() }, h('div', { class: 'result-card' }, h('span', { class: 'result-icon' }, icon), h('h2', null, title), h('p', null, sub), h('small', null, 'Toca para cerrar')));
    arena.append(el);
    if (kind === 'win' || kind === 'watch') confetti(el);
  }

  function openInfo(side) {
    if (!view) return;
    const f = activeOf(side);
    const own = isYou(side) || view.status === 'finished';
    els.info.replaceChildren(infoCard(f, { own, owner: view.sides[side].name, close: () => els.info.close() }));
    if (!els.info.open) els.info.showModal();
  }

  function setActing(side) {
    for (const p of ['me', 'foe']) els.hud[p].el.classList.toggle('acting', side != null && pos(side) === p);
    for (const p of ['me', 'foe']) els.spot[p].classList.toggle('acting', side != null && pos(side) === p);
  }

  const amountText = (ev) => (ev.pct ? `${ev.amount}%` : `${ev.amount} PV`);
  const hpText = (ev, v) => (ev.pct ? `${v}%` : `${v}`);
  const floatAmount = (ev, sign) => `${sign}${ev.amount}${ev.pct ? '%' : ''}`;

  function countTo(el, from, to, max, percent = false) {
    const label = (n) => (percent ? `${n}%` : `${n} / ${max} PV`);
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 500);
      el.textContent = label(Math.round(from + (to - from) * k));
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
      spot.innerHTML = creatureHTML(f, { back: p === 'me' });
      enter = true;
    }
    spot.classList.toggle('faint', f.hp <= 0);
    const screens = sd.screens || {};
    for (const kind of Object.keys(SCREEN)) spot.classList.toggle(`screen-${kind}`, !!screens[kind] && f.hp > 0);
    const shownStatus = f.hp > 0 && f.status ? f.status : '';
    if (shownStatus) spot.dataset.status = shownStatus;
    else delete spot.dataset.status;
    let aura = spot.querySelector('.status-aura');
    if (!aura) {
      aura = h('div', { class: 'status-aura', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'));
      spot.append(aura);
    }
    if (enter) anim(spot, 'enter', 500);

    const pct = Math.max(0, (f.hp / f.stats.hp) * 100);
    r.bar.className = pct < 20 ? 'low' : pct < 50 ? 'mid' : '';
    if (fresh) {
      r.bar.style.transition = 'none';
      r.bar.style.width = `${pct}%`;
      void r.bar.offsetWidth;
      r.bar.style.transition = '';
    } else r.bar.style.width = `${pct}%`;
    const shown = Number(r.num.dataset.to);
    countTo(r.num, fresh || Number.isNaN(shown) ? f.hp : shown, f.hp, f.stats.hp, !!f.hpPercent);

    r.name.replaceChildren(f.shiny ? `✨ ${f.name}` : f.name, genderMark(f.gender) ?? '');
    r.lvl.textContent = `Nv ${f.level}`;
    const boosts = Object.entries(STAT)
      .filter(([k]) => f.boosts[k])
      .map(([k, [label]]) => `${label} ${signed(f.boosts[k])}`)
      .join(' · ');
    const volatiles = conditionsOf({ volatiles: f.volatiles }).filter((c) => ['confusion', 'attract', 'perish', 'charge', 'bound', 'trapped', 'saltcure'].includes(c.key));
    r.sub.replaceChildren(
      ...[
        typeChips(f.types),
        f.status ? h('span', { class: `cond ${f.status}`, tabindex: 0, 'data-tip': STATUS_INFO[f.status].name, 'data-tip-note': STATUS_INFO[f.status].desc }, statusLabel(f.status)) : null,
        h('span', { class: 'owner' }, isYou(side) ? `${sd.name} (tú)` : sd.name),
        boosts ? h('span', { class: 'boosts' }, boosts) : null,
        ...volatiles.map((c) => h('span', { class: 'vol-chip', tabindex: 0, 'data-tip': c.name, 'data-tip-note': c.desc }, `${c.icon} ${c.name}`)),
        ...Object.entries(sd.screens || {}).map(([kind, turns]) => h('span', { class: `screen-chip ${kind}`, tabindex: 0, 'data-tip': `Reduce a la mitad el daño de ${SCREEN_GUARDS[kind]} contra este equipo. Quedan ${turns} turnos.` }, `🛡️ ${SCREEN[kind]} ${turns}`)),
        h('span', { class: 'dots', 'aria-label': 'Equipo' }, sd.team.map((t) => h('i', { class: t.hp <= 0 ? 'out' : null }))),
      ].filter(Boolean),
    );
  }

  function paintField() {
    const fl = view.field || {};
    const parts = [fl.weather ? `${WEATHER[fl.weather] ?? fl.weather}${fl.weatherSuppressed ? ' (sin efecto)' : ''}` : null, fl.terrain ? TERRAIN[fl.terrain] ?? fl.terrain : null].filter(Boolean);
    els.field.textContent = parts.join(' · ');
    els.sky.className = `sky${fl.weather ? ` ${fl.weather}` : ''}${fl.weatherSuppressed ? ' suppressed' : ''}`;
    els.ground.className = `terrain-glow${fl.terrain ? ` ${fl.terrain}` : ''}`;
  }

  function paintAll() {
    paint(0);
    paint(1);
    paintField();
    els.turn.textContent = view.status === 'finished' ? 'Fin de la batalla' : `Turno ${view.turn}`;
    const tag = (side) => h('span', { class: `who by-${pos(side)}` }, isYou(side) ? `${view.sides[side].name} (tú)` : view.sides[side].name);
    els.vs.replaceChildren(tag(mine), h('span', { class: 'muted' }, ' vs '), tag(1 - mine));
  }

  function renderControls() {
    const st = frame.state;
    const you = frame.you;
    const foeName = st.sides[1 - mine].name;
    const box = els.controls;
    box.replaceChildren();

    if (st.status === 'finished') {
      if (playing) {
        box.append(h('p', { class: 'pulse' }, 'Mirando el turno…'));
        return;
      }
      const won = st.winner === you;
      const title = st.winner === null ? 'Empate' : you === null ? `¡Gana ${st.sides[st.winner].name}!` : won ? '¡Ganaste! 🏆' : 'Perdiste… 😵';
      box.append(
        h('div', { class: 'banner' }, h('h2', null, title), h('p', { class: 'muted' }, `${st.sides[0].name} vs ${st.sides[1].name} · ${st.turn} turnos`)),
        h(
          'div',
          { class: 'row', style: null },
          me
            ? h('button', {
                class: 'btn primary',
                onclick: async (e) => {
                  e.currentTarget.disabled = true;
                  try {
                    const { challenge } = await api('/api/challenges', { method: 'POST', body: { levelCap: c.levelCap, mode: c.mode, ...(c.ai ? { ai: c.ai } : {}) } });
                    nav(`/b/${challenge.id}`);
                  } catch (err) {
                    toast(err.message);
                  }
                },
              }, c.ai ? '⚔︎ Revancha' : '⚔︎ Revancha (nuevo link)')
            : null,
          h('a', { class: 'btn', href: '/', 'data-link': true }, 'Inicio'),
        ),
      );
      return;
    }

    if (you === null) {
      box.append(h('h2', null, 'Estás mirando'), h('p', { class: 'muted' }, `${st.sides[0].name} vs ${st.sides[1].name}. Para pelear tú, crea tu propio desafío.`), h('a', { class: 'btn', href: '/', 'data-link': true }, 'Ir al inicio'));
      return;
    }

    if (playing) {
      box.append(h('p', { class: 'pulse' }, 'Mirando el turno…'));
      return;
    }
    const acts = frame.actions;
    const foeReady = st.sides[1 - you].ready;
    if (!acts.length || sent) {
      const waitingFor = st.phase === 'replace' && st.sides[1 - you].mustSwitch ? `Esperando a que ${foeName} elija quién entra…` : `Esperando a ${foeName}…`;
      if (sent) box.append(h('p', null, 'Elegiste: ', h('b', null, sent), '.'));
      box.append(h('p', { class: 'pulse' }, waitingFor));
      return;
    }
    const meSide = st.sides[you];
    const f = meSide.team[meSide.active];
    const foe = st.sides[1 - you].team[st.sides[1 - you].active];
    const act = (a, label) => {
      sent = label;
      sendAction(a);
      renderControls();
    };

    if (st.phase === 'replace') box.append(h('h2', null, `${f.name} no puede seguir. ¿Quién entra?`));
    else {
      box.append(h('h2', null, `¿Qué hace ${f.name}?`));
      const moveSet = new Set(acts.filter((a) => a.type === 'move').map((a) => a.move));
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
                : [h('span', { class: 'mv-desc' }, m.desc)];
            return h(
              'button',
              { class: `move${pp === 0 ? ' no-pp' : ''}`, 'data-tip': m.kind === 'attack' ? m.desc : null, 'data-tip-note': pp === 0 ? 'Sin PP: no se puede usar.' : null, disabled: !moveSet.has(i), onclick: () => act({ type: 'move', move: i }, m.name) },
              h('span', { class: 'mv' }, m.name, h('small', { class: `pp${pp <= Math.ceil(m.pp / 4) ? ' low' : ''}` }, `PP ${pp}/${m.pp}`)),
              h('span', { class: 'mi' }, typeChip(m.type), info),
            );
          }),
          moveSet.has(-1) ? h('button', { class: 'move struggle', onclick: () => act({ type: 'move', move: -1 }, 'Forcejeo') }, h('span', { class: 'mv' }, 'Forcejeo'), h('span', { class: 'mi' }, h('span', null, 'Sin PP: daña al rival y a ti'))) : null,
        ),
      );
    }
    const sw = acts.filter((a) => a.type === 'switch');
    if (sw.length) {
      box.append(
        h('p', { class: 'muted small' }, st.phase === 'replace' ? '' : 'Cambiar (gasta el turno):'),
        h('div', { class: 'bench' }, sw.map((a) => {
          const t = meSide.team[a.to];
          return h('button', { class: 'btn', onclick: () => act(a, `cambiar a ${t.name}`) }, h('span', { html: creatureHTML(t) }), `${t.name} · ${t.hp}/${t.stats.hp}`);
        })),
      );
    }
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

  function showDamage(ev, linger) {
    const f = activeOf(ev.side);
    const before = f.hp;
    f.hp = ev.hp;
    paint(ev.side);
    anim(els.spot[pos(ev.side)], 'hit', 500);
    anim(els.hud[pos(ev.side)].el, 'hurt', 600);
    float(ev.side, floatAmount(ev, '−'), ev.crit || ev.eff > 1 ? 'dmg big' : ev.eff < 1 ? 'dmg small' : 'dmg');
    const notes = [ev.crit ? '¡Golpe crítico!' : '', ev.eff > 1 ? '¡Es muy eficaz!' : ev.eff < 1 ? 'No es muy eficaz…' : ''].filter(Boolean).join(' ');
    tell([...mon(ev.side, f.name), ` pierde ${amountText(ev)} (${hpText(ev, before)} → ${hpText(ev, ev.hp)})`, notes ? h('span', { class: ev.eff < 1 && !ev.crit ? 'weak' : 'strong' }, ` ${notes}`) : ''], { side: ev.side, sub: true });
    return linger;
  }

  async function playHit(ev, hit) {
    const move = currentMove.ev;
    const from = els.spot[pos(move.side)];
    if ((move.flags || []).includes('contact')) anim(from, `lunge-${pos(move.side)}`, 400);
    await fx.move({ ...move, multihit: false }, from, els.spot[pos(ev.side)]);
    showDamage(ev, 0);
    float(ev.side, `${hit}×`, 'hit-count');
    await wait(hit > 1 ? 380 : 450);
  }

  function play(ev) {
    const sd = (s) => view.sides[s];
    switch (ev.t) {
      case 'turn':
        currentMove = null;
        setActing(null);
        els.turn.textContent = `Turno ${ev.turn}`;
        log(`Turno ${ev.turn}`, 'turn');
        return 350;
      case 'move': {
        setActing(ev.side);
        currentMove = ev.kind === 'attack' ? { ev, hits: 0 } : null;
        if (ev.kind === 'attack' && (ev.flags || []).includes('contact')) anim(els.spot[pos(ev.side)], `lunge-${pos(ev.side)}`, 500);
        else anim(els.spot[pos(ev.side)], 'power', 600);
        tell([...mon(ev.side, ev.name), ' usa ', h('b', { class: 'mvname' }, ev.move), ev.type ? ' ' : '', ev.type ? typeChip(ev.type) : '', ev.why ? h('small', { class: 'why' }, ` · ${WHY[ev.why]}`) : ''], { side: ev.side });
        if (ev.multihit) return sleep(350);
        return Promise.all([sleep(450), wait(250).then(() => fx.move(ev, els.spot[pos(ev.side)], els.spot[pos(1 - ev.side)]))]);
      }
      case 'damage': {
        const hit = currentMove && currentMove.ev.side === 1 - ev.side ? ++currentMove.hits : 0;
        const repeated = hit > 0 && (currentMove.ev.multihit || hit > 1);
        if (repeated) return playHit(ev, hit);
        return showDamage(ev, 1050);
      }
      case 'miss': {
        const t = 1 - ev.side;
        anim(els.spot[pos(t)], 'dodge', 500);
        float(t, '¡Esquiva!', 'miss');
        tell(['falla: ', ...mon(t, activeOf(t).name), ' lo esquiva.'], { side: ev.side, sub: true, cls: 'weak' });
        return 900;
      }
      case 'nothing':
        float(ev.side, '¡Falló!', 'miss');
        tell(['¡pero falló!', ev.reason ? h('small', { class: 'why' }, ` · ${NOTHING_WHY[ev.reason]}`) : ''], { side: ev.side, sub: true, cls: 'weak' });
        return ev.reason ? 1100 : 800;
      case 'focus':
        anim(els.spot[pos(ev.side)], 'power', 600);
        tell([...mon(ev.side, ev.name), ` ${FOCUS_TEXT[ev.key] ?? 'se prepara…'}`], { side: ev.side, sub: true });
        return 800;
      case 'dragged':
        anim(els.spot[pos(ev.side)], 'dodge', 500);
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
      case 'charging':
        anim(els.spot[pos(ev.side)], 'power', 600);
        tell([...mon(ev.side, ev.name), ` se prepara para usar ${ev.move}…`], { side: ev.side, sub: true });
        return 900;
      case 'boost': {
        const f = activeOf(ev.side);
        const [label, word] = STAT[ev.stat] ?? [ev.stat, ev.stat];
        const up = (ev.by ?? 1) > 0;
        f.boosts[ev.stat] = ev.stage;
        paint(ev.side);
        float(ev.side, `${label} ${up ? '▲' : '▼'}`, up ? 'up' : 'miss');
        tell([...mon(ev.side, f.name), ` ${up ? 'sube' : 'baja'} su ${word}${Math.abs(ev.by ?? 1) >= 2 ? ' mucho' : ''} (${signed(ev.stage)}).`], { side: ev.side, sub: true, cls: up ? null : 'weak' });
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
        const f = activeOf(ev.side);
        f.status = ev.status;
        paint(ev.side);
        float(ev.side, statusLabel(ev.status), `status-float ${ev.status}`);
        tell([...mon(ev.side, f.name), ` ${STATUS_TEXT[ev.status]}.`], { side: ev.side, sub: true, cls: 'weak' });
        return Promise.all([sleep(700), fx.status(ev.status, els.spot[pos(ev.side)])]);
      }
      case 'cure': {
        const f = activeOf(ev.side);
        f.status = null;
        paint(ev.side);
        float(ev.side, '✓ Curado', 'up');
        anim(els.spot[pos(ev.side)], 'cured', 700);
        tell([...mon(ev.side, f.name), ` ${CURE_TEXT[ev.status] ?? 'se recupera'}.`], { side: ev.side, sub: true });
        return Promise.all([sleep(800), fx.impact('fairy', els.spot[pos(ev.side)])]);
      }
      case 'cant': {
        if (ev.reason === 'truant') return 0;
        const spot = els.spot[pos(ev.side)];
        tell([...mon(ev.side, ev.name), ` ${CANT[ev.reason] ?? 'no puede moverse.'}`], { side: ev.side, cls: 'weak' });
        if (STATUS_INFO[ev.reason]) {
          float(ev.side, statusLabel(ev.reason), `status-float ${ev.reason}`);
          anim(spot, `afflicted-${ev.reason}`, 900);
          return Promise.all([sleep(900), fx.status(ev.reason, spot)]);
        }
        if (ev.reason === 'attract') {
          float(ev.side, '💔', 'status-float');
          anim(spot, 'afflicted-slp', 900);
          return 900;
        }
        if (ev.reason === 'flinch') {
          float(ev.side, '¡Retrocede!', 'miss');
          anim(spot, 'afflicted-frz', 700);
          return Promise.all([sleep(800), fx.condition('flinch', spot)]);
        }
        float(ev.side, '…', 'miss');
        return 900;
      }
      case 'confused': {
        const spot = els.spot[pos(ev.side)];
        float(ev.side, '😵 Confuso', 'status-float');
        anim(spot, 'dizzy', 1100);
        tell([...mon(ev.side, ev.name), ' está confuso…'], { side: ev.side, sub: true, cls: 'weak' });
        return Promise.all([sleep(800), fx.condition('confusion', spot)]);
      }
      case 'infatuated': {
        const spot = els.spot[pos(ev.side)];
        float(ev.side, '💘 Enamorado', 'status-float');
        tell([...mon(ev.side, ev.name), ` está enamorado de ${ev.by}.`], { side: ev.side, sub: true, cls: 'weak' });
        return Promise.all([sleep(800), fx.condition('attract', spot)]);
      }
      case 'volatile': {
        const f = activeOf(ev.side);
        f.volatiles = { ...f.volatiles, [ev.kind]: ev.kind === 'perish' ? 4 : ev.kind === 'bound' ? ev.move : true };
        paint(ev.side);
        tell([...mon(ev.side, ev.name), ` ${VOLATILE[ev.kind]?.(ev) ?? ''}`], { side: ev.side, sub: true, cls: 'weak' });
        if (ev.kind === 'confusion') anim(els.spot[pos(ev.side)], 'dizzy', 1100);
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
        const f = activeOf(ev.side);
        const before = f.hp;
        f.hp = ev.hp;
        paint(ev.side);
        anim(els.hud[pos(ev.side)].el, 'hurt', 600);
        float(ev.side, floatAmount(ev, '−'), 'dmg small');
        if (STATUS_INFO[ev.cause]) {
          anim(els.spot[pos(ev.side)], `afflicted-${ev.cause}`, 900);
          fx.status(ev.cause, els.spot[pos(ev.side)]);
        }
        const condition = { leechseed: 'leechdrain', bound: 'bound', saltcure: 'saltcure', confusion: 'confusion' }[ev.cause];
        if (condition) fx.condition(condition, els.spot[pos(ev.side)], els.spot[pos(1 - ev.side)]);
        if (ev.cause === 'confusion') anim(els.spot[pos(ev.side)], 'dizzy', 1100);
        const why = ev.cause === 'confusion' ? ' se hiere a sí mismo' : ` pierde ${amountText(ev)}${HURT[ev.cause] ?? ''}`;
        tell([...mon(ev.side, f.name), `${why} (${hpText(ev, before)} → ${hpText(ev, ev.hp)}).`], { side: ev.side, sub: true, cls: 'weak' });
        return 900;
      }
      case 'immune':
        float(ev.side, 'Inmune', 'miss');
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
        return 900;
      case 'weatherEnd':
        view.field = { ...view.field, weather: null };
        paintField();
        tell(['El clima vuelve a la normalidad.'], { cls: 'weak' });
        return 700;
      case 'terrain':
        view.field = { ...view.field, terrain: ev.terrain };
        paintField();
        tell([`Aparece un ${TERRAIN[ev.terrain] ?? 'campo'}.`]);
        return 900;
      case 'terrainEnd':
        view.field = { ...view.field, terrain: null };
        paintField();
        tell(['El campo vuelve a la normalidad.'], { cls: 'weak' });
        return 700;
      case 'screen': {
        const side = sd(ev.side);
        side.screens = { ...(side.screens || {}), [ev.screen]: ev.turns };
        paint(ev.side);
        anim(els.spot[pos(ev.side)], 'power', 600);
        tell([`${SCREEN[ev.screen]} protege al equipo de ${side.name} contra ${SCREEN_GUARDS[ev.screen]}.`], { side: ev.side });
        return 900;
      }
      case 'screenEnd': {
        const side = sd(ev.side);
        const { [ev.screen]: _gone, ...rest } = side.screens || {};
        side.screens = rest;
        paint(ev.side);
        if (ev.cause === 'broken') anim(els.spot[pos(ev.side)], 'hit', 400);
        tell([(SCREEN_END[ev.cause] ?? SCREEN_END.time)(SCREEN[ev.screen], side.name)], { side: ev.side, cls: ev.cause === 'time' ? 'weak' : null });
        return 800;
      }
      case 'hazard':
        tell([`Púas tóxicas rodean al equipo de ${sd(ev.side).name}.`], { side: ev.side, cls: 'weak' });
        return 800;
      case 'hazardEnd':
        tell([`Desaparecen las púas tóxicas del lado de ${sd(ev.side).name}.`], { side: ev.side });
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
        anim(els.spot[pos(ev.side)], 'power', 600);
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
        const f = activeOf(ev.side);
        const before = f.hp;
        f.hp = ev.hp;
        paint(ev.side);
        float(ev.side, floatAmount(ev, '+'), 'heal');
        tell([...mon(ev.side, f.name), ` recupera ${amountText(ev)} (${hpText(ev, before)} → ${hpText(ev, ev.hp)}).`], { side: ev.side, sub: true });
        return 1000;
      }
      case 'faint': {
        const f = activeOf(ev.side);
        f.hp = 0;
        setActing(null);
        paint(ev.side);
        tell(['💀 ', ...mon(ev.side, f.name), ' cae rendido.'], { side: ev.side, cls: 'ko' });
        return 1200;
      }
      case 'switch': {
        const s = ev.side;
        const from = ev.from || activeOf(s).name;
        sd(s).active = ev.to;
        if (ev.mon) sd(s).team[ev.to] = ev.mon;
        if (ev.look) Object.assign(activeOf(s), ev.look);
        paint(s);
        const who = isYou(s) ? 'mandas' : `${sd(s).name} manda`;
        if (draggedSide === s) {
          draggedSide = null;
          tell(['Sale ', h('b', null, ev.name), ' en su lugar.'], { side: s });
        } else if (ev.forced) tell([isYou(s) ? 'Mandas a ' : `${sd(s).name} manda a `, h('b', null, ev.name), '.'], { side: s });
        else tell([isYou(s) ? 'Retiras a ' : `${sd(s).name} retira a `, h('b', null, from), ` y ${who} a `, h('b', null, ev.name), '.'], { side: s });
        return 1000;
      }
      case 'replace':
        tell([isYou(ev.side) ? 'Elige quién entra.' : `${sd(ev.side).name} elige quién entra…`], { side: ev.side, cls: 'weak' });
        return 500;
      case 'end':
        setActing(null);
        if (ev.reason === 'limit') log('Se llegó al límite de turnos: gana quien conserva más vida.', 'weak');
        tell([ev.winner === null ? 'Empate.' : isYou(ev.winner) ? '¡Ganaste la batalla! 🏆' : `¡${sd(ev.winner).name} gana la batalla!`], { cls: 'win' });
        showResult(ev.winner);
        return 1500;
    }
    return 0;
  }

  async function apply(msg) {
    // A viewer who just accepted reconnects as a player: redraw from their side.
    const first = !frame || (msg.you != null && msg.you !== mine);
    frame = msg;
    if (first) {
      mine = msg.you ?? 0;
      view = clone(msg.state);
      for (const p of ['me', 'foe']) delete els.spot[p].dataset.key;
      paintAll();
      if (msg.state.status === 'active' && !els.log.childElementCount) {
        log(`${view.sides[0].name} vs ${view.sides[1].name}. ¡A pelear!`, 'turn');
        say(msg.you == null ? `${view.sides[0].name} vs ${view.sides[1].name}` : '¡A pelear! Elige tu jugada.');
        if (msg.state.turn === 1) {
          playing = true;
          renderControls();
          await splash();
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
        tell([w === null ? 'Empate.' : isYou(w) ? '¡Ganaste esta batalla! 🏆' : `¡${view.sides[w].name} ganó esta batalla!`], { cls: 'win' });
        showResult(w);
      }
    } else if (msg.events?.length) {
      playing = true;
      sent = null;
      renderControls();
      if (msg.timedOut) log('⏱ Se acabó el tiempo: la máquina eligió por quien no alcanzó.', 'weak');
      for (const ev of msg.events) await settle(play(ev));
      setActing(null);
      playing = false;
      view = clone(msg.state);
      paintAll();
      if (view.status === 'active') say(frame.you == null ? 'Eligiendo…' : view.phase === 'replace' && !view.sides[frame.you].mustSwitch ? `${view.sides[1 - frame.you].name} elige quién entra…` : '¿Qué haces ahora?');
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
      queue = queue.then(() => apply(msg)).catch((e) => console.error(e));
    },
    destroy() {
      clearInterval(tick);
    },
  };
}

loadAnimatedSprites().finally(route);

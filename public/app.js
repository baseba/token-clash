import { creatureHTML } from './creature.js?v=dev';
import { TYPES, typeLabel, effectiveness } from './types.js?v=dev';
import { sceneFor } from './backgrounds.js?v=dev';

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
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v); // CSSOM, so CSP-safe
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
const clone = (x) => JSON.parse(JSON.stringify(x));
const compact = (n) => new Intl.NumberFormat('es', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
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

const STATUS = { brn: 'QUE', par: 'PAR', psn: 'ENV', tox: 'TÓX', slp: 'DOR', frz: 'CON' };
const STATUS_TEXT = { brn: 'se quema', par: 'queda paralizado', psn: 'queda envenenado', tox: 'queda gravemente envenenado', slp: 'se duerme', frz: 'se congela' };
const CURE_TEXT = { brn: 'ya no está quemado', par: 'ya no está paralizado', psn: 'ya no está envenenado', tox: 'ya no está envenenado', slp: 'se despierta', frz: 'se descongela' };
const WEATHER = { sun: '☀️ Sol', rain: '🌧️ Lluvia', sand: '🌪️ Tormenta de arena', snow: '❄️ Nieve', harshsun: '🔆 Sol abrasador', heavyrain: '⛈️ Diluvio', winds: '🌀 Turbulencias' };
const WEATHER_START = { sun: 'El sol pega fuerte.', rain: 'Empieza a llover.', sand: 'Se desata una tormenta de arena.', snow: 'Empieza a nevar.', harshsun: 'El sol abrasa: los ataques de Agua se evaporan.', heavyrain: 'Cae un diluvio: los ataques de Fuego se apagan.', winds: 'Soplan turbulencias que protegen a los Volador.' };
const TERRAIN = { electric: '⚡ Campo Eléctrico', grassy: '🌿 Campo de Hierba', misty: '🌫️ Campo de Niebla', psychic: '🔮 Campo Psíquico' };
const STAT = { atk: ['ATQ', 'ataque'], def: ['DEF', 'defensa'], satk: ['AT.E', 'ataque especial'], sdef: ['DF.E', 'defensa especial'], spd: ['VEL', 'velocidad'], acc: ['PRE', 'precisión'], eva: ['EVA', 'evasión'] };
const CANT = { slp: 'está dormido.', frz: 'está congelado.', par: 'está paralizado: no puede moverse.', flinch: 'retrocede y no se mueve.', attract: 'está enamorado y no ataca.' };
const HURT = { brn: ' por la quemadura', psn: ' por el veneno', tox: ' por el veneno', sand: ' por la tormenta de arena', recoil: ' por el retroceso', ooze: ' por el lodo líquido', ability: '' };
const VOLATILE = {
  confusion: () => 'queda confuso.',
  attract: () => 'se enamora.',
  disable: (ev) => `no puede usar ${ev.move}.`,
  perish: () => 'oye el canto mortal: caerá en 3 turnos.',
  charge: () => 'se carga de electricidad.',
};
const ABILITY_NOTE = {
  noDrop: () => 'evita que le bajen las características.',
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
const STATUS_NAME = { brn: 'Quemado', par: 'Paralizado', psn: 'Envenenado', tox: 'Gravemente envenenado', slp: 'Dormido', frz: 'Congelado' };
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
  return out;
}

function infoCard(f, { own, owner, close }) {
  const pct = Math.max(0, Math.round((f.hp / f.stats.hp) * 100));
  const gender = f.gender === 'male' ? ' ♂' : f.gender === 'female' ? ' ♀' : '';
  const vol = f.volatiles || {};
  const conditions = [
    f.status ? STATUS_NAME[f.status] : null,
    vol.confusion ? 'Confuso' : null,
    vol.attract ? 'Enamorado' : null,
    vol.perish ? `Canto mortal: ${vol.perish - 1}` : null,
    vol.charge ? 'Cargado' : null,
    vol.flashFire ? 'Absorbe Fuego activo' : null,
    vol.disabled ? `No puede usar ${vol.disabled}` : null,
    vol.slowStart ? 'Inicio lento' : null,
  ].filter(Boolean);
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
        h('h2', null, f.shiny ? `✨ ${f.name}` : f.name, h('span', { class: 'muted' }, gender)),
        h('p', { class: 'muted small' }, f.name !== f.speciesName ? `${f.speciesName} · ` : '', `Nv ${f.level} · de ${owner}`),
        typeChips(f.types),
      ),
    ),
    h('section', null, h('h3', null, 'PS'), h('p', null, own ? `${f.hp} / ${f.stats.hp} PV (${pct}%)` : `${pct}%`)),
    h('section', null, h('h3', null, 'Estado'), h('p', null, conditions.length ? conditions.join(' · ') : 'Sin problemas de estado.')),
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
  return h('span', { class: `ability${info.inert ? ' inert' : ''}`, title: info.inert ? `${info.desc}\n\n${info.inert}` : info.desc }, info.name);
}

function monCard(f, opts = {}) {
  const clickable = !!opts.onclick;
  return h(
    'div',
    {
      class: `mon${opts.picked ? ' picked' : ''}`,
      tabindex: clickable ? 0 : null,
      role: clickable ? 'button' : null,
      'aria-pressed': clickable ? String(!!opts.picked) : null,
      onclick: opts.onclick,
      onkeydown: clickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onclick(); } } : null,
    },
    opts.badge ? h('span', { class: 'badge' }, opts.badge) : null,
    f.shiny ? h('span', { class: 'shiny', title: 'Brillante' }, '✨') : null,
    h('div', { html: creatureHTML(f) }),
    h('div', { class: 'nm', title: f.name !== f.speciesName ? `${f.name} (${f.speciesName})` : f.name }, f.name),
    h('div', { class: 'meta' }, typeChips(f.types), h('span', null, `Nv ${f.level}`), opts.rarity !== false ? h('span', null, RARITY[f.rarity] || '') : null),
    f.abilityInfo ? h('div', { class: 'ab-line' }, abilityChip(f.abilityInfo)) : null,
    opts.stats
      ? h('div', { class: 'stats' }, ...[['PV', 'hp'], ['ATQ', 'atk'], ['DEF', 'def'], ['AT.E', 'satk'], ['DF.E', 'sdef'], ['VEL', 'spd']].map(([l, k]) => h('span', null, h('b', null, f.stats[k]), l)))
      : null,
    opts.onEdit ? h('button', { class: 'edit', title: 'Ponerle apodo', 'aria-label': `Apodo para ${f.name}`, onclick: (e) => { e.stopPropagation(); opts.onEdit(); } }, '✎') : null,
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

function route() {
  cleanup?.();
  cleanup = null;
  const m = /^\/b\/([A-Za-z0-9_-]{4,20})$/.exec(location.pathname);
  if (m) return battlePage(m[1]);
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
      if (data.token) {
        token = data.token;
        ls.set('tc_token', token);
      }
      me = data.me;
      renderWho();
      toast(`¡Listo! ${me.rosterSize} criaturas importadas`);
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
    h('p', { class: 'muted small' }, 'Solo guardamos números: especie, nivel, rareza, IVs y si es brillante. Nada de tu Mac ni de tus logs.'),
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

function renderLanding() {
  $app.replaceChildren(
    h(
      'div',
      { class: 'hero' },
      h(
        'div',
        null,
        h('h1', null, 'Tus tokens criaron criaturas. Ahora a pelear.'),
        h('p', { class: 'lead' }, 'Sube el save de PokeTokenBar, arma un equipo de 3 y manda un link a tus colegas. Cada especie pelea con su tipo real, sus golpes y stats según el nivel que le diste a punta de tokens.'),
        h('div', { class: 'hero-mons' }, [0, 1, 2].map((i) => h('div', { html: creatureHTML(demoMon(i)) }))),
      ),
      importCard({ onDone: renderHome }),
    ),
    h('section', null, leaderboardCard()),
  );
}

function renderHome() {
  const byId = new Map(me.roster.map((f) => [f.uid, f]));
  const team = me.team.map((id) => byId.get(id)).filter(Boolean);
  let levelCap = null;

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
      if (ids.length === 1) return toast('Tu equipo necesita al menos una criatura');
      ids.splice(i, 1);
    } else if (ids.length >= 3) return toast('Tu equipo ya tiene 3: quita uno primero');
    else ids.push(f.uid);
    saveTeam(ids);
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
      const { challenge } = await api('/api/challenges', { method: 'POST', body: { levelCap } });
      nav(`/b/${challenge.id}`);
    } catch (e) {
      toast(e.message);
      btn.disabled = false;
    }
  }

  const capBtns = [
    h('button', { class: 'btn sm primary', 'aria-pressed': 'true' }, 'Nivel real'),
    h('button', { class: 'btn sm', 'aria-pressed': 'false' }, 'Todos a nivel 50'),
  ];
  capBtns.forEach((b, i) =>
    b.addEventListener('click', () => {
      levelCap = i === 1 ? 50 : null;
      capBtns.forEach((x, j) => {
        x.classList.toggle('primary', i === j);
        x.setAttribute('aria-pressed', String(i === j));
      });
    }),
  );

  const reimport = h('div', { hidden: true }, importCard({ onDone: renderHome }));
  const sorted = [...me.roster].sort((a, b) => b.level - a.level || (b.shiny ? 1 : 0) - (a.shiny ? 1 : 0));

  $app.replaceChildren(
    h(
      'section',
      null,
      h('div', { class: 'row between' }, h('h1', null, `Hola, ${me.name}`), h('div', { class: 'row' }, h('span', { class: 'chip' }, `📚 ${me.rosterSize} criaturas`), h('span', { class: 'chip' }, `✨ ${me.shinies} brillantes`), h('span', { class: 'chip', title: 'Tokens totales según PokeTokenBar' }, `🪙 ${compact(me.totalTokens)} tokens`))),
    ),
    h(
      'section',
      { class: 'grid2' },
      h(
        'div',
        { class: 'card' },
        h('h2', null, 'Tu equipo'),
        h('div', { class: 'team-slots' }, [0, 1, 2].map((i) => (team[i] ? monCard(team[i], { badge: i + 1, stats: true, rarity: false, onclick: () => toggle(team[i]) }) : h('div', { class: 'slot-empty' }, 'Vacío')))),
        h('p', { class: 'muted small' }, 'Toca criaturas de tu colección para meterlas o sacarlas. La primera abre la pelea.'),
      ),
      h(
        'div',
        { class: 'card' },
        h('h2', null, 'Desafiar a un colega'),
        h('p', { class: 'muted' }, 'Se crea un link con tu equipo actual. Quien lo abra pelea contra ti en vivo, por turnos de 60 segundos.'),
        h('div', { class: 'row', role: 'group', 'aria-label': 'Nivel' }, capBtns),
        h('p', { class: 'muted small' }, '“Nivel 50” empareja la pelea: gana la estrategia, no quién quemó más tokens.'),
        h('button', { class: 'btn primary', onclick: (e) => createChallenge(e.currentTarget) }, '⚔︎ Crear link de desafío'),
      ),
    ),
    h(
      'section',
      null,
      h('div', { class: 'row between' }, h('h2', null, `Tu colección (${me.rosterSize})`), h('button', { class: 'btn sm', onclick: () => { reimport.hidden = !reimport.hidden; } }, '↻ Actualizar save')),
      reimport,
      h('div', { class: 'mons', style: null }, sorted.map((f) => monCard(f, { picked: me.team.includes(f.uid), stats: true, badge: f.active ? 'Criando' : null, onclick: () => toggle(f), onEdit: () => rename(f) }))),
    ),
    h('section', { class: 'grid2' }, myChallengesCard(), leaderboardCard()),
    h(
      'section',
      null,
      h('p', { class: 'muted small' }, 'Tu sesión vive en este navegador. Para entrar desde otro: ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); copy(`${location.origin}/#key=${token}`, 'Link de acceso copiado. No lo compartas: entra como tú.'); } }, 'copiar link de acceso'), '.'),
    ),
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
          return h('a', { class: 'item', href: `/b/${c.id}`, 'data-link': true }, h('span', null, label, c.levelCap ? h('span', { class: 'muted small' }, ' · Nv 50') : null), st);
        }),
      );
    })
    .catch(() => list.replaceChildren(h('p', { class: 'muted' }, 'No pude cargar tus batallas.')));
  return h('div', { class: 'card' }, h('h2', null, 'Tus batallas'), list);
}

function leaderboardCard() {
  const list = h('div', { class: 'list' }, h('p', { class: 'muted' }, 'Cargando…'));
  api('/api/leaderboard')
    .then(({ trainers }) => {
      if (!trainers.length) return list.replaceChildren(h('p', { class: 'muted' }, 'Nadie ha llegado todavía. Sé el primero.'));
      list.replaceChildren(
        ...trainers.map((t, i) =>
          h('div', { class: 'item' }, h('span', { class: 'row' }, h('span', { class: 'rank' }, `#${i + 1}`), h('strong', null, t.name), h('span', { class: 'muted small' }, `${t.rosterSize} criaturas · ${compact(t.totalTokens)} tokens`)), h('span', null, h('span', { class: 'w' }, `${t.wins}V`), ' ', h('span', { class: 'l' }, `${t.losses}D`))),
        ),
      );
    })
    .catch(() => list.replaceChildren(h('p', { class: 'muted' }, 'No pude cargar el ranking.')));
  return h('div', { class: 'card' }, h('h2', null, '🏆 Ranking de la oficina'), list);
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
  cleanup = () => {
    closed = true;
    ws?.close();
    battle?.destroy();
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
      if (!msg.state) return;
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
  const capNote = c.levelCap ? h('span', { class: 'chip' }, 'Todos a nivel 50') : h('span', { class: 'chip' }, 'Nivel real');

  if (mine) {
    const input = h('input', { type: 'text', readonly: true, value: link, 'aria-label': 'Link del desafío', onfocus: (e) => e.target.select() });
    $app.replaceChildren(
      h(
        'section',
        { class: 'card' },
        h('h1', null, 'Tu desafío está listo'),
        h('p', { class: 'muted' }, 'Mándale este link a un colega. La pelea parte apenas lo acepte; deja esta página abierta para jugar en vivo.'),
        h('div', { class: 'share' }, input, h('button', { class: 'btn primary', onclick: () => copy(link, 'Link copiado, ¡a provocar!') }, 'Copiar')),
        h('div', { class: 'row', style: null }, capNote, h('span', { class: 'muted pulse' }, '⏳ Esperando rival…')),
      ),
      h('section', { class: 'card' }, h('h2', null, 'Tu equipo para esta pelea'), h('div', { class: 'mini-team' }, c.hostTeam.map((f, i) => monCard(f, { badge: i + 1, stats: true, rarity: false })))),
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
  const right = me
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
    h('section', null, h('h1', null, `${c.host.name} te desafía`), h('div', { class: 'row' }, capNote, h('span', { class: 'muted' }, 'Pelea en vivo por turnos. Si alguien no elige en 60 s, su criatura ataca sola.'))),
    h(
      'section',
      { class: 'vs' },
      h(
        'div',
        { class: 'card' },
        h('h2', null, `Equipo de ${c.host.name}`),
        c.hostTeam.length
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

function battleUI(c, sendAction) {
  let frame = null; // last frame from the server
  let view = null; // what is on screen (lags behind frame while events play)
  let playing = false;
  let mine = 0;
  let sent = null; // label of the action we sent this turn, until the turn resolves
  let queue = Promise.resolve();
  let lastElement = null; // element of the move being played, for the impact effect

  const sideAt = (p) => (p === 'me' ? mine : 1 - mine);
  const hud = (p) => {
    const r = { name: h('span'), lvl: h('span'), sub: h('div', { class: 'sub' }), bar: h('i'), num: h('div', { class: 'hpnum' }) };
    const info = h('button', { class: 'info-btn', type: 'button', title: 'Ver info', 'aria-label': 'Ver info del Pokémon', onclick: () => openInfo(sideAt(p)) }, 'i');
    r.el = h('div', { class: `hud ${p}` }, h('div', { class: 'nm' }, r.name, h('span', { class: 'nm-end' }, r.lvl, info)), r.sub, h('div', { class: 'hp' }, r.bar), r.num);
    return r;
  };
  const els = {
    turn: h('span', null, ''),
    vs: h('span', { class: 'vs-line' }),
    timer: h('span', { class: 'timer' }, ''),
    field: h('span', { class: 'field' }),
    spot: { foe: h('div', { class: 'spot foe', title: 'Ver info', onclick: () => openInfo(sideAt('foe')) }), me: h('div', { class: 'spot me', title: 'Ver info', onclick: () => openInfo(sideAt('me')) }) },
    hud: { foe: hud('foe'), me: hud('me') },
    info: h('dialog', { class: 'info-dlg', onclick: (e) => e.target === e.currentTarget && e.currentTarget.close() }),
    say: h('div', { class: 'say', 'aria-live': 'polite' }),
    controls: h('div', { class: 'card' }),
    log: h('div', { class: 'card log' }),
  };
  const scene = sceneFor(c.id);
  const arena = h('div', { class: 'arena', style: { backgroundImage: `url(${scene.image})` } }, els.spot.foe, els.spot.me, els.hud.foe.el, els.hud.me.el);
  arena.style.setProperty('--pad-me-fill', scene.me[0]);
  arena.style.setProperty('--pad-me-rim', scene.me[1]);
  arena.style.setProperty('--pad-foe-fill', scene.foe[0]);
  arena.style.setProperty('--pad-foe-rim', scene.foe[1]);
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
  function burst(side, type) {
    const spot = els.spot[pos(side)];
    const el = h('span', { class: 'burst' }, '💥');
    if (type && TYPES[type]) el.style.color = TYPES[type].color;
    spot.append(el);
    setTimeout(() => el.remove(), 700);
  }
  function abilityPop(side, ev) {
    const spot = els.spot[pos(side)];
    spot.querySelector('.ab-pop')?.remove();
    const el = h('div', { class: `ab-pop ${pos(side)}`, 'aria-hidden': 'true' }, h('small', null, ev.name), h('b', null, ev.ability));
    spot.append(el);
    anim(spot, 'power', 600);
    setTimeout(() => el.remove(), 1900);
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

    r.name.textContent = f.shiny ? `✨ ${f.name}` : f.name;
    r.lvl.textContent = `Nv ${f.level}`;
    const boosts = Object.entries(STAT)
      .filter(([k]) => f.boosts[k])
      .map(([k, [label]]) => `${label} ${signed(f.boosts[k])}`)
      .join(' · ');
    const vol = f.volatiles || {};
    const marks = [vol.confusion ? 'confuso' : null, vol.attract ? 'enamorado' : null, vol.perish ? `canto ${vol.perish - 1}` : null, vol.charge ? 'cargado' : null].filter(Boolean).join(' · ');
    r.sub.replaceChildren(
      ...[
        typeChips(f.types),
        f.status ? h('span', { class: `cond ${f.status}` }, STATUS[f.status]) : null,
        h('span', { class: 'owner' }, isYou(side) ? `${sd.name} (tú)` : sd.name),
        boosts ? h('span', { class: 'boosts' }, boosts) : null,
        marks ? h('span', { class: 'boosts' }, marks) : null,
        h('span', { class: 'dots', 'aria-label': 'Equipo' }, sd.team.map((t) => h('i', { class: t.hp <= 0 ? 'out' : null }))),
      ].filter(Boolean),
    );
  }

  function paintField() {
    const fl = view.field || {};
    const parts = [fl.weather ? `${WEATHER[fl.weather] ?? fl.weather}${fl.weatherSuppressed ? ' (sin efecto)' : ''}` : null, fl.terrain ? TERRAIN[fl.terrain] ?? fl.terrain : null].filter(Boolean);
    els.field.textContent = parts.join(' · ');
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
                    const { challenge } = await api('/api/challenges', { method: 'POST', body: { levelCap: c.levelCap } });
                    nav(`/b/${challenge.id}`);
                  } catch (err) {
                    toast(err.message);
                  }
                },
              }, '⚔︎ Revancha (nuevo link)')
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
            const info =
              m.kind === 'attack'
                ? [h('span', null, `Poder ${m.power}`), h('span', null, `${m.accuracy}%`), m.priority > 0 ? h('span', null, 'Va primero') : null, effTag]
                : [h('span', null, m.desc), m.key === 'mend' ? h('span', null, `· quedan ${f.uses?.mend ?? 0}`) : null];
            return h('button', { class: 'move', disabled: !moveSet.has(i), onclick: () => act({ type: 'move', move: i }, m.name) }, h('span', { class: 'mv' }, m.name), h('span', { class: 'mi' }, typeChip(m.type), info));
          }),
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
  function play(ev) {
    const sd = (s) => view.sides[s];
    switch (ev.t) {
      case 'turn':
        setActing(null);
        els.turn.textContent = `Turno ${ev.turn}`;
        log(`Turno ${ev.turn}`, 'turn');
        return 350;
      case 'move': {
        lastElement = ev.type || null;
        setActing(ev.side);
        if (ev.kind === 'attack') anim(els.spot[pos(ev.side)], `lunge-${pos(ev.side)}`, 500);
        else anim(els.spot[pos(ev.side)], 'power', 600);
        tell([...mon(ev.side, ev.name), ' usa ', h('b', { class: 'mvname' }, ev.move), ev.type ? ' ' : '', ev.type ? typeChip(ev.type) : '', ev.why ? h('small', { class: 'why' }, ` · ${WHY[ev.why]}`) : ''], { side: ev.side });
        return 750;
      }
      case 'damage': {
        const f = activeOf(ev.side);
        const before = f.hp;
        f.hp = ev.hp;
        burst(ev.side, lastElement);
        paint(ev.side);
        anim(els.spot[pos(ev.side)], 'hit', 500);
        anim(els.hud[pos(ev.side)].el, 'hurt', 600);
        float(ev.side, floatAmount(ev, '−'), ev.crit || ev.eff > 1 ? 'dmg big' : ev.eff < 1 ? 'dmg small' : 'dmg');
        const notes = [ev.crit ? '¡Golpe crítico!' : '', ev.eff > 1 ? '¡Es muy eficaz!' : ev.eff < 1 ? 'No es muy eficaz…' : ''].filter(Boolean).join(' ');
        tell([...mon(ev.side, f.name), ` pierde ${amountText(ev)} (${hpText(ev, before)} → ${hpText(ev, ev.hp)})`, notes ? h('span', { class: ev.eff < 1 && !ev.crit ? 'weak' : 'strong' }, ` ${notes}`) : ''], { side: ev.side, sub: true });
        return 1050;
      }
      case 'miss': {
        const t = 1 - ev.side;
        anim(els.spot[pos(t)], 'dodge', 500);
        float(t, '¡Esquiva!', 'miss');
        tell(['falla: ', ...mon(t, activeOf(t).name), ' lo esquiva.'], { side: ev.side, sub: true, cls: 'weak' });
        return 900;
      }
      case 'nothing':
        float(ev.side, 'Al máximo', 'miss');
        tell(['ya está al máximo: no pasa nada.'], { side: ev.side, sub: true, cls: 'weak' });
        return 800;
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
        float(ev.side, STATUS[ev.status], 'miss');
        tell([...mon(ev.side, f.name), ` ${STATUS_TEXT[ev.status]}.`], { side: ev.side, sub: true, cls: 'weak' });
        return 900;
      }
      case 'cure': {
        const f = activeOf(ev.side);
        f.status = null;
        paint(ev.side);
        tell([...mon(ev.side, f.name), ` ${CURE_TEXT[ev.status] ?? 'se recupera'}.`], { side: ev.side, sub: true });
        return 800;
      }
      case 'cant':
        if (ev.reason === 'truant') return 0;
        float(ev.side, '…', 'miss');
        tell([...mon(ev.side, ev.name), ` ${CANT[ev.reason] ?? 'no puede moverse.'}`], { side: ev.side, cls: 'weak' });
        return 900;
      case 'confused':
        tell([...mon(ev.side, ev.name), ' está confuso…'], { side: ev.side, sub: true, cls: 'weak' });
        return 700;
      case 'volatile': {
        const f = activeOf(ev.side);
        f.volatiles = { ...f.volatiles, [ev.kind]: ev.kind === 'perish' ? 4 : true };
        paint(ev.side);
        tell([...mon(ev.side, ev.name), ` ${VOLATILE[ev.kind]?.(ev) ?? ''}`], { side: ev.side, sub: true, cls: 'weak' });
        return 900;
      }
      case 'volatileEnd': {
        const f = activeOf(ev.side);
        if (f.volatiles) delete f.volatiles[ev.kind];
        paint(ev.side);
        tell([...mon(ev.side, ev.name), ev.kind === 'disable' ? ` vuelve a poder usar ${ev.move}.` : ' ya no está confuso.'], { side: ev.side, sub: true });
        return 700;
      }
      case 'perish': {
        const f = activeOf(ev.side);
        f.volatiles = { ...f.volatiles, perish: ev.count + 1 };
        paint(ev.side);
        tell(['Canto mortal: a ', ...mon(ev.side, ev.name), ` le quedan ${ev.count}.`], { side: ev.side, sub: true, cls: 'weak' });
        return 700;
      }
      case 'hurt': {
        const f = activeOf(ev.side);
        const before = f.hp;
        f.hp = ev.hp;
        paint(ev.side);
        anim(els.hud[pos(ev.side)].el, 'hurt', 600);
        float(ev.side, floatAmount(ev, '−'), 'dmg small');
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
        if (ev.forced) tell([isYou(s) ? 'Mandas a ' : `${sd(s).name} manda a `, h('b', null, ev.name), '.'], { side: s });
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
        return 900;
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
        if (msg.state.intro?.length) {
          playing = true;
          renderControls();
          for (const ev of msg.state.intro) await wait(play(ev));
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
      }
    } else if (msg.events?.length) {
      playing = true;
      sent = null;
      renderControls();
      if (msg.timedOut) log('⏱ Se acabó el tiempo: la máquina eligió por quien no alcanzó.', 'weak');
      for (const ev of msg.events) await wait(play(ev));
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

route();

import { creatureHTML } from './creature.js?v=dev';
import { TYPES, typeLabel, effectiveness } from './types.js?v=dev';

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
    opts.stats
      ? h('div', { class: 'stats' }, ...[['PV', 'hp'], ['ATQ', 'atk'], ['DEF', 'def'], ['VEL', 'spd']].map(([l, k]) => h('span', null, h('b', null, f.stats[k]), l)))
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
      h('div', { class: 'card' }, h('h2', null, `Equipo de ${c.host.name}`), h('div', { class: 'mini-team' }, c.hostTeam.map((f, i) => monCard(f, { badge: i + 1, stats: true, rarity: false })))),
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

  const hud = (p) => {
    const r = { name: h('span'), lvl: h('span'), sub: h('div', { class: 'sub' }), bar: h('i'), num: h('div', { class: 'hpnum' }) };
    r.el = h('div', { class: `hud ${p}` }, h('div', { class: 'nm' }, r.name, r.lvl), r.sub, h('div', { class: 'hp' }, r.bar), r.num);
    return r;
  };
  const els = {
    turn: h('span', null, ''),
    vs: h('span', { class: 'vs-line' }),
    timer: h('span', { class: 'timer' }, ''),
    spot: { foe: h('div', { class: 'spot foe' }), me: h('div', { class: 'spot me' }) },
    hud: { foe: hud('foe'), me: hud('me') },
    say: h('div', { class: 'say', 'aria-live': 'polite' }),
    controls: h('div', { class: 'card' }),
    log: h('div', { class: 'card log' }),
  };
  const arena = h('div', { class: 'arena' }, els.spot.foe, els.spot.me, els.hud.foe.el, els.hud.me.el);
  $app.replaceChildren(
    h('div', { class: 'status-line' }, els.turn, els.vs, els.timer),
    h('div', { class: 'stage' }, arena, els.say),
    h('div', { class: 'battle-layout' }, els.controls, els.log),
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
  function setActing(side) {
    for (const p of ['me', 'foe']) els.hud[p].el.classList.toggle('acting', side != null && pos(side) === p);
    for (const p of ['me', 'foe']) els.spot[p].classList.toggle('acting', side != null && pos(side) === p);
  }

  function countTo(el, from, to, max) {
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 500);
      el.textContent = `${Math.round(from + (to - from) * k)} / ${max} PV`;
      if (k < 1 && el.dataset.to === String(to)) requestAnimationFrame(step);
    };
    el.dataset.to = String(to);
    if (document.hidden || from === to) el.textContent = `${to} / ${max} PV`;
    else requestAnimationFrame(step);
  }

  function paint(side, enter = false) {
    const p = pos(side);
    const sd = view.sides[side];
    const f = activeOf(side);
    const spot = els.spot[p];
    const r = els.hud[p];
    const key = `${side}:${sd.active}:${f.uid}`;
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
    countTo(r.num, fresh || Number.isNaN(shown) ? f.hp : shown, f.hp, f.stats.hp);

    r.name.textContent = f.shiny ? `✨ ${f.name}` : f.name;
    r.lvl.textContent = `Nv ${f.level}`;
    const boosts = [f.boosts.atk ? `ATQ ${f.boosts.atk > 0 ? '+' : ''}${f.boosts.atk}` : null, f.boosts.def ? `DEF ${f.boosts.def > 0 ? '+' : ''}${f.boosts.def}` : null].filter(Boolean).join(' · ');
    r.sub.replaceChildren(
      ...[
        typeChips(f.types),
        h('span', { class: 'owner' }, isYou(side) ? `${sd.name} (tú)` : sd.name),
        boosts ? h('span', { class: 'boosts' }, boosts) : null,
        h('span', { class: 'dots', 'aria-label': 'Equipo' }, sd.team.map((t) => h('i', { class: t.hp <= 0 ? 'out' : null }))),
      ].filter(Boolean),
    );
  }

  function paintAll() {
    paint(0);
    paint(1);
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
        float(ev.side, `−${ev.amount}`, ev.crit || ev.eff > 1 ? 'dmg big' : ev.eff < 1 ? 'dmg small' : 'dmg');
        const notes = [ev.crit ? '¡Golpe crítico!' : '', ev.eff > 1 ? '¡Es muy eficaz!' : ev.eff < 1 ? 'No es muy eficaz…' : ''].filter(Boolean).join(' ');
        tell([...mon(ev.side, f.name), ` pierde ${ev.amount} PV (${before} → ${ev.hp})`, notes ? h('span', { class: ev.eff < 1 && !ev.crit ? 'weak' : 'strong' }, ` ${notes}`) : ''], { side: ev.side, sub: true });
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
        f.boosts[ev.stat] = ev.stage;
        paint(ev.side);
        float(ev.side, ev.stat === 'atk' ? 'ATQ ▲' : 'DEF ▲', 'up');
        tell([...mon(ev.side, f.name), ` sube su ${ev.stat === 'atk' ? 'ataque' : 'defensa'} (${ev.stage > 0 ? '+' : ''}${ev.stage}).`], { side: ev.side, sub: true });
        return 900;
      }
      case 'heal': {
        const f = activeOf(ev.side);
        const before = f.hp;
        f.hp = ev.hp;
        paint(ev.side);
        float(ev.side, `+${ev.amount}`, 'heal');
        tell([...mon(ev.side, f.name), ` recupera ${ev.amount} PV (${before} → ${ev.hp}).`], { side: ev.side, sub: true });
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

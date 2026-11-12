const PALETTE = {
  normal: ['#fffbe0', '#ffd84a', '#e88a12'],
  fire: ['#fff3a0', '#ff8a1e', '#d42a0c'],
  water: ['#e3f6ff', '#5fb4ff', '#1f5fc9'],
  electric: ['#fffde0', '#ffe03a', '#e09a00'],
  grass: ['#e2ffc0', '#5fd14a', '#23802a'],
  ice: ['#ffffff', '#b4f1fa', '#45bfd6'],
  fighting: ['#ffe3c4', '#ff7a4a', '#b8253f'],
  poison: ['#f4d4ff', '#b45ae0', '#5f2286'],
  ground: ['#f4dfb0', '#c99a5c', '#76501f'],
  flying: ['#f4f8ff', '#b3cbff', '#6f8fd0'],
  psychic: ['#ffe0ee', '#ff6fa8', '#bb2465'],
  bug: ['#f3ffc0', '#a8d22e', '#56740c'],
  rock: ['#f2e9c8', '#bba96a', '#665a2e'],
  ghost: ['#efe4ff', '#8a6fd0', '#33245f'],
  dragon: ['#e6deff', '#7d6af0', '#2f20a0'],
  dark: ['#cfc6d8', '#5e5366', '#1b161f'],
  steel: ['#ffffff', '#cdd9e0', '#6a8796'],
  fairy: ['#fff2fb', '#ff9ad8', '#de4fa9'],
};

const PARTICLE = {
  normal: 'star', fire: 'flame', water: 'drop', electric: 'spark', grass: 'leaf', ice: 'shard', fighting: 'star',
  poison: 'bubble', ground: 'chunk', flying: 'feather', psychic: 'ring', bug: 'dot', rock: 'chunk', ghost: 'smoke',
  dragon: 'flame', dark: 'smoke', steel: 'shard', fairy: 'star',
};

const SHAPE_IDS = {
  stream: ['flamethrower', 'hydro-pump', 'water-gun', 'dragon-breath', 'dragon-rage', 'mud-shot', 'gunk-shot', 'scald', 'surf', 'muddy-water', 'sludge-wave', 'fire-spin', 'whirlpool', 'acid-spray', 'octazooka', 'steam-eruption', 'inferno', 'heat-wave', 'mystical-fire'],
  projectile: ['ember', 'mud-slap', 'rock-throw', 'smack-down', 'ice-shard', 'water-pulse', 'acid', 'sludge', 'poison-sting', 'swift', 'flame-burst', 'shadow-sneak', 'vacuum-wave'],
  blast: ['fire-blast', 'overheat', 'explosion', 'self-destruct', 'zap-cannon', 'focus-blast'],
  bolt: ['thunderbolt', 'thunder', 'thunder-shock', 'discharge', 'shock-wave', 'charge-beam'],
  beam: ['ice-beam', 'hyper-beam', 'solar-beam', 'psybeam', 'flash-cannon', 'aurora-beam', 'signal-beam', 'bubble-beam', 'dragon-pulse', 'tri-attack', 'prismatic-laser', 'origin-pulse', 'mirror-shot'],
  storm: ['blizzard', 'powder-snow', 'leaf-storm', 'petal-dance', 'magical-leaf', 'razor-leaf', 'sandstorm', 'leaf-tornado', 'petal-blizzard', 'silver-wind'],
  gust: ['icy-wind', 'hurricane', 'gust', 'fairy-wind', 'twister', 'ominous-wind', 'heat-wave', 'bleakwind-storm', 'air-cutter'],
  psywave: ['psychic', 'confusion', 'future-sight', 'hex', 'night-shade', 'extrasensory', 'psyshock', 'dream-eater', 'psywave', 'stored-power', 'zen-headbutt', 'toxic', 'poison-gas', 'hypnosis', 'confuse-ray', 'will-o-wisp', 'thunder-wave', 'stun-spore', 'sleep-powder', 'poison-powder', 'spore', 'sweet-kiss', 'attract', 'yawn', 'glare'],
  eruption: ['earth-power', 'eruption', 'lava-plume', 'magma-storm', 'mud-bomb'],
  bubbles: ['bubble'],
  drain: ['mega-drain', 'absorb', 'giga-drain', 'leech-life', 'draining-kiss', 'horn-leech', 'leech-seed', 'parabolic-charge', 'oblivion-wing'],
  meteor: ['draco-meteor', 'meteor-beam'],
  rain: ['ancient-power', 'rock-slide', 'rock-tomb', 'avalanche', 'icicle-crash', 'diamond-storm', 'head-smash'],
  flash: ['dazzling-gleam', 'flash', 'light-of-ruin', 'moonlight', 'morning-sun', 'synthesis'],
  orb: ['shadow-ball', 'sludge-bomb', 'moonblast', 'energy-ball', 'aura-sphere', 'electro-ball', 'weather-ball', 'seed-bomb', 'gyro-ball', 'mist-ball', 'luster-purge'],
  quake: ['earthquake', 'bulldoze', 'magnitude', 'fissure', 'stomping-tantrum'],
  rise: ['stone-edge', 'precipice-blades', 'power-gem', 'spikes'],
  darts: ['pin-missile', 'bullet-seed', 'icicle-spear', 'rock-blast', 'fury-attack', 'double-kick', 'double-slap', 'comet-punch', 'arm-thrust', 'twineedle', 'tail-slap', 'water-shuriken', 'scale-shot', 'triple-axel'],
};
const BY_ID = Object.fromEntries(Object.entries(SHAPE_IDS).flatMap(([shape, ids]) => ids.map((id) => [id, shape])));

export const SHAPE_NAMES = [
  'projectile', 'orb', 'stream', 'beam', 'bolt', 'storm', 'gust', 'psywave', 'eruption', 'bubbles', 'pulse', 'sound', 'drain',
  'meteor', 'rain', 'flash', 'blast', 'quake', 'rise', 'darts', 'strike', 'punch', 'bite', 'slash', 'boost', 'heal', 'weather',
];

const STAT_COLOR = { atk: 'fighting', def: 'steel', satk: 'psychic', sdef: 'water', spd: 'electric', acc: 'normal', eva: 'flying' };
const STATUS_TYPE = { brn: 'fire', par: 'electric', psn: 'poison', tox: 'poison', frz: 'ice', slp: 'normal' };

const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function moveShape(ev) {
  const flags = ev.flags || [];
  if (ev.kind === 'status') {
    if (ev.effect === 'boost') return 'boost';
    if (ev.effect === 'heal') return 'heal';
    if (ev.effect === 'weather') return 'weather';
    if (flags.includes('sound')) return 'sound';
    return BY_ID[ev.key] === 'drain' ? 'drain' : 'psywave';
  }
  if (BY_ID[ev.key]) return BY_ID[ev.key];
  if (ev.drain) return 'drain';
  if (ev.multihit) return 'darts';
  if (flags.includes('bite')) return 'bite';
  if (flags.includes('punch')) return 'punch';
  if (flags.includes('slicing')) return 'slash';
  if (flags.includes('sound')) return 'sound';
  if (flags.includes('wind')) return 'gust';
  if (flags.includes('pulse')) return 'pulse';
  if (flags.includes('bullet')) return 'orb';
  if (flags.includes('contact')) return 'strike';
  return 'projectile';
}

export function createFx(arena) {
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  arena.append(layer);
  const reduced = () => document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const unit = () => (arena.clientHeight / 100) * 1.4;

  function center(spot, dy = 0.55) {
    const a = arena.getBoundingClientRect();
    const r = spot.getBoundingClientRect();
    return { x: r.left - a.left + r.width / 2, y: r.top - a.top + r.height * dy, w: r.width };
  }

  function node(css = {}, cls = '') {
    const d = document.createElement('div');
    d.className = `fx ${cls}`;
    Object.assign(d.style, css);
    layer.append(d);
    return d;
  }

  function play(el, frames, opts) {
    const a = el.animate(frames, { fill: 'forwards', easing: 'ease-out', ...opts });
    return a.finished.then(
      () => el.remove(),
      () => el.remove(),
    );
  }

  const at = (p, extra = '') => `translate(${p.x}px, ${p.y}px) ${extra}`;

  function particle(type, size, shape = PARTICLE[type] || 'star') {
    const [light, mid, dark] = PALETTE[type] || PALETTE.normal;
    const s = size;
    const css = { width: `${s}px`, height: `${s}px`, marginLeft: `${-s / 2}px`, marginTop: `${-s / 2}px` };
    switch (shape) {
      case 'flame':
        Object.assign(css, { height: `${s * 1.35}px`, borderRadius: '50% 50% 50% 50% / 62% 62% 38% 38%', background: `radial-gradient(circle at 50% 68%, ${light} 0 18%, ${mid} 40%, ${dark} 72%, transparent 76%)`, filter: 'blur(0.4px)' });
        break;
      case 'drop':
        Object.assign(css, { borderRadius: '50% 50% 50% 50% / 60% 60% 40% 40%', background: `radial-gradient(circle at 38% 34%, ${light} 0 16%, ${mid} 45%, ${dark} 90%)` });
        break;
      case 'bubble':
        Object.assign(css, { borderRadius: '50%', border: `${Math.max(1, s * 0.1)}px solid ${mid}`, background: `radial-gradient(circle at 34% 32%, ${light} 0 14%, transparent 22%), rgba(255,255,255,0.12)` });
        break;
      case 'spark':
        Object.assign(css, { width: `${s * 1.8}px`, height: `${s * 0.32}px`, borderRadius: `${s}px`, background: `linear-gradient(90deg, transparent, ${light}, ${mid}, transparent)`, boxShadow: `0 0 ${s * 0.6}px ${mid}` });
        break;
      case 'leaf':
        Object.assign(css, { height: `${s * 0.62}px`, borderRadius: '0 80% 0 80%', background: `linear-gradient(135deg, ${light}, ${mid} 55%, ${dark})` });
        break;
      case 'shard':
        Object.assign(css, { height: `${s * 1.5}px`, clipPath: 'polygon(50% 0, 100% 45%, 50% 100%, 0 45%)', background: `linear-gradient(160deg, ${light}, ${mid} 60%, ${dark})` });
        break;
      case 'chunk':
        Object.assign(css, { clipPath: 'polygon(20% 0, 80% 8%, 100% 58%, 70% 100%, 12% 86%, 0 30%)', background: `linear-gradient(150deg, ${light}, ${mid} 50%, ${dark})` });
        break;
      case 'smoke':
        Object.assign(css, { borderRadius: '50%', background: `radial-gradient(circle, ${mid} 0, ${dark} 55%, transparent 70%)`, filter: `blur(${s * 0.12}px)`, opacity: '0.85' });
        break;
      case 'ring':
        Object.assign(css, { borderRadius: '50%', border: `${Math.max(2, s * 0.14)}px solid ${mid}`, boxShadow: `0 0 ${s * 0.4}px ${light}` });
        break;
      case 'feather':
        Object.assign(css, { height: `${s * 0.45}px`, borderRadius: '100% 0 100% 0', background: `linear-gradient(90deg, ${light}, ${mid})` });
        break;
      case 'dot':
        Object.assign(css, { borderRadius: '50%', background: `radial-gradient(circle, ${light}, ${mid} 60%, ${dark})` });
        break;
      case 'orb':
        Object.assign(css, { borderRadius: '50%', background: `radial-gradient(circle at 38% 36%, ${light} 0 14%, ${mid} 46%, ${dark} 78%, transparent 82%)`, boxShadow: `0 0 ${s * 0.45}px ${mid}` });
        break;
      default:
        Object.assign(css, { clipPath: 'polygon(50% 0, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)', background: `radial-gradient(circle, ${light}, ${mid} 70%)` });
    }
    return node(css);
  }

  function burstAt(p, type, { count = 10, spread = 9, size = 3.6, ms = 560 } = {}) {
    const u = unit();
    const jobs = [];
    const [light, mid] = PALETTE[type] || PALETTE.normal;
    const flash = particle(type, u * 16, 'orb');
    jobs.push(play(flash, [{ transform: at(p, 'scale(0.2)'), opacity: 1 }, { transform: at(p, 'scale(1.15)'), opacity: 0 }], { duration: ms * 0.7 }));
    const star = node({ width: `${u * 15}px`, height: `${u * 15}px`, marginLeft: `${-u * 7.5}px`, marginTop: `${-u * 7.5}px`, clipPath: 'polygon(50% 0, 60% 36%, 96% 22%, 68% 50%, 96% 78%, 60% 64%, 50% 100%, 40% 64%, 4% 78%, 32% 50%, 4% 22%, 40% 36%)', background: `radial-gradient(circle, #ffffff 0 22%, ${light} 40%, ${mid} 75%)`, filter: `drop-shadow(0 0 ${u * 0.5}px rgba(0, 0, 0, 0.55))` });
    jobs.push(play(star, [{ transform: at(p, `rotate(${rnd(-20, 20)}deg) scale(0.2)`), opacity: 1 }, { transform: at(p, 'scale(1)'), opacity: 1, offset: 0.3 }, { transform: at(p, 'scale(1.05)'), opacity: 1, offset: 0.65 }, { transform: at(p, 'scale(1.25)'), opacity: 0 }], { duration: ms }));
    for (let i = 0; i < count; i++) {
      const ang = (Math.PI * 2 * i) / count + rnd(-0.3, 0.3);
      const dist = u * spread * rnd(0.7, 1.3);
      const el = particle(type, u * size * rnd(0.7, 1.2));
      const to = { x: p.x + Math.cos(ang) * dist, y: p.y + Math.sin(ang) * dist };
      jobs.push(play(el, [{ transform: at(p, `rotate(${rnd(0, 360)}deg) scale(0.6)`), opacity: 1 }, { transform: at(to, `rotate(${rnd(0, 360)}deg) scale(1)`), opacity: 0 }], { duration: ms, delay: rnd(0, 60) }));
    }
    return Promise.all(jobs);
  }

  function travel(el, from, to, ms, { arc = 0, spin = 0, scale = [1, 1] } = {}) {
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 - arc };
    return play(
      el,
      [
        { transform: at(from, `rotate(0deg) scale(${scale[0]})`) },
        { transform: at(mid, `rotate(${spin / 2}deg) scale(${(scale[0] + scale[1]) / 2})`), offset: 0.5 },
        { transform: at(to, `rotate(${spin}deg) scale(${scale[1]})`) },
      ],
      { duration: ms, easing: 'ease-in' },
    );
  }

  async function projectile(from, to, type, { big = false } = {}) {
    const u = unit();
    const orb = particle(type, u * (big ? 13 : 8), big ? 'orb' : PARTICLE[type] === 'flame' ? 'flame' : 'orb');
    const trail = setInterval(() => {
      const t = particle(type, u * rnd(2, 3.4));
      const p = { x: rnd(from.x, to.x), y: rnd(Math.min(from.y, to.y), Math.max(from.y, to.y)) };
      play(t, [{ transform: at(p), opacity: 0.8 }, { transform: at({ x: p.x, y: p.y - u * 3 }, 'scale(0.3)'), opacity: 0 }], { duration: 380 });
    }, 45);
    await travel(orb, from, to, 430, { arc: u * 8, spin: 360, scale: [0.6, 1.1] });
    clearInterval(trail);
    await burstAt(to, type, { count: big ? 14 : 9, spread: big ? 13 : 9 });
  }

  async function stream(from, to, type) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 26; i++) {
      const el = particle(type, u * rnd(4, 7));
      const jitter = { x: to.x + rnd(-u * 5, u * 5), y: to.y + rnd(-u * 5, u * 5) };
      jobs.push(wait(i * 22).then(() => travel(el, from, jitter, 360, { scale: [0.5, 1.4], spin: rnd(-90, 90) })));
    }
    await Promise.all(jobs);
    await burstAt(to, type, { count: 8, spread: 8 });
  }

  async function beam(from, to, type) {
    const u = unit();
    const [light, mid] = PALETTE[type] || PALETTE.normal;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
    const thick = u * 7;
    const el = node({ width: `${len}px`, height: `${thick}px`, marginTop: `${-thick / 2}px`, borderRadius: `${thick}px`, transformOrigin: '0 50%', background: `linear-gradient(180deg, transparent, ${mid} 25%, ${light} 50%, ${mid} 75%, transparent)`, boxShadow: `0 0 ${u * 3}px ${mid}` });
    const base = `translate(${from.x}px, ${from.y}px) rotate(${ang}deg)`;
    const done = play(
      el,
      [
        { transform: `${base} scaleX(0) scaleY(0.6)`, opacity: 1 },
        { transform: `${base} scaleX(1) scaleY(1)`, opacity: 1, offset: 0.35 },
        { transform: `${base} scaleX(1) scaleY(1.25)`, opacity: 0.85, offset: 0.6 },
        { transform: `${base} scaleX(1) scaleY(0.2)`, opacity: 0 },
      ],
      { duration: 720 },
    );
    await wait(250);
    await Promise.all([done, burstAt(to, type, { count: 12, spread: 11 })]);
  }

  async function bolt(to, type) {
    const u = unit();
    const [light, mid] = PALETTE[type] || PALETTE.electric;
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('class', 'fx fx-svg');
    svg.setAttribute('width', String(arena.clientWidth));
    svg.setAttribute('height', String(arena.clientHeight));
    const pts = [];
    const steps = 7;
    for (let i = 0; i <= steps; i++) pts.push(`${to.x + (i === steps ? 0 : rnd(-u * 6, u * 6))},${(to.y * i) / steps}`);
    const line = document.createElementNS(svgNS, 'polyline');
    line.setAttribute('points', pts.join(' '));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', light);
    line.setAttribute('stroke-width', String(u * 2.6));
    line.setAttribute('stroke-linejoin', 'round');
    const core = line.cloneNode();
    core.setAttribute('stroke', '#ffffff');
    core.setAttribute('stroke-width', String(u * 1));
    line.setAttribute('stroke', mid);
    svg.style.filter = `drop-shadow(0 0 ${u * 1.5}px ${light}) drop-shadow(0 0 ${u * 3}px ${mid})`;
    svg.append(line, core);
    layer.append(svg);
    const flash = node({ inset: '0', width: '100%', height: '100%', background: light });
    await Promise.all([
      play(svg, [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 0.3, offset: 0.3 }, { opacity: 1, offset: 0.45 }, { opacity: 0 }], { duration: 560 }),
      play(flash, [{ opacity: 0 }, { opacity: 0.35, offset: 0.12 }, { opacity: 0 }], { duration: 360 }),
      wait(120).then(() => burstAt(to, type, { count: 12, spread: 10 })),
    ]);
  }

  async function rainOn(to, type, { count = 14, shape, size = 5, height = 45 } = {}) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < count; i++) {
      const el = particle(type, u * rnd(size * 0.7, size * 1.3), shape);
      const land = { x: to.x + rnd(-u * 9, u * 9), y: to.y + rnd(-u * 4, u * 6) };
      const start = { x: land.x + rnd(-u * 4, u * 4), y: land.y - u * height };
      jobs.push(wait(i * 45).then(() => play(el, [{ transform: at(start, `rotate(${rnd(0, 180)}deg)`), opacity: 0 }, { opacity: 1, offset: 0.2 }, { transform: at(land, `rotate(${rnd(180, 360)}deg)`), opacity: 1, offset: 0.85 }, { transform: at(land, 'scale(0.4)'), opacity: 0 }], { duration: 480, easing: 'ease-in' })));
    }
    await Promise.all(jobs);
    await burstAt(to, type, { count: 8 });
  }

  async function storm(to, type) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 24; i++) {
      const el = particle(type, u * rnd(2.5, 5));
      const y = to.y + rnd(-u * 14, u * 10);
      const from = { x: to.x - u * 30, y: y - u * 10 };
      const end = { x: to.x + u * 30, y: y + u * 10 };
      jobs.push(wait(i * 30).then(() => play(el, [{ transform: at(from, 'rotate(0deg)'), opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: at(end, `rotate(${rnd(180, 540)}deg)`), opacity: 0 }], { duration: 520, easing: 'linear' })));
    }
    await Promise.all(jobs);
    await burstAt(to, type, { count: 6 });
  }

  async function gust(to, type) {
    const u = unit();
    const [light] = PALETTE[type] || PALETTE.flying;
    const jobs = [];
    for (let i = 0; i < 3; i++) {
      const arc = node({ width: `${u * 22}px`, height: `${u * 22}px`, marginLeft: `${-u * 11}px`, marginTop: `${-u * 11}px`, borderRadius: '50%', border: `${u * 0.8}px solid transparent`, borderTopColor: light, borderLeftColor: light, opacity: '0.85' });
      jobs.push(wait(i * 110).then(() => play(arc, [{ transform: at(to, 'rotate(0deg) scale(0.4)'), opacity: 0.9 }, { transform: at(to, 'rotate(540deg) scale(1.2)'), opacity: 0 }], { duration: 560 })));
    }
    jobs.push(storm(to, type));
    await Promise.all(jobs);
  }

  async function rings(from, to, type, { travelTo = true, count = 4 } = {}) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < count; i++) {
      const el = particle(type, u * 10, 'ring');
      const frames = travelTo
        ? [{ transform: at(from, 'scale(0.3)'), opacity: 0.9 }, { transform: at(to, 'scale(1.5)'), opacity: 0 }]
        : [{ transform: at(from, 'scale(0.4)'), opacity: 0.9 }, { transform: at(from, 'scale(3.2)'), opacity: 0 }];
      jobs.push(wait(i * 120).then(() => play(el, frames, { duration: 520 })));
    }
    await Promise.all(jobs);
    if (travelTo) await burstAt(to, type, { count: 6 });
  }

  async function psywave(to, type) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 4; i++) {
      const el = particle(type, u * 26, 'ring');
      jobs.push(wait(i * 120).then(() => play(el, [{ transform: at(to, 'scale(1.4)'), opacity: 0 }, { opacity: 0.85, offset: 0.4 }, { transform: at(to, 'scale(0.2)'), opacity: 0 }], { duration: 520 })));
    }
    await Promise.all(jobs);
    await burstAt(to, type, { count: 8, spread: 7 });
  }

  async function strike(to, type) {
    await burstAt(to, type, { count: 12, spread: 12, size: 4.4, ms: 760 });
  }

  async function punch(to, type) {
    const u = unit();
    const [light, mid, dark] = PALETTE[type] || PALETTE.fighting;
    const fist = node({ width: `${u * 13}px`, height: `${u * 11}px`, marginLeft: `${-u * 6.5}px`, marginTop: `${-u * 5.5}px`, borderRadius: `${u * 4}px ${u * 4}px ${u * 3}px ${u * 3}px`, background: `linear-gradient(180deg, ${light}, ${mid} 60%, ${dark})`, boxShadow: `0 0 ${u * 2}px ${mid}` });
    await play(fist, [{ transform: at(to, 'scale(2.2)'), opacity: 0 }, { transform: at(to, 'scale(1)'), opacity: 1, offset: 0.55 }, { transform: at(to, 'scale(0.9)'), opacity: 0 }], { duration: 380, easing: 'ease-in' });
    await burstAt(to, type, { count: 12, spread: 12, size: 3.8 });
  }

  async function bite(to, type) {
    const u = unit();
    const [light, mid] = PALETTE[type] || PALETTE.dark;
    const jaw = (top) =>
      node({
        width: `${u * 22}px`,
        height: `${u * 9}px`,
        marginLeft: `${-u * 11}px`,
        marginTop: `${-u * 4.5}px`,
        background: `linear-gradient(${top ? 180 : 0}deg, ${mid}, ${light})`,
        clipPath: top
          ? 'polygon(0 0, 100% 0, 100% 40%, 90% 100%, 80% 40%, 70% 100%, 60% 40%, 50% 100%, 40% 40%, 30% 100%, 20% 40%, 10% 100%, 0 40%)'
          : 'polygon(0 60%, 10% 0, 20% 60%, 30% 0, 40% 60%, 50% 0, 60% 60%, 70% 0, 80% 60%, 90% 0, 100% 60%, 100% 100%, 0 100%)',
      });
    const gap = u * 10;
    const t = jaw(true);
    const b = jaw(false);
    await Promise.all([
      play(t, [{ transform: at({ x: to.x, y: to.y - gap }), opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: at({ x: to.x, y: to.y - u * 4 }), opacity: 1, offset: 0.7 }, { transform: at({ x: to.x, y: to.y - u * 4 }), opacity: 0 }], { duration: 420, easing: 'ease-in' }),
      play(b, [{ transform: at({ x: to.x, y: to.y + gap }), opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: at({ x: to.x, y: to.y + u * 4 }), opacity: 1, offset: 0.7 }, { transform: at({ x: to.x, y: to.y + u * 4 }), opacity: 0 }], { duration: 420, easing: 'ease-in' }),
    ]);
    await burstAt(to, type, { count: 8, spread: 8 });
  }

  async function slash(to, type) {
    const u = unit();
    const [light, mid] = PALETTE[type] || PALETTE.normal;
    const jobs = [];
    for (let i = 0; i < 3; i++) {
      const len = u * 26;
      const el = node({ width: `${len}px`, height: `${u * 1.1}px`, marginLeft: `${-len / 2}px`, borderRadius: `${u}px`, background: `linear-gradient(90deg, transparent, ${light}, ${mid}, transparent)`, boxShadow: `0 0 ${u * 1.5}px ${mid}` });
      const p = { x: to.x + (i - 1) * u * 5, y: to.y + (i - 1) * u * 2 };
      jobs.push(wait(i * 90).then(() => play(el, [{ transform: at(p, 'rotate(-40deg) scaleX(0)'), opacity: 1 }, { transform: at(p, 'rotate(-40deg) scaleX(1)'), opacity: 1, offset: 0.5 }, { transform: at(p, 'rotate(-40deg) scaleX(1)'), opacity: 0 }], { duration: 360 })));
    }
    await Promise.all(jobs);
    await burstAt(to, type, { count: 6, spread: 8 });
  }

  async function darts(from, to, type) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 4; i++) {
      const el = particle(type, u * 4, 'shard');
      const end = { x: to.x + rnd(-u * 5, u * 5), y: to.y + rnd(-u * 5, u * 5) };
      const ang = (Math.atan2(end.y - from.y, end.x - from.x) * 180) / Math.PI + 90;
      jobs.push(wait(i * 110).then(() => play(el, [{ transform: at(from, `rotate(${ang}deg)`) }, { transform: at(end, `rotate(${ang}deg)`) }], { duration: 300, easing: 'ease-in' }).then(() => burstAt(end, type, { count: 5, spread: 5, size: 2.4, ms: 360 }))));
    }
    await Promise.all(jobs);
  }

  async function quake(type) {
    const u = unit();
    const shake = arena.animate(
      [{ transform: 'translate(0,0)' }, { transform: `translate(${-u}px, ${u * 0.4}px)` }, { transform: `translate(${u}px, ${-u * 0.4}px)` }, { transform: `translate(${-u * 0.8}px, 0)` }, { transform: `translate(${u * 0.8}px, ${u * 0.3}px)` }, { transform: 'translate(0,0)' }],
      { duration: 640, iterations: 1 },
    );
    const jobs = [shake.finished.catch(() => {})];
    for (let i = 0; i < 16; i++) {
      const el = particle(type, u * rnd(2.5, 4.5), 'chunk');
      const p = { x: rnd(0, arena.clientWidth), y: arena.clientHeight * rnd(0.72, 0.95) };
      jobs.push(wait(rnd(0, 300)).then(() => play(el, [{ transform: at(p), opacity: 1 }, { transform: at({ x: p.x + rnd(-u * 3, u * 3), y: p.y - u * rnd(6, 12) }, `rotate(${rnd(90, 270)}deg)`), opacity: 1, offset: 0.5 }, { transform: at(p), opacity: 0 }], { duration: 520, easing: 'ease-out' })));
    }
    await Promise.all(jobs);
  }

  async function rise(to, type) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 6; i++) {
      const el = particle(type, u * rnd(5, 8), PARTICLE[type] === 'chunk' ? 'shard' : PARTICLE[type]);
      const base = { x: to.x + (i - 2.5) * u * 4, y: to.y + u * 14 };
      const top = { x: base.x, y: to.y - u * rnd(0, 8) };
      jobs.push(wait(i * 60).then(() => play(el, [{ transform: at(base, 'scaleY(0.2)'), opacity: 0 }, { transform: at(top, 'scaleY(1.2)'), opacity: 1, offset: 0.5 }, { transform: at(top, 'scaleY(1)'), opacity: 0 }], { duration: 560 })));
    }
    await Promise.all(jobs);
    await burstAt(to, type, { count: 8 });
  }

  async function eruption(to, type) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 18; i++) {
      const el = particle(type, u * rnd(3, 5.5), i % 3 ? PARTICLE[type] : 'flame');
      const base = { x: to.x + rnd(-u * 6, u * 6), y: to.y + u * 12 };
      const top = { x: base.x + rnd(-u * 5, u * 5), y: to.y - u * rnd(8, 20) };
      jobs.push(wait(i * 25).then(() => play(el, [{ transform: at(base), opacity: 1 }, { transform: at(top, `rotate(${rnd(0, 270)}deg)`), opacity: 0 }], { duration: 520 })));
    }
    await Promise.all(jobs);
  }

  async function blast(from, to, type) {
    await projectile(from, to, type, { big: true });
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 5; i++) {
      const el = particle(type, u * 10);
      const ang = (Math.PI * 2 * i) / 5 - Math.PI / 2;
      const p = { x: to.x + Math.cos(ang) * u * 12, y: to.y + Math.sin(ang) * u * 12 };
      jobs.push(play(el, [{ transform: at(to, 'scale(0.3)'), opacity: 1 }, { transform: at(p, 'scale(1.2)'), opacity: 1, offset: 0.6 }, { transform: at(p, 'scale(1.4)'), opacity: 0 }], { duration: 520 }));
    }
    await Promise.all(jobs);
  }

  async function drain(from, to, type) {
    await burstAt(to, type, { count: 8, spread: 7 });
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 8; i++) {
      const el = particle('grass', u * 3.5, 'orb');
      const start = { x: to.x + rnd(-u * 5, u * 5), y: to.y + rnd(-u * 5, u * 5) };
      jobs.push(wait(i * 50).then(() => travel(el, start, from, 520, { arc: u * 10 })));
    }
    await Promise.all(jobs);
  }

  async function meteor(to, type) {
    await rainOn(to, type, { count: 6, shape: 'orb', size: 9, height: 60 });
  }

  async function flash(from, to, type) {
    const [light] = PALETTE[type] || PALETTE.fairy;
    const f = node({ inset: '0', width: '100%', height: '100%', background: light });
    await Promise.all([play(f, [{ opacity: 0 }, { opacity: 0.45, offset: 0.25 }, { opacity: 0 }], { duration: 520 }), burstAt(to, type, { count: 14, spread: 14 })]);
  }

  async function boost(on, stat) {
    const u = unit();
    const type = STAT_COLOR[stat] || 'normal';
    const [light, mid] = PALETTE[type];
    const jobs = [];
    const glow = particle(type, u * 24, 'orb');
    jobs.push(play(glow, [{ transform: at(on, 'scale(0.6)'), opacity: 0 }, { opacity: 0.55, offset: 0.4 }, { transform: at(on, 'scale(1.2)'), opacity: 0 }], { duration: 760 }));
    for (let i = 0; i < 6; i++) {
      const arrow = node({ width: `${u * 5}px`, height: `${u * 5}px`, marginLeft: `${-u * 2.5}px`, marginTop: `${-u * 2.5}px`, clipPath: 'polygon(50% 0, 100% 55%, 70% 55%, 70% 100%, 30% 100%, 30% 55%, 0 55%)', background: `linear-gradient(${light}, ${mid})` });
      const p = { x: on.x + rnd(-u * 9, u * 9), y: on.y + u * 8 };
      jobs.push(wait(i * 70).then(() => play(arrow, [{ transform: at(p), opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: at({ x: p.x, y: p.y - u * 18 }), opacity: 0 }], { duration: 620 })));
    }
    await Promise.all(jobs);
  }

  async function heal(on) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 12; i++) {
      const el = particle('grass', u * rnd(2, 3.5), i % 2 ? 'star' : 'orb');
      const p = { x: on.x + rnd(-u * 9, u * 9), y: on.y + u * rnd(0, 8) };
      jobs.push(wait(i * 45).then(() => play(el, [{ transform: at(p), opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: at({ x: p.x, y: p.y - u * 16 }), opacity: 0 }], { duration: 640 })));
    }
    await Promise.all(jobs);
  }

  async function sleepy(on) {
    const u = unit();
    const jobs = [];
    for (let i = 0; i < 3; i++) {
      const el = node({ width: `${u * 5}px`, height: `${u * 5}px`, marginLeft: `${-u * 2.5}px`, marginTop: `${-u * 2.5}px`, clipPath: 'polygon(0 0, 100% 0, 100% 22%, 32% 78%, 100% 78%, 100% 100%, 0 100%, 0 78%, 68% 22%, 0 22%)', background: '#d8e6ff' });
      const p = { x: on.x + u * 6, y: on.y - u * 6 };
      jobs.push(wait(i * 220).then(() => play(el, [{ transform: at(p, 'scale(0.5)'), opacity: 0 }, { opacity: 1, offset: 0.3 }, { transform: at({ x: p.x + u * 8, y: p.y - u * 16 }, 'scale(1.1)'), opacity: 0 }], { duration: 900 })));
    }
    await Promise.all(jobs);
  }

  const SHAPES = {
    projectile: (f, t, ty) => projectile(f, t, ty),
    orb: (f, t, ty) => projectile(f, t, ty, { big: true }),
    stream: (f, t, ty) => stream(f, t, ty),
    beam: (f, t, ty) => beam(f, t, ty),
    bolt: (f, t, ty) => bolt(t, ty),
    storm: (f, t, ty) => storm(t, ty),
    gust: (f, t, ty) => gust(t, ty),
    psywave: (f, t, ty) => psywave(t, ty),
    eruption: (f, t, ty) => eruption(t, ty),
    bubbles: (f, t, ty) => rings(f, t, ty, { count: 5 }),
    pulse: (f, t, ty) => rings(f, t, ty),
    sound: (f, t, ty) => rings(f, t, ty, { travelTo: false }).then(() => burstAt(t, ty, { count: 6 })),
    drain: (f, t, ty) => drain(f, t, ty),
    meteor: (f, t, ty) => meteor(t, ty),
    rain: (f, t, ty) => rainOn(t, ty),
    flash: (f, t, ty) => flash(f, t, ty),
    blast: (f, t, ty) => blast(f, t, ty),
    quake: (f, t, ty) => quake(ty),
    rise: (f, t, ty) => rise(t, ty),
    darts: (f, t, ty) => darts(f, t, ty),
    strike: (f, t, ty) => strike(t, ty),
    punch: (f, t, ty) => punch(t, ty),
    bite: (f, t, ty) => bite(t, ty),
    slash: (f, t, ty) => slash(t, ty),
  };

  return {
    move(ev, fromSpot, toSpot) {
      if (reduced()) return Promise.resolve();
      const from = center(fromSpot);
      const to = center(toSpot);
      const type = ev.type || 'normal';
      const shape = moveShape(ev);
      if (shape === 'boost') return boost(from, ev.stat);
      if (shape === 'heal') return heal(from);
      if (shape === 'weather') return storm({ x: arena.clientWidth / 2, y: arena.clientHeight * 0.4 }, type);
      if (ev.kind === 'status' && shape === 'psywave') return psywave(to, type);
      return (SHAPES[shape] || SHAPES.projectile)(from, to, type);
    },
    status(status, spot) {
      if (reduced()) return Promise.resolve();
      const on = center(spot);
      const type = STATUS_TYPE[status] || 'normal';
      if (status === 'slp') return sleepy(on);
      return burstAt(on, type, { count: 12, spread: 10, size: 3, ms: 700 });
    },
    impact(type, spot) {
      if (reduced()) return Promise.resolve();
      return burstAt(center(spot), type || 'normal', { count: 6, spread: 6, size: 2.6, ms: 400 });
    },
  };
}

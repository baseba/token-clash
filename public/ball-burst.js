const SPRITE = 64;
const DPR_CAP = 1.5;
const OPEN_MS = 520;
const FOCUS_IN_MS = 300;
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const ease = {
  out: (u) => 1 - (1 - u) ** 3,
  inOut: (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2),
  linear: (u) => u,
};

const TAU = Math.PI * 2;
const steps = (count) => Array.from({ length: count + 1 }, (_, i) => i / count);
const fadeOut = (t, from) => (t < from ? 1 : 1 - (t - from) / (1 - from));
const swell = (u, rise = 0.2, fall = 0.7) => (u < rise ? u / rise : u < fall ? 1 : 1 - (u - fall) / (1 - fall));

const sprites = new Map();

function trace(g, shape, r) {
  g.beginPath();
  switch (shape) {
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const d = i % 2 ? r * 0.42 : r;
        g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      break;
    case 'flake':
      for (let i = 0; i < 12; i++) {
        const a = (Math.PI / 6) * i - Math.PI / 2;
        const d = i % 2 ? r * 0.28 : r;
        g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
      }
      break;
    case 'shard':
      g.moveTo(0, -r);
      g.lineTo(r * 0.5, -r * 0.1);
      g.lineTo(0, r);
      g.lineTo(-r * 0.5, -r * 0.1);
      break;
    case 'chunk':
      [[-0.6, -1], [0.6, -0.84], [1, 0.16], [0.4, 1], [-0.76, 0.72], [-1, -0.4]].forEach(([x, y]) => g.lineTo(x * r, y * r));
      break;
    case 'leaf':
    case 'petal':
      g.ellipse(0, 0, r, r * (shape === 'leaf' ? 0.42 : 0.55), Math.PI / 4, 0, Math.PI * 2);
      break;
    case 'heart':
      g.moveTo(0, r * 0.85);
      g.bezierCurveTo(-r * 1.25, 0, -r * 0.75, -r * 1.05, 0, -r * 0.4);
      g.bezierCurveTo(r * 0.75, -r * 1.05, r * 1.25, 0, 0, r * 0.85);
      break;
    case 'chevron':
      [[-1, 0.3], [0, -0.65], [1, 0.3], [1, 0.9], [0, -0.05], [-1, 0.9]].forEach(([x, y]) => g.lineTo(x * r, y * r));
      break;
    case 'square':
      g.rect(-r * 0.7, -r * 0.7, r * 1.4, r * 1.4);
      break;
    case 'hex':
      for (let i = 0; i < 6; i++) g.lineTo(Math.cos((TAU / 6) * i) * r, Math.sin((TAU / 6) * i) * r);
      break;
    case 'spark':
      g.ellipse(0, 0, r, r * 0.18, 0, 0, Math.PI * 2);
      break;
    case 'flame':
      g.moveTo(0, -r);
      g.bezierCurveTo(r * 0.75, -r * 0.2, r * 0.7, r * 0.7, 0, r * 0.75);
      g.bezierCurveTo(-r * 0.7, r * 0.7, -r * 0.75, -r * 0.2, 0, -r);
      break;
    case 'drop':
      g.moveTo(0, -r);
      g.bezierCurveTo(r * 0.8, 0, r * 0.7, r * 0.8, 0, r * 0.8);
      g.bezierCurveTo(-r * 0.7, r * 0.8, -r * 0.8, 0, 0, -r);
      break;
    default:
      g.arc(0, 0, r * (shape === 'dot' ? 0.6 : 0.8), 0, Math.PI * 2);
  }
  g.closePath();
}

function spriteFor(shape, [light, mid, dark], glow) {
  const id = `${shape}|${light}|${mid}|${dark}|${glow}`;
  if (sprites.has(id)) return sprites.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE;
  const g = canvas.getContext('2d');
  const r = SPRITE * 0.3;
  g.translate(SPRITE / 2, SPRITE / 2);
  if (glow) {
    g.fillStyle = radial(g, 0, 0, SPRITE / 2, [[0, alpha(mid, 0.55)], [0.5, alpha(mid, 0.25)], [1, alpha(mid, 0)]]);
    g.fillRect(-SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
  }
  if (shape === 'smoke') {
    const fill = g.createRadialGradient(0, 0, 0, 0, 0, SPRITE * 0.45);
    fill.addColorStop(0, mid);
    fill.addColorStop(0.55, dark);
    fill.addColorStop(1, 'transparent');
    g.fillStyle = fill;
    g.fillRect(-SPRITE / 2, -SPRITE / 2, SPRITE, SPRITE);
  } else if (shape === 'ring' || shape === 'bubble') {
    g.lineWidth = r * 0.22;
    g.strokeStyle = mid;
    trace(g, 'orb', r);
    g.stroke();
    g.fillStyle = light;
    g.beginPath();
    g.arc(-r * 0.3, -r * 0.3, r * 0.18, 0, Math.PI * 2);
    g.fill();
  } else {
    const fill = g.createRadialGradient(-r * 0.25, -r * 0.3, 0, 0, 0, r);
    fill.addColorStop(0, light);
    fill.addColorStop(0.5, mid);
    fill.addColorStop(1, dark);
    g.fillStyle = fill;
    trace(g, shape, r);
    g.fill();
    if (shape === 'coin') {
      g.lineWidth = r * 0.14;
      g.strokeStyle = dark;
      g.stroke();
    }
  }
  sprites.set(id, canvas);
  return canvas;
}

function radial(g, x, y, r, stops) {
  const fill = g.createRadialGradient(x, y, 0, x, y, r);
  stops.forEach(([at, color]) => fill.addColorStop(at, color));
  return fill;
}

function alpha(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function frameAt(keys, u) {
  let i = 1;
  while (i < keys.length - 1 && keys[i].t < u) i++;
  const a = keys[i - 1];
  const b = keys[i];
  const f = b.t === a.t ? 1 : Math.min(1, Math.max(0, (u - a.t) / (b.t - a.t)));
  const mix = (p) => (a[p] ?? 0) + ((b[p] ?? 0) - (a[p] ?? 0)) * f;
  return { x: mix('x'), y: mix('y'), s: mix('s'), r: mix('r'), a: mix('a') };
}

function toss(from, to, lift, size, spin = 0, fadeFrom = 0.8) {
  return steps(10).map((t) => ({
    t,
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t - lift * 4 * t * (1 - t),
    s: size,
    r: spin * t,
    a: fadeOut(t, fadeFrom),
  }));
}

function strokePath(g, points) {
  g.beginPath();
  points.forEach(({ x, y }, i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
}

function zigzag(from, to, count, jitter) {
  return steps(count).map((t, i) => ({
    x: from.x + (to.x - from.x) * t + (i && i < count ? rnd(-jitter, jitter) : 0),
    y: from.y + (to.y - from.y) * t + (i && i < count ? rnd(-jitter, jitter) * 0.4 : 0),
  }));
}

function trail(g, point, head, length, width, colors, segments = 16) {
  g.lineCap = 'round';
  for (let j = 0; j < segments; j++) {
    const t0 = head - (length * j) / segments;
    const t1 = head - (length * (j + 1)) / segments;
    if (t0 < 0 || t1 > 1) continue;
    const a = point(Math.min(1, t0));
    const b = point(Math.max(0, t1));
    g.strokeStyle = j < segments * 0.25 ? colors[0] : colors[1];
    g.lineWidth = Math.max(0.5, width * (1 - j / segments));
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
  }
}

function paintedSprite(id, paint) {
  if (sprites.has(id)) return sprites.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE;
  const g = canvas.getContext('2d');
  g.translate(SPRITE / 2, SPRITE / 2);
  paint(g, SPRITE * 0.3);
  sprites.set(id, canvas);
  return canvas;
}

const PIXEL_ART = {
  heart: ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'],
  star: ['...X...', '...X...', 'XXXXXXX', '.XXXXX.', '..XXX..', '.XX.XX.', 'X.....X'],
  coin: ['..XXX..', '.XOOOX.', 'XOXOXOX', 'XOXOXOX', 'XOXOXOX', '.XOOOX.', '..XXX..'],
};

const DRAGON_HEAD = [
  '...KGGK....KGGK.........................',
  '...KGOGK...KGOGK........................',
  '....KGOGKK..KGOGK.......................',
  '.....KGOGGK.KGOOGK......................',
  '......KGOGGK.KGOGK.......K..............',
  '.......KGOGGK.KGOGK.....KGK.K...........',
  '....KKK.KGOGGK.KOGGK...KGK.KGK..........',
  '...KNNMKKKGOGGKKGOGGK.KGGKKGK..K........',
  '....KNNNMMNGOGGKKOOGKKKGGGGK.KKGK.......',
  '.....KKNNNMMNOGGKKOSGGGGYGYGKGGK........',
  '.......KNNNNMMOSSSSLSGKKKGGGGKKK.KKK....',
  '........KKNNMNSLLLLLLSKKKKKKKOOOKGGGK...',
  'KKKKKKKKKKKKNLLBDBBBDLLLKKHFKKKLGYYYGK..',
  'MMNMMNMMNMMNLLBBBBBBBBLLLHFEFHLLGYYYGK..',
  'KKNNNMMNMMNMLBDGGBDBBBDBLLBLLLBBGGGKGK..',
  '..KKKNNNNNNLGBGBGGBBBBBBBLLLLLBBLGGGK...',
  '.....KKKKMMNGBGGDGBBDBBBDBBBDBBBBLLK....',
  '........KKKKGBGGDGDDDBDDDBDDDBDDDLKGK...',
  '.....KKKMNMMGGDDGGDRRWRRWRRWRRWRRWKKGK..',
  '.KKKKNNNNNNNNNGGDDDBRWRRWRRWRRWRRWK.KGK.',
  'KNNNNNNNNNNNNNNDDDDDRRRRWWRRRRWRRRK..KGK',
  '.KKNNNNKKKKKKNNKKKKGGGGGGWKRRRWRRRK..KGK',
  '...KKKK...KKNNNK..KGGGGGGGGGGGGGGK..KGGK',
  '.........KNNNNNKKKKOOOOOOOOOGGGGGK..KGK.',
  '........KNNNKKKKOOOOGGGGGGKKKKKKK...KGK.',
  '.......KNKNK...KOOOKKGGGGGK..........KGK',
  '........KNK....KOOK..KGGGK............KG',
  '.......KNK.....KOK...KGGGK.............K',
  '........K.......K.....KGK...............',
  '.......................K................',
];
const DRAGON_RAMPS = {
  scale: ['#5e5a78', '#3c3a52', '#26243a', '#16141f'],
  gold: ['#fff0a8', '#f2c14a', '#c98a1e', '#7a4a10'],
  mane: ['#ffffff', '#d8d6e6', '#9a96b4', '#5c5878'],
  eye: ['#ff5a3a', '#d0141a', '#6a0a14'],
  mouth: ['#4a0a14', '#f4ecd8'],
  outline: ['#07060c'],
};
const headPalette = (ramps) => ({
  K: ramps.outline[0], S: ramps.scale[0], L: ramps.scale[1], B: ramps.scale[2], D: ramps.scale[3],
  Y: ramps.gold[1], G: ramps.gold[2], O: ramps.gold[3],
  M: ramps.mane[1], N: ramps.mane[2],
  E: ramps.eye[0], F: ramps.eye[1], H: ramps.eye[2],
  R: ramps.mouth[0], W: ramps.mouth[1], P: ramps.outline[0],
});
const DRAGON_NECK = { x: 14, y: 17 };
const BODY_BANDS = [[1, 0.6, 'light'], [0.6, -0.3, 'mid'], [-0.3, -0.75, 'belly'], [-0.75, -1, 'bellyDark']];

function dragonHeadSprite(ramps = DRAGON_RAMPS, name = 'dragon') {
  const id = `head|${name}`;
  const palette = headPalette(ramps);
  if (sprites.has(id)) return sprites.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = DRAGON_HEAD[0].length;
  canvas.height = DRAGON_HEAD.length;
  const g = canvas.getContext('2d');
  DRAGON_HEAD.forEach((line, y) => [...line].forEach((mark, x) => {
    if (mark === '.') return;
    g.fillStyle = palette[mark];
    g.fillRect(x, y, 1, 1);
  }));
  sprites.set(id, canvas);
  return canvas;
}

const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const shade = (hex, amount) => `#${hexRgb(hex).map((v) => Math.round(v * amount).toString(16).padStart(2, '0')).join('')}`;
const MIN_ALPHA = 96;
const PALETTE_CACHE = new Map();
const LIGHT_STRENGTH = 0.7;
const LIGHT_SCALE = 0.5;

const ALPHA_STEPS = [0, 110, 190, 255];

function steppedAlpha(a) {
  if (a < ALPHA_STEPS[1] * 0.5) return 0;
  return ALPHA_STEPS.reduce((best, step) => (Math.abs(step - a) < Math.abs(best - a) ? step : best), 255);
}

function snapToPalette(o, width, height, palette, stepAlpha = false) {
  const cacheKey = palette.join();
  if (!PALETTE_CACHE.has(cacheKey)) PALETTE_CACHE.set(cacheKey, { colors: palette.map(hexRgb), nearest: new Map() });
  const { colors, nearest } = PALETTE_CACHE.get(cacheKey);
  const image = o.getImageData(0, 0, width, height);
  const data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    if (stepAlpha) {
      data[i + 3] = steppedAlpha(data[i + 3]);
      if (!data[i + 3]) continue;
    } else if (data[i + 3] < MIN_ALPHA) {
      data[i + 3] = 0;
      continue;
    }
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let color = nearest.get(key);
    if (!color) {
      let best = Infinity;
      for (const candidate of colors) {
        const d = (candidate[0] - data[i]) ** 2 * 0.3 + (candidate[1] - data[i + 1]) ** 2 * 0.59 + (candidate[2] - data[i + 2]) ** 2 * 0.11;
        if (d < best) [best, color] = [d, candidate];
      }
      nearest.set(key, color);
    }
    data[i] = color[0];
    data[i + 1] = color[1];
    data[i + 2] = color[2];
  }
  o.putImageData(image, 0, 0);
}

function pixelated(draw) {
  return draw;
}

const pixelSize = (k) => Math.max(2, Math.round(k * 1.1));

const HOLY_POINTS = 7;
const GEMS = [['#ffd0d8', '#e8203e', '#7a0a1e'], ['#d0ffe0', '#20c060', '#0a5a2a'], ['#d0e4ff', '#2a6ae8', '#0a2a7a']];

const DRACONIC_FLIGHT = { name: 'dragon', ramps: DRAGON_RAMPS, dur: 2600, turns: 1.6, radius: 44, rise: 132, thickness: 5.4, head: 1.15, delay: 120 };

function dragonFlight({ p, k, body, layer, usePalette }, look) {
  const colors = Object.values(look.ramps).flat();
  usePalette(colors);
  const [shine, light, mid, dark] = look.ramps.scale;
  const scale = { shine, light, mid, dark, ink: look.ramps.outline[0] };
  const mane = { light: look.ramps.mane[1], dark: look.ramps.mane[2] };
  const belly = look.ramps.gold.slice(1);
  const gold = { light: look.ramps.gold[1], mid: look.ramps.gold[2], dark: look.ramps.gold[3] };
  const { dur, turns } = look;
  const helix = (t) => {
    const ang = -Math.PI / 2 + t * TAU * turns;
    const r = look.radius * (1 - t * 0.32) * k;
    return { x: body.x + Math.cos(ang) * r, y: p.y + 10 * k - t * look.rise * k + Math.sin(ang) * r * 0.32, depth: Math.sin(ang) };
  };
  const top = helix(1);
  const EXIT = 0.6;
  const path = (t) => {
    if (t <= 1) return helix(t);
    const e = (t - 1) / EXIT;
    return { x: top.x + (body.x - top.x) * Math.min(1, e * 1.5), y: top.y - e * e * (top.y + 90 * k) - e * 20 * k, depth: 0.4 };
  };
  const length = 0.62;
  const samples = 30;
  const profile = (s) => (s < 0.08 ? 0.7 + s * 3.7 : s < 0.32 ? 1 : Math.max(0.16, 1 - (s - 0.32) * 1.2));
  const frame = (t) => {
    const at = path(Math.max(0, t));
    const ahead = path(Math.max(0, t) + 0.004);
    const behind = path(Math.max(0, t - 0.004));
    const len = Math.hypot(ahead.x - behind.x, ahead.y - behind.y) || 1;
    const dir = { x: (ahead.x - behind.x) / len, y: (ahead.y - behind.y) / len };
    return { ...at, dir, up: { x: dir.y, y: -dir.x }, persp: 1 + at.depth * 0.16 };
  };
  const offset = (f, along, across) => ({ x: f.x + f.dir.x * along + f.up.x * across, y: f.y + f.dir.y * along + f.up.y * across });
  const quad = (g, a, b, c, d) => {
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.lineTo(c.x, c.y);
    g.lineTo(d.x, d.y);
    g.closePath();
    g.fill();
  };
  const curve = (g, from, control, to, width, color) => {
    g.strokeStyle = color;
    g.lineWidth = width;
    g.beginPath();
    g.moveTo(from.x, from.y);
    g.quadraticCurveTo(control.x, control.y, to.x, to.y);
    g.stroke();
  };
  const bandColor = { light: scale.light, mid: scale.mid, belly: belly[0], bellyDark: belly[1] };
  const headAt = (u) => (1 + EXIT + length + 0.05) * u ** 1.5;

  layer((g, u) => {
    const head = headAt(u);
    const fade = Math.min(1, u * 12);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.globalAlpha = fade;
    const ring = [];
    for (let i = samples; i >= 0; i--) {
      const s = i / samples;
      const t = head - s * length;
      if (t < 0) continue;
      const f = frame(t);
      ring.push({ s, i, f, r: look.thickness * k * profile(s) * f.persp });
    }
    for (const { f, r, s } of ring) {
      if (Math.abs(s - 0.2) > 0.02 && Math.abs(s - 0.58) > 0.02) continue;
      for (const flip of [-1, 1]) {
        const shoulder = offset(f, 0, -r * 0.3);
        const knee = { x: shoulder.x - f.dir.x * 5 * k + flip * 3 * k, y: shoulder.y + 7 * k };
        const paw = { x: knee.x + f.dir.x * 4 * k, y: knee.y + 5 * k };
        for (const [width, color] of [[4.6 * k, scale.ink], [2.8 * k, scale.mid]]) {
          g.strokeStyle = color;
          g.lineWidth = width;
          g.beginPath();
          g.moveTo(shoulder.x, shoulder.y);
          g.lineTo(knee.x, knee.y);
          g.lineTo(paw.x, paw.y);
          g.stroke();
        }
        g.strokeStyle = gold.light;
        g.lineWidth = 1.1 * k;
        for (let c = -1; c <= 1; c++) {
          g.beginPath();
          g.moveTo(paw.x, paw.y);
          g.lineTo(paw.x + (f.dir.x * 2.5 + c * 1.8) * k, paw.y + 2.8 * k);
          g.stroke();
        }
      }
    }
    for (const { f, r, i } of ring) {
      if (i % 3 !== 0 || i < 3 || i > samples - 3) continue;
      const sway = Math.sin(u * 15 + i * 0.6) * r * 0.3;
      g.fillStyle = gold.mid;
      g.beginPath();
      g.moveTo(offset(f, r * 0.5, r * 0.8).x, offset(f, r * 0.5, r * 0.8).y);
      g.quadraticCurveTo(offset(f, 0, r * 1.6).x, offset(f, 0, r * 1.6).y, offset(f, -r * 0.8 + sway, r * 2.1).x, offset(f, -r * 0.8 + sway, r * 2.1).y);
      g.lineTo(offset(f, -r * 0.5, r * 0.8).x, offset(f, -r * 0.5, r * 0.8).y);
      g.closePath();
      g.fill();
    }
    g.fillStyle = scale.ink;
    for (let n = 1; n < ring.length; n++) {
      const a = ring[n - 1];
      const b = ring[n];
      const pad = 1.4 * k;
      quad(g, offset(a.f, -0.7 * k, a.r + pad), offset(b.f, 0.7 * k, b.r + pad), offset(b.f, 0.7 * k, -b.r - pad), offset(a.f, -0.7 * k, -a.r - pad));
    }
    for (let n = 1; n < ring.length; n++) {
      const a = ring[n - 1];
      const b = ring[n];
      for (const [from, to, band] of BODY_BANDS) {
        g.fillStyle = bandColor[band];
        quad(g, offset(a.f, -0.7 * k, a.r * from), offset(b.f, 0.7 * k, b.r * from), offset(b.f, 0.7 * k, b.r * to), offset(a.f, -0.7 * k, a.r * to));
      }
      if (b.i % 2 === 0) {
        g.strokeStyle = alpha(gold.mid, 0.6);
        g.lineWidth = 0.7 * k;
        const arc = offset(b.f, -b.r * 0.2, b.r * 0.25);
        const heading = Math.atan2(b.f.dir.y, b.f.dir.x);
        g.beginPath();
        g.arc(arc.x, arc.y, b.r * 0.42, heading + 1.9, heading + 4.4);
        g.stroke();
      }
    }
    const tail = ring[0];
    if (tail && tail.s > 0.97) {
      for (let n = 0; n < 6; n++) {
        const spread = (n - 2.5) * 3 * k;
        const wave = Math.sin(u * 12 + n) * 4 * k;
        curve(g, tail.f, offset(tail.f, -10 * k, spread + wave), offset(tail.f, -20 * k, spread * 1.6 - wave), (2.4 - Math.abs(n - 2.5) * 0.3) * k, n % 2 ? mane.dark : mane.light);
      }
    }
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = scale.ink;
    for (let n = 1; n < ring.length; n++) {
      const a = ring[n - 1];
      const b = ring[n];
      const reach = Math.max(a.r, b.r) * 2.8 + 6 * k;
      g.globalAlpha = fade * Math.min(0.78, 0.82 * b.s ** 0.8);
      quad(g, offset(a.f, -0.8 * k, reach), offset(b.f, 0.8 * k, reach), offset(b.f, 0.8 * k, -reach), offset(a.f, -0.8 * k, -reach));
    }
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = fade;
    const f = frame(head);
    const cell = look.head * k * f.persp;
    const headSprite = dragonHeadSprite(look.ramps, look.name);
    g.save();
    g.translate(f.x, f.y);
    if (f.dir.x < 0) g.scale(-1, 1);
    g.rotate(Math.atan2(f.dir.y, Math.abs(f.dir.x)));
    g.imageSmoothingEnabled = false;
    g.drawImage(headSprite, -DRAGON_NECK.x * cell, -DRAGON_NECK.y * cell, headSprite.width * cell, headSprite.height * cell);
    g.restore();
    const pearl = path(head + 0.16);
    for (const [radius, color] of [[1.5, alpha(gold.mid, 0.35)], [1, gold.mid], [0.65, gold.light], [0.35, '#ffffff']]) {
      g.fillStyle = color;
      g.beginPath();
      g.arc(pearl.x, pearl.y, 7 * k * radius, 0, TAU);
      g.fill();
    }
  }, dur, look.delay, true);
}

function starPath(g, points, radius, rotation = 0) {
  const outline = (start, step) => {
    g.beginPath();
    for (let i = 0; i <= points; i++) {
      const angle = rotation - Math.PI / 2 + start + ((i * step) % points) * (TAU / points);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
  };
  if (points % 2 === 0) {
    const half = points / 2;
    for (let shape = 0; shape < 2; shape++) {
      g.beginPath();
      for (let i = 0; i <= half; i++) {
        const angle = rotation - Math.PI / 2 + (shape + i * 2) * (TAU / points);
        if (i) g.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        else g.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      g.stroke();
    }
    return;
  }
  outline(0, Math.floor((points - 1) / 2));
}

function pixelSprite(name, color) {
  return paintedSprite(`pixel|${name}|${color}`, (g, r) => {
    const cell = (r * 2) / 7;
    PIXEL_ART[name].forEach((line, y) => [...line].forEach((mark, x) => {
      if (mark === '.') return;
      g.fillStyle = mark === 'O' ? '#ffffff' : color;
      g.fillRect(-r + x * cell, -r + y * cell, cell + 0.5, cell + 0.5);
    }));
  });
}

const ladybugSprite = () => paintedSprite('ladybug', (g, r) => {
  g.fillStyle = '#1a1416';
  g.beginPath();
  g.arc(0, -r * 0.62, r * 0.42, 0, TAU);
  g.fill();
  g.fillStyle = radial(g, -r * 0.2, -r * 0.2, r, [[0, '#ff8a8a'], [0.5, '#e8293f'], [1, '#8a0c1e']]);
  g.beginPath();
  g.ellipse(0, r * 0.1, r * 0.72, r * 0.82, 0, 0, TAU);
  g.fill();
  g.strokeStyle = '#1a1416';
  g.lineWidth = r * 0.08;
  g.beginPath();
  g.moveTo(0, -r * 0.7);
  g.lineTo(0, r * 0.92);
  g.stroke();
  g.fillStyle = '#1a1416';
  [[-0.35, -0.15], [0.35, -0.15], [-0.4, 0.35], [0.4, 0.35], [-0.18, 0.65], [0.18, 0.65]].forEach(([x, y]) => {
    g.beginPath();
    g.arc(x * r, y * r, r * 0.13, 0, TAU);
    g.fill();
  });
});

const jellySprite = ([light, mid, dark]) => paintedSprite(`jelly|${mid}`, (g, r) => {
  g.fillStyle = radial(g, 0, -r * 0.3, r * 1.2, [[0, alpha(mid, 0.5)], [1, alpha(mid, 0)]]);
  g.fillRect(-r * 1.5, -r * 1.5, r * 3, r * 3);
  g.strokeStyle = alpha(light, 0.85);
  g.lineWidth = r * 0.09;
  g.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    const x = (-0.45 + i * 0.3) * r;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + r * 0.2, r * 0.35, x - r * 0.2, r * 0.6, x + r * 0.05, r * 0.95);
    g.stroke();
  }
  g.fillStyle = radial(g, -r * 0.15, -r * 0.45, r * 0.8, [[0, '#ffffff'], [0.35, light], [1, alpha(dark, 0.9)]]);
  g.beginPath();
  g.moveTo(-r * 0.7, 0);
  g.bezierCurveTo(-r * 0.75, -r * 0.95, r * 0.75, -r * 0.95, r * 0.7, 0);
  for (let i = 0; i < 5; i++) g.quadraticCurveTo(r * (0.7 - i * 0.28 - 0.14), r * 0.16, r * (0.7 - (i + 1) * 0.28), 0);
  g.fill();
});

const cloverSprite = ([light, mid, dark]) => paintedSprite(`clover|${mid}`, (g, r) => {
  g.fillStyle = radial(g, 0, 0, r, [[0, light], [0.5, mid], [1, dark]]);
  for (let i = 0; i < 4; i++) {
    g.save();
    g.rotate((TAU / 4) * i + TAU / 8);
    g.translate(0, -r * 0.45);
    g.beginPath();
    g.moveTo(0, r * 0.42);
    g.bezierCurveTo(-r * 0.7, 0, -r * 0.4, -r * 0.55, 0, -r * 0.2);
    g.bezierCurveTo(r * 0.4, -r * 0.55, r * 0.7, 0, 0, r * 0.42);
    g.fill();
    g.restore();
  }
  g.strokeStyle = dark;
  g.lineWidth = r * 0.1;
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(r * 0.25, r * 0.6, r * 0.1, r);
  g.stroke();
});

const cardSprite = ([, mid, dark], [, gold]) => paintedSprite(`card|${mid}|${gold}`, (g, r) => {
  const w = r * 1.1;
  const h = r * 1.6;
  g.fillStyle = '#fbf7ff';
  g.strokeStyle = mid;
  g.lineWidth = r * 0.12;
  g.beginPath();
  g.roundRect(-w / 2, -h / 2, w, h, r * 0.15);
  g.fill();
  g.stroke();
  g.strokeStyle = alpha(dark, 0.5);
  g.lineWidth = r * 0.05;
  g.strokeRect(-w * 0.36, -h * 0.4, w * 0.72, h * 0.8);
  g.fillStyle = gold;
  g.beginPath();
  g.moveTo(0, -r * 0.42);
  g.lineTo(r * 0.28, 0);
  g.lineTo(0, r * 0.42);
  g.lineTo(-r * 0.28, 0);
  g.fill();
});

const shurikenSprite = (red) => paintedSprite(`shuriken|${red}`, (g, r) => {
  g.fillStyle = radial(g, -r * 0.2, -r * 0.2, r, [[0, '#ffffff'], [0.5, '#c4ccd8'], [1, '#5a6270']]);
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const ang = (TAU / 8) * i - Math.PI / 2;
    const d = i % 2 ? r * 0.38 : r;
    g.lineTo(Math.cos(ang) * d, Math.sin(ang) * d);
  }
  g.fill();
  g.fillStyle = red;
  g.beginPath();
  g.arc(0, 0, r * 0.16, 0, TAU);
  g.fill();
});

const limeSprite = () => paintedSprite('lime', (g, r) => {
  g.fillStyle = '#4f8a12';
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();
  g.fillStyle = '#f2ffd0';
  g.beginPath();
  g.arc(0, 0, r * 0.86, 0, TAU);
  g.fill();
  g.fillStyle = radial(g, 0, 0, r * 0.8, [[0, '#f4ffc8'], [1, '#b8e85a']]);
  for (let i = 0; i < 8; i++) {
    g.beginPath();
    g.moveTo(Math.cos((TAU / 8) * (i + 0.5)) * r * 0.1, Math.sin((TAU / 8) * (i + 0.5)) * r * 0.1);
    g.arc(0, 0, r * 0.76, (TAU / 8) * i + 0.08, (TAU / 8) * (i + 1) - 0.08);
    g.closePath();
    g.fill();
  }
});

const mintSprite = ([light, mid, dark]) => paintedSprite(`mint|${mid}`, (g, r) => {
  const side = (dir) => steps(12).map((t, i) => {
    const w = Math.sin(Math.PI * t) ** 0.8 * r * 0.55 * (i % 2 ? 0.82 : 1);
    return { x: dir * w, y: -r + 2 * r * t };
  });
  g.fillStyle = radial(g, -r * 0.2, -r * 0.3, r * 1.1, [[0, light], [0.45, mid], [1, dark]]);
  g.beginPath();
  [...side(1), ...side(-1).reverse()].forEach(({ x, y }, i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.fill();
  g.strokeStyle = alpha(light, 0.9);
  g.lineWidth = r * 0.07;
  g.beginPath();
  g.moveTo(0, -r * 0.85);
  g.lineTo(0, r * 0.95);
  for (const y of [-0.4, 0, 0.4]) {
    g.moveTo(0, y * r);
    g.lineTo(-r * 0.3, (y - 0.25) * r);
    g.moveTo(0, y * r);
    g.lineTo(r * 0.3, (y - 0.25) * r);
  }
  g.stroke();
});

const flowerSprite = (petal, center) => paintedSprite(`flower|${petal.join()}|${center}`, (g, r) => {
  g.fillStyle = radial(g, 0, 0, r, [[0, petal[0]], [0.6, petal[1]], [1, petal[2]]]);
  for (let i = 0; i < 5; i++) {
    g.save();
    g.rotate((TAU / 5) * i);
    g.beginPath();
    g.ellipse(0, -r * 0.5, r * 0.32, r * 0.5, 0, 0, TAU);
    g.fill();
    g.restore();
  }
  g.fillStyle = center;
  g.beginPath();
  g.arc(0, 0, r * 0.26, 0, TAU);
  g.fill();
});

function wander(start, spread, phase) {
  return (t) => ({ x: start.x + Math.sin(t * 5 + phase) * spread + Math.sin(t * 11 + phase * 2) * spread * 0.3, y: start.y + Math.cos(t * 4 + phase) * spread * 0.6 - t * spread * 0.8 });
}


const spoonSprite = (glow) => paintedSprite(`spoon|${glow}`, (g, r) => {
  g.fillStyle = radial(g, 0, 0, r * 1.4, [[0, alpha(glow, 0.55)], [1, alpha(glow, 0)]]);
  g.fillRect(-r * 1.4, -r * 1.4, r * 2.8, r * 2.8);
  const steel = g.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
  steel.addColorStop(0, '#8d96a3');
  steel.addColorStop(0.5, '#ffffff');
  steel.addColorStop(1, '#a7b0bc');
  g.fillStyle = steel;
  g.beginPath();
  g.ellipse(0, -r * 0.55, r * 0.28, r * 0.4, 0, 0, TAU);
  g.fill();
  g.beginPath();
  g.roundRect(-r * 0.07, -r * 0.2, r * 0.14, r * 1.15, r * 0.07);
  g.fill();
});

function runeGlyph(g, x, y, size, variant) {
  const strokes = [
    [[0, -1, 0, 1], [0, -0.3, 0.6, -0.9]],
    [[-0.5, -1, -0.5, 1], [-0.5, -1, 0.5, 0], [0.5, 0, -0.5, 1]],
    [[0, -1, 0, 1], [-0.6, -0.4, 0.6, 0.4], [0.6, -0.4, -0.6, 0.4]],
    [[-0.6, 1, 0, -1], [0, -1, 0.6, 1], [-0.3, 0.2, 0.3, 0.2]],
    [[-0.6, -1, 0.6, -1], [0, -1, 0, 1], [-0.6, 1, 0.6, 1]],
    [[-0.5, -1, 0.5, 1], [0.5, -1, -0.5, 1], [-0.5, 0, 0.5, 0]],
  ][variant % 6];
  g.beginPath();
  for (const [x1, y1, x2, y2] of strokes) {
    g.moveTo(x + x1 * size, y + y1 * size);
    g.lineTo(x + x2 * size, y + y2 * size);
  }
  g.stroke();
}

const SIGNATURES = {
  comet({ p, k, tier, theme, layer }) {
    const head = spriteFor('star', ['#ffffff', theme.accent[0], theme.colors[1]], true);
    const [light, mid] = theme.colors;
    for (let i = 0; i < 1 + tier * 2; i++) {
      const ang = rnd(-2.7, -0.45);
      const len = rnd(55, 90) * k;
      const from = { x: p.x + rnd(-6, 6) * k, y: p.y - 8 * k };
      layer((g, u) => {
        const e = ease.out(u);
        const x = from.x + Math.cos(ang) * len * e;
        const y = from.y + Math.sin(ang) * len * e;
        const tail = 26 * k * (1 - u * 0.5);
        const tx = x - Math.cos(ang) * tail;
        const ty = y - Math.sin(ang) * tail;
        g.globalAlpha = fadeOut(u, 0.6);
        g.globalCompositeOperation = 'lighter';
        const fill = g.createLinearGradient(x, y, tx, ty);
        fill.addColorStop(0, light);
        fill.addColorStop(1, alpha(mid, 0));
        g.strokeStyle = fill;
        g.lineWidth = 3 * k;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(tx, ty);
        g.stroke();
        const side = 13 * k;
        g.drawImage(head, x - side / 2, y - side / 2, side, side);
      }, rnd(650, 900), 60 + i * 70);
    }
  },

  chevrons({ p, k, tier, theme, add, layer }) {
    const bright = spriteFor('chevron', theme.colors, true);
    const pale = spriteFor('chevron', ['#ffffff', theme.colors[0], theme.colors[1]], true);
    for (let row = 0; row < 2 + tier; row++) {
      for (const col of [-1, 0, 1]) {
        if (col && row % 2) continue;
        const x = p.x + col * 13 * k;
        const y = p.y - 6 * k;
        const s = k * (col ? 10 : 15);
        add({ img: col ? pale : bright, dur: 850, delay: row * 95, keys: [
          { t: 0, x, y, s: s * 0.3, a: 0 },
          { t: 0.2, x, y: y - 16 * k, s, a: 1 },
          { t: 0.65, x, y: y - 55 * k, s: s * 0.85, a: 1 },
          { t: 1, x, y: y - 80 * k, s: s * 0.6, a: 0 },
        ] });
      }
    }
    for (let i = 0; i < Math.ceil(tier / 2); i++) {
      layer((g, u) => {
        const y = p.y - ease.out(u) * 70 * k;
        const w = 26 * k * (1 - u * 0.4);
        g.globalAlpha = fadeOut(u, 0.4);
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = theme.colors[0];
        g.lineWidth = 2 * k;
        g.beginPath();
        g.ellipse(p.x, y, w, w * 0.28, 0, 0, TAU);
        g.stroke();
      }, 700, 80 + i * 220);
    }
  },

  ribbon({ p, k, body, tier, theme, add, layer }) {
    const loops = 1 + Math.ceil(tier / 2);
    for (let i = 0; i < loops; i++) {
      const phase = (i / loops) * TAU;
      const dir = i % 2 ? -1 : 1;
      const [light, mid] = i % 2 ? ['#ffffff', theme.colors[0]] : theme.colors;
      const point = (t) => {
        const ang = phase + dir * t * TAU * 1.35;
        return { x: body.x + Math.cos(ang) * 25 * k * (1 - t * 0.35), y: p.y - t * 52 * k + Math.sin(ang) * 8 * k };
      };
      layer((g, u) => {
        g.globalAlpha = fadeOut(u, 0.7);
        g.globalCompositeOperation = 'lighter';
        trail(g, point, ease.inOut(u) * 1.3, 0.4, 4.5 * k, [light, mid]);
      }, 1300, i * 140);
    }
    const heart = spriteFor('heart', ['#ffffff', theme.colors[0], theme.colors[1]], true);
    for (let i = 0; i < 2 + tier * 2; i++) {
      const x = body.x + rnd(-26, 26) * k;
      const y = p.y - rnd(0, 10) * k;
      const sway = rnd(5, 9) * k;
      const s = k * rnd(4, 6.5);
      add({ img: heart, dur: rnd(1000, 1300), delay: 250 + rnd(0, 500), curve: ease.linear, keys: steps(8).map((t) => ({
        t, x: x + Math.sin(t * TAU) * sway, y: y - t * 55 * k, s: s * (0.5 + swell(t, 0.25, 0.8) * 0.6), a: swell(t, 0.15, 0.7),
      })) });
    }
  },

  pixels({ p, k, body, tier, theme, layer }) {
    const cell = 3.5 * k;
    const snap = (v) => Math.round(v / cell) * cell;
    const palette = [theme.colors[0], theme.colors[1], theme.accent[1], '#ffffff'];
    const bits = Array.from({ length: 10 + tier * 5 }, (_, i) => ({ ang: rnd(0, TAU), far: rnd(18, 58) * k, color: palette[i % palette.length], size: rnd(1, 2) }));
    layer((g, u) => {
      const frame = Math.floor(u * 9) / 9;
      g.globalAlpha = fadeOut(frame, 0.6);
      g.globalCompositeOperation = 'lighter';
      for (const bit of bits) {
        const reach = ease.out(frame) * bit.far;
        const side = cell * bit.size * (1.2 - frame * 0.6);
        g.fillStyle = bit.color;
        g.fillRect(snap(p.x + Math.cos(bit.ang) * reach) - side / 2, snap(p.y - 10 * k + Math.sin(bit.ang) * reach * 0.8) - side / 2, side, side);
      }
    }, 900);
    const glitches = Array.from({ length: 2 + tier }, (_, i) => ({
      delay: 60 + i * 170,
      bands: Array.from({ length: 6 }, () => Array.from({ length: 3 }, () => ({ y: rnd(-45, 5) * k, h: rnd(2, 6) * k, shift: rnd(-16, 16) * k, w: rnd(30, 70) * k }))),
    }));
    for (const { delay, bands } of glitches) {
      layer((g, u) => {
        const frame = bands[Math.min(bands.length - 1, Math.floor(u * bands.length))];
        g.globalAlpha = 0.75 * (1 - u * 0.5);
        g.globalCompositeOperation = 'lighter';
        frame.forEach((band, i) => {
          g.fillStyle = alpha(i % 2 ? theme.accent[1] : theme.colors[1], 0.7);
          g.fillRect(body.x - band.w / 2 + band.shift, body.y + band.y, band.w, band.h);
        });
      }, 240, delay);
    }
  },

  aura({ p, k, body, tier, add, sprite }) {
    for (let i = 0; i < 6 + tier * 3; i++) {
      const ang = rnd(0, TAU);
      const x = body.x + Math.cos(ang) * 20 * k;
      const y = p.y + Math.sin(ang) * 6 * k;
      const s = k * rnd(5, 8);
      const lean = rnd(-6, 6) * k;
      add({ img: sprite('flame', i % 3 === 2), dur: rnd(650, 850), delay: 120 + rnd(0, 700), curve: ease.linear, keys: [
        { t: 0, x, y, s: s * 0.4, a: 0 },
        { t: 0.25, x: x + lean * 0.3, y: y - 14 * k, s, a: 0.95 },
        { t: 1, x: x + lean, y: y - rnd(45, 65) * k, s: s * 0.25, a: 0 },
      ] });
    }
    for (let i = 0; i < 2 + tier; i++) {
      const start = (i / (2 + tier)) * TAU;
      add({ img: sprite('orb', true), dur: 1500, delay: 200, curve: ease.linear, keys: steps(12).map((t) => {
        const ang = start + t * TAU * 1.5;
        return { t, x: body.x + Math.cos(ang) * 32 * k, y: body.y - 4 * k + Math.sin(ang) * 10 * k - t * 10 * k, s: k * 4 * (Math.sin(ang) > 0 ? 1.2 : 0.75), a: swell(t, 0.12, 0.8) };
      }) });
    }
  },

  bolts({ p, k, tier, theme, layer }) {
    const mid = theme.colors[1];
    const strike = (from, to, delay, width, flash) => {
      const points = zigzag(from, to, 7, 10 * k);
      layer((g, u, w, h) => {
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = Math.min(1, u / 0.1) * (1 - ease.inOut(u));
        g.lineJoin = 'round';
        g.lineCap = 'round';
        strokePath(g, points);
        g.strokeStyle = alpha(mid, 0.6);
        g.lineWidth = width * 2.8 * k;
        g.stroke();
        g.strokeStyle = '#ffffff';
        g.lineWidth = width * k;
        g.stroke();
      }, 460, delay);
    };
    const strikes = tier >= 4 ? tier - 1 : 1;
    for (let i = 0; i < strikes; i++) {
      strike({ x: p.x + rnd(-45, 45) * k, y: p.y - rnd(110, 140) * k }, { x: p.x + rnd(-8, 8) * k, y: p.y - 6 * k }, i * 150, tier >= 4 ? 1.8 : 1.3, tier >= 4);
    }
    for (let i = 0; i < 1 + tier; i++) {
      const ang = rnd(0, TAU);
      const far = rnd(26, 42) * k;
      strike({ x: p.x, y: p.y - 10 * k }, { x: p.x + Math.cos(ang) * far, y: p.y - 10 * k + Math.sin(ang) * far * 0.7 }, 80 + rnd(0, 600), 1, false);
    }
  },

  frost({ p, k, tier, theme, add, layer }) {
    const count = 5 + tier * 2;
    const spike = spriteFor('shard', theme.colors, true);
    const flake = spriteFor('flake', ['#ffffff', '#e0f4ff', theme.colors[1]], true);
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * TAU + rnd(-0.2, 0.2);
      const x = p.x + Math.cos(ang) * 28 * k;
      const s = k * rnd(9, 13);
      const y = p.y + Math.sin(ang) * 9 * k - s * 0.45;
      const lean = Math.cos(ang) * 0.45;
      add({ img: spike, dur: 1150, delay: i * 35, curve: ease.linear, keys: [
        { t: 0, x, y: y + s * 0.4, s: 0, r: lean, a: 0 },
        { t: 0.18, x, y, s, r: lean, a: 1 },
        { t: 0.75, x, y, s, r: lean, a: 1 },
        { t: 0.82, x, y, s: s * 1.12, r: lean, a: 1 },
        { t: 1, x, y, s: s * 0.3, r: lean, a: 0 },
      ] });
      for (let j = 0; j < 2; j++) {
        const out = ang + rnd(-0.6, 0.6);
        const far = rnd(18, 34) * k;
        add({ img: flake, dur: 520, delay: 870 + i * 35, keys: [
          { t: 0, x, y, s: k * 2, r: 0, a: 1 },
          { t: 1, x: x + Math.cos(out) * far, y: y + Math.sin(out) * far * 0.5 - 8 * k, s: k * 3.5, r: 3, a: 0 },
        ] });
      }
    }
    layer((g, u) => {
      const w = 48 * k * (0.4 + ease.out(u) * 0.6);
      g.globalAlpha = 0.7 * swell(u, 0.2, 0.6);
      g.globalCompositeOperation = 'lighter';
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.32);
      g.fillStyle = radial(g, 0, 0, w, [[0, '#ffffff'], [0.5, alpha(theme.colors[0], 0.6)], [1, alpha(theme.colors[1], 0)]]);
      g.fillRect(-w, -w, w * 2, w * 2);
      g.restore();
    }, 1300);
  },

  eruption({ p, k, tier, theme, add, layer }) {
    for (let i = 0; i < 4 + tier * 3; i++) {
      const to = { x: p.x + rnd(-62, 62) * k, y: p.y + rnd(0, 12) * k };
      add({ img: spriteFor('chunk', i % 2 ? theme.accent : theme.colors, i % 2 === 0), dur: rnd(800, 1100), delay: rnd(0, 260), curve: ease.linear,
        keys: toss({ x: p.x, y: p.y - 8 * k }, to, rnd(55, 100) * k, k * rnd(3.5, 6), rnd(-7, 7)) });
    }
    const smoke = spriteFor('smoke', theme.accent, false);
    for (let i = 0; i < 2 + tier; i++) {
      const x = p.x + rnd(-14, 14) * k;
      add({ img: smoke, blend: 'source-over', dur: 1300, delay: 150 + i * 120, curve: ease.out, keys: [
        { t: 0, x, y: p.y - 6 * k, s: k * 5, a: 0 },
        { t: 0.3, x: x + rnd(-6, 6) * k, y: p.y - 30 * k, s: k * 10, a: 0.7 },
        { t: 1, x: x + rnd(-16, 16) * k, y: p.y - 80 * k, s: k * 18, a: 0 },
      ] });
    }
    layer((g, u) => {
      const w = 40 * k * (0.5 + Math.sin(u * Math.PI) * 0.5);
      g.globalAlpha = swell(u, 0.15, 0.6) * (0.8 + Math.sin(u * 30) * 0.2);
      g.globalCompositeOperation = 'lighter';
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.3);
      g.fillStyle = radial(g, 0, 0, w, [[0, theme.colors[0]], [0.35, theme.colors[1]], [1, alpha(theme.colors[2], 0)]]);
      g.fillRect(-w, -w, w * 2, w * 2);
      g.restore();
    }, 1400);
  },

  vortex({ k, body, tier, theme, add, layer, ring }) {
    const eye = { x: body.x, y: body.y - 48 * k };
    const [light, mid] = theme.accent;
    layer((g, u) => {
      g.globalAlpha = swell(u, 0.2, 0.7) * 0.85;
      g.globalCompositeOperation = 'lighter';
      g.lineCap = 'round';
      const spin = -u * 7;
      for (let arm = 0; arm < 3; arm++) {
        const points = steps(14).map((t) => {
          const ang = spin + (arm / 3) * TAU + t * 3.2;
          const r = (4 + t * 44) * k * (1 - u * 0.5);
          return { x: eye.x + Math.cos(ang) * r, y: eye.y + Math.sin(ang) * r * 0.55 };
        });
        strokePath(g, points);
        g.strokeStyle = alpha(mid, 0.55);
        g.lineWidth = 4 * k;
        g.stroke();
        g.strokeStyle = alpha(light, 0.8);
        g.lineWidth = 1.4 * k;
        g.stroke();
      }
    }, 1200);
    for (let i = 0; i < 10 + tier * 3; i++) {
      const start = rnd(0, TAU);
      const far = rnd(45, 80) * k;
      add({ img: spriteFor(i % 2 ? 'orb' : theme.shape, i % 2 ? theme.accent : theme.colors, !theme.shadow), dur: rnd(700, 950), delay: rnd(0, 380), curve: ease.inOut, keys: steps(8).map((t) => {
        const ang = start - t * 4.2;
        const r = far * (1 - t);
        return { t, x: eye.x + Math.cos(ang) * r, y: eye.y + Math.sin(ang) * r * 0.55, s: k * rnd(3, 5) * (1 - t * 0.6), a: swell(t, 0.15, 0.85) };
      }) });
    }
    ring({ count: 10 + tier * 2, dist: 40, size: 4.5, dur: 600, delay: 1050, accent: true, at: eye });
  },

  wisps({ k, body, tier, theme, add }) {
    const wisp = spriteFor('flame', theme.accent, true);
    const count = 3 + tier * 2;
    for (let i = 0; i < count; i++) {
      const start = (i / count) * TAU;
      const far = rnd(26, 38) * k;
      const bob = rnd(0, TAU);
      add({ img: i % 2 ? wisp : spriteFor('flame', theme.colors, true), dur: rnd(1300, 1600), delay: 100 + i * 60, curve: ease.linear, keys: steps(12).map((t) => {
        const ang = start + t * 1.6;
        return { t, x: body.x + Math.cos(ang) * far, y: body.y - 4 * k + Math.sin(ang) * far * 0.3 - t * 22 * k + Math.sin(t * TAU * 2 + bob) * 4 * k, s: k * 6 * (0.9 + Math.sin(t * TAU * 3 + bob) * 0.15), a: swell(t, 0.2, 0.75) * 0.9 };
      }) });
    }
  },

  treasure({ p, k, body, add, glow, usePalette }) {
    usePalette(['#fff4c2', '#e6b422', '#a8740f', ...GEMS.flat()]);
    const dur = 2000;
    glow((g, u) => {
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.7 * swell(u, 0.2, 0.7);
      g.save();
      g.translate(body.x, body.y - 30 * k);
      g.scale(0.5, 1.8);
      g.fillStyle = radial(g, 0, 0, 40 * k, [[0, alpha('#fff1a8', 0.8)], [0.5, alpha('#ffd75e', 0.3)], [1, alpha('#ffd75e', 0)]]);
      g.fillRect(-40 * k, -40 * k, 80 * k, 80 * k);
      g.restore();
    }, dur, 100);
    const coin = spriteFor('coin', ['#fff4c2', '#e6b422', '#a8740f'], true);
    for (let i = 0; i < 18; i++) {
      const phase = (i / 18) * TAU;
      const fling = phase + rnd(-0.3, 0.3);
      const out = rnd(60, 95) * k;
      add({ img: coin, dur: 1300, delay: 120 + (i % 6) * 40, curve: ease.linear, keys: steps(16).map((t) => {
        if (t < 0.7) {
          const f = t / 0.7;
          const ang = phase + f * TAU * 1.5;
          const radius = (36 - f * 14) * k;
          return { t, x: body.x + Math.cos(ang) * radius, y: p.y - f * 70 * k + Math.sin(ang) * radius * 0.3, s: k * 4.6, r: f * 12, a: Math.min(1, t / 0.08) };
        }
        const f = ease.out((t - 0.7) / 0.3);
        const from = { x: body.x + Math.cos(phase + TAU * 1.5) * 22 * k, y: p.y - 70 * k };
        return { t, x: from.x + Math.cos(fling) * out * f, y: from.y + Math.sin(fling) * out * 0.6 * f, s: k * 4.6, r: 12 + f * 6, a: 1 - f };
      }) });
    }
    const gems = GEMS.map((colors) => spriteFor('shard', colors, true));
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * TAU;
      const at = { x: body.x + Math.cos(ang) * 50 * k, y: body.y - 10 * k + Math.sin(ang) * 18 * k };
      add({ img: gems[i % 3], dur: 600, delay: 700 + i * 70, curve: ease.inOut, keys: [
        { t: 0, ...at, s: 0, r: 0, a: 0 },
        { t: 0.4, ...at, s: k * 6, r: 0.4, a: 1 },
        { t: 1, x: at.x, y: at.y - 8 * k, s: 0, r: 0.8, a: 0 },
      ] });
    }
  },

  fountain({ p, k, tier, theme, add }) {
    const coin = spriteFor('coin', theme.colors, true);
    const shine = spriteFor('star', ['#ffffff', '#ffffff', theme.colors[1]], true);
    for (let i = 0; i < 5 + tier * 3; i++) {
      const from = { x: p.x, y: p.y - 12 * k };
      const land = { x: p.x + rnd(-58, 58) * k, y: p.y + rnd(-2, 10) * k };
      const hop = { x: land.x + (land.x - p.x) * 0.25, y: land.y };
      const dur = rnd(650, 850);
      const delay = rnd(0, 380);
      const s = k * rnd(4.5, 6.5);
      const spin = rnd(5, 10);
      add({ img: coin, dur, delay, curve: ease.linear, keys: toss(from, land, rnd(45, 85) * k, s, spin, 1) });
      add({ img: coin, dur: 360, delay: delay + dur, curve: ease.linear, keys: toss(land, hop, 9 * k, s, spin * 0.3, 0.6) });
      add({ img: shine, dur: 320, delay: delay + dur + 300, curve: ease.linear, keys: [
        { t: 0, x: hop.x, y: hop.y - 3 * k, s: 0, a: 0 },
        { t: 0.4, x: hop.x, y: hop.y - 3 * k, s: k * 6, r: 0.8, a: 1 },
        { t: 1, x: hop.x, y: hop.y - 3 * k, s: 0, r: 1.6, a: 0 },
      ] });
    }
  },

  bubbles({ p, k, tier, theme, add, layer }) {
    const bubble = spriteFor('bubble', theme.accent, true);
    for (let i = 0; i < 6 + tier * 3; i++) {
      const x = p.x + rnd(-32, 32) * k;
      const y = p.y + rnd(-2, 6) * k;
      const rise = rnd(40, 78) * k;
      const phase = rnd(0, TAU);
      const s = k * rnd(3.5, 6.5);
      const dur = rnd(800, 1100);
      const delay = rnd(0, 450);
      const top = { x: x + Math.sin(TAU * 1.5 + phase) * 5 * k, y: y - rise };
      add({ img: bubble, dur, delay, curve: ease.linear, keys: steps(8).map((t) => ({
        t, x: x + Math.sin(t * TAU * 1.5 + phase) * 5 * k, y: y - rise * t, s: s * (0.4 + t * 0.6), a: t < 0.1 ? t / 0.1 : 1,
      })) });
      add({ img: spriteFor('ring', ['#ffffff', theme.colors[0], theme.colors[1]], true), dur: 220, delay: delay + dur, curve: ease.out, keys: [
        { t: 0, ...top, s, a: 1 },
        { t: 1, ...top, s: s * 2.2, a: 0 },
      ] });
    }
    for (let i = 0; i < 2 + Math.floor(tier / 2); i++) {
      layer((g, u) => {
        const w = (8 + ease.out(u) * 52) * k;
        g.globalAlpha = 1 - u;
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = theme.colors[0];
        g.lineWidth = 2 * k * (1 - u * 0.6);
        g.beginPath();
        g.ellipse(p.x, p.y, w, w * 0.3, 0, 0, TAU);
        g.stroke();
      }, 900, i * 230);
    }
  },

  toxic({ p, k, tier, theme, add, layer }) {
    layer((g, u) => {
      const w = 34 * k * (0.3 + ease.out(Math.min(1, u / 0.3)) * 0.7);
      g.globalAlpha = 0.85 * swell(u, 0.15, 0.7);
      g.globalCompositeOperation = 'lighter';
      g.save();
      g.translate(p.x, p.y + 2 * k);
      g.scale(1, 0.3);
      g.fillStyle = radial(g, 0, 0, w, [[0, theme.accent[1]], [0.55, alpha(theme.colors[1], 0.8)], [1, alpha(theme.colors[2], 0)]]);
      g.fillRect(-w, -w, w * 2, w * 2);
      g.restore();
    }, 1500);
    const bubble = spriteFor('bubble', theme.accent, true);
    for (let i = 0; i < 5 + tier * 3; i++) {
      const x = p.x + rnd(-26, 26) * k;
      const y = p.y + rnd(-2, 5) * k;
      const s = k * rnd(2.5, 5);
      const rise = rnd(10, 28) * k;
      const delay = 150 + rnd(0, 900);
      add({ img: bubble, dur: 420, delay, curve: ease.out, keys: [{ t: 0, x, y, s: s * 0.2, a: 0 }, { t: 0.8, x, y: y - rise, s, a: 1 }, { t: 1, x, y: y - rise, s: s * 1.8, a: 0 }] });
    }
    const fume = spriteFor('smoke', theme.colors, true);
    for (let i = 0; i < 2 + tier; i++) {
      const x = p.x + rnd(-20, 20) * k;
      add({ img: fume, dur: 1300, delay: 250 + i * 160, curve: ease.out, keys: [
        { t: 0, x, y: p.y, s: k * 4, a: 0 },
        { t: 0.35, x: x + rnd(-8, 8) * k, y: p.y - 25 * k, s: k * 9, a: 0.6 },
        { t: 1, x: x + rnd(-20, 20) * k, y: p.y - 70 * k, s: k * 15, a: 0 },
      ] });
    }
  },

  gust({ p, k, tier, theme, add, layer }) {
    for (let i = 0; i < 2 + tier; i++) {
      const y = p.y - rnd(8, 55) * k;
      const bend = rnd(-10, 10) * k;
      const point = (t) => ({ x: p.x + (t - 0.5) * 150 * k, y: y + Math.sin(t * Math.PI) * bend });
      layer((g, u) => {
        g.globalAlpha = 0.7 * fadeOut(u, 0.6);
        g.globalCompositeOperation = 'lighter';
        trail(g, point, ease.out(u) * 1.3, 0.35, 1.8 * k, ['#ffffff', theme.colors[0]], 10);
      }, 650, i * 110);
    }
    for (let i = 0; i < 8 + tier * 3; i++) {
      const y = p.y - rnd(0, 60) * k;
      const from = p.x - rnd(40, 75) * k;
      const wobble = rnd(4, 10) * k;
      const phase = rnd(0, TAU);
      add({ img: spriteFor(i % 2 ? theme.accentShape : theme.shape, i % 2 ? theme.accent : theme.colors, true), dur: rnd(850, 1150), delay: rnd(0, 550), curve: ease.linear, keys: steps(10).map((t) => ({
        t, x: from + t * 140 * k, y: y + Math.sin(t * TAU + phase) * wobble - t * 10 * k, s: k * 4.5, r: t * 8 + phase, a: swell(t, 0.12, 0.8),
      })) });
    }
  },


  quake({ p, k, tier, theme, add, layer }) {
    const flat = 0.34;
    const taper = (points, width) => {
      const left = [];
      const right = [];
      points.forEach((point, i) => {
        const next = points[Math.min(points.length - 1, i + 1)];
        const prev = points[Math.max(0, i - 1)];
        const ang = Math.atan2(next.y - prev.y, next.x - prev.x) + Math.PI / 2;
        const w = width * (1 - i / (points.length - 1)) ** 0.8;
        left.push({ x: point.x + Math.cos(ang) * w, y: point.y + Math.sin(ang) * w * flat * 2 });
        right.push({ x: point.x - Math.cos(ang) * w, y: point.y - Math.sin(ang) * w * flat * 2 });
      });
      return { left, right, outline: [...left, ...right.reverse()] };
    };
    const crack = (from, ang, far, width) => {
      const to = { x: from.x + Math.cos(ang) * far, y: from.y + Math.sin(ang) * far * flat };
      const points = steps(6).map((t, i) => ({
        x: from.x + (to.x - from.x) * t + (i && i < 6 ? rnd(-4, 4) * k : 0),
        y: from.y + (to.y - from.y) * t + (i && i < 6 ? rnd(-1.5, 1.5) * k : 0),
      }));
      return { points, ...taper(points, width) };
    };
    const mains = Array.from({ length: 3 + tier }, (_, i) => crack(p, (i / (3 + tier)) * TAU + rnd(-0.35, 0.35), rnd(40, 60) * k, rnd(3.2, 4.2) * k));
    const branches = mains.flatMap((main) => {
      const at = main.points[2 + Math.floor(rnd(0, 2))];
      const ang = Math.atan2((main.points[6].y - p.y) / flat, main.points[6].x - p.x) + (Math.random() < 0.5 ? -0.8 : 0.8);
      return [crack(at, ang, rnd(14, 24) * k, 1.6 * k)];
    });
    const slabs = mains.map((main) => {
      const at = main.points[3];
      return { x: at.x + rnd(-6, 6) * k, y: at.y + rnd(-3, 3) * k, w: rnd(8, 12) * k, tilt: rnd(-0.4, 0.4) };
    });
    const fill = (g, outline) => {
      g.beginPath();
      outline.forEach(({ x, y }, i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath();
    };
    layer((g, u) => {
      const grow = ease.out(Math.min(1, u / 0.18));
      g.globalAlpha = fadeOut(u, 0.65);
      g.globalCompositeOperation = 'source-over';
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, flat);
      g.fillStyle = radial(g, 0, 0, 30 * k, [[0, alpha(theme.colors[2], 0.55)], [0.6, alpha(theme.colors[1], 0.3)], [1, alpha(theme.colors[1], 0)]]);
      g.fillRect(-30 * k, -30 * k, 60 * k, 60 * k);
      g.restore();
      g.save();
      g.translate(p.x, p.y);
      g.scale(grow, grow);
      g.translate(-p.x, -p.y);
      for (const part of [...mains, ...branches]) {
        fill(g, part.outline);
        g.fillStyle = '#1e1208';
        g.fill();
        g.lineJoin = 'round';
        g.strokeStyle = alpha(theme.colors[0], 0.85);
        g.lineWidth = 1 * k;
        g.beginPath();
        part.left.forEach(({ x, y }, i) => (i ? g.lineTo(x, y - 0.6 * k) : g.moveTo(x, y - 0.6 * k)));
        g.stroke();
        g.strokeStyle = alpha(theme.colors[2], 0.9);
        g.beginPath();
        part.right.forEach(({ x, y }, i) => (i ? g.lineTo(x, y + 0.6 * k) : g.moveTo(x, y + 0.6 * k)));
        g.stroke();
      }
      g.restore();
      g.fillStyle = '#140b05';
      g.beginPath();
      g.ellipse(p.x, p.y, 9 * k * grow, 3.4 * k * grow, 0, 0, TAU);
      g.fill();
      g.strokeStyle = theme.colors[0];
      g.lineWidth = 1.2 * k;
      g.beginPath();
      g.ellipse(p.x, p.y - 0.8 * k, 10 * k * grow, 3.8 * k * grow, 0, Math.PI, TAU);
      g.stroke();
      const lift = u < 0.2 ? ease.out(u / 0.2) : u < 0.5 ? 1 : Math.max(0, 1 - (u - 0.5) / 0.25);
      for (const slab of slabs) {
        const rise = 6 * k * lift;
        g.save();
        g.translate(slab.x, slab.y - rise);
        g.rotate(slab.tilt * lift);
        g.fillStyle = theme.colors[2];
        g.fillRect(-slab.w / 2, 0, slab.w, 3.5 * k);
        g.fillStyle = theme.colors[1];
        g.beginPath();
        g.moveTo(-slab.w / 2, 0);
        g.lineTo(-slab.w * 0.3, -slab.w * flat);
        g.lineTo(slab.w * 0.5, -slab.w * flat);
        g.lineTo(slab.w / 2, 0);
        g.closePath();
        g.fill();
        g.strokeStyle = alpha(theme.colors[0], 0.8);
        g.lineWidth = 0.8 * k;
        g.stroke();
        g.restore();
      }
    }, 1500);
    for (let i = 0; i < 4 + tier * 3; i++) {
      const to = { x: p.x + rnd(-55, 55) * k, y: p.y + rnd(-2, 10) * k };
      add({ img: spriteFor('chunk', i % 2 ? theme.accent : theme.colors, false), blend: 'source-over', dur: rnd(650, 900), delay: rnd(0, 200), curve: ease.linear,
        keys: toss({ x: p.x + rnd(-10, 10) * k, y: p.y }, to, rnd(30, 60) * k, k * rnd(3, 5.5), rnd(-6, 6)) });
    }
    const dust = spriteFor('smoke', theme.colors, false);
    for (let i = 0; i < 4 + tier; i++) {
      const dir = i % 2 ? 1 : -1;
      const x = p.x + dir * rnd(10, 30) * k;
      add({ img: dust, blend: 'source-over', dur: 1100, delay: rnd(0, 250), curve: ease.out, keys: [
        { t: 0, x, y: p.y, s: k * 4, a: 0 },
        { t: 0.3, x: x + dir * 10 * k, y: p.y - 6 * k, s: k * 10, a: 0.45 },
        { t: 1, x: x + dir * 28 * k, y: p.y - 16 * k, s: k * 16, a: 0 },
      ] });
    }
  },

  psywave({ k, body, tier, theme, add, layer }) {
    for (let i = 0; i < 2 + tier; i++) {
      const color = i % 2 ? theme.colors[0] : theme.colors[1];
      layer((g, u) => {
        const r = (6 + ease.out(u) * 60) * k;
        g.globalAlpha = 1 - u;
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = color;
        g.lineWidth = 2.6 * k * (1 - u * 0.6);
        strokePath(g, steps(48).map((t) => {
          const ang = t * TAU;
          const wave = r + Math.sin(ang * 6 + u * 12) * 3 * k;
          return { x: body.x + Math.cos(ang) * wave, y: body.y + Math.sin(ang) * wave * 0.6 };
        }));
        g.stroke();
      }, 850, i * 170);
    }
    const orb = spriteFor('ring', theme.accent, true);
    for (let i = 0; i < 2 + tier; i++) {
      const phase = (i / (2 + tier)) * TAU;
      add({ img: orb, dur: 1400, delay: 150, curve: ease.linear, keys: steps(12).map((t) => {
        const ang = phase + t * TAU;
        return { t, x: body.x + Math.sin(ang) * 30 * k, y: body.y - 6 * k + Math.sin(ang * 2) * 10 * k, s: k * 4.5, a: swell(t, 0.15, 0.8) };
      }) });
    }
  },


  serpent({ p, k, body, tier, theme, add, layer }) {
    for (let i = 0; i < 1 + Math.floor(tier / 3); i++) {
      const phase = i * Math.PI;
      const point = (t) => {
        const ang = phase + t * TAU * 1.6;
        return { x: body.x + Math.cos(ang) * 28 * k * (1 - t * 0.4), y: p.y - t * 72 * k + Math.sin(ang) * 9 * k };
      };
      const glow = spriteFor('orb', theme.accent, true);
      layer((g, u) => {
        const head = ease.inOut(u) * 1.25;
        g.globalAlpha = fadeOut(u, 0.75);
        g.globalCompositeOperation = 'lighter';
        trail(g, point, head, 0.6, 9 * k, [theme.colors[1], theme.colors[2]], 24);
        trail(g, point, head, 0.55, 3 * k, [theme.colors[0], theme.colors[1]], 24);
        if (head > 1.05) return;
        const tip = point(Math.min(1, head));
        const side = 18 * k;
        g.drawImage(glow, tip.x - side / 2, tip.y - side / 2, side, side);
      }, 1400, i * 200);
    }
    const ember = spriteFor('flame', theme.accent, true);
    for (let i = 0; i < 4 + tier * 2; i++) {
      const x = body.x + rnd(-24, 24) * k;
      const y = p.y - rnd(0, 50) * k;
      add({ img: ember, dur: 600, delay: 300 + rnd(0, 700), curve: ease.out, keys: [
        { t: 0, x, y, s: 0, a: 0 },
        { t: 0.3, x, y: y - 6 * k, s: k * 4, a: 1 },
        { t: 1, x: x + rnd(-6, 6) * k, y: y - 22 * k, s: k * 1.5, a: 0 },
      ] });
    }
  },

  cosmos({ k, body, tier, theme, layer }) {
    const count = 5 + tier;
    const stars = Array.from({ length: count }, (_, i) => {
      const ang = (i / count) * TAU + rnd(-0.3, 0.3) - Math.PI / 2;
      const far = rnd(28, 46) * k;
      return { x: body.x + Math.cos(ang) * far, y: body.y - 6 * k + Math.sin(ang) * far * 0.75, twinkle: rnd(0, TAU) };
    });
    const star = spriteFor('star', ['#ffffff', theme.accent[0], theme.accent[1]], true);
    layer((g, u) => {
      const drawn = Math.min(1, u / 0.6) * count;
      g.globalAlpha = fadeOut(u, 0.75);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = alpha(theme.accent[0], 0.75);
      g.lineWidth = 1.3 * k;
      g.lineCap = 'round';
      g.beginPath();
      for (let i = 0; i < Math.floor(drawn); i++) {
        const a = stars[i];
        const b = stars[(i + 1) % count];
        const f = Math.min(1, drawn - i);
        g.moveTo(a.x, a.y);
        g.lineTo(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f);
      }
      g.stroke();
      stars.forEach((point, i) => {
        if (i > drawn) return;
        const side = k * (8 + Math.sin(u * 18 + point.twinkle) * 3);
        g.drawImage(star, point.x - side / 2, point.y - side / 2, side, side);
      });
    }, 1700, 100);
    const planet = spriteFor('orb', theme.accent, true);
    for (let i = 0; i < 1 + Math.floor(tier / 4); i++) {
      const start = i * Math.PI;
      layer((g, u) => {
        const ang = start + u * TAU * 1.2;
        const rx = 48 * k;
        const ry = 14 * k;
        g.globalAlpha = swell(u, 0.15, 0.8);
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = alpha(theme.colors[1], 0.5);
        g.lineWidth = 1 * k;
        g.beginPath();
        g.ellipse(body.x, body.y, rx, ry, -0.25, 0, TAU);
        g.stroke();
        const x = body.x + Math.cos(ang) * rx * Math.cos(-0.25) - Math.sin(ang) * ry * Math.sin(-0.25);
        const y = body.y + Math.cos(ang) * rx * Math.sin(-0.25) + Math.sin(ang) * ry * Math.cos(-0.25);
        const side = k * (Math.sin(ang) > 0 ? 13 : 9);
        g.drawImage(planet, x - side / 2, y - side / 2, side, side);
      }, 1600, 150);
    }
  },

  skydragon(fx) {
    dragonFlight(fx, DRACONIC_FLIGHT);
  },

  dragonspirit({ p, k, body, layer, usePalette }) {
    const spirit = ['#f4f2ff', '#c8c4ff', '#8a84e6'];
    usePalette(spirit);
    const turns = 1;
    const path = (t) => {
      const ang = Math.PI * 0.3 + t * TAU * turns;
      const r = 26 * (1 - t * 0.4) * k;
      return { x: body.x + Math.cos(ang) * r, y: p.y - 6 * k - t * 80 * k + Math.sin(ang) * r * 0.3 };
    };
    const SEGMENTS = 12;
    layer((g, u) => {
      const head = ease.inOut(u) * 1.15;
      const fade = swell(u, 0.15, 0.7);
      for (let i = SEGMENTS; i >= 0; i--) {
        const t = head - i * 0.035;
        if (t < 0 || t > 1) continue;
        const at = path(t);
        const size = (4.2 - i * 0.28) * k;
        g.globalAlpha = fade * (0.55 - i * 0.03);
        g.fillStyle = spirit[2];
        g.beginPath();
        g.arc(at.x, at.y, size, 0, TAU);
        g.fill();
        g.fillStyle = spirit[1];
        g.beginPath();
        g.arc(at.x - size * 0.2, at.y - size * 0.25, size * 0.6, 0, TAU);
        g.fill();
      }
      if (head > 1) return;
      const tip = path(head);
      const ahead = path(Math.min(1, head + 0.02));
      const angle = Math.atan2(ahead.y - tip.y, ahead.x - tip.x);
      g.save();
      g.translate(tip.x, tip.y);
      g.rotate(angle);
      g.globalAlpha = fade * 0.65;
      g.fillStyle = spirit[1];
      g.beginPath();
      g.ellipse(2 * k, 0, 7 * k, 4.2 * k, 0, 0, TAU);
      g.fill();
      g.strokeStyle = spirit[2];
      g.lineWidth = 1.4 * k;
      g.beginPath();
      g.moveTo(-1 * k, -3 * k);
      g.lineTo(-6 * k, -8 * k);
      g.moveTo(1 * k, -3.5 * k);
      g.lineTo(-3 * k, -9 * k);
      g.stroke();
      g.globalAlpha = fade;
      g.fillStyle = spirit[0];
      g.fillRect(4 * k, -2 * k, 2 * k, 1.5 * k);
      g.restore();
    }, 1500, 150);
  },

  stormhint({ p, k, body, layer, usePalette }) {
    const cloud = ['#ffffff', '#cfcaf0', '#6f68a6'];
    const bolt = ['#c98a1a', '#ffd35e', '#fff4c8'];
    const rain = '#8fa4d8';
    usePalette([...cloud, ...bolt, rain]);
    const center = { x: body.x + 18 * k, y: p.y - 100 * k };
    const puffs = [[-14, 2, 9], [0, -3, 12], [14, 1, 10], [-6, 6, 8], [8, 7, 8]];
    const drops = Array.from({ length: 18 }, () => ({ x: rnd(-22, 22) * k, start: rnd(0, 1), length: rnd(5, 9) * k }));
    const path = zigzag({ x: center.x + 6 * k, y: center.y + 10 * k }, { x: center.x + 24 * k, y: p.y - 30 * k }, 6, 6 * k);
    layer(pixelated((g, u) => {
      const show = swell(u, 0.2, 0.75);
      g.globalAlpha = show * 0.7;
      g.strokeStyle = rain;
      g.lineWidth = 1 * k;
      g.beginPath();
      for (const drop of drops) {
        const f = (drop.start + u * 3) % 1;
        const x = center.x + drop.x - f * 6 * k;
        const y = center.y + 8 * k + f * 50 * k;
        g.moveTo(x, y);
        g.lineTo(x - 1.5 * k, y + drop.length);
      }
      g.stroke();
      const strike = (u - 0.55) / 0.14;
      if (strike > 0 && strike < 1) {
        g.globalAlpha = 0.6 * Math.min(1, strike / 0.2) * (1 - ease.inOut(strike));
        for (const [width, color] of [[3, bolt[0]], [1.4, bolt[1]]]) {
          g.strokeStyle = color;
          g.lineWidth = width * k;
          strokePath(g, path);
          g.stroke();
        }
      }
      g.globalAlpha = show;
      for (const [dx, dy, size] of puffs) {
        for (const [shift, scale, color] of [[0.2, 1.05, cloud[2]], [0, 1, cloud[1]], [-0.3, 0.55, cloud[0]]]) {
          g.fillStyle = color;
          g.beginPath();
          g.arc(center.x + dx * k, center.y + (dy + shift * size) * k, size * scale * k, 0, TAU);
          g.fill();
        }
      }
    }, pixelSize(k), [...cloud, ...bolt, rain]), 1700, 200);
  },

  cloudhalo({ p, k, body, tier, theme, layer, usePalette }) {
    usePalette(['#ffffff', '#cfcaf0', '#6f68a6', '#05040f']);
    const center = { x: body.x, y: p.y - 112 * k };
    const count = 9;
    const puffs = Array.from({ length: count }, (_, i) => ({ start: (i / count) * TAU, size: rnd(9, 14), lag: rnd(0, 0.12) }));
    layer(pixelated((g, u) => {
      const fade = swell(u, 0.2, 0.78);
      const open = ease.out(Math.min(1, u / 0.35));
      const glow = swell(u, 0.35, 0.8);
      g.globalAlpha = glow;
      for (const [rx, ry, color] of [[32, 12, alpha(theme.accent[1], 0.55)], [24, 8.5, alpha(theme.accent[0], 0.95)], [15, 5, '#ffffff']]) {
        g.fillStyle = color;
        g.beginPath();
        g.ellipse(center.x, center.y, rx * k * (0.8 + open * 0.2), ry * k, 0, 0, TAU);
        g.fill();
      }
      const ordered = puffs.map((puff) => {
        const ang = puff.start + u * 0.9;
        return { ...puff, ang, depth: Math.sin(ang) };
      }).sort((a, b) => a.depth - b.depth);
      for (const puff of ordered) {
        const t = Math.max(0, Math.min(1, (u - puff.lag) / (1 - puff.lag)));
        const spread = 62 - 18 * ease.out(Math.min(1, t / 0.35));
        const x = center.x + Math.cos(puff.ang) * spread * k;
        const y = center.y + Math.sin(puff.ang) * (24 - 6 * open) * k;
        const r = puff.size * k * (0.6 + 0.4 * Math.min(1, t * 3)) * (1 + puff.depth * 0.12);
        g.globalAlpha = fade * (puff.depth < 0 ? 0.85 : 1);
        for (const [dx, dy, scale, color] of [[0, 0.18, 1.06, '#6f68a6'], [-0.15, -0.1, 0.9, '#cfcaf0']]) {
          g.fillStyle = color;
          g.beginPath();
          g.arc(x + dx * r, y + dy * r, r * scale, 0, TAU);
          g.arc(x + r * 0.75 + dx * r, y + r * 0.2 + dy * r, r * scale * 0.7, 0, TAU);
          g.arc(x - r * 0.75 + dx * r, y + r * 0.25 + dy * r, r * scale * 0.65, 0, TAU);
          g.fill();
        }
      }
      g.globalAlpha = glow;
      g.strokeStyle = theme.accent[0];
      g.lineWidth = 2.4 * k;
      g.beginPath();
      g.ellipse(center.x, center.y - 3 * k, (24 + glow * 6) * k, (8 + glow * 2) * k, 0, 0, TAU);
      g.stroke();
    }, pixelSize(k), ['#ffffff', '#cfcaf0', '#6f68a6', theme.accent[0], theme.accent[1]]), 1900, 750);
  },

  skybolts({ p, k, body, theme, layer, glow, usePalette }) {
    usePalette(['#d01a1a', '#ff5a4a', '#ffe0d8', '#8fa4d8', '#d8e4ff', '#04060f']);
    const sky = p.y - 150 * k;
    const BOLT_LIFE = 0.12;
    const RED_BOLT = ['#d01a1a', '#ff5a4a', '#ffb0a0'];
    const bolts = [-1, 0.8, -0.5, 0.4].map((side, i) => {
      const x = body.x + side * rnd(30, 62) * k;
      return { at: 0.1 + i * 0.2, colors: i % 2 === 1 ? RED_BOLT : [theme.accent[2], theme.accent[1], theme.accent[0]], path: zigzag({ x: x + rnd(-14, 14) * k, y: sky }, { x, y: p.y + rnd(-2, 6) * k }, 9, 9 * k) };
    });
    const drops = Array.from({ length: 70 }, () => ({ x: rnd(-150, 150) * k, start: rnd(0, 1), speed: rnd(0.9, 1.3), length: rnd(7, 13) * k }));
    glow((g, u, w, h) => {
      const storm = ease.inOut(swell(u, 0.18, 0.8));
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = storm * 0.4;
      g.fillStyle = '#04060f';
      g.fillRect(0, 0, w, h);
    }, 2500, 150);
    layer(pixelated((g, u) => {
      const storm = swell(u, 0.08, 0.85);
      g.globalAlpha = storm * 0.7;
      g.strokeStyle = '#8fa4d8';
      g.lineWidth = 1.2 * k;
      g.beginPath();
      for (const drop of drops) {
        const f = (drop.start + u * 5 * drop.speed) % 1;
        const x = body.x + drop.x - f * 18 * k;
        const y = sky + f * (p.y - sky + 30 * k);
        g.moveTo(x, y);
        g.lineTo(x - 3 * k, y + drop.length);
      }
      g.stroke();
      for (const bolt of bolts) {
        const t = (u - bolt.at) / BOLT_LIFE;
        if (t < 0 || t > 1) continue;
        g.globalAlpha = 0.85 * Math.min(1, t / 0.2) * (1 - ease.inOut(t));
        const [outer, inner, core] = bolt.colors;
        for (const [width, color] of [[7, alpha(outer, 0.5)], [4, inner], [1.6, core]]) {
          g.strokeStyle = color;
          g.lineWidth = width * k;
          strokePath(g, bolt.path);
          g.stroke();
        }
        const ground = bolt.path[bolt.path.length - 1];
        for (const [rx, ry, color] of [[22, 6, alpha(outer, 0.6)], [13, 3.5, inner], [6, 1.6, core]]) {
          g.fillStyle = color;
          g.beginPath();
          g.ellipse(ground.x, ground.y, rx * k * (0.6 + t * 0.6), ry * k * (0.6 + t * 0.6), 0, 0, TAU);
          g.fill();
        }
      }
    }, pixelSize(k)), 2500, 150);
  },

  clover({ p, k, tier, theme, add }) {
    const leaf = cloverSprite(theme.colors);
    for (let i = 0; i < 4 + tier * 3; i++) {
      const x = p.x + rnd(-55, 55) * k;
      const spin = rnd(-5, 5);
      add({ img: leaf, dur: rnd(1100, 1400), delay: rnd(0, 400), curve: ease.linear, keys: steps(8).map((t) => ({
        t, x: x + Math.sin(t * TAU + spin) * 10 * k, y: p.y - (95 - t * 100) * k, s: k * 7, r: spin * t, a: swell(t, 0.1, 0.8),
      })) });
    }
    const coin = spriteFor('coin', theme.accent, true);
    for (let i = 0; i < 2 + tier * 2; i++) {
      const x = p.x + rnd(-30, 30) * k;
      const y = p.y - rnd(10, 50) * k;
      add({ img: coin, dur: 500, delay: 200 + rnd(0, 800), curve: ease.out, keys: [{ t: 0, x, y, s: 0, a: 0 }, { t: 0.4, x, y: y - 6 * k, s: k * 4.5, r: 1, a: 1 }, { t: 1, x, y: y - 12 * k, s: k * 2, r: 2, a: 0 }] });
    }
  },

  ladybug({ k, body, tier, add }) {
    const bug = ladybugSprite();
    for (let i = 0; i < 3 + tier * 2; i++) {
      const base = rnd(0, TAU);
      const far = rnd(55, 85) * k;
      const sway = rnd(8, 14) * k * (i % 2 ? 1 : -1);
      const at = (t) => ({
        x: body.x + Math.cos(base) * far * t - Math.sin(base) * Math.sin(t * TAU) * sway,
        y: body.y + Math.sin(base) * far * t * 0.7 + Math.cos(base) * Math.sin(t * TAU) * sway * 0.7 - t * 20 * k,
      });
      add({ img: bug, blend: 'source-over', dur: rnd(1000, 1300), delay: rnd(0, 350), curve: ease.linear, keys: steps(12).map((t) => {
        const here = at(t);
        const next = at(Math.min(1, t + 0.05));
        const prev = at(Math.max(0, t - 0.05));
        return { t, ...here, s: k * 6 * (1 + (Math.round(t * 12) % 2 ? 0.08 : -0.08)), r: Math.atan2(next.y - prev.y, next.x - prev.x) + Math.PI / 2, a: swell(t, 0.1, 0.85) };
      }) });
    }
  },

  jellyfish({ p, k, tier, theme, add }) {
    const jelly = jellySprite(theme.colors);
    for (let i = 0; i < 2 + tier; i++) {
      const x = p.x + rnd(-38, 38) * k;
      const phase = rnd(0, TAU);
      const size = rnd(9, 13) * k;
      add({ img: jelly, dur: rnd(1400, 1700), delay: i * 120, curve: ease.linear, keys: steps(14).map((t) => ({
        t, x: x + Math.sin(t * TAU + phase) * 6 * k, y: p.y - t * 75 * k - Math.max(0, Math.sin(t * TAU * 3 + phase)) * 5 * k, s: size * (1 + Math.sin(t * TAU * 3 + phase) * 0.12), a: swell(t, 0.15, 0.8),
      })) });
    }
    const glow = spriteFor('dot', ['#ffffff', theme.colors[0], theme.colors[1]], true);
    for (let i = 0; i < 6 + tier * 4; i++) {
      const start = { x: p.x + rnd(-50, 50) * k, y: p.y - rnd(0, 60) * k };
      const path = wander(start, 10 * k, rnd(0, TAU));
      const blink = rnd(0, TAU);
      add({ img: glow, dur: 1500, delay: rnd(0, 300), curve: ease.linear, keys: steps(10).map((t) => ({ t, ...path(t), s: k * 2.5, a: swell(t, 0.15, 0.8) * (0.4 + 0.6 * Math.abs(Math.sin(t * 9 + blink))) })) });
    }
  },



  firefly({ p, k, tier, theme, add, layer }) {
    const light = spriteFor('orb', ['#ffffff', '#f6ffb0', '#c8e84a'], true);
    for (let i = 0; i < 6 + tier * 3; i++) {
      const path = wander({ x: p.x + rnd(-45, 45) * k, y: p.y - rnd(5, 45) * k }, rnd(10, 18) * k, rnd(0, TAU));
      const blink = rnd(0, TAU);
      add({ img: light, dur: rnd(1400, 1800), delay: rnd(0, 300), curve: ease.linear, keys: steps(16).map((t) => ({
        t, ...path(t), s: k * 6, a: swell(t, 0.1, 0.85) * Math.max(0.15, Math.sin(t * 14 + blink)),
      })) });
    }
    layer((g, u, w, h) => {
      g.globalAlpha = 0.6 * swell(u, 0.2, 0.7);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = radial(g, p.x, p.y - 20 * k, 110 * k, [[0, alpha(theme.colors[2], 0)], [0.4, alpha(theme.colors[2], 0)], [1, alpha(theme.colors[2], 0.8)]]);
      g.fillRect(0, 0, w, h);
    }, 1800);
  },


  fireworks({ p, k, tier, theme, layer }) {
    const palette = [theme.colors[0], '#ffd35e', '#ffffff', theme.colors[1]];
    for (let i = 0; i < 1 + tier; i++) {
      const top = { x: p.x + rnd(-40, 40) * k, y: p.y - rnd(70, 100) * k };
      const sparks = Array.from({ length: 18 }, (_, j) => ({ ang: (j / 18) * TAU + rnd(-0.1, 0.1), far: rnd(22, 32) * k, color: palette[(i + j) % palette.length] }));
      layer((g, u) => {
        g.globalCompositeOperation = 'lighter';
        if (u < 0.3) {
          const f = ease.out(u / 0.3);
          const x = p.x + (top.x - p.x) * f;
          const y = p.y + (top.y - p.y) * f;
          g.globalAlpha = 1;
          g.strokeStyle = alpha(theme.colors[1], 0.7);
          g.lineWidth = 1.5 * k;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - (top.x - p.x) * 0.12, y + 14 * k);
          g.stroke();
          g.fillStyle = '#ffffff';
          g.beginPath();
          g.arc(x, y, 1.8 * k, 0, TAU);
          g.fill();
          return;
        }
        const v = (u - 0.3) / 0.7;
        if (v < 0.15) {
          g.globalAlpha = 1 - v / 0.15;
          g.fillStyle = radial(g, top.x, top.y, 30 * k, [[0, '#ffffff'], [0.3, alpha(theme.colors[0], 0.6)], [1, alpha(theme.colors[1], 0)]]);
          g.fillRect(top.x - 30 * k, top.y - 30 * k, 60 * k, 60 * k);
        }
        g.globalAlpha = 1 - v;
        for (const { ang, far, color } of sparks) {
          const reach = ease.out(v) * far;
          const x = top.x + Math.cos(ang) * reach;
          const y = top.y + Math.sin(ang) * reach + v * v * 18 * k;
          g.strokeStyle = color;
          g.lineWidth = 1.6 * k;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - Math.cos(ang) * 6 * k, y - Math.sin(ang) * 6 * k - v * 3 * k);
          g.stroke();
          if (v > 0.5 && Math.sin(v * 60 + ang * 7) > 0.3) {
            g.fillStyle = '#ffffff';
            g.fillRect(x - k, y - k, 2 * k, 2 * k);
          }
        }
      }, 1300, i * 230);
    }
  },

  arcade({ k, body, tier, theme, add, layer }) {
    const kinds = [['heart', '#ff3b5c'], ['star', '#ffd21f'], ['coin', theme.accent[1]]];
    for (let i = 0; i < 3 + tier * 2; i++) {
      const [name, color] = kinds[i % kinds.length];
      const from = { x: body.x + rnd(-10, 10) * k, y: body.y };
      const to = { x: body.x + rnd(-55, 55) * k, y: body.y + rnd(-10, 25) * k };
      const path = toss(from, to, rnd(35, 60) * k, k * 7, 0, 0.7);
      add({ img: pixelSprite(name, color), blend: 'source-over', dur: 1000, delay: rnd(0, 500), curve: ease.linear, keys: path.map((key, j) => ({ ...key, r: 0, a: key.a * (j > 6 && j % 2 ? 0.2 : 1) })) });
    }
    layer((g, u) => {
      const y = body.y - 30 * k - ease.out(u) * 24 * k;
      g.globalAlpha = Math.floor(u * 10) % 2 && u > 0.6 ? 0.2 : fadeOut(u, 0.7);
      g.globalCompositeOperation = 'source-over';
      g.font = `bold ${Math.round(11 * k)}px monospace`;
      g.textAlign = 'center';
      g.fillStyle = '#1a1416';
      g.fillText('1UP', body.x + k, y + k);
      g.fillStyle = theme.accent[0];
      g.fillText('1UP', body.x, y);
    }, 1200, 250);
  },


  cards({ k, body, tier, theme, add }) {
    const card = cardSprite(theme.colors, theme.accent);
    const count = 5 + tier;
    for (let i = 0; i < count; i++) {
      const slot = (i / count) * TAU;
      add({ img: card, blend: 'source-over', dur: 1500, delay: i * 40, curve: ease.linear, keys: steps(15).map((t) => {
        const spread = ease.out(Math.min(1, t / 0.3));
        const out = Math.max(0, (t - 0.75) / 0.25);
        const ang = slot + t * 2.2;
        const far = (34 * spread + out * 50) * k;
        return { t, x: body.x + Math.cos(ang) * far, y: body.y - 6 * k + Math.sin(ang) * far * 0.45, s: k * 11 * (0.4 + spread * 0.6), r: ang + Math.PI / 2, a: 1 - out };
      }) });
    }
  },

  shuriken({ k, body, tier, theme, add, layer }) {
    const star = shurikenSprite(theme.accent[1]);
    for (let i = 0; i < 4 + tier * 2; i++) {
      const ang = (i / (4 + tier * 2)) * TAU + rnd(-0.2, 0.2);
      const far = rnd(70, 95) * k;
      add({ img: star, blend: 'source-over', dur: 650, delay: 150 + i * 45, curve: ease.out, keys: [
        { t: 0, x: body.x, y: body.y, s: k * 3, r: 0, a: 0 },
        { t: 0.1, x: body.x + Math.cos(ang) * far * 0.1, y: body.y + Math.sin(ang) * far * 0.06, s: k * 14, r: 1, a: 1 },
        { t: 1, x: body.x + Math.cos(ang) * far, y: body.y + Math.sin(ang) * far * 0.6, s: k * 12, r: 11, a: 0.3 },
      ] });
    }
    const smoke = spriteFor('smoke', ['#e8e8ee', '#9a9aa6', '#55555f'], false);
    for (let i = 0; i < 4 + tier; i++) {
      const ang = rnd(0, TAU);
      add({ img: smoke, blend: 'source-over', dur: 900, delay: rnd(0, 120), curve: ease.out, keys: [
        { t: 0, x: body.x, y: body.y, s: k * 6, a: 0.9 },
        { t: 1, x: body.x + Math.cos(ang) * 22 * k, y: body.y + Math.sin(ang) * 14 * k - 10 * k, s: k * 20, a: 0 },
      ] });
    }
    for (const dir of [1, -1]) {
      layer((g, u) => {
        const f = ease.out(Math.min(1, u / 0.4));
        g.globalAlpha = fadeOut(u, 0.4);
        g.globalCompositeOperation = 'lighter';
        g.strokeStyle = '#ffffff';
        g.lineWidth = 2.4 * k * (1 - u);
        g.beginPath();
        g.moveTo(body.x - dir * 30 * k, body.y - 30 * k);
        g.lineTo(body.x - dir * 30 * k + dir * 60 * k * f, body.y - 30 * k + 55 * k * f);
        g.stroke();
      }, 350, dir > 0 ? 450 : 560);
    }
  },

  storm({ p, k, body, tier, layer, add }) {
    const cloud = spriteFor('smoke', ['#c8ccd8', '#6a7088', '#30344a'], false);
    for (let i = 0; i < 4 + tier; i++) {
      const x = body.x + (i - (3 + tier) / 2) * 20 * k + rnd(-6, 6) * k;
      const y = p.y - rnd(110, 125) * k;
      add({ img: cloud, blend: 'source-over', dur: 1900, delay: i * 40, curve: ease.linear, keys: [
        { t: 0, x: x - 10 * k, y, s: k * 14, a: 0 },
        { t: 0.2, x, y, s: k * 26, a: 0.9 },
        { t: 0.8, x: x + 6 * k, y, s: k * 28, a: 0.85 },
        { t: 1, x: x + 10 * k, y, s: k * 30, a: 0 },
      ] });
    }
    const drops = Array.from({ length: 30 + tier * 8 }, () => ({ x: rnd(-80, 80) * k, start: rnd(0, 1), speed: rnd(0.8, 1.2) }));
    layer((g, u) => {
      g.globalAlpha = 0.55 * swell(u, 0.2, 0.8);
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#d8ecff';
      g.lineWidth = 1 * k;
      g.beginPath();
      for (const drop of drops) {
        const f = (drop.start + u * 3 * drop.speed) % 1;
        const x = body.x + drop.x - f * 10 * k;
        const y = p.y - 110 * k + f * 120 * k;
        g.moveTo(x, y);
        g.lineTo(x - 2 * k, y + 8 * k);
      }
      g.stroke();
    }, 1800, 200);
  },


  bloom({ p, k, tier, theme, add }) {
    const flower = flowerSprite(['#ffffff', theme.accent[0], theme.accent[1]], theme.colors[1]);
    const petal = spriteFor('petal', theme.accent, true);
    for (let i = 0; i < 4 + tier; i++) {
      const ang = (i / (4 + tier)) * TAU + rnd(-0.2, 0.2);
      const x = p.x + Math.cos(ang) * rnd(22, 40) * k;
      const y = p.y + Math.sin(ang) * 10 * k - 3 * k;
      const delay = i * 70;
      add({ img: flower, dur: 1100, delay, curve: ease.linear, keys: [
        { t: 0, x, y, s: 0, r: 0, a: 0 },
        { t: 0.3, x, y, s: k * 10, r: 0.6, a: 1 },
        { t: 0.75, x, y, s: k * 10, r: 0.8, a: 1 },
        { t: 1, x, y, s: k * 4, r: 1.2, a: 0 },
      ] });
      for (let j = 0; j < 2; j++) {
        add({ img: petal, dur: 900, delay: delay + 800, curve: ease.linear, keys: steps(6).map((t) => ({ t, x: x + t * rnd(-25, 25) * k, y: y - t * rnd(20, 40) * k, s: k * 4, r: t * 5, a: 1 - t })) });
      }
    }
  },

  hellfire({ p, k, body, tier, theme, add, layer }) {
    const flames = [spriteFor('flame', ['#ffe0a0', '#ff5a1f', '#8a0c14'], true), spriteFor('flame', ['#ffb0a0', '#e8121f', '#4a0610'], true), spriteFor('flame', ['#fff0c0', '#ffb43a', '#8a4a0c'], true)];
    const count = 16 + tier * 4;
    for (let i = 0; i < count; i++) {
      const ang = (i / count) * TAU + rnd(-0.1, 0.1);
      const x = p.x + Math.cos(ang) * 44 * k;
      const y = p.y + Math.sin(ang) * 15.8 * k;
      const tall = rnd(35, 65) * k;
      add({ img: flames[i % 5 === 0 ? 2 : i % 2], blend: 'lighter', dur: rnd(700, 950), delay: 350 + rnd(0, 900), curve: ease.out, keys: [
        { t: 0, x, y, s: k * 4, a: 0 },
        { t: 0.25, x: x + rnd(-3, 3) * k, y: y - tall * 0.3, s: k * rnd(14, 18), a: 1 },
        { t: 1, x: x + rnd(-6, 6) * k, y: y - tall, s: k * 5, a: 0 },
      ] });
    }
    const smoke = spriteFor('smoke', ['#5a2a30', '#2a0a10', '#0a0204'], false);
    for (let i = 0; i < 5 + tier; i++) {
      const side = i % 2 ? 1 : -1;
      const x = body.x + side * rnd(30, 55) * k;
      add({ img: smoke, blend: 'source-over', dur: 1600, delay: 300 + i * 120, curve: ease.out, keys: [
        { t: 0, x, y: p.y, s: k * 8, a: 0 },
        { t: 0.35, x: x + side * 4 * k, y: p.y - 30 * k, s: k * 18, a: 0.55 },
        { t: 1, x: x + side * 10 * k, y: p.y - 85 * k, s: k * 28, a: 0 },
      ] });
    }
    const ember = spriteFor('dot', ['#ffffff', '#ff9a5a', '#d1121f'], true);
    for (let i = 0; i < 18 + tier * 4; i++) {
      const ang = rnd(0, TAU);
      const x = p.x + Math.cos(ang) * rnd(20, 46) * k;
      const y = p.y + Math.sin(ang) * 14 * k;
      add({ img: ember, blend: 'lighter', dur: rnd(900, 1300), delay: 300 + rnd(0, 1100), curve: ease.linear, keys: [
        { t: 0, x, y, s: k * 2.5, a: 0 },
        { t: 0.2, x: x + rnd(-4, 4) * k, y: y - 14 * k, s: k * 3, a: 1 },
        { t: 1, x: x + rnd(-12, 12) * k, y: y - rnd(60, 100) * k, s: k * 1.5, a: 0 },
      ] });
    }
    layer((g, u) => {
      g.globalAlpha = swell(u, 0.2, 0.75) * (0.7 + 0.3 * Math.sin(u * 40));
      g.globalCompositeOperation = 'lighter';
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.36);
      g.fillStyle = radial(g, 0, 0, 48 * k, [[0, alpha('#ff5a1f', 0.55)], [0.7, alpha('#d1121f', 0.35)], [1, alpha('#4a0610', 0)]]);
      g.beginPath();
      g.arc(0, 0, 48 * k, 0, TAU);
      g.fill();
      g.restore();
    }, 1800, 250);
  },


  citrus({ p, k, tier, add, layer }) {
    const slice = limeSprite();
    for (let i = 0; i < 3 + tier * 2; i++) {
      const to = { x: p.x + rnd(-55, 55) * k, y: p.y + rnd(-4, 10) * k };
      add({ img: slice, blend: 'source-over', dur: rnd(850, 1050), delay: rnd(0, 200), curve: ease.linear, keys: toss({ x: p.x, y: p.y - 10 * k }, to, rnd(50, 80) * k, k * rnd(8, 10), rnd(-8, 8), 0.75) });
    }
    const drop = spriteFor('drop', ['#ffffff', '#e6ffb6', '#a6dd2f'], true);
    for (let i = 0; i < 6 + tier * 4; i++) {
      const ang = rnd(-Math.PI * 0.95, -Math.PI * 0.05);
      const far = rnd(25, 45) * k;
      const to = { x: p.x + Math.cos(ang) * far, y: p.y + rnd(0, 6) * k };
      add({ img: drop, dur: 550, delay: rnd(0, 150), curve: ease.linear, keys: toss({ x: p.x, y: p.y - 6 * k }, to, -Math.sin(ang) * far * 0.9, k * 3, 0, 0.7) });
    }
    layer((g, u) => {
      const w = (6 + ease.out(u) * 40) * k;
      g.globalAlpha = 1 - u;
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = '#e6ffb6';
      g.lineWidth = 2 * k;
      g.beginPath();
      g.ellipse(p.x, p.y, w, w * 0.3, 0, 0, TAU);
      g.stroke();
    }, 600, 60);
  },

  mint({ p, k, body, tier, theme, add, layer }) {
    const leaf = mintSprite(theme.colors);
    for (let i = 0; i < 5 + tier * 2; i++) {
      const start = (i / (5 + tier * 2)) * TAU;
      add({ img: leaf, dur: 1300, delay: i * 40, curve: ease.linear, keys: steps(12).map((t) => {
        const ang = start + t * TAU * 1.1;
        return { t, x: body.x + Math.cos(ang) * 30 * k * (1 - t * 0.25), y: p.y - t * 62 * k + Math.sin(ang) * 8 * k, s: k * 8 * (Math.sin(ang) > 0 ? 1.1 : 0.85), r: Math.cos(ang) * 0.9 + 0.3, a: swell(t, 0.12, 0.8) };
      }) });
    }
    for (let i = 0; i < 2 + tier; i++) {
      const phase = (i / (2 + tier)) * TAU;
      const point = (t) => {
        const ang = phase + t * TAU * 1.2;
        return { x: body.x + Math.cos(ang) * 34 * k * (1 - t * 0.3), y: p.y - t * 70 * k + Math.sin(ang) * 9 * k };
      };
      layer((g, u) => {
        g.globalAlpha = 0.8 * fadeOut(u, 0.6);
        g.globalCompositeOperation = 'lighter';
        trail(g, point, ease.out(u) * 1.3, 0.3, 2 * k, ['#ffffff', theme.colors[0]], 10);
      }, 1000, 100 + i * 120);
    }
  },




  glitter({ p, k, body, tier, theme, add }) {
    const colors = [['#ffffff', '#ffffff', theme.colors[0]], ['#ffffff', theme.colors[0], theme.colors[1]], ['#ffffff', theme.accent[1], theme.accent[2]]];
    for (let i = 0; i < 24 + tier * 8; i++) {
      const start = { x: body.x + rnd(-70, 70) * k, y: p.y - rnd(-5, 85) * k };
      const drift = rnd(8, 18) * k;
      const phase = rnd(0, TAU);
      const img = spriteFor(i % 4 ? 'dot' : 'star', colors[i % colors.length], true);
      add({ img, dur: rnd(1300, 1800), delay: rnd(0, 500), curve: ease.linear, keys: steps(10).map((t) => ({
        t, x: start.x + Math.sin(t * 3 + phase) * 4 * k, y: start.y - t * drift, s: k * (i % 4 ? 1.6 : 3.2), r: t * 2, a: swell(t, 0.15, 0.7) * (0.35 + 0.65 * Math.abs(Math.sin(t * 9 + phase))),
      })) });
    }
  },


  souls({ p, k, body, tier, theme, layer, add }) {
    const [light, mid] = theme.colors;
    const souls = Array.from({ length: 5 + tier * 2 }, (_, i) => ({
      x: body.x + rnd(-46, 46) * k,
      delay: rnd(0, 0.35),
      size: rnd(5, 8.5) * k,
      sway: rnd(4, 9) * k,
      phase: rnd(0, TAU),
      reach: rnd(150, 210) * k,
      lean: (i % 2 ? 1 : -1) * rnd(4, 14) * k,
    }));
    layer((g, u) => {
      g.globalCompositeOperation = 'lighter';
      for (const soul of souls) {
        const t = (u - soul.delay) / (1 - soul.delay);
        if (t <= 0 || t >= 1) continue;
        const climb = t ** 2.4;
        const speed = 2.4 * t ** 1.4;
        const x = soul.x + Math.sin(t * TAU * 1.3 + soul.phase) * soul.sway * (1 - t * 0.5) + soul.lean * climb;
        const y = p.y + 4 * k - climb * soul.reach;
        const r = soul.size * (0.55 + 0.45 * Math.min(1, t * 4)) * (1 - t * 0.35);
        const stretch = 1 + speed * 1.9;
        const fade = swell(t, 0.12, 0.62);
        const wobble = Math.sin(u * 30 + soul.phase) * 0.12;
        g.globalAlpha = 0.85 * fade;
        g.save();
        g.translate(x, y);
        g.rotate(Math.sin(t * TAU + soul.phase) * 0.12);
        const tail = r * stretch * 2.2;
        const fill = g.createLinearGradient(0, -r, 0, tail);
        fill.addColorStop(0, alpha('#ffffff', 0.95));
        fill.addColorStop(0.25, alpha(light, 0.8));
        fill.addColorStop(0.6, alpha(mid, 0.35));
        fill.addColorStop(1, alpha(mid, 0));
        g.fillStyle = fill;
        g.beginPath();
        g.moveTo(-r * (1 + wobble), 0);
        g.bezierCurveTo(-r * (1 + wobble), -r * 1.35, r * (1 - wobble), -r * 1.35, r * (1 - wobble), 0);
        g.bezierCurveTo(r * 0.9, tail * 0.35, r * 0.25 + Math.sin(u * 22 + soul.phase) * r * 0.4, tail * 0.75, 0, tail);
        g.bezierCurveTo(-r * 0.25 + Math.sin(u * 22 + soul.phase) * r * 0.4, tail * 0.75, -r * 0.9, tail * 0.35, -r * (1 + wobble), 0);
        g.fill();
        g.fillStyle = radial(g, 0, -r * 0.25, r * 0.8, [[0, alpha('#ffffff', 0.9)], [1, alpha(light, 0)]]);
        g.beginPath();
        g.arc(0, -r * 0.25, r * 0.8, 0, TAU);
        g.fill();
        g.restore();
      }
    }, 2300, 150);
    const droplet = spriteFor('dot', ['#ffffff', light, mid], true);
    for (let i = 0; i < 10 + tier * 4; i++) {
      const x = body.x + rnd(-42, 42) * k;
      const y = p.y - rnd(10, 90) * k;
      add({ img: droplet, dur: rnd(500, 800), delay: 450 + rnd(0, 1300), curve: ease.out, keys: [
        { t: 0, x, y, s: k * 2.2, a: 0.9 },
        { t: 1, x: x + rnd(-3, 3) * k, y: y + rnd(6, 14) * k, s: 0, a: 0 },
      ] });
    }
  },

  spoons({ k, body, tier, theme, add }) {
    const spoon = spoonSprite(theme.colors[1]);
    const count = 3 + tier;
    for (let i = 0; i < count; i++) {
      const slot = (i / count) * TAU;
      add({ img: spoon, dur: 1600, delay: 200 + i * 60, curve: ease.linear, keys: steps(14).map((t) => {
        const ang = slot + t * 2.4;
        const spread = ease.out(Math.min(1, t / 0.3));
        return { t, x: body.x + Math.cos(ang) * 44 * k * spread, y: body.y - 14 * k + Math.sin(ang) * 16 * k * spread + Math.sin(t * TAU * 2 + slot) * 3 * k, s: k * 16 * spread, r: Math.sin(t * TAU * 1.5 + slot) * 0.9, a: swell(t, 0.1, 0.8) };
      }) });
    }
  },

  snowfall({ p, k, body, tier, theme, add }) {
    const flake = spriteFor('flake', ['#ffffff', '#ffffff', theme.colors[1]], true);
    for (let i = 0; i < 14 + tier * 6; i++) {
      const x = body.x + rnd(-90, 70) * k;
      const drift = rnd(35, 60) * k;
      const phase = rnd(0, TAU);
      const s = k * rnd(2.5, 5);
      add({ img: flake, dur: rnd(1200, 1600), delay: rnd(0, 600), curve: ease.linear, keys: steps(8).map((t) => ({
        t, x: x + t * drift + Math.sin(t * TAU + phase) * 4 * k, y: p.y - (110 - t * 115) * k, s, r: t * 4 + phase, a: swell(t, 0.1, 0.8),
      })) });
    }
    const mist = spriteFor('smoke', ['#ffffff', theme.colors[0], theme.colors[1]], true);
    for (let i = 0; i < 3 + tier; i++) {
      const dir = i % 2 ? 1 : -1;
      const x = p.x + dir * rnd(20, 40) * k;
      add({ img: mist, dur: 1400, delay: 200 + i * 120, curve: ease.out, keys: [
        { t: 0, x, y: p.y, s: k * 6, a: 0 },
        { t: 0.35, x: x + dir * 10 * k, y: p.y - 4 * k, s: k * 16, a: 0.45 },
        { t: 1, x: x + dir * 26 * k, y: p.y - 10 * k, s: k * 24, a: 0 },
      ] });
    }
  },

  sludge({ p, k, tier, theme, add, layer }) {
    const blob = spriteFor('bubble', theme.accent, true);
    const goo = spriteFor('orb', theme.colors, true);
    const splats = [];
    for (let i = 0; i < 3 + tier * 2; i++) {
      const to = { x: p.x + rnd(-60, 60) * k, y: p.y + rnd(-4, 10) * k };
      const dur = rnd(600, 800);
      const delay = 100 + i * 90;
      splats.push({ ...to, at: delay + dur, size: rnd(10, 14) * k });
      add({ img: i % 2 ? goo : blob, dur, delay, curve: ease.linear, keys: toss({ x: p.x, y: p.y - 10 * k }, to, rnd(45, 75) * k, k * rnd(8, 11), rnd(-3, 3), 1) });
    }
    layer((g, u) => {
      const time = u * 2000;
      g.globalCompositeOperation = 'lighter';
      for (const splat of splats) {
        const life = (time - splat.at) / 900;
        if (life < 0 || life > 1) continue;
        const open = ease.out(Math.min(1, life / 0.2));
        g.globalAlpha = 0.85 * (1 - Math.max(0, life - 0.5) / 0.5);
        g.save();
        g.translate(splat.x, splat.y);
        g.scale(1, 0.32);
        g.fillStyle = radial(g, 0, 0, splat.size * open, [[0, theme.accent[1]], [0.6, alpha(theme.colors[1], 0.8)], [1, alpha(theme.colors[2], 0)]]);
        g.beginPath();
        g.arc(0, 0, splat.size * open, 0, TAU);
        g.fill();
        g.fillStyle = alpha(theme.accent[0], 0.9);
        for (let j = 0; j < 5; j++) {
          const ang = (j / 5) * TAU + splat.x;
          g.beginPath();
          g.arc(Math.cos(ang) * splat.size * 1.3 * open, Math.sin(ang) * splat.size * 1.3 * open, splat.size * 0.16, 0, TAU);
          g.fill();
        }
        g.restore();
      }
    }, 2000);
  },




  nebula({ k, body, tier, theme, add }) {
    const clouds = [['#ffffff', theme.accent[0], theme.accent[1]], ['#ffffff', theme.colors[3] ?? '#c9a8ff', '#8a5fd0'], ['#ffffff', '#d8f0ff', '#5f8fe0']];
    for (let i = 0; i < 4 + tier; i++) {
      const start = rnd(0, TAU);
      const far = rnd(20, 42) * k;
      const cloud = spriteFor('smoke', clouds[i % clouds.length], true);
      add({ img: cloud, dur: 1900, delay: i * 80, curve: ease.linear, keys: steps(10).map((t) => {
        const ang = start + t * 1.4;
        return { t, x: body.x + Math.cos(ang) * far, y: body.y - 62 * k + Math.sin(ang) * far * 0.4, s: k * rnd(20, 26), a: 0.32 * swell(t, 0.2, 0.75) };
      }) });
    }
  },

  dice({ p, k, tier, add }) {
    const faces = [1, 2, 3, 4, 5, 6].map((pips) => paintedSprite(`die|${pips}`, (g, r) => {
      g.fillStyle = '#fbf7ff';
      g.strokeStyle = '#2a2340';
      g.lineWidth = r * 0.12;
      g.beginPath();
      g.roundRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.25);
      g.fill();
      g.stroke();
      const spots = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[pips];
      g.fillStyle = pips === 1 ? '#e8293f' : '#2a2340';
      for (const [x, y] of spots) {
        g.beginPath();
        g.arc(x * r * 0.42, y * r * 0.42, r * (pips === 1 ? 0.2 : 0.14), 0, TAU);
        g.fill();
      }
    }));
    for (let i = 0; i < 1 + Math.ceil(tier / 2); i++) {
      const side = i % 2 ? 1 : -1;
      const land = { x: p.x + side * rnd(30, 55) * k, y: p.y + rnd(0, 8) * k };
      const from = { x: p.x, y: p.y - 12 * k };
      const mid = { x: from.x + (land.x - from.x) * 0.7, y: land.y };
      const delay = i * 140;
      add({ img: faces[(i * 3) % 6], blend: 'source-over', dur: 450, delay, curve: ease.linear, keys: toss(from, mid, 50 * k, k * 10, side * 7, 1) });
      add({ img: faces[(i * 3 + 2) % 6], blend: 'source-over', dur: 200, delay: delay + 450, curve: ease.linear, keys: toss(mid, land, 10 * k, k * 10, side * 1.6, 1) });
      add({ img: faces[(i * 2 + 5) % 6], blend: 'source-over', dur: 1000, delay: delay + 650, curve: ease.linear, keys: [
        { t: 0, ...land, s: k * 10, r: 0, a: 1 },
        { t: 0.75, ...land, s: k * 10, r: 0, a: 1 },
        { t: 1, ...land, s: k * 8, r: 0, a: 0 },
      ] });
    }
  },

  blocks({ p, k, tier, add }) {
    const shapes = [[[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [1, 1]], [[0, 0], [0, 1], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]]];
    const colors = ['#4fe8ff', '#ffd21f', '#b48aff', '#ff9a3c', '#7dffb0'];
    const pieces = shapes.map((cells, i) => paintedSprite(`block|${i}`, (g, r) => {
      const cell = r * 0.48;
      for (const [x, y] of cells) {
        const left = (x - 1.5) * cell;
        const top = (y - 0.5) * cell;
        g.fillStyle = colors[i];
        g.fillRect(left, top, cell, cell);
        g.fillStyle = 'rgba(255, 255, 255, 0.55)';
        g.fillRect(left, top, cell, cell * 0.22);
        g.strokeStyle = 'rgba(0, 0, 0, 0.45)';
        g.lineWidth = r * 0.05;
        g.strokeRect(left, top, cell, cell);
      }
    }));
    for (let i = 0; i < 3 + tier; i++) {
      const side = i % 2 ? 1 : -1;
      const x = p.x + side * rnd(28, 60) * k;
      const floor = p.y + rnd(-2, 6) * k;
      const delay = i * 150;
      const turns = Math.floor(rnd(0, 4));
      add({ img: pieces[i % pieces.length], blend: 'source-over', dur: 1500, delay, curve: ease.linear, keys: steps(10).map((t) => {
        const fall = Math.min(1, t / 0.5);
        const snapped = Math.floor(fall * 6) / 6;
        const flash = t > 0.7 ? (Math.floor(t * 30) % 2 ? 0.3 : 1) : 1;
        return { t, x, y: floor - (1 - snapped) * 110 * k, s: k * 14, r: (Math.PI / 2) * Math.min(turns, Math.floor(fall * 4)), a: (t > 0.92 ? 0 : 1) * flash };
      }) });
    }
  },

  meteors({ p, k, tier, theme, layer, add }) {
    for (let i = 0; i < 2 + tier; i++) {
      const land = { x: p.x + rnd(-60, 60) * k, y: p.y + rnd(-2, 10) * k };
      const from = { x: land.x - rnd(40, 60) * k, y: land.y - rnd(80, 100) * k };
      const delay = i * 170;
      const fall = 420;
      layer((g, u) => {
        const e = ease.inOut(u);
        const x = from.x + (land.x - from.x) * e;
        const y = from.y + (land.y - from.y) * e;
        const tail = { x: x - (land.x - from.x) * 0.28, y: y - (land.y - from.y) * 0.28 };
        g.globalCompositeOperation = 'lighter';
        g.globalAlpha = 1;
        const fill = g.createLinearGradient(x, y, tail.x, tail.y);
        fill.addColorStop(0, theme.accent[0]);
        fill.addColorStop(0.3, alpha(theme.accent[1], 0.8));
        fill.addColorStop(1, alpha(theme.colors[1], 0));
        g.strokeStyle = fill;
        g.lineCap = 'round';
        g.lineWidth = 6 * k;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(tail.x, tail.y);
        g.stroke();
        g.fillStyle = radial(g, x, y, 7 * k, [[0, '#ffffff'], [0.5, theme.accent[0]], [1, alpha(theme.accent[1], 0)]]);
        g.beginPath();
        g.arc(x, y, 7 * k, 0, TAU);
        g.fill();
      }, fall, delay);
      layer((g, u) => {
        const w = (4 + ease.out(u) * 26) * k;
        g.globalAlpha = 1 - u;
        g.globalCompositeOperation = 'lighter';
        g.fillStyle = radial(g, land.x, land.y, w, [[0, '#ffffff'], [0.4, alpha(theme.accent[1], 0.7)], [1, alpha(theme.colors[1], 0)]]);
        g.save();
        g.translate(land.x, land.y);
        g.scale(1, 0.4);
        g.translate(-land.x, -land.y);
        g.fillRect(land.x - w, land.y - w, w * 2, w * 2);
        g.restore();
      }, 500, delay + fall);
      for (let j = 0; j < 4; j++) {
        const to = { x: land.x + rnd(-22, 22) * k, y: land.y + rnd(-2, 6) * k };
        add({ img: spriteFor('flame', theme.accent, true), dur: 450, delay: delay + fall, curve: ease.linear, keys: toss(land, to, rnd(10, 22) * k, k * 3.5, 0, 0.5) });
      }
    }
  },




  goldrain({ p, k, body, tier, theme, add }) {
    const coin = spriteFor('coin', theme.colors, true);
    const star = spriteFor('star', ['#ffffff', theme.accent[1], theme.colors[1]], true);
    for (let i = 0; i < 14 + tier * 6; i++) {
      const x = body.x + rnd(-80, 80) * k;
      const spin = rnd(-6, 6);
      const phase = rnd(0, TAU);
      add({ img: i % 3 ? coin : star, dur: rnd(1100, 1500), delay: 150 + rnd(0, 700), curve: ease.linear, keys: steps(8).map((t) => ({
        t, x: x + Math.sin(t * TAU + phase) * 6 * k, y: p.y - (115 - t * 120) * k, s: k * (i % 3 ? rnd(4, 5.5) : 4), r: spin * t, a: swell(t, 0.1, 0.8),
      })) });
    }
    for (let i = 0; i < 6 + tier * 2; i++) {
      const at = { x: body.x + rnd(-70, 70) * k, y: body.y - rnd(-10, 70) * k };
      add({ img: star, dur: 420, delay: 300 + rnd(0, 1100), curve: ease.out, keys: [
        { t: 0, ...at, s: 0, r: 0, a: 0 },
        { t: 0.35, ...at, s: k * 8, r: 0.5, a: 1 },
        { t: 1, ...at, s: 0, r: 1, a: 0 },
      ] });
    }
  },

  atom({ k, body, tier, theme, add }) {
    const center = { x: body.x, y: body.y - 4 * k };
    const tones = [spriteFor('dot', ['#ffffff', theme.colors[0], theme.colors[1]], true), spriteFor('dot', ['#ffffff', theme.accent[0], theme.accent[1]], true)];
    const head = spriteFor('orb', theme.accent, true);
    [0, Math.PI / 3, -Math.PI / 3].forEach((tilt, o) => {
      const trail = 16 + tier * 2;
      for (let i = 0; i <= trail; i++) {
        const lag = (i / trail) * 1.6;
        const isHead = i === 0;
        add({ img: isHead ? head : tones[o % 2], dur: 1800, delay: 120, curve: ease.linear, keys: steps(16).map((t) => {
          const open = ease.out(Math.min(1, t / 0.3));
          const ang = t * TAU * 2 + (o * TAU) / 3 - lag;
          const x = Math.cos(ang) * 48 * k * open;
          const y = Math.sin(ang) * 13 * k * open;
          return { t, x: center.x + x * Math.cos(tilt) - y * Math.sin(tilt), y: center.y + x * Math.sin(tilt) + y * Math.cos(tilt), s: k * (isHead ? 9 : 3 * (1 - i / trail) + 0.8), a: swell(t, 0.1, 0.8) * (isHead ? 1 : 0.9 - (i / trail) * 0.7) };
        }) });
      }
    });
  },

  hazard({ p, k, body, layer, glow, usePalette }) {
    const track = ['#eaffb0', '#9be22c', '#3f7a10'];
    usePalette(track);
    const dur = 1900;
    glow((g, u) => {
      const pulse = swell(u, 0.15, 0.75) * (0.75 + 0.25 * Math.sin(u * TAU * 2));
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.45 * pulse;
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.35);
      g.fillStyle = radial(g, 0, 0, 70 * k, [[0, alpha('#c8ff5a', 0.6)], [0.5, alpha('#9be22c', 0.25)], [1, alpha('#9be22c', 0)]]);
      g.fillRect(-70 * k, -70 * k, 140 * k, 140 * k);
      g.restore();
    }, dur, 100);
    const tracks = Array.from({ length: 14 }, () => ({ at: rnd(0.1, 0.8), angle: rnd(0, TAU), reach: rnd(30, 70) * k, bend: rnd(-0.6, 0.6), from: rnd(4, 14) * k }));
    layer(pixelated((g, u) => {
      const show = swell(u, 0.12, 0.78);
      const turn = u * 1.6;
      const radius = 30 * k * (0.6 + 0.4 * Math.min(1, u / 0.2));
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.38);
      for (let blade = 0; blade < 3; blade++) {
        const begin = turn + (blade * TAU) / 3 - 0.52;
        for (const [inner, outer, color, strength] of [[0.3, 0.92, track[2], 0.35], [0.36, 0.86, track[1], 0.5]]) {
          g.globalAlpha = show * strength;
          g.fillStyle = color;
          g.beginPath();
          g.arc(0, 0, radius * outer, begin + 0.06, begin + 0.98);
          g.arc(0, 0, radius * inner, begin + 0.98, begin + 0.06, true);
          g.closePath();
          g.fill();
        }
      }
      g.globalAlpha = show * 0.5;
      g.fillStyle = track[1];
      g.beginPath();
      g.arc(0, 0, radius * 0.16, 0, TAU);
      g.fill();
      g.restore();
      for (const trail of tracks) {
        const t = (u - trail.at) / 0.14;
        if (t < 0 || t > 1) continue;
        const head = ease.out(Math.min(1, t * 1.4));
        const point = (f) => {
          const angle = trail.angle + trail.bend * f;
          return { x: body.x + Math.cos(angle) * (trail.from + trail.reach * f), y: body.y + Math.sin(angle) * (trail.from + trail.reach * f) * 0.8 };
        };
        g.globalAlpha = 1 - t;
        g.strokeStyle = track[1];
        g.lineWidth = 1.6 * k;
        g.beginPath();
        for (let step = 0; step <= 8; step++) {
          const at = point(head * step / 8);
          if (step) g.lineTo(at.x, at.y);
          else g.moveTo(at.x, at.y);
        }
        g.stroke();
        const tip = point(head);
        g.fillStyle = track[0];
        g.fillRect(tip.x - 1.5 * k, tip.y - 1.5 * k, 3 * k, 3 * k);
      }
    }, pixelSize(k), track), dur, 100);
  },

  radiation({ p, k, body, tier, add, layer, glow }) {
    const gas = [
      spriteFor('smoke', ['#ffffff', '#e6ff8a', '#9be22c'], true),
      spriteFor('smoke', ['#ffffff', '#c8ffb0', '#5fdc4a'], true),
    ];
    for (let i = 0; i < 9 + tier * 3; i++) {
      const x = p.x + rnd(-50, 50) * k;
      const drift = rnd(-18, 18) * k;
      const rise = rnd(30, 75) * k;
      add({ img: gas[i % 2], dur: rnd(1600, 2000), delay: rnd(0, 650), curve: ease.out, keys: [
        { t: 0, x, y: p.y + 2 * k, s: k * 6, a: 0 },
        { t: 0.3, x: x + drift * 0.4, y: p.y - rise * 0.35, s: k * 16, a: 0.38 },
        { t: 1, x: x + drift, y: p.y - rise, s: k * rnd(24, 32), a: 0 },
      ] });
    }
    const speck = spriteFor('star', ['#ffffff', '#eaffb0', '#9be22c'], true);
    for (let i = 0; i < 22 + tier * 8; i++) {
      const at = { x: p.x + rnd(-55, 55) * k, y: p.y - rnd(0, 75) * k };
      add({ img: speck, dur: rnd(120, 260), delay: rnd(100, 1700), curve: ease.linear, keys: [
        { t: 0, ...at, s: k * 4, r: 0, a: 1 },
        { t: 1, ...at, s: k * 1, r: 0.6, a: 0 },
      ] });
    }
    const mote = spriteFor('dot', ['#ffffff', '#c8ff5a', '#5f9a10'], true);
    for (let i = 0; i < 10 + tier * 5; i++) {
      const x = p.x + rnd(-45, 45) * k;
      const phase = rnd(0, TAU);
      add({ img: mote, dur: rnd(1200, 1700), delay: rnd(0, 800), curve: ease.linear, keys: steps(8).map((t) => ({
        t, x: x + Math.sin(t * TAU + phase) * 5 * k, y: p.y - t * rnd(45, 85) * k, s: k * 3, a: swell(t, 0.1, 0.7) * (Math.sin(t * 50 + phase) > -0.4 ? 1 : 0.2),
      })) });
    }
    glow((g, u, w, h) => {
      const pulse = 0.6 + 0.4 * Math.sin(u * TAU * 1.5);
      g.globalAlpha = 0.1 * pulse * swell(u, 0.1, 0.8);
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = radial(g, body.x, body.y, 140 * k, [[0, alpha('#9be22c', 0.2)], [0.5, alpha('#9be22c', 0.6)], [1, alpha('#9be22c', 0)]]);
      g.fillRect(0, 0, w, h);
    }, 1900);
  },

  autumn({ p, k, body, tier, add }) {
    const palettes = [['#ffe6a0', '#f0a21f', '#a8560c'], ['#ffd0a0', '#e8641f', '#8a2a0c'], ['#ffc8b0', '#c8321f', '#6e140c'], ['#f0e0a0', '#b8a02a', '#6a5410']];
    const leaves = palettes.map((colors) => spriteFor('leaf', colors, false));
    for (let i = 0; i < 16 + tier * 6; i++) {
      const y = body.y - rnd(-20, 80) * k;
      const from = body.x - rnd(70, 110) * k;
      const phase = rnd(0, TAU);
      const sway = rnd(6, 14) * k;
      add({ img: leaves[i % leaves.length], blend: 'source-over', dur: rnd(1200, 1700), delay: rnd(0, 700), curve: ease.linear, keys: steps(12).map((t) => ({
        t, x: from + t * rnd(170, 200) * k, y: y + Math.sin(t * TAU * 1.3 + phase) * sway + t * 30 * k, s: k * rnd(5, 7), r: t * 9 + phase, a: swell(t, 0.08, 0.85),
      })) });
    }
    for (let i = 0; i < 6 + tier * 2; i++) {
      const start = (i / (6 + tier * 2)) * TAU;
      add({ img: leaves[i % leaves.length], blend: 'source-over', dur: 1300, delay: 150 + i * 40, curve: ease.linear, keys: steps(12).map((t) => {
        const ang = start + t * TAU * 1.3;
        return { t, x: body.x + Math.cos(ang) * 38 * k, y: p.y - t * 55 * k + Math.sin(ang) * 10 * k, s: k * 6, r: ang * 2, a: swell(t, 0.12, 0.8) };
      }) });
    }
  },

  galaxy({ k, body, tier, add }) {
    const center = { x: body.x, y: body.y - 56 * k };
    const core = spriteFor('orb', ['#ffffff', '#fff3c8', '#c9b4ff'], true);
    add({ img: core, dur: 2000, delay: 100, curve: ease.linear, keys: [
      { t: 0, ...center, s: 0, a: 0 },
      { t: 0.25, ...center, s: k * 18, a: 1 },
      { t: 0.8, ...center, s: k * 20, a: 0.9 },
      { t: 1, ...center, s: k * 10, a: 0 },
    ] });
    const tones = [['#ffffff', '#fff3c8', '#ffd35e'], ['#ffffff', '#d8d0ff', '#9a8aff'], ['#ffffff', '#c8ecff', '#5fb0ff'], ['#ffffff', '#ffd0ec', '#ff7ac8']];
    const stars = tones.map((colors) => spriteFor('dot', colors, true));
    const sparkle = spriteFor('star', ['#ffffff', '#ffffff', '#c9b4ff'], true);
    const count = 90 + tier * 14;
    for (let i = 0; i < count; i++) {
      const arm = i % 2;
      const along = Math.sqrt(Math.random());
      const reach = (4 + along * 50) * k;
      const base = arm * Math.PI + along * 4.2 + rnd(-0.25, 0.25);
      const tone = along < 0.25 ? 0 : 1 + (i % 3);
      add({ img: i % 9 ? stars[tone % stars.length] : sparkle, dur: 2000, delay: 100, curve: ease.linear, keys: steps(12).map((t) => {
        const spread = ease.out(Math.min(1, t / 0.3));
        const ang = base + t * (2.6 - along * 1.4);
        const r = reach * spread;
        return { t, x: center.x + Math.cos(ang) * r, y: center.y + Math.sin(ang) * r * 0.42, s: k * (i % 9 ? 4 - along * 1.2 : 6), a: swell(t, 0.12, 0.8) * (0.6 + 0.4 * Math.sin(t * 20 + i)) };
      }) });
    }
  },

  blackhole({ k, body, tier, theme, add, layer }) {
    const hole = { x: body.x, y: body.y - 50 * k };
    layer((g, u) => {
      const open = ease.out(Math.min(1, u / 0.3)) * (u > 0.85 ? 1 - (u - 0.85) / 0.15 : 1);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = radial(g, hole.x, hole.y, 22 * k * open, [[0.4, alpha(theme.accent[0], 0.8)], [1, alpha(theme.accent[1], 0)]]);
      g.fillRect(hole.x - 22 * k, hole.y - 22 * k, 44 * k, 44 * k);
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#050508';
      g.beginPath();
      g.arc(hole.x, hole.y, 9 * k * open, 0, TAU);
      g.fill();
    }, 1800, 100);
    const hot = [['#ffffff', '#f0e0ff', '#c87aff'], ['#ffffff', theme.accent[0], theme.accent[1]], ['#ffffff', '#d8c0ff', '#6a3ad6']].map((colors) => spriteFor('dot', colors, true));
    for (let i = 0; i < 50 + tier * 8; i++) {
      const start = rnd(0, TAU);
      const ring = rnd(14, 34) * k;
      const speed = 3.2 * (20 * k / ring);
      add({ img: hot[i % hot.length], dur: 1700, delay: 150 + rnd(0, 200), curve: ease.linear, keys: steps(14).map((t) => {
        const ang = start + t * speed * TAU * 0.4;
        const pull = 1 - Math.max(0, t - 0.75) * 2.4;
        return { t, x: hole.x + Math.cos(ang) * ring * pull, y: hole.y + Math.sin(ang) * ring * 0.28 * pull, s: k * rnd(2, 3.2), a: swell(t, 0.12, 0.85) * (Math.sin(ang) < 0 && Math.abs(Math.cos(ang)) < 0.35 ? 0.15 : 1) };
      }) });
    }
  },

  shimmer({ k, body, tier, theme, add }) {
    const tones = [['#ffffff', '#ffffff', theme.colors[0]], ['#ffffff', theme.colors[0], theme.colors[1]], ['#ffffff', theme.colors[1], theme.colors[2]]].map((colors) => spriteFor('dot', colors, true));
    const bands = tier >= 4 ? [[0, 1], [-16, -1]] : [[0, 1]];
    bands.forEach(([lift, dir], b) => {
      const count = 36;
      for (let i = 0; i < count; i++) {
        const start = (i / count) * TAU;
        add({ img: tones[i % tones.length], dur: 1800, delay: 100 + b * 150, curve: ease.linear, keys: steps(12).map((t) => {
          const ang = start + dir * t * TAU * 0.9;
          const open = ease.out(Math.min(1, t / 0.3));
          const sheen = Math.max(0, Math.cos(ang - dir * t * TAU * 1.6));
          return { t, x: body.x + Math.cos(ang) * 38 * k * open, y: body.y + (4 + lift) * k - t * 8 * k + Math.sin(ang) * 10 * k * open, s: k * (2 + sheen * 2.5), a: swell(t, 0.1, 0.8) * (0.4 + sheen * 0.6) };
        }) });
      }
    });
  },

  roseswirl({ p, k, body, tier, theme, add }) {
    const petal = spriteFor('petal', theme.colors, true);
    const spark = spriteFor('star', ['#ffffff', '#ffffff', theme.colors[1]], true);
    for (let i = 0; i < 14 + tier * 4; i++) {
      const start = (i / (14 + tier * 4)) * TAU;
      const sparkly = i % 3 === 0;
      const far = rnd(34, 52) * k;
      const base = p.y + rnd(-10, 10) * k;
      add({ img: sparkly ? spark : petal, dur: rnd(1300, 1700), delay: rnd(100, 700), curve: ease.linear, keys: steps(12).map((t) => {
        const ang = start + t * TAU * 1.2;
        return { t, x: body.x + Math.cos(ang) * far * (1 - t * 0.35), y: base - t * rnd(70, 95) * k + Math.sin(ang) * 11 * k, s: k * (sparkly ? 4 : 5), r: ang * 1.5, a: swell(t, 0.12, 0.8) };
      }) });
    }
  },

  relics({ p, k, body, tier, theme, add }) {
    const stones = [spriteFor('chunk', ['#e6e0d0', '#9a917c', '#4a4434'], false), spriteFor('chunk', theme.colors, false)];
    for (let i = 0; i < 6 + tier * 2; i++) {
      const side = i % 2 ? 1 : -1;
      const x = body.x + side * rnd(26, 62) * k;
      const top = body.y - rnd(0, 36) * k;
      const phase = rnd(0, TAU);
      const s = k * rnd(5, 9);
      add({ img: stones[i % 2], blend: 'source-over', dur: 1900, delay: i * 60, curve: ease.linear, keys: steps(14).map((t) => {
        const lift = ease.out(Math.min(1, t / 0.35));
        return { t, x, y: p.y + (top - p.y) * lift + Math.sin(t * TAU * 1.5 + phase) * 3 * k, s, r: phase + t * 1.2, a: t > 0.85 ? (1 - t) / 0.15 : Math.min(1, t / 0.1) };
      }) });
    }
    const dust = [spriteFor('dot', ['#ffffff', theme.accent[0], theme.accent[1]], true), spriteFor('square', ['#ffffff', theme.colors[0], theme.colors[1]], true)];
    for (let i = 0; i < 20 + tier * 6; i++) {
      const x = body.x + rnd(-65, 65) * k;
      add({ img: dust[i % 2], dur: rnd(1100, 1600), delay: rnd(0, 800), curve: ease.linear, keys: [
        { t: 0, x, y: p.y, s: k * 2.5, r: 0, a: 0 },
        { t: 0.2, x, y: p.y - 12 * k, s: k * 3, r: 0.8, a: 1 },
        { t: 1, x: x + rnd(-8, 8) * k, y: p.y - rnd(60, 95) * k, s: k * 1.5, r: 3, a: 0 },
      ] });
    }
  },

  lightstreaks({ k, body, tier, add }) {
    const tones = [['#ffffff', '#ff7ae0', '#c21fa0'], ['#ffffff', '#7af0ff', '#1f9ac2'], ['#ffffff', '#c89aff', '#6a2fd0']].map((colors) => spriteFor('spark', colors, true));
    for (let i = 0; i < 22 + tier * 6; i++) {
      const ang = rnd(0, TAU);
      const lane = rnd(-40, 40) * k;
      const center = { x: body.x - Math.sin(ang) * lane, y: body.y - 20 * k + Math.cos(ang) * lane * 0.6 };
      const reach = 110 * k;
      const from = { x: center.x - Math.cos(ang) * reach, y: center.y - Math.sin(ang) * reach * 0.6 };
      const to = { x: center.x + Math.cos(ang) * reach, y: center.y + Math.sin(ang) * reach * 0.6 };
      const tilt = Math.atan2(to.y - from.y, to.x - from.x);
      add({ img: tones[i % tones.length], dur: rnd(550, 750), delay: rnd(0, 1100), curve: ease.inOut, keys: [
        { t: 0, ...from, s: k * 22, r: tilt, a: 0 },
        { t: 0.2, x: from.x + (to.x - from.x) * 0.2, y: from.y + (to.y - from.y) * 0.2, s: k * 30, r: tilt, a: 1 },
        { t: 1, ...to, s: k * 22, r: tilt, a: 0 },
      ] });
    }
  },

  grind({ p, k, body, tier, theme, add }) {
    const spark = spriteFor('spark', ['#ffffff', '#ffe0a0', '#ff8a1f'], true);
    for (let i = 0; i < 30 + tier * 8; i++) {
      const side = i % 2 ? 1 : -1;
      const from = { x: body.x + side * rnd(4, 16) * k, y: p.y - rnd(4, 14) * k };
      const to = { x: from.x + side * rnd(30, 70) * k, y: p.y + rnd(-2, 10) * k };
      add({ img: spark, dur: rnd(380, 560), delay: rnd(0, 900), curve: ease.linear, keys: toss(from, to, rnd(14, 34) * k, k * rnd(10, 14), side * 1.2, 0.6).map((key) => ({ ...key, r: side * (0.6 - key.t * 1.4) })) });
    }
    const shard = spriteFor('shard', theme.colors, true);
    for (let i = 0; i < 6 + tier * 2; i++) {
      const to = { x: body.x + rnd(-55, 55) * k, y: p.y + rnd(-4, 8) * k };
      add({ img: shard, dur: rnd(650, 850), delay: rnd(0, 300), curve: ease.linear, keys: toss({ x: body.x, y: body.y }, to, rnd(30, 50) * k, k * rnd(4, 6), rnd(-8, 8), 0.75) });
    }
  },

  runes({ p, k, tier, theme, layer, add }) {
    const glyphs = Array.from({ length: 8 + tier }, (_, i) => i);
    layer((g, u) => {
      g.globalAlpha = swell(u, 0.2, 0.75);
      g.globalCompositeOperation = 'lighter';
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.36);
      g.strokeStyle = theme.colors[1];
      g.lineWidth = 2.2 * k;
      g.shadowColor = theme.colors[1];
      g.shadowBlur = 6 * k;
      for (const radius of [44, 34]) {
        g.beginPath();
        g.arc(0, 0, radius * k * ease.out(Math.min(1, u / 0.25)), 0, TAU);
        g.stroke();
      }
      g.shadowBlur = 0;
      g.save();
      g.rotate(u * 1.6);
      g.strokeStyle = theme.accent[1];
      g.lineWidth = 1.4 * k;
      starPath(g, theme.starPoints ?? 6, 33 * k);
      g.restore();
      g.rotate(-u * 1.1);
      g.strokeStyle = theme.colors[0];
      g.lineWidth = 2.2 * k;
      glyphs.forEach((variant) => {
        const ang = (variant / glyphs.length) * TAU;
        if (variant / glyphs.length > u / 0.5) return;
        runeGlyph(g, Math.cos(ang) * 39 * k, Math.sin(ang) * 39 * k, 3.6 * k, variant);
      });
      g.restore();
    }, 1700);
    const spark = spriteFor('shard', theme.accent, true);
    for (let i = 0; i < 6 + tier * 2; i++) {
      const ang = rnd(0, TAU);
      const x = p.x + Math.cos(ang) * 40 * k;
      const y = p.y + Math.sin(ang) * 14 * k;
      add({ img: spark, dur: 800, delay: 400 + rnd(0, 700), curve: ease.out, keys: [{ t: 0, x, y, s: 0, a: 0 }, { t: 0.3, x, y: y - 14 * k, s: k * 4, a: 1 }, { t: 1, x, y: y - 50 * k, s: k * 2, a: 0 }] });
    }
  },

  seraph({ p, k, body, add, glow, usePalette }) {
    usePalette(['#ffffff', '#fff6d8', '#e6ecff', '#c8d0f4']);
    const dur = 2400;
    const root = { x: body.x, y: body.y - 4 * k };
    const shafts = [-0.42, -0.2, 0.05, 0.28, 0.5].map((tilt) => ({ tilt, sway: rnd(0, TAU), width: rnd(7, 12) }));
    glow((g, u, w, h) => {
      const beam = ease.inOut(swell(u, 0.2, 0.78));
      g.globalCompositeOperation = 'source-over';
      g.globalAlpha = 0.6 * beam;
      g.fillStyle = radial(g, root.x, root.y - 20 * k, Math.max(w, h) * 0.75, [[0, alpha('#0a0c1e', 0)], [0.12, alpha('#0a0c1e', 0)], [0.45, alpha('#0a0c1e', 0.75)], [1, alpha('#0a0c1e', 0.9)]]);
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'lighter';
      for (const shaft of shafts) {
        const tilt = shaft.tilt + Math.sin(u * TAU * 0.6 + shaft.sway) * 0.04;
        const top = { x: root.x + Math.tan(tilt) * root.y, y: 0 };
        const half = shaft.width * k;
        const fill = g.createLinearGradient(top.x, top.y, root.x, root.y);
        fill.addColorStop(0, alpha('#fff6d8', 0));
        fill.addColorStop(0.6, alpha('#fff6d8', 0.35));
        fill.addColorStop(1, alpha('#ffffff', 0.05));
        g.globalAlpha = beam * 0.8;
        g.fillStyle = fill;
        g.beginPath();
        g.moveTo(top.x - half * 2, top.y);
        g.lineTo(top.x + half * 2, top.y);
        g.lineTo(root.x + half * 0.3, root.y);
        g.lineTo(root.x - half * 0.3, root.y);
        g.closePath();
        g.fill();
      }
      g.globalAlpha = beam;
      g.save();
      g.translate(root.x, root.y * 0.5);
      g.scale(1, Math.max(1, root.y / (60 * k)));
      g.fillStyle = radial(g, 0, 0, 60 * k, [[0, alpha('#ffffff', 0.9)], [0.22, alpha('#fff6d8', 0.6)], [0.55, alpha('#e6ecff', 0.25)], [1, alpha('#e6ecff', 0)]]);
      g.fillRect(-60 * k, -60 * k, 120 * k, 120 * k);
      g.restore();
    }, dur, 100);
    const cross = paintedSprite('holy-cross', (g, r) => {
      g.fillStyle = '#ffffff';
      g.fillRect(-r * 0.12, -r, r * 0.24, r * 2);
      g.fillRect(-r, -r * 0.12, r * 2, r * 0.24);
      g.fillStyle = '#fff6d8';
      g.fillRect(-r * 0.3, -r * 0.3, r * 0.6, r * 0.6);
    });
    for (let i = 0; i < 12; i++) {
      const at = { x: root.x + rnd(-70, 70) * k, y: root.y - rnd(-10, 90) * k };
      add({ img: cross, dur: rnd(500, 700), delay: rnd(250, 1700), curve: ease.inOut, keys: [
        { t: 0, ...at, s: 0, a: 0 },
        { t: 0.45, ...at, s: k * 4.5, a: 1 },
        { t: 1, ...at, s: 0, a: 0 },
      ] });
    }
    const orb = spriteFor('dot', ['#ffffff', '#fff6d8', '#c8d0f4'], true);
    for (let i = 0; i < 14; i++) {
      const phase = (i / 14) * TAU;
      const delay = 200 + (i % 7) * 90;
      add({ img: orb, dur: 1500, delay, curve: ease.linear, keys: steps(14).map((t) => {
        const ang = phase + t * TAU * 1.3;
        const radius = (44 - t * 30) * k;
        return { t, x: root.x + Math.cos(ang) * radius, y: p.y - t * 120 * k + Math.sin(ang) * radius * 0.3, s: k * (3.2 - t * 1.4), a: swell(t, 0.15, 0.7) };
      }) });
    }
  },

  sanctum({ p, k, body, add, layer, glow, usePalette }) {
    const holy = ['#ffffff', '#fff6d8', '#f2d27a', '#c9a24a'];
    usePalette(holy);
    const dur = 2300;
    layer((g, u) => {
      const show = swell(u, 0.12, 0.8);
      const grow = ease.out(Math.min(1, u / 0.3));
      const radius = 54 * k * (0.5 + 0.5 * grow);
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.36);
      g.globalAlpha = show * 0.9;
      g.lineWidth = 1.6 * k;
      g.strokeStyle = holy[2];
      g.beginPath();
      g.arc(0, 0, radius, 0, TAU);
      g.stroke();
      g.strokeStyle = holy[1];
      g.beginPath();
      g.arc(0, 0, radius * 0.78, 0, TAU);
      g.stroke();
      g.save();
      g.rotate(u * 0.9);
      g.strokeStyle = holy[3];
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * TAU;
        g.beginPath();
        g.moveTo(Math.cos(angle) * radius * 0.82, Math.sin(angle) * radius * 0.82);
        g.lineTo(Math.cos(angle) * radius * 0.96, Math.sin(angle) * radius * 0.96);
        g.stroke();
      }
      g.restore();
      g.rotate(-u * 0.6);
      g.strokeStyle = holy[1];
      starPath(g, HOLY_POINTS, radius * 0.74);
      g.restore();
    }, dur, 150);
    glow((g, u) => {
      const show = swell(u, 0.15, 0.8);
      const radius = 54 * k * (0.5 + 0.5 * ease.out(Math.min(1, u / 0.3))) * 0.74;
      const sweep = u * 1.6;
      g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < HOLY_POINTS; i++) {
        const angle = -u * 0.6 - Math.PI / 2 + (i / HOLY_POINTS) * TAU;
        const foot = { x: p.x + Math.cos(angle) * radius, y: p.y + Math.sin(angle) * radius * 0.36 };
        const phase = (sweep - i / HOLY_POINTS + 1) % 1;
        const lit = Math.exp(-((phase - 0.15) ** 2) / 0.012);
        g.globalAlpha = show * (0.25 + 0.75 * lit);
        const column = g.createLinearGradient(foot.x, foot.y, foot.x, foot.y - 70 * k);
        column.addColorStop(0, alpha('#fff6d8', 0.8));
        column.addColorStop(1, alpha('#fff6d8', 0));
        g.fillStyle = column;
        g.fillRect(foot.x - 3 * k, foot.y - 70 * k, 6 * k, 70 * k);
        g.fillStyle = radial(g, foot.x, foot.y, 9 * k, [[0, alpha('#ffffff', 0.9)], [1, alpha('#fff6d8', 0)]]);
        g.fillRect(foot.x - 9 * k, foot.y - 9 * k, 18 * k, 18 * k);
      }
    }, dur, 150);
    glow((g, u) => {
      const t = (u - 0.3) / 0.7;
      if (t < 0) return;
      g.globalCompositeOperation = 'lighter';
      g.globalAlpha = 0.45 * swell(t, 0.25, 0.7);
      g.save();
      g.translate(body.x, body.y - 12 * k);
      g.rotate(u * 0.5);
      g.fillStyle = radial(g, 0, 0, 90 * k, [[0, alpha('#fff6d8', 0.7)], [0.4, alpha('#fff6d8', 0.25)], [1, alpha('#fff6d8', 0)]]);
      for (let i = 0; i < 16; i++) {
        g.rotate(TAU / 16);
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(90 * k, -5 * k);
        g.lineTo(90 * k, 5 * k);
        g.closePath();
        g.fill();
      }
      g.restore();
    }, dur, 150);
    const spark = spriteFor('dot', ['#ffffff', '#fff6d8', '#f2d27a'], true);
    for (let ring = 0; ring < 3; ring++) {
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * TAU;
        add({ img: spark, dur: 1100, delay: 350 + ring * 330, curve: ease.out, keys: steps(8).map((t) => {
          const spread = (14 + t * 26) * k;
          return { t, x: body.x + Math.cos(angle + t * 0.6) * spread, y: body.y - 10 * k - t * 110 * k + Math.sin(angle + t * 0.6) * spread * 0.3, s: k * 2.6, a: swell(t, 0.1, 0.65) };
        }) });
      }
    }
    const dust = spriteFor('dot', ['#fff6d8', '#f2d27a', '#c9a24a'], true);
    for (let i = 0; i < 26; i++) {
      const x = body.x + rnd(-26, 26) * k;
      add({ img: dust, dur: rnd(1100, 1500), delay: rnd(200, 1100), curve: ease.linear, keys: [
        { t: 0, x, y: p.y - rnd(140, 180) * k, s: k * 1.8, a: 0 },
        { t: 0.2, x: x + rnd(-3, 3) * k, y: p.y - rnd(110, 140) * k, s: k * 1.8, a: 1 },
        { t: 1, x: x + rnd(-6, 6) * k, y: p.y - rnd(10, 30) * k, s: k * 1.2, a: 0 },
      ] });
    }
  },

  feathers({ p, k, body, tier, theme, add }) {
    const feather = paintedSprite(`feather|${theme.colors[1]}`, (g, r) => {
      g.fillStyle = radial(g, 0, -r * 0.2, r * 1.1, [[0, '#ffffff'], [0.6, theme.colors[0]], [1, theme.colors[1]]]);
      g.beginPath();
      g.moveTo(0, -r);
      g.bezierCurveTo(r * 0.42, -r * 0.5, r * 0.32, r * 0.45, 0, r * 0.8);
      g.bezierCurveTo(-r * 0.32, r * 0.45, -r * 0.42, -r * 0.5, 0, -r);
      g.fill();
      g.strokeStyle = alpha(theme.colors[2], 0.6);
      g.lineWidth = r * 0.05;
      g.beginPath();
      g.moveTo(0, -r * 0.85);
      g.lineTo(0, r);
      g.stroke();
    });
    for (let i = 0; i < 8 + tier * 2; i++) {
      const x = body.x + rnd(-75, 75) * k;
      const sway = rnd(8, 16) * k;
      const phase = rnd(0, TAU);
      add({ img: feather, dur: rnd(1700, 2200), delay: rnd(0, 700), curve: ease.linear, keys: steps(12).map((t) => ({
        t, x: x + Math.sin(t * TAU + phase) * sway, y: p.y - (115 - t * 120) * k, s: k * rnd(7, 9), r: Math.sin(t * TAU + phase) * 0.7 + 0.3, a: swell(t, 0.1, 0.8),
      })) });
    }
  },

  halo({ k, body, tier, add }) {
    const center = { x: body.x, y: body.y - 46 * k };
    const glow = [spriteFor('dot', ['#ffffff', '#fff6d0', '#ffd98a'], true), spriteFor('dot', ['#ffffff', '#e8f0ff', '#a8c0ff'], true)];
    const count = 16 + tier * 2;
    for (let i = 0; i < count; i++) {
      const start = (i / count) * TAU;
      add({ img: glow[i % 2], dur: 2000, delay: 200, curve: ease.linear, keys: steps(12).map((t) => {
        const open = ease.out(Math.min(1, t / 0.3));
        const ang = start + t * TAU * 0.5;
        return { t, x: center.x + Math.cos(ang) * 26 * k * open, y: center.y + Math.sin(ang) * 6 * k * open, s: k * (2.6 + Math.max(0, Math.sin(ang)) * 1.6), a: swell(t, 0.12, 0.8) };
      }) });
    }
  },

  blessing({ p, k, body, tier, add }) {
    const mote = [spriteFor('dot', ['#ffffff', '#fff6d0', '#ffd98a'], true), spriteFor('star', ['#ffffff', '#ffffff', '#c8d8ff'], true)];
    for (let i = 0; i < 10 + tier * 2; i++) {
      const side = i % 2 ? 1 : -1;
      const x = body.x + side * rnd(16, 70) * k;
      add({ img: mote[i % 4 === 0 ? 1 : 0], dur: rnd(1200, 1700), delay: rnd(0, 1000), curve: ease.out, keys: [
        { t: 0, x, y: p.y + 2 * k, s: k * 2, r: 0, a: 0 },
        { t: 0.25, x, y: p.y - 20 * k, s: k * 3.5, r: 0.5, a: 1 },
        { t: 1, x: x + rnd(-6, 6) * k, y: p.y - rnd(90, 125) * k, s: k * 1.5, r: 1.5, a: 0 },
      ] });
    }
  },

  ashfall({ p, k, body, tier, add }) {
    const ash = [spriteFor('chunk', ['#9a9096', '#4a4248', '#1a1418'], false), spriteFor('dot', ['#ffffff', '#ff9a5a', '#c8101e'], true)];
    for (let i = 0; i < 20 + tier * 5; i++) {
      const x = body.x + rnd(-85, 85) * k;
      const phase = rnd(0, TAU);
      const ember = i % 4 === 0;
      add({ img: ash[ember ? 1 : 0], blend: ember ? 'lighter' : 'source-over', dur: rnd(1600, 2100), delay: 500 + rnd(0, 900), curve: ease.linear, keys: steps(10).map((t) => ({
        t, x: x + Math.sin(t * TAU + phase) * 8 * k, y: p.y - (120 - t * 125) * k, s: k * (ember ? 2.5 : rnd(2, 3.2)), r: t * 6 + phase, a: swell(t, 0.1, 0.8) * (ember ? 1 : 0.8),
      })) });
    }
  },
};

export const SIGNATURE_KINDS = Object.keys(SIGNATURES);

function planBurst(p, k, theme) {
  const tier = theme.tier;
  const ms = [0, 700, 900, 1150, 1400, 1800][tier];
  const glow = !theme.shadow;
  const items = [];
  const body = { x: p.x, y: p.y - 18 * k };
  const add = (item) => items.push({ delay: 0, curve: ease.out, ...item });
  const look = (accent, shape) => spriteFor(shape ?? (accent ? theme.accentShape : theme.shape), accent ? theme.accent : theme.colors, glow);

  const ring = ({ count, dist, size, dur, delay = 0, accent = false, squash = 1, at = p }) => {
    const turn = rnd(0, Math.PI * 2);
    for (let i = 0; i < count; i++) {
      const ang = turn + (Math.PI * 2 * i) / count;
      const far = k * dist * rnd(0.8, 1.2);
      const spin = ang + rnd(-0.5, 0.5);
      const s = k * size * rnd(0.75, 1.25);
      const pt = (f) => ({ x: at.x + Math.cos(ang) * far * f, y: at.y + Math.sin(ang) * far * f * squash });
      add({ img: look(accent), dur, delay, curve: ease.out, keys: [
        { t: 0, ...pt(0), s: s * 0.2, r: spin, a: 1 },
        { t: 0.35, ...pt(0.6), s: s * 1.25, r: spin + 1.6, a: 1 },
        { t: 0.75, ...pt(1), s: s * 0.9, r: spin + 3.5, a: 0.9 },
        { t: 1, ...pt(1), s: s * 0.3, r: spin + 4.5, a: 0 },
      ] });
    }
  };

  const motes = ({ count, dur, spread, motion = theme.motion, size = [3.5, 6], at = p }) => {
    for (let i = 0; i < count; i++) {
      const s = k * rnd(size[0], size[1]);
      const dx = rnd(-spread, spread) * k;
      const delay = rnd(0, dur * 0.45);
      const img = look(i % 3 === 2);
      let keys;
      if (motion === 'rise') {
        const x = at.x + dx;
        keys = [{ t: 0, x, y: at.y + 8 * k, s: s * 0.5, a: 0 }, { t: 0.3, x: x + rnd(-8, 8) * k, y: at.y - 16 * k, s: s * 1.2, a: 1 }, { t: 1, x: x + rnd(-14, 14) * k, y: at.y - rnd(50, 80) * k, s: s * 0.4, a: 0 }];
      } else if (motion === 'fall') {
        const x = at.x + dx;
        keys = [{ t: 0, x, y: at.y - rnd(60, 90) * k, s, r: 0, a: 0 }, { t: 0.25, x: x + rnd(-10, 10) * k, y: at.y - 40 * k, s, r: 2.8, a: 1 }, { t: 0.7, x: x + rnd(-14, 14) * k, y: at.y - 10 * k, s, r: 4.9, a: 1 }, { t: 1, x: x + rnd(-18, 18) * k, y: at.y + rnd(8, 18) * k, s, r: 6.6, a: 0 }];
      } else if (motion === 'drift') {
        const ang = rnd(0, Math.PI * 2);
        const far = rnd(24, 46) * k;
        keys = [{ t: 0, x: at.x, y: at.y, s: s * 0.6, a: 0 }, { t: 0.4, x: at.x + Math.cos(ang) * far * 0.5, y: at.y + Math.sin(ang) * far * 0.4, s: s * 2, a: 0.95 }, { t: 1, x: at.x + Math.cos(ang) * far, y: at.y + Math.sin(ang) * far * 0.6 - 12 * k, s: s * 3.2, a: 0 }];
      } else if (motion === 'swirl') {
        const start = rnd(0, 360);
        const dir = i % 2 ? 1 : -1;
        keys = [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => {
          const ang = ((start + dir * t * 420) * Math.PI) / 180;
          const r = (4 + t * spread) * k;
          return { t, x: at.x + Math.cos(ang) * r, y: at.y + Math.sin(ang) * r * 0.6 - t * 14 * k, s: s * (1.2 - t * 0.7), a: t === 0 || t === 1 ? 0 : 1 };
        });
      } else {
        const x = at.x + dx;
        const y = at.y + rnd(-spread * 1.2, spread * 0.5) * k;
        keys = [{ t: 0, x, y, s: 0, r: 0, a: 0 }, { t: 0.35, x, y, s: s * 1.6, r: 1.6, a: 1 }, { t: 0.6, x, y, s: s * 0.8, r: 2.8, a: 1 }, { t: 1, x, y, s: 0, r: 3.8, a: 0 }];
      }
      add({ img, dur, delay, curve: ease.inOut, keys });
    }
  };

  const sparkles = ({ count, dur, spread, rise = 0, at = p }) => {
    const img = spriteFor('star', ['#ffffff', theme.accent[0], theme.colors[1]], true);
    for (let i = 0; i < count; i++) {
      const x = at.x + rnd(-spread, spread) * k;
      const y = at.y + rnd(-spread * 1.3 - rise, spread * 0.4) * k;
      const s = k * rnd(2.5, 5);
      add({ img, dur: rnd(dur * 0.4, dur * 0.7), delay: rnd(0, dur * 0.6), curve: ease.linear, keys: [{ t: 0, x, y, s: 0, a: 0 }, { t: 0.3, x, y, s: s * 1.5, a: 1 }, { t: 1, x, y, s: 0, a: 0 }] });
    }
  };

  const crown = (dur) => {
    for (let i = 0; i < 8; i++) {
      const img = look(i % 2 === 1);
      const keys = [0, 0.25, 0.5, 0.75, 1].map((t) => {
        const ang = ((i / 8) * 360 + t * 540) * (Math.PI / 180);
        return { t, x: body.x + Math.cos(ang) * 26 * k, y: body.y - 22 * k + Math.sin(ang) * 9 * k, s: k * 4.5 * (1 + Math.sin(t * Math.PI) * 0.4), a: t === 0 || t === 1 ? 0 : 1 };
      });
      add({ img, dur, delay: 200, curve: ease.linear, keys });
    }
  };

  const layer = (draw, dur, delay = 0, above = false) => add({ draw, dur, delay, curve: ease.linear, ...(above ? { above } : {}) });
  const lighting = (draw, dur, delay = 0) => add({ draw, dur, delay, curve: ease.linear, light: true });
  const [light, mid, dark] = theme.colors;
  const blend = theme.shadow ? 'source-over' : 'lighter';

  lighting((g, u) => {
    const r = (30 + tier * 10) * k * 0.5 * (u < 0.3 ? u / 0.3 : 1 + (u - 0.3) * 0.5);
    g.globalAlpha = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
    g.globalCompositeOperation = blend;
    g.fillStyle = radial(g, p.x, p.y, r, [[0, '#ffffff'], [0.1, '#ffffff'], [0.22, light], [0.46, mid], [0.7, alpha(mid, 0)]]);
    g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }, 380 + tier * 60);
  const ornate = !theme.bare;
  if (ornate) {
    ring({ count: 12 + tier * 4, dist: 26 + tier * 4, size: 5 + tier * 0.6, dur: 520 + tier * 60 });
    motes({ count: 6 + tier * 6, dur: ms, spread: 14 + tier * 6 });
    sparkles({ count: 4 + tier * 4, dur: ms, spread: 18 + tier * 5, rise: 10 });
  }

  if (tier >= 2 && ornate) {
    ring({ count: 10 + tier * 2, dist: 16 + tier * 3, size: 4, dur: 600, delay: 90, accent: true });
    lighting((g, u) => {
      const w = 35 * k * (0.3 + Math.min(1, u / 0.3) * 0.7 + Math.max(0, u - 0.3) * 0.4);
      g.globalAlpha = u < 0.3 ? (u / 0.3) * 0.9 : u < 0.7 ? 0.9 - ((u - 0.3) / 0.4) * 0.3 : 0.6 * (1 - (u - 0.7) / 0.3);
      g.globalCompositeOperation = theme.shadow ? 'multiply' : 'lighter';
      g.save();
      g.translate(p.x, p.y);
      g.scale(1, 0.3);
      g.fillStyle = radial(g, 0, 0, w, [[0, light], [0.4, mid], [0.72, alpha(mid, 0)]]);
      g.fillRect(-w, -w, w * 2, w * 2);
      g.restore();
    }, ms);
  }

  const shockwave = (dur, delay, size) => layer((g, u) => {
    const e = ease.out(u);
    const w = (size / 2) * k * (0.05 + e * 0.95);
    g.globalAlpha = 1 - u;
    g.globalCompositeOperation = blend;
    g.strokeStyle = alpha(mid, 0.45);
    g.lineWidth = Math.max(5, 6 * k);
    g.beginPath();
    g.ellipse(p.x, p.y, w, w * 0.5, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = light;
    g.lineWidth = Math.max(2, 2.4 * k);
    g.stroke();
  }, dur, delay);

  const calm = theme.soft ?? 1;
  const rays = (dur, reverse) => lighting((g, u) => {
    const turn = (reverse ? -1 : 1) * (u < 0.3 ? (u / 0.3) * 0.87 : 0.87 + ((u - 0.3) / 0.7) * 1.75);
    const reach = 65 * k * (u < 0.3 ? 0.2 + (u / 0.3) * 0.8 : 1 + (u - 0.3) * 0.36);
    g.globalAlpha = (u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7) * calm;
    g.globalCompositeOperation = 'lighter';
    g.save();
    g.translate(p.x, p.y);
    g.rotate(turn + (reverse ? 0.26 : 0));
    g.fillStyle = radial(g, 0, 0, reach, [[0, light], [0.25, alpha(light, 0.9)], [0.6, alpha(mid, 0.4)], [1, alpha(mid, 0)]]);
    for (let i = 0; i < 12; i++) {
      g.rotate(Math.PI / 6);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(reach, -reach * 0.045);
      g.lineTo(reach, reach * 0.045);
      g.closePath();
      g.fill();
    }
    g.restore();
  }, dur);

  if (tier >= 3) {
    shockwave(650, 0, 80);
    if (ornate) {
      ring({ count: 16 + tier * 2, dist: 50 + tier * 4, size: 4.5, dur: 800, delay: 180, squash: 0.55 });
      motes({ count: 10 + tier * 3, dur: ms + 300, spread: 26, motion: 'swirl', size: [3, 5] });
      motes({ count: 8 + tier * 2, dur: ms + 500, spread: 18, motion: theme.motion === 'fall' ? 'fall' : 'rise', size: [2.5, 4], at: body });
    }
    if (theme.shadow) {
      lighting((g, u, w, h) => {
        g.globalAlpha = u < 0.2 ? (u / 0.2) * 0.9 : u < 0.65 ? 0.9 - ((u - 0.2) / 0.45) * 0.15 : 0.75 * (1 - (u - 0.65) / 0.35);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = radial(g, p.x, p.y, 80 * k, [[0, alpha(dark, 0)], [12 / 80, alpha(dark, 0)], [1, alpha(dark, 0.93)]]);
        g.fillRect(0, 0, w, h);
      }, ms + 400);
    }
  }

  if (tier >= 4 && ornate) {
    rays(ms, false);
    shockwave(800, 220, 120);
    lighting((g, u) => {
      const sx = u < 0.3 ? 0.1 + (u / 0.3) * 0.9 : 1 - ((u - 0.3) / 0.7) * 0.6;
      const sy = u < 0.3 ? 0.2 + (u / 0.3) * 0.8 : 1 + ((u - 0.3) / 0.7) * 0.1;
      const w = 17 * k * sx;
      const hgt = 150 * k * sy;
      g.globalAlpha = (u < 0.3 ? (u / 0.3) * 0.95 : 0.95 * (1 - (u - 0.3) / 0.7)) * calm;
      g.globalCompositeOperation = 'lighter';
      const fill = g.createLinearGradient(0, p.y, 0, p.y - hgt);
      fill.addColorStop(0, light);
      fill.addColorStop(0.4, alpha(mid, 0.66));
      fill.addColorStop(1, alpha(mid, 0));
      g.fillStyle = fill;
      g.fillRect(p.x - w, p.y - hgt, w * 2, hgt);
    }, ms);
    const tint = (dur, strength) => lighting((g, u, w, h) => {
      g.globalAlpha = u < 0.12 ? (u / 0.12) * strength : strength * (1 - (u - 0.12) / 0.88);
      g.globalCompositeOperation = theme.shadow ? 'multiply' : 'lighter';
      g.fillStyle = mid;
      g.fillRect(0, 0, w, h);
    }, dur);
    if (!theme.soft) tint(700, theme.shadow ? 0.35 : 0.28);
    sparkles({ count: 18, dur: ms + 400, spread: 30, rise: 20, at: body });
    if (tier >= 5) {
      rays(ms + 300, true);
      shockwave(1000, 420, 170);
      ring({ count: 30, dist: 80, size: 5, dur: 1000, delay: 260, squash: 0.6 });
      motes({ count: 46, dur: ms + 500, spread: 90, motion: 'fall', size: [3, 6] });
      crown(1600);
      if (!theme.soft) tint(900, 0.45);
    }
  }
  const sprite = (shape, accent = false) => spriteFor(shape, accent ? theme.accent : theme.colors, glow);
  const palette = new Set([...theme.colors, ...theme.accent, '#ffffff', shade(theme.colors[2], 0.45), shade(theme.colors[2], 0.2), '#05040f']);
  const usePalette = (colors) => colors.forEach((color) => palette.add(color));
  const fx = { p, k, body, tier, theme, add, layer, glow: lighting, sprite, ring, usePalette };
  for (const name of theme.signature ?? []) SIGNATURES[name](fx);
  return { items, blend, palette: [...palette], focus: { x: p.x, y: p.y - 22 * k, rx: 26 * k, ry: 32 * k } };
}

function spritesOf(theme) {
  const glow = !theme.shadow;
  return [
    spriteFor(theme.shape, theme.colors, glow),
    spriteFor(theme.accentShape, theme.accent, glow),
    spriteFor('star', ['#ffffff', theme.accent[0], theme.colors[1]], true),
  ];
}

export function createBallBursts(host) {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', pointerEvents: 'none' });
  host.append(canvas);
  const g = canvas.getContext('2d');
  const live = [];
  let size = { width: 0, height: 0, dpr: 1 };
  let running = false;

  const fit = () => {
    const width = host.clientWidth;
    const height = host.clientHeight;
    const dpr = Math.min(DPR_CAP, window.devicePixelRatio || 1);
    if (width !== size.width || height !== size.height || dpr !== size.dpr) {
      size = { width, height, dpr };
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
    }
  };

  const clearFocus = (ctx, { focus: { x, y, rx, ry } }, time) => {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = Math.min(1, time / FOCUS_IN_MS);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.fillStyle = radial(ctx, 0, 0, rx, [[0, 'rgba(0, 0, 0, 0.75)'], [0.55, 'rgba(0, 0, 0, 0.55)'], [1, 'rgba(0, 0, 0, 0)']]);
    ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
    ctx.restore();
  };

  const clear = () => {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, canvas.width, canvas.height);
  };

  const drawItem = (ctx, burst, item, time, width, height) => {
    const u = (time - item.delay) / item.dur;
    if (u < 0 || u > 1) return;
    if (item.draw) {
      ctx.save();
      item.draw(ctx, u, width, height);
      ctx.restore();
      return;
    }
    const f = frameAt(item.keys, item.curve(u));
    if (f.a <= 0 || f.s <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = item.blend ?? burst.blend;
    ctx.globalAlpha = Math.min(1, f.a);
    ctx.translate(f.x, f.y);
    ctx.rotate(f.r);
    const side = f.s / 0.6;
    ctx.drawImage(item.img, -side / 2, -side / 2, side, side);
    ctx.restore();
  };

  const paintLights = (burst, time, width, height) => {
    const lights = burst.items.filter((item) => item.light);
    if (!lights.length) return;
    const pw = Math.max(1, Math.round(width * LIGHT_SCALE));
    const ph = Math.max(1, Math.round(height * LIGHT_SCALE));
    if (burst.light.width !== pw || burst.light.height !== ph) {
      burst.light.width = pw;
      burst.light.height = ph;
    }
    const lc = burst.light.getContext('2d');
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.globalAlpha = 1;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, pw, ph);
    lc.setTransform(LIGHT_SCALE, 0, 0, LIGHT_SCALE, 0, 0);
    for (const item of lights) drawItem(lc, burst, item, time, width, height);
    clearFocus(lc, burst, time);
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = LIGHT_STRENGTH;
    g.imageSmoothingEnabled = true;
    g.drawImage(burst.light, 0, 0, width, height);
    g.globalAlpha = 1;
  };

  const paintBurst = (burst, time, width, height) => {
    const cw = Math.ceil(width / burst.pixel);
    const ch = Math.ceil(height / burst.pixel);
    if (burst.lo.width !== cw || burst.lo.height !== ch) {
      burst.lo.width = cw;
      burst.lo.height = ch;
    }
    const lo = burst.lo.getContext('2d');
    lo.setTransform(1, 0, 0, 1, 0, 0);
    lo.globalAlpha = 1;
    lo.globalCompositeOperation = 'source-over';
    lo.clearRect(0, 0, cw, ch);
    lo.imageSmoothingEnabled = false;
    lo.setTransform(1 / burst.pixel, 0, 0, 1 / burst.pixel, 0, 0);
    for (const item of burst.items) if (!item.above && !item.light) drawItem(lo, burst, item, time, width, height);
    clearFocus(lo, burst, time);
    lo.globalCompositeOperation = 'source-over';
    lo.globalAlpha = 1;
    for (const item of burst.items) if (item.above) drawItem(lo, burst, item, time, width, height);
    snapToPalette(lo, cw, ch, burst.palette, true);
    paintLights(burst, time, width, height);
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.imageSmoothingEnabled = false;
    g.drawImage(burst.lo, 0, 0, cw * burst.pixel, ch * burst.pixel);
  };

  const tick = (now) => {
    const { width, height } = size;
    clear();
    for (let b = live.length - 1; b >= 0; b--) {
      const burst = live[b];
      const time = now - burst.start;
      if (time > burst.end) {
        live.splice(b, 1);
        continue;
      }
      paintBurst(burst, time, width, height);
    }
    if (live.length && canvas.isConnected) requestAnimationFrame(tick);
    else {
      clear();
      running = false;
    }
  };

  return {
    play(p, k, theme) {
      fit();
      const { items, blend, focus, palette } = planBurst(p, k, theme);
      live.push({ items, blend, focus, palette, pixel: pixelSize(k), lo: document.createElement('canvas'), light: document.createElement('canvas'), start: performance.now(), end: Math.max(...items.map((item) => item.delay + item.dur)) });
      if (!running) {
        running = true;
        requestAnimationFrame(tick);
      }
      return new Promise((resolve) => setTimeout(resolve, OPEN_MS));
    },
    warm(themes) {
      const run = () => {
        if (!canvas.isConnected) return;
        fit();
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.globalAlpha = 0.01;
        for (const op of ['lighter', 'source-over', 'multiply']) {
          g.globalCompositeOperation = op;
          for (const theme of themes) for (const img of spritesOf(theme)) g.drawImage(img, 0, 0, 8, 8);
          g.fillStyle = radial(g, 4, 4, 4, [[0, '#ffffff'], [1, 'rgba(255,255,255,0)']]);
          g.fillRect(0, 0, 8, 8);
        }
        if (!running) clear();
      };
      if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 600 });
      else setTimeout(run, 50);
    },
  };
}

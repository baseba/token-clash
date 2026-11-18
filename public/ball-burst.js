const SPRITE = 64;
const DPR_CAP = 1.5;
const OPEN_MS = 520;
const rnd = (lo, hi) => lo + Math.random() * (hi - lo);
const ease = {
  out: (u) => 1 - (1 - u) ** 3,
  inOut: (u) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2),
  linear: (u) => u,
};

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

  const layer = (draw, dur, delay = 0) => add({ draw, dur, delay, curve: ease.linear });
  const [light, mid, dark] = theme.colors;
  const blend = theme.shadow ? 'source-over' : 'lighter';

  layer((g, u) => {
    const r = (30 + tier * 10) * k * 0.5 * (u < 0.3 ? u / 0.3 : 1 + (u - 0.3) * 0.5);
    g.globalAlpha = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
    g.globalCompositeOperation = blend;
    g.fillStyle = radial(g, p.x, p.y, r, [[0, '#ffffff'], [0.1, '#ffffff'], [0.22, light], [0.46, mid], [0.7, alpha(mid, 0)]]);
    g.fillRect(p.x - r, p.y - r, r * 2, r * 2);
  }, 380 + tier * 60);
  ring({ count: 12 + tier * 4, dist: 26 + tier * 4, size: 5 + tier * 0.6, dur: 520 + tier * 60 });
  motes({ count: 6 + tier * 6, dur: ms, spread: 14 + tier * 6 });
  sparkles({ count: 4 + tier * 4, dur: ms, spread: 18 + tier * 5, rise: 10 });

  if (tier >= 2) {
    ring({ count: 10 + tier * 2, dist: 16 + tier * 3, size: 4, dur: 600, delay: 90, accent: true });
    layer((g, u) => {
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

  const rays = (dur, reverse) => layer((g, u) => {
    const turn = (reverse ? -1 : 1) * (u < 0.3 ? (u / 0.3) * 0.87 : 0.87 + ((u - 0.3) / 0.7) * 1.75);
    const reach = 65 * k * (u < 0.3 ? 0.2 + (u / 0.3) * 0.8 : 1 + (u - 0.3) * 0.36);
    g.globalAlpha = u < 0.3 ? u / 0.3 : 1 - (u - 0.3) / 0.7;
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
    ring({ count: 16 + tier * 2, dist: 50 + tier * 4, size: 4.5, dur: 800, delay: 180, squash: 0.55 });
    motes({ count: 10 + tier * 3, dur: ms + 300, spread: 26, motion: 'swirl', size: [3, 5] });
    motes({ count: 8 + tier * 2, dur: ms + 500, spread: 18, motion: theme.motion === 'fall' ? 'fall' : 'rise', size: [2.5, 4], at: body });
    if (theme.shadow) {
      layer((g, u, w, h) => {
        g.globalAlpha = u < 0.2 ? (u / 0.2) * 0.9 : u < 0.65 ? 0.9 - ((u - 0.2) / 0.45) * 0.15 : 0.75 * (1 - (u - 0.65) / 0.35);
        g.globalCompositeOperation = 'source-over';
        g.fillStyle = radial(g, p.x, p.y, 80 * k, [[0, alpha(dark, 0)], [12 / 80, alpha(dark, 0)], [1, alpha(dark, 0.93)]]);
        g.fillRect(0, 0, w, h);
      }, ms + 400);
    }
  }

  if (tier >= 4) {
    rays(ms, false);
    shockwave(800, 220, 120);
    layer((g, u) => {
      const sx = u < 0.3 ? 0.1 + (u / 0.3) * 0.9 : 1 - ((u - 0.3) / 0.7) * 0.6;
      const sy = u < 0.3 ? 0.2 + (u / 0.3) * 0.8 : 1 + ((u - 0.3) / 0.7) * 0.1;
      const w = 17 * k * sx;
      const hgt = 150 * k * sy;
      g.globalAlpha = u < 0.3 ? (u / 0.3) * 0.95 : 0.95 * (1 - (u - 0.3) / 0.7);
      g.globalCompositeOperation = 'lighter';
      const fill = g.createLinearGradient(0, p.y, 0, p.y - hgt);
      fill.addColorStop(0, light);
      fill.addColorStop(0.4, alpha(mid, 0.66));
      fill.addColorStop(1, alpha(mid, 0));
      g.fillStyle = fill;
      g.fillRect(p.x - w, p.y - hgt, w * 2, hgt);
    }, ms);
    const tint = (dur, strength) => layer((g, u, w, h) => {
      g.globalAlpha = u < 0.12 ? (u / 0.12) * strength : strength * (1 - (u - 0.12) / 0.88);
      g.globalCompositeOperation = theme.shadow ? 'multiply' : 'lighter';
      g.fillStyle = mid;
      g.fillRect(0, 0, w, h);
    }, dur);
    tint(700, theme.shadow ? 0.35 : 0.28);
    sparkles({ count: 18, dur: ms + 400, spread: 30, rise: 20, at: body });
    if (tier >= 5) {
      rays(ms + 300, true);
      shockwave(1000, 420, 170);
      ring({ count: 30, dist: 80, size: 5, dur: 1000, delay: 260, squash: 0.6 });
      motes({ count: 46, dur: ms + 500, spread: 90, motion: 'fall', size: [3, 6] });
      crown(1600);
      tint(900, 0.45);
    }
  }
  return { items, blend };
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

  const clear = () => {
    g.setTransform(size.dpr, 0, 0, size.dpr, 0, 0);
    g.globalCompositeOperation = 'source-over';
    g.globalAlpha = 1;
    g.clearRect(0, 0, size.width, size.height);
  };

  const tick = (now) => {
    const { width, height, dpr } = size;
    clear();
    for (let b = live.length - 1; b >= 0; b--) {
      const burst = live[b];
      const time = now - burst.start;
      if (time > burst.end) {
        live.splice(b, 1);
        continue;
      }
      for (const item of burst.items) {
        const u = (time - item.delay) / item.dur;
        if (u < 0 || u > 1) continue;
        if (item.draw) {
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.save();
          item.draw(g, u, width, height);
          g.restore();
          continue;
        }
        const f = frameAt(item.keys, item.curve(u));
        if (f.a <= 0 || f.s <= 0) continue;
        g.globalCompositeOperation = burst.blend;
        g.globalAlpha = Math.min(1, f.a);
        g.setTransform(dpr, 0, 0, dpr, f.x * dpr, f.y * dpr);
        g.rotate(f.r);
        const side = f.s / 0.6;
        g.drawImage(item.img, -side / 2, -side / 2, side, side);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
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
      const { items, blend } = planBurst(p, k, theme);
      live.push({ items, blend, start: performance.now(), end: Math.max(...items.map((item) => item.delay + item.dur)) });
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

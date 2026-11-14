export const FRAME_MS = 50;
export const FIELD = { width: 320, height: 180 };
const USER_FOCUS = { x: 106, y: 116 };
const TARGET_FOCUS = { x: 234, y: 52 };
const CELL = 96;
const LOAD_TIMEOUT_MS = 1500;

export const TARGET_USER = 0;
export const TARGET_TARGET = 1;
export const TARGET_GRAPHIC = 2;
const FOCUS_TARGET = 1;
const FOCUS_USER = 2;
const FOCUS_USER_TARGET = 3;

const STATUS_ANIMS = { psn: 'common-poison', tox: 'common-toxic', par: 'common-paralysis', slp: 'common-sleep', frz: 'common-frozen', brn: 'common-burn' };
const CAUSE_ANIMS = { ...STATUS_ANIMS, sand: 'common-sandstorm', hail: 'common-hail', leechseed: 'common-leech-seed', bound: 'common-bind', curse: 'common-curse', saltcure: 'common-salt-cure', confusion: 'common-confusion' };
const CONDITION_ANIMS = { protect: 'common-protect', confusion: 'common-confusion', attract: 'common-attract', leechdrain: 'common-leech-seed', bound: 'common-bind', saltcure: 'common-salt-cure' };
const WEATHER_ANIMS = { sun: 'common-sunny', harshsun: 'common-harsh-sun', rain: 'common-rain', heavyrain: 'common-heavy-rain', sand: 'common-sandstorm', hail: 'common-hail', snow: 'common-snow', wind: 'common-strong-winds' };
const TERRAIN_ANIMS = { electric: 'common-electric-terrain', grassy: 'common-grassy-terrain', misty: 'common-misty-terrain', psychic: 'common-psychic-terrain' };

export const statusAnim = (status) => STATUS_ANIMS[status] ?? null;
export const causeAnim = (cause) => CAUSE_ANIMS[cause] ?? null;
export const conditionAnim = (kind) => CONDITION_ANIMS[kind] ?? null;
export const weatherAnim = (weather) => WEATHER_ANIMS[weather] ?? null;
export const terrainAnim = (terrain) => TERRAIN_ANIMS[terrain] ?? null;
export const chargeAnim = (key) => (key ? `${key}-charging` : null);
export const COMMON_PRELOAD = [...new Set([...Object.values(CAUSE_ANIMS), ...Object.values(CONDITION_ANIMS), ...Object.values(WEATHER_ANIMS), ...Object.values(TERRAIN_ANIMS)])];

export function hpTweenMs(from, to) {
  return Math.min(5000, Math.max(250, Math.abs(from - to) * 5));
}

export function pickVariant(anim, byPlayer) {
  if (!anim?.length) return null;
  const opponent = !byPlayer && anim.length > 1;
  return { config: opponent ? anim[1] : anim[0], swapped: opponent };
}

export function placeEntry(entry, { user, target, scale, width, height }) {
  const [kind, x, y, zoomX, zoomY, angle, mirror, , , , , , focus] = entry;
  const fx = x + USER_FOCUS.x;
  const fy = y + USER_FOCUS.y;
  let px;
  let py;
  let flip = mirror ? -1 : 1;
  if (focus === FOCUS_USER) {
    px = user.x + (fx - USER_FOCUS.x) * scale;
    py = user.y + (fy - USER_FOCUS.y) * scale;
  } else if (focus === FOCUS_USER_TARGET) {
    const tx = (fx - USER_FOCUS.x) / (TARGET_FOCUS.x - USER_FOCUS.x);
    const ty = (fy - USER_FOCUS.y) / (TARGET_FOCUS.y - USER_FOCUS.y);
    px = user.x + tx * (target.x - user.x);
    py = user.y + ty * (target.y - user.y);
    if (kind === TARGET_GRAPHIC && target.x < user.x) flip *= -1;
  } else if (focus === FOCUS_TARGET) {
    px = target.x + (fx - TARGET_FOCUS.x) * scale;
    py = target.y + (fy - TARGET_FOCUS.y) * scale;
  } else {
    px = (fx / FIELD.width) * width;
    py = (fy / FIELD.height) * height;
  }
  return { x: px, y: py, scaleX: (zoomX / 100) * flip, scaleY: zoomY / 100, angle: -angle };
}

export function animLength(config) {
  const bgEnd = (config.bg ?? []).reduce((end, [frame, , , , , , duration]) => Math.max(end, frame + duration * 2), 0);
  return Math.max(config.frames.length, bgEnd);
}

const BLEND = ['normal', 'plus-lighter', 'difference'];

function toneFilter(tone) {
  if (!tone) return '';
  const [r, g, b, gray] = tone;
  const light = 1 + (r + g + b) / (3 * 255);
  return `brightness(${Math.max(0, light).toFixed(2)}) grayscale(${Math.min(1, Math.max(0, gray / 255)).toFixed(2)})`;
}

export function createAnimPlayer(field) {
  const anims = new Map();
  const images = new Map();
  const reduced = () => document.hidden || window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function loadImage(url) {
    if (!url) return Promise.resolve(null);
    if (!images.has(url)) {
      images.set(url, new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
      }));
    }
    return images.get(url);
  }

  function load(key) {
    if (!key) return Promise.resolve(null);
    if (!anims.has(key)) {
      const anim = fetch(`/anims/${key}.json`)
        .then((res) => (res.ok ? res.json() : null))
        .then(async (data) => {
          if (!data) return null;
          const urls = data.flatMap((side) => [side.graphic?.url, ...side.bg.map((e) => e[2])]);
          await Promise.all(urls.map(loadImage));
          return data;
        })
        .catch(() => null);
      anims.set(key, anim);
    }
    return anims.get(key);
  }

  const withTimeout = (promise) => Promise.race([promise, new Promise((r) => setTimeout(() => r(null), LOAD_TIMEOUT_MS))]);

  function center(spot) {
    const f = field.getBoundingClientRect();
    const scale = f.width / FIELD.width || 1;
    const img = spot.querySelector('.creature img') ?? spot;
    const r = img.getBoundingClientRect();
    return { x: (r.left - f.left + r.width / 2) / scale, y: (r.top - f.top + r.height / 2) / scale };
  }

  function sprite(css) {
    const el = document.createElement('div');
    el.className = 'anim-sprite';
    Object.assign(el.style, css);
    field.append(el);
    return el;
  }

  function addBg(url, { bgX, bgY, opacity }, scale, current) {
    current?.remove();
    const el = sprite({ zIndex: '0', left: '0', top: '0', width: `${1120 * scale}px`, height: `${720 * scale}px`, background: url ? '' : '#000', opacity: String((opacity ?? 0) / 255) });
    if (url) {
      el.style.backgroundImage = `url("${url}")`;
      el.style.backgroundRepeat = 'repeat';
      loadImage(url).then((img) => {
        if (img) el.style.backgroundSize = `${img.naturalWidth * 1.25 * scale}px ${img.naturalHeight * 1.25 * scale}px`;
      });
    }
    el.style.transform = `translate(${((bgX ?? 0) - 320) * scale}px, ${((bgY ?? 0) - 284) * scale}px)`;
    field.insertBefore(el, field.querySelector('.spot'));
    return el;
  }

  function updateBg(el, { bgX, bgY, opacity, duration }, scale) {
    if (!el) return;
    const ms = Math.max(1, duration * 3 * (1000 / 60));
    el.style.transition = `transform ${ms}ms linear, opacity ${ms}ms linear`;
    const current = new DOMMatrixReadOnly(getComputedStyle(el).transform);
    const x = bgX != null ? (bgX * 0.5 - 320) * scale : current.m41;
    const y = bgY != null ? (bgY * 0.5 - 284) * scale : current.m42;
    el.style.transform = `translate(${x}px, ${y}px)`;
    if (opacity != null) el.style.opacity = String(opacity / 255);
  }

  async function play(key, { userSpot, targetSpot = userSpot, byPlayer = true }) {
    if (reduced()) return true;
    const anim = await withTimeout(load(key));
    const variant = pickVariant(anim, byPlayer);
    if (!variant || !variant.config.frames.length) return false;
    const { config, swapped } = variant;
    const [userEl, targetEl] = swapped ? [targetSpot, userSpot] : [userSpot, targetSpot];
    const same = userEl === targetEl;
    const geo = { user: center(userEl), target: center(targetEl), scale: 1, width: FIELD.width, height: FIELD.height };
    const cell = CELL * geo.scale;
    const sheet = config.graphic ? await loadImage(config.graphic.url) : null;
    const columns = config.graphic?.columns ?? 5;
    const mons = [userEl, targetEl].map((spot) => spot.querySelector('.creature img'));
    const graphics = [];
    let bg = null;

    const styleMon = (img, entry) => {
      if (!img) return;
      if (!entry) {
        img.style.visibility = 'hidden';
        return;
      }
      const rest = img === mons[0] ? geo.user : geo.target;
      const p = placeEntry(entry, geo);
      Object.assign(img.style, {
        visibility: entry[7] ? 'visible' : 'hidden',
        opacity: String(entry[10] / 255),
        transform: `translate(${p.x - rest.x}px, ${p.y - rest.y}px) rotate(${p.angle}deg) scale(${p.scaleX}, ${p.scaleY})`,
        filter: toneFilter(entry[13]),
        mixBlendMode: BLEND[entry[8]] ?? 'normal',
      });
    };

    const styleGraphic = (el, entry) => {
      const p = placeEntry(entry, geo);
      const frame = entry[9];
      Object.assign(el.style, {
        zIndex: entry[11] === 2 ? '0' : '1',
        width: `${cell}px`,
        height: `${cell}px`,
        backgroundImage: sheet ? `url("${config.graphic.url}")` : '',
        backgroundSize: sheet ? `${(sheet.naturalWidth / CELL) * cell}px ${(sheet.naturalHeight / CELL) * cell}px` : '',
        backgroundPosition: `${-(frame % columns) * cell}px ${-Math.floor(frame / columns) * cell}px`,
        transform: `translate(${p.x - cell / 2}px, ${p.y - cell / 2}px) rotate(${p.angle}deg) scale(${p.scaleX}, ${p.scaleY})`,
        opacity: String(entry[10] / 255),
        visibility: entry[7] ? 'visible' : 'hidden',
        mixBlendMode: BLEND[entry[8]] ?? 'normal',
        filter: toneFilter(entry[13]),
      });
    };

    const showFrame = (f) => {
      const entries = config.frames[f] ?? [];
      const graphicEntries = entries.filter((e) => e[0] === TARGET_GRAPHIC);
      while (graphics.length < graphicEntries.length) graphics.push(sprite({}));
      graphics.splice(graphicEntries.length).forEach((el) => el.remove());
      graphicEntries.forEach((entry, i) => styleGraphic(graphics[i], entry));
      const userEntry = entries.find((e) => e[0] === TARGET_USER);
      const targetEntry = entries.find((e) => e[0] === TARGET_TARGET);
      if (same) styleMon(mons[1], targetEntry ?? userEntry);
      else {
        styleMon(mons[0], userEntry);
        styleMon(mons[1], targetEntry);
      }
      for (const event of config.bg) {
        if (event[0] !== f) continue;
        const [, type, url, bgX, bgY, opacity, duration] = event;
        if (type === 'add') bg = addBg(url, { bgX, bgY, opacity }, geo.scale, bg);
        else updateBg(bg, { bgX, bgY, opacity, duration }, geo.scale);
      }
    };

    const cleanup = () => {
      graphics.forEach((el) => el.remove());
      bg?.remove();
      for (const img of mons) {
        if (img) Object.assign(img.style, { visibility: '', opacity: '', transform: '', filter: '', mixBlendMode: '' });
      }
    };

    const total = animLength(config);
    await new Promise((resolve) => {
      let f = 0;
      const step = () => {
        if (f < config.frames.length) showFrame(f);
        else if (f === config.frames.length) {
          graphics.splice(0).forEach((el) => el.remove());
          for (const img of mons) if (img) Object.assign(img.style, { visibility: '', opacity: '', transform: '', filter: '', mixBlendMode: '' });
        }
        if (++f >= total) {
          cleanup();
          resolve();
          return;
        }
        setTimeout(step, FRAME_MS);
      };
      step();
    });
    return true;
  }

  return {
    play,
    preload(keys) {
      for (const key of new Set(keys)) if (key) load(key);
    },
  };
}

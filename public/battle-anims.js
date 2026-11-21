import { UPSTREAM, upstreamManifest, upstreamURLs } from './upstream.js?v=dev';

const FRAME_MS = 50;
const FIELD = { width: 320, height: 180 };
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

const TINT_CORE = 0.55;

export function tintPixels(data, hex) {
  const tint = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const light = (data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11) / 255;
    const core = light ** 3 * TINT_CORE;
    const body = Math.min(1, light * 1.25);
    for (let c = 0; c < 3; c++) data[i + c] = Math.round(tint[c] * body * (1 - core) + 255 * core);
  }
}

export const statusAnim = (status) => STATUS_ANIMS[status] ?? null;
export const causeAnim = (cause) => CAUSE_ANIMS[cause] ?? null;
export const conditionAnim = (kind) => CONDITION_ANIMS[kind] ?? null;
export const weatherAnim = (weather) => WEATHER_ANIMS[weather] ?? null;
export const terrainAnim = (terrain) => TERRAIN_ANIMS[terrain] ?? null;
export const chargeAnim = (key) => (key ? `${key}-charging` : null);
export const COMMON_PRELOAD = [...new Set([...Object.values(CAUSE_ANIMS), ...Object.values(CONDITION_ANIMS), ...Object.values(WEATHER_ANIMS), ...Object.values(TERRAIN_ANIMS)])];

export const shownSprite = (spot) => spot.querySelector(spot.classList.contains('has-sub') ? '.sub-doll img' : '.creature img');

const ACTION_EVENTS = new Set(['move', 'switch', 'charging', 'turn', 'dragged']);
const MISSED_EVENTS = new Set(['miss', 'immune', 'protected', 'nothing', 'notarget', 'fizzle']);

export function moveLands(events, index) {
  const move = events[index];
  if (move.target === 'self') return true;
  const foe = 1 - move.side;
  for (const ev of events.slice(index + 1)) {
    if (ACTION_EVENTS.has(ev.t)) return true;
    if ((ev.t === 'damage' || ev.t === 'subDamage') && ev.side === foe) return true;
    if (MISSED_EVENTS.has(ev.t)) return false;
    if (ev.t === 'ability' && ev.side === foe && !ev.note) return false;
  }
  return true;
}

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

/** How many 96-pixel cells a sheet has per row. */
export const sheetColumns = (width) => Math.max(1, Math.floor(width / CELL));

export function animLength(config) {
  const bgEnd = (config.bg ?? []).reduce((end, [frame, , , , , , duration]) => Math.max(end, frame + duration), 0);
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

  const imageFrom = (url) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = url;
    });

  // A sheet by its key, from the first of its URLs that loads: CSS backgrounds have no error
  // fallback of their own, so they use the loaded image's src.
  const tintedSheets = new Map();
  function tintedSheet(sheet, hex) {
    const key = `${sheet.src}|${hex}`;
    if (!tintedSheets.has(key)) {
      tintedSheets.set(key, new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const g = canvas.getContext('2d');
            g.drawImage(img, 0, 0);
            const pixels = g.getImageData(0, 0, canvas.width, canvas.height);
            tintPixels(pixels.data, hex);
            g.putImageData(pixels, 0, 0);
            resolve(canvas.toDataURL('image/png'));
          } catch {
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        img.src = sheet.src;
      }));
    }
    return tintedSheets.get(key);
  }

  function loadImage(graphic) {
    if (!graphic) return Promise.resolve(null);
    if (!images.has(graphic)) {
      images.set(graphic, upstreamManifest('pokerogue').then(async (manifest) => {
        const path = manifest.graphics?.[graphic];
        if (typeof path !== 'string') return null;
        for (const url of upstreamURLs(UPSTREAM.pokerogue, path)) {
          const img = await imageFrom(url);
          if (img) return img;
        }
        return null;
      }));
    }
    return images.get(graphic);
  }

  function load(key) {
    if (!key) return Promise.resolve(null);
    if (!anims.has(key)) {
      const anim = fetch(`/anims/${key}.json`)
        .then((res) => (res.ok ? res.json() : null))
        .then(async (data) => {
          if (!data) return null;
          const graphics = data.flatMap((side) => [side.graphic, ...side.bg.map((event) => event[2])]);
          await Promise.all(graphics.map(loadImage));
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
    const img = shownSprite(spot) ?? spot;
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

  function addBg(graphic, { bgX, bgY, opacity }, scale, current) {
    current?.remove();
    const el = sprite({ zIndex: '0', left: '0', top: '0', width: `${1120 * scale}px`, height: `${720 * scale}px`, background: graphic ? '' : '#000', opacity: String((opacity ?? 0) / 255) });
    if (graphic) {
      el.style.backgroundRepeat = 'repeat';
      loadImage(graphic).then((img) => {
        if (!img) return;
        el.style.backgroundImage = `url("${img.src}")`;
        el.style.backgroundSize = `${img.naturalWidth * 1.25 * scale}px ${img.naturalHeight * 1.25 * scale}px`;
      });
    }
    el.bgAt = { x: ((bgX ?? 0) - 320) * scale, y: ((bgY ?? 0) - 284) * scale };
    el.style.transform = `translate(${el.bgAt.x}px, ${el.bgAt.y}px)`;
    field.insertBefore(el, field.querySelector('.spot'));
    return el;
  }

  function updateBg(el, { bgX, bgY, opacity, duration }, scale) {
    if (!el) return;
    const ms = Math.max(1, duration * FRAME_MS);
    if (bgX != null || bgY != null) {
      const from = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const to = { x: bgX != null ? (bgX * 0.5 - 320) * scale : el.bgAt.x, y: bgY != null ? (bgY * 0.5 - 284) * scale : el.bgAt.y };
      el.bgAt = to;
      el.bgMove?.cancel();
      el.style.transform = `translate(${to.x}px, ${to.y}px)`;
      el.bgMove = el.animate([{ transform: `translate(${from.m41}px, ${from.m42}px)` }, { transform: el.style.transform }], { duration: ms, easing: 'linear' });
    }
    if (opacity != null) {
      const from = getComputedStyle(el).opacity;
      el.bgFade?.cancel();
      el.style.opacity = String(opacity / 255);
      el.bgFade = el.animate([{ opacity: from }, { opacity: el.style.opacity }], { duration: ms, easing: 'linear' });
    }
  }

  async function play(key, { userSpot, targetSpot = userSpot, byPlayer = true, tint = null }) {
    if (reduced()) return true;
    const anim = await withTimeout(load(key));
    const variant = pickVariant(anim, byPlayer);
    if (!variant || !variant.config.frames.length) return false;
    const { config, swapped } = variant;
    const [userEl, targetEl] = swapped ? [targetSpot, userSpot] : [userSpot, targetSpot];
    const same = userEl === targetEl;
    const geo = { user: center(userEl), target: center(targetEl), scale: 1, width: FIELD.width, height: FIELD.height };
    const cell = CELL * geo.scale;
    const sheet = await loadImage(config.graphic);
    if (config.graphic && !sheet) return false;
    const sheetSrc = sheet ? (tint && (await withTimeout(tintedSheet(sheet, tint)))) || sheet.src : null;
    const columns = sheet ? sheetColumns(sheet.naturalWidth) : 1;
    const mons = [userEl, targetEl].map(shownSprite);
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
        backgroundImage: sheet ? `url("${sheetSrc}")` : '',
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
    };

    const showBg = (f) => {
      for (const event of config.bg) {
        if (event[0] !== f) continue;
        const [, type, graphic, bgX, bgY, opacity, duration] = event;
        if (type === 'add') bg = addBg(graphic, { bgX, bgY, opacity }, geo.scale, bg);
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
        showBg(f);
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
    async bare(key) {
      const anim = await withTimeout(load(key));
      return !!anim?.length && anim.every((side) => !side.graphic && !side.bg?.length);
    },
    preload(keys) {
      for (const key of new Set(keys)) if (key) load(key);
    },
  };
}

import { UPSTREAM, upstreamManifest, upstreamURLs } from './upstream.js?v=dev';

let sprites = new Map();
let animatedSprites = new Map();

export const ANIMATED_SPRITES_INDEX = 'index.json';
const ANIMATED_VARIANTS = ['front', 'front-shiny', 'back', 'back-shiny'];

export const animatedSpriteFile = (slug, variant, extension = 'png') => `${slug}-${ANIMATED_VARIANTS[variant]}.${extension}`;

export const spritesLoaded = () => sprites.size > 0;

const loadAnimatedSprites = () =>
  fetch(`/animated/${ANIMATED_SPRITES_INDEX}?v=dev`)
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}));

export async function loadSprites() {
  const [manifest, animated] = await Promise.all([upstreamManifest('sprites'), loadAnimatedSprites()]);
  sprites = new Map(Object.entries(manifest).flatMap(([dir, slugs]) => Object.entries(slugs).map(([slug, files]) => [slug, files.map((file) => upstreamURLs(UPSTREAM.sprites, dir + file)[0])])));
  animatedSprites = new Map(Object.entries(animated.sprites ?? {}));
}

export function spriteURL(mon, { back = false } = {}) {
  const slug = String(mon.sprite);
  const variant = (back ? 2 : 0) + (mon.shiny ? 1 : 0);
  const animated = animatedSprites.get(slug);
  if (animated) return `/animated/${animated[variant]}?v=dev`;
  return sprites.get(slug)?.[variant] ?? '';
}

const isAnimated = (mon) => animatedSprites.has(String(mon.sprite)) || spriteURL(mon).endsWith('.gif');

const preloaded = new Map();
export function preloadSprites(list, opts) {
  for (const mon of list) {
    const url = spriteURL(mon, opts);
    if (!url || preloaded.has(url)) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    preloaded.set(url, img);
  }
}

export function creatureHTML(mon, { back = false, eager = false } = {}) {
  const cls = ['creature', mon.shiny ? 'is-shiny' : '', mon.rarity === 'legendary' ? 'legendary' : '', isAnimated(mon) ? 'animated' : mon.floats ? 'floats' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"><img src="${spriteURL(mon, { back })}" alt="" draggable="false" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}></div>`;
}

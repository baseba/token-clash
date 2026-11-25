import { UPSTREAM, upstreamManifest, upstreamURLs } from './upstream.js?v=dev';

let sprites = new Map();

export const spritesLoaded = () => sprites.size > 0;

export async function loadSprites() {
  const manifest = await upstreamManifest('sprites');
  sprites = new Map(Object.entries(manifest).flatMap(([dir, slugs]) => Object.entries(slugs).map(([slug, files]) => [slug, files.map((file) => upstreamURLs(UPSTREAM.sprites, dir + file)[0])])));
}

export function spriteURL(mon, { back = false } = {}) {
  return sprites.get(String(mon.sprite))?.[(back ? 2 : 0) + (mon.shiny ? 1 : 0)] ?? '';
}

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
  const animated = spriteURL(mon).endsWith('.gif');
  const cls = ['creature', mon.shiny ? 'is-shiny' : '', mon.rarity === 'legendary' ? 'legendary' : '', animated ? 'animated' : mon.floats ? 'floats' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"><img src="${spriteURL(mon, { back })}" alt="" draggable="false" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}></div>`;
}

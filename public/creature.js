const SLUG = /^[a-z0-9_-]+$/;
let animated = new Set();

export async function loadAnimatedSprites() {
  try {
    const res = await fetch('/sprites/animated.json');
    if (res.ok) animated = new Set(await res.json());
  } catch {}
}

// A PokeAPI sprite, served locally from /sprites/ by dex number. The player's own creature is seen
// from behind, like in the classic battle view; everyone else from the front.
export function spriteURL(f, { back = false } = {}) {
  const slug = SLUG.test(f.sprite || '') ? f.sprite : 'missing';
  return `/sprites/${slug}-${back ? (f.shiny ? 'back-shiny' : 'back') : (f.shiny ? 'front-shiny' : 'front')}.${animated.has(slug) ? 'gif' : 'png'}?v=dev`;
}

const preloaded = new Map();
export function preloadSprites(list, opts) {
  for (const f of list) {
    const url = spriteURL(f, opts);
    if (preloaded.has(url)) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    preloaded.set(url, img);
  }
}

export function creatureHTML(f, { back = false, eager = false } = {}) {
  const slug = SLUG.test(f.sprite || '') ? f.sprite : 'missing';
  const cls = ['creature', f.shiny ? 'is-shiny' : '', f.rarity === 'legendary' ? 'legendary' : '', animated.has(slug) ? 'animated' : f.floats ? 'floats' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"><img src="${spriteURL(f, { back })}" alt="" draggable="false" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'}></div>`;
}

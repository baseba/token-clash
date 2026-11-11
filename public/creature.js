export const ELEMENTS = {
  brasa: { label: 'Brasa', hue: 14, sat: 85, icon: '🔥' },
  marea: { label: 'Marea', hue: 205, sat: 75, icon: '🌊' },
  brote: { label: 'Brote', hue: 118, sat: 55, icon: '🌱' },
  chispa: { label: 'Chispa', hue: 48, sat: 95, icon: '⚡' },
  roca: { label: 'Roca', hue: 30, sat: 35, icon: '🪨' },
  sombra: { label: 'Sombra', hue: 272, sat: 45, icon: '🌑' },
};
export const BEATS = { brasa: 'brote', brote: 'marea', marea: 'brasa', chispa: 'sombra', sombra: 'roca', roca: 'chispa' };
export function effectiveness(a, d) {
  if (!a || !d) return 1;
  if (BEATS[a] === d) return 1.5;
  if (BEATS[d] === a) return 0.67;
  return 1;
}

const SLUG = /^[a-z0-9_-]+$/;

// A Tuxemon sprite (CC BY-SA / CC BY, see /creditos.txt). The player's own creature is seen from
// behind, like in the classic battle view; everyone else from the front.
export function creatureHTML(f, { back = false } = {}) {
  const slug = SLUG.test(f.sprite || '') ? f.sprite : 'missing';
  const cls = ['creature', f.shiny ? 'is-shiny' : '', f.rarity === 'legendary' ? 'legendary' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"><img src="/sprites/${slug}-${back ? 'back' : 'front'}.png" alt="" draggable="false" loading="lazy"></div>`;
}

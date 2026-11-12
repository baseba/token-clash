const SLUG = /^[a-z0-9_-]+$/;

// A PokeAPI sprite, served locally from /sprites/ by dex number. The player's own creature is seen
// from behind, like in the classic battle view; everyone else from the front.
export function creatureHTML(f, { back = false } = {}) {
  const slug = SLUG.test(f.sprite || '') ? f.sprite : 'missing';
  const cls = ['creature', f.shiny ? 'is-shiny' : '', f.rarity === 'legendary' ? 'legendary' : ''].filter(Boolean).join(' ');
  return `<div class="${cls}"><img src="/sprites/${slug}-${back ? (f.shiny ? 'back-shiny' : 'back') : (f.shiny ? 'front-shiny' : 'front')}.png" alt="" draggable="false" loading="lazy"></div>`;
}

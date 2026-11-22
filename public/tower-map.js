// The map of a Tower floor: a strip of route seen from above, laid out like the games' routes
// (public/tower-tiles.js) in the scene of the battle background that comes next, with the trainers'
// overworld sprites on it. It is pixel art like the Poké Ball effects: drawn at the tiles' own size on
// a small canvas, scaled up without smoothing, and repainted for a scene colour by colour (night,
// snow, autumn…) instead of under a translucent layer. You walk in from the left to the rival like in
// the Battle Tower of Emerald: it sees you, says its line, and the battle starts. Between floors the
// path forks into the ways you can take.
import { overworldSprite } from './overworld.js?v=dev';
import { ATLAS_COLS, ATLAS_KEYS, COLS, exitRows, FORK_COL, mapLayout, PATH_ROW, ROWS, sceneLook, TILE, tintPixels } from './tower-tiles.js?v=dev';

export { COLS, ROWS, exitRows };

const TILE_MS = 200;
const SIGN_MS = 2400;
const ATLAS_INDEX = new Map(ATLAS_KEYS.map((key, i) => [key, i]));
const FALLBACK_GROUND = { tallGrass: '#70c8a0', path: '#70c8a0', lake: '#70c8a0', beach: '#e0cc88', ocean: '#5068d0', mountain: '#b89878', desert: '#e0cc88', cave: '#a88a68', snow: '#dce8f4', lab: '#e8e4c8' };

let atlas = null;
/** The tiles atlas, loaded once for the whole session (and cached by the browser for good: its URL carries the version). */
export function preloadTiles() {
  atlas ??= new Promise((resolve) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = '/tiles/tower.png?v=dev';
  });
  return atlas;
}
let atlasImage = null;
preloadTiles().then((img) => { atlasImage = img; });

/** Each map drawn this session, by scene, seed and forks: going back to a floor's map costs nothing. */
const drawn = new Map();
const DRAWN_LIMIT = 24;

function paintMap(scene, seed, forks, foeCol) {
  const id = `${scene}|${seed}|${forks}|${foeCol}`;
  if (drawn.has(id)) return drawn.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const look = sceneLook(scene);
  const grid = mapLayout({ scene, seed, forks, foeCol });
  grid.forEach((row, r) => row.forEach((key, c) => {
    const index = ATLAS_INDEX.get(key) ?? 0;
    ctx.drawImage(atlasImage, (index % ATLAS_COLS) * TILE, Math.floor(index / ATLAS_COLS) * TILE, TILE, TILE, c * TILE, r * TILE, TILE, TILE);
  }));
  if (look.tints.length) {
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    tintPixels(image.data, look.tints);
    ctx.putImageData(image, 0, 0);
  }
  drawn.set(id, canvas);
  if (drawn.size > DRAWN_LIMIT) drawn.delete(drawn.keys().next().value);
  return canvas;
}

function drawInto(canvas, options) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const draw = () => ctx.drawImage(paintMap(options.scene, options.seed, options.forks, options.foeCol), 0, 0);
  if (atlasImage) return draw();
  ctx.fillStyle = FALLBACK_GROUND[sceneLook(options.scene).family];
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  preloadTiles().then((img) => img && draw());
}

function actor(key, { col, row, facing }) {
  const sprite = overworldSprite(key, { facing, scale: 1 });
  sprite.style.width = '';
  sprite.style.height = '';
  const holder = document.createElement('div');
  holder.className = 'tw-actor';
  holder.append(sprite);
  const place = (nextCol, nextRow) => {
    holder.style.setProperty('--x', String(nextCol));
    holder.style.setProperty('--y', String(nextRow));
    holder.style.zIndex = String(10 + nextRow);
  };
  place(col, row);
  const self = { el: holder, sprite, col, row };
  /** Walks in a straight line to a tile; resolves on arrival. */
  self.walk = (toCol, toRow = self.row) => {
    const tiles = Math.abs(toCol - self.col) + Math.abs(toRow - self.row);
    if (!tiles) return Promise.resolve();
    const facing = toCol > self.col ? 'right' : toCol < self.col ? 'left' : toRow < self.row ? 'up' : 'down';
    sprite.set({ facing, walking: true });
    holder.style.setProperty('--walk', `${tiles * TILE_MS}ms`);
    place(toCol, toRow);
    self.col = toCol;
    self.row = toRow;
    return new Promise((resolve) => setTimeout(() => {
      sprite.set({ walking: false });
      resolve();
    }, tiles * TILE_MS));
  };
  self.face = (facing) => sprite.set({ facing, walking: false });
  return self;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const motion = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The map element and its cast. `hero` and `foe` are trainer keys (the foe may be absent); `stage` is
 * 'arrive' (the rival waits at the right), 'rest' (the beaten rival stepped aside) or 'fork' (no
 * rival, the path splits into `forks` ways). `entrance` is how you get there: 'walk' (you walk in
 * from the left, under the name of the place), 'battle' (the bars of the battle open) or none.
 * A `compact` map shows only the rows around the path.
 */
export function towerMap({ scene, seed, hero, foe = null, boss = false, stage = 'arrive', forks = 0, label = '', place = null, compact = false, entrance = null }) {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  canvas.className = 'tw-map-canvas';
  const foeSpot = { col: boss ? 13 : 12, row: PATH_ROW };
  drawInto(canvas, { scene, seed, forks: stage === 'fork' ? forks : 0, foeCol: stage === 'arrive' && foe ? foeSpot.col : -9 });
  const el = document.createElement('div');
  el.className = `tw-map${boss ? ' boss' : ''}${compact ? ' compact' : ''}${entrance === 'battle' && motion() ? ' closing' : ''}`;
  el.style.setProperty('--cols', String(COLS));
  el.style.setProperty('--rows', String(ROWS));
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.append(canvas);
  const cast = { el, hero: null, foe: null };
  const heroSpot = stage === 'rest' ? { col: 9, row: PATH_ROW } : stage === 'fork' ? { col: 4, row: PATH_ROW } : { col: 1, row: PATH_ROW };
  const walkIn = entrance === 'walk' && motion();
  cast.hero = actor(hero, { col: walkIn ? -1 : heroSpot.col, row: heroSpot.row, facing: 'right' });
  if (foe && stage === 'rest') cast.foe = actor(foe, { col: 11, row: PATH_ROW - 1, facing: 'down' });
  else if (foe && stage === 'arrive') cast.foe = actor(foe, { ...foeSpot, facing: 'left' });
  for (const member of [cast.foe, cast.hero]) if (member) el.append(member.el);

  if (place) {
    const sign = document.createElement('div');
    sign.className = 'tw-place';
    sign.innerHTML = '<b></b><small></small>';
    sign.querySelector('b').textContent = place.name;
    sign.querySelector('small').textContent = place.detail ?? '';
    el.append(sign);
    if (entrance && motion()) setTimeout(() => sign.classList.add('away'), SIGN_MS);
    else sign.classList.add('away');
  }

  /** You arrive: walking in from the left edge, or as the battle's bars open. */
  cast.arrive = async () => {
    if (entrance === 'battle' && motion()) {
      await pause(80);
      el.classList.remove('closing');
      await pause(600);
    }
    if (walkIn) await cast.hero.walk(heroSpot.col, heroSpot.row);
  };
  /** You walk up to the rival, it sees you ("!") and turns to you. */
  cast.approach = async () => {
    if (!cast.foe) return;
    await cast.hero.walk(foeSpot.col - 2, PATH_ROW);
    const mark = document.createElement('span');
    mark.className = 'tw-exclaim';
    mark.textContent = '!';
    cast.foe.el.append(mark);
    await pause(520);
    mark.remove();
  };
  /** At a fork, you walk to the way you chose and out of the map. */
  cast.takeExit = async (index) => {
    if (stage !== 'fork') return;
    const lane = exitRows(forks)[index] ?? PATH_ROW;
    await cast.hero.walk(FORK_COL, PATH_ROW);
    await cast.hero.walk(FORK_COL, lane);
    await cast.hero.walk(COLS + 1, lane);
  };
  /** You leave the floor on the right, and the map fades out behind you. */
  cast.leave = async () => {
    if (cast.foe && stage === 'rest') cast.foe.face('right');
    if (cast.foe && cast.foe.row === cast.hero.row && cast.foe.col > cast.hero.col) await cast.hero.walk(cast.hero.col, cast.hero.row + 1);
    await cast.hero.walk(COLS + 1, cast.hero.row);
    el.classList.add('fading');
    await pause(260);
  };
  /** The screen closes in bars, like the start of a battle. */
  cast.closeIn = () => {
    el.classList.add('closing');
    return pause(700);
  };
  /** A boss shows itself before the battle: its portrait slides in over the map. */
  cast.showdown = async (portrait, title) => {
    const card = document.createElement('div');
    card.className = 'tw-vs';
    const name = document.createElement('b');
    name.textContent = title;
    card.append(portrait, name);
    el.append(card);
    await pause(1300);
  };
  return cast;
}

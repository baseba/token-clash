// The map of a Tower floor: a strip of route seen from above, laid out like the games' routes
// (public/tower-tiles.js) in the scene of the battle background that comes next, with the trainers'
// overworld sprites on it. It is pixel art like the Poké Ball effects: drawn at the tiles' own size on
// a small canvas, scaled up without smoothing, and repainted for a scene colour by colour (night,
// snow, autumn…) instead of under a translucent layer. You walk up to the rival like in the Battle
// Tower of Emerald: it sees you, says its line, and the battle starts. You climb going up: a floor
// where the way splits is a crossroads you reach from below, and you come into the next map from the
// side opposite the way you left by (up, from below; right, from the left; left, from the right, with
// the rival waiting on the other side). After a rest you go up again.
import { overworldSprite } from './overworld.js?v=dev';
import { ATLAS_COLS, ATLAS_KEYS, COLS, CROSS_COL, forkExits, mapLayout, PATH_ROW, ROWS, sceneLook, TILE, tintPixels } from './tower-tiles.js?v=dev';

export { COLS, ROWS, forkExits };

/** Where you come up into a map whose rival waits on the path, and where you go up from a rest. */
const UP_FROM_COL = 2;
const REST_UP_COL = CROSS_COL;
/** How you come into the next map after leaving by a way of a crossroads. */
const ENTRANCE_AFTER = { up: 'fromBelow', right: 'walk', left: 'fromRight' };

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

function paintMap(scene, seed, forks, foeCol, from, upTo) {
  const id = `${scene}|${seed}|${forks}|${foeCol}|${from}|${upTo}`;
  if (drawn.has(id)) return drawn.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const look = sceneLook(scene);
  const grid = mapLayout({ scene, seed, forks, foeCol, from, upTo });
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
  const draw = () => ctx.drawImage(paintMap(options.scene, options.seed, options.forks, options.foeCol, options.from, options.upTo), 0, 0);
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
 * 'arrive' (the rival waits on the path), 'rest' (the beaten rival stepped aside) or 'fork' (no rival,
 * a crossroads of `forks` ways). `entrance` is how you get there, under the name of the place: 'walk'
 * (in from the left), 'fromRight' (in from the right, the rival on the left), 'fromBelow' (up from
 * the bottom edge), 'battle' (the bars of the battle open) or none. A `compact` map shows only the rows
 * around the path.
 */
export function towerMap({ scene, seed, hero, foe = null, boss = false, stage = 'arrive', forks = 0, label = '', place = null, compact = false, entrance = null }) {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  canvas.className = 'tw-map-canvas';
  const mirrored = stage === 'arrive' && entrance === 'fromRight';
  const foeSpot = { col: mirrored ? COLS - 1 - (boss ? 13 : 12) : boss ? 13 : 12, row: PATH_ROW };
  const fromBelow = entrance === 'fromBelow';
  const heroSpot = stage === 'rest' ? { col: 9, row: PATH_ROW } : stage === 'fork' ? { col: CROSS_COL, row: PATH_ROW + 1 } : mirrored ? { col: COLS - 2, row: PATH_ROW } : { col: fromBelow ? UP_FROM_COL : 1, row: PATH_ROW };
  drawInto(canvas, {
    scene,
    seed,
    forks: stage === 'fork' ? forks : 0,
    foeCol: stage === 'arrive' && foe ? foeSpot.col : -9,
    from: stage === 'arrive' && fromBelow ? UP_FROM_COL : stage === 'rest' && fromBelow ? heroSpot.col : null,
    upTo: stage === 'rest' ? REST_UP_COL : null,
  });
  const el = document.createElement('div');
  el.className = `tw-map${boss ? ' boss' : ''}${compact ? ' compact' : ''}${entrance === 'battle' && motion() ? ' closing' : ''}`;
  el.style.setProperty('--cols', String(COLS));
  el.style.setProperty('--rows', String(ROWS));
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.append(canvas);
  const cast = { el, hero: null, foe: null };
  const walkIn = ['walk', 'fromRight', 'fromBelow'].includes(entrance) && motion();
  /** The tiles you walk through to your spot: in along the path from a side, or up from the bottom edge. */
  const inPath = entrance === 'fromBelow'
    ? [{ col: stage === 'fork' ? CROSS_COL : heroSpot.col, row: ROWS + 1 }, { col: stage === 'fork' ? CROSS_COL : heroSpot.col, row: heroSpot.row }]
    : entrance === 'fromRight'
      ? [{ col: COLS + 1, row: PATH_ROW }, { col: heroSpot.col, row: PATH_ROW }, heroSpot]
      : [{ col: -1, row: PATH_ROW }, { col: heroSpot.col, row: PATH_ROW }, heroSpot];
  const facing = stage === 'fork' ? 'up' : mirrored ? 'left' : 'right';
  cast.hero = actor(hero, { ...(walkIn ? inPath[0] : heroSpot), facing });
  if (foe && stage === 'rest') cast.foe = actor(foe, { col: 11, row: PATH_ROW - 1, facing: 'down' });
  else if (foe && stage === 'arrive') cast.foe = actor(foe, { ...foeSpot, facing: mirrored ? 'right' : 'left' });
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
    if (!walkIn) return;
    for (const step of inPath.slice(1)) await cast.hero.walk(step.col, step.row);
    cast.hero.face(facing);
  };
  /** You walk up to the rival, it sees you ("!") and turns to you. */
  cast.approach = async () => {
    if (!cast.foe) return;
    await cast.hero.walk(foeSpot.col + (mirrored ? 2 : -2), PATH_ROW);
    const mark = document.createElement('span');
    mark.className = 'tw-exclaim';
    mark.textContent = '!';
    cast.foe.el.append(mark);
    await pause(520);
    mark.remove();
  };
  /** At a crossroads, you walk to the way you chose and out of the map by it. */
  cast.takeExit = async (index) => {
    if (stage !== 'fork') return;
    const exit = forkExits(forks)[index];
    if (!exit) return;
    await cast.hero.walk(CROSS_COL, PATH_ROW);
    if (exit.side === 'up') {
      await cast.hero.walk(exit.col, PATH_ROW);
      await cast.hero.walk(exit.col, -2);
    } else await cast.hero.walk(exit.side === 'left' ? -2 : COLS + 1, PATH_ROW);
  };
  /** How you come into the next map after taking a way of this crossroads. */
  cast.entranceAfter = (index) => ENTRANCE_AFTER[forkExits(forks)[index]?.side] ?? 'walk';
  /** You leave, and the map fades out behind you: up from a rest, off the right anywhere else (the lab). */
  cast.leave = async () => {
    if (stage === 'rest') {
      if (cast.foe) cast.foe.face('left');
      await cast.hero.walk(REST_UP_COL, cast.hero.row);
      await cast.hero.walk(REST_UP_COL, -2);
    } else {
      if (cast.foe && cast.foe.row === cast.hero.row && cast.foe.col > cast.hero.col) await cast.hero.walk(cast.hero.col, cast.hero.row + 1);
      await cast.hero.walk(COLS + 1, cast.hero.row);
    }
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

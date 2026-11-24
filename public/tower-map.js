// The map of a Tower floor: a strip of route seen from above, laid out like the games' routes
// (public/tower-tiles.js) in the scene of the battle background that comes next, with the trainers'
// overworld sprites on it. It is pixel art like the Poké Ball effects: drawn at the tiles' own size on
// a small canvas, scaled up without smoothing, and repainted for a scene colour by colour (night,
// snow, autumn…) instead of under a translucent layer. You walk up to the rival like in the Battle
// Tower of Emerald: it waits in front of the way up, sees you, comes down to you and the battle
// starts; beaten, it steps aside and you go on up. You climb going up: you come into every map where
// you left the one before (up from below at the same column, or in by a side after a crossroads), and a
// floor where the way splits is a crossroads with ways up, left and right. The ways with no battle
// have a map of their own: a Pokémon Center to rest in, a burrow in the tall grass, a dark pool.
import { overworldSprite } from './overworld.js?v=dev';
import { ATLAS_COLS, ATLAS_KEYS, COLS, CROSS_COL, floorWays, forkExits, LAB_SPOTS, mapLayout, PATH_ROW, ROWS, sceneLook, TILE, tintPixels, ZONES, zoneWays } from './tower-tiles.js?v=dev';

export { COLS, ROWS, forkExits, ZONES };

/** Where the rival waits, a tile below the top edge, and where it comes down to you. */
const WAIT_ROW = 1;
const MEET_ROW = PATH_ROW - 1;

/** Who offers the dark deal. */
const DEAL_FIGURE = 'hex_maniac';
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

function paintMap(scene, seed, forks, from, upTo) {
  const id = `${scene}|${seed}|${forks}|${from}|${upTo}`;
  if (drawn.has(id)) return drawn.get(id);
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const look = sceneLook(scene);
  const grid = mapLayout({ scene, seed, forks, from, upTo });
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
  const draw = () => ctx.drawImage(paintMap(options.scene, options.seed, options.forks, options.from, options.upTo), 0, 0);
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
  /** Walks to a tile along a row: first to that row, then across it, then up or down to the tile. */
  self.goTo = async (toCol, toRow, alongRow = PATH_ROW) => {
    if (self.col !== toCol) {
      await self.walk(self.col, alongRow);
      await self.walk(toCol, alongRow);
    }
    await self.walk(toCol, toRow);
  };
  self.hide = (hidden) => holder.classList.toggle('inside', hidden);
  return self;
}

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const motion = () => !matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The map element and its cast. `hero` and `foe` are trainer keys (the foe may be absent); `stage` is
 * 'arrive' (the rival waits in front of the way up), 'rest' (the beaten rival stepped aside, or a way with
 * no battle), 'fork' (no rival, a crossroads of `forks` ways) or 'lab'. A `zone-…` scene is a way with a
 * map of its own (public/tower-tiles.js). `from` is where you left the map before: a column of the
 * bottom edge, or 'left' or 'right'. `entrance` is how you get there, under the name of the place:
 * 'fromBelow' (in from where you left the map before), 'walk' (into the lab by its door, below), 'battle'
 * (the bars of the battle open) or none, and then you stand where you came in. A `compact` map shows
 * only the rows around the path.
 */
export function towerMap({ scene, seed, hero, foe = null, boss = false, stage = 'arrive', forks = 0, from = null, label = '', place = null, compact = false, entrance = null }) {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  canvas.className = 'tw-map-canvas';
  const look = sceneLook(scene);
  const lab = stage === 'lab' || look.family === 'lab';
  const fork = stage === 'fork';
  const zone = look.zone ?? null;
  const visit = zone && zone !== 'hideout';
  const ways = lab ? { from: LAB_SPOTS.door.col, upTo: LAB_SPOTS.stairs.col, aside: LAB_SPOTS.stairs.col } : zone ? zoneWays(zone, seed, from) : fork ? { from: from ?? CROSS_COL, upTo: CROSS_COL, aside: CROSS_COL } : floorWays(seed, from);
  const meet = { col: ways.upTo, row: MEET_ROW };
  const side = typeof ways.from === 'string';
  const cameIn = side ? { col: ways.from === 'left' ? 1 : COLS - 2, row: PATH_ROW } : { col: ways.from, row: ROWS - 1 };
  const heroStart = lab ? LAB_SPOTS.hero : visit ? (entrance ? cameIn : ways.spot) : stage === 'rest' ? { col: ways.upTo, row: PATH_ROW } : cameIn;
  drawInto(canvas, { scene, seed, forks: fork ? forks : 0, from: lab ? null : ways.from, upTo: lab || fork ? null : ways.upTo });
  const el = document.createElement('div');
  el.className = `tw-map${boss ? ' boss' : ''}${compact ? ' compact' : ''}${entrance === 'battle' && motion() ? ' closing' : ''}`;
  el.style.setProperty('--cols', String(COLS));
  el.style.setProperty('--rows', String(ROWS));
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.append(canvas);
  const cast = { el, hero: null, foe: null };
  const walkIn = (entrance === 'fromBelow' || (lab && entrance === 'walk')) && motion();
  const inFrom = lab ? { col: LAB_SPOTS.door.col, row: ROWS + 1 } : side ? { col: ways.from === 'left' ? -2 : COLS + 1, row: PATH_ROW } : { col: heroStart.col, row: ROWS + 1 };
  const facing = lab ? 'right' : ways.from === 'left' ? 'right' : ways.from === 'right' ? 'left' : 'up';
  cast.hero = actor(hero, { ...(walkIn ? inFrom : heroStart), facing: visit && !walkIn ? 'down' : facing });
  cast.ways = ways;
  const stepsAside = stage === 'rest' && entrance === 'battle' && motion();
  if (zone === 'deal' && walkIn) cast.foe = actor(DEAL_FIGURE, { ...ways.figure, facing: 'down' });
  else if (visit) cast.foe = null;
  else if (foe && stage === 'rest') cast.foe = actor(foe, { col: stepsAside ? ways.upTo : ways.aside, row: MEET_ROW, facing: 'down' });
  else if (foe && lab) cast.foe = actor(foe, { ...LAB_SPOTS.professor, facing: 'left' });
  else if (foe) cast.foe = actor(foe, { col: ways.upTo, row: WAIT_ROW, facing: 'down' });
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

  const mark = async (member, text, ms) => {
    const bubble = document.createElement('span');
    bubble.className = 'tw-exclaim';
    bubble.textContent = text;
    member.el.append(bubble);
    await pause(ms);
    bubble.remove();
  };
  /** A bubble over a tile of the map with no one on it: a door, a burrow. */
  const markTile = async ({ col, row }, text, ms) => {
    const spot = document.createElement('div');
    spot.className = 'tw-actor';
    spot.style.setProperty('--x', String(col));
    spot.style.setProperty('--y', String(row));
    spot.style.zIndex = String(10 + row);
    el.append(spot);
    await mark({ el: spot }, text, ms);
    spot.remove();
  };

  /** What happens at a way with no battle, once you are in: you rest in the Center, something stirs in the burrow, the deal is made. */
  const visitZone = async () => {
    const { hero: walker } = cast;
    if (zone === 'rest') {
      await walker.goTo(ways.spot.col, ways.spot.row, ways.spot.row);
      await walker.walk(ways.door.col, ways.door.row);
      walker.hide(true);
      el.classList.add('healing');
      await markTile(ways.door, '♥', 1100);
      el.classList.remove('healing');
      walker.hide(false);
      await walker.walk(ways.spot.col, ways.spot.row);
      walker.face('down');
    } else if (zone === 'den') {
      await walker.goTo(ways.spot.col, ways.spot.row);
      walker.face(ways.upTo > walker.col ? 'right' : 'left');
      await markTile(ways.door, '…', 700);
      await markTile(ways.door, '!', 700);
    } else if (zone === 'deal') {
      await walker.goTo(ways.spot.col, ways.spot.row);
      walker.face('up');
      if (!cast.foe) return;
      await mark(cast.foe, '…', 900);
      el.classList.add('dealing');
      await pause(900);
      cast.foe.el.classList.add('vanish');
      await pause(700);
      el.classList.remove('dealing');
      cast.foe.el.remove();
      cast.foe = null;
    }
  };

  /** You arrive: up from the bottom edge (into the lab by its door), or as the battle's bars open and the beaten rival steps aside. */
  cast.arrive = async () => {
    if (entrance === 'battle' && motion()) {
      await pause(80);
      el.classList.remove('closing');
      await pause(600);
    }
    if (stepsAside && cast.foe) {
      await mark(cast.foe, '…', 700);
      await cast.foe.walk(ways.aside, MEET_ROW);
      cast.foe.face('down');
    }
    if (!walkIn) return;
    await cast.hero.walk(heroStart.col, heroStart.row);
    cast.hero.face(facing);
    if (visit) await visitZone();
  };
  /** You walk up to the way out: the rival sees you ("!") and comes down to meet you. */
  cast.approach = async () => {
    if (!cast.foe) return;
    if (lab) {
      await cast.hero.walk(LAB_SPOTS.hero.col, LAB_SPOTS.hero.row);
      cast.hero.face('right');
      await mark(cast.foe, '!', 520);
      return;
    }
    await cast.hero.goTo(meet.col, PATH_ROW);
    cast.hero.face('up');
    await mark(cast.foe, '!', 520);
    await cast.foe.walk(meet.col, meet.row);
    cast.foe.face('down');
  };
  /** At a crossroads, you walk to the way you chose and out of the map by it. */
  cast.takeExit = async (index) => {
    if (!fork) return;
    const exit = forkExits(forks)[index];
    if (!exit) return;
    await cast.hero.walk(cast.hero.col, PATH_ROW);
    if (exit.side === 'up') {
      await cast.hero.walk(exit.col, PATH_ROW);
      await cast.hero.walk(exit.col, -2);
    } else await cast.hero.walk(exit.side === 'left' ? -2 : COLS + 1, PATH_ROW);
  };
  /** You leave and the map fades out behind you: up past the beaten rival after a rest, down the burrow of a den, up the lab's stairs to the first floor. */
  cast.leave = async () => {
    if (lab) {
      await cast.hero.goTo(LAB_SPOTS.stairs.col, LAB_SPOTS.stairs.row, LAB_SPOTS.hero.row + 1);
      cast.foe?.face('up');
      cast.hero.hide(true);
      await pause(TILE_MS * 2);
    } else if (zone === 'den') {
      await cast.hero.goTo(ways.upTo, PATH_ROW);
      await cast.hero.walk(ways.door.col, ways.door.row);
      cast.hero.hide(true);
    } else {
      await cast.hero.goTo(ways.upTo, PATH_ROW, cast.hero.row === PATH_ROW + 1 ? PATH_ROW + 1 : PATH_ROW);
      if (cast.foe) cast.foe.face(ways.aside > ways.upTo ? 'left' : 'right');
      await cast.hero.walk(ways.upTo, -2);
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

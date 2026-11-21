// The map of a Tower floor: a low strip of route seen from above, drawn after the battle background
// where the floor is fought (grass, a lake shore, a cave, snow…), with the trainers' overworld sprites
// on it. You walk in from the left to the rival like in the Battle Tower of Emerald: it sees you, says
// its line, and the battle starts. A boss waits at the end on a mat of its type; between floors the
// path forks into the ways you can take.
import { overworldSprite } from './overworld.js?v=dev';

export const COLS = 16;
export const ROWS = 6;
const TILE = 16;
const TILE_MS = 200;
const PATH_ROW = 3;

const FAMILIES = {
  grass: { ground: ['#70c050', '#64b048'], path: ['#e2cf98', '#d4bf86'], edge: 'tree', prop: 'bush', accent: 'tallgrass' },
  path: { ground: ['#8ccc68', '#80c05c'], path: ['#dcc596', '#cdb585'], edge: 'tree', prop: 'bush', accent: 'flower' },
  lake: { ground: ['#78c458', '#6cb64e'], path: ['#e2cf98', '#d4bf86'], edge: 'tree', prop: 'bush', water: 'bottom', accent: 'flower' },
  beach: { ground: ['#f0dc9c', '#e8d090'], path: ['#f8ecc0', '#f0e2b0'], edge: 'palm', prop: 'rock', water: 'top' },
  ocean: { ground: ['#4c94e0', '#4488d4'], path: ['#b88450', '#a87444'], edge: 'buoy', prop: 'buoy', water: 'all' },
  underwater: { ground: ['#2c5c9c', '#285490'], path: ['#c8b888', '#b8a878'], edge: 'coral', prop: 'weed' },
  mountain: { ground: ['#b89c78', '#ac9070'], path: ['#d8c4a0', '#ccb894'], edge: 'boulder', prop: 'rock', cliff: '#7c6450' },
  desert: { ground: ['#ecca7c', '#e2be70'], path: ['#f4dca0', '#ecd294'], edge: 'cactus', prop: 'rock' },
  cave: { ground: ['#7a6a5c', '#706052'], path: ['#9a8a78', '#8e7e6c'], edge: 'stalagmite', prop: 'rock', walls: '#3c322c' },
  snow: { ground: ['#f2f6fc', '#e6eef8'], path: ['#c8d8ea', '#bccee2'], edge: 'pine', prop: 'snowrock' },
  lab: { ground: ['#ece4d4', '#e2d8c6'], path: ['#d8e4f0', '#ccdaea'], edge: 'machine', prop: 'table', walls: '#9aa6b8', indoor: true },
};

const TYPE_MATS = {
  normal: '#b8b090', fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030', ice: '#98d8d8', fighting: '#c03028', poison: '#a040a0', ground: '#e0c068',
  flying: '#a890f0', psychic: '#f85888', bug: '#a8b820', rock: '#b8a038', ghost: '#705898', dragon: '#7038f8', dark: '#705848', steel: '#b8b8d0', fairy: '#ee99ac',
};

const familyOf = (scene) => {
  const base = String(scene ?? '').replace(/-(2|night)$/, '');
  return FAMILIES[{ 'tall-grass': 'grass' }[base] ?? base] ?? FAMILIES.path;
};

function seeded(text) {
  let state = 2166136261;
  for (const char of String(text)) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function rect(ctx, color, x, y, width = TILE, height = TILE) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, width, height);
}

const PROPS = {
  tree(ctx, x, y) {
    rect(ctx, '#5a3e22', x + 6, y + 11, 4, 5);
    rect(ctx, '#245e28', x, y + 1, 16, 11);
    rect(ctx, '#2f7a32', x + 1, y, 14, 10);
    rect(ctx, '#3e9a40', x + 3, y + 2, 9, 5);
    rect(ctx, '#62c060', x + 4, y + 2, 4, 2);
  },
  palm(ctx, x, y) {
    rect(ctx, '#9a7040', x + 7, y + 6, 2, 10);
    rect(ctx, '#3c9a48', x + 1, y + 2, 14, 4);
    rect(ctx, '#3c9a48', x + 5, y, 6, 8);
    rect(ctx, '#5cc068', x + 3, y + 3, 4, 2);
  },
  pine(ctx, x, y) {
    rect(ctx, '#5a3e22', x + 7, y + 13, 2, 3);
    rect(ctx, '#245a44', x + 2, y + 8, 12, 5);
    rect(ctx, '#2a6a4a', x + 4, y + 3, 8, 6);
    rect(ctx, '#2a6a4a', x + 6, y, 4, 4);
    rect(ctx, '#ffffff', x + 6, y, 4, 2);
    rect(ctx, '#ffffff', x + 4, y + 3, 3, 2);
    rect(ctx, '#ffffff', x + 2, y + 8, 4, 2);
  },
  bush(ctx, x, y) {
    rect(ctx, '#2f7a32', x + 2, y + 6, 12, 9);
    rect(ctx, '#4ea84e', x + 4, y + 7, 6, 4);
    rect(ctx, '#e85868', x + 9, y + 9, 2, 2);
  },
  rock(ctx, x, y) {
    rect(ctx, '#6c645a', x + 3, y + 9, 10, 6);
    rect(ctx, '#8c8478', x + 3, y + 8, 9, 5);
    rect(ctx, '#b0a898', x + 5, y + 9, 4, 2);
  },
  snowrock(ctx, x, y) {
    PROPS.rock(ctx, x, y);
    rect(ctx, '#ffffff', x + 3, y + 8, 9, 2);
  },
  boulder(ctx, x, y) {
    rect(ctx, '#5c4c3c', x, y + 3, 16, 13);
    rect(ctx, '#7c6a58', x + 1, y + 2, 14, 11);
    rect(ctx, '#9c8870', x + 3, y + 3, 7, 4);
  },
  cactus(ctx, x, y) {
    rect(ctx, '#2c7c38', x + 6, y + 2, 4, 14);
    rect(ctx, '#2c7c38', x + 2, y + 6, 4, 2);
    rect(ctx, '#2c7c38', x + 2, y + 3, 2, 5);
    rect(ctx, '#2c7c38', x + 10, y + 8, 4, 2);
    rect(ctx, '#2c7c38', x + 12, y + 5, 2, 5);
    rect(ctx, '#5cb068', x + 7, y + 3, 1, 11);
  },
  stalagmite(ctx, x, y) {
    rect(ctx, '#4a3c34', x + 4, y + 4, 8, 12);
    rect(ctx, '#5a4a40', x + 6, y, 4, 4);
    rect(ctx, '#7a6a5c', x + 6, y + 5, 2, 9);
  },
  coral(ctx, x, y) {
    rect(ctx, '#e86878', x + 3, y + 6, 2, 10);
    rect(ctx, '#e86878', x + 7, y + 3, 2, 13);
    rect(ctx, '#e86878', x + 11, y + 7, 2, 9);
    rect(ctx, '#f898a8', x + 5, y + 8, 2, 2);
  },
  weed(ctx, x, y) {
    rect(ctx, '#2c8c5c', x + 4, y + 3, 2, 12);
    rect(ctx, '#3cac6c', x + 10, y + 5, 2, 10);
  },
  buoy(ctx, x, y) {
    rect(ctx, '#e84848', x + 5, y + 5, 6, 6);
    rect(ctx, '#ffffff', x + 5, y + 7, 6, 2);
  },
  machine(ctx, x, y) {
    rect(ctx, '#56647a', x, y + 1, 16, 15);
    rect(ctx, '#9ad0f0', x + 2, y + 3, 12, 6);
    rect(ctx, '#48d080', x + 3, y + 11, 2, 2);
    rect(ctx, '#f8d030', x + 7, y + 11, 2, 2);
  },
  table(ctx, x, y) {
    rect(ctx, '#a07850', x + 1, y + 5, 14, 7);
    rect(ctx, '#c09870', x + 1, y + 5, 14, 2);
    rect(ctx, '#e85868', x + 4, y + 3, 3, 3);
  },
  tallgrass(ctx, x, y) {
    for (const [dx, dy] of [[2, 6], [7, 3], [11, 8], [4, 11], [10, 12]]) {
      rect(ctx, '#3c9030', x + dx, y + dy, 2, 3);
      rect(ctx, '#3c9030', x + dx + 2, y + dy - 1, 1, 3);
    }
  },
  flower(ctx, x, y) {
    rect(ctx, '#f8f8f8', x + 4, y + 4, 2, 2);
    rect(ctx, '#f85888', x + 10, y + 9, 2, 2);
    rect(ctx, '#f8d030', x + 6, y + 11, 2, 2);
  },
};

/** Rows where the path ends on the right when it forks into `count` ways. */
export const exitRows = (count) => (count <= 1 ? [PATH_ROW] : count === 2 ? [1, 4] : [0, 2, 4]);
const FORK_COL = 9;

function pathTiles(forks) {
  const tiles = new Set();
  const add = (col, row) => tiles.add(`${col}:${row}`);
  const end = forks ? FORK_COL : COLS - 1;
  for (let col = 0; col <= end; col++) [PATH_ROW - 1, PATH_ROW].forEach((row) => add(col, row));
  if (forks) {
    const rows = exitRows(forks).map((row) => Math.min(ROWS - 2, row + 1));
    const top = Math.min(...rows, PATH_ROW - 1);
    const bottom = Math.max(...rows, PATH_ROW);
    for (let row = top; row <= bottom; row++) [FORK_COL, FORK_COL + 1].forEach((col) => add(col, row));
    for (const row of rows) for (let col = FORK_COL; col < COLS; col++) add(col, row);
  }
  return tiles;
}

function drawMap(canvas, { scene, seed, mat = null, forks = 0 }) {
  const family = familyOf(scene);
  const night = /-night$/.test(scene ?? '');
  const random = seeded(`${scene}:${seed}`);
  const ctx = canvas.getContext('2d');
  const onPath = pathTiles(forks);
  const water = (col, row) =>
    family.water === 'all' ? !onPath.has(`${col}:${row}`) : family.water === 'bottom' ? row === ROWS - 1 : family.water === 'top' ? row === 0 && !onPath.has(`${col}:${row}`) : false;
  const wall = (row) => !!family.walls && (row === 0 || (!family.indoor && row === ROWS - 1));
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const [x, y] = [col * TILE, row * TILE];
      const checker = (col + row) % 2;
      if (water(col, row)) {
        rect(ctx, checker ? '#4c94e0' : '#4488d4', x, y);
        if (random() < 0.35) rect(ctx, '#a8d0f8', x + 3 + Math.floor(random() * 8), y + 5 + Math.floor(random() * 6), 4, 1);
        if (family.water === 'bottom' && row === ROWS - 1) rect(ctx, '#d8f0ff', x, y, TILE, 2);
        continue;
      }
      if (wall(row)) {
        rect(ctx, family.walls, x, y);
        rect(ctx, 'rgb(0 0 0 / .25)', x, y + (row ? 0 : TILE - 3), TILE, 3);
        if (family.indoor && col % 4 === 1) rect(ctx, '#c8e0f8', x + 2, y + 3, 12, 7);
        continue;
      }
      const path = onPath.has(`${col}:${row}`);
      rect(ctx, (path ? family.path : family.ground)[checker], x, y);
      if (path && !family.indoor && random() < 0.18) rect(ctx, 'rgb(0 0 0 / .06)', x + 2 + Math.floor(random() * 10), y + 2 + Math.floor(random() * 10), 3, 2);
      if (!path && family.accent && random() < 0.3) PROPS[family.accent](ctx, x, y);
    }
  if (family.cliff) for (let col = 0; col < COLS; col++) if (!onPath.has(`${col}:0`)) { rect(ctx, family.cliff, col * TILE, 0, TILE, 9); rect(ctx, 'rgb(0 0 0 / .2)', col * TILE, 9, TILE, 2); }
  if (mat) {
    const [left, top, width, height] = [11, 1, 4, 4];
    rect(ctx, '#2e2a40', left * TILE - 2, top * TILE - 2, width * TILE + 4, height * TILE + 4);
    rect(ctx, mat, left * TILE, top * TILE, width * TILE, height * TILE);
    rect(ctx, 'rgb(255 255 255 / .35)', left * TILE + 4, top * TILE + 4, width * TILE - 8, 2);
    rect(ctx, 'rgb(255 255 255 / .35)', left * TILE + 4, (top + height) * TILE - 6, width * TILE - 8, 2);
  }
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      if (onPath.has(`${col}:${row}`) || water(col, row) || wall(row)) continue;
      if (mat && col >= 11 && row >= 1 && row <= 4) continue;
      const edge = row === 0 || row === ROWS - 1;
      const nextToPath = onPath.has(`${col}:${row - 1}`) || onPath.has(`${col}:${row + 1}`);
      const chance = edge ? 0.85 : nextToPath ? 0.12 : 0.3;
      if (random() < chance) PROPS[edge ? family.edge : family.prop](ctx, col * TILE, row * TILE);
    }
  if (night) {
    ctx.fillStyle = 'rgb(24 28 72 / .42)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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
  self.walk = (toCol, toRow) => {
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
  return self;
}

/**
 * The map element and its cast. `hero` and `foe` are trainer keys (the foe may be absent);
 * `stage` is 'arrive' (you at the left, the rival waiting at the right), 'rest' (the beaten rival
 * stepped aside) or 'fork' (no rival, the path splits into `forks` ways at the right). A `compact`
 * map shows only the rows around the path.
 */
export function towerMap({ scene, seed, hero, foe = null, boss = false, type = null, stage = 'arrive', forks = 0, label = '', compact = false }) {
  const canvas = document.createElement('canvas');
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  canvas.className = 'tw-map-canvas';
  drawMap(canvas, { scene, seed, mat: boss ? (TYPE_MATS[type] ?? '#c8b8f0') : null, forks: stage === 'fork' ? forks : 0 });
  const el = document.createElement('div');
  el.className = `tw-map${boss ? ' boss' : ''}${compact ? ' compact' : ''}`;
  el.style.setProperty('--cols', String(COLS));
  el.style.setProperty('--rows', String(ROWS));
  el.setAttribute('role', 'img');
  el.setAttribute('aria-label', label);
  el.append(canvas);
  const foeSpot = { col: boss ? 13 : 12, row: PATH_ROW };
  const cast = { el, hero: null, foe: null };
  if (stage === 'rest') {
    cast.hero = actor(hero, { col: 9, row: PATH_ROW, facing: 'right' });
    if (foe) cast.foe = actor(foe, { col: 11, row: PATH_ROW - 1, facing: 'down' });
  } else if (stage === 'fork') cast.hero = actor(hero, { col: 4, row: PATH_ROW, facing: 'right' });
  else {
    cast.hero = actor(hero, { col: 1, row: PATH_ROW, facing: 'right' });
    if (foe) cast.foe = actor(foe, { ...foeSpot, facing: 'left' });
  }
  for (const member of [cast.foe, cast.hero]) if (member) el.append(member.el);

  /** You walk up to the rival, it sees you ("!") and turns to you. */
  cast.approach = async () => {
    if (!cast.foe) return;
    await cast.hero.walk(foeSpot.col - 2, PATH_ROW);
    const mark = document.createElement('span');
    mark.className = 'tw-exclaim';
    mark.textContent = '!';
    cast.foe.el.append(mark);
    await new Promise((resolve) => setTimeout(resolve, 520));
    mark.remove();
  };
  /** At a fork, you walk to the way you chose and out of the map. */
  cast.takeExit = async (index) => {
    if (!cast.hero || stage !== 'fork') return;
    const row = Math.min(ROWS - 2, exitRows(forks)[index] + 1);
    await cast.hero.walk(FORK_COL, PATH_ROW);
    await cast.hero.walk(FORK_COL, row);
    await cast.hero.walk(COLS, row);
  };
  /** The screen closes in bars, like the start of a battle. */
  cast.closeIn = () => {
    el.classList.add('closing');
    return new Promise((resolve) => setTimeout(resolve, 700));
  };
  return cast;
}

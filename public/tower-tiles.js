// The tiles of the Tower's maps and how each floor's map is laid out, with no DOM so the install
// script and the tests can use it. The tiles are 16×16 metatiles of Pokémon Emerald's tilesets
// (pret/pokeemerald): scripts/sync-tilesets.js renders the ones listed here into one atlas at install,
// public/tiles/tower.png, which is not versioned (like the sprites). Each map is our own layout, built
// the way the games build a route: a tree border, a path or a strip of sand, tall grass, ledges and
// rocks, and a scene of the battle background that comes next (grass, a lake, a beach, a cave, snow…).
// You climb the Tower going up: a floor where the way splits is a crossroads you reach from below, with
// ways to the left, to the right and one to three up; the path of a floor can also open below (you came
// up into it) or above (you go up from it).
// A key is a metatile id of the General tileset, or of Cave or Lab (Building) in the high bits.

export const COLS = 16;
export const ROWS = 7;
export const TILE = 16;
export const PATH_ROW = 3;
/** Where a crossroads meets the way you came up by. */
export const CROSS_COL = 8;

const CAVE = 0x1000;
const LAB = 0x2000;

/** The tilesets a key belongs to, as scripts/sync-tilesets.js reads them. */
export const TILESETS = {
  0: { primary: 'primary/general', secondary: null },
  [CAVE]: { primary: 'primary/general', secondary: 'secondary/cave' },
  [LAB]: { primary: 'primary/building', secondary: 'secondary/lab' },
};
export const tilesetOf = (key) => key & 0xf000;
export const metatileOf = (key) => key & 0x0fff;

/** A 3×3 set: corners, edges and middle of a patch, in reading order. */
const patch = (ids) => ({ tl: ids[0], t: ids[1], tr: ids[2], l: ids[3], c: ids[4], r: ids[5], bl: ids[6], b: ids[7], br: ids[8] });

export const T = {
  grass: 0x001,
  tall: 0x00d,
  flowers: 0x004,
  sign: 0x003,
  forestTrunks: [0x1e4, 0x1e5],
  forestCanopy: [0x1d4, 0x1d5],
  treeBottom: [0x1dc, 0x1dd],
  smallTree: [0x00e, 0x016],
  ledge: [0x0d5, 0x087, 0x0d6],
  dirt: patch([0x118, 0x119, 0x11a, 0x120, 0x121, 0x122, 0x128, 0x129, 0x12a]),
  sand: 0x121,
  sea: 0x170,
  shore: patch([0x11b, 0x11c, 0x11d, 0x123, 0x124, 0x125, 0x12b, 0x12c, 0x12d]),
  seaRock: [[0x175, 0x176], [0x17d, 0x17e]],
  seaBush: 0x193,
  pond: patch([0x0c8, 0x0c9, 0x0ca, 0x0d0, 0x0d1, 0x0d2, 0x0d8, 0x0d9, 0x0da]),
  rock: 0x0e2,
  moundOnSand: [[0x080, 0x081, 0x082], [0x088, 0x089, 0x08a], [0x090, 0x091, 0x092]],
  moundOnGrass: [[0x068, 0x069, 0x06a], [0x070, 0x071, 0x072], [0x078, 0x079, 0x07a]],
  caveFloor: [CAVE | 0x211, CAVE | 0x201],
  caveBoulder: [CAVE | 0x202, CAVE | 0x203],
  caveWall: [[CAVE | 0x208, CAVE | 0x209, CAVE | 0x20a, CAVE | 0x20b], [CAVE | 0x210, CAVE | 0x211, CAVE | 0x212, CAVE | 0x213]],
  caveEdge: CAVE | 0x219,
  caveBottom: [CAVE | 0x220, CAVE | 0x221, CAVE | 0x222, CAVE | 0x223],
  caveHole: [CAVE | 0x20c, CAVE | 0x214],
  labWall: [
    [0x210, 0x211, 0x208, 0x212, 0x213, 0x208, 0x208, 0x209, 0x209, 0x208, 0x208, 0x208, 0x208, 0x208, 0x208, 0x208],
    [0x218, 0x219, 0x23c, 0x21a, 0x21b, 0x20a, 0x20b, 0x20c, 0x20d, 0x20e, 0x20a, 0x20a, 0x20a, 0x20a, 0x20a, 0x20a],
    [0x220, 0x221, 0x244, 0x222, 0x223, 0x23e, 0x222, 0x233, 0x222, 0x233, 0x23e, 0x29a, 0x29a, 0x23e, 0x23e, 0x23e],
  ].map((row) => row.map((id) => LAB | id)),
  labFloor: LAB | 0x202,
  labMachine: [[0x214, 0x215, 0x216], [0x21c, 0x21d, 0x21e]].map((row) => row.map((id) => LAB | id)),
  labPlant: [LAB | 0x226, LAB | 0x22e],
  labShelf: [[0x224, 0x225], [0x22c, 0x22d], [0x234, 0x235]].map((row) => row.map((id) => LAB | id)),
  labMat: [LAB | 0x206, LAB | 0x207],
};

/** Every key a map can use: the atlas holds these, in this order. */
export const ATLAS_KEYS = [...new Set(Object.values(T).flatMap((value) => (typeof value === 'number' ? [value] : Object.values(value).flat(2))))];
export const ATLAS_COLS = 16;

/** The columns of the ways that leave a crossroads upwards, by how many there are. */
const UP_COLS = { 1: [CROSS_COL], 2: [5, 11], 3: [4, CROSS_COL, 12] };
/** Half the width of a way that leaves the map up or down: three tiles, like the band it meets. */
const WAY_HALF = 1;

/**
 * Where each way leaves a crossroads, in the order the ways are offered: up the middle first (the
 * plain route), then left and right, then the other ways up. Every exit is on the map's edge.
 */
export function forkExits(count) {
  const sides = count >= 2 ? [{ side: 'left', col: 0, row: PATH_ROW }, { side: 'right', col: COLS - 1, row: PATH_ROW }] : [];
  const ups = (UP_COLS[count - sides.length] ?? []).map((col) => ({ side: 'up', col, row: 0 }));
  const middle = ups.length % 2 ? ups.splice(Math.floor(ups.length / 2), 1) : [];
  return [...middle, ...sides, ...ups];
}

/**
 * How a floor's map is crossed: you come up into it from below at `from` and go up out of it at
 * `upTo`, where the rival waits; once beaten it steps aside to `aside`, off the way up.
 */
export function floorWays(seed) {
  const random = seeded(`${seed}:ways`);
  const low = 3 + Math.floor(random() * 4);
  const high = 9 + Math.floor(random() * 4);
  const straight = random() < 0.3;
  const leftFirst = random() < 0.5;
  const from = leftFirst ? low : high;
  const upTo = straight ? from : leftFirst ? high : low;
  return { from, upTo, aside: upTo + (upTo <= CROSS_COL ? 1 : -1) };
}

/** The openings of a map's path: columns that go down off its bottom edge and up off its top one, and the sides it leaves by. */
export function openingsOf({ forks = 0, from = null, upTo = null }) {
  const exits = forks ? forkExits(forks) : [];
  const up = forks ? exits.filter((exit) => exit.side === 'up').map((exit) => exit.col) : upTo != null ? [upTo] : [];
  const down = forks ? [CROSS_COL] : from != null ? [from] : [];
  return { up, down, left: exits.some((exit) => exit.side === 'left'), right: exits.some((exit) => exit.side === 'right') };
}

/** What a battle background looks like on the map: its layout and the colours it is repainted with. */
export function sceneLook(scene) {
  const name = String(scene ?? 'path');
  const night = name.endsWith('-night');
  const base = name.replace(/-(2|night)$/, '');
  const second = name.endsWith('-2');
  const family = { 'tall-grass': 'tallGrass', path: 'path', lake: 'lake', beach: 'beach', ocean: 'ocean', underwater: 'ocean', mountain: 'mountain', desert: 'desert', cave: 'cave', snow: 'snow', lab: 'lab' }[base] ?? 'path';
  const tint = base === 'underwater' ? 'deep' : base === 'snow' ? 'snow' : base === 'mountain' ? (second ? 'grey' : 'earth') : second ? { path: 'autumn', beach: 'sunset', cave: 'blue' }[base] ?? null : null;
  return { family, tints: [tint, night ? 'night' : null].filter(Boolean) };
}

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

/**
 * The cells you can walk on: a band three tiles tall along the path, from the first way to the last
 * (or to the edge where a way leaves by a side), and a strip three tiles wide from the band to each
 * opening above and below.
 */
function wayCells({ up, down, left, right }) {
  const cells = new Set();
  const add = (row, col) => { if (row >= 0 && row < ROWS && col >= 0 && col < COLS) cells.add(row * COLS + col); };
  const cols = [...up, ...down];
  const first = left ? 0 : Math.min(...cols) - WAY_HALF;
  const last = right ? COLS - 1 : Math.max(...cols) + WAY_HALF;
  for (let row = PATH_ROW - 1; row <= PATH_ROW + 1; row++) for (let col = first; col <= last; col++) add(row, col);
  for (const col of up) for (let row = 0; row < PATH_ROW; row++) for (let c = col - WAY_HALF; c <= col + WAY_HALF; c++) add(row, c);
  for (const col of down) for (let row = PATH_ROW + 1; row < ROWS; row++) for (let c = col - WAY_HALF; c <= col + WAY_HALF; c++) add(row, c);
  return cells;
}

/**
 * The map of a floor as rows of keys. The way runs from where you come in to where you leave: up
 * from below at `from` and out the top at `upTo` on a floor, or at a crossroads from below to `forks`
 * ways (up, left and right). A side with no way out is closed with trees, rocks or water, and the way
 * has the edges of the ground it is laid on.
 */
export function mapLayout({ scene, seed, forks = 0, from = null, upTo = null }) {
  const { family } = sceneLook(scene);
  const openings = openingsOf({ forks, from, upTo });
  if (family === 'lab') return drawLab();
  return drawScene(family, scene, seed, openings);
}

function drawLab() {
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(T.labFloor));
  T.labWall.forEach((row, r) => row.forEach((key, col) => { grid[r][col] = key; }));
  T.labMachine.forEach((row, r) => row.forEach((key, c) => { grid[4 + r][13 + c] = key; }));
  T.labShelf.forEach((row, r) => row.forEach((key, c) => { grid[4 + r][c] = key; }));
  grid[5][6] = T.labPlant[0];
  grid[6][6] = T.labPlant[1];
  grid[6][8] = T.labMat[0];
  grid[6][9] = T.labMat[1];
  return grid;
}

/** The key of a patch for a cell of a region, by which of its four neighbours are in it. */
function patchKey(piece, inside, row, col) {
  const v = !inside(row - 1, col) ? 't' : !inside(row + 1, col) ? 'b' : '';
  const h = !inside(row, col - 1) ? 'l' : !inside(row, col + 1) ? 'r' : '';
  return piece[`${v}${h}`] ?? piece[v || h] ?? piece.c;
}

function drawScene(family, scene, seed, openings) {
  const { up, down, left, right } = openings;
  const random = seeded(`${scene}:${seed}`);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(T.grass));
  const inMap = (row, col) => row >= 0 && row < ROWS && col >= 0 && col < COLS;
  const set = (row, col, key) => { if (inMap(row, col)) grid[row][col] = key; };
  const way = wayCells(openings);
  const onWay = (row, col) => way.has(Math.max(0, Math.min(ROWS - 1, row)) * COLS + Math.max(0, Math.min(COLS - 1, col)));
  const taken = new Set(way);
  const free = (row, col) => inMap(row, col) && !taken.has(row * COLS + col);
  const take = (row, col, key) => { if (!free(row, col)) return false; set(row, col, key); taken.add(row * COLS + col); return true; };
  const paintWay = (piece) => { for (const cell of way) set(Math.floor(cell / COLS), cell % COLS, patchKey(piece, onWay, Math.floor(cell / COLS), cell % COLS)); };
  const sprinkle = (key, chance, rows) => { for (const row of rows) for (let col = 0; col < COLS; col++) if (free(row, col) && random() < chance) take(row, col, key); };
  const clusters = (key, count, rows) => {
    for (let n = 0; n < count; n++) {
      const row = rows[Math.floor(random() * rows.length)];
      const col = Math.floor(random() * COLS);
      const width = 2 + Math.floor(random() * 4);
      const height = 1 + Math.floor(random() * 2);
      for (let r = row; r < row + height; r++) for (let c = col; c < col + width; c++) if (rows.includes(r)) take(r, c, key);
    }
  };
  /** Whole objects of `width` tiles along a row, restarted after each gap so none is cut in half; a lone tile left over gets `single`. */
  const rowOfWhole = (row, width, pieceAt, single) => {
    for (let col = 0; col < COLS; ) {
      if (!free(row, col)) { col++; continue; }
      let span = 0;
      while (free(row, col + span)) span++;
      const whole = span - (span % width);
      for (let at = 0; at < span; at++) set(row, col + at, at < whole ? pieceAt(at % width) : single);
      for (let at = 0; at < span; at++) taken.add(row * COLS + col + at);
      col += span;
    }
  };
  const sideCols = [...(left ? [] : [0, 1]), ...(right ? [] : [COLS - 2, COLS - 1])];

  if (family === 'cave') {
    grid.forEach((row) => row.fill(T.caveFloor[0]));
    for (const col of up) { set(0, col, T.caveHole[0]); set(1, col, T.caveHole[1]); }
    for (const cell of [...way]) if (Math.floor(cell / COLS) < 2 && !up.includes(cell % COLS)) { way.delete(cell); taken.delete(cell); }
    for (const col of up) for (const row of [0, 1]) taken.add(row * COLS + col);
    for (let col = 0; col < COLS; col++) {
      take(0, col, T.caveWall[1][col % 4]);
      take(1, col, T.caveEdge);
      take(ROWS - 1, col, T.caveBottom[col % 4]);
    }
    for (const col of sideCols) for (let row = 2; row < ROWS - 1; row++) take(row, col, T.caveBoulder[(row + col) % 2]);
    sprinkle(T.caveFloor[1], 0.25, [2, 3, 4, 5]);
    sprinkle(T.caveBoulder[0], 0.1, [2, 4, 5]);
    sprinkle(T.caveBoulder[1], 0.06, [2, 4, 5]);
    return grid;
  }
  if (family === 'beach' || family === 'ocean') {
    const [top, bottom] = family === 'ocean' ? [PATH_ROW - 1, PATH_ROW + 1] : [PATH_ROW - 1, PATH_ROW];
    grid.forEach((cells, row) => cells.fill(family === 'beach' && row > bottom ? T.grass : T.sea));
    const sand = new Set();
    for (let row = top; row <= bottom; row++) for (let col = 0; col < COLS; col++) sand.add(row * COLS + col);
    const onDownWay = (col) => down.some((way) => Math.abs(way - col) <= WAY_HALF);
    for (const cell of way) if (family === 'ocean' || Math.floor(cell / COLS) <= bottom || onDownWay(cell % COLS)) sand.add(cell);
    const kind = (row, col) => {
      if (!inMap(row, col)) return 'edge';
      if (sand.has(row * COLS + col)) return 'sand';
      return grid[row][col] === T.sea ? 'sea' : 'land';
    };
    const isSand = (row, col) => {
      const at = kind(row, col);
      return at === 'sand' || (at === 'edge' && kind(Math.max(0, Math.min(ROWS - 1, row)), Math.max(0, Math.min(COLS - 1, col))) === 'sand');
    };
    for (const cell of sand) {
      const row = Math.floor(cell / COLS);
      const col = cell % COLS;
      const sides = [[row - 1, col, 't'], [row + 1, col, 'b'], [row, col - 1, 'l'], [row, col + 1, 'r']].filter(([r, c]) => !isSand(r, c));
      const wet = sides.some(([r, c]) => kind(r, c) === 'sea');
      const piece = wet ? T.shore : T.dirt;
      set(row, col, patchKey(piece, isSand, row, col));
    }
    const seaRows = family === 'ocean' ? [[0, 1], [ROWS - 2, ROWS - 1]] : [[0, 1]];
    for (const [first, second] of seaRows)
      for (let col = Math.floor(random() * 3); col < COLS - 1; col += 3 + Math.floor(random() * 3)) {
        if (![first, second].every((row) => free(row, col) && free(row, col + 1))) continue;
        if (random() < 0.7) T.seaRock.forEach((pair, r) => pair.forEach((key, c) => take(first + r, col + c, key)));
        else take(random() < 0.5 ? first : second, col, T.seaBush);
      }
    sprinkle(T.seaBush, 0.05, family === 'ocean' ? [0, 1, ROWS - 2, ROWS - 1] : [0, 1]);
    sprinkle(T.rock, 0.12, [top, bottom]);
    if (family === 'beach') {
      for (const col of sideCols) {
        const half = col === 0 || col === COLS - 2 ? 0 : 1;
        for (let row = bottom + 1; row < ROWS; row++) take(row, col, (row - bottom) % 2 ? T.forestCanopy[half] : T.treeBottom[half]);
      }
      rowOfWhole(ROWS - 1, 2, (at) => T.forestCanopy[at], T.smallTree[0]);
      clusters(T.tall, 2, [bottom + 1, bottom + 2]);
      sprinkle(T.flowers, 0.15, [bottom + 1, bottom + 2]);
      const signCol = down[0] + WAY_HALF + 1;
      if (free(bottom + 1, signCol)) take(bottom + 1, signCol, T.sign);
    }
    for (const col of [left ? null : 0, right ? null : COLS - 1]) if (col !== null) for (let row = top; row <= bottom; row++) take(row, col, T.rock);
    return grid;
  }
  if (family === 'desert' || family === 'mountain') {
    grid.forEach((row) => row.fill(T.sand));
    for (const col of sideCols) for (let row = 2; row < ROWS - 1; row++) take(row, col, T.rock);
    rowOfWhole(0, 3, (at) => T.moundOnSand[1][at], T.rock);
    rowOfWhole(1, 3, (at) => T.moundOnSand[2][at], T.sand);
    rowOfWhole(ROWS - 1, 3, (at) => T.moundOnSand[0][at], T.rock);
    sprinkle(T.rock, 0.1, [2, 4, 5]);
    return grid;
  }

  if (family === 'path') paintWay(T.dirt);
  if (family === 'lake') {
    const span = [...down].flatMap((col) => [col - WAY_HALF - 1, col + WAY_HALF + 1]);
    const toRight = down[0] <= CROSS_COL;
    const [start, end] = toRight ? [span[1] + 1, right ? COLS - 1 : COLS - 3] : [left ? 0 : 2, span[0] - 1];
    if (end - start >= 2) {
      for (let col = start; col <= end; col++) {
        take(ROWS - 2, col, col === start ? T.pond.tl : col === end ? T.pond.tr : T.pond.t);
        take(ROWS - 1, col, col === start ? T.pond.l : col === end ? T.pond.r : T.pond.c);
      }
    }
  }
  for (const col of sideCols) {
    const half = col === 0 || col === COLS - 2 ? 0 : 1;
    for (let row = 1; row < ROWS; row++) take(row, col, row % 2 ? T.forestCanopy[half] : T.treeBottom[half]);
  }
  rowOfWhole(0, 2, (at) => T.forestTrunks[at], T.smallTree[1]);
  rowOfWhole(ROWS - 1, 2, (at) => T.forestCanopy[at], T.smallTree[0]);
  if (family === 'tallGrass') clusters(T.tall, 9, [1, 2, 4, 5]);
  else {
    clusters(T.tall, family === 'snow' ? 2 : 3, family === 'lake' ? [1] : [1, 4, 5]);
    sprinkle(T.flowers, 0.1, family === 'lake' ? [1, 2] : [1, 2, 4, 5]);
  }
  const signCol = down[0] + WAY_HALF + 1;
  if (family !== 'tallGrass' && free(ROWS - 2, signCol)) take(ROWS - 2, signCol, T.sign);
  return grid;
}

const clamp = (value) => Math.max(0, Math.min(255, Math.round(value)));

function hsl(r, g, b) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const light = (max + min) / 2;
  if (max === min) return [0, 0, light];
  const d = max - min;
  const sat = light > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [hue * 60, sat, light];
}

function rgb(hue, sat, light) {
  if (!sat) return [light * 255, light * 255, light * 255];
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (t) => {
    const u = (t + 1) % 1;
    return 255 * (u < 1 / 6 ? p + (q - p) * 6 * u : u < 1 / 2 ? q : u < 2 / 3 ? p + (q - p) * (2 / 3 - u) * 6 : p);
  };
  return [channel(hue / 360 + 1 / 3), channel(hue / 360), channel(hue / 360 - 1 / 3)];
}

/** Repaints one colour for a scene, colour by colour, so the pixel art keeps its hard edges. */
const TINTS = {
  night: (r, g, b) => [r * 0.46 + 22, g * 0.5 + 26, b * 0.68 + 70],
  sunset: (r, g, b) => [r * 1.02 + 18, g * 0.86 + 6, b * 0.7],
  deep: (r, g, b) => [r * 0.45, g * 0.7 + 8, b * 0.85 + 20],
  autumn: (r, g, b) => {
    const [hue, sat, light] = hsl(r, g, b);
    return hue > 70 && hue < 175 && sat > 0.15 ? rgb(38 + (hue - 70) * 0.12, sat * 0.75, light * 0.95) : [r, g, b];
  },
  snow: (r, g, b) => {
    const [hue, sat, light] = hsl(r, g, b);
    return (hue > 70 && hue < 175 && sat > 0.12) || (hue > 25 && hue < 60 && sat > 0.2) ? rgb(205, 0.35, 0.62 + light * 0.36) : [r, g, b];
  },
  earth: (r, g, b) => {
    const [hue, sat, light] = hsl(r, g, b);
    return hue > 25 && hue < 60 && sat > 0.2 ? rgb(30, sat * 0.55, light * 0.86) : [r, g, b];
  },
  grey: (r, g, b) => {
    const [hue, sat, light] = hsl(r, g, b);
    return (hue < 60 || hue > 330) && sat > 0.1 ? rgb(220, 0.1, light * 0.95) : [r, g, b];
  },
  blue: (r, g, b) => {
    const [hue, sat, light] = hsl(r, g, b);
    return hue < 60 && sat > 0.05 ? rgb(225, sat * 0.6, light) : [r, g, b];
  },
};

/** Repaints RGBA pixels in place with a scene's tints, caching each colour's result. */
export function tintPixels(data, tints) {
  if (!tints.length) return data;
  const memo = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    let color = memo.get(key);
    if (!color) {
      color = tints.reduce((current, tint) => TINTS[tint](...current), [data[i], data[i + 1], data[i + 2]]).map(clamp);
      memo.set(key, color);
    }
    [data[i], data[i + 1], data[i + 2]] = color;
  }
  return data;
}

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
  ledge: [0x0d5, 0x087, 0x0d6],
  dirt: patch([0x118, 0x119, 0x11a, 0x120, 0x121, 0x122, 0x128, 0x129, 0x12a]),
  sand: 0x121,
  sea: 0x170,
  shore: patch([0x11b, 0x11c, 0x11d, 0x123, 0x124, 0x125, 0x12b, 0x12c, 0x12d]),
  seaRock: [[0x175, 0x176], [0x17d, 0x17e]],
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

/** The openings of a map's path: columns that go down off its bottom edge and up off its top one. */
export function openingsOf({ forks = 0, from = null, upTo = null }) {
  const up = forks ? forkExits(forks).filter((exit) => exit.side === 'up').map((exit) => exit.col) : upTo != null ? [upTo] : [];
  const down = forks ? [CROSS_COL] : from != null ? [from] : [];
  return { up, down };
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

/** What you walk on in each kind of scene, where a way is cut through it. */
const FLOOR = { path: T.dirt.c, cave: T.caveFloor[0], beach: T.sand, ocean: T.sand, desert: T.sand, mountain: T.sand };

/**
 * The map of a floor as rows of keys. The path crosses it from side to side; `forks` ways also leave
 * it upwards and you come up into it from below (a crossroads), `from` is a column where you came up
 * from below and `upTo` one where you go up. The path, its openings and where the trainers stand are
 * always walkable.
 */
export function mapLayout({ scene, seed, forks = 0, foeCol = 12, from = null, upTo = null }) {
  const { family } = sceneLook(scene);
  const grid = drawScene(family, scene, seed, foeCol, openingsOf({ forks, from, upTo }));
  if (family === 'lab') return grid;
  const { up, down } = openingsOf({ forks, from, upTo });
  const floor = FLOOR[family] ?? T.grass;
  for (const col of up) for (let row = 0; row < PATH_ROW; row++) grid[row][col] = floor;
  for (const col of down) for (let row = PATH_ROW + 1; row < ROWS; row++) grid[row][col] = floor;
  return grid;
}

function drawScene(family, scene, seed, foeCol, { up, down }) {
  const random = seeded(`${scene}:${seed}`);
  const grid = Array.from({ length: ROWS }, () => Array(COLS).fill(T.grass));
  const set = (row, col, key) => { if (row >= 0 && row < ROWS && col >= 0 && col < COLS) grid[row][col] = key; };
  const walk = (row, col) => row === PATH_ROW || (up.includes(col) && row < PATH_ROW) || (down.includes(col) && row > PATH_ROW);
  const locked = new Set();
  const open = (row, col) => !locked.has(row * COLS + col) && !walk(row, col) && !(col >= foeCol - 1 && col <= foeCol + 1 && row >= PATH_ROW - 1 && row <= PATH_ROW);
  const fill = (key, rows = [0, ROWS - 1]) => { for (let row = rows[0]; row <= rows[1]; row++) for (let col = 0; col < COLS; col++) set(row, col, key); };
  const patchRect = (piece, top, left, bottom, right) => {
    for (let row = top; row <= bottom; row++)
      for (let col = left; col <= right; col++) {
        locked.add(row * COLS + col);
        const v = row === top ? 't' : row === bottom ? 'b' : '';
        const h = col === left ? 'l' : col === right ? 'r' : '';
        set(row, col, piece[`${v}${h}`] ?? piece[v || h] ?? piece.c);
      }
  };
  /** Patches of a key, a few tiles wide, like tall grass is laid in the games. */
  const clusters = (key, count, rows) => {
    for (let n = 0; n < count; n++) {
      const row = rows[Math.floor(random() * rows.length)];
      const col = Math.floor(random() * COLS);
      const width = 2 + Math.floor(random() * 4);
      const height = 1 + Math.floor(random() * 2);
      for (let r = row; r < row + height; r++) for (let c = col; c < col + width; c++) if (rows.includes(r) && open(r, c)) set(r, c, key);
    }
  };
  const sprinkle = (key, chance, rows) => {
    for (const row of rows) for (let col = 0; col < COLS; col++) if (open(row, col) && random() < chance) set(row, col, key);
  };

  if (family === 'cave') {
    fill(T.caveFloor[0]);
    for (let col = 0; col < COLS; col++) {
      set(0, col, T.caveWall[1][col % 4]);
      set(1, col, T.caveEdge);
      set(ROWS - 1, col, T.caveBottom[col % 4]);
    }
    sprinkle(T.caveFloor[1], 0.25, [2, 3, 4, 5]);
    sprinkle(T.caveBoulder[0], 0.12, [2, 4, 5]);
    sprinkle(T.caveBoulder[1], 0.08, [2, 4, 5]);
    if (!up.includes(14)) { set(1, 14, T.caveHole[0]); set(2, 14, T.caveHole[1]); }
    return grid;
  }
  if (family === 'lab') {
    fill(T.labFloor);
    T.labWall.forEach((row, r) => row.forEach((key, col) => set(r, col, key)));
    T.labMachine.forEach((row, r) => row.forEach((key, c) => set(4 + r, 13 + c, key)));
    T.labShelf.forEach((row, r) => row.forEach((key, c) => set(4 + r, c, key)));
    set(5, 6, T.labPlant[0]); set(6, 6, T.labPlant[1]);
    set(6, 8, T.labMat[0]); set(6, 9, T.labMat[1]);
    return grid;
  }
  if (family === 'beach' || family === 'ocean') {
    const top = family === 'ocean' ? 1 : 2;
    const bottom = family === 'ocean' ? ROWS - 2 : ROWS;
    fill(T.sea);
    patchRect(T.shore, top, -1, bottom, COLS);
    for (let col = 0; col < COLS - 1; col += 3 + Math.floor(random() * 4)) {
      const row = family === 'ocean' && random() < 0.5 ? ROWS - 1 : 0;
      if (row === 0 && top < 2) continue;
      if (row + 1 >= ROWS) { set(row, col, T.sea); continue; }
      T.seaRock.forEach((pair, r) => pair.forEach((key, c) => set(row + r, col + c, key)));
    }
    sprinkle(T.rock, 0.08, family === 'ocean' ? [2, 4] : [4, 5, 6]);
    return grid;
  }
  if (family === 'desert' || family === 'mountain') {
    fill(T.sand);
    for (let col = 0; col < COLS; col++) {
      set(0, col, T.moundOnSand[1][col % 3]);
      set(1, col, T.moundOnSand[2][col % 3]);
      set(ROWS - 1, col, T.moundOnSand[0][col % 3]);
    }
    sprinkle(T.rock, 0.12, [2, 4, 5]);
    return grid;
  }

  // Grass: a tree border above and below, like the routes of the games.
  for (let col = 0; col < COLS; col++) {
    set(0, col, T.forestTrunks[col % 2]);
    set(ROWS - 1, col, T.forestCanopy[col % 2]);
  }
  if (family === 'lake') {
    for (let col = 0; col < COLS; col++) {
      set(ROWS - 2, col, T.pond.t);
      set(ROWS - 1, col, T.pond.c);
    }
  }
  if (family === 'path') patchRect(T.dirt, PATH_ROW - 1, -1, PATH_ROW + 1, COLS);
  if (family === 'tallGrass') {
    clusters(T.tall, 9, [1, 2, 4, 5]);
    sprinkle(T.tall, 0.3, [PATH_ROW]);
  } else {
    clusters(T.tall, family === 'snow' ? 2 : 3, family === 'lake' ? [1] : [1, 4, 5]);
    sprinkle(T.flowers, 0.12, family === 'lake' ? [1, 2] : [1, 2, 4, 5]);
  }
  if (!up.length && open(1, 1) && family !== 'tallGrass') set(1, 1, T.sign);
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

import { mkdirSync, writeFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { ATLAS_COLS, ATLAS_KEYS, metatileOf, TILE, TILESETS, tilesetOf } from '../public/tower-tiles.js';
import { UPSTREAM } from '../public/upstream.js';
import { encodePng } from './sync-trainers.js';
import { fetchUpstream } from './upstream-files.js';

const OUT = new URL('../public/tiles/', import.meta.url);
const PRIMARY_METATILES = 512;
const PRIMARY_PALETTES = 6;
const PALETTES = 13;

export function decodeIndexed(png) {
  const parts = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    parts.push({ type: png.toString('ascii', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  const header = parts.find((part) => part.type === 'IHDR').data;
  const [width, height, depth] = [header.readUInt32BE(0), header.readUInt32BE(4), header[8]];
  const stride = Math.ceil((width * depth) / 8);
  const raw = inflateSync(Buffer.concat(parts.filter((part) => part.type === 'IDAT').map((part) => part.data)));
  const bytes = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x ? bytes[y * stride + x - 1] : 0;
      const up = y ? bytes[(y - 1) * stride + x] : 0;
      const corner = x && y ? bytes[(y - 1) * stride + x - 1] : 0;
      const guess = left + up - corner;
      const paeth = Math.abs(guess - left) <= Math.abs(guess - up) && Math.abs(guess - left) <= Math.abs(guess - corner) ? left : Math.abs(guess - up) <= Math.abs(guess - corner) ? up : corner;
      bytes[y * stride + x] = (value + [0, left, up, (left + up) >> 1, paeth][filter]) & 255;
    }
  }
  const perByte = 8 / depth;
  const indexes = new Uint8Array(width * height);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      indexes[y * width + x] = depth === 8 ? bytes[y * stride + x] : (bytes[y * stride + Math.floor(x / perByte)] >> ((perByte - 1 - (x % perByte)) * depth)) & ((1 << depth) - 1);
  return { width, height, indexes };
}

const parsePalette = (text) => text.trim().split(/\r?\n/).slice(3).map((line) => line.trim().split(/\s+/).map(Number));

async function fetchTileset(path, palettes) {
  const get = async (file) => {
    const res = await fetchUpstream(UPSTREAM.emerald, `data/tilesets/${path}/${file}`);
    if (!res.ok) throw new Error(`${path}/${file}: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  };
  const [tiles, metatiles, ...colors] = await Promise.all([get('tiles.png'), get('metatiles.bin'), ...palettes.map((i) => get(`palettes/${String(i).padStart(2, '0')}.pal`))]);
  return { tiles: decodeIndexed(tiles), metatiles, palettes: Object.fromEntries(palettes.map((i, n) => [i, parsePalette(colors[n].toString('utf8'))])) };
}

export function drawMetatile(rgba, width, ox, oy, id, primary, secondary) {
  const palettes = { ...primary.palettes, ...(secondary?.palettes ?? {}) };
  const source = id < PRIMARY_METATILES ? primary.metatiles : secondary.metatiles;
  const at = (id < PRIMARY_METATILES ? id : id - PRIMARY_METATILES) * 16;
  for (let layer = 0; layer < 2; layer++)
    for (let quarter = 0; quarter < 4; quarter++) {
      const entry = source.readUInt16LE(at + (layer * 4 + quarter) * 2);
      const tileNumber = entry & 0x3ff;
      const image = tileNumber < PRIMARY_METATILES ? primary.tiles : secondary.tiles;
      const tile = tileNumber < PRIMARY_METATILES ? tileNumber : tileNumber - PRIMARY_METATILES;
      const colors = palettes[entry >> 12] ?? palettes[0];
      const [tx, ty] = [(tile % (image.width / 8)) * 8, Math.floor(tile / (image.width / 8)) * 8];
      for (let y = 0; y < 8; y++)
        for (let x = 0; x < 8; x++) {
          const sx = tx + (entry & 0x400 ? 7 - x : x);
          const sy = ty + (entry & 0x800 ? 7 - y : y);
          const index = sy < image.height ? image.indexes[sy * image.width + sx] : 0;
          const o = ((oy + (quarter >> 1) * 8 + y) * width + ox + (quarter % 2) * 8 + x) * 4;
          if (!index) {
            if (layer) continue;
            [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]] = [...palettes[0][0], 255];
            continue;
          }
          [rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3]] = [...(colors[index] ?? [0, 0, 0]), 255];
        }
    }
}

async function main() {
  const sets = new Map();
  for (const [bits, { primary, secondary }] of Object.entries(TILESETS)) {
    const load = async (path, palettes) => {
      if (!sets.has(path)) sets.set(path, fetchTileset(path, palettes));
      return sets.get(path);
    };
    const range = (from, to) => Array.from({ length: to - from }, (_, i) => from + i);
    TILESETS[bits].loaded = Promise.all([load(primary, range(0, PRIMARY_PALETTES)), secondary ? load(secondary, range(PRIMARY_PALETTES, PALETTES)) : null]);
  }
  const width = ATLAS_COLS * TILE;
  const height = Math.ceil(ATLAS_KEYS.length / ATLAS_COLS) * TILE;
  const rgba = Buffer.alloc(width * height * 4);
  for (const [i, key] of ATLAS_KEYS.entries()) {
    const [primary, secondary] = await TILESETS[tilesetOf(key)].loaded;
    drawMetatile(rgba, width, (i % ATLAS_COLS) * TILE, Math.floor(i / ATLAS_COLS) * TILE, metatileOf(key), primary, secondary);
  }
  mkdirSync(OUT, { recursive: true });
  writeFileSync(new URL('tower.png', OUT), encodePng({ width, height, rgba }));
  console.log(`Tiles: ${ATLAS_KEYS.length} metatiles en public/tiles/tower.png`);
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

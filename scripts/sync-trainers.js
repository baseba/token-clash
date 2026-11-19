#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { inflateSync, deflateSync } from 'node:zlib';
import { DOWNLOADED_SPRITES, TRAINER_VARIANTS } from '../public/trainer-sprites.js';
import { UPSTREAM } from '../public/upstream.js';
import { fetchUpstream, mapLimit } from './upstream-files.js';

// Served by us, unlike the rest of PokeRogue's files: each sprite is the first frame of an atlas,
// cropped to its pixels, and the color variants are recolored from it.
const TRAINERS = 'images/trainer';
const OUT = new URL('../public/trainers/', import.meta.url);

const log = (msg) => console.log(msg);

function chunks(png) {
  const out = [];
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    out.push({ type: png.toString('latin1', at + 4, at + 8), data: png.subarray(at + 8, at + 8 + length) });
    at += 12 + length;
  }
  return out;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function unfilter(raw, height, stride, bpp) {
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const left = x >= bpp ? out[y * stride + x - bpp] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const corner = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, corner)][filter];
      out[y * stride + x] = (line[x] + predictor) & 0xff;
    }
  }
  return out;
}

export function decodePng(png) {
  const parts = chunks(png);
  const header = parts.find((c) => c.type === 'IHDR').data;
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  const depth = header[8];
  const colorType = header[9];
  if (header[12] !== 0) throw new Error('interlaced PNG');
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  const bitsPerPixel = channels * depth;
  const stride = Math.ceil((width * bitsPerPixel) / 8);
  const raw = inflateSync(Buffer.concat(parts.filter((c) => c.type === 'IDAT').map((c) => c.data)));
  const bytes = unfilter(raw, height, stride, Math.max(1, bitsPerPixel >> 3));
  const palette = parts.find((c) => c.type === 'PLTE')?.data;
  const alphas = parts.find((c) => c.type === 'tRNS')?.data;
  const rgba = Buffer.alloc(width * height * 4);
  const sample = (row, i) => {
    if (depth === 8) return row[i];
    if (depth === 16) return row[i * 2];
    const perByte = 8 / depth;
    return (row[Math.floor(i / perByte)] >> ((perByte - 1 - (i % perByte)) * depth)) & ((1 << depth) - 1);
  };
  for (let y = 0; y < height; y++) {
    const row = bytes.subarray(y * stride, (y + 1) * stride);
    for (let x = 0; x < width; x++) {
      const o = (y * width + x) * 4;
      if (colorType === 3) {
        const index = sample(row, x);
        rgba[o] = palette[index * 3];
        rgba[o + 1] = palette[index * 3 + 1];
        rgba[o + 2] = palette[index * 3 + 2];
        rgba[o + 3] = alphas && index < alphas.length ? alphas[index] : 255;
      } else {
        const values = Array.from({ length: channels }, (_, c) => sample(row, x * channels + c));
        const [r, g, b] = channels >= 3 ? values : [values[0], values[0], values[0]];
        rgba[o] = r;
        rgba[o + 1] = g;
        rgba[o + 2] = b;
        rgba[o + 3] = channels === 2 || channels === 4 ? values[channels - 1] : 255;
      }
    }
  }
  return { width, height, rgba };
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

export function encodePng({ width, height, rgba }) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function atlasFrames(atlas) {
  const frames = atlas?.textures?.[0]?.frames ?? atlas?.frames;
  return Array.isArray(frames) ? frames : [];
}

function opaqueBox({ width, height, rgba }) {
  const box = { x: width, y: height, w: 0, h: 0 };
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if (!rgba[(y * width + x) * 4 + 3]) continue;
      box.x = Math.min(box.x, x);
      box.y = Math.min(box.y, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  return { ...box, w: right - box.x + 1, h: bottom - box.y + 1 };
}

function crop(image, { x, y, w, h }) {
  const rgba = Buffer.alloc(w * h * 4);
  for (let row = 0; row < h; row++) image.rgba.copy(rgba, row * w * 4, ((y + row) * image.width + x) * 4, ((y + row) * image.width + x + w) * 4);
  return { width: w, height: h, rgba };
}

function firstFrame(image, atlas) {
  const [first] = atlasFrames(atlas).sort((a, b) => a.filename.localeCompare(b.filename));
  const area = first?.frame ?? { x: 0, y: 0, w: image.width, h: image.height };
  const frame = crop(image, area);
  return crop(frame, opaqueBox(frame));
}

function hslOf(r, g, b) {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === rn ? (gn - bn) / d + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return [h * 60, s, l];
}

function rgbOf(h, s, l) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255));
}

const skinLike = (h, l) => h >= 8 && h <= 31 && l >= 0.5;

const inRange = (hue, [from, to]) => (to - from >= 360 || (from <= to ? hue >= from && hue <= to : hue >= from || hue <= to));

export function recolorTrainer(image, swaps) {
  const rgba = Buffer.from(image.rgba);
  for (let i = 0; i < image.width * image.height; i++) {
    if (!rgba[i * 4 + 3]) continue;
    const [h, s, l] = hslOf(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    const swap = swaps.find((sw) => s >= (sw.minSat ?? (sw.maxSat === undefined ? 0.2 : 0)) && s <= (sw.maxSat ?? 1) && l >= (sw.minLight ?? 0) && l <= (sw.maxLight ?? 1) && !(sw.keepSkin && skinLike(h, l)) && inRange(h, sw.from));
    if (swap) rgbOf(swap.hue, Math.min(1, swap.setSat ?? s * (swap.sat ?? 1)), Math.min(1, l * (swap.light ?? 1))).forEach((value, c) => (rgba[i * 4 + c] = value));
  }
  return { width: image.width, height: image.height, rgba };
}

const EYE_REACH = 0.4;
const EYE_SPOT_MAX = 8;

const isEyeWhite = ([r, g, b]) => Math.min(r, g, b) >= 190 && Math.max(r, g, b) - Math.min(r, g, b) <= 40;

const inEyes = (image, face, i) => {
  const reach = face.h * image.height * EYE_REACH;
  return Math.abs((i % image.width) - face.x * image.width) <= reach && Math.abs(Math.floor(i / image.width) - face.y * image.height) <= reach;
};

export function eyeWhites(image, face) {
  const light = (i) => image.rgba[i * 4 + 3] > 0 && isEyeWhite([image.rgba[i * 4], image.rgba[i * 4 + 1], image.rgba[i * 4 + 2]]);
  const kept = new Set();
  const seen = new Set();
  for (let start = 0; start < image.width * image.height; start++) {
    if (seen.has(start) || !light(start) || !inEyes(image, face, start)) continue;
    const spot = [start];
    seen.add(start);
    for (let k = 0; k < spot.length; k++) {
      const x = spot[k] % image.width;
      const neighbors = [x > 0 ? spot[k] - 1 : -1, x + 1 < image.width ? spot[k] + 1 : -1, spot[k] - image.width, spot[k] + image.width];
      for (const next of neighbors)
        if (next >= 0 && next < image.width * image.height && !seen.has(next) && light(next)) {
          seen.add(next);
          spot.push(next);
        }
    }
    if (spot.length <= EYE_SPOT_MAX) spot.forEach((i) => kept.add(i));
  }
  return kept;
}

export function recolorByMap(image, map, face) {
  const rgba = Buffer.from(image.rgba);
  const table = new Map(map.map(([from, to]) => [parseInt(from.slice(1), 16), [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16))]));
  const eyes = face ? eyeWhites(image, face) : new Set();
  for (let i = 0; i < image.width * image.height; i++) {
    if (!rgba[i * 4 + 3]) continue;
    if (eyes.has(i)) continue;
    const to = table.get(rgba.readUIntBE(i * 4, 3));
    if (to) to.forEach((value, c) => (rgba[i * 4 + c] = value));
  }
  return { width: image.width, height: image.height, rgba };
}

const HEAD_SHARE = 0.26;
const AXIS_SHARE = 0.45;
const FACE_DROP = 0.58;
const MIN_SKIN = 10;

export function skinPixel(image, x, y) {
  const i = (y * image.width + x) * 4;
  const [r, g, b] = [image.rgba[i] / 255, image.rgba[i + 1] / 255, image.rgba[i + 2] / 255];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min || max !== r) return false;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = (((g - b) / d + 6) % 6) * 60;
  return h >= 8 && h <= 38 && s >= 0.18 && s <= 0.75 && l >= 0.3 && l <= 0.9;
}

export function faceOf(image) {
  const opaque = (x, y) => image.rgba[(y * image.width + x) * 4 + 3] > 0;
  let top = image.height;
  let bottom = -1;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++)
      if (opaque(x, y)) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  if (bottom < 0) return null;
  const height = bottom - top + 1;
  const headH = Math.max(4, Math.round(height * HEAD_SHARE));
  const axisBand = Math.min(image.height, top + Math.round(height * AXIS_SHARE));
  const column = Array.from({ length: image.width }, (_, x) => {
    let n = 0;
    for (let y = top; y < axisBand; y++) if (opaque(x, y)) n += 1;
    return n;
  });
  const span = Math.max(3, Math.round(headH * 0.85));
  let best = 0;
  let bestSum = -1;
  for (let x = 0; x + span <= image.width; x++) {
    const sum = column.slice(x, x + span).reduce((a, b) => a + b, 0);
    if (sum > bestSum) {
      bestSum = sum;
      best = x;
    }
  }
  let headTop = top;
  while (headTop < bottom && !column.slice(best, best + span).some((_, i) => opaque(best + i, headTop))) headTop += 1;
  let sumX = 0;
  let count = 0;
  for (let y = headTop; y < Math.min(image.height, headTop + headH); y++)
    for (let x = best; x < best + span; x++)
      if (opaque(x, y)) {
        sumX += x;
        count += 1;
      }
  let sumY = (headTop + headH * FACE_DROP) * count;
  const skinIn = (from, to) => {
    const found = [];
    for (let y = Math.round(from); y < Math.min(image.height, Math.round(to)); y++)
      for (let x = best; x < Math.min(image.width, best + span); x++) if (opaque(x, y) && skinPixel(image, x, y)) found.push([x, y]);
    return found;
  };
  let skin = skinIn(headTop, headTop + headH * 1.15);
  if (skin.length < MIN_SKIN) skin = skinIn(headTop + headH * 0.6, headTop + headH * 1.7);
  if (skin.length >= MIN_SKIN) {
    sumX = skin.reduce((a, [x]) => a + x, 0) * (count / skin.length);
    sumY = skin.reduce((a, [, y]) => a + y, 0) * (count / skin.length);
  }
  let minX = image.width;
  let maxX = -1;
  for (let y = headTop; y < Math.min(image.height, headTop + headH); y++)
    for (let x = Math.max(0, Math.round(best - span * 0.6)); x < Math.min(image.width, Math.round(best + span * 1.6)); x++)
      if (opaque(x, y)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
      }
  const headW = maxX >= minX ? maxX - minX + 1 : headH;
  const size = Math.max(headH, headW * 0.85);
  const round = (n) => Math.round(n * 1000) / 1000;
  return { x: round((sumX / count + 0.5) / image.width), y: round((sumY / count + 0.5) / image.height), h: round(size / image.height) };
}

export function writeFaces() {
  const faces = {};
  for (const key of DOWNLOADED_SPRITES) {
    const file = new URL(`${key}.png`, OUT);
    if (!existsSync(file)) continue;
    const face = faceOf(decodePng(readFileSync(file)));
    if (face) faces[key] = [face.x, face.y, face.h];
  }
  writeFileSync(new URL('faces.json', OUT), `${JSON.stringify(faces)}\n`);
  return Object.keys(faces).length;
}

export function generateVariants() {
  const failed = [];
  for (const variant of TRAINER_VARIANTS) {
    try {
      const base = decodePng(readFileSync(new URL(`${variant.base}.png`, OUT)));
      writeFileSync(new URL(`${variant.key}.png`, OUT), encodePng(variant.map ? recolorByMap(base, variant.map, faceOf(base)) : recolorTrainer(base, variant.swaps)));
    } catch (err) {
      failed.push(`${variant.key} (${err.message})`);
    }
  }
  return failed;
}

async function syncTrainer(key) {
  const file = new URL(`${key}.png`, OUT);
  if (existsSync(file)) return 'existing';
  const [png, atlas] = await Promise.all([fetchUpstream(UPSTREAM.pokerogue, `${TRAINERS}/${key}.png`), fetchUpstream(UPSTREAM.pokerogue, `${TRAINERS}/${key}.json`)]);
  if (!png.ok) return 'missing';
  const frames = atlas.ok ? await atlas.json() : null;
  writeFileSync(file, encodePng(firstFrame(decodePng(Buffer.from(await png.arrayBuffer())), frames)));
  return 'new';
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const counts = { new: 0, existing: 0, missing: 0, failed: 0 };
  await mapLimit(DOWNLOADED_SPRITES, async (key) => {
    try {
      counts[await syncTrainer(key)] += 1;
    } catch (err) {
      counts.failed += 1;
      log(`  ${key}: ${err.message}`);
    }
  });
  const variantsFailed = generateVariants();
  const faces = writeFaces();
  for (const failure of variantsFailed) log(`  ${failure}`);
  log(`Entrenadores listos en public/trainers/: ${counts.new} nuevos, ${counts.existing} existentes, ${counts.missing} no disponibles, ${counts.failed} con error; ${TRAINER_VARIANTS.length - variantsFailed.length} variantes de colores; ${faces} caras ubicadas.`);
  if (variantsFailed.length) process.exitCode = 1;
  if (counts.failed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

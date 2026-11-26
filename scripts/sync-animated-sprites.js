#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { animatedSpriteFile, ANIMATED_SPRITES_INDEX } from '../public/creature.js';
import { UPSTREAM } from '../public/upstream.js';
import { chunk, crop, decodePng, opaqueBox } from './sync-trainers.js';
import { fetchRetry, fetchUpstream, mapLimit } from './upstream-files.js';

const POKEMON_DIR = 'Graphics/Pokemon/';
const MANIFEST = new URL('../public/upstream/essentials.json', import.meta.url);
const OUT = new URL('../public/animated/', import.meta.url);
const INDEX = new URL(ANIMATED_SPRITES_INDEX, OUT);
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DELAY_DENOMINATOR = 1000;
const DISPOSE_TO_TRANSPARENT = 1;

export function stripFrames(strip) {
  const side = strip.height;
  const count = Math.max(1, Math.floor(strip.width / side));
  const frames = Array.from({ length: count }, (_, i) => crop(strip, { x: i * side, y: 0, w: Math.min(side, strip.width), h: side }));
  const boxes = frames.map(opaqueBox).filter((box) => box.w > 0 && box.h > 0);
  if (!boxes.length) return frames;
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.w));
  const bottom = Math.max(...boxes.map((box) => box.y + box.h));
  return frames.map((frame) => crop(frame, { x: left, y: top, w: right - left, h: bottom - top }));
}

export function shrink(image, factor) {
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) image.rgba.copy(rgba, (y * width + x) * 4, (y * factor * image.width + x * factor) * 4, (y * factor * image.width + x * factor) * 4 + 4);
  return { width, height, rgba };
}

export function matchShinyScale(variants) {
  return variants.map((frames, variant) => {
    const normal = variants[variant - 1];
    if (variant % 2 === 0 || !frames || !normal) return frames;
    const factor = Math.round(frames[0].height / normal[0].height);
    return factor >= 2 ? frames.map((frame) => shrink(frame, factor)) : frames;
  });
}

const MAX_PALETTE = 256;

function paletteOf(frames) {
  const colors = new Map();
  for (const { rgba } of frames)
    for (let i = 0; i < rgba.length; i += 4) {
      const color = rgba[i + 3] ? rgba.readUInt32BE(i) : 0;
      if (!colors.has(color)) colors.set(color, colors.size);
      if (colors.size > MAX_PALETTE) return null;
    }
  return colors;
}

function pixelRows({ width, height, rgba }, palette) {
  const channels = palette ? 1 : 4;
  const raw = Buffer.alloc(height * (width * channels + 1));
  for (let y = 0; y < height; y++) {
    const row = y * (width * channels + 1) + 1;
    if (!palette) rgba.copy(raw, row, y * width * 4, (y + 1) * width * 4);
    else for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      raw[row + x] = palette.get(rgba[at + 3] ? rgba.readUInt32BE(at) : 0);
    }
  }
  return deflateSync(raw);
}

function colorChunks(palette) {
  if (!palette) return [];
  const colors = [...palette.keys()];
  const rgb = Buffer.alloc(colors.length * 3);
  const alpha = Buffer.alloc(colors.length);
  colors.forEach((color, i) => {
    rgb[i * 3] = color >>> 24;
    rgb[i * 3 + 1] = (color >>> 16) & 0xff;
    rgb[i * 3 + 2] = (color >>> 8) & 0xff;
    alpha[i] = color & 0xff;
  });
  return [chunk('PLTE', rgb), chunk('tRNS', alpha)];
}

export function encodeAnimatedPng(frames, delay) {
  const shown = delay > 0 ? frames : frames.slice(0, 1);
  const palette = paletteOf(shown);
  const { width, height } = shown[0];
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = palette ? 3 : 6;
  const parts = [PNG_SIGNATURE, chunk('IHDR', header)];
  if (shown.length > 1) {
    const animation = Buffer.alloc(8);
    animation.writeUInt32BE(shown.length, 0);
    parts.push(chunk('acTL', animation));
  }
  parts.push(...colorChunks(palette));
  let sequence = 0;
  shown.forEach((frame, i) => {
    if (shown.length > 1) {
      const control = Buffer.alloc(26);
      control.writeUInt32BE(sequence++, 0);
      control.writeUInt32BE(width, 4);
      control.writeUInt32BE(height, 8);
      control.writeUInt16BE(delay, 20);
      control.writeUInt16BE(DELAY_DENOMINATOR, 22);
      control[24] = DISPOSE_TO_TRANSPARENT;
      parts.push(chunk('fcTL', control));
    }
    const data = pixelRows(frame, palette);
    if (i === 0) parts.push(chunk('IDAT', data));
    else {
      const sequenced = Buffer.alloc(4);
      sequenced.writeUInt32BE(sequence++, 0);
      parts.push(chunk('fdAT', Buffer.concat([sequenced, data])));
    }
  });
  parts.push(chunk('IEND', Buffer.alloc(0)));
  return Buffer.concat(parts);
}

const BACK_VARIANTS = new Set([2, 3]);
const PASSES = 3;

async function downloadStrip(file) {
  const response = await fetchUpstream(UPSTREAM.essentials, POKEMON_DIR + file);
  if (!response.ok) throw new Error(`${response.status} ${file}`);
  return decodePng(Buffer.from(await response.arrayBuffer()));
}

export const spriteFilesOf = (slug, entry) => [0, 1, 2, 3].map((variant) => animatedSpriteFile(slug, variant, entry.showdown?.[variant] ? 'gif' : 'png'));

async function downloadCopy(url) {
  const response = await fetchRetry(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function spriteOf(entry, variant) {
  const copy = entry.showdown?.[variant];
  return copy ? { copy: await downloadCopy(copy) } : { frames: stripFrames(await downloadStrip(entry.files[variant])) };
}

async function convert(slugs, manifest, converted) {
  const failed = [];
  let done = 0;
  await mapLimit(slugs, async (slug) => {
    const entry = manifest[slug];
    try {
      const sprites = await Promise.all([0, 1, 2, 3].map((variant) => spriteOf(entry, variant)));
      const scaled = matchShinyScale(sprites.map((sprite) => sprite.frames ?? null));
      const files = spriteFilesOf(slug, entry);
      sprites.forEach((sprite, variant) => {
        const delay = BACK_VARIANTS.has(variant) ? entry.delays[1] : entry.delays[0];
        writeFileSync(new URL(files[variant], OUT), sprite.copy ?? encodeAnimatedPng(scaled[variant], delay));
      });
      converted.add(slug);
    } catch (error) {
      failed.push(`${slug} (${error.message})`);
    }
    if (++done % 50 === 0) console.log(`  ${done}/${slugs.length}`);
  });
  return failed;
}

async function main() {
  const text = readFileSync(MANIFEST, 'utf8');
  const fingerprint = createHash('sha256').update(UPSTREAM.essentials.commit).update(text).digest('hex');
  const previous = existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, 'utf8')) : null;
  const manifest = JSON.parse(text);
  const slugs = Object.keys(manifest);
  const complete = (slug) => spriteFilesOf(slug, manifest[slug]).every((file) => existsSync(new URL(file, OUT)));
  const kept = new Set(previous?.fingerprint === fingerprint ? Object.keys(previous.sprites ?? {}).filter((slug) => manifest[slug] && complete(slug)) : []);
  const pending = slugs.filter((slug) => !kept.has(slug));
  if (!pending.length) {
    console.log(`Sprites animados al día: ${kept.size} en public/animated/.`);
    return;
  }
  if (!kept.size) rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const converted = new Set(kept);
  let failed = [];
  for (let pass = 1; pass <= PASSES; pass++) {
    failed = await convert(pending.filter((slug) => !converted.has(slug)), manifest, converted);
    if (failed.length && pass < PASSES) console.log(`  Reintentando ${failed.length} que fallaron.`);
    if (!failed.length) break;
  }
  const written = slugs.filter((slug) => converted.has(slug));
  writeFileSync(INDEX, `${JSON.stringify({ fingerprint, sprites: Object.fromEntries(written.map((slug) => [slug, spriteFilesOf(slug, manifest[slug])])) })}\n`);
  const files = readdirSync(OUT).length - 1;
  console.log(`Sprites animados listos en public/animated/: ${written.length} Pokémon y formas, ${files} archivos.`);
  if (failed.length) {
    console.error(`No se pudieron convertir ${failed.length}: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`);
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

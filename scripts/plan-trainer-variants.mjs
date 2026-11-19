#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { decodePng } from './sync-trainers.js';
import { UPSTREAM } from '../public/upstream.js';
import { fetchUpstream } from './upstream-files.js';
import { CHAMPIONS, DOWNLOADED_SPRITES, HANDMADE_VARIANTS, MALE_OF, SHINY_VARIANTS, SHOP_TRAINERS, VILLAINS } from '../public/trainer-sprites.js';

const TRAINERS = new URL('../public/trainers/', import.meta.url);
const SHIPPED_RECOLORS = JSON.parse(readFileSync(new URL('./shipped-recolors.json', import.meta.url), 'utf8'));
const OUT = new URL('../public/trainer-variants.js', import.meta.url);

export const VARIANT_COLORS = [
  { key: 'crimson', name: 'Carmesí', type: 'fire', hue: 355, sat: 1, light: 1 },
  { key: 'coral', name: 'Coral', type: 'fighting', hue: 10, sat: 0.9, light: 1 },
  { key: 'bronze', name: 'Bronce', type: 'rock', hue: 26, sat: 0.6, light: 0.85 },
  { key: 'amber', name: 'Ámbar', type: 'ground', hue: 34, sat: 0.95, light: 0.9 },
  { key: 'gold', name: 'Dorado', type: 'electric', hue: 48, sat: 1, light: 1.08, look: { hue: 43, sat: 0.92, light: 0.98, spread: 0.2 } },
  { key: 'ivory', name: 'Marfil', type: 'normal', hue: 45, sat: 0.3, light: 1.12 },
  { key: 'olive', name: 'Oliva', type: 'bug', hue: 70, sat: 0.55, light: 0.72 },
  { key: 'lime', name: 'Lima', type: 'grass', hue: 92, sat: 0.8, light: 0.82 },
  { key: 'emerald', name: 'Esmeralda', type: 'grass', hue: 140, sat: 0.9, light: 0.92 },
  { key: 'mint', name: 'Menta', type: 'ice', hue: 158, sat: 0.55, light: 1 },
  { key: 'teal', name: 'Turquesa', type: 'water', hue: 182, sat: 0.62, light: 0.78 },
  { key: 'sky', name: 'Celeste', type: 'flying', hue: 200, sat: 0.75, light: 1.05, look: { hue: 207, sat: 0.85, light: 1.05, spread: 0.15 } },
  { key: 'sapphire', name: 'Zafiro', type: 'water', hue: 218, sat: 1, light: 0.9 },
  { key: 'slate', name: 'Pizarra', type: 'steel', hue: 215, sat: 0.22, light: 0.95 },
  { key: 'indigo', name: 'Índigo', type: 'dragon', hue: 240, sat: 0.85, light: 0.8 },
  { key: 'violet', name: 'Violeta', type: 'ghost', hue: 272, sat: 0.95, light: 0.95 },
  { key: 'lavender', name: 'Lavanda', type: 'psychic', hue: 268, sat: 0.5, light: 1.05 },
  { key: 'magenta', name: 'Magenta', type: 'poison', hue: 305, sat: 0.95, light: 1 },
  { key: 'rose', name: 'Rosa', type: 'fairy', hue: 332, sat: 0.85, light: 1 },
  { key: 'rust', name: 'Óxido', type: 'steel', hue: 16, sat: 0.7, light: 0.72 },
  { key: 'peach', name: 'Durazno', type: 'normal', hue: 22, sat: 0.6, light: 1 },
  { key: 'forest', name: 'Bosque', type: 'grass', hue: 128, sat: 0.55, light: 0.62 },
  { key: 'navy', name: 'Marino', type: 'water', hue: 225, sat: 0.65, light: 0.6 },
  { key: 'plum', name: 'Ciruela', type: 'poison', hue: 292, sat: 0.55, light: 0.68 },
  { key: 'wine', name: 'Burdeos', type: 'dark', hue: 345, sat: 0.75, light: 0.7, look: { hue: 352, sat: 0.8, light: 0.6, spread: 0.15 } },
];

const STORY = new Set([...CHAMPIONS, ...VILLAINS.boss, ...VILLAINS.legend]);
const MAIN = new Set([...VILLAINS.star, 'player_m', 'player_f', 'rival_m', 'rival_f', 'nate', 'rosa', 'hugh']);
const BIN = 30;
const MIN_SHARE = 0.08;
const NEIGHBOR_SHARE = 0.25;
const SEED_RANGE = 40;
const SHADE_RANGE = 55;
const MIN_CHANGE = 70;
const MIN_VISIBLE = 55;
const SECOND_SHARE = 0.5;
const PARTNER_VARIANTS = new Set(['red__magenta']);
const SKIN_TOUCH = 0.3;
const SKIN_MIN_CHROMA = 0.15;
const SKIN_MAX_CHROMA = 0.48;
const HEAD_BAND = 0.32;
const HAIR_BAND = 0.22;
const HEAD_PIECE_SHARE = 0.3;
const HEAD_PIECE_CONTACT = 0.3;
const HEAD_PIECE_WHITE = 0.85;
const SKIN_SEED_LIGHT = 0.4;
const SKIN_HEAD_SHARE = 0.02;
const HAIR_SHADES = { alder: [0xa54a31, 0x733121] };
const SIMILAR_RANGE = 25;
const SIMILAR_SAT = 0.12;
const GRAY_WEIGHT = 0.4;
const THIRD_SHARE = 0.08;
const REGION_SHARE = 0.06;
const POKEMON_REGION_SHARE = 0.03;
const HAIR_SHARE = 0.75;
const PANTS_LINE = 0.66;
const TORSO_BAND = [0.28, 0.58];
const BODY_SHARE = 0.25;
const SUIT_TONE_GAP = 0.4;
const MAX_LUMA = 0.58;
const VARIANT_MIN_CHANGE = 52;
const DULL_SAT = 0.38;
const DARK_MAX_SAT = 0.6;
const DARK_LIFT = 0.05;
const DARK_GAIN = 1.15;
const DARK_MAX_LIGHT = 0.55;
const WHITE_FROM = 0.8;
const WHITE_BASE = 0.7;
const WHITE_CONTRAST = 1.15;
const CHROMA_BASE_MAX = 0.45;
const CHROMA_MIN_CONTRAST = 0.9;
const CHROMA_MAX_SAT = 0.82;
const HIGHLIGHT_FROM = 0.6;
const HIGHLIGHT_FADE = 1.7;
const CHROMA_MAX_LIGHT = 0.82;
const NEUTRAL_CHROMA = 0.12;
const GRAY_BASE_MAX = 0.6;
const WHITE_MAX_LIGHT = 0.97;
const GRAY_MAX_LIGHT = 0.92;
const SHADE_FLOOR = 0.06;
const MIN_SHADE_SPAN = 0.3;
const COMPARABLE = 0.4;

export const variantsWanted = (key) => (STORY.has(key) ? 4 : MAIN.has(key) ? 3 : 1);

export function hsl([r, g, b]) {
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

function hex(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return `#${[0, 8, 4].map((n) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const signed = (a, b) => ((a - b + 540) % 360) - 180;

const chromaOf = ([, s, l]) => (1 - Math.abs(2 * l - 1)) * s;

export const isSkin = ([h, s, l]) =>
  h >= 6 && h <= 38 && ((s >= 0.15 && s <= 0.7 && l >= 0.18 && l <= 0.93) || (l >= 0.72 && s >= 0.15) || (l >= 0.18 && l <= 0.93 && chromaOf([h, s, l]) >= SKIN_MIN_CHROMA && chromaOf([h, s, l]) <= SKIN_MAX_CHROMA));
const isOutline = ([, , l]) => l < 0.07;

const loadTrainer = (base) => ({ ...decodePng(readFileSync(new URL(`${base}.png`, TRAINERS))), hairShades: HAIR_SHADES[base] });

export function paletteOf(image) {
  const colors = new Map();
  const at = (i) => image.rgba.readUIntBE(i * 4, 3);
  const touch = (a, b) => {
    const entry = colors.get(a);
    entry.neighbors.set(b, (entry.neighbors.get(b) ?? 0) + 1);
  };
  let top = image.height;
  let bottom = 0;
  let sumX = 0;
  let opaque = 0;
  for (let i = 0; i < image.width * image.height; i++) {
    if (!image.rgba[i * 4 + 3]) continue;
    const y = Math.floor(i / image.width);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    sumX += i % image.width;
    opaque += 1;
  }
  const axis = opaque ? sumX / opaque : image.width / 2;
  const span = Math.max(1, bottom - top + 1);
  for (let i = 0; i < image.width * image.height; i++) {
    if (!image.rgba[i * 4 + 3]) continue;
    const c = at(i);
    if (!colors.has(c)) colors.set(c, { rgb: [c >> 16, (c >> 8) & 255, c & 255], count: 0, sumY: 0, hairBand: 0, torso: 0, legs: 0, offAxis: 0, neighbors: new Map() });
    const entry = colors.get(c);
    const y = Math.floor(i / image.width);
    const along = (y - top) / span;
    entry.count += 1;
    entry.sumY += y / image.height;
    if (along < HAIR_BAND) entry.hairBand += 1;
    if (along >= TORSO_BAND[0] && along < TORSO_BAND[1]) entry.torso += 1;
    if (along >= TORSO_BAND[1]) entry.legs += 1;
    entry.offAxis += Math.abs((i % image.width) - axis) / image.width;
  }
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++) {
      const i = y * image.width + x;
      if (!image.rgba[i * 4 + 3]) continue;
      for (const j of [x + 1 < image.width ? i + 1 : -1, y + 1 < image.height ? i + image.width : -1]) {
        if (j < 0 || !image.rgba[j * 4 + 3] || at(i) === at(j)) continue;
        touch(at(i), at(j));
        touch(at(j), at(i));
      }
    }
  for (const entry of colors.values()) entry.hsl = hsl(entry.rgb);
  markSkin(image, colors);
  return colors;
}

function markSkin(image, colors) {
  let top = image.height;
  let bottom = -1;
  for (let y = 0; y < image.height; y++)
    for (let x = 0; x < image.width; x++)
      if (image.rgba[(y * image.width + x) * 4 + 3]) {
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
  const headEnd = top + (bottom - top + 1) * HEAD_BAND;
  const inHead = new Map();
  for (let y = top; y < headEnd; y++)
    for (let x = 0; x < image.width; x++) {
      const i = y * image.width + x;
      if (image.rgba[i * 4 + 3]) inHead.set(image.rgba.readUIntBE(i * 4, 3), (inHead.get(image.rgba.readUIntBE(i * 4, 3)) ?? 0) + 1);
    }
  for (const [c, entry] of colors) {
    entry.head = inHead.get(c) ?? 0;
    entry.skin = isSkin(entry.hsl) && entry.hsl[2] >= SKIN_SEED_LIGHT && entry.head >= 2 && entry.head >= entry.count * SKIN_HEAD_SHARE;
  }
  for (const c of image.hairShades ?? []) if (colors.has(c)) colors.get(c).skin = false;
  const share = (entry) => {
    const total = [...entry.neighbors.values()].reduce((a, b) => a + b, 0);
    const near = [...entry.neighbors].filter(([n]) => colors.get(n).skin).reduce((a, [, k]) => a + k, 0);
    return total ? near / total : 0;
  };
  for (const entry of colors.values()) if (!entry.skin && warm(entry.hsl[0]) && entry.hsl[1] >= 0.15 && entry.hsl[1] <= 0.75 && share(entry) >= SKIN_TOUCH) entry.touchesSkin = true;
  for (const entry of colors.values()) if (entry.touchesSkin) entry.skin = true;
}

const warm = (h) => h >= 330 || h <= 40;

function growRegion(colors, kind, center, taken) {
  const free = (c, entry) => !taken.has(c) && !entry.skin && !isOutline(entry.hsl);
  const neutralFits = ([, s, l]) => (kind === 'dark' ? l <= 0.6 : kind === 'light' ? l >= 0.3 : true) && !(s < 0.1 && (l > 0.9 || l < 0.1) && kind === 'hue');
  const inSeed = ([h, s, l]) => (kind === 'hue' ? (s >= 0.15 && distance(h, center) <= SEED_RANGE) || (s >= 0.1 && l < 0.45 && distance(h, center) <= SHADE_RANGE) : kind === 'light' ? s < 0.25 && l >= 0.55 : s < 0.25 && l >= 0.1 && l < 0.45);
  const region = new Set([...colors].filter(([c, entry]) => free(c, entry) && inSeed(entry.hsl)).map(([c]) => c));
  for (let round = 0; round < 3; round++)
    for (const [c, entry] of colors) {
      if (region.has(c) || taken.has(c) || isOutline(entry.hsl) || entry.skin || !neutralFits(entry.hsl)) continue;
      const total = [...entry.neighbors.values()].reduce((a, b) => a + b, 0);
      const near = [...entry.neighbors].filter(([n]) => region.has(n)).reduce((a, [, k]) => a + k, 0);
      const share = total ? near / total : 0;
      const fits = kind !== 'hue' ? entry.hsl[1] < 0.35 : distance(entry.hsl[0], center) <= 100 || entry.hsl[1] < 0.35;
      if (share >= NEIGHBOR_SHARE && fits) region.add(c);
    }
  if (kind === 'hue') {
    for (const [c, entry] of colors) {
      if (region.has(c) || taken.has(c) || entry.skin || isOutline(entry.hsl)) continue;
      const [h, sat] = entry.hsl;
      if (sat >= SIMILAR_SAT && distance(h, center) <= SIMILAR_RANGE) region.add(c);
    }
  }
  const members = [...region].map((c) => colors.get(c));
  const weight = members.reduce((sum, e) => sum + e.count, 0);
  const height = weight ? members.reduce((sum, e) => sum + e.sumY, 0) / weight : 0;
  const headShare = weight ? members.reduce((sum, e) => sum + (e.head ?? 0), 0) / weight : 0;
  const share = (field) => (weight ? members.reduce((sum, e) => sum + e[field], 0) / weight : 0);
  const torso = share('torso');
  const legs = share('legs');
  const offAxis = share('offAxis');
  const mean = (i) => (weight ? members.reduce((sum, e) => sum + e.hsl[i] * e.count, 0) / weight : 0);
  return { kind, hue: center, colors: members, weight, keys: region, height, headShare, torso, legs, offAxis, dull: mean(1) < 0.35, dim: mean(2) < 0.3 };
}

function candidatesOf(colors) {
  const bins = new Array(360 / BIN).fill(0);
  let opaque = 0;
  let light = 0;
  let dark = 0;
  for (const entry of colors.values()) {
    const [h, s, l] = entry.hsl;
    const count = entry.count;
    opaque += count;
    if (isOutline(entry.hsl) || entry.skin) continue;
    if (s < 0.25) {
      if (l >= 0.55) light += count;
      else if (l >= 0.1 && l < 0.45) dark += count;
      continue;
    }
    bins[Math.floor(h / BIN) % bins.length] += count;
  }
  const around = (i) => bins[i] + bins[(i + 1) % bins.length] + bins[(i - 1 + bins.length) % bins.length];
  const hues = [];
  const left = [...bins.keys()];
  while (hues.length < 2 && left.length) {
    const best = left.reduce((a, b) => (around(b) > around(a) ? b : a));
    if (!around(best)) break;
    const binCenter = best * BIN + BIN / 2;
    const seeds = [...colors.values()].filter((e) => !e.skin && !isOutline(e.hsl) && e.hsl[1] >= 0.2 && distance(e.hsl[0], binCenter) <= SEED_RANGE);
    hues.push({ kind: 'hue', hue: meanHue(seeds), weight: around(best) });
    for (const i of [best - 2, best - 1, best, best + 1, best + 2]) left.splice(left.indexOf((i + bins.length) % bins.length), left.includes((i + bins.length) % bins.length) ? 1 : 0);
  }
  const neutrals = [{ kind: 'light', hue: null, weight: light }, { kind: 'dark', hue: null, weight: dark }];
  const main = hues[0] && hues[0].weight >= opaque * MIN_SHARE && hues[0].weight >= Math.max(light, dark) * 0.6 ? hues[0] : neutrals.reduce((a, b) => (b.weight > a.weight ? b : a));
  const rest = [...hues, ...neutrals].filter((c) => c !== main && c.weight >= opaque * MIN_SHARE).sort((a, b) => b.weight - a.weight);
  return { main, second: rest[0] && rest[0].weight >= main.weight * SECOND_SHARE ? rest[0] : null };
}

const hexColor = (color) => `#${color.toString(16).padStart(6, '0')}`;
const rgbOf = (hexText) => [1, 3, 5].map((i) => parseInt(hexText.slice(i, i + 2), 16));

function shiftLike([hue, sat, light], neighbors) {
  const weight = neighbors.reduce((sum, n) => sum + n.weight, 0);
  const mean = (pick) => neighbors.reduce((sum, n) => sum + pick(n) * n.weight, 0) / weight;
  const x = mean((n) => Math.cos((n.to[0] * Math.PI) / 180) * Math.max(n.to[1], 0.01));
  const y = mean((n) => Math.sin((n.to[0] * Math.PI) / 180) * Math.max(n.to[1], 0.01));
  const targetHue = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const targetSat = clamp(mean((n) => n.to[1]) + (sat - mean((n) => n.from[1])) * 0.5, 0, 1);
  const targetLight = clamp(light + mean((n) => n.to[2] - n.from[2]), 0.04, 0.96);
  return hex(targetHue + clamp(signed(hue, mean((n) => n.from[0])), -30, 30) * 0.1, targetSat, targetLight);
}

export function completeHeadPieces(image, map) {
  const colors = paletteOf(image);
  const painted = new Map(map.map(([from, to]) => [parseInt(from.slice(1), 16), to]));
  const white = (entry) => chromaOf(entry.hsl) < NEUTRAL_CHROMA && entry.hsl[2] >= HEAD_PIECE_WHITE;
  const headPiece = (color, entry) => !painted.has(color) && !entry.skin && !isOutline(entry.hsl) && !white(entry) && entry.hairBand >= entry.count * HEAD_PIECE_SHARE;
  let grew = true;
  while (grew) {
    grew = false;
    for (const [color, entry] of colors) {
      if (!headPiece(color, entry)) continue;
      const contacts = [...entry.neighbors].filter(([other]) => !isOutline(colors.get(other).hsl));
      const total = contacts.reduce((sum, [, count]) => sum + count, 0);
      const touching = contacts.filter(([other]) => painted.has(other));
      if (!total || touching.reduce((sum, [, count]) => sum + count, 0) < total * HEAD_PIECE_CONTACT) continue;
      painted.set(color, shiftLike(entry.hsl, touching.map(([other, count]) => ({ from: colors.get(other).hsl, to: hsl(rgbOf(painted.get(other))), weight: count }))));
      grew = true;
    }
  }
  const mapped = new Set(map.map(([from]) => parseInt(from.slice(1), 16)));
  return [...map, ...[...painted].filter(([color]) => !mapped.has(color)).map(([color, to]) => [hexColor(color), to])];
}

export function colorRegions(image) {
  const colors = paletteOf(image);
  const { main, second } = candidatesOf(colors);
  const first = growRegion(colors, main.kind, main.hue, new Set());
  if (!second) return [first];
  const other = growRegion(colors, second.kind, second.hue, first.keys);
  return other.weight >= first.weight * SECOND_SHARE ? [first, other] : [first];
}

export const dominantRegion = (image) => colorRegions(image)[0];

export function topRegions(image, n, minShare = REGION_SHARE) {
  const colors = paletteOf(image);
  let opaque = 0;
  for (const { count } of colors.values()) opaque += count;
  const bins = new Map();
  let light = 0;
  let dark = 0;
  for (const entry of colors.values()) {
    const [h, s, l] = entry.hsl;
    if (isOutline(entry.hsl) || entry.skin) continue;
    if (s < 0.25) {
      if (l >= 0.55) light += entry.count;
      else if (l >= 0.1 && l < 0.45) dark += entry.count;
      continue;
    }
    const bin = Math.floor(h / BIN) % (360 / BIN);
    bins.set(bin, (bins.get(bin) ?? 0) + entry.count);
  }
  const candidates = [
    ...[...bins].map(([bin, weight]) => {
      const center = bin * BIN + BIN / 2;
      const seeds = [...colors.values()].filter((e) => !e.skin && !isOutline(e.hsl) && e.hsl[1] >= 0.2 && distance(e.hsl[0], center) <= BIN);
      return { kind: 'hue', hue: meanHue(seeds), weight };
    }),
    { kind: 'light', hue: null, weight: light },
    { kind: 'dark', hue: null, weight: dark },
  ].sort((a, b) => b.weight - a.weight);
  const regions = [];
  const taken = new Set();
  for (const candidate of candidates) {
    if (regions.length >= n || candidate.weight < opaque * minShare) continue;
    if (candidate.kind === 'hue' && regions.some((r) => r.kind === 'hue' && distance(r.hue, candidate.hue) < 40)) continue;
    const region = growRegion(colors, candidate.kind, candidate.hue, taken);
    if (region.weight < opaque * minShare) continue;
    region.keys.forEach((key) => taken.add(key));
    regions.push(region);
  }
  return regions;
}

export function pokemonPalette(image, n = 3) {
  const clusters = new Map();
  for (let i = 0; i < image.width * image.height; i++) {
    if (!image.rgba[i * 4 + 3]) continue;
    const rgb = [image.rgba[i * 4], image.rgba[i * 4 + 1], image.rgba[i * 4 + 2]];
    const [h, s, l] = hsl(rgb);
    if (l < 0.12) continue;
    const chroma = (Math.max(...rgb) - Math.min(...rgb)) / 255;
    const neutral = s < 0.18 || chroma < NEUTRAL_CHROMA;
    const key = neutral ? (l >= 0.7 ? 'light' : 'gray') : `h${Math.floor(((h + 12) % 360) / 24)}`;
    const cluster = clusters.get(key) ?? { neutral, count: 0, tones: new Map() };
    cluster.count += 1;
    const tone = (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    cluster.tones.set(tone, (cluster.tones.get(tone) ?? 0) + 1);
    clusters.set(key, cluster);
  }
  const colors = [...clusters.values()].map((cluster) => {
    const tones = [...cluster.tones].map(([tone, count]) => ({ hsl: hsl([tone >> 16, (tone >> 8) & 255, tone & 255]), count }));
    const mid = tones.filter(({ hsl: [, , l] }) => l >= 0.3 && l <= 0.8);
    const [hue, sat, light] = (mid.length ? mid : tones).reduce((a, b) => (b.count > a.count ? b : a)).hsl;
    return { hue, sat, light, count: cluster.count, neutral: cluster.neutral };
  });
  const merged = [];
  for (const color of colors.sort((a, b) => b.count - a.count)) {
    const near = merged.find((m) => m.neutral === color.neutral && (color.neutral ? Math.abs(m.light - color.light) < 0.2 : distance(m.hue, color.hue) < 30));
    if (near) near.count += color.count;
    else merged.push(color);
  }
  const weightOf = (color) => (color.neutral && color.light < 0.7 ? color.count * GRAY_WEIGHT : color.count);
  return merged.sort((a, b) => weightOf(b) - weightOf(a)).slice(0, n);
}

export function paintRegion(region, color) {
  const weight = region.colors.reduce((sum, e) => sum + e.count, 0) || 1;
  const meanS = region.colors.reduce((sum, e) => sum + e.hsl[1] * e.count, 0) / weight;
  const meanL = region.colors.reduce((sum, e) => sum + e.hsl[2] * e.count, 0) / weight;
  const lights = region.colors.map((e) => e.hsl[2]);
  const up = Math.max(...lights) - meanL;
  const down = meanL - Math.min(...lights);
  const white = color.neutral && color.light >= WHITE_FROM;
  const chromatic = !color.neutral;
  const base = white ? WHITE_BASE : Math.min(color.light, chromatic ? CHROMA_BASE_MAX : GRAY_BASE_MAX);
  const top = white ? WHITE_MAX_LIGHT : chromatic ? CHROMA_MAX_LIGHT : GRAY_MAX_LIGHT;
  const fit = Math.min(up > 0 ? (top - base) / up : Infinity, down > 0 ? (base - SHADE_FLOOR) / down : Infinity);
  const stretch = up + down > 0 ? MIN_SHADE_SPAN / (up + down) : 1;
  const contrast = Math.max(CHROMA_MIN_CONTRAST, Math.min(Math.max(white ? WHITE_CONTRAST : 1, stretch), fit));
  return region.colors.map(({ rgb, hsl: [h, s, l] }) => {
    const from = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    const hue = color.hue + (region.hue === null ? 0 : clamp(signed(h, region.hue), -30, 30) * 0.1);
    const sat = color.neutral ? clamp(color.sat + (s - meanS) * 0.3, 0, 0.22) : clamp(Math.min(color.sat, CHROMA_MAX_SAT) + (s - meanS) * 0.6, 0.12, CHROMA_MAX_SAT);
    const light = clamp(base + (l - meanL) * contrast, white ? 0.3 : 0.04, top);
    const capped = color.neutral ? light : Math.min(light, CHROMA_MAX_LIGHT);
    return [from, hex(hue, color.neutral ? sat : pastel(sat, capped), capped)];
  });
}

const pastel = (sat, light) => sat * clamp(1 - Math.max(0, light - HIGHLIGHT_FROM) * HIGHLIGHT_FADE, 0.35, 1);

function meanHue(entries) {
  let x = 0;
  let y = 0;
  for (const { hsl: [h, s], count } of entries) {
    x += Math.cos((h * Math.PI) / 180) * s * count;
    y += Math.sin((h * Math.PI) / 180) * s * count;
  }
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function visibleChange(region, map) {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let weight = 0;
  let total = 0;
  map.forEach(([from, to], i) => {
    const count = region.colors[i].count;
    const [a, b] = [rgb(from), rgb(to)];
    total += count * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    weight += count;
  });
  return weight ? total / weight : 0;
}

function seeded(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const farFrom = (a, b) => distance(a.hue, b.hue) >= 60 || Math.abs(a.light - b.light) >= 0.35 || Math.abs(a.sat - b.sat) >= 0.5;

function shuffledColors(seed) {
  const random = seeded(seed);
  return VARIANT_COLORS.map((color) => [random(), color]).sort((a, b) => a[0] - b[0]).map(([, color]) => color);
}

function rankFor(region, colors) {
  const candidates = colors
    .filter((color) => region.hue === null || distance(color.hue, region.hue) >= 70)
    .map((color) => ({ color, change: visibleChange(region, colorMap(region, color)) }));
  return [...candidates.filter((c) => c.change >= MIN_CHANGE), ...candidates.filter((c) => c.change < MIN_CHANGE).sort((a, b) => b.change - a.change)].map((c) => c.color);
}

export function pickTargets(base, region, count, usage = new Map(), already = []) {
  const clash = (picked, color) => picked.some((p) => p.key === color.key || (distance(p.hue, color.hue) < 35 && Math.abs(p.light - color.light) < 0.25));
  const handmadeNames = HANDMADE_VARIANTS.filter((variant) => variant.base === base).map((variant) => variant.name ?? '');
  const picked = [...already];
  const ranked = rankFor(region, shuffledColors(base));
  const strong = ranked.filter((color) => visibleChange(region, colorMap(region, color)) >= MIN_VISIBLE);
  const order = [...strong.sort((a, b) => (usage.get(a.key) ?? 0) - (usage.get(b.key) ?? 0)), ...ranked.filter((color) => !strong.includes(color))];
  for (const color of order.filter((color) => !handmadeNames.some((name) => name.endsWith(color.name)))) {
    if (picked.length >= count) break;
    if (!clash(picked, color)) picked.push(color);
  }
  for (const color of picked.slice(already.length)) usage.set(color.key, (usage.get(color.key) ?? 0) + 1);
  return picked;
}

function paintedLuma(region, map) {
  const to = new Map(map);
  let sum = 0;
  let weight = 0;
  for (const { rgb, count } of region.colors) {
    const target = to.get(`#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    if (!target) continue;
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(target.slice(i, i + 2), 16));
    sum += ((0.299 * r + 0.587 * g + 0.114 * b) / 255) * count;
    weight += count;
  }
  return weight ? sum / weight : 0;
}

export function pickSecond(base, region, main) {
  return rankFor(region, shuffledColors(`${base}:${main.key}`)).find((color) => farFrom(color, main)) ?? null;
}

export function colorMap(region, target, paint = false) {
  const spreadOf = paint ? target.look?.spread ?? 0.3 : 0.5;
  const limit = paint ? 30 : 45;
  if (paint && target.look) target = { ...target, ...target.look };
  const finish = (hue, sat, light) => {
    if (!paint) return hex(hue, clamp(sat, 0, 1), light);
    const capped = Math.min(light, CHROMA_MAX_LIGHT);
    return hex(hue, pastel(clamp(sat, 0, CHROMA_MAX_SAT), capped), capped);
  };
  return region.colors.map(({ rgb, hsl: [h, s, l] }) => {
    const from = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    if (region.kind === 'hue') {
      const sat = region.dull ? Math.min(Math.max(s, DULL_SAT) * Math.max(target.sat, 0.45), DARK_MAX_SAT) : s * target.sat;
      const light = region.dim ? Math.min((DARK_LIFT + l * DARK_GAIN) * target.light, DARK_MAX_LIGHT) : l * target.light;
      return [from, finish(target.hue + clamp(signed(h, region.hue), -limit, limit) * spreadOf, sat, clamp(light, 0.04, 0.96))];
    }
    if (region.kind === 'dark') return [from, finish(target.hue, Math.min(Math.max(s, DULL_SAT) * Math.max(target.sat, 0.45), DARK_MAX_SAT), clamp((DARK_LIFT + l * DARK_GAIN) * target.light, 0.06, DARK_MAX_LIGHT))];
    return [from, finish(target.hue, Math.max(s, 0.42) * Math.max(target.sat, 0.45), clamp(l * 0.92 * Math.min(target.light, 1.05), 0.04, 0.93))];
  });
}

function painterFor(base) {
  const [main, second] = colorRegions(loadTrainer(base));
  const neutralSuit = (region) => region && region.kind !== 'hue' && region.torso >= BODY_SHARE && region.legs >= BODY_SHARE;
  const meanLight = (region) => region.colors.reduce((sum, e) => sum + e.hsl[2] * e.count, 0) / Math.max(1, region.colors.reduce((sum, e) => sum + e.count, 0));
  const oneOutfit = neutralSuit(main) && neutralSuit(second) && Math.abs(meanLight(main) - meanLight(second)) <= SUIT_TONE_GAP;
  const counts = new Map([...main.colors, ...(second?.colors ?? [])].map((e) => [`#${e.rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`, e.count]));
  const changeOf = (map) => {
    let change = 0;
    let weight = 0;
    for (const [from, to] of map) {
      const n = counts.get(from) ?? 0;
      const [a, b] = [from, to].map((hex) => [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)));
      change += n * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      weight += n;
    }
    return weight ? change / weight : 0;
  };
  const mapFor = (target) => {
    const other = second && (oneOutfit ? target : pickSecond(base, second, target));
    const visible = (color) => visibleChange(main, colorMap(main, color, true)) >= MIN_VISIBLE;
    const scaled = (factor) => ({ ...target, light: target.light * factor, look: target.look && { ...target.look, light: target.look.light * factor } });
    const bright = (color) => paintedLuma(main, colorMap(main, color, true)) > MAX_LUMA;
    const painted = [target, ...[0.7, 0.55].map(scaled)].find((color) => visible(color) && !bright(color)) ?? [0.85, 0.7, 0.55].map(scaled).find((color) => !bright(color)) ?? target;
    const build = (color) => [...colorMap(main, color, true), ...(other ? colorMap(second, other, true) : [])];
    const maps = [painted, ...[1.2, 1.4].map(scaled)].map(build);
    return maps.find((map) => changeOf(map) >= VARIANT_MIN_CHANGE) ?? maps[0];
  };
  return { changeOf, mapFor };
}

function plan() {
  const usage = new Map();
  const handmade = new Map();
  for (const variant of HANDMADE_VARIANTS) if (!variant.pokemon) handmade.set(variant.base, (handmade.get(variant.base) ?? 0) + 1);
  const variants = [];
  for (const base of DOWNLOADED_SPRITES) {
    const soldHandmade = HANDMADE_VARIANTS.some((variant) => variant.base === base && variant.key in SHOP_TRAINERS);
    const count = Math.max(1, variantsWanted(base) - (handmade.get(base) ?? 0));
    if (!count) continue;
    const [main, second] = colorRegions(loadTrainer(base));
    const { changeOf, mapFor } = painterFor(base);
    const earnedAt = (targets, target, i) => PARTNER_VARIANTS.has(`${base}__${target.key}`) || (targets.length > 1 && i % 2 === 0);
    const bought = Object.keys(SHIPPED_RECOLORS).filter((key) => key.startsWith(`${base}__`)).map((key) => VARIANT_COLORS.find((color) => color.key === key.slice(base.length + 2))).filter(Boolean);
    for (const color of bought) usage.set(color.key, (usage.get(color.key) ?? 0) + 1);
    let targets = pickTargets(base, main, Math.max(count, bought.length), usage, bought);
    if (!soldHandmade && targets.every((target, i) => earnedAt(targets, target, i))) targets = pickTargets(base, main, targets.length + 1, usage, targets);
    const total = (handmade.get(base) ?? 0) + targets.length;
    const extra = total === 1 ? pickTargets(base, main, targets.length + 4).find((color) => !targets.some((t) => t.key === color.key || (Math.abs(((t.hue - color.hue + 540) % 360) - 180) < 35 && Math.abs(t.light - color.light) < 0.25))) : null;
    const sold = new Set();
    if (extra) {
      targets = [...targets, extra];
      sold.add(extra.key);
    }
    targets = targets.map((target) => {
      if (bought.includes(target) || changeOf(mapFor(target)) >= VARIANT_MIN_CHANGE) return target;
      const spare = [...VARIANT_COLORS]
        .filter((color) => !targets.some((t) => t.key === color.key))
        .sort((a, b) => (usage.get(a.key) ?? 0) - (usage.get(b.key) ?? 0))
        .find((color) => changeOf(mapFor(color)) >= VARIANT_MIN_CHANGE);
      if (!spare) return target;
      usage.set(target.key, (usage.get(target.key) ?? 1) - 1);
      usage.set(spare.key, (usage.get(spare.key) ?? 0) + 1);
      return spare;
    });
    targets.forEach((target, i) => {
      const map = mapFor(target);
      const earned = sold.has(target.key) || bought.includes(target) ? false : earnedAt(targets, target, i);
      variants.push({ key: `${base}__${target.key}`, base, color: target.key, ...(earned ? { earn: true } : {}), map });
    });
  }
  return sharePairColors(variants).map((variant) => ({ ...variant, map: completeHeadPieces(loadTrainer(variant.base), variant.map) }));
}

function sharePairColors(variants) {
  const colorsOf = (base) => variants.filter((variant) => variant.base === base);
  const shipped = (base, color) => `${base}__${color}` in SHIPPED_RECOLORS;
  const shared = Object.entries(MALE_OF).flatMap(([female, male]) => {
    const colors = [...colorsOf(male), ...colorsOf(female).filter((variant) => shipped(female, variant.color) && !colorsOf(male).some((other) => other.color === variant.color))];
    return [male, female].flatMap((base) => {
      const { mapFor } = painterFor(base);
      return colors.map(({ color, earn }) => ({ key: `${base}__${color}`, base, color, ...(earn ? { earn: true } : {}), map: mapFor(VARIANT_COLORS.find((target) => target.key === color)) }));
    });
  });
  const pairBases = new Set([...Object.keys(MALE_OF), ...Object.values(MALE_OF)]);
  const order = new Map(DOWNLOADED_SPRITES.map((base, i) => [base, i]));
  return [...variants.filter((variant) => !pairBases.has(variant.base)), ...shared].sort((a, b) => order.get(a.base) - order.get(b.base));
}

const BW_SPRITES = 'sprites/pokemon/versions/generation-v/black-white/';

async function pokemonSprite(id, side, shiny) {
  const local = new URL(`../public/sprites/${id}-${side}${shiny ? '-shiny' : ''}.png`, import.meta.url);
  if (existsSync(local)) return decodePng(readFileSync(local));
  const response = await fetchUpstream(UPSTREAM.sprites, `${BW_SPRITES}${side === 'back' ? 'back/' : ''}${shiny ? 'shiny/' : ''}${id}.png`);
  if (!response.ok) throw new Error(`No pude bajar el sprite ${side}${shiny ? ' shiny' : ''} de #${id}.`);
  return decodePng(Buffer.from(await response.arrayBuffer()));
}

async function pokemonMaps() {
  const maps = {};
  for (const variant of [...HANDMADE_VARIANTS.filter((v) => v.pokemon), ...SHINY_VARIANTS]) {
    const trainer = loadTrainer(variant.base);
    const [front, back] = await Promise.all(['front', 'back'].map((side) => pokemonSprite(variant.pokemon, side, variant.shiny)));
    const sprite = { width: front.width, height: front.height + back.height, rgba: Buffer.concat([front.rgba, back.rgba]) };
    const palette = pokemonPalette(sprite, 3);
    const opaque = trainer.rgba.filter((_, i) => i % 4 === 3 && trainer.rgba[i] > 0).length;
    const found = topRegions(trainer, 3, POKEMON_REGION_SHARE);
    const suits = found.filter((region) => region.torso >= BODY_SHARE && region.legs >= BODY_SHARE && region.headShare < HAIR_SHARE);
    const suit = suits.length ? suits.reduce((a, b) => (b.torso > a.torso ? b : a)) : null;
    const [first, second] = found;
    const pantsFirst = !suit && first && second && first.height >= PANTS_LINE && second.height < first.height && second.headShare < HAIR_SHARE && second.weight >= first.weight * COMPARABLE;
    const ordered = suit ? [suit, ...found.filter((region) => region !== suit)] : pantsFirst ? [second, first, ...found.slice(2)] : found;
    const regions = ordered.filter((region, i) => i < 2 || region.weight >= opaque * THIRD_SHARE);
    const colors = suit ? [palette[0], ...palette.slice(1).filter((color) => !color.neutral), ...palette.slice(1).filter((color) => color.neutral)] : palette;
    maps[variant.key] = completeHeadPieces(trainer, regions.flatMap((region, i) => (colors[i] ? paintRegion(region, colors[i]) : [])));
  }
  return maps;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const variants = plan();
  const soldNow = new Set(variants.filter((v) => !v.earn).map((v) => v.key));
  const retired = Object.fromEntries(Object.entries(SHIPPED_RECOLORS).filter(([key]) => !soldNow.has(key)));
  const maps = await pokemonMaps();
  const quote = (value) => JSON.stringify(value).replace(/"/g, "'");
  const lines = variants.map((v) => `  { key: ${quote(v.key)}, base: ${quote(v.base)}, color: ${quote(v.color)},${v.earn ? ' earn: true,' : ''} map: ${quote(v.map)} },`);
  writeFileSync(
    OUT,
    `export const VARIANT_COLOR_NAMES = ${quote(Object.fromEntries(VARIANT_COLORS.map((c) => [c.key, c.name])))};\n\n` +
      `export const VARIANT_COLOR_TYPES = ${quote(Object.fromEntries(VARIANT_COLORS.map((c) => [c.key, c.type])))};\n\n` +
      `export const RETIRED_GENERATED = ${quote(retired)};\n\n` +
      `export const GENERATED_VARIANTS = [\n${lines.join('\n')}\n];\n\n` +
      `export const POKEMON_VARIANT_MAPS = {\n${Object.entries(maps).map(([key, map]) => `  ${key}: ${quote(map)},`).join('\n')}\n};\n`,
  );
  const uses = {};
  for (const v of variants) uses[v.color] = (uses[v.color] ?? 0) + 1;
  console.log(`Variantes planificadas: ${variants.length}.`, uses);
}

#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { decodePng } from './sync-trainers.js';
import { CHAMPIONS, DOWNLOADED_SPRITES, HANDMADE_VARIANTS, VILLAINS } from '../public/trainer-sprites.js';

const TRAINERS = new URL('../public/trainers/', import.meta.url);
const OUT = new URL('../public/trainer-variants.js', import.meta.url);

export const VARIANT_COLORS = [
  { key: 'crimson', name: 'Carmesí', type: 'fire', hue: 355, sat: 1, light: 1 },
  { key: 'coral', name: 'Coral', type: 'fighting', hue: 10, sat: 0.95, light: 1.15 },
  { key: 'bronze', name: 'Bronce', type: 'rock', hue: 26, sat: 0.6, light: 0.85 },
  { key: 'amber', name: 'Ámbar', type: 'ground', hue: 34, sat: 1, light: 1 },
  { key: 'gold', name: 'Dorado', type: 'electric', hue: 48, sat: 1, light: 1.08 },
  { key: 'ivory', name: 'Marfil', type: 'normal', hue: 45, sat: 0.3, light: 1.3 },
  { key: 'olive', name: 'Oliva', type: 'bug', hue: 70, sat: 0.55, light: 0.8 },
  { key: 'lime', name: 'Lima', type: 'grass', hue: 88, sat: 0.95, light: 1.08 },
  { key: 'emerald', name: 'Esmeralda', type: 'grass', hue: 140, sat: 0.9, light: 0.92 },
  { key: 'mint', name: 'Menta', type: 'ice', hue: 158, sat: 0.6, light: 1.22 },
  { key: 'teal', name: 'Turquesa', type: 'water', hue: 180, sat: 0.9, light: 0.95 },
  { key: 'sky', name: 'Celeste', type: 'flying', hue: 200, sat: 0.75, light: 1.2 },
  { key: 'sapphire', name: 'Zafiro', type: 'water', hue: 218, sat: 1, light: 0.9 },
  { key: 'slate', name: 'Pizarra', type: 'steel', hue: 215, sat: 0.22, light: 0.95 },
  { key: 'indigo', name: 'Índigo', type: 'dragon', hue: 240, sat: 0.85, light: 0.8 },
  { key: 'violet', name: 'Violeta', type: 'ghost', hue: 272, sat: 0.95, light: 0.95 },
  { key: 'lavender', name: 'Lavanda', type: 'psychic', hue: 268, sat: 0.5, light: 1.25 },
  { key: 'magenta', name: 'Magenta', type: 'poison', hue: 305, sat: 0.95, light: 1 },
  { key: 'rose', name: 'Rosa', type: 'fairy', hue: 332, sat: 0.85, light: 1.15 },
  { key: 'wine', name: 'Burdeos', type: 'dark', hue: 345, sat: 0.75, light: 0.7 },
];

const STORY = new Set([...CHAMPIONS, ...VILLAINS.boss, ...VILLAINS.legend]);
const MAIN = new Set([...VILLAINS.star, 'player_m', 'player_f', 'rival_m', 'rival_f', 'nate', 'rosa', 'hugh']);
const BIN = 30;
const MIN_SHARE = 0.08;
const NEIGHBOR_SHARE = 0.25;
const SEED_RANGE = 40;
const SHADE_RANGE = 55;
const MIN_CHANGE = 70;
const SECOND_SHARE = 0.5;
const SKIN_SHADE_SHARE = 0.5;
const SKIN_TOUCH = 0.25;

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

export const isSkin = ([h, s, l]) => h >= 6 && h <= 38 && ((s >= 0.15 && s <= 0.7 && l >= 0.18 && l <= 0.93) || (l >= 0.72 && s >= 0.15));
const isOutline = ([, , l]) => l < 0.07;

function paletteOf(image) {
  const colors = new Map();
  const at = (i) => image.rgba.readUIntBE(i * 4, 3);
  const touch = (a, b) => {
    const entry = colors.get(a);
    entry.neighbors.set(b, (entry.neighbors.get(b) ?? 0) + 1);
  };
  for (let i = 0; i < image.width * image.height; i++) {
    if (!image.rgba[i * 4 + 3]) continue;
    const c = at(i);
    if (!colors.has(c)) colors.set(c, { rgb: [c >> 16, (c >> 8) & 255, c & 255], count: 0, neighbors: new Map() });
    colors.get(c).count += 1;
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
  return colors;
}

const isCoreSkin = ([h, s, l]) => isSkin([h, s, l]) && l >= 0.45;
const warm = (h) => h >= 330 || h <= 40;

function touchesSkin(colors, entry) {
  const total = [...entry.neighbors.values()].reduce((a, b) => a + b, 0);
  const skin = [...entry.neighbors].filter(([n]) => isCoreSkin(colors.get(n).hsl)).reduce((a, [, k]) => a + k, 0);
  return warm(entry.hsl[0]) && entry.hsl[1] >= 0.15 && total > 0 && skin / total >= SKIN_TOUCH;
}

function growRegion(colors, kind, center, taken) {
  const free = (c, entry) => !taken.has(c) && !isSkin(entry.hsl) && !isOutline(entry.hsl) && !touchesSkin(colors, entry);
  const neutralFits = ([, s, l]) => (kind === 'dark' ? l <= 0.6 : kind === 'light' ? l >= 0.3 : true) && !(s < 0.1 && (l > 0.9 || l < 0.1) && kind === 'hue');
  const inSeed = ([h, s, l]) => (kind === 'hue' ? (s >= 0.15 && distance(h, center) <= SEED_RANGE) || (s >= 0.1 && l < 0.45 && distance(h, center) <= SHADE_RANGE) : kind === 'light' ? s < 0.25 && l >= 0.55 : s < 0.25 && l >= 0.1 && l < 0.45);
  const region = new Set([...colors].filter(([c, entry]) => free(c, entry) && inSeed(entry.hsl)).map(([c]) => c));
  for (let round = 0; round < 3; round++)
    for (const [c, entry] of colors) {
      if (region.has(c) || taken.has(c) || isOutline(entry.hsl) || touchesSkin(colors, entry) || !neutralFits(entry.hsl)) continue;
      const total = [...entry.neighbors.values()].reduce((a, b) => a + b, 0);
      const near = [...entry.neighbors].filter(([n]) => region.has(n)).reduce((a, [, k]) => a + k, 0);
      const share = total ? near / total : 0;
      const fits = kind !== 'hue' || distance(entry.hsl[0], center) <= 100 || entry.hsl[1] < 0.35;
      const shadeOfRegion = kind !== 'hue' ? entry.hsl[1] < 0.45 : distance(entry.hsl[0], center) <= 45;
      if (isSkin(entry.hsl) ? share >= SKIN_SHADE_SHARE && shadeOfRegion : share >= NEIGHBOR_SHARE && fits) region.add(c);
    }
  const members = [...region].map((c) => colors.get(c));
  const weight = members.reduce((sum, e) => sum + e.count, 0);
  const mean = (i) => (weight ? members.reduce((sum, e) => sum + e.hsl[i] * e.count, 0) / weight : 0);
  return { kind, hue: center, colors: members, weight, keys: region, dull: mean(1) < 0.35, dim: mean(2) < 0.3 };
}

function candidatesOf(colors) {
  const bins = new Array(360 / BIN).fill(0);
  let opaque = 0;
  let light = 0;
  let dark = 0;
  for (const { hsl: [h, s, l], count } of colors.values()) {
    opaque += count;
    if (isOutline([h, s, l]) || isSkin([h, s, l])) continue;
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
    const seeds = [...colors.values()].filter((e) => !isSkin(e.hsl) && !isOutline(e.hsl) && e.hsl[1] >= 0.2 && distance(e.hsl[0], binCenter) <= SEED_RANGE);
    hues.push({ kind: 'hue', hue: meanHue(seeds), weight: around(best) });
    for (const i of [best - 2, best - 1, best, best + 1, best + 2]) left.splice(left.indexOf((i + bins.length) % bins.length), left.includes((i + bins.length) % bins.length) ? 1 : 0);
  }
  const neutrals = [{ kind: 'light', hue: null, weight: light }, { kind: 'dark', hue: null, weight: dark }];
  const main = hues[0] && hues[0].weight >= opaque * MIN_SHARE && hues[0].weight >= Math.max(light, dark) * 0.6 ? hues[0] : neutrals.reduce((a, b) => (b.weight > a.weight ? b : a));
  const rest = [...hues, ...neutrals].filter((c) => c !== main && c.weight >= opaque * MIN_SHARE).sort((a, b) => b.weight - a.weight);
  return { main, second: rest[0] && rest[0].weight >= main.weight * SECOND_SHARE ? rest[0] : null };
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

export function pickTargets(base, region, count) {
  const clash = (picked, color) => picked.some((p) => distance(p.hue, color.hue) < 35 && Math.abs(p.light - color.light) < 0.25);
  const picked = [];
  for (const color of rankFor(region, shuffledColors(base))) {
    if (picked.length >= count) break;
    if (!clash(picked, color)) picked.push(color);
  }
  return picked;
}

export function pickSecond(base, region, main) {
  return rankFor(region, shuffledColors(`${base}:${main.key}`)).find((color) => farFrom(color, main)) ?? null;
}

export function colorMap(region, target) {
  return region.colors.map(({ rgb, hsl: [h, s, l] }) => {
    const from = `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    if (region.kind === 'hue') {
      const sat = (region.dull ? Math.max(s, 0.5) * Math.max(target.sat, 0.45) : s * target.sat);
      const light = region.dim ? (0.1 + l * 1.35) * target.light : l * target.light;
      return [from, hex(target.hue + clamp(signed(h, region.hue), -45, 45) * 0.5, clamp(sat, 0, 1), clamp(light, 0.04, 0.96))];
    }
    if (region.kind === 'dark') return [from, hex(target.hue, clamp(Math.max(s, 0.55) * Math.max(target.sat, 0.45), 0, 1), clamp((0.1 + l * 1.35) * target.light, 0.08, 0.7))];
    return [from, hex(target.hue, clamp(Math.max(s, 0.42) * Math.max(target.sat, 0.45), 0, 1), clamp(l * 0.92 * Math.min(target.light, 1.05), 0.04, 0.93))];
  });
}

function plan() {
  const handmade = new Map();
  for (const variant of HANDMADE_VARIANTS) handmade.set(variant.base, (handmade.get(variant.base) ?? 0) + 1);
  const variants = [];
  for (const base of DOWNLOADED_SPRITES) {
    const count = Math.max(0, variantsWanted(base) - (handmade.get(base) ?? 0));
    if (!count) continue;
    const [main, second] = colorRegions(decodePng(readFileSync(new URL(`${base}.png`, TRAINERS))));
    pickTargets(base, main, count).forEach((target, i) => {
      const other = second && pickSecond(base, second, target);
      const map = [...colorMap(main, target), ...(other ? colorMap(second, other) : [])];
      variants.push({ key: `${base}__${target.key}`, base, color: target.key, ...(i % 2 === 0 ? { earn: true } : {}), map });
    });
  }
  return variants;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const variants = plan();
  const quote = (value) => JSON.stringify(value).replace(/"/g, "'");
  const lines = variants.map((v) => `  { key: ${quote(v.key)}, base: ${quote(v.base)}, color: ${quote(v.color)},${v.earn ? ' earn: true,' : ''} map: ${quote(v.map)} },`);
  writeFileSync(
    OUT,
    `export const VARIANT_COLOR_NAMES = ${quote(Object.fromEntries(VARIANT_COLORS.map((c) => [c.key, c.name])))};\n\n` +
      `export const VARIANT_COLOR_TYPES = ${quote(Object.fromEntries(VARIANT_COLORS.map((c) => [c.key, c.type])))};\n\n` +
      `export const GENERATED_VARIANTS = [\n${lines.join('\n')}\n];\n`,
  );
  const uses = {};
  for (const v of variants) uses[v.color] = (uses[v.color] ?? 0) + 1;
  console.log(`Variantes planificadas: ${variants.length}.`, uses);
}

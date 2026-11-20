#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { decodePng, faceOf } from './sync-trainers.js';
import { UPSTREAM } from '../public/upstream.js';
import { fetchUpstream } from './upstream-files.js';
import * as previous from '../public/trainer-variants.js';
import { chromaOf, hexOf, hslOf, isNeutral, lumaOf, meanHue, paintAround, paintRamp, paintRampWithTones, rampsOf, rgbOfHsl } from './sprite-ramps.mjs';
import { CHAMPIONS, DOWNLOADED_SPRITES, FEMALE_OF, HANDMADE_VARIANTS, MALE_OF, MERGED_TRAINERS, SHINY_VARIANTS, SHOP_TRAINERS, VILLAINS } from '../public/trainer-sprites.js';

const PUBLISHED = previous.GENERATED_VARIANTS;
const renames = {};
const TRAINERS = new URL('../public/trainers/', import.meta.url);
const SHIPPED_RECOLORS = JSON.parse(readFileSync(new URL('./shipped-recolors.json', import.meta.url), 'utf8'));
const OUT = new URL('../public/trainer-variants.js', import.meta.url);

export const VARIANT_COLORS = [
  { key: 'crimson', name: 'Carmesí', type: 'fire', family: 'fire', hue: 355, sat: 1, light: 1 },
  { key: 'coral', name: 'Coral', type: 'fighting', family: 'fire', hue: 10, sat: 0.9, light: 1 },
  { key: 'bronze', name: 'Bronce', type: 'rock', family: 'sun', hue: 26, sat: 0.6, light: 0.85 },
  { key: 'amber', name: 'Ámbar', type: 'ground', family: 'sun', hue: 34, sat: 0.95, light: 0.9 },
  { key: 'gold', name: 'Dorado', type: 'electric', family: 'sun', hue: 48, sat: 1, light: 1.08, look: { hue: 43, sat: 0.92, light: 0.98, spread: 0.2 } },
  { key: 'ivory', name: 'Marfil', type: 'normal', family: 'stone', hue: 45, sat: 0.3, light: 1.12 },
  { key: 'olive', name: 'Oliva', type: 'bug', family: 'leaf', hue: 70, sat: 0.55, light: 0.72 },
  { key: 'lime', name: 'Lima', type: 'grass', family: 'leaf', hue: 92, sat: 0.8, light: 0.82 },
  { key: 'emerald', name: 'Esmeralda', type: 'grass', family: 'leaf', hue: 140, sat: 0.9, light: 0.92 },
  { key: 'mint', name: 'Menta', type: 'ice', family: 'leaf', hue: 158, sat: 0.55, light: 1 },
  { key: 'teal', name: 'Turquesa', type: 'water', family: 'water', hue: 182, sat: 0.62, light: 0.78 },
  { key: 'sky', name: 'Celeste', type: 'flying', family: 'water', hue: 200, sat: 0.75, light: 1.05, look: { hue: 207, sat: 0.85, light: 1.05, spread: 0.15 } },
  { key: 'sapphire', name: 'Zafiro', type: 'water', family: 'water', hue: 218, sat: 1, light: 0.9 },
  { key: 'slate', name: 'Pizarra', type: 'steel', family: 'stone', hue: 215, sat: 0.22, light: 0.95 },
  { key: 'indigo', name: 'Índigo', type: 'dragon', family: 'night', hue: 240, sat: 0.85, light: 0.8 },
  { key: 'violet', name: 'Violeta', type: 'ghost', family: 'night', hue: 272, sat: 0.95, light: 0.95 },
  { key: 'lavender', name: 'Lavanda', type: 'psychic', family: 'bloom', hue: 268, sat: 0.5, light: 1.05 },
  { key: 'magenta', name: 'Magenta', type: 'poison', family: 'bloom', hue: 305, sat: 0.95, light: 1 },
  { key: 'rose', name: 'Rosa', type: 'fairy', family: 'bloom', hue: 332, sat: 0.85, light: 1 },
  { key: 'rust', name: 'Óxido', type: 'steel', family: 'fire', hue: 16, sat: 0.7, light: 0.72 },
  { key: 'peach', name: 'Durazno', type: 'normal', family: 'sun', hue: 22, sat: 0.6, light: 1 },
  { key: 'forest', name: 'Bosque', type: 'grass', family: 'leaf', hue: 128, sat: 0.55, light: 0.62 },
  { key: 'navy', name: 'Marino', type: 'water', family: 'water', hue: 225, sat: 0.65, light: 0.6 },
  { key: 'plum', name: 'Ciruela', type: 'poison', family: 'night', hue: 292, sat: 0.55, light: 0.68 },
  { key: 'wine', name: 'Burdeos', type: 'dark', family: 'fire', hue: 345, sat: 0.75, light: 0.7, look: { hue: 352, sat: 0.8, light: 0.6, spread: 0.15 } },
];

export const COMBO_NAMES = {
  'fire+fire': ['Brasa', 'Infierno'],
  'fire+sun': ['Fénix', 'Lava'],
  'fire+leaf': ['Manzana', 'Navidad'],
  'fire+water': ['Vapor', 'Héroe'],
  'fire+night': ['Vampiro', 'Ocaso'],
  'bloom+fire': ['Pasión', 'Cereza'],
  'fire+stone': ['Forja', 'Ceniza'],
  'sun+sun': ['Solar', 'Arena'],
  'leaf+sun': ['Cítrico', 'Otoño'],
  'sun+water': ['Playa', 'Verano'],
  'night+sun': ['Realeza', 'Faraón'],
  'bloom+sun': ['Atardecer', 'Mango'],
  'stone+sun': ['Trigo', 'Desierto'],
  'leaf+leaf': ['Jungla', 'Musgo'],
  'leaf+water': ['Laguna', 'Selva'],
  'leaf+night': ['Pantano', 'Veneno'],
  'bloom+leaf': ['Pradera', 'Jardín'],
  'leaf+stone': ['Liquen', 'Salvia'],
  'water+water': ['Océano', 'Abismo'],
  'night+water': ['Galaxia', 'Nocturno'],
  'bloom+water': ['Sirena', 'Algodón'],
  'stone+water': ['Glaciar', 'Acero'],
  'night+night': ['Sombra', 'Eclipse'],
  'bloom+night': ['Orquídea', 'Hechizo'],
  'night+stone': ['Niebla', 'Humo'],
  'bloom+bloom': ['Pétalo', 'Rubor'],
  'bloom+stone': ['Perla', 'Nácar'],
  'stone+stone': ['Plata', 'Grafito'],
};

export function comboTitle(color, accent, taken) {
  const families = [color, accent].map((key) => VARIANT_COLORS.find((c) => c.key === key).family).sort().join('+');
  const words = COMBO_NAMES[families];
  return words.find((word) => !taken.has(word)) ?? null;
}

const STORY = new Set([...CHAMPIONS, ...VILLAINS.boss, ...VILLAINS.legend]);
const MAIN = new Set([...VILLAINS.star, 'player_m', 'player_f', 'rival_m', 'rival_f', 'nate', 'rosa', 'hugh']);
const MATERIAL_HUE = 20;
const TONE_SHARE = 0.04;
const POKEMON_LIGHT_REACH = 0.22;
const RECOGNIZABLE_LIGHT = 0.38;
const LIGHTER_EASE = 0.35;
const BYSTANDER_SHARE = 0.04;
const DETAIL_SHARE = 0.005;
const INK_FROM = 0.3;
const INK_HUE = 222;
const INK_SAT = 0.3;
const INK_DARK = 0.16;
const INK_LIGHT = 0.82;
const CLASH_HUE = 40;
const AWKWARD = [65, 95];
const NEIGHBOR_SHIFTS = [-20, 20, -40, 40];
const BYSTANDER_SAT = 0.35;
const SIMILAR_HUE = 55;
const SIMILAR_LIGHT = 0.25;
const MUTED_TARGET = 0.4;
const HUE_PREFERENCE = 0.6;
const SKIN_REUSE = 0.04;
const OUTFIT_SHARE = 0.03;
const HAIR_LINE = 0.5;
const HAIR_MIN_SHARE = 0.02;
const NEUTRAL_SAT = 0.18;
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
const WHITE_FROM = 0.8;
const WHITE_BASE = 0.7;
const CHROMA_MAX_SAT = 0.82;
const NEUTRAL_CHROMA = 0.12;
const COMPARABLE = 0.4;

export const variantsWanted = (key) => (STORY.has(key) ? 4 : MAIN.has(key) ? 3 : 1);

export const hsl = hslOf;

const hex = (h, s, l) => hexOf(rgbOfHsl(h, s, l));

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const distance = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));


export const isSkin = ([h, s, l]) =>
  h >= 6 && h <= 38 && ((s >= 0.15 && s <= 0.7 && l >= 0.18 && l <= 0.93) || (l >= 0.72 && s >= 0.15) || (l >= 0.18 && l <= 0.93 && chromaOf([h, s, l]) >= SKIN_MIN_CHROMA && chromaOf([h, s, l]) <= SKIN_MAX_CHROMA));

let skinTones = null;

function sharedSkinTones() {
  if (skinTones) return skinTones;
  const seen = new Map();
  const found = DOWNLOADED_SPRITES.filter((base) => existsSync(new URL(`${base}.png`, TRAINERS)));
  for (const base of found) {
    const image = decodePng(readFileSync(new URL(`${base}.png`, TRAINERS)));
    const colors = new Set();
    for (let i = 0; i < image.width * image.height; i++) if (image.rgba[i * 4 + 3]) colors.add(image.rgba.readUIntBE(i * 4, 3));
    for (const c of colors) seen.set(c, (seen.get(c) ?? 0) + 1);
  }
  skinTones = new Set([...seen].filter(([c, n]) => n >= found.length * SKIN_REUSE && chromaOf(hsl([c >> 16, (c >> 8) & 255, c & 255])) >= NEUTRAL_CHROMA).map(([c]) => c));
  return skinTones;
}

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
  const face = faceOf(image);
  if (face) {
    const half = (face.h * image.height) / 2;
    const [cx, cy] = [face.x * image.width, face.y * image.height];
    for (let y = Math.max(0, Math.floor(cy - half)); y < Math.min(image.height, Math.ceil(cy + half)); y++)
      for (let x = Math.max(0, Math.floor(cx - half)); x < Math.min(image.width, Math.ceil(cx + half)); x++) {
        const i = y * image.width + x;
        if (image.rgba[i * 4 + 3]) colors.get(at(i)).face = (colors.get(at(i)).face ?? 0) + 1;
      }
  }
  markSkin(image, colors);
  const reused = sharedSkinTones();
  for (const [c, entry] of colors) entry.canonSkin = reused.has(c);
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



const hexColor = (color) => `#${color.toString(16).padStart(6, '0')}`;
const rgbOf = (hexText) => [1, 3, 5].map((i) => parseInt(hexText.slice(i, i + 2), 16));

export function completeHeadPieces(image, map) {
  const colors = paletteOf(image);
  const { ramps, shared } = rampsOf(colors);
  const rampOf = new Map(ramps.flatMap((ramp) => [...ramp.keys].map((key) => [key, ramp])));
  const painted = new Map(map.filter((entry) => entry.length === 2).map(([from, to]) => [parseInt(from.slice(1), 16), to]));
  const white = (entry) => chromaOf(entry.hsl) < NEUTRAL_CHROMA && entry.hsl[2] >= HEAD_PIECE_WHITE;
  const headPiece = (color, entry) => !painted.has(color) && !shared.has(color) && rampOf.has(color) && !rampOf.get(color).skin && !entry.skin && !white(entry) && entry.hairBand >= entry.count * HEAD_PIECE_SHARE;
  let grew = true;
  while (grew) {
    grew = false;
    for (const [color, entry] of colors) {
      if (!headPiece(color, entry)) continue;
      const contacts = [...entry.neighbors].filter(([other]) => !shared.has(other));
      const total = contacts.reduce((sum, [, count]) => sum + count, 0);
      const touching = contacts.filter(([other]) => painted.has(other));
      if (!total || touching.reduce((sum, [, count]) => sum + count, 0) < total * HEAD_PIECE_CONTACT) continue;
      const ramp = rampOf.get(color);
      for (const [from, to] of paintRamp(ramp, followTouching(colors, painted, touching))) painted.set(parseInt(from.slice(1), 16), to);
      grew = true;
    }
  }
  const mapped = new Set(map.filter((entry) => entry.length === 2).map(([from]) => parseInt(from.slice(1), 16)));
  const added = [...painted].filter(([color]) => !mapped.has(color)).map(([color, to]) => [hexColor(color), to]);
  const whole = new Set(added.map(([from]) => from));
  return [...map.filter((entry) => entry.length === 2 || !whole.has(entry[0])), ...added];
}

function followTouching(colors, painted, touching) {
  const pairs = touching.map(([other, weight]) => ({ from: colors.get(other).hsl, to: hsl(rgbOf(painted.get(other))), weight }));
  const weight = pairs.reduce((sum, p) => sum + p.weight, 0) || 1;
  const mean = (pick) => pairs.reduce((sum, p) => sum + pick(p) * p.weight, 0) / weight;
  const x = mean((p) => Math.cos((p.to[0] * Math.PI) / 180) * Math.max(p.to[1], 0.01));
  const y = mean((p) => Math.sin((p.to[0] * Math.PI) / 180) * Math.max(p.to[1], 0.01));
  return {
    hue: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
    sat: clamp(mean((p) => p.to[1]) / Math.max(0.05, mean((p) => p.from[1])), 0.3, 2),
    light: clamp(mean((p) => p.to[2]) / Math.max(0.05, mean((p) => p.from[2])), 0.4, 1.6),
  };
}

function materialsOf(image) {
  const colors = paletteOf(image);
  const opaque = [...colors.values()].reduce((sum, e) => sum + e.count, 0);
  const groups = [];
  for (const ramp of rampsOf(colors).ramps.filter((r) => !r.skin)) {
    const group = ramp.neutral ? null : groups.find((g) => g.hue !== null && distance(g.hue, ramp.hue) <= MATERIAL_HUE);
    if (group) group.ramps.push(ramp);
    else groups.push({ hue: ramp.hue, ramps: [ramp] });
  }
  return { opaque, materials: groups.map(({ ramps }) => materialOf(ramps)).sort((a, b) => b.weight - a.weight) };
}

function materialOf(ramps) {
  const colors = ramps.flatMap((ramp) => ramp.colors);
  const weight = colors.reduce((sum, e) => sum + e.count, 0);
  const share = (pick) => (weight ? colors.reduce((sum, e) => sum + pick(e), 0) / weight : 0);
  const chromatic = colors.filter((e) => !isNeutral(e));
  const meanLight = share((e) => e.hsl[2] * e.count);
  return {
    kind: chromatic.length ? 'hue' : meanLight >= 0.5 ? 'light' : 'dark',
    hue: chromatic.length ? meanHue(chromatic) : null,
    ramps,
    colors,
    weight,
    keys: new Set(colors.map((e) => parseInt(hexOf(e.rgb).slice(1), 16))),
    height: share((e) => e.sumY),
    headShare: share((e) => e.head ?? 0),
    hairShare: share((e) => e.hairBand),
    torso: share((e) => e.torso),
    legs: share((e) => e.legs),
    offAxis: share((e) => e.offAxis),
    meanLight,
    saturation: share((e) => e.hsl[1] * e.count),
  };
}

export function colorRegions(image) {
  const { opaque, materials } = materialsOf(image);
  const usable = materials.filter((m) => m.weight >= opaque * OUTFIT_SHARE);
  if (!usable.length) return materials.slice(0, 1);
  const clothes = usable.filter((m) => m.hairShare < HAIR_LINE);
  const outfit = clothes.find((m) => m.kind === 'hue' && m.weight >= (clothes[0]?.weight ?? 0) * HUE_PREFERENCE) ?? clothes[0] ?? usable[0];
  const hair = materials.find((m) => m !== outfit && m.hairShare >= HAIR_LINE && m.weight >= opaque * HAIR_MIN_SHARE);
  return hair ? [outfit, hair] : [outfit];
}


export function topRegions(image, n, minShare = REGION_SHARE) {
  const { opaque, materials } = materialsOf(image);
  return materials.filter((m) => m.weight >= opaque * minShare).slice(0, n);
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
    const ramp = tones.filter((tone) => tone.count >= Math.max(2, cluster.count * TONE_SHARE)).map((tone) => tone.hsl);
    return { hue, sat, light, count: cluster.count, neutral: cluster.neutral, tones: ramp };
  });
  const merged = [];
  for (const color of colors.sort((a, b) => b.count - a.count)) {
    const near = merged.find((m) => m.neutral === color.neutral && (color.neutral ? Math.abs(m.light - color.light) < 0.2 : distance(m.hue, color.hue) < 30));
    if (near) {
      near.count += color.count;
      near.tones = [...near.tones, ...color.tones];
    }
    else merged.push(color);
  }
  const weightOf = (color) => (color.neutral && color.light < 0.7 ? color.count * GRAY_WEIGHT : color.count);
  for (const color of merged) color.tones = color.tones.sort((a, b) => a[2] - b[2]);
  return merged.sort((a, b) => weightOf(b) - weightOf(a)).slice(0, n);
}

export function paintRegion(region, color) {
  const white = color.neutral && color.light >= WHITE_FROM;
  const wanted = white ? WHITE_BASE : color.light;
  const eased = wanted > region.meanLight ? region.meanLight + (wanted - region.meanLight) * LIGHTER_EASE : wanted;
  const near = clamp(eased, region.meanLight - POKEMON_LIGHT_REACH, region.meanLight + POKEMON_LIGHT_REACH);
  const light = color.neutral ? near : Math.max(near, Math.min(color.light, RECOGNIZABLE_LIGHT));
  const sat = color.neutral ? Math.min(color.sat, NEUTRAL_SAT) : Math.min(color.sat, CHROMA_MAX_SAT);
  return withSurroundings(region, distinct(region.ramps.flatMap((ramp) => {
    const weight = ramp.colors.reduce((sum, e) => sum + e.count, 0) || 1;
    const rampLight = ramp.colors.reduce((sum, e) => sum + e.hsl[2] * e.count, 0) / weight;
    const wanted = light + (rampLight - region.meanLight);
    if (!color.neutral && color.tones?.length >= 2) {
      return paintRampWithTones(ramp, color.tones, wanted);
    }
    return paintRamp(ramp, { hue: color.hue, sat, light: wanted, absolute: true });
  })));
}



export function visibleChange(region, map) {
  const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  let weight = 0;
  let total = 0;
  map.forEach(([from, to], i) => {
    if (i >= region.colors.length) return;
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
  const color = paint && target.look ? { ...target, ...target.look } : target;
  return withSurroundings(region, distinct(region.ramps.flatMap((ramp) => paintRamp(ramp, color))));
}

function distinctWhole(map) {
  const whole = distinct(map.filter((entry) => entry.length === 2));
  return [...whole, ...map.filter((entry) => entry.length !== 2)];
}

function tidyLocal(map) {
  const whole = new Set(map.filter((entry) => entry.length === 2).map(([from]) => from));
  const seen = new Set();
  return map.filter((entry) => {
    if (entry.length === 2) return true;
    if (whole.has(entry[0]) || seen.has(entry[0])) return false;
    seen.add(entry[0]);
    return true;
  });
}

function withSurroundings(region, map) {
  const painted = new Set(map.map(([from]) => parseInt(from.slice(1), 16)));
  return [...map, ...region.ramps.flatMap((ramp) => paintAround(ramp, map, painted))];
}

function distinct(map) {
  const used = new Set();
  return map.map(([from, to]) => {
    let rgb = rgbOf(to);
    while (used.has(hexOf(rgb))) rgb = rgb.map((v) => Math.min(255, v + 1));
    used.add(hexOf(rgb));
    return [from, hexOf(rgb)];
  });
}

function painterFor(base) {
  const image = loadTrainer(base);
  const [main, second] = colorRegions(image);
  const { opaque, materials } = materialsOf(image);
  const bystanders = materials.filter((m) => m.kind === 'hue' && m.weight >= opaque * DETAIL_SHARE && ![main, second].some((r) => r && r.hue === m.hue && r.weight === m.weight)).map((m) => ({ ...m, detail: m.weight < opaque * BYSTANDER_SHARE }));
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
  const otherFor = (target) => second && (oneOutfit ? target : pickSecond(base, second, target));
  const accentFor = (target) => {
    const other = otherFor(target);
    return other && other.key !== target.key ? { accent: other.key } : {};
  };
  const mapFor = (target) => {
    const other = otherFor(target);
    const visible = (color) => visibleChange(main, colorMap(main, color, true)) >= MIN_VISIBLE;
    const scaled = (factor) => ({ ...target, light: target.light * factor, look: target.look && { ...target.look, light: target.look.light * factor } });
    const bright = (color) => paintedLuma(main, colorMap(main, color, true)) > MAX_LUMA;
    const painted = [target, ...[0.7, 0.55].map(scaled)].find((color) => visible(color) && !bright(color)) ?? [0.85, 0.7, 0.55].map(scaled).find((color) => !bright(color)) ?? target;
    const contrast = (color, painted) => contrastMaps(bystanders, [color, other].filter(Boolean), main.hue, painted);
    const build = (color) => {
      const painted = [...colorMap(main, color, true), ...(other ? colorMap(second, other, true) : [])];
      return tidyLocal(distinctWhole([...painted, ...contrast(color, painted)]));
    };
    const vivid = { ...painted, sat: Math.min(1, painted.sat * 1.4) };
    const maps = [painted, ...[1.2, 1.4, 0.8, 0.65].map(scaled), vivid].map(build);
    return maps.find((map) => changeOf(map) >= VARIANT_MIN_CHANGE) ?? maps.reduce((best, map) => (changeOf(map) > changeOf(best) ? map : best));
  };
  return { accentFor, changeOf, mapFor };
}

function plan() {
  const usage = new Map();
  for (const { color } of PUBLISHED) usage.set(color, (usage.get(color) ?? 0) + 1);
  const handmade = new Map();
  for (const variant of HANDMADE_VARIANTS) if (!variant.pokemon) handmade.set(variant.base, (handmade.get(variant.base) ?? 0) + 1);
  const variants = [];
  for (const base of DOWNLOADED_SPRITES) {
    const soldHandmade = HANDMADE_VARIANTS.some((variant) => variant.base === base && variant.key in SHOP_TRAINERS);
    const count = Math.max(1, variantsWanted(base) - (handmade.get(base) ?? 0));
    if (!count) continue;
    const { accentFor, changeOf, mapFor } = painterFor(base);
    const published = PUBLISHED.filter((variant) => variant.base === base);
    if (published.length) {
      const chosen = base in MALE_OF ? published : distinctColors(base, published, usage, changeOf, mapFor);
      for (const { key, color, earn } of chosen) {
        const target = VARIANT_COLORS.find((candidate) => candidate.key === color);
        variants.push({ key, base, color, ...accentFor(target), ...(earn ? { earn: true } : {}), map: mapFor(target) });
      }
      continue;
    }
    const [main] = colorRegions(loadTrainer(base));
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
      variants.push({ key: `${base}__${target.key}`, base, color: target.key, ...accentFor(target), ...(earned ? { earn: true } : {}), map });
    });
  }
  return withTitles(sharePairColors(variants).map((variant) => ({ ...variant, map: completeHeadPieces(loadTrainer(variant.base), variant.map) })));
}

function withTitles(variants) {
  const taken = new Map();
  return variants.map((variant) => {
    if (!variant.accent) return variant;
    const used = taken.get(variant.base) ?? new Set(variants.filter((v) => v.base === variant.base && !v.accent).map((v) => VARIANT_COLORS.find((c) => c.key === v.color).name));
    taken.set(variant.base, used);
    const title = comboTitle(variant.color, variant.accent, used);
    if (!title) return variant;
    used.add(title);
    return { ...variant, title };
  });
}

function lumaAround(material, map) {
  const to = new Map(map.filter((entry) => entry.length === 2).map(([from, color]) => [parseInt(from.slice(1), 16), color]));
  const touched = new Map();
  for (const entry of material.colors)
    for (const [other, touches] of entry.neighbors) if (to.has(other)) touched.set(other, (touched.get(other) ?? 0) + touches);
  const total = [...touched.values()].reduce((a, b) => a + b, 0);
  const main = [...touched].filter(([, touches]) => touches >= total * 0.2).map(([other]) => lumaOf(rgbOf(to.get(other))));
  return main.length ? Math.max(...main) : 0.5;
}

function contrastMaps(bystanders, used, originalHue, painted) {
  return bystanders.flatMap((material) => {
    if (material.detail) {
      if (!used.some((target) => distance(target.hue, material.hue) < CLASH_HUE)) return [];
      const ink = lumaAround(material, painted) > INK_FROM ? { hue: INK_HUE, sat: INK_SAT, light: INK_DARK, absolute: true, free: true } : { hue: used[0].hue, sat: INK_SAT, light: INK_LIGHT, absolute: true, free: true };
      return material.ramps.flatMap((ramp) => paintRamp(ramp, ink));
    }
    const against = used.slice(0, 1);
    const fits = (hue) => against.every((target) => harmonic(distance(target.hue, hue)));
    const clash = against.some((target) => distance(target.hue, material.hue) < CLASH_HUE);
    if (fits(material.hue) || (material.saturation < BYSTANDER_SAT && !clash)) return [];
    const first = used[0];
    const nearby = NEIGHBOR_SHIFTS.map((shift) => material.hue + shift);
    const candidates = [...(clash ? [originalHue, ...nearby] : [...nearby, originalHue]), first.hue + 180, first.hue + 120, first.hue - 120].filter((candidate) => candidate !== null && candidate !== undefined);
    const farthest = (candidate) => Math.min(...against.map((target) => distance(target.hue, candidate)));
    const hue = candidates.find(fits) ?? candidates.reduce((a, b) => (farthest(b) > farthest(a) ? b : a));
    return colorMap(material, { hue: ((hue % 360) + 360) % 360, sat: 1, light: 1 }, true);
  });
}

const harmonic = (gap) => gap >= CLASH_HUE && !(gap > AWKWARD[0] && gap < AWKWARD[1]);

const looksAlike = (a, b) =>
  a.sat >= MUTED_TARGET && b.sat >= MUTED_TARGET ? distance(a.hue, b.hue) < SIMILAR_HUE : a.sat < MUTED_TARGET && b.sat < MUTED_TARGET && Math.abs(a.light - b.light) < SIMILAR_LIGHT;

function distinctColors(base, published, usage, changeOf, mapFor) {
  const colorOf = (key) => VARIANT_COLORS.find((color) => color.key === key);
  const kept = [];
  const decided = new Map();
  for (const variant of [...published].sort((a, b) => Number(!!a.earn) - Number(!!b.earn))) {
    const color = colorOf(variant.color);
    if (!kept.some((other) => looksAlike(other, color))) {
      kept.push(color);
      continue;
    }
    const spare = VARIANT_COLORS.filter((candidate) => !kept.some((other) => looksAlike(other, candidate)) && !published.some((p) => p.key !== variant.key && looksAlike(colorOf(p.color), candidate)) && !published.some((p) => p.color === candidate.key))
      .sort((a, b) => (usage.get(a.key) ?? 0) - (usage.get(b.key) ?? 0))
      .find((candidate) => changeOf(mapFor(candidate)) >= VARIANT_MIN_CHANGE);
    if (!spare) {
      kept.push(color);
      continue;
    }
    kept.push(spare);
    usage.set(spare.key, (usage.get(spare.key) ?? 0) + 1);
    usage.set(color.key, (usage.get(color.key) ?? 1) - 1);
    decided.set(variant.key, spare.key);
    rename(`${base}__${variant.color}`, `${base}__${spare.key}`);
    if (FEMALE_OF[base]) rename(`${FEMALE_OF[base]}__${variant.color}`, `${FEMALE_OF[base]}__${spare.key}`);
  }
  return published.map((variant) => (decided.has(variant.key) ? { ...variant, key: `${base}__${decided.get(variant.key)}`, color: decided.get(variant.key) } : variant));
}

function rename(from, to) {
  renames[from] = to;
}

function sharePairColors(variants) {
  const colorsOf = (base) => variants.filter((variant) => variant.base === base);
  const shipped = (base, color) => `${base}__${color}` in SHIPPED_RECOLORS;
  const shared = Object.entries(MALE_OF).flatMap(([female, male]) => {
    const colors = [...colorsOf(male), ...colorsOf(female).filter((variant) => shipped(female, variant.color) && !colorsOf(male).some((other) => other.color === variant.color))];
    return [male, female].flatMap((base) => {
      const { accentFor, mapFor } = painterFor(base);
      return colors.map(({ color, earn }) => {
        const target = VARIANT_COLORS.find((candidate) => candidate.key === color);
        return { key: `${base}__${color}`, base, color, ...accentFor(target), ...(earn ? { earn: true } : {}), map: mapFor(target) };
      });
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
    const { opaque: total, materials } = materialsOf(trainer);
    const painted = regions.filter((region, i) => colors[i]);
    const others = materials.filter((m) => m.kind === 'hue' && m.weight >= total * DETAIL_SHARE && !painted.some((region) => region.hue === m.hue && region.weight === m.weight)).map((m) => ({ ...m, detail: m.weight < total * BYSTANDER_SHARE }));
    const used = regions.map((region, i) => colors[i] && !colors[i].neutral ? { hue: colors[i].hue } : null).filter(Boolean);
    const base = regions.flatMap((region, i) => (colors[i] ? paintRegion(region, colors[i]) : []));
    const extra = used.length ? contrastMaps(others, used, painted[0]?.hue ?? null, base) : [];
    maps[variant.key] = completeHeadPieces(trainer, tidyLocal(distinctWhole([...base, ...extra])));
  }
  return maps;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const variants = plan();
  const soldNow = new Set(variants.filter((v) => !v.earn).map((v) => v.key));
  const renamed = { ...(previous.RENAMED_GENERATED ?? {}) };
  for (const [from, to] of Object.entries(renamed)) if (renames[to]) renamed[from] = renames[to];
  Object.assign(renamed, renames);
  for (const [gone, kept] of Object.entries(MERGED_TRAINERS)) {
    const left = PUBLISHED.filter((variant) => variant.base === gone);
    const into = variants.filter((variant) => variant.base === kept);
    left.forEach((variant, i) => {
      const same = into.filter((other) => !!other.earn === !!variant.earn);
      renamed[variant.key] = (same[i] ?? into[i] ?? { key: kept }).key;
    });
  }
  const retired = Object.fromEntries(Object.entries(SHIPPED_RECOLORS).filter(([key]) => !soldNow.has(key) && !(key in renamed)));
  const maps = await pokemonMaps();
  const quote = (value) => JSON.stringify(value).replace(/"/g, "'");
  const lines = variants.map((v) => `  { key: ${quote(v.key)}, base: ${quote(v.base)}, color: ${quote(v.color)},${v.accent ? ` accent: ${quote(v.accent)},` : ''}${v.title ? ` title: ${quote(v.title)},` : ''}${v.earn ? ' earn: true,' : ''} map: ${quote(v.map)} },`);
  writeFileSync(
    OUT,
    `export const VARIANT_COLOR_NAMES = ${quote(Object.fromEntries(VARIANT_COLORS.map((c) => [c.key, c.name])))};\n\n` +
      `export const VARIANT_COLOR_TYPES = ${quote(Object.fromEntries(VARIANT_COLORS.map((c) => [c.key, c.type])))};\n\n` +
      `export const RETIRED_GENERATED = ${quote(retired)};\n\n` +
      `export const RENAMED_GENERATED = ${quote(renamed)};\n\n` +
      `export const GENERATED_VARIANTS = [\n${lines.join('\n')}\n];\n\n` +
      `export const POKEMON_VARIANT_MAPS = {\n${Object.entries(maps).map(([key, map]) => `  ${key}: ${quote(map)},`).join('\n')}\n};\n`,
  );
  const uses = {};
  for (const v of variants) uses[v.color] = (uses[v.color] ?? 0) + 1;
  console.log(`Variantes planificadas: ${variants.length}.`, uses);
}

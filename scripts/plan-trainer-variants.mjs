#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { decodePng, faceOf } from './sync-trainers.js';
import { UPSTREAM } from '../public/upstream.js';
import { fetchUpstream } from './upstream-files.js';
import * as previous from '../public/trainer-variants.js';
import { chromaOf, hslOf } from './sprite-ramps.mjs';
import { familiesOf, hueGap, pokemonColorsOf, pokemonVariant, rotateVariant, swapVariant, targetHueOf, visibleChange } from './sprite-rotate.mjs';
import { CHAMPIONS, DOWNLOADED_SPRITES, FEMALE_OF, HANDMADE_VARIANTS, MALE_OF, MERGED_TRAINERS, SHINY_VARIANTS, VILLAINS } from '../public/trainer-sprites.js';

const PUBLISHED = previous.GENERATED_VARIANTS;
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
const SIMILAR_HUE = 55;
const SIMILAR_LIGHT = 0.25;
const SKIN_REUSE = 0.04;
const MIN_CHANGE = 0.06;
const SKIN_TOUCH = 0.3;
const SKIN_MIN_CHROMA = 0.15;
const SKIN_MAX_CHROMA = 0.48;
const HEAD_BAND = 0.32;
const HAIR_BAND = 0.22;
const SKIN_SEED_LIGHT = 0.4;
const SKIN_HEAD_SHARE = 0.02;
const HAIR_SHADES = { alder: [0xa54a31, 0x733121] };
const TORSO_BAND = [0.28, 0.58];
const NEUTRAL_CHROMA = 0.12;

export const variantsWanted = (key) => (STORY.has(key) ? 4 : MAIN.has(key) ? 3 : 1);

export const hsl = hslOf;




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



const colorOf = (key) => VARIANT_COLORS.find((color) => color.key === key);

const analysisOf = (base) => familiesOf(paletteOf(loadTrainer(base)));

export function mapFor(analysis, variant) {
  return rotateVariant(analysis, colorOf(variant.color), variant.accent ? colorOf(variant.accent) : null).map;
}

function seeded(seed) {
  let state = 2166136261;
  for (const ch of seed) state = Math.imul(state ^ ch.charCodeAt(0), 16777619);
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2246822507);
    state = Math.imul(state ^ (state >>> 13), 3266489909);
    return ((state ^= state >>> 16) >>> 0) / 4294967296;
  };
}

const looksAlike = (a, b) => hueGap(targetHueOf(a), targetHueOf(b)) < SIMILAR_HUE && Math.abs(a.light - b.light) < SIMILAR_LIGHT;

export function pickTargets(base, analysis, count, usage = new Map()) {
  const random = seeded(base);
  const shuffled = VARIANT_COLORS.map((color) => [random(), color]).sort((a, b) => a[0] - b[0]).map(([, color]) => color);
  const order = shuffled.sort((a, b) => (usage.get(a.key) ?? 0) - (usage.get(b.key) ?? 0));
  const picked = [];
  for (const color of order) {
    if (picked.length >= count) break;
    if (picked.some((other) => looksAlike(other, color))) continue;
    if (visibleChange(analysis, rotateVariant(analysis, color).map) < MIN_CHANGE) continue;
    picked.push(color);
  }
  for (const color of picked) usage.set(color.key, (usage.get(color.key) ?? 0) + 1);
  return picked;
}

function freshVariants(base, analysis, usage) {
  const handmade = HANDMADE_VARIANTS.filter((variant) => variant.base === base && !variant.pokemon).length;
  const targets = pickTargets(base, analysis, Math.max(1, variantsWanted(base) - handmade), usage);
  return targets.map((target, i) => ({ key: `${base}__${target.key}`, color: target.key, ...(targets.length > 1 && i % 2 === 0 ? { earn: true } : {}) }));
}

function plan() {
  const usage = new Map();
  for (const { color } of PUBLISHED) usage.set(color, (usage.get(color) ?? 0) + 1);
  const chosenFor = new Map();
  const variants = [];
  for (const base of DOWNLOADED_SPRITES) {
    const analysis = analysisOf(base);
    const published = PUBLISHED.filter((variant) => variant.base === base).map(({ key, color, accent, earn }) => ({ key, color, ...(accent ? { accent } : {}), ...(earn ? { earn } : {}) }));
    const partner = MALE_OF[base] ?? FEMALE_OF[base];
    const fromPartner = partner && chosenFor.get(partner)?.map((variant) => ({ ...variant, key: `${base}__${variant.color}` }));
    const chosen = published.length ? published : (fromPartner ?? freshVariants(base, analysis, usage));
    chosenFor.set(base, chosen);
    for (const variant of chosen) variants.push({ ...variant, base, map: mapFor(analysis, variant) });
  }
  return withTitles(variants);
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

const BW_SPRITES = 'sprites/pokemon/versions/generation-v/black-white/';

async function pokemonSprite(id, side, shiny) {
  const local = new URL(`../public/sprites/${id}-${side}${shiny ? '-shiny' : ''}.png`, import.meta.url);
  if (existsSync(local)) return decodePng(readFileSync(local));
  const response = await fetchUpstream(UPSTREAM.sprites, `${BW_SPRITES}${side === 'back' ? 'back/' : ''}${shiny ? 'shiny/' : ''}${id}.png`);
  if (!response.ok) throw new Error(`No pude bajar el sprite ${side}${shiny ? ' shiny' : ''} de #${id}.`);
  return decodePng(Buffer.from(await response.arrayBuffer()));
}

async function handmadeMaps() {
  const maps = {};
  for (const variant of [...HANDMADE_VARIANTS, ...SHINY_VARIANTS]) {
    const analysis = analysisOf(variant.base);
    if (!variant.pokemon) {
      maps[variant.key] = swapVariant(analysis, variant.swaps).map;
      continue;
    }
    const [front, back] = await Promise.all(['front', 'back'].map((side) => pokemonSprite(variant.pokemon, side, variant.shiny)));
    const sprite = { width: front.width, height: front.height + back.height, rgba: Buffer.concat([front.rgba, back.rgba]) };
    maps[variant.key] = pokemonVariant(analysis, pokemonColorsOf(sprite)).map;
  }
  return maps;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const variants = plan();
  const soldNow = new Set(variants.filter((v) => !v.earn).map((v) => v.key));
  const renamed = { ...(previous.RENAMED_GENERATED ?? {}) };
  for (const [gone, kept] of Object.entries(MERGED_TRAINERS)) {
    const left = PUBLISHED.filter((variant) => variant.base === gone);
    const into = variants.filter((variant) => variant.base === kept);
    left.forEach((variant, i) => {
      const same = into.filter((other) => !!other.earn === !!variant.earn);
      renamed[variant.key] = (same[i] ?? into[i] ?? { key: kept }).key;
    });
  }
  const retired = Object.fromEntries(Object.entries(SHIPPED_RECOLORS).filter(([key]) => !soldNow.has(key) && !(key in renamed)));
  const maps = await handmadeMaps();
  const quote = (value) => JSON.stringify(value).replace(/"/g, "'");
  const lines = variants.map((v) => `  { key: ${quote(v.key)}, base: ${quote(v.base)}, color: ${quote(v.color)},${v.accent ? ` accent: ${quote(v.accent)},` : ''}${v.title ? ` title: ${quote(v.title)},` : ''}${v.earn ? ' earn: true,' : ''} map: ${quote(v.map)} },`);
  writeFileSync(
    OUT,
    `export const VARIANT_COLOR_NAMES = ${quote(Object.fromEntries(VARIANT_COLORS.map((c) => [c.key, c.name])))};\n\n` +
      `export const VARIANT_COLOR_TYPES = ${quote(Object.fromEntries(VARIANT_COLORS.map((c) => [c.key, c.type])))};\n\n` +
      `export const RETIRED_GENERATED = ${quote(retired)};\n\n` +
      `export const RENAMED_GENERATED = ${quote(renamed)};\n\n` +
      `export const GENERATED_VARIANTS = [\n${lines.join('\n')}\n];\n\n` +
      `export const HANDMADE_VARIANT_MAPS = {\n${Object.entries(maps).map(([key, map]) => `  ${key}: ${quote(map)},`).join('\n')}\n};\n`,
  );
  const uses = {};
  for (const v of variants) uses[v.color] = (uses[v.color] ?? 0) + 1;
  console.log(`Variantes planificadas: ${variants.length}.`, uses);
}

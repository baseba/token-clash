// Overworld sprites (the small walking trainers of the Tower's maps), generated at install like the
// trainers: every trainer key gets public/overworlds/<key>.png, a column of 16 frames of 32×32 in
// four groups (up, down, left, right), each group idle, step, step, idle.
//
// Sources, all in the GBA style so they share scale and walk: Emerald Rogue (every region's leaders,
// rivals and teams), Emerald and FireRed. A sheet without walking frames gets steps made from its
// standing frame. A colour variant
// repaints its base with the same functions as the battle recolour (scripts/overworld-recolor.mjs). A trainer with no
// official overworld gets one composed from officials of its gender and painted with its own colours
// (scripts/overworld-compose.mjs), or, if that fails, the official one that looks most like it. One
// whose colours are far from its battle sprite's (a class drawn with another class's sprite) is
// dressed in its trainer's colours (scripts/overworld-dress.mjs).
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { DOWNLOADED_SPRITES, TRAINER_VARIANTS } from '../public/trainer-sprites.js';
import { UPSTREAM } from '../public/upstream.js';
import { decodePng, encodePng, recolorByMap, recolorTrainer } from './sync-trainers.js';
import { fetchUpstream, mapLimit } from './upstream-files.js';

const OUT = new URL('../public/overworlds/', import.meta.url);
const TRAINERS = new URL('../public/trainers/', import.meta.url);
const { sources: SOURCES, female: FEMALE } = JSON.parse(readFileSync(new URL('./overworld-sources.json', import.meta.url), 'utf8'));
const FRAME = 32;
const FRAMES = 16;

const REPOS = {
  rg: { upstream: UPSTREAM.rogue, dir: 'graphics/object_events/pics/' },
  em: { upstream: UPSTREAM.emerald, dir: 'graphics/object_events/pics/people/' },
  fr: { upstream: UPSTREAM.firered, dir: 'graphics/object_events/pics/people/' },
};

/** Gen 3 sheets: down, up, left, then two steps of each (right is left mirrored). */
const GBA_GROUPS = { up: [1, 5, 6, 1], down: [0, 3, 4, 0], left: [2, 7, 8, 2] };

function blank() {
  return { width: FRAME, height: FRAME * FRAMES, rgba: Buffer.alloc(FRAME * FRAME * FRAMES * 4) };
}

/** Copies a w×h box of a sheet into frame `slot`, bottom-centred, keying out the background colour. */
function place(out, sheet, sx, sy, w, h, slot, { key = null, mirror = false } = {}) {
  const ox = Math.floor((FRAME - w) / 2);
  const oy = slot * FRAME + (FRAME - h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const from = ((sy + y) * sheet.width + sx + (mirror ? w - 1 - x : x)) * 4;
      const [r, g, b, a] = sheet.rgba.subarray(from, from + 4);
      if (!a || (key && r === key[0] && g === key[1] && b === key[2])) continue;
      const to = ((oy + y) * FRAME + ox + x) * 4;
      out.rgba[to] = r;
      out.rgba[to + 1] = g;
      out.rgba[to + 2] = b;
      out.rgba[to + 3] = 255;
    }
}

/**
 * People are 16 pixels wide and bikes 32, and a sheet has 3, 4, 9 or 10 frames. When the count fits both
 * widths, the frames are 16 wide if the first 32 columns hold two figures with a background column between them.
 */
export function frameWidth(sheet) {
  if (sheet.width % 32) return 16;
  if ([3, 4, 9, 10].includes(sheet.width / 16) && ![3, 9, 10].includes(sheet.width / 32)) return 16;
  if ([3, 9, 10].includes(sheet.width / 32) && ![3, 4, 9, 10].includes(sheet.width / 16)) return 32;
  const key = sheet.rgba.readUIntBE(0, 3);
  const filled = (x) => [...Array(sheet.height).keys()].some((y) => {
    const i = (y * sheet.width + x) * 4;
    return sheet.rgba[i + 3] && sheet.rgba.readUIntBE(i, 3) !== key;
  });
  const columns = [...Array(32).keys()].map(filled);
  const firstEnd = columns.indexOf(false, columns.indexOf(true));
  return firstEnd > 0 && firstEnd <= 16 && columns.slice(16).some(Boolean) && !columns[15] ? 16 : 32;
}

export function normalizeGba(sheet) {
  const width = frameWidth(sheet);
  const h = sheet.height;
  const frames = Math.floor(sheet.width / width);
  const count = frames >= 9 ? frames : 3;
  const key = [...sheet.rgba.subarray(0, 3)];
  const out = blank();
  const groups = [GBA_GROUPS.up, GBA_GROUPS.down, GBA_GROUPS.left, GBA_GROUPS.left];
  groups.forEach((frames, group) =>
    frames.forEach((frame, i) => {
      const index = frame < count ? frame : frame <= 4 ? 0 : frame <= 6 ? 1 : 2;
      place(out, sheet, index * width, 0, width, Math.min(h, FRAME), group * 4 + i, { key, mirror: group === 3 });
    }),
  );
  if (count < 9) for (let group = 0; group < 4; group++) makeSteps(out, group, group >= 2);
  return out;
}

const LEG_ROWS = 6;

/** Steps for a sheet that only stands: the body bobs a pixel and the legs swap (facing you or away) or swing (from the side). */
function makeSteps(out, group, sideways) {
  const frameStart = (slot) => slot * FRAME * FRAME * 4;
  const idle = out.rgba.subarray(frameStart(group * 4), frameStart(group * 4 + 1));
  let bottom = FRAME - 1;
  while (bottom > 0 && ![...Array(FRAME).keys()].some((x) => idle[(bottom * FRAME + x) * 4 + 3])) bottom -= 1;
  [1, 2].forEach((step) => {
    const frame = Buffer.alloc(FRAME * FRAME * 4);
    for (let y = 0; y < FRAME; y++)
      for (let x = 0; x < FRAME; x++) {
        const legs = y > bottom - LEG_ROWS;
        let fromX = x;
        let fromY = legs ? y : y + 1;
        if (legs) fromX = sideways ? x + (step === 1 ? 1 : -1) * (y > bottom - 3 ? 1 : 0) : step === 1 ? x : FRAME - 1 - x;
        if (fromX < 0 || fromX >= FRAME || fromY >= FRAME) continue;
        idle.copy(frame, (y * FRAME + x) * 4, (fromY * FRAME + fromX) * 4, (fromY * FRAME + fromX) * 4 + 4);
      }
    frame.copy(out.rgba, frameStart(group * 4 + step));
  });
}

async function fetchSheet(source) {
  const [repo, path] = [source.slice(0, 2), source.slice(3)];
  const { upstream, dir } = REPOS[repo];
  const res = await fetchUpstream(upstream, `${dir}${path}.png`);
  if (!res.ok) throw new Error(`${source}: ${res.status}`);
  const sheet = decodePng(Buffer.from(await res.arrayBuffer()));
  return normalizeGba(sheet);
}

/** Its most common saturated colours by hue and light, to compare a battle sprite with overworlds. */
function colourPrint(image, { top = 0, height = image.height } = {}) {
  const buckets = new Map();
  for (let y = top; y < top + height; y++)
    for (let x = 0; x < image.width; x++) {
      const i = (y * image.width + x) * 4;
      if (image.rgba[i + 3] < 128) continue;
      const [r, g, b] = [image.rgba[i], image.rgba[i + 1], image.rgba[i + 2]].map((v) => v / 255);
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const light = (max + min) / 2;
      if (light < 0.12 || light > 0.92) continue;
      const hue = max === min ? -1 : Math.round((((max === r ? (g - b) / (max - min) : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4) * 60 + 360) % 360) / 30);
      const bucket = `${hue}:${Math.round(light * 4)}`;
      buckets.set(bucket, (buckets.get(bucket) ?? 0) + 1);
    }
  const total = [...buckets.values()].reduce((sum, n) => sum + n, 0) || 1;
  return new Map([...buckets].map(([bucket, n]) => [bucket, n / total]));
}

/** The colour pairs a recolour changed on the battle sprite: each base colour and what most of its pixels became. */
export function battleRepaint(base, variant) {
  if (base.width !== variant.width || base.height !== variant.height) return [];
  const votes = new Map();
  for (let i = 0; i < base.width * base.height; i++) {
    if (base.rgba[i * 4 + 3] < 128) continue;
    const from = base.rgba.readUIntBE(i * 4, 3);
    const to = variant.rgba.readUIntBE(i * 4, 3);
    const tally = votes.get(from) ?? new Map();
    tally.set(to, (tally.get(to) ?? 0) + 1);
    votes.set(from, tally);
  }
  const hex = (value) => `#${value.toString(16).padStart(6, '0')}`;
  return [...votes].map(([from, tally]) => [from, [...tally].sort((a, b) => b[1] - a[1])[0][0]]).filter(([from, to]) => from !== to).map(([from, to]) => [hex(from), hex(to)]);
}

const likeness = (a, b) => [...a].reduce((sum, [bucket, share]) => sum + Math.min(share, b.get(bucket) ?? 0), 0);

/** The height of a grown-up standing on the map in GBA sprites: the pieces of a composed sprite come from these. */
const ADULT_HEIGHTS = [19, 22];
/** A map sprite whose colours look less like its battle sprite than this is dressed in its trainer's clothes (scripts/overworld-dress.mjs). */
const DRESS_BELOW = 0.35;
/** How tall the figure standing in front is: children and swimmers are shorter than the rest. */
function figureHeight(image) {
  const rows = [...Array(FRAME).keys()].filter((y) => [...Array(FRAME).keys()].some((x) => image.rgba[((4 * FRAME + y) * FRAME + x) * 4 + 3]));
  return rows.length ? rows.at(-1) - rows[0] + 1 : 0;
}

/** Whether the trainer walks as its own official sprite (not another class's): that one keeps its colours, as a composed one keeps the ones it was painted with. */
const drawnFor = (key) => SOURCES[key]?.toLowerCase().includes(key.replace(/_[mf]$/, '').replace(/_\d+$/, '')) ?? false;

const isFemale = (key) => key.endsWith('_f') || FEMALE.includes(key);

function closestOfficial(key, official) {
  const battle = existsSync(new URL(`${key}.png`, TRAINERS)) ? decodePng(readFileSync(new URL(`${key}.png`, TRAINERS))) : null;
  const female = isFemale(key);
  const pool = [...official].filter(([base]) => isFemale(base) === female);
  if (!battle) return pool[0]?.[0] ?? 'player_m';
  const print = colourPrint(battle);
  return pool.map(([base, sheet]) => ({ base, score: likeness(print, colourPrint(sheet.image, { top: 4 * FRAME, height: FRAME })) })).sort((a, b) => b.score - a.score)[0]?.base ?? 'player_m';
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const official = new Map();
  const counts = { official: 0, composed: 0, closest: 0, dressed: 0, variants: 0, unchanged: 0, failed: 0 };
  await mapLimit(Object.entries(SOURCES), async ([key, source]) => {
    try {
      official.set(key, { image: await fetchSheet(source) });
      counts.official += 1;
    } catch (err) {
      counts.failed += 1;
      console.log(`  ${key}: ${err.message}`);
    }
  });
  const sheets = new Map(official);
  const { composeMini } = await import('./overworld-compose.mjs');
  for (const key of DOWNLOADED_SPRITES) {
    if (sheets.has(key) || TRAINER_VARIANTS.some((variant) => variant.key === key)) continue;
    const battlePath = new URL(`${key}.png`, TRAINERS);
    const sameGender = new Map([...official].filter(([base, sheet]) => isFemale(base) === isFemale(key) && figureHeight(sheet.image) >= ADULT_HEIGHTS[0] && figureHeight(sheet.image) <= ADULT_HEIGHTS[1]).map(([base, sheet]) => [base, sheet.image]));
    const composed = existsSync(battlePath) ? composeMini(decodePng(readFileSync(battlePath)), sameGender) : null;
    if (composed?.painted) {
      sheets.set(key, { image: composed.image });
      counts.composed += 1;
      continue;
    }
    const base = closestOfficial(key, official);
    if (sheets.has(base)) {
      sheets.set(key, sheets.get(base));
      counts.closest += 1;
    }
  }
  const { overworldVariant, extendFrontMap, frontFrame, sharedSkinTones } = await import('./overworld-recolor.mjs');
  const { dressMap } = await import('./overworld-dress.mjs');
  const skinTones = sharedSkinTones([...official.values()].map((sheet) => sheet.image));
  for (const [key, sheet] of sheets) {
    const battlePath = new URL(`${key}.png`, TRAINERS);
    if (!SOURCES[key] || drawnFor(key) || !existsSync(battlePath)) continue;
    const battle = decodePng(readFileSync(battlePath));
    if (likeness(colourPrint(battle), colourPrint(sheet.image, { top: 4 * FRAME, height: FRAME })) >= DRESS_BELOW) continue;
    const map = dressMap(battle, frontFrame(sheet.image), skinTones);
    if (!map.length) continue;
    sheets.set(key, { image: recolorByMap(sheet.image, extendFrontMap(sheet.image, map), null) });
    counts.dressed += 1;
  }
  for (const variant of TRAINER_VARIANTS) {
    const base = sheets.get(variant.base);
    if (!base) continue;
    let image = base.image;
    try {
      const baseBattle = new URL(`${variant.base}.png`, TRAINERS);
      const variantBattle = new URL(`${variant.key}.png`, TRAINERS);
      const map = variant.map ?? (existsSync(baseBattle) && existsSync(variantBattle) ? battleRepaint(decodePng(readFileSync(baseBattle)), decodePng(readFileSync(variantBattle))) : null);
      if (map?.length && existsSync(baseBattle)) {
        const result = overworldVariant(decodePng(readFileSync(baseBattle)), frontFrame(base.image), map, skinTones);
        if (!result.problems.length && result.map.length) {
          const whole = result.map.filter((entry) => entry.length === 2);
          const extended = extendFrontMap(base.image, whole).filter(([from], i) => i < whole.length || !result.skin.includes(from.toLowerCase()));
          image = recolorByMap(base.image, [...extended, ...result.map.filter((entry) => entry.length === 3)], null);
        }
      }
      if (image === base.image && variant.swaps) image = recolorTrainer(base.image, variant.swaps);
    } catch (err) {
      console.log(`  ${variant.key}: ${err.message}`);
    }
    sheets.set(variant.key, { image });
    if (image === base.image) counts.unchanged += 1;
    else counts.variants += 1;
  }
  for (const [key, sheet] of sheets) writeFileSync(new URL(`${key}.png`, OUT), encodePng(sheet.image));
  for (const file of readdirSync(OUT)) if (file.endsWith('.png') && !sheets.has(file.slice(0, -4))) rmSync(new URL(file, OUT));
  console.log(`Sprites de mapa listos en public/overworlds/: ${counts.official} oficiales, ${counts.composed} armados con piezas oficiales, ${counts.closest} con el oficial más parecido, ${counts.dressed} vestidos con los colores de su entrenador, ${counts.variants} variantes de color (${counts.unchanged} sin repintar), ${counts.failed} con error.`);
  if (counts.failed) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();

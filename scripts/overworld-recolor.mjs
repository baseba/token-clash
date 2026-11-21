// A colour variant of a trainer on its overworld sprite: the ramps repainted on the battle sprite are
// found on the overworld by material (same family of colour, light and share) and get the same tones,
// with the same checks as the battle recolours (whole ramps, light order kept, no merged colours).
import { paletteOf } from './plan-trainer-variants.mjs';
import { chromaOf, hexOf, hslOf, paintRampWithTones, rampsOf, recolorProblems, rgbOfHsl, sameFamily } from './sprite-ramps.mjs';

const NEAR_HUE = 50;
const MAX_SCORE = 1.6;
const hexKey = (hex) => parseInt(hex.slice(1), 16);
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const weighted = (ramp) => {
  const w = ramp.colors.reduce((s, e) => s + e.count, 0) || 1;
  const l = ramp.colors.reduce((s, e) => s + e.hsl[2] * e.count, 0) / w;
  const c = ramp.colors.reduce((s, e) => s + chromaOf(e.hsl) * e.count, 0) / w;
  const mid = ramp.colors.reduce((best, e) => (Math.abs(e.hsl[2] - l) < Math.abs(best.hsl[2] - l) ? e : best), ramp.colors[0]);
  return { count: w, light: l, chroma: c, mid };
};

export function overworldVariant(battle, overworld, map) {
  const painted = new Map(map.filter((entry) => entry.length === 2).map(([from, to]) => [hexKey(from), to]));
  const battleColors = paletteOf(battle);
  const battleRamps = rampsOf(battleColors).ramps;
  const owColors = paletteOf(overworld);
  const { ramps: owRamps, shared } = rampsOf(owColors);
  const owTotal = [...owColors.values()].reduce((s, e) => s + e.count, 0);
  const battleTotal = [...battleColors.values()].reduce((s, e) => s + e.count, 0);
  const used = new Set();
  const groups = [];
  for (const ramp of battleRamps) {
    const done = ramp.colors.filter((e) => painted.has(hexKey(hexOf(e.rgb))));
    if (!done.length) continue;
    const source = weighted(ramp);
    const tones = done.map((e) => hslOf(rgbOf(painted.get(hexKey(hexOf(e.rgb)))))).sort((a, b) => a[2] - b[2]);
    const targetLight = tones.reduce((s, t) => s + t[2], 0) / tones.length;
    const candidates = owRamps
      .filter((r) => !r.skin && !used.has(r))
      .map((r) => ({ r, w: weighted(r) }))
      .filter(({ w }) => sameFamily(w.mid, source.mid) || (w.chroma > 0.15 && source.chroma > 0.15 && hueGap(w.mid.hsl[0], source.mid.hsl[0]) < NEAR_HUE))
      .map(({ r, w }) => ({ r, w, score: (w.chroma < 0.1 || source.chroma < 0.1 ? 0 : hueGap(w.mid.hsl[0], source.mid.hsl[0]) / 60) + Math.abs(w.chroma - source.chroma) * 2 + Math.abs(w.light - source.light) * 2 + Math.abs(w.count / owTotal - source.count / battleTotal) }))
      .sort((a, b) => a.score - b.score);
    const best = candidates[0];
    if (!best || best.score > MAX_SCORE) continue;
    used.add(best.r);
    const wanted = best.w.light + (targetLight - source.light);
    groups.push({ ramp: best.r, tones, paint: paintRampWithTones(best.r, tones.length >= 2 ? tones : [tones[0], tones[0]], wanted) });
  }
  const kept = keepValid(groups, (map) => recolorProblems(owColors, owRamps, shared, map));
  if (kept.length) return { map: kept.flatMap((group) => group.paint), problems: [] };
  const tones = [...new Set(map.filter((entry) => entry.length === 2).map(([, to]) => to))].map((hex) => hslOf(rgbOf(hex))).filter((hsl) => chromaOf(hsl) > 0.08);
  const outfit = mainOutfit(owRamps, owColors, shared);
  if (!outfit || !tones.length) return { map: [], problems: ['sin rampa que repintar'] };
  const dominant = dominantTones(tones);
  const paint = paintRampWithTones(outfit, dominant, weighted(outfit).light);
  return { map: paint, problems: recolorProblems(owColors, owRamps, shared, paint) };
}

/** Drops the ramps that break a rule, one at a time, keeping as many repainted ramps as possible. */
function keepValid(groups, problemsOf) {
  let kept = [...groups];
  while (kept.length && problemsOf(kept.flatMap((group) => group.paint)).length) {
    const worst = kept.map((group, i) => ({ i, left: problemsOf(kept.filter((_, j) => j !== i).flatMap((other) => other.paint)).length })).sort((a, b) => a.left - b.left)[0];
    kept = kept.filter((_, j) => j !== worst.i);
  }
  return kept;
}

/** The biggest coloured ramp that is not skin nor shared: the clothes a variant repaints first. */
export function mainOutfit(ramps, colors, shared) {
  const sharedKeys = new Set([...(shared ?? [])].map((entry) => (typeof entry === 'number' ? entry : hexKey(hexOf(entry.rgb ?? entry)))));
  return ramps
    .filter((ramp) => !ramp.skin && ramp.colors.length >= 2 && !ramp.colors.some((entry) => sharedKeys.has(hexKey(hexOf(entry.rgb)))))
    .map((ramp) => ({ ramp, w: weighted(ramp) }))
    .filter(({ w }) => w.light > 0.12 && w.light < 0.9)
    .sort((a, b) => b.w.count * (0.3 + b.w.chroma) - a.w.count * (0.3 + a.w.chroma))[0]?.ramp ?? null;
}

/** The tones of the most repainted hue, darkest first. */
function dominantTones(tones) {
  const byHue = new Map();
  for (const hsl of tones) {
    const bucket = Math.round(hsl[0] / 30) % 12;
    byHue.set(bucket, [...(byHue.get(bucket) ?? []), hsl]);
  }
  const best = [...byHue.values()].sort((a, b) => b.length - a.length)[0];
  const sorted = best.sort((a, b) => a[2] - b[2]);
  return sorted.length >= 2 ? sorted : [sorted[0], sorted[0]];
}

const NEAR_COLOR = 48;
const FRONT = 4;
const FRAME = 32;

/** The frame looking at you (standing, facing down) of a normalized sheet: the one the colours are decided on. */
export function frontFrame(sheet) {
  const rgba = Buffer.alloc(FRAME * FRAME * 4);
  sheet.rgba.copy(rgba, 0, FRONT * FRAME * FRAME * 4, (FRONT + 1) * FRAME * FRAME * 4);
  return { width: FRAME, height: FRAME, rgba };
}

function colorsOf(image) {
  const found = new Set();
  for (let i = 0; i < image.width * image.height; i++) if (image.rgba[i * 4 + 3]) found.add(image.rgba.readUIntBE(i * 4, 3));
  return found;
}

/**
 * The front's repaint carried to the back and the sides, colour by colour: a colour the front has
 * gets exactly the same replacement, and one only seen from behind or the side gets the change its
 * closest front colour got (same hue, the same shift in saturation and light).
 */
export function extendFrontMap(sheet, map) {
  const table = new Map(map.map(([from, to]) => [hexKey(from), to]));
  const front = [...colorsOf(frontFrame(sheet))];
  const out = [...map];
  const rampOf = new Map();
  for (const ramp of rampsOf(paletteOf(sheet)).ramps) for (const entry of ramp.colors) rampOf.set(hexKey(hexOf(entry.rgb)), ramp);
  const lightOf = (color) => hslOf([color >> 16, (color >> 8) & 255, color & 255])[2];
  for (const color of colorsOf(sheet)) {
    if (table.has(color) || front.includes(color)) continue;
    const rgb = [color >> 16, (color >> 8) & 255, color & 255];
    const ramp = rampOf.get(color);
    const sameRamp = ramp ? front.filter((other) => rampOf.get(other) === ramp && table.has(other)) : [];
    const nearest = sameRamp.length
      ? { other: sameRamp.sort((a, b) => Math.abs(lightOf(a) - lightOf(color)) - Math.abs(lightOf(b) - lightOf(color)))[0], gap: 0 }
      : front.map((other) => ({ other, gap: Math.hypot(rgb[0] - (other >> 16), rgb[1] - ((other >> 8) & 255), rgb[2] - (other & 255)) })).sort((a, b) => a.gap - b.gap)[0];
    if (!nearest || nearest.gap > NEAR_COLOR || !table.has(nearest.other)) continue;
    const before = hslOf([nearest.other >> 16, (nearest.other >> 8) & 255, nearest.other & 255]);
    const after = hslOf(rgbOf(table.get(nearest.other)));
    const own = hslOf(rgb);
    const clamp = (value) => Math.max(0, Math.min(1, value));
    out.push([hexOf(rgb), hexOf(rgbOfHsl(after[0], clamp(own[1] + after[1] - before[1]), clamp(own[2] + after[2] - before[2])))]);
  }
  return out;
}

/** Skin is never repainted: light, warm tones (faces, arms, legs); darker reds and oranges are hair or clothes. */
export function isSkinTone(hex) {
  const [hue, saturation, light] = hslOf(rgbOf(hex));
  return hue >= 10 && hue <= 40 && saturation >= 0.3 && light >= 0.62 && light <= 0.93;
}

export const withoutSkin = (map) => map.filter(([from]) => !isSkinTone(from));

export function applyMap(image, map) {
  const table = new Map(map.map(([from, to]) => [hexKey(from), rgbOf(to)]));
  const rgba = Buffer.from(image.rgba);
  for (let i = 0; i < image.width * image.height; i++) {
    if (!rgba[i * 4 + 3]) continue;
    const to = table.get(image.rgba.readUIntBE(i * 4, 3));
    if (to) to.forEach((v, c) => (rgba[i * 4 + c] = v));
  }
  return { width: image.width, height: image.height, rgba };
}

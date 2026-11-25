import { hsl, isSkin, paletteOf } from './plan-trainer-variants.mjs';
import { hexOf, hslOf, rampsOf, rgbOfHsl } from './sprite-ramps.mjs';
import { familiesOf, hueGap, oklchOf, paintPlans, tintable } from './sprite-rotate.mjs';
import { SKIN } from './sync-trainers.js';

const MAX_SCORE = 1.2;
const PAINTED_SHARE = 0.5;
const TURNING_CHROMA = 0.035;
const COLOURED_SHARE = 0.5;
const TINT_REACH = 0.25;
const MIN_SHARE = 0.03;
const KIND_GAP = 1;
const TINT_MIN_LIGHT = 0.3;
const SKIN_REUSE = 0.08;
const SKIN_MIN_LIGHT = 0.6;

const hexKey = (hex) => parseInt(hex.slice(1), 16);
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function meanHue(items) {
  const x = items.reduce((sum, { hue, weight }) => sum + Math.cos((hue * Math.PI) / 180) * weight, 0);
  const y = items.reduce((sum, { hue, weight }) => sum + Math.sin((hue * Math.PI) / 180) * weight, 0);
  return (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;
}

export function sharedSkinTones(sheets) {
  const seen = new Map();
  for (const sheet of sheets) for (const color of colorsOf(sheet)) seen.set(color, (seen.get(color) ?? 0) + 1);
  return new Set([...seen].filter(([color, count]) => count >= sheets.length * SKIN_REUSE && isSkin(hsl([color >> 16, (color >> 8) & 255, color & 255])) && hsl([color >> 16, (color >> 8) & 255, color & 255])[2] >= SKIN_MIN_LIGHT).map(([color]) => color));
}

export function overworldAnalysis(frame, skinTones) {
  const palette = paletteOf(frame);
  for (const [color, entry] of palette) entry.canonSkin = skinTones.has(color);
  return familiesOf(palette);
}

const weightOf = (colors) => colors.reduce((sum, color) => sum + color.count, 0);
const turningOf = (family) => family.colors.filter((color) => color.oklch[1] >= TURNING_CHROMA);

function lookOf(colors) {
  const turning = colors.filter((color) => color.oklch[1] >= TURNING_CHROMA);
  const neutral = weightOf(turning) < weightOf(colors) * COLOURED_SHARE;
  const shown = neutral ? colors : turning;
  const total = weightOf(shown) || 1;
  const average = (pick) => shown.reduce((sum, color) => sum + pick(color) * color.count, 0) / total;
  return {
    neutral,
    top: Math.max(...colors.map((color) => color.oklch[0])),
    light: average((color) => color.oklch[0]),
    chroma: average((color) => color.oklch[1]),
    hue: !neutral ? meanHue(turning.map((color) => ({ hue: color.oklch[2], weight: color.count * color.oklch[1] }))) : null,
  };
}

export function battlePlans(analysis, map) {
  const painted = new Map(map.filter((entry) => entry.length === 2).map(([from, to]) => [from.toLowerCase(), oklchOf(rgbOf(to))]));
  return analysis.families
    .map((family) => {
      const turning = tintable(family) || !turningOf(family).length ? family.colors : turningOf(family);
      const done = turning.filter((color) => painted.has(color.hex.toLowerCase()));
      if (!done.length || weightOf(done) < weightOf(turning) * PAINTED_SHARE) return null;
      const total = weightOf(done);
      const source = lookOf(done);
      const hue = meanHue(done.map((color) => ({ hue: painted.get(color.hex.toLowerCase())[2], weight: color.count * Math.max(painted.get(color.hex.toLowerCase())[1], 0.001) })));
      return { family, source, hue, share: total / analysis.opaque };
    })
    .filter(Boolean)
    .sort((a, b) => b.share - a.share);
}

function matchScore(plan, family, opaque) {
  const { source } = plan;
  const look = lookOf(family.colors);
  const kindGap = source.neutral !== look.neutral ? KIND_GAP : 0;
  const hue = source.neutral || look.neutral ? 0 : hueGap(source.hue, look.hue) / 60;
  return kindGap + hue + Math.abs(source.light - look.light) * 2 + Math.abs(source.chroma - look.chroma) * 2 + Math.abs(plan.share - family.weight / opaque);
}

const paintable = (family, opaque) => !family.unsure && family.weight >= opaque * MIN_SHARE;
const visibility = (family) => family.weight * (tintable(family) ? 0.05 : family.chroma);

export function overworldPlans(plans, analysis) {
  const candidates = analysis.families.filter((family) => paintable(family, analysis.opaque));
  const used = new Set();
  const out = [];
  for (const plan of plans) {
    const best = candidates
      .filter((family) => !used.has(family))
      .map((family) => ({ family, score: matchScore(plan, family, analysis.opaque) }))
      .sort((a, b) => a.score - b.score)[0];
    if (!best || best.score > MAX_SCORE) continue;
    used.add(best.family);
    out.push({ family: tintable(best.family) ? { ...best.family, colors: best.family.colors.filter((color) => color.oklch[0] <= plan.source.top + TINT_REACH) } : best.family, hue: plan.hue });
  }
  if (out.length || !plans.length) return out;
  const main = candidates.filter((family) => !tintable(family) || family.light >= TINT_MIN_LIGHT).sort((a, b) => visibility(b) - visibility(a))[0];
  return main ? [{ family: main, hue: plans[0].hue }] : [];
}

export function overworldVariant(battle, overworld, map, skinTones) {
  const plans = battlePlans(familiesOf(paletteOf(battle)), map);
  if (!plans.length) return { map: [], problems: ['el sprite de batalla no cambia'] };
  const analysis = overworldAnalysis(overworld, skinTones);
  const placed = overworldPlans(plans, analysis);
  if (!placed.length) return { map: [], problems: ['sin familia que repintar'] };
  const sharedSkin = (hex) => skinTones.has(hexKey(hex));
  const repaint = paintPlans(placed, analysis).filter(([from, , kind]) => kind === SKIN || !sharedSkin(from));
  const skin = [...new Set([...analysis.kept.skin.map((color) => color.hex), ...[...skinTones].map((color) => `#${color.toString(16).padStart(6, '0')}`)])].map((hex) => hex.toLowerCase());
  return { map: repaint, skin, problems: [] };
}

const NEAR_COLOR = 48;
const FRONT = 4;
const FRAME = 32;

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

export function isSkinTone(hex) {
  const [hue, saturation, light] = hslOf(rgbOf(hex));
  return hue >= 10 && hue <= 40 && saturation >= 0.3 && light >= 0.62 && light <= 0.93;
}

export const withoutSkin = (map) => map.filter(([from]) => !isSkinTone(from));

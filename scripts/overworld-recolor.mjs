// A colour variant of a trainer on its overworld sprite, with the same functions as the battle
// recolour (scripts/sprite-rotate.mjs): the overworld's colours are split into families with
// `familiesOf`, its skin found by `skinOf` from the skin tones the GBA sprites share (as the battle
// sprites' shared tones seed theirs), each family the variant repainted on the battle sprite is found
// on the overworld by material, and `paintPlans` turns only its tint in OKLCH to the hue the battle
// family got, with the shadows shared by skin and clothes decided piece by piece by `recolorByMap`.
import { hsl, isSkin, paletteOf } from './plan-trainer-variants.mjs';
import { hexOf, hslOf, rampsOf, rgbOfHsl } from './sprite-ramps.mjs';
import { familiesOf, hueGap, oklchOf, paintPlans, tintable } from './sprite-rotate.mjs';
import { SKIN } from './sync-trainers.js';

/** How far an overworld family may be from the battle one it stands for (hue in 60° steps, light, chroma and share). */
const MAX_SCORE = 1.2;
/** Share of a battle family's coloured tones (the ones a rotation turns; greys in it stay) that must be repainted to count it as changed. */
const PAINTED_SHARE = 0.5;
const TURNING_CHROMA = 0.035;
/** Share of a set's pixels that must be coloured for it to read as a colour and not as grey. */
const COLOURED_SHARE = 0.5;
/** How much lighter than the battle tones that changed an overworld grey may be and still be tinted: a white shirt beside a black suit stays white. */
const TINT_REACH = 0.25;
/** Smallest overworld family worth repainting, as a share of the figure's pixels. */
const MIN_SHARE = 0.03;
const KIND_GAP = 1;
/** A grey darker than this is not tinted (like the battle recolour's tint floor), so it cannot carry a variant alone. */
const TINT_MIN_LIGHT = 0.3;
/** Share of the official overworlds a skin tone must appear in to be one of the GBA's shared skin tones. */
const SKIN_REUSE = 0.08;
/** Shared tones darker than this are hair or clothes shadows more often than skin: skinOf adds the skin's own by contact. */
const SKIN_MIN_LIGHT = 0.6;

const hexKey = (hex) => parseInt(hex.slice(1), 16);
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

function meanHue(items) {
  const x = items.reduce((sum, { hue, weight }) => sum + Math.cos((hue * Math.PI) / 180) * weight, 0);
  const y = items.reduce((sum, { hue, weight }) => sum + Math.sin((hue * Math.PI) / 180) * weight, 0);
  return (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360;
}

/** The skin tones the official overworlds share, like the faces the battle sprites share: they seed each overworld's skin. */
export function sharedSkinTones(sheets) {
  const seen = new Map();
  for (const sheet of sheets) for (const color of colorsOf(sheet)) seen.set(color, (seen.get(color) ?? 0) + 1);
  return new Set([...seen].filter(([color, count]) => count >= sheets.length * SKIN_REUSE && isSkin(hsl([color >> 16, (color >> 8) & 255, color & 255])) && hsl([color >> 16, (color >> 8) & 255, color & 255])[2] >= SKIN_MIN_LIGHT).map(([color]) => color));
}

/** An overworld frame's families, its skin seeded by the shared skin tones. */
export function overworldAnalysis(frame, skinTones) {
  const palette = paletteOf(frame);
  for (const [color, entry] of palette) entry.canonSkin = skinTones.has(color);
  return familiesOf(palette);
}

const weightOf = (colors) => colors.reduce((sum, color) => sum + color.count, 0);
const turningOf = (family) => family.colors.filter((color) => color.oklch[1] >= TURNING_CHROMA);

/**
 * What a set of tones looks like, to compare materials: neutral when most of its pixels are grey (a
 * black suit with a red pin is a black suit, a grey one with an olive shadow a grey one), else the
 * hue, light and chroma of its coloured tones (a grey beside them does not count).
 */
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

/** The families of the battle sprite the variant repainted, each described by the tones that changed (a grey beside them stays) and the hue they were turned to, heaviest first. */
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

/**
 * The plans for an overworld frame: each repainted battle family matched to the overworld family most
 * like it, with the hue the battle one got. When none is found, the overworld's most visible family
 * takes the main one, so a variant always shows on the map.
 */
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

/**
 * The repaint of an overworld frame for a variant, as a map `recolorByMap` applies (whole colours,
 * shared shadows and skin). The GBA's shared skin tones are always skin, even where `skinOf` left one
 * in a family, so they are never repainted.
 */
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

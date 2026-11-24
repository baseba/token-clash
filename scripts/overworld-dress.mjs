// A trainer's overworld dressed in its own clothes. Many trainers walk the map as an official sprite of
// a similar class (a generic clerk, a worker, a woman of the town) whose colours are not theirs: each
// piece of the overworld (a family of colour: hair, a shirt, trousers) takes the hue, saturation and
// light of the piece of the battle sprite at the same height of the figure. Unlike a colour variant
// the light moves too, so a red shirt can become a black suit; each piece keeps the light steps
// between its tones. Skin and outline are found as in the variants
// (scripts/overworld-recolor.mjs) and never change.
import { paletteOf } from './plan-trainer-variants.mjs';
import { overworldAnalysis } from './overworld-recolor.mjs';
import { hexOf } from './sprite-ramps.mjs';
import { familiesOf, hueGap, rgbOfOklch } from './sprite-rotate.mjs';

/** Smallest family that counts as a piece of clothing or hair, as a share of the figure. */
const MIN_SHARE = 0.05;
/** How far apart (in figure heights) two families may sit and still be the same piece. */
const MAX_HEIGHT_GAP = 0.25;
/** Height of each band of the figure that paletteOf counts in: hair, neck, top, legs. */
const BAND_HEIGHTS = { hair: 0.11, neck: 0.25, torso: 0.43, legs: 0.79 };
/** Share of a tone's pixels on the head (the hair band) for it to be part of the head's piece. */
const HEAD_SHARE = 0.5;
/** Below this chroma a family reads as white, grey or black. */
const NEUTRAL = 0.035;
/** A part already this close to the battle sprite's is left as it is. */
const CLOSE = { hue: 25, light: 0.08, chroma: 0.04 };
const LIGHT_RANGE = [0.14, 0.97];
const MAX_CHROMA = 0.3;

const clamp = (value, [low, high]) => Math.max(low, Math.min(high, value));

function lookOf(colors) {
  const total = colors.reduce((sum, color) => sum + color.count, 0) || 1;
  const average = (pick) => colors.reduce((sum, color) => sum + pick(color) * color.count, 0) / total;
  const coloured = colors.filter((color) => color.oklch[1] >= NEUTRAL);
  let x = 0;
  let y = 0;
  for (const color of coloured) {
    x += Math.cos((color.oklch[2] * Math.PI) / 180) * color.count * color.oklch[1];
    y += Math.sin((color.oklch[2] * Math.PI) / 180) * color.count * color.oklch[1];
  }
  const chroma = average((color) => color.oklch[1]);
  return { light: average((color) => color.oklch[0]), chroma, hue: coloured.length && chroma >= NEUTRAL ? (((Math.atan2(y, x) * 180) / Math.PI) % 360 + 360) % 360 : null };
}

/** How far down the figure some tones sit, from 0 (top of the head) to 1 (the feet). */
function heightOf(colors) {
  let hair = 0;
  let torso = 0;
  let legs = 0;
  let weight = 0;
  for (const color of colors) {
    hair += color.entry.hairBand ?? 0;
    torso += color.entry.torso ?? 0;
    legs += color.entry.legs ?? 0;
    weight += color.count;
  }
  const neck = Math.max(0, weight - hair - torso - legs);
  return (hair * BAND_HEIGHTS.hair + neck * BAND_HEIGHTS.neck + torso * BAND_HEIGHTS.torso + legs * BAND_HEIGHTS.legs) / (weight || 1);
}

const onHead = (color) => (color.entry.hairBand ?? 0) >= color.count * HEAD_SHARE;

/**
 * The pieces of a figure: each family, split in two when its tones are both on the head and on the
 * body (blond hair and an orange dress can be one family of colour, but they are two pieces).
 */
function piecesOf(analysis) {
  const pieces = [];
  for (const family of analysis.families.filter((candidate) => !candidate.unsure)) {
    const head = family.colors.filter(onHead);
    const body = family.colors.filter((color) => !onHead(color));
    for (const colors of head.length && body.length ? [head, body] : [family.colors]) {
      const weight = colors.reduce((sum, color) => sum + color.count, 0);
      if (weight >= analysis.opaque * MIN_SHARE) pieces.push({ colors, height: heightOf(colors), share: weight / analysis.opaque });
    }
  }
  return pieces;
}

/**
 * Each piece of the overworld (hair, clothes) paired with the piece of the battle sprite at the same
 * height of the figure, the biggest first, each piece once.
 */
export function pairsOf(battleAnalysis, overworldAnalysis) {
  const battle = piecesOf(battleAnalysis);
  const pairs = [];
  for (const piece of piecesOf(overworldAnalysis).sort((a, b) => b.share - a.share)) {
    const best = battle
      .filter((other) => !pairs.some((pair) => pair.to === other.colors))
      .map((other) => ({ other, gap: Math.abs(other.height - piece.height) + Math.abs(other.share - piece.share) / 2 }))
      .sort((a, b) => a.gap - b.gap)[0];
    if (best && Math.abs(best.other.height - piece.height) <= MAX_HEIGHT_GAP) pairs.push({ from: piece.colors, to: best.other.colors });
  }
  return pairs;
}

const isClose = (a, b) =>
  Math.abs(a.light - b.light) <= CLOSE.light && Math.abs(a.chroma - b.chroma) <= CLOSE.chroma && (a.hue === null || b.hue === null ? a.hue === b.hue : hueGap(a.hue, b.hue) <= CLOSE.hue);

/** An overworld piece repainted with the look of the battle one: light moved by the gap between them, chroma scaled, hue taken. */
export function dressPiece(colors, target) {
  const own = lookOf(colors);
  const scale = own.chroma >= NEUTRAL ? target.chroma / own.chroma : 1;
  return colors.map((color) => {
    const [lightness, chroma, hue] = color.oklch;
    const light = clamp(lightness + target.light - own.light, LIGHT_RANGE);
    const newChroma = target.hue === null ? Math.min(chroma, target.chroma) : Math.min(own.chroma >= NEUTRAL ? chroma * scale : target.chroma, MAX_CHROMA);
    return [color.hex, hexOf(rgbOfOklch(light, newChroma, target.hue ?? hue))];
  });
}

/**
 * The map that dresses an overworld frame in the battle sprite's clothes, or none when every part
 * already looks like the trainer's (or the parts cannot be told apart).
 */
export function dressMap(battle, frame, skinTones) {
  const analysis = overworldAnalysis(frame, skinTones);
  const skin = new Set(analysis.kept.skin.map((color) => color.hex));
  const map = [];
  for (const { from, to } of pairsOf(familiesOf(paletteOf(battle)), analysis)) {
    const target = lookOf(to);
    if (isClose(lookOf(from), target)) continue;
    map.push(...dressPiece(from, target).filter(([hex]) => !skin.has(hex) && !skinTones.has(parseInt(hex.slice(1), 16))));
  }
  return map;
}

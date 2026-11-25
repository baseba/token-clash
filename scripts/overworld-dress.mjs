import { paletteOf } from './plan-trainer-variants.mjs';
import { overworldAnalysis } from './overworld-recolor.mjs';
import { hexOf } from './sprite-ramps.mjs';
import { familiesOf, hueGap, rgbOfOklch } from './sprite-rotate.mjs';

const MIN_SHARE = 0.05;
const MAX_HEIGHT_GAP = 0.25;
const BAND_HEIGHTS = { hair: 0.11, neck: 0.25, torso: 0.43, legs: 0.79 };
const HEAD_SHARE = 0.5;
const NEUTRAL = 0.035;
const CLOSE = { hue: 25, light: 0.08, chroma: 0.04 };
const SAME_GARMENT = 12;
const HELD_REACH = 0.4;
const UNPAIRED = 1;
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

function garmentsOf(pieces) {
  const garments = [];
  for (const piece of pieces) {
    const hue = lookOf(piece.colors).hue;
    const same = hue === null ? null : garments.find((garment) => garment.hue !== null && hueGap(garment.hue, hue) <= SAME_GARMENT);
    if (!same) {
      garments.push({ ...piece, hue });
      continue;
    }
    const share = same.share + piece.share;
    same.height = (same.height * same.share + piece.height * piece.share) / share;
    same.share = share;
    same.colors = [...same.colors, ...piece.colors];
  }
  return garments;
}

const isHeld = (piece) => piece.colors.reduce((sum, color) => sum + (color.entry.offAxis ?? 0), 0) / piece.colors.reduce((sum, color) => sum + color.count, 0) > HELD_REACH;

const gapOf = (piece, other) => Math.abs(other.height - piece.height) + Math.abs(other.share - piece.share) / 2;

function pairPieces(pieces, battle) {
  let best = { pairs: [], cost: Infinity };
  const search = (index, pairs, cost) => {
    if (cost >= best.cost) return;
    if (index === pieces.length) {
      best = { pairs, cost };
      return;
    }
    const piece = pieces[index];
    for (const other of battle)
      if (!pairs.some((pair) => pair.to === other.colors) && Math.abs(other.height - piece.height) <= MAX_HEIGHT_GAP)
        search(index + 1, [...pairs, { from: piece.colors, to: other.colors }], cost + piece.share * gapOf(piece, other));
    search(index + 1, pairs, cost + piece.share * UNPAIRED);
  };
  search(0, [], 0);
  return best;
}

export function pairsOf(battleAnalysis, overworldAnalysis) {
  const battle = piecesOf(battleAnalysis).filter((piece) => !isHeld(piece));
  const pieces = piecesOf(overworldAnalysis);
  const apart = pairPieces(pieces, battle);
  const merged = pairPieces(garmentsOf(pieces), battle);
  return (merged.cost < apart.cost ? merged : apart).pairs;
}

const isClose = (a, b) =>
  Math.abs(a.light - b.light) <= CLOSE.light && Math.abs(a.chroma - b.chroma) <= CLOSE.chroma && (a.hue === null || b.hue === null ? a.hue === b.hue : hueGap(a.hue, b.hue) <= CLOSE.hue);

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

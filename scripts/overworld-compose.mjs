// The overworld sprite of a trainer no game drew one for, built only from official ones: the body of
// the official whose clothes are laid out most like the trainer's, the head of the official whose
// hair looks most like it (cut at the neck, frame by frame, only when both have the same skin), and
// then hair, clothes and accent repainted with the trainer's own colours from its battle sprite. Skin,
// eyes and outline keep their official colours, and the repaint passes the recolour checks.
import { paletteOf } from './plan-trainer-variants.mjs';
import { chromaOf, paintRampWithTones, rampsOf, recolorProblems } from './sprite-ramps.mjs';
import { extendFrontMap, withoutSkin } from './overworld-recolor.mjs';

const FRAME = 32;
const FRAMES = 16;
const FRONT = 4;
const HEAD_ROWS = 12;
const SKIN_GAP = 0.08;
const ROLES = ['hair', 'top', 'bottom', 'accent'];

const hexKey = (hex) => parseInt(hex.slice(1), 16);
const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b)) / 180;

export function frameOf(sheet, index) {
  const rgba = Buffer.alloc(FRAME * FRAME * 4);
  sheet.rgba.copy(rgba, 0, index * FRAME * FRAME * 4, (index + 1) * FRAME * FRAME * 4);
  return { width: FRAME, height: FRAME, rgba };
}

function topRow(sheet, index) {
  for (let y = 0; y < FRAME; y++)
    for (let x = 0; x < FRAME; x++) if (sheet.rgba[((index * FRAME + y) * FRAME + x) * 4 + 3]) return y;
  return FRAME;
}

const meanOf = (ramp) => {
  const weight = ramp.colors.reduce((sum, entry) => sum + entry.count, 0) || 1;
  const light = ramp.colors.reduce((sum, entry) => sum + entry.hsl[2] * entry.count, 0) / weight;
  const chroma = ramp.colors.reduce((sum, entry) => sum + chromaOf(entry.hsl) * entry.count, 0) / weight;
  const hue = ramp.colors.reduce((best, entry) => (chromaOf(entry.hsl) > chromaOf(best.hsl) ? entry : best), ramp.colors[0]).hsl[0];
  return { weight, light, chroma, hue };
};

/** Which ramp is the hair, the top, the bottom, an accent and the skin, by where its pixels sit. */
export function rolesOf(image) {
  const colors = paletteOf(image);
  const { ramps, shared } = rampsOf(colors);
  const total = [...colors.values()].reduce((sum, entry) => sum + entry.count, 0);
  const share = (ramp, key) => ramp.colors.reduce((sum, entry) => sum + (entry[key] ?? 0), 0) / (ramp.colors.reduce((sum, entry) => sum + entry.count, 0) || 1);
  const free = ramps.filter((ramp) => !ramp.skin && meanOf(ramp).light > 0.1 && meanOf(ramp).weight >= total * 0.02);
  const taken = new Set();
  const pick = (key, min) => {
    const best = free.filter((ramp) => !taken.has(ramp)).map((ramp) => ({ ramp, score: share(ramp, key) * Math.sqrt(meanOf(ramp).weight) })).sort((a, b) => b.score - a.score)[0];
    if (!best || share(best.ramp, key) < min) return null;
    taken.add(best.ramp);
    return best.ramp;
  };
  const roles = { hair: pick('hairBand', 0.2), top: pick('torso', 0.3), bottom: pick('legs', 0.3) };
  roles.accent = free.filter((ramp) => !taken.has(ramp) && meanOf(ramp).chroma > 0.15).sort((a, b) => meanOf(b).weight - meanOf(a).weight)[0] ?? null;
  roles.skin = ramps.filter((ramp) => ramp.skin).sort((a, b) => meanOf(b).weight - meanOf(a).weight)[0] ?? null;
  return { roles, colors, ramps, shared, total };
}

function roleGap(a, b, role) {
  const [x, y] = [a.roles[role], b.roles[role]];
  if (!x || !y) return 0.6;
  const [mx, my] = [meanOf(x), meanOf(y)];
  return Math.abs(mx.light - my.light) + Math.abs(mx.weight / a.total - my.weight / b.total) * 2 + (mx.chroma > 0.15 && my.chroma > 0.15 ? hueGap(mx.hue, my.hue) * 0.5 : 0);
}

const bodyGap = (template, target) => roleGap(template, target, 'top') + roleGap(template, target, 'bottom');
const hairGap = (template, target) => roleGap(template, target, 'hair') * 2 + roleGap(template, target, 'top') * 0.3;

function skinClose(a, b) {
  if (!a.roles.skin || !b.roles.skin) return false;
  const [x, y] = [meanOf(a.roles.skin), meanOf(b.roles.skin)];
  return Math.abs(x.light - y.light) < SKIN_GAP && hueGap(x.hue, y.hue) < 0.06;
}

/** Head rows of one sheet over the body of another, frame by frame. */
export function joinAtNeck(head, body) {
  const rgba = Buffer.from(body.rgba);
  for (let index = 0; index < FRAMES; index++) {
    const bodyTop = topRow(body, index);
    const headTop = topRow(head, index);
    if (bodyTop >= FRAME || headTop >= FRAME) continue;
    for (let row = 0; row < HEAD_ROWS; row++) {
      const to = bodyTop + row;
      const from = headTop + row;
      if (to >= FRAME || from >= FRAME) break;
      for (let x = 0; x < FRAME; x++) {
        const target = ((index * FRAME + to) * FRAME + x) * 4;
        const source = ((index * FRAME + from) * FRAME + x) * 4;
        head.rgba.copy(rgba, target, source, source + 4);
      }
    }
  }
  return { width: body.width, height: body.height, rgba };
}

function repaint(sheet, target) {
  const template = rolesOf(frameOf(sheet, FRONT));
  const groups = [];
  for (const role of ROLES) {
    const [from, to] = [template.roles[role], target.roles[role]];
    if (!from || !to) continue;
    const tones = to.colors.map((entry) => entry.hsl).sort((a, b) => a[2] - b[2]);
    groups.push(paintRampWithTones(from, tones.length >= 2 ? tones : [tones[0], tones[0]], meanOf(to).light));
  }
  const problemsOf = (map) => recolorProblems(template.colors, template.ramps, template.shared, map);
  let kept = groups;
  while (kept.length && problemsOf(kept.flat()).length) kept = kept.slice(0, -1);
  const table = new Map(withoutSkin(extendFrontMap(sheet, kept.flat())).map(([from, to]) => [hexKey(from), rgbOf(to)]));
  const rgba = Buffer.from(sheet.rgba);
  for (let i = 0; i < sheet.width * sheet.height; i++) {
    if (!rgba[i * 4 + 3]) continue;
    const to = table.get(sheet.rgba.readUIntBE(i * 4, 3));
    if (to) to.forEach((value, channel) => (rgba[i * 4 + channel] = value));
  }
  return { image: { width: sheet.width, height: sheet.height, rgba }, painted: kept.length };
}

/**
 * The composed and repainted sheet for a battle sprite, from `officials` (key → normalized sheet).
 * Returns the templates used so the result can be checked.
 */
export function composeMini(battle, officials) {
  const target = rolesOf(battle);
  const rated = [...officials].map(([key, sheet]) => ({ key, sheet, roles: rolesOf(frameOf(sheet, FRONT)) }));
  if (!rated.length) return null;
  const body = rated.map((template) => ({ ...template, gap: bodyGap(template.roles, target) })).sort((a, b) => a.gap - b.gap)[0];
  const head = rated.filter((template) => template.key === body.key || skinClose(template.roles, body.roles)).map((template) => ({ ...template, gap: hairGap(template.roles, target) })).sort((a, b) => a.gap - b.gap)[0];
  const joined = head.key === body.key ? body.sheet : joinAtNeck(head.sheet, body.sheet);
  const { image, painted } = repaint(joined, target);
  return { image, head: head.key, body: body.key, painted };
}


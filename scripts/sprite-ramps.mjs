const OUTLINE_LIGHT = 0.08;
const NEUTRAL_CHROMA = 0.1;
const WHITE_LIGHT = 0.85;
const STRONG_TOUCH = 0.1;
const SAME_FAMILY = 42;
const SHIFTED_FAMILY = 55;
const SHIFT_STEP = 0.1;
const GREY_STEP = 0.42;
const SHADOW_GAP = 0.08;
const SHADOW_MAX_LIGHT = 0.32;
const RAMP_HUE_SPAN = 50;
const RAMP_SIZE = 6;
const SHARED_CONTACT = 0.2;
const MIN_STEP = 0.035;
const LIGHT_FLOOR = 0.05;
const LIGHT_CEIL = 0.94;
const CHROMA_STEP = 0.3;
const MUTED_CHROMA = 0.2;
const FACE_MIN_LIGHT = 0.4;
const FACE_MIN_PIXELS = 3;
const SKIN_TONE_SAT = 0.3;
const SKIN_TONE_HUE = 12;
const SKIN_TONE_LIGHT = 0.35;
const FACE_HEAD_SHARE = 0.5;
const FACE_MIN_SAT = 0.3;
const HIGHLIGHT_MIN_LIGHT = 0.6;
const HIGHLIGHT_CHROMA = 0.3;
const HIGHLIGHT_CONTACT = 0.25;
const HIGHLIGHT_LEAD = 1.5;
const LOOSE_SIZE = 2;
const SHADE_MAX_LIGHT = 0.35;
const RIM_SHARE = 0.35;
const MATERIAL_SHARE = 0.08;
const SKIN_LINE_LIGHT = 0.45;
const SKIN_LINE_SAT = 0.35;
const TONE_SPREAD = 1.3;
const TONE_MAX_LIFT = 0.08;
const TONE_MAX_SAT = 0.7;
const TONE_WASH_FROM = 0.55;
const TONE_WASH = 0.8;
const TONE_MIN_SPAN = 0.14;
const TONE_MAX_SCALE = 3;
const CONTRAST_CONTACT = 0.08;
const CONTRAST_KEEP = 0.6;

export const chromaOf = ([, s, l]) => (1 - Math.abs(2 * l - 1)) * s;
export const isNeutral = (entry) => chromaOf(entry.hsl) < NEUTRAL_CHROMA;
export const isOutline = (entry) => entry.hsl[2] < OUTLINE_LIGHT;
const isWhite = (entry) => isNeutral(entry) && entry.hsl[2] >= WHITE_LIGHT;
const hueGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));
const signed = (a, b) => ((a - b + 540) % 360) - 180;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function lumaOf([r, g, b]) {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

export function hslOf([r, g, b]) {
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

export function rgbOfHsl(h, s, l) {
  const hue = ((h % 360) + 360) % 360;
  const k = (n) => (n + hue / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  return [0, 8, 4].map((n) => Math.round((l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1))) * 255));
}

export const hexOf = (rgb) => `#${rgb.map((v) => v.toString(16).padStart(2, '0')).join('')}`;

export function sameFamily(a, b) {
  const neutralA = isNeutral(a);
  const neutralB = isNeutral(b);
  if (neutralA && neutralB) return Math.abs(a.hsl[2] - b.hsl[2]) <= GREY_STEP;
  if (chromaOf(a.hsl) < MUTED_CHROMA && chromaOf(b.hsl) < MUTED_CHROMA) return Math.abs(a.hsl[2] - b.hsl[2]) <= GREY_STEP && (neutralA || neutralB || hueGap(a.hsl[0], b.hsl[0]) <= SHIFTED_FAMILY);
  if (neutralA !== neutralB) {
    const grey = neutralA ? a : b;
    const color = neutralA ? b : a;
    return grey.hsl[2] <= SHADOW_MAX_LIGHT && grey.hsl[2] < color.hsl[2] - SHADOW_GAP;
  }
  const gap = hueGap(a.hsl[0], b.hsl[0]);
  const step = Math.abs(a.hsl[2] - b.hsl[2]);
  if (Math.abs(chromaOf(a.hsl) - chromaOf(b.hsl)) > CHROMA_STEP + step) return false;
  return gap <= SAME_FAMILY || (gap <= SHIFTED_FAMILY && step >= SHIFT_STEP);
}

function validRamp(entries) {
  if (entries.length > RAMP_SIZE || hueSpan(entries) > RAMP_HUE_SPAN) return false;
  const chromatic = entries.filter((e) => !isNeutral(e));
  const neutral = entries.filter((e) => isNeutral(e));
  if (!chromatic.length || !neutral.length || entries.every((e) => chromaOf(e.hsl) < MUTED_CHROMA)) return true;
  const darkest = Math.min(...chromatic.map((e) => e.hsl[2]));
  return neutral.length === 1 && neutral[0].hsl[2] <= SHADOW_MAX_LIGHT && neutral[0].hsl[2] < darkest;
}

const contactsOf = (entry) => [...entry.neighbors.values()].reduce((sum, n) => sum + n, 0);

function hueSpan(members) {
  const hues = members.filter((m) => !isNeutral(m)).map((m) => m.hsl[0]);
  let span = 0;
  for (const a of hues) for (const b of hues) span = Math.max(span, hueGap(a, b));
  return span;
}

export function rampsOf(colors) {
  for (const entry of colors.values()) entry.luma ??= lumaOf(entry.rgb);
  const keys = [...colors.keys()];
  const anchors = skinAnchorsOf(colors);
  const opaque = [...colors.values()].reduce((sum, e) => sum + e.count, 0);
  const owner = new Map(keys.map((key) => [key, key]));
  const members = new Map(keys.map((key) => [key, [key]]));
  const find = (key) => (owner.get(key) === key ? key : find(owner.get(key)));
  const free = (entry) => !isOutline(entry);
  const edges = [];
  for (const [key, entry] of colors) {
    if (!free(entry)) continue;
    for (const [other, touches] of entry.neighbors) {
      if (other <= key || !colors.has(other) || !free(colors.get(other))) continue;
      const partner = colors.get(other);
      const strength = touches / Math.max(1, Math.min(contactsOf(entry), contactsOf(partner)));
      if (strength >= STRONG_TOUCH && sameFamily(entry, partner)) edges.push({ key, other, strength });
    }
  }
  edges.sort((a, b) => b.strength - a.strength);
  for (const { key, other } of edges) {
    const [a, b] = [find(key), find(other)];
    if (a === b) continue;
    const skinA = members.get(a).some((k) => anchors.has(k));
    const skinB = members.get(b).some((k) => anchors.has(k));
    const skinlike = (list) => list.every((k) => skinTone(colors.get(k)));
    if (!skinA && !skinB && skinlike(members.get(a)) !== skinlike(members.get(b)) && (members.get(a).some((k) => skinTone(colors.get(k))) || members.get(b).some((k) => skinTone(colors.get(k))))) continue;
    const joining = members.get(skinA ? b : a);
    if (skinA !== skinB && (joining.length > 1 || !colors.get(joining[0]).skin)) continue;
    const merged = [...members.get(a), ...members.get(b)];
    const entries = merged.map((k) => colors.get(k));
    if (!validRamp(entries)) continue;
    owner.set(b, a);
    members.set(a, merged);
    members.delete(b);
  }
  const rampOf = new Map();
  const groups = [...members.entries()].filter(([root]) => find(root) === root).map(([, list]) => list);
  groups.forEach((list, i) => list.forEach((key) => rampOf.set(key, i)));
  const shared = new Set();
  for (const [key, entry] of colors) {
    if (isOutline(entry)) {
      shared.add(key);
      continue;
    }
    if (!isWhite(entry) && !(isNeutral(entry) && entry.hsl[2] <= SHADOW_MAX_LIGHT)) continue;
    if (entry.count >= opaque * MATERIAL_SHARE) continue;
    const total = contactsOf(entry);
    const byRamp = new Map();
    for (const [other, touches] of entry.neighbors) {
      const ramp = rampOf.get(other);
      if (ramp === undefined || ramp === rampOf.get(key) || isOutline(colors.get(other))) continue;
      byRamp.set(ramp, (byRamp.get(ramp) ?? 0) + touches);
    }
    const strong = [...byRamp.values()].filter((touches) => touches >= total * SHARED_CONTACT);
    const ownTouches = [...entry.neighbors].filter(([other]) => rampOf.get(other) === rampOf.get(key)).reduce((sum, [, n]) => sum + n, 0);
    if (strong.length >= 2 || (strong.length === 1 && ownTouches < total * SHARED_CONTACT)) shared.add(key);
  }
  absorbEdges(colors, groups, rampOf, shared, anchors);
  const ramps = groups
    .map((list) => list.filter((key) => !shared.has(key)))
    .filter((list) => list.length)
    .map((list) => {
      const entries = list.map((key) => colors.get(key)).sort((a, b) => a.luma - b.luma);
      const weight = entries.reduce((sum, e) => sum + e.count, 0);
      const share = (pick) => (weight ? entries.reduce((sum, e) => sum + pick(e), 0) / weight : 0);
      const chromatic = entries.filter((e) => !isNeutral(e));
      const lowest = Math.min(...entries.map((e) => e.luma));
      const contacts = entries.reduce((sum, e) => sum + contactsOf(e), 0) || 1;
      const darker = new Map();
      for (const e of entries)
        for (const [other, touches] of e.neighbors) {
          const neighbor = colors.get(other);
          if (list.includes(other) || neighbor.hsl[2] < OUTLINE_LIGHT || neighbor.luma >= lowest) continue;
          darker.set(other, (darker.get(other) ?? 0) + touches);
        }
      const floor = Math.max(0, ...[...darker].filter(([, touches]) => touches >= contacts * CONTRAST_CONTACT).map(([other]) => colors.get(other).luma + (lowest - colors.get(other).luma) * CONTRAST_KEEP));
      const around = [...darker.keys(), ...lighterAround(colors, entries, list)];
      return {
        around: around.filter((key) => key !== undefined).map((key) => ({ key, entry: colors.get(key), touches: touchesWith(colors, entries, key) })),
        contacts,
        floor,
        keys: new Set(list),
        colors: entries,
        weight,
        skin: list.some((key) => anchors.has(key)) || entries.every((e) => e.skin),
        neutral: !chromatic.length,
        hue: chromatic.length ? meanHue(chromatic) : null,
        height: share((e) => e.sumY ?? 0),
        hairBand: share((e) => e.hairBand ?? 0),
        headShare: share((e) => e.head ?? 0),
        torso: share((e) => e.torso ?? 0),
        legs: share((e) => e.legs ?? 0),
      };
    })
    .sort((a, b) => b.weight - a.weight);
  for (const ramp of ramps.filter((r) => r.skin)) ramp.colors.forEach((entry, i) => (entry.skinTone = i > 0 || entry.hsl[2] >= SKIN_LINE_LIGHT || entry.hsl[1] >= SKIN_LINE_SAT));
  return { ramps, shared };
}

function lighterAround(colors, entries, list) {
  const highest = Math.max(...entries.map((e) => e.luma));
  const found = new Set();
  for (const e of entries) for (const [other] of e.neighbors) if (!list.includes(other) && colors.get(other).luma > highest) found.add(other);
  return [...found];
}

function touchesWith(colors, entries, key) {
  return entries.reduce((sum, e) => sum + (e.neighbors.get(key) ?? 0), 0);
}

function absorbEdges(colors, groups, rampOf, shared, anchors) {
  const isSkinGroup = (i) => groups[i].some((key) => anchors.has(key));
  for (const [key, entry] of colors) {
    const light = entry.hsl[2] >= HIGHLIGHT_MIN_LIGHT;
    const dark = entry.hsl[2] <= SHADE_MAX_LIGHT;
    if (isOutline(entry) || (!light && !dark) || anchors.has(key)) continue;
    const own = rampOf.get(key);
    const loose = shared.has(key) || groups[own].length === 1 || (light && groups[own].length <= LOOSE_SIZE && chromaOf(entry.hsl) <= HIGHLIGHT_CHROMA);
    if (!loose) continue;
    const total = contactsOf(entry);
    const byRamp = new Map();
    for (const [other, touches] of entry.neighbors) {
      const ramp = rampOf.get(other);
      if (ramp === undefined || ramp === own || isOutline(colors.get(other)) || shared.has(other) || isSkinGroup(ramp)) continue;
      byRamp.set(ramp, (byRamp.get(ramp) ?? 0) + touches);
    }
    const [best, second] = [...byRamp].sort((a, b) => b[1] - a[1]);
    if (!best || best[1] < total * HIGHLIGHT_CONTACT || (second && second[1] * HIGHLIGHT_LEAD > best[1])) continue;
    const target = groups[best[0]].map((k) => colors.get(k));
    if (entry.count > target.reduce((sum, e) => sum + e.count, 0) * RIM_SHARE) continue;
    if (light ? entry.luma <= Math.max(...target.map((e) => e.luma)) : entry.luma >= Math.min(...target.map((e) => e.luma))) continue;
    const chromatic = target.filter((e) => !isNeutral(e));
    if (chromaOf(entry.hsl) > NEUTRAL_CHROMA && chromatic.length && hueGap(entry.hsl[0], meanHue(chromatic)) > SHIFTED_FAMILY) continue;
    if (chromaOf(entry.hsl) > NEUTRAL_CHROMA && !chromatic.length) continue;
    groups[own] = groups[own].filter((k) => k !== key);
    groups[best[0]].push(key);
    rampOf.set(key, best[0]);
    shared.delete(key);
  }
}

const skinTone = (entry) => entry.skin && entry.hsl[0] >= SKIN_TONE_HUE && entry.hsl[1] >= SKIN_TONE_SAT && entry.hsl[2] >= SKIN_TONE_LIGHT;

function skinAnchorsOf(colors) {
  const anchors = new Set([...colors].filter(([, entry]) => entry.canonSkin).map(([key]) => key));
  let best = null;
  for (const [key, entry] of colors) {
    if (!entry.skin || entry.hsl[2] < FACE_MIN_LIGHT) continue;
    if ((entry.face ?? 0) >= FACE_MIN_PIXELS && (entry.head ?? 0) >= entry.count * FACE_HEAD_SHARE && entry.hsl[1] >= FACE_MIN_SAT) anchors.add(key);
    const score = (entry.face ?? 0) * 4 + (entry.head ?? 0);
    if (!best || score > best.score) best = { key, score };
  }
  if (!anchors.size && best) anchors.add(best.key);
  return anchors;
}

export function meanHue(entries) {
  let x = 0;
  let y = 0;
  for (const { hsl: [h, s], count } of entries) {
    x += Math.cos((h * Math.PI) / 180) * s * count;
    y += Math.sin((h * Math.PI) / 180) * s * count;
  }
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}


export function paintRampWithTones(ramp, tones, wanted) {
  const weight = ramp.colors.reduce((sum, e) => sum + e.count, 0) || 1;
  const meanL = ramp.colors.reduce((sum, e) => sum + e.hsl[2] * e.count, 0) / weight;
  const lights = ramp.colors.map((e) => e.hsl[2]);
  const span = Math.max(...lights) - Math.min(...lights);
  const scale = span > 0 ? Math.max(TONE_SPREAD, Math.min(TONE_MIN_SPAN / span, TONE_MAX_SCALE)) : 1;
  const toneLight = tones.reduce((sum, tone) => sum + tone[2], 0) / tones.length;
  const brightest = Math.max(...lights);
  const excess = Math.max(0, wanted + (brightest - meanL) * scale - (brightest + TONE_MAX_LIFT));
  const painted = ramp.colors.map((entry) => {
    const light = clamp(wanted - excess + (entry.hsl[2] - meanL) * scale, LIGHT_FLOOR, LIGHT_CEIL);
    const [h, sat] = toneByLight(tones, light - wanted + excess + toneLight);
    return { entry, hue: h, sat: Math.min(sat, TONE_MAX_SAT) * (1 - Math.max(0, light - TONE_WASH_FROM) * TONE_WASH), light };
  });
  return keepOrder(painted).map(({ entry, rgb }) => [hexOf(entry.rgb), hexOf(rgb)]);
}

function toneByLight(tones, light) {
  if (light <= tones[0][2]) return tones[0];
  if (light >= tones.at(-1)[2]) return tones.at(-1);
  const i = tones.findIndex((tone) => tone[2] >= light);
  const [a, b] = [tones[i - 1], tones[i]];
  const f = b[2] === a[2] ? 0 : (light - a[2]) / (b[2] - a[2]);
  return [a[0] + signed(b[0], a[0]) * f, a[1] + (b[1] - a[1]) * f, light];
}

function keepOrder(painted) {
  const order = [...painted].sort((a, b) => a.entry.luma - b.entry.luma);
  const used = new Set();
  let previous = -1;
  for (const shade of order) {
    let light = shade.light;
    let rgb = rgbOfHsl(shade.hue, shade.sat, light);
    while ((lumaOf(rgb) <= previous + MIN_STEP * (previous < 0 ? 0 : 1) || used.has(hexOf(rgb))) && light < 0.99) {
      light = Math.min(0.99, light + 0.01);
      rgb = rgbOfHsl(shade.hue, shade.sat, light);
    }
    shade.rgb = rgb;
    used.add(hexOf(rgb));
    previous = lumaOf(rgb);
  }
  return painted;
}

export function recolorProblems(colors, ramps, shared, map) {
  const painted = new Map(map.filter((entry) => entry.length === 2).map(([from, to]) => [parseInt(from.slice(1), 16), to]));
  const problems = [];
  const seen = new Map();
  for (const [from, to] of painted) {
    if (seen.has(to)) problems.push(`merges ${hexOf(colors.get(from).rgb)} and ${hexOf(colors.get(seen.get(to)).rgb)} into ${to}`);
    seen.set(to, from);
    if (shared.has(from)) problems.push(`paints the shared color ${hexOf(colors.get(from).rgb)}`);
  }
  for (const ramp of ramps) {
    const done = ramp.colors.filter((e) => painted.has(parseInt(hexOf(e.rgb).slice(1), 16)));
    if (done.length && done.length < ramp.colors.length) problems.push(`paints only part of the ramp ${ramp.colors.map((e) => hexOf(e.rgb)).join(' ')}`);
    for (let i = 1; i < done.length; i++) {
      const [darker, lighter] = [done[i - 1], done[i]].map((e) => lumaOf(rgbOfHex(painted.get(parseInt(hexOf(e.rgb).slice(1), 16)))));
      if (darker >= lighter) problems.push(`turns ${hexOf(done[i].rgb)} darker than ${hexOf(done[i - 1].rgb)}`);
    }
  }
  return problems;
}

const rgbOfHex = (text) => [1, 3, 5].map((i) => parseInt(text.slice(i, i + 2), 16));

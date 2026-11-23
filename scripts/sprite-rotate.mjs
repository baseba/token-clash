import { hexOf, hslOf, rampsOf } from './sprite-ramps.mjs';
import { SHADE, SKIN } from './sync-trainers.js';

const OUTLINE_LIGHT = 0.25;
const OUTLINE_CHROMA = 0.05;
const NEUTRAL_CHROMA = 0.035;
const FAMILY_HUE = 28;
const HAIR_LINE = 0.5;
const SKIN_GAP = 30;
const SKIN_TOUCH = 0.12;
const MIN_ROTATION = 60;
const REGION_SHARE = 0.04;
const SKIN_MAX_CHROMA = 0.12;
const SKIN_RICHER = 0.02;
const SKIN_MAX_TONES = 10;
const SKIN_MIN_STEP = 0.06;
const SKIN_MAX_STEP = 0.22;
const SKIN_TWIN_HUE = 12;
const SKIN_TWIN_CHROMA = 0.025;
const SKIN_HUE_STEP = 45;
const SKIN_CHROMA_STEP = 0.045;
const SKIN_CONTACT = [0.08, 0.15, 0.2];
const SKIN_CLASSIC_CONTACT = 0.05;
const SKIN_CLASSIC_NEAR = 0.012;
const SKIN_FULL_CONTACT = 0.3;
const SKIN_FULL_TONES = 3;
const SKIN_SHADOW_HUE = 5;
const SKIN_SHADOW_SPREAD = 35;
const SKIN_UNSURE_CONTACT = 0.25;
const SKIN_SEED_LIGHT = 0.6;
const SKIN_SEED_DARK = 0.4;
const SKIN_SEED_HUE = 50;
const SKIN_SEED_SPREAD = 12;
const SKIN_SEED_CHROMA = 0.035;
const SKIN_SEED_FACE = 4;
const SKIN_SEED_ENOUGH = 2;
const SKIN_CANON_HUE_STEP = 65;
const SKIN_SEED_FLOOR = 0.25;
const SKIN_SEED_NEAR = 0.035;
const SKIN_LIKE_HUE = 25;
const SKIN_LIKE_SHARE = 0.4;
const SKIN_SHADOW_CHROMA = 0.01;
const SKIN_SHADOW_LIGHT = 0.5;
const SECOND_SHARE = 0.15;
const SECOND_VISIBILITY = 0.5;
const MUTED_CHROMA = 0.05;
const HAIR_VISIBILITY = 0.5;
const ACCENT_GAP = 60;
const TINT_MIN_LIGHT = 0.3;
const TINT_CEIL = 0.96;
const TINT_CHROMA = 0.085;
const PALE_CHROMA = 0.1;
const PALE_BOOST = 1.6;
const TINT_SHARE = 0.08;
const WHITE_FROM = 0.75;
const WHITE_CEIL = 0.92;
const WHITE_CHROMA = 0.125;
const WHITE_VISIBILITY = 0.07;
const GRAY_VISIBILITY = 0.04;
const SKIN_SHADOW_TOUCH = 0.12;
const DARK_YELLOW_LIGHT = 0.6;
const YELLOW_HUES = [70, 120];
const POKEMON_COLORS = 3;
const POKEMON_MIN_LIGHT = 0.22;
const POKEMON_HUE_BUCKET = 30;
const POKEMON_MERGE = 35;
const POKEMON_WHITE = 0.78;
const POKEMON_GRAY = 0.45;
const POKEMON_ACCENT_SHARE = 0.05;
const POKEMON_SATURATION = 0.8;
const SWAP_SHARE = 0.01;
const SWAP_MIN_SATURATION = 0.2;
const POKEMON_TINT_SATURATION = 0.6;
const POKEMON_REGIONS = 2;
const POKEMON_MIN_SHIFT = 30;

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const wrap = (hue) => ((hue % 360) + 360) % 360;
const signedGap = (to, from) => ((to - from + 540) % 360) - 180;
export const hueGap = (a, b) => Math.abs(signedGap(a, b));

const toLinear = (channel) => {
  const value = channel / 255;
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};
const fromLinear = (value) => 255 * (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055);

export function oklchOf([red, green, blue]) {
  const [r, g, b] = [red, green, blue].map(toLinear);
  const long = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const medium = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const short = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const lightness = 0.2104542553 * long + 0.793617785 * medium - 0.0040720468 * short;
  const axisA = 1.9779984951 * long - 2.428592205 * medium + 0.4505937099 * short;
  const axisB = 0.0259040371 * long + 0.7827717662 * medium - 0.808675766 * short;
  return [lightness, Math.hypot(axisA, axisB), wrap((Math.atan2(axisB, axisA) * 180) / Math.PI)];
}

function linearRgbOf(lightness, chroma, hue) {
  const radians = (hue * Math.PI) / 180;
  const [axisA, axisB] = [chroma * Math.cos(radians), chroma * Math.sin(radians)];
  const long = (lightness + 0.3963377774 * axisA + 0.2158037573 * axisB) ** 3;
  const medium = (lightness - 0.1055613458 * axisA - 0.0638541728 * axisB) ** 3;
  const short = (lightness - 0.0894841775 * axisA - 1.291485548 * axisB) ** 3;
  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short,
  ];
}

const inGamut = (channels) => channels.every((value) => value >= -0.0005 && value <= 1.0005);

export function rgbOfOklch(lightness, chroma, hue) {
  let fitting = chroma;
  if (!inGamut(linearRgbOf(lightness, chroma, hue))) {
    let [low, high] = [0, chroma];
    for (let step = 0; step < 24; step++) {
      const middle = (low + high) / 2;
      if (inGamut(linearRgbOf(lightness, middle, hue))) low = middle;
      else high = middle;
    }
    fitting = low;
  }
  return linearRgbOf(lightness, fitting, hue).map((value) => Math.round(clamp(fromLinear(clamp(value, 0, 1)), 0, 255)));
}

const CLASSIC_SKIN = [[255, 214, 189], [222, 165, 123], [189, 123, 99]].map(oklchOf);

export const isOutlineColor = ([lightness, chroma]) => lightness < OUTLINE_LIGHT && chroma < OUTLINE_CHROMA;

function circularMean(items) {
  let x = 0;
  let y = 0;
  for (const { hue, weight } of items) {
    x += Math.cos((hue * Math.PI) / 180) * weight;
    y += Math.sin((hue * Math.PI) / 180) * weight;
  }
  return wrap((Math.atan2(y, x) * 180) / Math.PI);
}

const plausibleSkin = (color) => color.oklch[1] <= SKIN_MAX_CHROMA;

const labOf = ([lightness, chroma, hue]) => [lightness, chroma * Math.cos((hue * Math.PI) / 180), chroma * Math.sin((hue * Math.PI) / 180)];
const labGap = (a, b) => Math.hypot(...labOf(a).map((value, i) => value - labOf(b)[i]));
const sharedShadow = (color) => color.entry.canonSkin && color.oklch[0] < SKIN_SEED_LIGHT;

const nearClassic = (color) => CLASSIC_SKIN.some((classic) => labGap(classic, color.oklch) <= SKIN_CLASSIC_NEAR);

function skinSeeds(colors) {
  const canon = colors.filter((color) => color.entry.canonSkin && plausibleSkin(color) && color.oklch[0] >= SKIN_SEED_LIGHT && color.count >= SKIN_SEED_FACE);
  const score = (color) => {
    const likeness = Math.max(SKIN_SEED_FLOOR, ...CLASSIC_SKIN.map((classic) => Math.exp(-((labGap(classic, color.oklch) / SKIN_SEED_NEAR) ** 2))));
    return (color.entry.face ?? 0) * likeness * Math.exp(-(hueGap(color.oklch[2], SKIN_SEED_HUE) ** 2) / (2 * SKIN_SEED_SPREAD ** 2));
  };
  const seed = colors
    .filter((color) => plausibleSkin(color) && color.oklch[1] >= SKIN_SEED_CHROMA && color.oklch[0] >= SKIN_SEED_DARK && (color.entry.face ?? 0) >= SKIN_SEED_FACE)
    .reduce((best, color) => (!best || score(color) > score(best) ? color : best), null);
  return seed && canon.length < SKIN_SEED_ENOUGH && !canon.includes(seed) ? [seed, ...canon] : canon;
}

const rgbOfKey = (key) => [key >> 16, (key >> 8) & 255, key & 255];

function skinContact(skin, color) {
  const keys = new Set(skin.filter((tone) => !sharedShadow(tone)).map((tone) => tone.key));
  let all = 0;
  let near = 0;
  for (const [other, touches] of color.entry.neighbors) {
    if (isOutlineColor(oklchOf(rgbOfKey(other)))) continue;
    all += touches;
    if (keys.has(other)) near += touches;
  }
  return all ? near / all : 0;
}

function fillsSkinGap(skin, color) {
  const nearest = skin.reduce((best, tone) => (Math.abs(tone.oklch[0] - color.oklch[0]) < Math.abs(best.oklch[0] - color.oklch[0]) ? tone : best));
  if (color.oklch[1] > Math.max(SKIN_MAX_CHROMA, nearest.oklch[1] + SKIN_RICHER)) return false;
  const step = Math.abs(nearest.oklch[0] - color.oklch[0]);
  const darkest = Math.min(...skin.map((tone) => tone.oklch[0]));
  const richerShadow = color.oklch[0] < darkest && color.oklch[0] < SKIN_SHADOW_LIGHT && color.oklch[1] > nearest.oklch[1] + SKIN_SHADOW_CHROMA;
  const hueStep = hueGap(nearest.oklch[2], color.oklch[2]);
  const chromaStep = Math.abs(nearest.oklch[1] - color.oklch[1]);
  const twin = hueStep <= SKIN_TWIN_HUE && chromaStep <= SKIN_TWIN_CHROMA;
  const fillsGap = step >= SKIN_MIN_STEP && hueStep <= (color.entry.canonSkin ? SKIN_CANON_HUE_STEP : SKIN_HUE_STEP) && chromaStep <= SKIN_CHROMA_STEP;
  return !richerShadow && step <= SKIN_MAX_STEP && (twin || fillsGap);
}

export function skinOf(colors, nearby = []) {
  const pool = [...colors, ...nearby];
  const skin = colors.length ? skinSeeds(colors) : skinSeeds(nearby);
  if (!skin.length) return { skin, clothes: colors };
  const needed = (color) => {
    if (skin.length >= SKIN_FULL_TONES && skin.some((tone) => tone.oklch[0] < color.oklch[0])) return SKIN_FULL_CONTACT;
    const lightest = skin.every((tone) => tone.oklch[0] < color.oklch[0]);
    return lightest ? SKIN_CONTACT.at(-1) : SKIN_CONTACT[Math.min(skin.length, SKIN_CONTACT.length) - 1];
  };
  const classic = skin.filter((tone) => tone.entry.canonSkin).length >= SKIN_FULL_TONES;
  const classicShadow = (color) => skin.every((tone) => tone.oklch[0] > color.oklch[0]) && hueGap(color.oklch[2], SKIN_SHADOW_HUE) <= SKIN_SHADOW_SPREAD;
  const candidate = (color) => !skin.includes(color) && fillsSkinGap(skin, color) && (!classic || classicShadow(color)) && skinContact(skin, color) >= (nearClassic(color) ? SKIN_CLASSIC_CONTACT : needed(color));
  const gap = (color) => Math.min(...skin.map((tone) => Math.abs(tone.oklch[0] - color.oklch[0])));
  while (skin.length < SKIN_MAX_TONES) {
    const next = pool.filter(candidate).sort((a, b) => gap(a) - gap(b))[0];
    if (!next) break;
    skin.push(next);
  }
  return { skin, clothes: colors.filter((color) => !skin.includes(color)) };
}

function looksLikeSkin(family, skin, skinHue) {
  const bare = (color) => plausibleSkin(color) && color.oklch[1] >= SKIN_SEED_CHROMA && color.oklch[0] >= SKIN_SEED_DARK && hueGap(color.oklch[2], SKIN_SEED_HUE) <= SKIN_LIKE_HUE;
  if (skin.length && !family.touchesSkin) return false;
  const close = (color) => Math.min(...skin.map((tone) => Math.abs(tone.oklch[0] - color.oklch[0]))) <= SKIN_MAX_STEP;
  const darkest = Math.min(...skin.map((tone) => tone.oklch[0]));
  const near = (color) => close(color) && color.oklch[0] >= darkest && plausibleSkin(color) && hueGap(color.oklch[2], skinHue) <= SKIN_LIKE_HUE && skinContact(skin, color) >= SKIN_UNSURE_CONTACT;
  const skinLike = skin.length ? near : bare;
  const pixels = family.colors.filter(skinLike).reduce((sum, color) => sum + color.count, 0);
  return pixels >= family.weight * SKIN_LIKE_SHARE;
}

function familyOf(colors, skinKeys) {
  const weight = colors.reduce((sum, color) => sum + color.count, 0) || 1;
  const share = (pick) => colors.reduce((sum, color) => sum + pick(color), 0) / weight;
  const chromatic = colors.filter((color) => color.oklch[1] >= NEUTRAL_CHROMA);
  let skinTouches = 0;
  let allTouches = 0;
  for (const color of colors)
    for (const [other, touches] of color.entry.neighbors) {
      allTouches += touches;
      if (skinKeys.has(other)) skinTouches += touches;
    }
  return {
    colors,
    weight,
    neutral: !chromatic.length,
    hue: chromatic.length ? circularMean(chromatic.map((color) => ({ hue: color.oklch[2], weight: color.count * color.oklch[1] }))) : null,
    chroma: share((color) => color.oklch[1] * color.count),
    light: share((color) => color.oklch[0] * color.count),
    hairShare: share((color) => color.entry.hairBand ?? 0),
    touchesSkin: allTouches ? skinTouches / allTouches >= SKIN_TOUCH : false,
  };
}

export function familiesOf(palette) {
  const { ramps, shared } = rampsOf(palette);
  const describe = (key) => {
    const entry = palette.get(key);
    return { key, entry, hex: hexOf(entry.rgb), count: entry.count, oklch: oklchOf(entry.rgb) };
  };
  const otherRamps = ramps.filter((ramp) => !ramp.skin).map((ramp) => [...ramp.keys].map(describe));
  const skinRamps = ramps.filter((ramp) => ramp.skin).map((ramp) => [...ramp.keys].map(describe));
  const { skin, clothes } = skinOf(skinRamps.flat(), otherRamps.flat());
  const pieces = otherRamps.map((ramp) => ramp.filter((color) => !skin.includes(color))).filter((ramp) => ramp.length);
  const leftover = new Set(clothes);
  for (const ramp of skinRamps) {
    const piece = ramp.filter((color) => leftover.has(color));
    if (piece.length) pieces.push(piece);
  }
  const skinKeys = new Set(skin.map((color) => color.key));
  const kept = { outline: [], skin, shared: [] };
  const groups = [];
  for (const piece of pieces) {
    const colors = [];
    for (const color of piece) {
      if (isOutlineColor(color.oklch)) kept.outline.push(color);
      else colors.push(color);
    }
    if (!colors.length) continue;
    const family = familyOf(colors, skinKeys);
    const near = family.neutral ? null : groups.find((group) => !group.neutral && hueGap(group.hue, family.hue) <= FAMILY_HUE);
    if (near) groups[groups.indexOf(near)] = familyOf([...near.colors, ...colors], skinKeys);
    else groups.push(family);
  }
  for (const key of shared) if (!skinKeys.has(key)) kept[isOutlineColor(oklchOf(palette.get(key).rgb)) ? 'outline' : 'shared'].push(describe(key));
  const skinHue = skin.length ? circularMean(skin.map((color) => ({ hue: color.oklch[2], weight: color.count }))) : null;
  const opaque = [...palette.values()].reduce((sum, entry) => sum + entry.count, 0);
  const families = groups.map((family) => ({ ...family, unsure: looksLikeSkin(family, skin, skinHue) }));
  return { families: families.sort((a, b) => b.weight - a.weight), kept, skinHue, opaque };
}


function awayFromSkin(hue, skinHue) {
  if (skinHue === null || hueGap(hue, skinHue) >= SKIN_GAP) return hue;
  return wrap(skinHue + Math.sign(signedGap(hue, skinHue) || 1) * SKIN_GAP);
}

const paleBoost = (family) => (family.neutral || family.chroma >= PALE_CHROMA ? 1 : Math.min(PALE_CHROMA / family.chroma, PALE_BOOST));

export function rotateFamily(family, hue, minChroma = 0) {
  const rotation = family.neutral ? 0 : signedGap(hue, family.hue);
  return family.colors
    .filter((color) => color.oklch[1] >= NEUTRAL_CHROMA && hueGap(color.oklch[2], family.hue) <= ACCENT_GAP)
    .map((color) => {
      const [lightness, chroma, sourceHue] = color.oklch;
      return [color.hex, hexOf(rgbOfOklch(lightness, Math.max(chroma * paleBoost(family), minChroma), wrap(sourceHue + rotation)))];
    });
}

function distinct(map) {
  const used = new Set();
  return map.map(([from, to]) => {
    let rgb = [1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16));
    const step = rgb.reduce((sum, value) => sum + value, 0) > 382 ? -1 : 1;
    while (used.has(hexOf(rgb))) rgb = rgb.map((value) => clamp(value + step, 0, 255));
    used.add(hexOf(rgb));
    return [from, hexOf(rgb)];
  });
}

export function targetHueOf(color) {
  const look = color.look ? { ...color, ...color.look } : color;
  const saturation = clamp(look.sat, 0.25, 1) * 0.75;
  const channel = (n) => {
    const k = (n + look.hue / 30) % 12;
    return Math.round((0.5 - saturation * 0.5 * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return oklchOf([channel(0), channel(8), channel(4)])[2];
}


function unsureNotes(families) {
  const unsure = families.filter((family) => family.unsure).length;
  return unsure ? [`${unsure} ${unsure === 1 ? 'familia parecida' : 'familias parecidas'} a la piel: sin cambio`] : [];
}




export function pokemonColorsOf(image, count = POKEMON_COLORS) {
  const buckets = new Map();
  for (let i = 0; i < image.width * image.height; i++) {
    if (!image.rgba[i * 4 + 3]) continue;
    const [lightness, chroma, hue] = oklchOf([image.rgba[i * 4], image.rgba[i * 4 + 1], image.rgba[i * 4 + 2]]);
    if (lightness < POKEMON_MIN_LIGHT) continue;
    const neutral = chroma < NEUTRAL_CHROMA * 1.4;
    const key = neutral ? (lightness >= POKEMON_WHITE ? 'white' : lightness >= POKEMON_GRAY ? 'gray' : 'dark') : Math.floor(hue / POKEMON_HUE_BUCKET);
    const bucket = buckets.get(key) ?? { neutral, pixels: [] };
    bucket.pixels.push({ lightness, chroma, hue });
    buckets.set(key, bucket);
  }
  const clusters = [...buckets.values()].map(({ neutral, pixels }) => ({
    neutral,
    weight: pixels.length,
    light: pixels.reduce((sum, p) => sum + p.lightness, 0) / pixels.length,
    chroma: pixels.reduce((sum, p) => sum + p.chroma, 0) / pixels.length,
    hue: circularMean(pixels.map((p) => ({ hue: p.hue, weight: Math.max(p.chroma, 0.001) }))),
  }));
  const merged = [];
  for (const cluster of clusters.sort((a, b) => b.weight - a.weight)) {
    const near = cluster.neutral ? null : merged.find((other) => !other.neutral && hueGap(other.hue, cluster.hue) < POKEMON_MERGE);
    if (!near) {
      merged.push({ ...cluster });
      continue;
    }
    const total = near.weight + cluster.weight;
    near.hue = circularMean([{ hue: near.hue, weight: near.weight * near.chroma }, { hue: cluster.hue, weight: cluster.weight * cluster.chroma }]);
    near.light = (near.light * near.weight + cluster.light * cluster.weight) / total;
    near.chroma = (near.chroma * near.weight + cluster.chroma * cluster.weight) / total;
    near.weight = total;
  }
  const ranked = merged.sort((a, b) => b.weight - a.weight);
  const total = ranked.reduce((sum, cluster) => sum + cluster.weight, 0);
  const vivid = ranked.filter((cluster) => !cluster.neutral && cluster.weight >= total * POKEMON_ACCENT_SHARE).sort((a, b) => b.weight * b.chroma - a.weight * a.chroma);
  return [...vivid, ...ranked.filter((cluster) => !vivid.includes(cluster))].slice(0, count);
}

function skinShadows(family, recolor, skin) {
  const keys = new Set(family.colors.map((color) => color.key));
  const lights = skin.map((tone) => tone.oklch[0]).sort((a, b) => a - b);
  const median = lights[Math.floor((lights.length - 1) / 2)];
  return skin
    .filter((tone) => tone.oklch[0] <= median)
    .filter((tone) => {
      const all = [...tone.entry.neighbors.values()].reduce((sum, touches) => sum + touches, 0);
      const shared = [...tone.entry.neighbors].filter(([other]) => keys.has(other)).reduce((sum, [, touches]) => sum + touches, 0);
      return all && shared >= all * SKIN_SHADOW_TOUCH;
    })
    .map((tone) => [tone.hex, recolor(tone.oklch), SHADE]);
}

export function tintFamily(family, hue, minChroma = 0) {
  return family.colors
    .filter((color) => color.oklch[0] >= TINT_MIN_LIGHT)
    .map((color) => {
      const [ceiling, chroma] = color.oklch[0] >= WHITE_FROM ? [WHITE_CEIL, WHITE_CHROMA] : [TINT_CEIL, TINT_CHROMA];
      return [color.hex, hexOf(rgbOfOklch(Math.min(color.oklch[0], ceiling), Math.max(color.oklch[1], chroma, minChroma), hue))];
    });
}

function paintPlans(plans, analysis, notes) {
  const { skinHue, kept } = analysis;
  const placed = plans.map((plan) => {
    if (tintable(plan.family) || plan.gray !== undefined) return plan;
    const hue = plan.family.touchesSkin ? awayFromSkin(plan.hue, skinHue) : plan.hue;
    if (hue !== plan.hue) notes.push('se alejó de la piel');
    return { ...plan, hue };
  });
  const whole = [];
  const near = [];
  for (const { family, hue, gray, vivid = 0 } of placed) {
    if (gray !== undefined) {
      notes.push('color pasado a gris como el Pokémon');
      const toGray = ([lightness, chroma]) => hexOf(rgbOfOklch(lightness, Math.min(chroma, gray), hue));
      whole.push(...family.colors.map((color) => [color.hex, toGray(color.oklch)]));
      near.push(...skinShadows(family, toGray, kept.skin));
      continue;
    }
    if (tintable(family)) {
      notes.push(family.light >= WHITE_FROM ? 'blancos teñidos' : 'grises teñidos');
      whole.push(...tintFamily(family, hue, vivid * POKEMON_TINT_SATURATION));
      continue;
    }
    if (hue >= YELLOW_HUES[0] && hue <= YELLOW_HUES[1] && family.light < DARK_YELLOW_LIGHT) notes.push('amarillo sobre oscuro: se ve oliva');
    whole.push(...rotateFamily(family, hue, vivid * POKEMON_SATURATION));
    const rotation = signedGap(hue, family.hue);
    near.push(...skinShadows(family, ([lightness, chroma, toneHue]) => hexOf(rgbOfOklch(lightness, chroma * paleBoost(family), wrap(toneHue + rotation))), kept.skin));
  }
  const painted = new Set(whole.map(([from]) => from));
  const local = near.filter(([from], i) => !painted.has(from) && near.findIndex(([other]) => other === from) === i);
  if (!local.length) return distinct(whole);
  notes.push('sombras compartidas piel/ropa: decididas por pixel');
  return [...distinct(whole), ...local, ...kept.skin.map((tone) => [tone.hex, tone.hex, SKIN])];
}


export function pokemonVariant(analysis, pokemonColors) {
  const { families, skinHue, opaque } = analysis;
  const notes = unsureNotes(families);
  if (!pokemonColors.length) return { map: [], notes: [...notes, 'el Pokémon no tiene color: sin cambio'] };
  const candidates = candidatesOf(families, opaque);
  const plans = [];
  for (const color of pokemonColors.slice(0, POKEMON_REGIONS)) {
    const fits = (candidate) => {
      if (plans.some((plan) => plan.family === candidate)) return false;
      if (color.neutral) return !tintable(candidate);
      if (tintable(candidate)) return true;
      const clashesWithSkin = candidate.touchesSkin && skinHue !== null && hueGap(color.hue, skinHue) < SKIN_GAP;
      return hueGap(candidate.hue, color.hue) >= POKEMON_MIN_SHIFT && !clashesWithSkin;
    };
    const family = candidates.find(fits);
    if (family) plans.push({ family, hue: color.hue, ...(color.neutral ? { gray: color.chroma } : { vivid: color.chroma }) });
  }
  if (!plans.length) return { map: [], notes: [...notes, 'ya tiene los colores del Pokémon o no hay color seguro'] };
  return { map: paintPlans(plans, analysis, notes), notes: [...new Set(notes)] };
}

const tintable = (family) => family.neutral || family.chroma < MUTED_CHROMA;

function visibility(family) {
  const color = tintable(family) ? (family.light >= WHITE_FROM ? WHITE_VISIBILITY : GRAY_VISIBILITY) : family.chroma;
  return family.weight * color * (family.hairShare >= HAIR_LINE ? HAIR_VISIBILITY : 1);
}

function candidatesOf(families, opaque) {
  const usable = (family) =>
    !family.unsure && (tintable(family) ? family.light >= TINT_MIN_LIGHT && family.weight >= opaque * TINT_SHARE : family.weight >= opaque * REGION_SHARE);
  return families.filter(usable).sort((a, b) => visibility(b) - visibility(a));
}

export function rotateVariant(analysis, color, accent = null) {
  const { families, opaque } = analysis;
  const notes = unsureNotes(families);
  const targetHue = targetHueOf(color);
  const candidates = candidatesOf(families, opaque);
  if (!candidates.length) return { map: [], notes: [...notes, 'sin color seguro que cambiar'] };
  const first = candidates.find((family) => tintable(family) || hueGap(family.hue, targetHue) >= MIN_ROTATION) ?? candidates[0];
  if (!tintable(first) && hueGap(first.hue, targetHue) < MIN_ROTATION) notes.push(`rotación corta (${Math.round(hueGap(first.hue, targetHue))}°)`);
  const rest = candidates.filter((family) => family !== first);
  const second = rest.find((family) => family.weight >= opaque * SECOND_SHARE) ?? rest.find((family) => visibility(family) >= visibility(first) * SECOND_VISIBILITY) ?? null;
  const rotation = tintable(first) ? null : signedGap(targetHue, first.hue);
  const secondHue = !second ? null : accent ? targetHueOf(accent) : tintable(second) || rotation === null ? targetHue : wrap(second.hue + rotation);
  const plans = [{ family: first, hue: targetHue }, ...(second ? [{ family: second, hue: secondHue }] : [])];
  return { map: paintPlans(plans, analysis, notes), notes: [...new Set(notes)] };
}

const inHueRange = (hue, [from, to]) => (from <= to ? hue >= from && hue <= to : hue >= from || hue <= to);

export function swapVariant(analysis, swaps) {
  const { families, opaque } = analysis;
  const notes = unsureNotes(families);
  const plans = [];
  for (const family of families) {
    if (family.unsure || tintable(family) || family.weight < opaque * SWAP_SHARE) continue;
    const heaviest = family.colors.reduce((best, color) => (color.count > best.count ? color : best));
    const [hue, saturation] = hslOf(heaviest.entry.rgb);
    const swap = swaps.find((candidate) => saturation >= (candidate.minSat ?? SWAP_MIN_SATURATION) && inHueRange(hue, candidate.from));
    if (swap) plans.push({ family, hue: targetHueOf({ hue: swap.hue, sat: 1, light: 1 }) });
  }
  if (!plans.length) return { map: [], notes: [...notes, 'ninguna familia en los tonos pedidos'] };
  return { map: paintPlans(plans, analysis, notes), notes: [...new Set(notes)] };
}

export function visibleChange(analysis, map) {
  const colors = new Map([...analysis.families.flatMap((family) => family.colors), ...analysis.kept.shared].map((color) => [color.hex, color]));
  const toLab = ([lightness, chroma, hue]) => [lightness, chroma * Math.cos((hue * Math.PI) / 180), chroma * Math.sin((hue * Math.PI) / 180)];
  const changed = new Map(map.filter((entry) => entry.length === 2));
  let distance = 0;
  let pixels = 0;
  for (const [hex, color] of colors) {
    pixels += color.count;
    if (!changed.has(hex)) continue;
    const to = changed.get(hex);
    const [a, b] = [toLab(color.oklch), toLab(oklchOf([1, 3, 5].map((i) => parseInt(to.slice(i, i + 2), 16))))];
    distance += color.count * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  }
  return pixels ? distance / pixels : 0;
}

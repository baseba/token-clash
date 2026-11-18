#!/usr/bin/env node
// PokeRogue's battle animations, converted for our field at install and build time: one JSON per
// animation in public/anims/, their sound cues in public/sfx/moves/moves.json, the music loop points
// and the recolored Poké Balls of public/anims/ui/. The sheets, sounds and music they name are not
// downloaded: public/upstream/pokerogue.json says where each one lives in pokerogue-assets and the
// browser loads it from jsDelivr. `--manifest` (npm run anims) rewrites that manifest; run it when
// the pinned commit, the moves or the music change.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import { MUSIC_TRACKS, SOUNDS } from '../public/music.js';
import { BALL_GROUPS, BALL_VARIANTS, CUSTOM_BALLS } from '../public/shop.js';
import { UPSTREAM } from '../public/upstream.js';
import { fetchUpstream, firstExisting, manifestJSON, mapLimit } from './upstream-files.js';

const MOVEDEX = new URL('../src/catalog/data/movedex.json', import.meta.url);
const MANIFEST = new URL('../public/upstream/pokerogue.json', import.meta.url);
const ANIMS = new URL('../public/anims/', import.meta.url);
const UI = new URL('ui/', ANIMS);
const MUSIC = new URL('../public/music/', import.meta.url);
const CUES = new URL('../public/sfx/moves/moves.json', import.meta.url);
const MS_PER_ANIM_FRAME = 50;

const COMMON_ANIMS = [
  'common-poison', 'common-toxic', 'common-paralysis', 'common-sleep', 'common-frozen', 'common-burn',
  'common-confusion', 'common-attract', 'common-bind', 'common-curse', 'common-leech-seed', 'common-protect', 'common-salt-cure',
  'common-sunny', 'common-harsh-sun', 'common-rain', 'common-heavy-rain', 'common-sandstorm', 'common-hail', 'common-snow', 'common-strong-winds',
  'common-electric-terrain', 'common-grassy-terrain', 'common-misty-terrain', 'common-psychic-terrain',
];

const CHARGE_ANIMS = [
  'beak-blast', 'bounce', 'dig', 'dive', 'doom-desire', 'electro-shot', 'fly', 'freeze-shock', 'future-sight', 'geomancy',
  'ice-burn', 'meteor-beam', 'phantom-force', 'razor-wind', 'shadow-force', 'skull-bash', 'sky-attack', 'sky-drop',
  'solar-beam', 'solar-blade',
].map((move) => `${move}-charging`);

const BALLS = ['pb', 'gb', 'ub', 'lb', 'rb', 'mb'];
const UI_IMAGES = [...BALLS.flatMap((ball) => [`pokeball/${ball}.png`, `pokeball/${ball}_open.png`]), 'effects/pb_particles.png', 'effects/battle_stats.png'];

const pokerogue = (path) => fetchUpstream(UPSTREAM.pokerogue, path);

/**
 * Our key for a sheet or a sound: its PokeRogue name made URL-safe ("PRAS- Fire" is "pras-fire").
 * A name with no letters or digits keeps itself (Copycat's sheet is "!").
 */
export const assetName = (resourceName) => resourceName.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+(?=\.)|-+$/g, '') || resourceName;

const BALL_PALETTE_SLOTS = {
  closed: { top: [2, 4, 5, 6], bottom: [7, 3] },
  open: { top: [5, 5, 6, 6], bottom: [7, 4] },
};

const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

export function recolorPalette(png, colors) {
  const out = Buffer.from(png);
  for (let at = 8; at < out.length; ) {
    const length = out.readUInt32BE(at);
    if (out.toString('latin1', at + 4, at + 8) === 'PLTE') {
      for (const [index, hex] of colors) rgb(hex).forEach((value, c) => (out[at + 8 + index * 3 + c] = value));
      out.writeUInt32BE(crc32(out.subarray(at + 4, at + 8 + length)), at + 8 + length);
    }
    at += 12 + length;
  }
  return out;
}

export function customBallColors(ball, frame) {
  const slots = BALL_PALETTE_SLOTS[frame];
  const pairs = slots.top.map((index, i) => [index, ball.top[i]]);
  if (ball.bottom) slots.bottom.forEach((index, i) => pairs.push([index, ball.bottom[i]]));
  return pairs;
}

export function paletteOf(png) {
  for (let at = 8; at < png.length; ) {
    const length = png.readUInt32BE(at);
    if (png.toString('latin1', at + 4, at + 8) === 'PLTE') return Array.from({ length: length / 3 }, (_, i) => [png[at + 8 + i * 3], png[at + 9 + i * 3], png[at + 10 + i * 3]]);
    at += 12 + length;
  }
  return [];
}

function toHsl([r, g, b]) {
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

function toHex([h, s, l]) {
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return `#${[0, 8, 4].map((n) => Math.round(f(n) * 255).toString(16).padStart(2, '0')).join('')}`;
}

export function tintColor(color, { hue, sat = 1, light = 1 }) {
  const [h, s, l] = toHsl(color);
  return toHex([hue ?? h, Math.min(1, s * sat), Math.min(1, l * light)]);
}

export function variantColors(variant, frame, palette) {
  return Object.entries(variant.tint).flatMap(([group, tint]) => (BALL_GROUPS[variant.base][group]?.[frame] ?? []).map((index, i) => [index, tint.colors ? tint.colors[frame][i] : tintColor(palette[index], tint)]));
}

export function generateBalls() {
  const failed = [];
  const recolor = (key, base, colorsFor) => {
    try {
      for (const [frame, suffix] of [['closed', ''], ['open', '_open']]) {
        const png = readFileSync(new URL(`${base}${suffix}.png`, UI));
        writeFileSync(new URL(`${key}${suffix}.png`, UI), recolorPalette(png, colorsFor(frame, png)));
      }
    } catch (err) {
      failed.push(`${key}.png (${err.message})`);
    }
  };
  for (const ball of CUSTOM_BALLS) recolor(ball.key, 'pb', (frame) => customBallColors(ball, frame));
  for (const variant of BALL_VARIANTS) recolor(variant.key, variant.base, (frame, png) => variantColors(variant, frame, paletteOf(png)));
  return failed;
}

export function compactFrame(e) {
  const tone = e.tone?.some(Boolean) ? e.tone : 0;
  return [e.target ?? 2, e.x ?? 0, e.y ?? 0, e.zoomX ?? 0, e.zoomY ?? 0, e.angle ?? 0, e.mirror ? 1 : 0, e.visible ? 1 : 0, e.blendType ?? 0, e.graphicFrame ?? 0, e.opacity ?? 0, e.priority ?? 0, e.focus || 1, tone];
}

function compactConfig(config) {
  const events = Object.values(config.frameTimedEvents ?? {}).flat().sort((a, b) => a.frameIndex - b.frameIndex);
  const bg = events
    .filter((e) => e.eventType === 'AnimTimedAddBgEvent' || e.eventType === 'AnimTimedUpdateBgEvent')
    .map((e) => [e.frameIndex, e.eventType === 'AnimTimedAddBgEvent' ? 'add' : 'update', e.eventType === 'AnimTimedAddBgEvent' && e.resourceName ? assetName(e.resourceName) : null, e.bgX ?? null, e.bgY ?? null, e.opacity ?? null, e.duration ?? 0]);
  const sounds = events
    .filter((e) => e.eventType === 'AnimTimedSoundEvent' && e.resourceName)
    .map((e) => [e.frameIndex * MS_PER_ANIM_FRAME, assetName(e.resourceName), (e.volume ?? 100) / 100, (e.pitch ?? 100) / 100]);
  return {
    graphic: config.graphic ? assetName(config.graphic) : null,
    frames: (config.frames ?? []).map((frame) => frame.map(compactFrame)),
    bg,
    sounds,
  };
}

export function compactAnim(anim) {
  const [player, opponent] = (Array.isArray(anim) ? anim : [anim]).map(compactConfig);
  return opponent && JSON.stringify(opponent) !== JSON.stringify(player) ? [player, opponent] : [player];
}

export function resourcesOf(anim) {
  const configs = Array.isArray(anim) ? anim : [anim];
  const events = configs.flatMap((c) => Object.values(c.frameTimedEvents ?? {}).flat());
  return {
    graphics: [...new Set([...configs.map((c) => c.graphic), ...events.filter((e) => e.eventType === 'AnimTimedAddBgEvent').map((e) => e.resourceName)].filter(Boolean))],
    sounds: [...new Set(events.filter((e) => e.eventType === 'AnimTimedSoundEvent' && e.resourceName).map((e) => e.resourceName))],
  };
}

/** The keys a converted animation names that the manifest can't place. */
export function missingAssets(anim, manifest) {
  const named = anim.flatMap((side) => [
    ...[side.graphic, ...side.bg.map((event) => event[2])].filter(Boolean).map((key) => ['graphics', key]),
    ...side.sounds.map(([, key]) => ['moveSounds', key]),
  ]);
  return [...new Set(named.filter(([section, key]) => typeof manifest[section]?.[key] !== 'string').map(([, key]) => key))];
}

async function downloadTo(path, file) {
  const res = await pokerogue(path);
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// Where each key lives in pokerogue-assets, checked with a HEAD request. A sound effect of ours is
// in PokeRogue's effects folder or its menu folder; music tracks keep their subfolders (bw/…).
async function resolveManifest(anims, failed) {
  const files = { graphics: new Map(), moveSounds: new Map() };
  const place = (section, key, path) => {
    const known = files[section].get(key);
    if (known && known !== path) failed.push(`${path} y ${known} se llamarían ${key}`);
    files[section].set(key, path);
  };
  for (const key of [...anims.keys()].sort()) {
    const { graphics, sounds } = resourcesOf(anims.get(key));
    for (const graphic of graphics) place('graphics', assetName(graphic), `images/battle_anims/${graphic}.png`);
    for (const sound of sounds) place('moveSounds', assetName(sound), `audio/battle_anims/${sound}`);
  }
  const sorted = (map) => [...map].sort(([a], [b]) => (a < b ? -1 : 1));
  const candidates = [
    ...sorted(files.graphics).map(([key, path]) => ['graphics', key, [path]]),
    ...sorted(files.moveSounds).map(([key, path]) => ['moveSounds', key, [path]]),
    ...SOUNDS.map((sound) => ['sounds', sound, [`audio/se/${sound}.wav`, `audio/ui/${sound}.wav`]]),
    ...MUSIC_TRACKS.map((track) => ['music', track, [`audio/bgm/${track}.mp3`]]),
  ];
  const manifest = { graphics: {}, moveSounds: {}, sounds: {}, music: {} };
  for (const [section, key] of candidates) manifest[section][key] = null;
  await mapLimit(candidates, async ([section, key, paths]) => {
    try {
      manifest[section][key] = await firstExisting(UPSTREAM.pokerogue, paths);
      if (!manifest[section][key]) failed.push(`${paths.join(' ni ')} (no existe)`);
    } catch (err) {
      failed.push(`${paths[0]} (${err.message})`);
    }
  });
  return manifest;
}

const failure = (what, failed) => new Error(`No se pudieron procesar ${failed.length} ${what}: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`);

/**
 * @throws {Promise<Error>} si algún recurso no se pudo descargar o el manifiesto no lo ubica
 */
export async function syncBattleAnims({ writeManifest = false, log = (msg) => process.stderr.write(`${msg}\n`) } = {}) {
  for (const dir of [UI, MUSIC, new URL('./', CUES)]) mkdirSync(dir, { recursive: true });
  const keys = [...Object.keys(JSON.parse(readFileSync(MOVEDEX, 'utf8'))), ...COMMON_ANIMS, ...CHARGE_ANIMS];
  log(`Animaciones de PokeRogue: descargando ${keys.length} de pokerogue-assets@${UPSTREAM.pokerogue.commit.slice(0, 7)}.`);

  const failed = [];
  const anims = new Map();
  await mapLimit(keys, async (key) => {
    try {
      const res = await pokerogue(`battle-anims/${key}.json`);
      if (res.ok) anims.set(key, await res.json());
    } catch (err) {
      failed.push(`${key} (${err.message})`);
    }
  });

  if (writeManifest) {
    if (failed.length) throw failure('animaciones', failed);
    const manifest = await resolveManifest(anims, failed);
    if (failed.length) throw failure('archivos', failed);
    writeFileSync(MANIFEST, manifestJSON(manifest));
    log(`Manifiesto escrito en public/upstream/pokerogue.json: ${Object.entries(manifest).map(([section, files]) => `${Object.keys(files).length} ${section}`).join(', ')}.`);
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const cues = {};
  for (const key of keys.filter((key) => anims.has(key))) {
    const anim = compactAnim(anims.get(key));
    const missing = missingAssets(anim, manifest);
    if (missing.length) failed.push(`${key} (${missing.join(', ')} no está en public/upstream/pokerogue.json: corre npm run anims)`);
    writeFileSync(new URL(`${key}.json`, ANIMS), `${JSON.stringify(anim)}\n`);
    if (anim.some((side) => side.sounds.length)) cues[key] = anim.map((side) => side.sounds);
  }
  writeFileSync(CUES, `${JSON.stringify(cues)}\n`);

  await mapLimit(UI_IMAGES, async (path) => {
    try {
      await downloadTo(`images/${path}`, new URL(path.split('/').pop(), UI));
    } catch (err) {
      failed.push(`${path} (${err.message})`);
    }
  });
  failed.push(...generateBalls());
  try {
    const res = await pokerogue('biome-bgm-loop-points.json');
    if (!res.ok) throw new Error(String(res.status));
    const loops = await res.json();
    writeFileSync(new URL('loops.json', MUSIC), `${JSON.stringify(Object.fromEntries(MUSIC_TRACKS.map((track) => [track, loops[track] ?? 0])))}\n`);
  } catch (err) {
    failed.push(`biome-bgm-loop-points.json (${err.message})`);
  }

  log(`Animaciones listas en public/anims/ y sus sonidos en public/sfx/moves/moves.json.`);
  log(`  ${anims.size}/${keys.length} animaciones (movimientos, estados, clima y cargas)`);
  log(`  ${Object.keys(cues).length} con sonido`);
  if (failed.length) throw failure('recursos', failed);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv.includes('--balls')) {
  const failed = generateBalls();
  console.log(failed.length ? `No pude generar: ${failed.join(', ')}` : `Poké Balls generadas: ${CUSTOM_BALLS.length + BALL_VARIANTS.length}.`);
  if (failed.length) process.exitCode = 1;
} else if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncBattleAnims({ writeManifest: process.argv.includes('--manifest') }).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

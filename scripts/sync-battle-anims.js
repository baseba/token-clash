#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MUSIC_TRACKS, musicFile } from '../public/music.js';

const RAW = 'https://raw.githubusercontent.com/pagefaultgames/pokerogue-assets/beta';
const MOVEDEX = new URL('../server/movedex.json', import.meta.url);
const ANIMS = new URL('../public/anims/', import.meta.url);
const GRAPHICS = new URL('graphics/', ANIMS);
const UI = new URL('ui/', ANIMS);
const MUSIC = new URL('../public/music/', import.meta.url);
const SFX = new URL('../public/sfx/', import.meta.url);
const MOVE_AUDIO = new URL('moves/audio/', SFX);
const SE = new URL('se/', SFX);
const CUES = new URL('moves/moves.json', SFX);
const CONCURRENCY = 16;
const HEADERS = { 'user-agent': 'token-clash-importer' };
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

const UI_IMAGES = ['pokeball/pb.png', 'pokeball/pb_open.png', 'effects/pb_particles.png', 'effects/battle_stats.png'];
const SE_SOUNDS = ['pb_throw', 'pb_rel', 'hit', 'hit_strong', 'hit_weak', 'faint', 'stat_up', 'stat_down', 'restore', 'pb_tray_ball', 'pb_lock', 'flee', 'pb_tray_enter', 'pb_tray_empty', 'save'];
const UI_SOUNDS = ['select', 'menu_open'];

async function fetchRetry(url, tries = 4) {
  for (let i = 1; ; i++) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (res.ok || res.status === 404) return res;
      throw new Error(`${res.status} ${url}`);
    } catch (err) {
      if (i >= tries) throw err;
      await new Promise((r) => setTimeout(r, 500 * 2 ** i));
    }
  }
}

async function mapLimit(items, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

export const assetName = (resourceName) => resourceName.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+(?=\.)|-+$/g, '');

export function pngSize(data) {
  if (data.length < 24 || data.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
}

const sheetUrl = (graphic) => `/anims/graphics/${assetName(graphic)}.png`;
const bgUrl = (name) => (name ? `/anims/graphics/${assetName(name)}.png` : null);
const soundUrl = (name) => `/sfx/moves/audio/${assetName(name)}`;

export function compactFrame(e) {
  const tone = e.tone?.some(Boolean) ? e.tone : 0;
  return [e.target ?? 2, e.x ?? 0, e.y ?? 0, e.zoomX ?? 0, e.zoomY ?? 0, e.angle ?? 0, e.mirror ? 1 : 0, e.visible ? 1 : 0, e.blendType ?? 0, e.graphicFrame ?? 0, e.opacity ?? 0, e.priority ?? 0, e.focus || 1, tone];
}

function compactConfig(config, columns = () => 5) {
  const events = Object.values(config.frameTimedEvents ?? {}).flat().sort((a, b) => a.frameIndex - b.frameIndex);
  const bg = events
    .filter((e) => e.eventType === 'AnimTimedAddBgEvent' || e.eventType === 'AnimTimedUpdateBgEvent')
    .map((e) => [e.frameIndex, e.eventType === 'AnimTimedAddBgEvent' ? 'add' : 'update', e.eventType === 'AnimTimedAddBgEvent' ? bgUrl(e.resourceName) : null, e.bgX ?? null, e.bgY ?? null, e.opacity ?? null, e.duration ?? 0]);
  const sounds = events
    .filter((e) => e.eventType === 'AnimTimedSoundEvent' && e.resourceName)
    .map((e) => [e.frameIndex * MS_PER_ANIM_FRAME, soundUrl(e.resourceName), (e.volume ?? 100) / 100, (e.pitch ?? 100) / 100]);
  return {
    graphic: config.graphic ? { url: sheetUrl(config.graphic), columns: columns(config.graphic) } : null,
    frames: (config.frames ?? []).map((frame) => frame.map(compactFrame)),
    bg,
    sounds,
  };
}

export function compactAnim(anim, columns) {
  const [player, opponent] = (Array.isArray(anim) ? anim : [anim]).map((config) => compactConfig(config, columns));
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

async function download(url, file) {
  if (existsSync(file)) return readFileSync(file);
  const res = await fetchRetry(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const data = Buffer.from(await res.arrayBuffer());
  writeFileSync(file, data);
  return data;
}

const readJson = (file) => {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
};

/**
 * @throws {Promise<Error>} si algún recurso referenciado no se pudo descargar
 */
export async function syncBattleAnims({ refresh = false, log = (msg) => process.stderr.write(`${msg}\n`) } = {}) {
  for (const dir of [GRAPHICS, UI, MOVE_AUDIO, SE, MUSIC]) mkdirSync(dir, { recursive: true });
  const keys = [...Object.keys(JSON.parse(readFileSync(MOVEDEX, 'utf8'))), ...COMMON_ANIMS, ...CHARGE_ANIMS];
  const pending = keys.filter((key) => refresh || !existsSync(new URL(`${key}.json`, ANIMS)));
  log(`Animaciones de PokeRogue: ${keys.length - pending.length}/${keys.length} listas; descargando ${pending.length}.`);

  const failed = [];
  const sheetSizes = new Map();
  const columnsOf = (graphic) => Math.max(1, Math.floor((sheetSizes.get(graphic)?.width ?? 480) / 96));

  await mapLimit(pending, async (key) => {
    try {
      const res = await fetchRetry(`${RAW}/battle-anims/${key}.json`);
      if (!res.ok) return;
      const anim = await res.json();
      const { graphics, sounds } = resourcesOf(anim);
      for (const graphic of graphics) {
        const data = await download(`${RAW}/images/battle_anims/${encodeURIComponent(graphic)}.png`, new URL(`${assetName(graphic)}.png`, GRAPHICS));
        sheetSizes.set(graphic, pngSize(data));
      }
      for (const sound of sounds) await download(`${RAW}/audio/battle_anims/${encodeURIComponent(sound)}`, new URL(assetName(sound), MOVE_AUDIO));
      writeFileSync(new URL(`${key}.json`, ANIMS), `${JSON.stringify(compactAnim(anim, columnsOf))}\n`);
    } catch (err) {
      failed.push(`${key} (${err.message})`);
    }
  });

  await mapLimit(UI_IMAGES, async (path) => {
    try {
      await download(`${RAW}/images/${path}`, new URL(path.split('/').pop(), UI));
    } catch (err) {
      failed.push(`${path} (${err.message})`);
    }
  });
  await mapLimit(MUSIC_TRACKS, async (track) => {
    try {
      await download(`${RAW}/audio/bgm/${track}.mp3`, new URL(musicFile(track).slice('/music/'.length), MUSIC));
    } catch (err) {
      failed.push(`${track}.mp3 (${err.message})`);
    }
  });
  try {
    const res = await fetchRetry(`${RAW}/biome-bgm-loop-points.json`);
    if (!res.ok) throw new Error(String(res.status));
    const loops = await res.json();
    writeFileSync(new URL('loops.json', MUSIC), `${JSON.stringify(Object.fromEntries(MUSIC_TRACKS.map((track) => [track, loops[track] ?? 0])))}\n`);
  } catch (err) {
    failed.push(`biome-bgm-loop-points.json (${err.message})`);
  }
  await mapLimit(SE_SOUNDS, async (name) => {
    try {
      await download(`${RAW}/audio/se/${name}.wav`, new URL(`${name}.wav`, SE));
    } catch (err) {
      failed.push(`${name}.wav (${err.message})`);
    }
  });
  await mapLimit(UI_SOUNDS, async (name) => {
    try {
      await download(`${RAW}/audio/ui/${name}.wav`, new URL(`${name}.wav`, SE));
    } catch (err) {
      failed.push(`${name}.wav (${err.message})`);
    }
  });

  const cues = {};
  for (const key of keys) {
    const anim = readJson(new URL(`${key}.json`, ANIMS));
    if (anim?.some((side) => side.sounds.length)) cues[key] = anim.map((side) => side.sounds);
  }
  writeFileSync(CUES, `${JSON.stringify(cues)}\n`);

  const ready = keys.filter((key) => existsSync(new URL(`${key}.json`, ANIMS)));
  log(`Animaciones listas en public/anims/, sonidos en public/sfx/ y música en public/music/.`);
  log(`  ${ready.length}/${keys.length} animaciones (movimientos, estados, clima y cargas)`);
  log(`  ${Object.keys(cues).length} con sonido`);
  if (failed.length) {
    throw new Error(`No se pudieron procesar ${failed.length} recursos: ${failed.slice(0, 10).join(', ')}${failed.length > 10 ? '…' : ''}`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncBattleAnims({ refresh: process.argv.includes('--refresh') }).catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

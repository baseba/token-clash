import { Buffer } from 'node:buffer';
import { UPSTREAM } from '../public/upstream.js';
import { fetchRetry, fetchUpstream, firstExisting, mapLimit, resolveVariants } from './upstream-files.js';

export const ESSENTIALS_POKEMON_DIR = 'Graphics/Pokemon/';
const SPECIES_FILES = ['PBS/pokemon.txt', 'PBS/pokemon_base_Gen_9_Pack.txt'];
const METRICS_FILES = ['PBS/pokemon_metrics.txt', 'PBS/pokemon_metrics_Gen_9_Pack.txt', 'PBS/pokemon_metrics_forms.txt'];
const VARIANT_DIRS = { front: 'Front', frontShiny: 'Front shiny', back: 'Back', backShiny: 'Back shiny' };
const DEFAULT_SPEED = 2;
const FRAME_DELAY_MS = 90;
const MIN_FRAME_DELAY_MS = 90;

export const FORM_FILES = {
  'darmanitan-zen': 'DARMANITAN_1',
  'aegislash-blade': 'AEGISLASH_1',
  'wishiwashi-school': 'WISHIWASHI_1',
  'zygarde-complete': 'ZYGARDE_2',
  'mimikyu-busted': 'MIMIKYU_1',
  'eiscue-noice': 'EISCUE_1',
  'palafin-hero': 'PALAFIN_1',
  'terapagos-terastal': 'TERAPAGOS_1',
  'cramorant-gulping': 'CRAMORANT_1',
  'cramorant-gorging': 'CRAMORANT_2',
  'morpeko-hangry': 'MORPEKO_1',
  'cherrim-sunshine': 'CHERRIM_1',
  'castform-sunny': 'CASTFORM_1',
  'castform-rainy': 'CASTFORM_2',
  'castform-snowy': 'CASTFORM_3',
  'minior-red': 'MINIOR_7',
  'minior-orange': 'MINIOR_8',
  'minior-yellow': 'MINIOR_9',
  'minior-green': 'MINIOR_10',
  'minior-blue': 'MINIOR_11',
  'minior-indigo': 'MINIOR_12',
  'minior-violet': 'MINIOR_13',
};

const SECTION = /^\[([^\]]+)\]\s*$/gm;

export function speciesIdsByDex(speciesTexts) {
  return speciesTexts.flatMap((text) => [...text.matchAll(SECTION)].map((match) => match[1]));
}

export function animationSpeeds(metricsTexts) {
  const speeds = new Map();
  for (const text of metricsTexts) {
    const headers = [...text.matchAll(SECTION)];
    headers.forEach((header, i) => {
      const body = text.slice(header.index, headers[i + 1]?.index ?? text.length);
      const speed = /^AnimationSpeed\s*=\s*(\d+)(?:\s*,\s*(\d+))?/m.exec(body);
      if (!speed) return;
      const back = Number(speed[1]);
      speeds.set(header[1].replace(',', '_'), { back, front: speed[2] === undefined ? back : Number(speed[2]) });
    });
  }
  return speeds;
}

export const frameDelay = (speed) => (speed > 0 ? Math.max(MIN_FRAME_DELAY_MS, Math.round((speed / 2) * FRAME_DELAY_MS)) : 0);

export function essentialsFileId(slug, speciesIds) {
  return /^\d+$/.test(slug) ? speciesIds[Number(slug) - 1] ?? null : FORM_FILES[slug] ?? null;
}

export function delaysOf(fileId, speeds) {
  const speed = speeds.get(fileId) ?? speeds.get(fileId.replace(/_\d+$/, '')) ?? { front: DEFAULT_SPEED, back: DEFAULT_SPEED };
  return [frameDelay(speed.front), frameDelay(speed.back)];
}

const candidatesOf = (fileId) => Object.fromEntries(Object.entries(VARIANT_DIRS).map(([variant, dir]) => [variant, [`${ESSENTIALS_POKEMON_DIR}${dir}/${fileId}.png`, `${ESSENTIALS_POKEMON_DIR}${dir}/${fileId}.PNG`]]));

export const isStillStrip = ({ width, height }) => width <= height;

async function stripSize(file) {
  const response = await fetchUpstream(UPSTREAM.essentials, ESSENTIALS_POKEMON_DIR + file, { headers: { range: 'bytes=0-23' } });
  if (!response.ok) throw new Error(`${response.status} ${file}`);
  const header = Buffer.from(await response.arrayBuffer());
  return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}

export const SHOWDOWN_SPRITES = 'https://play.pokemonshowdown.com/sprites/';
const SHOWDOWN_DIRS = ['gen5ani', 'gen5ani-shiny', 'gen5ani-back', 'gen5ani-back-shiny'];

export const showdownCandidates = (fileId) => SHOWDOWN_DIRS.map((dir) => `${SHOWDOWN_SPRITES}${dir}/${fileId.toLowerCase()}.gif`);

export async function withShowdownStills(manifest, log) {
  await mapLimit(Object.keys(manifest), async (slug) => {
    const entry = manifest[slug];
    const fileId = /\/([A-Za-z0-9]+)\.(png|PNG)$/.exec(entry.files[0])?.[1];
    if (!fileId || !isStillStrip(await stripSize(entry.files[0]))) return;
    const found = await Promise.all(showdownCandidates(fileId).map(async (url) => ((await fetchRetry(url, { method: 'HEAD' })).ok ? url : null)));
    if (!found[0]) return;
    entry.showdown = found;
    log(`  ${slug}: la tira de Essentials viene quieta; ${found.filter(Boolean).length} de sus 4 sprites salen del gen5ani de Showdown.`);
  });
  return manifest;
}

async function upstreamText(path) {
  const response = await fetchUpstream(UPSTREAM.essentials, path);
  if (!response.ok) throw new Error(`${response.status} ${path}`);
  return (await response.text()).replace(/^\uFEFF/, '');
}

export async function essentialsManifest(slugs) {
  const speciesIds = speciesIdsByDex(await Promise.all(SPECIES_FILES.map(upstreamText)));
  const speeds = animationSpeeds(await Promise.all(METRICS_FILES.map(upstreamText)));
  const firstOf = (paths) => firstExisting(UPSTREAM.essentials, paths);
  const resolved = new Map();
  await mapLimit(slugs, async (slug) => {
    const fileId = essentialsFileId(slug, speciesIds);
    if (!fileId) return;
    const paths = await resolveVariants(candidatesOf(fileId), firstOf);
    if (paths) resolved.set(slug, { files: paths.map((path) => path.slice(ESSENTIALS_POKEMON_DIR.length)), delays: delaysOf(fileId, speeds) });
  });
  return Object.fromEntries(slugs.filter((slug) => resolved.has(slug)).map((slug) => [slug, resolved.get(slug)]));
}

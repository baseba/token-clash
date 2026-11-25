#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RADIO_TRACKS } from '../public/radio.js';
import { UPSTREAM } from '../public/upstream.js';
import { fetchUpstream, manifestJSON, mapLimit } from './upstream-files.js';

const MANIFEST = new URL('../public/upstream/pokerogue.json', import.meta.url);
const DURATIONS = new URL('../src/catalog/data/radio-durations.json', import.meta.url);

const BITRATES = {
  mpeg1layer1: [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
  mpeg1layer2: [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
  mpeg1layer3: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
  mpeg2layer1: [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
  mpeg2layer23: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
};
const SAMPLE_RATES = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

export function frameHeader(bytes, at) {
  if (at + 4 > bytes.length || bytes[at] !== 0xff || (bytes[at + 1] & 0xe0) !== 0xe0) return null;
  const version = (bytes[at + 1] >> 3) & 3;
  const layer = 4 - ((bytes[at + 1] >> 1) & 3);
  const bitrateIndex = bytes[at + 2] >> 4;
  const rateIndex = (bytes[at + 2] >> 2) & 3;
  if (version === 1 || layer === 4 || bitrateIndex === 0 || bitrateIndex === 15 || rateIndex === 3) return null;
  const mpeg1 = version === 3;
  const padding = (bytes[at + 2] >> 1) & 1;
  const sampleRate = SAMPLE_RATES[version][rateIndex];
  const table = mpeg1 ? `mpeg1layer${layer}` : layer === 1 ? 'mpeg2layer1' : 'mpeg2layer23';
  const bitrate = BITRATES[table][bitrateIndex] * 1000;
  const samples = layer === 1 ? 384 : layer === 2 || mpeg1 ? 1152 : 576;
  const length = layer === 1 ? (Math.floor((12 * bitrate) / sampleRate) + padding) * 4 : Math.floor(((samples / 8) * bitrate) / sampleRate) + padding;
  return { mpeg1, layer, mono: bytes[at + 3] >> 6 === 3, sampleRate, samples, length };
}

const ascii = (bytes, at, length) => String.fromCharCode(...bytes.subarray(at, at + length));
const uint32 = (bytes, at) => ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;

function id3v2Length(bytes) {
  if (ascii(bytes, 0, 3) !== 'ID3') return 0;
  const size = ((bytes[6] & 0x7f) << 21) | ((bytes[7] & 0x7f) << 14) | ((bytes[8] & 0x7f) << 7) | (bytes[9] & 0x7f);
  const footer = bytes[5] & 0x10 ? 10 : 0;
  return 10 + size + footer;
}

function firstFrame(bytes, from) {
  for (let at = from; at < bytes.length - 4; at++) {
    const header = frameHeader(bytes, at);
    if (header && (at + header.length >= bytes.length || frameHeader(bytes, at + header.length))) return at;
  }
  return -1;
}

function taggedFrames(bytes, at, header) {
  if (header.layer !== 3) return null;
  const xing = at + 4 + (header.mpeg1 ? (header.mono ? 17 : 32) : header.mono ? 9 : 17);
  if (['Xing', 'Info'].includes(ascii(bytes, xing, 4))) return uint32(bytes, xing + 4) & 1 ? uint32(bytes, xing + 8) : null;
  if (ascii(bytes, at + 36, 4) === 'VBRI') return uint32(bytes, at + 36 + 14);
  return null;
}

export function mp3Duration(bytes) {
  const at = firstFrame(bytes, id3v2Length(bytes));
  if (at < 0) throw new Error('no tiene frames MPEG');
  const header = frameHeader(bytes, at);
  const tagged = taggedFrames(bytes, at, header);
  let walked = 0;
  for (let next = at, frame; (frame = frameHeader(bytes, next)) && next + frame.length <= bytes.length; next += frame.length) walked++;
  const walkedFrames = tagged == null ? walked : walked - 1;
  const frames = tagged ?? walkedFrames;
  return { ms: Math.round((frames * header.samples * 1000) / header.sampleRate), frames, taggedFrames: tagged, walkedFrames, sampleRate: header.sampleRate, samplesPerFrame: header.samples };
}

export async function syncRadio({ log = (msg) => process.stderr.write(`${msg}\n`) } = {}) {
  const music = JSON.parse(readFileSync(MANIFEST, 'utf8')).music;
  log(`Radio: midiendo ${RADIO_TRACKS.length} canciones de pokerogue-assets@${UPSTREAM.pokerogue.commit.slice(0, 7)}.`);
  const measured = new Map();
  const failed = [];
  await mapLimit(RADIO_TRACKS, async ({ id }) => {
    try {
      if (typeof music[id] !== 'string') throw new Error('no está en public/upstream/pokerogue.json: corre npm run anims');
      const res = await fetchUpstream(UPSTREAM.pokerogue, music[id]);
      if (!res.ok) throw new Error(String(res.status));
      measured.set(id, mp3Duration(new Uint8Array(await res.arrayBuffer())));
    } catch (err) {
      failed.push(`${id} (${err.message})`);
    }
  });
  if (failed.length) throw new Error(`No se pudieron medir ${failed.length} canciones: ${failed.join(', ')}`);

  const mismatched = [...measured].filter(([, track]) => track.taggedFrames != null && Math.abs(track.taggedFrames - track.walkedFrames) > 1);
  for (const [id, track] of mismatched) log(`  ${id}: el tag dice ${track.taggedFrames} frames y el archivo tiene ${track.walkedFrames}`);
  writeFileSync(DURATIONS, manifestJSON(Object.fromEntries(RADIO_TRACKS.map(({ id }) => [id, measured.get(id).ms]))));
  const untagged = [...measured.values()].filter((track) => track.taggedFrames == null).length;
  log(`Duraciones escritas en src/catalog/data/radio-durations.json (${untagged} sin tag, medidas frame a frame; ${mismatched.length} con tag y frames distintos).`);
  return measured;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncRadio().catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  });
}

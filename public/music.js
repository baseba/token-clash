import { causeAnim, chargeAnim, conditionAnim, statusAnim, terrainAnim, weatherAnim } from './battle-anims.js?v=dev';
import { radioTrack, RADIO_TRACKS } from './radio.js?v=dev';
import { fetchFirst, UPSTREAM, upstreamManifest, upstreamURLs } from './upstream.js?v=dev';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

function pulseWave(ctx, duty) {
  const size = 64;
  const real = new Float32Array(size);
  const imag = new Float32Array(size);
  for (let k = 1; k < size; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return ctx.createPeriodicWave(real, imag);
}

const TYPE_PITCH = { normal: 1, fire: 1.1, water: 0.9, electric: 1.35, grass: 1, ice: 1.45, fighting: 0.8, poison: 0.85, ground: 0.6, flying: 1.2, psychic: 1.15, bug: 1.25, rock: 0.7, ghost: 0.75, dragon: 0.8, dark: 0.7, steel: 1.2, fairy: 1.4 };

const MOVE_SFX_MANIFEST = '/sfx/moves/moves.json';

/** Where a sprite's cry loads from, in order, per public/upstream/cries.json; none if it has no cry. */
export function cryURLs(manifest, sprite) {
  const path = manifest?.[String(sprite)];
  return typeof path === 'string' ? upstreamURLs(UPSTREAM.cries, path) : [];
}

const SCENE_TRACKS = {
  beach: 'battle_alola_elite',
  'beach-2': 'battle_alola_champion',
  'beach-night': 'battle_skull_grunt',
  cave: 'battle_sinnoh_gym',
  'cave-2': 'battle_hoenn_gym',
  'cave-night': 'battle_rocket_grunt',
  desert: 'battle_paldea_gym',
  'desert-night': 'battle_flare_grunt',
  lake: 'battle_johto_gym',
  'lake-night': 'battle_galactic_grunt',
  mountain: 'battle_kanto_champion',
  'mountain-2': 'battle_aqua_magma_boss',
  'mountain-night': 'battle_galactic_admin',
  ocean: 'battle_aqua_magma_grunt',
  'ocean-night': 'battle_plasma_grunt',
  path: 'battle_rival',
  'path-2': 'battle_kanto_gym',
  'path-night': 'battle_rival_2',
  snow: 'battle_sinnoh_champion',
  'snow-night': 'battle_unova_elite',
  'tall-grass': 'battle_trainer',
  'tall-grass-night': 'battle_rival_3',
  underwater: 'battle_hoenn_elite',
};

const SCREEN_TRACKS = {
  'tab:home': 'town',
  'tab:collection': 'tall_grass',
  'tab:pokedex': 'laboratory',
  'tab:stats': 'plains',
  'tab:profile': 'title',
  'tab:shop': 'mystery_encounter_gen_5_gts',
  'tab:recycling': 'factory',
  prep: 'menu',
  'victory:win': 'bw/victory_trainer',
  'victory:champion': 'bw/victory_champion',
};

export const MUSIC_TRACKS = [...new Set([...Object.values(SCENE_TRACKS), ...Object.values(SCREEN_TRACKS), ...RADIO_TRACKS.map((track) => track.id)])];

export const musicFile = (track) => `/music/${track.replace('/', '-')}.mp3`;

export function trackFor(id) {
  const radio = /^radio:(.+)$/.exec(id ?? '')?.[1];
  if (radio) return radioTrack(radio)?.id ?? null;
  const scene = /^scene:(.+)$/.exec(id ?? '')?.[1];
  return scene ? SCENE_TRACKS[scene] ?? null : SCREEN_TRACKS[id] ?? null;
}

const SE_FILES = { throw: 'pb_throw', switch: 'pb_rel', faint: 'faint', up: 'stat_up', down: 'stat_down', heal: 'restore', reveal: 'pb_tray_ball' };

const UI_SOUNDS = {
  select: { file: 'select' },
  back: { file: 'select', rate: 0.8 },
  open: { file: 'menu_open' },
  confirm: { file: 'pb_lock' },
  danger: { file: 'flee' },
  add: { file: 'pb_tray_enter' },
  remove: { file: 'pb_tray_empty' },
  save: { file: 'save' },
  buy: { file: 'buy' },
};
export const UI_SOUND_KINDS = Object.keys(UI_SOUNDS);
const UI_QUIET_AFTER_SFX_S = 0.6;

export function uiSampleFor(kind) {
  const sound = UI_SOUNDS[kind];
  return sound ? { url: `/sfx/se/${sound.file}.wav`, rate: sound.rate ?? 1 } : null;
}

export function sampleFor(kind, opts = {}) {
  if (kind === 'hit') {
    const eff = opts.eff ?? 1;
    if (eff === 0) return null;
    return `/sfx/se/${eff > 1 ? 'hit_strong' : eff < 1 ? 'hit_weak' : 'hit'}.wav`;
  }
  return SE_FILES[kind] ? `/sfx/se/${SE_FILES[kind]}.wav` : null;
}

export function animSoundFor(kind, opts = {}) {
  if (kind === 'status') return statusAnim(opts.status);
  if (kind === 'cause') return causeAnim(opts.cause);
  if (kind === 'weather') return weatherAnim(opts.weather);
  if (kind === 'terrain') return terrainAnim(opts.terrain);
  if (kind === 'condition') return conditionAnim(opts.kind);
  if (kind === 'charge') return chargeAnim(opts.key);
  return null;
}

export function moveSfxCues(manifest, key, byPlayer = true) {
  const sides = manifest?.[key];
  if (!sides) return [];
  const cues = byPlayer ? sides[0] : sides[1] ?? sides[0];
  return cues.map(([at, url, gain, rate]) => ({ at, url, gain, rate }));
}



export function createPlayer({ storage = null } = {}) {
  let ctx = null;
  let sfxGain = null;
  let master = null;
  let trackGain = null;
  let noise = null;
  let waves = {};
  let current = null;
  let wanted = null;
  let lastSfxAt = -Infinity;
  let radio = null;
  const read = (k, d) => {
    try {
      const v = storage?.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch {
      return d;
    }
  };
  const write = (k, v) => {
    try {
      storage?.setItem(k, JSON.stringify(v));
    } catch {}
  };
  const VOLUME_KEYS = { music: 'tc_music_level', sfx: 'tc_sfx_level' };
  const volumes = { music: read(VOLUME_KEYS.music, 0.5), sfx: read(VOLUME_KEYS.sfx, 0.15) };
  let muted = read('tc_music_muted', false);
  radio = radioTrack(read('tc_radio', null)) ? read('tc_radio', null) : null;
  const shown = () => (radio ? `radio:${radio}` : wanted);
  let musicGain = null;
  const LEVEL = { music: 1.6, sfx: 2.8 };
  const STREAM_LEVEL = 0.55;

  function ensure() {
    if (ctx) return true;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.32;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    master.connect(limiter);
    limiter.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = volumes.music * LEVEL.music;
    musicGain.connect(master);
    const buffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise = buffer;
    waves = { 0.125: pulseWave(ctx, 0.125), 0.25: pulseWave(ctx, 0.25), 0.5: pulseWave(ctx, 0.5) };
    return true;
  }

  function sweep(out, at, { wave = 'square', from, to, dur, gain = 0.3, attack = 0.005, curve = 'exp' }) {
    const osc = ctx.createOscillator();
    if (waves[wave]) osc.setPeriodicWave(waves[wave]);
    else osc.type = wave;
    osc.frequency.setValueAtTime(Math.max(20, from), at);
    if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
    else osc.frequency.linearRampToValueAtTime(to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g);
    g.connect(out);
    osc.start(at);
    osc.stop(at + dur + 0.02);
    return osc;
  }

  function hiss(out, at, { dur, filter = 'lowpass', from = 2000, to = from, q = 1, gain = 0.3, attack = 0.005 }) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, at);
    f.frequency.exponentialRampToValueAtTime(Math.max(30, to), at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(at, Math.random() * 0.5);
    src.stop(at + dur + 0.02);
  }

  function thud(out, at, { pitch = 1, gain = 0.6, dur = 0.16 } = {}) {
    sweep(out, at, { wave: 'sine', from: 160 * pitch, to: 45 * pitch, dur, gain });
    hiss(out, at, { dur: dur * 0.6, from: 1800 * pitch, to: 300, gain: gain * 0.6 });
  }

  const SHAPE_SFX = {
    projectile: (o, t, p) => { sweep(o, t, { wave: 0.25, from: 500 * p, to: 1300 * p, dur: 0.14, gain: 0.18 }); hiss(o, t, { dur: 0.18, filter: 'bandpass', from: 1500 * p, to: 3000 * p, q: 2, gain: 0.12 }); },
    orb: (o, t, p) => { sweep(o, t, { wave: 'sine', from: 220 * p, to: 520 * p, dur: 0.38, gain: 0.3, attack: 0.05 }); sweep(o, t + 0.05, { wave: 'triangle', from: 330 * p, to: 780 * p, dur: 0.33, gain: 0.15, attack: 0.05 }); },
    stream: (o, t, p) => { hiss(o, t, { dur: 0.7, filter: 'bandpass', from: 700 * p, to: 2200 * p, q: 1.5, gain: 0.32, attack: 0.08 }); hiss(o, t + 0.1, { dur: 0.5, from: 500 * p, to: 200, gain: 0.15 }); },
    beam: (o, t, p) => { sweep(o, t, { wave: 0.125, from: 900 * p, to: 1500 * p, dur: 0.65, gain: 0.16, attack: 0.04, curve: 'lin' }); sweep(o, t, { wave: 0.5, from: 450 * p, to: 760 * p, dur: 0.65, gain: 0.1, attack: 0.04, curve: 'lin' }); },
    bolt: (o, t, p) => { for (let i = 0; i < 6; i++) sweep(o, t + i * 0.055, { wave: 0.125, from: (1800 + Math.random() * 1600) * p, to: 200, dur: 0.05, gain: 0.2 }); hiss(o, t, { dur: 0.35, filter: 'highpass', from: 3000, to: 5000, gain: 0.18 }); },
    storm: (o, t, p) => { hiss(o, t, { dur: 0.9, filter: 'bandpass', from: 600 * p, to: 2600 * p, q: 3, gain: 0.3, attack: 0.15 }); hiss(o, t + 0.25, { dur: 0.6, filter: 'bandpass', from: 2400 * p, to: 800 * p, q: 3, gain: 0.22, attack: 0.1 }); },
    gust: (o, t, p) => { hiss(o, t, { dur: 0.55, filter: 'bandpass', from: 400 * p, to: 2000 * p, q: 2.5, gain: 0.3, attack: 0.12 }); },
    psywave: (o, t, p) => { const osc = sweep(o, t, { wave: 'sine', from: 600 * p, to: 300 * p, dur: 0.7, gain: 0.26, attack: 0.08, curve: 'lin' }); const lfo = ctx.createOscillator(); const d = ctx.createGain(); lfo.frequency.value = 9; d.gain.value = 80 * p; lfo.connect(d); d.connect(osc.frequency); lfo.start(t); lfo.stop(t + 0.72); },
    eruption: (o, t, p) => { hiss(o, t, { dur: 0.8, from: 300, to: 1600 * p, gain: 0.4, attack: 0.2 }); sweep(o, t, { wave: 'sine', from: 50, to: 90, dur: 0.8, gain: 0.4, attack: 0.2 }); },
    bubbles: (o, t, p) => { for (let i = 0; i < 6; i++) sweep(o, t + i * 0.07, { wave: 'sine', from: (400 + Math.random() * 500) * p, to: (900 + Math.random() * 600) * p, dur: 0.06, gain: 0.22 }); },
    pulse: (o, t, p) => { for (let i = 0; i < 4; i++) sweep(o, t + i * 0.1, { wave: 0.5, from: 300 * p, to: 260 * p, dur: 0.08, gain: 0.2 }); },
    sound: (o, t, p) => { const osc = sweep(o, t, { wave: 0.25, from: 700 * p, to: 500 * p, dur: 0.5, gain: 0.2, attack: 0.03, curve: 'lin' }); const lfo = ctx.createOscillator(); const d = ctx.createGain(); lfo.frequency.value = 22; d.gain.value = 120; lfo.connect(d); d.connect(osc.frequency); lfo.start(t); lfo.stop(t + 0.52); },
    drain: (o, t, p) => { sweep(o, t, { wave: 'triangle', from: 1200 * p, to: 300 * p, dur: 0.35, gain: 0.25 }); sweep(o, t + 0.3, { wave: 'sine', from: 300 * p, to: 900 * p, dur: 0.35, gain: 0.25 }); },
    meteor: (o, t, p) => { sweep(o, t, { wave: 'sine', from: 1400 * p, to: 180, dur: 0.6, gain: 0.25, curve: 'lin' }); thud(o, t + 0.58, { pitch: 0.6, gain: 0.8, dur: 0.4 }); },
    rain: (o, t, p) => { for (let i = 0; i < 4; i++) thud(o, t + i * 0.11, { pitch: 0.7 + Math.random() * 0.4, gain: 0.45 }); },
    flash: (o, t, p) => { [1, 1.25, 1.5, 2].forEach((m, i) => sweep(o, t + i * 0.06, { wave: 'triangle', from: 1046 * m * p, to: 1046 * m * p, dur: 0.3, gain: 0.16 })); hiss(o, t, { dur: 0.4, filter: 'highpass', from: 6000, to: 8000, gain: 0.08 }); },
    blast: (o, t, p) => { hiss(o, t, { dur: 0.9, from: 3000, to: 120, gain: 0.55 }); sweep(o, t, { wave: 'sine', from: 120, to: 30, dur: 0.5, gain: 0.7 }); },
    quake: (o, t, p) => { hiss(o, t, { dur: 1.1, from: 260, to: 120, gain: 0.5, attack: 0.1 }); const osc = sweep(o, t, { wave: 'sine', from: 46, to: 38, dur: 1.1, gain: 0.6, attack: 0.1 }); const lfo = ctx.createOscillator(); const d = ctx.createGain(); lfo.frequency.value = 11; d.gain.value = 12; lfo.connect(d); d.connect(osc.frequency); lfo.start(t); lfo.stop(t + 1.12); },
    rise: (o, t, p) => { hiss(o, t, { dur: 0.45, from: 400, to: 3000 * p, gain: 0.35, attack: 0.15 }); for (let i = 0; i < 3; i++) thud(o, t + 0.3 + i * 0.06, { pitch: 1.4, gain: 0.25, dur: 0.08 }); },
    darts: (o, t, p) => { for (let i = 0; i < 4; i++) { sweep(o, t + i * 0.08, { wave: 0.25, from: 1500 * p, to: 2600 * p, dur: 0.04, gain: 0.14 }); hiss(o, t + i * 0.08 + 0.03, { dur: 0.04, filter: 'highpass', from: 3500, gain: 0.12 }); } },
    strike: (o, t, p) => { hiss(o, t, { dur: 0.12, filter: 'bandpass', from: 900 * p, to: 2200 * p, q: 1.5, gain: 0.22 }); },
    punch: (o, t, p) => { hiss(o, t, { dur: 0.1, filter: 'bandpass', from: 700, to: 1800, q: 1.5, gain: 0.2 }); },
    bite: (o, t, p) => { for (let i = 0; i < 2; i++) hiss(o, t + i * 0.09, { dur: 0.06, filter: 'bandpass', from: 2400 * p, to: 900, q: 4, gain: 0.32 }); },
    slash: (o, t, p) => { hiss(o, t, { dur: 0.22, filter: 'highpass', from: 2000, to: 7000, gain: 0.32 }); sweep(o, t + 0.04, { wave: 'triangle', from: 2600 * p, to: 2400 * p, dur: 0.3, gain: 0.08 }); },
    boost: (o, t, p) => { [0, 4, 7, 12].forEach((st, i) => sweep(o, t + i * 0.07, { wave: 0.5, from: 523 * 2 ** (st / 12), to: 523 * 2 ** (st / 12), dur: 0.09, gain: 0.16 })); },
    heal: (o, t, p) => { [0, 7, 12, 16, 19].forEach((st, i) => sweep(o, t + i * 0.08, { wave: 'triangle', from: 784 * 2 ** (st / 12), to: 784 * 2 ** (st / 12), dur: 0.35, gain: 0.14, attack: 0.02 })); },
    weather: (o, t, p) => { hiss(o, t, { dur: 1.2, filter: 'bandpass', from: 300 * p, to: 1800 * p, q: 1.2, gain: 0.3, attack: 0.3 }); },
    hearts: (o, t, p) => { sweep(o, t, { wave: 'sine', from: 600, to: 900, dur: 0.15, gain: 0.25 }); sweep(o, t + 0.18, { wave: 'sine', from: 700, to: 1100, dur: 0.18, gain: 0.25 }); },
    powder: (o, t, p) => { for (let i = 0; i < 8; i++) hiss(o, t + i * 0.05, { dur: 0.05, filter: 'highpass', from: 5000 + Math.random() * 3000, gain: 0.09 }); sweep(o, t, { wave: 'triangle', from: 1800 * p, to: 2400 * p, dur: 0.4, gain: 0.06, curve: 'lin' }); },
    aura: (o, t, p) => { sweep(o, t, { wave: 'triangle', from: 300 * p, to: 900 * p, dur: 0.5, gain: 0.2, attack: 0.08 }); [0, 7, 12].forEach((st, i) => sweep(o, t + 0.15 + i * 0.09, { wave: 0.125, from: 880 * p * 2 ** (st / 12), to: 880 * p * 2 ** (st / 12), dur: 0.12, gain: 0.08 })); },
  };

  const manifests = new Map();
  const buffers = new Map();

  function loadManifest(url) {
    if (!manifests.has(url)) {
      manifests.set(url, fetch(url).then((res) => (res.ok ? res.json() : {})).catch(() => ({})));
    }
    return manifests.get(url);
  }

  // A sound from the first of its URLs that answers, cached by the first one.
  function loadBuffer(urls) {
    const [key] = urls;
    if (!buffers.has(key)) {
      const buffer = fetchFirst(urls)
        .then((res) => (res ? res.arrayBuffer() : null))
        .then((data) => (data ? ctx.decodeAudioData(data) : null))
        .catch(() => null);
      buffers.set(key, buffer);
    }
    return buffers.get(key);
  }

  const cryBuffer = async (sprite) => {
    const urls = cryURLs(await upstreamManifest('cries'), sprite);
    return urls.length ? loadBuffer(urls) : null;
  };
  const moveCues = async (key, byPlayer) => moveSfxCues(await loadManifest(MOVE_SFX_MANIFEST), key, byPlayer);

  const cueSources = new Set();
  function stopCues() {
    for (const source of cueSources) {
      try {
        source.stop();
      } catch {}
    }
    cueSources.clear();
  }

  function playBuffer(out, buffer, { rate = 1, gain = 0.3, when = 0 } = {}) {
    const source = ctx.createBufferSource();
    const level = ctx.createGain();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    level.gain.value = gain;
    source.connect(level);
    level.connect(out);
    source.start(when);
  }

  async function playCry(out, sprite, faint) {
    if (sprite == null) return;
    const buffer = await cryBuffer(sprite);
    if (buffer && ctx.state === 'running') playBuffer(out, buffer, { rate: faint ? 0.8 : 1 });
  }

  async function playMove(out, { key, byPlayer = true, shape, type }) {
    const cues = key ? await moveCues(key, byPlayer) : [];
    const buffers = await Promise.all(cues.map((cue) => loadBuffer([cue.url])));
    if (ctx.state !== 'running') return;
    const start = ctx.currentTime + 0.01;
    if (!buffers.some(Boolean)) return SHAPE_SFX[shape]?.(out, start, TYPE_PITCH[type] ?? 1);
    cues.forEach((cue, i) => buffers[i] && playBuffer(out, buffers[i], { when: start + cue.at / 1000, rate: cue.rate, gain: 0.35 * cue.gain }));
  }

  function synthSfx(out, kind, opts) {
    const t = ctx.currentTime + 0.01;
    if (kind === 'hit') {
      const eff = opts.eff ?? 1;
      if (eff === 0) return;
      thud(out, t, { pitch: eff > 1 ? 1.1 : eff < 1 ? 0.8 : 1, gain: eff > 1 ? 0.8 : eff < 1 ? 0.35 : 0.55, dur: eff > 1 ? 0.22 : 0.16 });
      if (eff > 1) { hiss(out, t + 0.07, { dur: 0.12, filter: 'bandpass', from: 3000, to: 1200, q: 3, gain: 0.3 }); thud(out, t + 0.1, { pitch: 1.3, gain: 0.4, dur: 0.12 }); }
      if (opts.crit) sweep(out, t, { wave: 0.125, from: 2200, to: 3200, dur: 0.12, gain: 0.18 });
      return;
    }
    if (kind === 'miss') return hiss(out, t, { dur: 0.3, filter: 'bandpass', from: 2500, to: 600, q: 2, gain: 0.22, attack: 0.05 });
    if (kind === 'faint') return sweep(out, t, { wave: 0.5, from: 700, to: 90, dur: 0.75, gain: 0.22, curve: 'lin' });
    if (kind === 'throw') return hiss(out, t, { dur: 0.5, filter: 'bandpass', from: 600, to: 2200, q: 3, gain: 0.22, attack: 0.1 });
    if (kind === 'switch') { sweep(out, t, { wave: 'sine', from: 300, to: 1200, dur: 0.18, gain: 0.22 }); return hiss(out, t + 0.16, { dur: 0.08, filter: 'highpass', from: 4000, gain: 0.18 }); }
    if (kind === 'up') return [0, 4, 7].forEach((st, i) => sweep(out, t + i * 0.06, { wave: 0.5, from: 659 * 2 ** (st / 12), to: 659 * 2 ** (st / 12), dur: 0.08, gain: 0.15 }));
    if (kind === 'down') return [7, 3, 0].forEach((st, i) => sweep(out, t + i * 0.07, { wave: 0.5, from: 392 * 2 ** (st / 12), to: 392 * 2 ** (st / 12), dur: 0.09, gain: 0.15 }));
    if (kind === 'heal') return SHAPE_SFX.heal(out, t, 1);
    if (kind === 'shield') { sweep(out, t, { wave: 'triangle', from: 1760, to: 1760, dur: 0.4, gain: 0.18 }); return sweep(out, t, { wave: 'triangle', from: 2637, to: 2637, dur: 0.3, gain: 0.1 }); }
    if (kind === 'cry') return playCry(out, opts.sprite, opts.faint);
    if (kind === 'cause') {
      const c = opts.cause;
      if (c === 'sand') { hiss(out, t, { dur: 0.8, filter: 'bandpass', from: 2500, to: 1200, q: 0.8, gain: 0.3, attack: 0.15 }); return hiss(out, t + 0.1, { dur: 0.6, filter: 'highpass', from: 4000, to: 6000, gain: 0.15, attack: 0.1 }); }
      if (c === 'hail') { for (let i = 0; i < 7; i++) sweep(out, t + i * 0.07 + Math.random() * 0.03, { wave: 'triangle', from: 2400 + Math.random() * 1200, to: 1800, dur: 0.05, gain: 0.14 }); return; }
      if (c === 'brn') return hiss(out, t, { dur: 0.55, filter: 'bandpass', from: 900, to: 2600, q: 1, gain: 0.32, attack: 0.04 });
      if (c === 'psn' || c === 'tox' || c === 'ooze') return SHAPE_SFX.bubbles(out, t, 0.7);
      if (c === 'leechseed') return SHAPE_SFX.drain(out, t, 1);
      if (c === 'bound') { hiss(out, t, { dur: 0.4, from: 500, to: 200, gain: 0.3 }); return thud(out, t + 0.15, { pitch: 0.7, gain: 0.35 }); }
      if (c === 'saltcure') return hiss(out, t, { dur: 0.4, filter: 'highpass', from: 3000, to: 6000, gain: 0.22 });
      if (c === 'curse' || c === 'nightmare') return sweep(out, t, { wave: 0.125, from: 420, to: 140, dur: 0.8, gain: 0.18, curve: 'lin' });
      if (c === 'stealthrock') return SHAPE_SFX.rain(out, t, 1);
      if (c === 'spikes') return SHAPE_SFX.darts(out, t, 0.8);
      if (c === 'future') return SHAPE_SFX.flash(out, t, 0.9);
      return thud(out, t, { pitch: 0.9, gain: 0.4 });
    }
    if (kind === 'weather') return SHAPE_SFX.weather(out, t, TYPE_PITCH[opts.type] ?? 1);
    if (kind === 'status') {
      const s = opts.status;
      if (s === 'par') return SHAPE_SFX.bolt(out, t, 1);
      if (s === 'brn') return hiss(out, t, { dur: 0.5, filter: 'bandpass', from: 1200, to: 3000, q: 1, gain: 0.3, attack: 0.05 });
      if (s === 'psn' || s === 'tox') return SHAPE_SFX.bubbles(out, t, 0.7);
      if (s === 'slp') return [12, 7, 4, 0].forEach((st, i) => sweep(out, t + i * 0.12, { wave: 'triangle', from: 523 * 2 ** (st / 12), to: 523 * 2 ** (st / 12), dur: 0.18, gain: 0.14 }));
      if (s === 'frz') { sweep(out, t, { wave: 'triangle', from: 3000, to: 3000, dur: 0.25, gain: 0.12 }); return hiss(out, t, { dur: 0.15, filter: 'highpass', from: 5000, gain: 0.25 }); }
      return SHAPE_SFX.psywave(out, t, 1);
    }
  }

  async function playSampleOr(out, url, fallback, rate = 1) {
    const buffer = await loadBuffer([url]);
    if (ctx.state !== 'running') return;
    if (buffer) playBuffer(out, buffer, { gain: 0.35, rate });
    else fallback();
  }

  async function playCuesOr(out, key, byPlayer, fallback) {
    const cues = await moveCues(key, byPlayer);
    const buffers = await Promise.all(cues.map((cue) => loadBuffer([cue.url])));
    if (ctx.state !== 'running') return;
    if (!buffers.some(Boolean)) return fallback();
    const start = ctx.currentTime + 0.01;
    cues.forEach((cue, i) => buffers[i] && playBuffer(out, buffers[i], { when: start + cue.at / 1000, rate: cue.rate, gain: 0.35 * cue.gain }));
  }

  function sfxBus() {
    if (!ensure() || ctx.state !== 'running') return null;
    if (!sfxGain) {
      sfxGain = ctx.createGain();
      sfxGain.gain.value = volumes.sfx * LEVEL.sfx;
      sfxGain.connect(master);
    }
    return sfxGain;
  }

  function fadeOutCurrent() {
    const old = trackGain;
    const oldSource = current?.source;
    if (old) {
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => {
        oldSource?.stop();
        old.disconnect();
      }, 1500);
    }
    trackGain = ctx.createGain();
    trackGain.gain.setValueAtTime(0, ctx.currentTime);
    trackGain.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.6);
    trackGain.connect(musicGain);
    return trackGain;
  }

  async function stream(id, track, gain, loop) {
    const [buffer, loops] = await Promise.all([loadBuffer([musicFile(track)]), loadManifest('/music/loops.json')]);
    if (current?.id !== id || trackGain !== gain || !buffer) return;
    const source = ctx.createBufferSource();
    const level = ctx.createGain();
    source.buffer = buffer;
    source.loop = loop;
    source.loopStart = Math.min(loops?.[track] ?? 0, buffer.duration);
    source.loopEnd = buffer.duration;
    level.gain.value = STREAM_LEVEL;
    source.connect(level);
    level.connect(gain);
    source.start();
    current.source = source;
  }

  function start(id) {
    if (radio) id = `radio:${radio}`;
    if (!ensure() || current?.id === id) return;
    const track = trackFor(id);
    const gain = fadeOutCurrent();
    current = track ? { id } : null;
    if (track) stream(id, track, gain, !id.startsWith('victory:'));
  }

  return {
    play(id) {
      wanted = id;
      if (ctx && ctx.state === 'running') start(id);
    },
    unlock() {
      if (!ensure()) return;
      for (const kind of UI_SOUND_KINDS) loadBuffer([uiSampleFor(kind).url]);
      if (ctx.state === 'suspended') ctx.resume().then(() => shown() && start(shown()));
      else if (shown()) start(shown());
    },
    stop() {
      wanted = null;
      if (radio || !ctx || !trackGain) return;
      trackGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      const source = current?.source;
      if (source) setTimeout(() => source.stop(), 1000);
      current = null;
    },
    victory(kind) {
      const id = `victory:${kind}`;
      wanted = id;
      if (ctx && ctx.state === 'running') start(id);
    },
    preload({ sprites = [], moves = [] }) {
      if (!ensure()) return;
      for (const kind of [...Object.keys(SE_FILES), 'hit']) for (const eff of [0.5, 1, 2]) {
        const url = sampleFor(kind, { eff });
        if (url) loadBuffer([url]);
      }
      for (const sprite of new Set(sprites)) if (sprite != null) cryBuffer(sprite);
      for (const key of new Set(moves)) {
        if (!key) continue;
        for (const byPlayer of [true, false]) moveCues(key, byPlayer).then((cues) => cues.forEach((cue) => loadBuffer([cue.url])));
      }
    },
    ui(kind) {
      const sample = uiSampleFor(kind);
      const out = sample && sfxBus();
      if (!out || ctx.currentTime - lastSfxAt < UI_QUIET_AFTER_SFX_S) return;
      return playSampleOr(out, sample.url, () => sweep(out, ctx.currentTime + 0.01, { wave: 0.5, from: 1200 * sample.rate, to: 1200 * sample.rate, dur: 0.05, gain: 0.12 }), sample.rate);
    },
    cues(list, { maxMs = 1400 } = {}) {
      const out = sfxBus();
      if (!out || !list?.length) return;
      Promise.all(list.map((cue) => loadBuffer([cue.url]))).then((loaded) => {
        if (ctx.state !== 'running') return;
        stopCues();
        const start = ctx.currentTime + 0.01;
        const stopAt = start + maxMs / 1000;
        list.forEach((cue, i) => {
          if (!loaded[i]) return;
          const when = start + (cue.at ?? 0) / 1000;
          if (when >= stopAt) return;
          const source = ctx.createBufferSource();
          const level = ctx.createGain();
          source.buffer = loaded[i];
          source.playbackRate.value = cue.rate ?? 1;
          level.gain.setValueAtTime(0.35 * (cue.gain ?? 1), when);
          level.gain.setValueAtTime(0.35 * (cue.gain ?? 1), stopAt - 0.25);
          level.gain.linearRampToValueAtTime(0, stopAt);
          source.connect(level);
          level.connect(out);
          source.start(when);
          source.stop(stopAt);
          cueSources.add(source);
          source.onended = () => cueSources.delete(source);
        });
      });
    },
    stopCues,
    preloadCues(list) {
      if (!ensure()) return;
      for (const cue of list ?? []) loadBuffer([cue.url]);
    },
    sfx(kind, opts = {}) {
      const out = sfxBus();
      if (!out) return;
      lastSfxAt = ctx.currentTime;
      if (kind === 'move') return playMove(out, opts);
      const sample = sampleFor(kind, opts);
      if (sample) return playSampleOr(out, sample, () => synthSfx(out, kind, opts), opts.rate ?? 1);
      const key = animSoundFor(kind, opts);
      if (key) return playCuesOr(out, key, opts.byPlayer ?? true, () => synthSfx(out, kind, opts));
      return synthSfx(out, kind, opts);
    },
    get track() {
      return current?.id ?? null;
    },
    get wanted() {
      return wanted;
    },
    get radio() {
      return radio;
    },
    setRadio(track) {
      radio = track && radioTrack(track) ? track : null;
      write('tc_radio', radio);
      if (!ctx || ctx.state !== 'running') return;
      if (radio) start(`radio:${radio}`);
      else if (wanted) {
        current = null;
        start(wanted);
      } else {
        fadeOutCurrent();
        current = null;
      }
    },
    get muted() {
      return muted;
    },

    volume(kind) {
      return volumes[kind];
    },
    setMuted(on) {
      muted = on;
      write('tc_music_muted', on);
      if (master) master.gain.setTargetAtTime(on ? 0 : 0.32, ctx.currentTime, 0.05);
    },
    setVolume(kind, v) {
      if (!(kind in volumes)) return;
      volumes[kind] = clamp(v, 0, 1);
      write(VOLUME_KEYS[kind], volumes[kind]);
      const node = kind === 'music' ? musicGain : sfxGain;
      if (node) node.gain.setTargetAtTime(volumes[kind] * LEVEL[kind], ctx.currentTime, 0.05);
    },
  };
}

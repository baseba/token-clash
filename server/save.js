// Reads a PokeTokenBar save: the app's export / snapshot ({format: "poketokenbar.save", state})
// or the raw live file (~/Library/Application Support/PokeTokenBar/companion-state.json).
// We keep only numbers: species numbers, rarity, level, IVs, shiny. Names, device name and
// token logs are dropped on purpose.

import { hash } from './creatures.js';

const RARITIES = new Set(['common', 'uncommon', 'rare', 'legendary']);
const UUID = /^[0-9a-fA-F-]{8,40}$/;
const MAX_ROSTER = 300;

export class SaveError extends Error {}

const int = (v, lo, hi, fallback) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(hi, Math.max(lo, Math.round(n)));
};

function ivsFrom(profile, seedKey) {
  const iv = profile && typeof profile.ivs === 'object' && profile.ivs ? profile.ivs : null;
  // Old saves have no IVs: give a stable middling value instead of a random one.
  const fb = 8 + (hash(seedKey) % 16);
  if (!iv) return { hp: fb, atk: fb, def: fb, spd: fb };
  const g = (k) => int(iv[k], 0, 31, fb);
  return {
    hp: g('hp'),
    atk: Math.round((g('attack') + g('specialAttack')) / 2),
    def: Math.round((g('defense') + g('specialDefense')) / 2),
    spd: g('speed'),
  };
}

function entryFrom(raw, { finalID, baseID, defaultLevel, fallbackId }) {
  if (!Number.isInteger(finalID) || finalID < 1 || finalID > 5000) return null;
  if (!Number.isInteger(baseID) || baseID < 1 || baseID > 5000) baseID = finalID;
  const profile = raw.profile && typeof raw.profile === 'object' ? raw.profile : null;
  let id = typeof raw.id === 'string' ? raw.id : profile && typeof profile.instanceID === 'string' ? profile.instanceID : '';
  if (!UUID.test(id)) id = fallbackId;
  return {
    id: id.toLowerCase(),
    finalID,
    baseID,
    rarity: RARITIES.has(raw.rarity) ? raw.rarity : 'common',
    shiny: raw.isShiny === true,
    level: int(profile?.level, 1, 100, defaultLevel),
    ivs: ivsFrom(profile, id),
  };
}

export function parseSave(text) {
  let json;
  try {
    // profile.seed is a uint64 and loses precision here; we never use it.
    json = JSON.parse(text);
  } catch {
    throw new SaveError('El archivo no es JSON válido.');
  }
  if (!json || typeof json !== 'object') throw new SaveError('El archivo no es un save de PokeTokenBar.');
  if ('format' in json && json.format !== 'poketokenbar.save') throw new SaveError('Formato de archivo desconocido.');
  const state = json.format === 'poketokenbar.save' ? json.state : json;
  if (!state || typeof state !== 'object' || (!Array.isArray(state.dex) && !state.active)) {
    throw new SaveError('No encontré tu colección. Exporta desde PokeTokenBar → Ajustes → Backup & Transfer.');
  }

  const roster = [];
  const seen = new Set();
  const add = (e) => {
    if (!e || seen.has(e.id) || roster.length >= MAX_ROSTER) return;
    seen.add(e.id);
    roster.push(e);
  };

  const dex = Array.isArray(state.dex) ? state.dex : [];
  dex.forEach((d, i) => {
    if (!d || typeof d !== 'object' || d.releasedAt) return; // released ones were let go, not raised
    add(entryFrom(d, { finalID: d.finalID, baseID: d.baseID, defaultLevel: 100, fallbackId: `dex-${i}-${d.finalID}` }));
  });

  const a = state.active;
  if (a && typeof a === 'object' && Array.isArray(a.pathIDs)) {
    const stage = int(a.stageIndex, 0, a.pathIDs.length - 1, 0);
    const current = a.pathIDs[stage];
    const e = entryFrom(a, { finalID: current, baseID: a.baseID, defaultLevel: 30, fallbackId: `active-${a.baseID}` });
    if (e) {
      e.active = true;
      add(e);
    }
  }

  if (roster.length === 0) throw new SaveError('Tu save no tiene criaturas todavía (¿solo un huevo?). Vuelve cuando nazca la primera.');

  const used = Number(state.usedSinceInstall);
  return {
    roster,
    totalTokens: Number.isFinite(used) && used > 0 ? Math.min(used, 1e15) : 0,
  };
}

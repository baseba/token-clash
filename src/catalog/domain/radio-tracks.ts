// The songs the radio plays. public/radio.js is the one list, shared with the browser, and
// src/catalog/data/radio-durations.json says how long each one lasts: a station plays its queue on
// the server's clock, and production can't download an mp3 to measure it (scripts/sync-radio.js
// measured them, npm run radio).
import { readFileSync } from 'node:fs';
import * as radio from '../../../public/radio.js';
import { catalogFile } from '../../shared/paths.js';

/** The id of a song of public/radio.js (`battle_kanto_gym`, `bw/victory_gym`…). */
export type RadioTrackId = string;

export const STATION_NAME_MAX: number = radio.STATION_NAME_MAX;
export const STATION_QUEUE_MAX: number = radio.STATION_QUEUE_MAX;

export const RADIO_TRACK_IDS = (radio.RADIO_TRACKS as readonly { id: RadioTrackId }[]).map((track) => track.id) as [RadioTrackId, ...RadioTrackId[]];

const MEASURED = JSON.parse(readFileSync(catalogFile('radio-durations.json'), 'utf8')) as Record<RadioTrackId, number>;

// A song added to public/radio.js without its length would stall a station: stop at boot instead.
const unmeasured = RADIO_TRACK_IDS.filter((id) => !(MEASURED[id] > 0));
if (unmeasured.length) throw new Error(`Faltan las duraciones de ${unmeasured.join(', ')} en src/catalog/data/radio-durations.json: corre npm run radio.`);

const DURATIONS = new Map(RADIO_TRACK_IDS.map((id) => [id, MEASURED[id]]));

/** Whether a song is on the radio. A saved station can hold one that a later version removed. */
export const isRadioTrack = (id: RadioTrackId): boolean => DURATIONS.has(id);

/** How long a song plays once through (intro and one pass of its loop), in milliseconds. */
export function radioTrackDuration(id: RadioTrackId): number {
  const duration = DURATIONS.get(id);
  if (duration === undefined) throw new Error(`La canción ${id} no está en la radio.`);
  return duration;
}

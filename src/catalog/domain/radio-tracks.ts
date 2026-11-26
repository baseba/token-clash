import { readFileSync } from 'node:fs';
import * as radio from '../../../public/radio.js';
import { catalogFile } from './data-file.js';

export type RadioTrackId = string;

export const STATION_NAME_MAX: number = radio.STATION_NAME_MAX;
export const STATION_QUEUE_MAX: number = radio.STATION_QUEUE_MAX;

export const RADIO_TRACK_IDS = (radio.RADIO_TRACKS as readonly { id: RadioTrackId }[]).map((track) => track.id) as [RadioTrackId, ...RadioTrackId[]];

const MEASURED = JSON.parse(readFileSync(catalogFile('radio-durations.json'), 'utf8')) as Record<RadioTrackId, number>;

const unmeasured = RADIO_TRACK_IDS.filter((id) => !(MEASURED[id] > 0));
if (unmeasured.length) throw new Error(`Faltan las duraciones de ${unmeasured.join(', ')} en src/catalog/data/radio-durations.json: corre npm run radio.`);

const DURATIONS = new Map(RADIO_TRACK_IDS.map((id) => [id, MEASURED[id]]));

export const isRadioTrack = (id: RadioTrackId): boolean => DURATIONS.has(id);

export function radioTrackDuration(id: RadioTrackId): number {
  const duration = DURATIONS.get(id);
  if (duration === undefined) throw new Error(`La canción ${id} no está en la radio.`);
  return duration;
}

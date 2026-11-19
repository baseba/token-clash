import { z } from 'zod';
import { RADIO_TRACK_IDS } from '../../../catalog/domain/radio-tracks.js';
import { QUEUE_MAX, STATION_NAME_MAX } from '../../domain/station.js';

/** PUT /api/radio/station: open your station, or rename it. */
export const OpenStationDto = z.object({
  name: z.string({ error: 'Ponle un nombre a tu estación.' }).trim().min(1, { error: 'Ponle un nombre a tu estación.' }).max(STATION_NAME_MAX, { error: `El nombre de la estación admite hasta ${STATION_NAME_MAX} caracteres.` }),
});
export type OpenStationDto = z.infer<typeof OpenStationDto>;

/** PUT /api/radio/station/queue: the whole queue, in order (adding, removing and reordering all send it). */
export const StationQueueDto = z.object({
  queue: z.array(z.enum(RADIO_TRACK_IDS)).max(QUEUE_MAX, { error: `La cola admite hasta ${QUEUE_MAX} canciones.` }),
});
export type StationQueueDto = z.infer<typeof StationQueueDto>;

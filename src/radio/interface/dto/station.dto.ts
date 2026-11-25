import { z } from 'zod';
import { RADIO_TRACK_IDS, STATION_QUEUE_MAX } from '../../../catalog/domain/radio-tracks.js';

export const OpenStationDto = z.object({
  name: z.string({ error: 'Ponle un nombre a tu estación.' }),
});
export type OpenStationDto = z.infer<typeof OpenStationDto>;

export const StationQueueDto = z.object({
  queue: z.array(z.enum(RADIO_TRACK_IDS)).max(STATION_QUEUE_MAX, { error: `La cola admite hasta ${STATION_QUEUE_MAX} canciones.` }),
  playing: z.number().int().nullable(),
});
export type StationQueueDto = z.infer<typeof StationQueueDto>;

import type { RadioTrackId } from '../../catalog/domain/radio-tracks.js';
import type { NowPlaying, Station } from '../domain/station.js';

/** A station as clients see it, over HTTP and in the `radio` socket frame. */
export interface StationView {
  ownerId: string;
  ownerName: string;
  name: string;
  nowPlaying: NowPlaying | null;
  queue: RadioTrackId[];
  /** How many clients are tuned in. */
  listeners: number;
}

export function stationView(station: Station, ownerName: string, listeners: number): StationView {
  return {
    ownerId: station.ownerId,
    ownerName,
    name: station.name,
    nowPlaying: station.nowPlaying ? { ...station.nowPlaying } : null,
    queue: [...station.queue],
    listeners,
  };
}

import type { RadioTrackId } from '../domain/radio-tracks.js';
import type { NowPlaying, Station } from '../domain/station.js';

export interface StationView {
  ownerId: string;
  ownerName: string;
  name: string;
  nowPlaying: NowPlaying | null;
  queue: RadioTrackId[];
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

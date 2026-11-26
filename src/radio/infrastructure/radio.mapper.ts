import { isRadioTrack } from '../domain/radio-tracks.js';
import { Station } from '../domain/station.js';
import type { StationRow } from './radio.schema.js';

export function stationToDomain(row: StationRow): Station {
  const { nowPlayingTrack: track, nowPlayingStartedAt: startedAt, nowPlayingEndsAt: endsAt } = row;
  return Station.restore({
    ownerId: row.ownerId,
    name: row.name,
    openedAt: row.openedAt,
    queue: row.queue.filter(isRadioTrack),
    nowPlaying: track != null && isRadioTrack(track) && startedAt != null && endsAt != null ? { track, startedAt, endsAt } : null,
  });
}

export function stationToRow(station: Station): StationRow {
  return {
    ownerId: station.ownerId,
    name: station.name,
    openedAt: station.openedAt,
    queue: station.queue,
    nowPlayingTrack: station.nowPlaying?.track ?? null,
    nowPlayingStartedAt: station.nowPlaying?.startedAt ?? null,
    nowPlayingEndsAt: station.nowPlaying?.endsAt ?? null,
  };
}

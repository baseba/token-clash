// Aggregate ⇄ row for radio stations.
import { isRadioTrack } from '../../catalog/domain/radio-tracks.js';
import { Station } from '../domain/station.js';
import type { StationRow } from './radio.schema.js';

// A song removed from public/radio.js since the row was saved has no length to play it by: it
// leaves the queue, and if it was on air the station's next advance starts the queue.
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

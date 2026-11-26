import { STATION_NAME_MAX, STATION_QUEUE_MAX, type RadioTrackId } from './radio-tracks.js';
import { conflict, invalid } from '../../shared/domain/errors.js';

export type TrackDuration = (track: RadioTrackId) => number;

export interface NowPlaying {
  track: RadioTrackId;
  startedAt: number;
  endsAt: number;
}

export interface StationState {
  ownerId: string;
  name: string;
  openedAt: number;
  queue: RadioTrackId[];
  nowPlaying: NowPlaying | null;
}

function cleanName(name: string): string {
  const clean = name.replace(/[\p{Cc}\u200E\u200F\u202A-\u202E\u2066-\u2069]/gu, '').trim();
  if (!clean) throw invalid('Ponle un nombre a tu estación.');
  if ([...clean].length > STATION_NAME_MAX) throw invalid(`El nombre de la estación admite hasta ${STATION_NAME_MAX} caracteres.`);
  return clean;
}

export class Station implements StationState {
  ownerId: string;
  name: string;
  openedAt: number;
  queue: RadioTrackId[];
  nowPlaying: NowPlaying | null;

  private constructor(state: StationState) {
    Object.assign(this, state);
  }

  static restore(state: StationState): Station {
    return new Station(state);
  }

  static open(ownerId: string, name: string, now: number): Station {
    return new Station({ ownerId, name: cleanName(name), openedAt: now, queue: [], nowPlaying: null });
  }

  rename(name: string): void {
    this.name = cleanName(name);
  }

  advance(now: number, durationOf: TrackDuration): boolean {
    let changed = false;
    if (!this.nowPlaying && this.queue.length) {
      this.playNext(now, durationOf);
      changed = true;
    }
    while (this.nowPlaying && this.queue.length && now >= this.nowPlaying.endsAt) {
      this.playNext(this.nowPlaying.endsAt, durationOf);
      changed = true;
    }
    return changed;
  }

  setQueue(tracks: readonly RadioTrackId[], playing: number | null, now: number, durationOf: TrackDuration): void {
    if (tracks.length > STATION_QUEUE_MAX) throw invalid(`La cola admite hasta ${STATION_QUEUE_MAX} canciones.`);
    this.advance(now, durationOf);
    if (playing !== (this.nowPlaying?.startedAt ?? null)) throw conflict('La estación cambió de canción mientras editabas la cola: revisa la cola y vuelve a intentarlo.');
    this.queue = [...tracks];
    if (this.queue.length && (!this.nowPlaying || now >= this.nowPlaying.endsAt)) this.playNext(now, durationOf);
  }

  skip(now: number, durationOf: TrackDuration): void {
    this.advance(now, durationOf);
    if (!this.queue.length) throw conflict('No hay más canciones en la cola: agrega una para saltar a ella.');
    this.playNext(now, durationOf);
  }

  get nextChangeAt(): number | null {
    return this.nowPlaying && this.queue.length ? this.nowPlaying.endsAt : null;
  }

  private playNext(at: number, durationOf: TrackDuration): void {
    const [track, ...rest] = this.queue;
    this.queue = rest;
    this.nowPlaying = { track, startedAt: at, endsAt: at + durationOf(track) };
  }
}

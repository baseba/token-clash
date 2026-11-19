// The Station aggregate: a trainer's radio station. Its owner is always the DJ and picks the
// queue; anyone can tune in. A song plays once through, then the next queued one starts. With an
// empty queue the last song keeps looping, and the server has nothing to do: every client loops it
// on its own from its loop point.
//
// Time is the station's clock, not a timer's: `nowPlaying` says when the song started and when it
// ends, and `advance(now)` catches up from there. A station nobody listened to for an hour is
// exactly where it would be if someone had. Durations and the clock come from outside, so the
// rules run without a catalog file or a real clock.

import { STATION_NAME_MAX, STATION_QUEUE_MAX, type RadioTrackId } from '../../catalog/domain/radio-tracks.js';
import { conflict, invalid } from '../../shared/domain/errors.js';

/** How long a song plays once through, in milliseconds. */
export type TrackDuration = (track: RadioTrackId) => number;

/** The song on air, on the server's clock (epoch ms). */
export interface NowPlaying {
  track: RadioTrackId;
  startedAt: number;
  endsAt: number;
}

export interface StationState {
  /** One station per trainer, so the owner's id is also the station's. */
  ownerId: string;
  name: string;
  openedAt: number;
  /** The songs waiting their turn, in order. */
  queue: RadioTrackId[];
  /** Null while nothing was ever queued, or after the song on air left the radio (see advance). */
  nowPlaying: NowPlaying | null;
}

// Control and bidi characters would let a name break the layout around it.
function cleanName(name: string): string {
  const clean = name.replace(/[\p{Cc}\p{Cf}]/gu, '').trim();
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

  /**
   * Plays the queue up to `now`: each song that ended hands over to the next queued one, which
   * started when the previous one ended, not now. With nothing on air and songs waiting, the first
   * one starts now. Says whether anything changed.
   */
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

  /**
   * The DJ's new queue: adding, removing and reordering all send the whole list. If nothing is on
   * air, or the song on air already played through and is looping, the first one starts now.
   */
  setQueue(tracks: readonly RadioTrackId[], now: number, durationOf: TrackDuration): void {
    if (tracks.length > STATION_QUEUE_MAX) throw invalid(`La cola admite hasta ${STATION_QUEUE_MAX} canciones.`);
    this.advance(now, durationOf);
    this.queue = [...tracks];
    if (this.queue.length && (!this.nowPlaying || now >= this.nowPlaying.endsAt)) this.playNext(now, durationOf);
  }

  /** The next queued song starts now. */
  skip(now: number, durationOf: TrackDuration): void {
    this.advance(now, durationOf);
    if (!this.queue.length) throw conflict('No hay más canciones en la cola: agrega una para saltar a ella.');
    this.playNext(now, durationOf);
  }

  /** When the song on air hands over to the next one, or null if nothing is waiting. */
  get nextChangeAt(): number | null {
    return this.nowPlaying && this.queue.length ? this.nowPlaying.endsAt : null;
  }

  private playNext(at: number, durationOf: TrackDuration): void {
    const [track, ...rest] = this.queue;
    this.queue = rest;
    this.nowPlaying = { track, startedAt: at, endsAt: at + durationOf(track) };
  }
}

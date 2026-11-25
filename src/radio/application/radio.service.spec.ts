import { afterEach, beforeEach, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { radioTrackDuration } from '../../catalog/domain/radio-tracks.js';
import type { TrainersService } from '../../trainers/application/trainers.service.js';
import { Station } from '../domain/station.js';
import { StationRepository } from '../domain/station.repository.js';
import type { RadioListener } from './radio-listeners.js';
import { RadioService } from './radio.service.js';
import type { StationView } from './station-view.js';

const T0 = 1_000_000_000;
const GYM = 'battle_kanto_gym';

class MemoryStations extends StationRepository {
  readonly byOwner = new Map<string, Station>();
  readonly saved: string[] = [];
  all = () => [...this.byOwner.values()];
  findByOwner = (ownerId: string) => this.byOwner.get(ownerId);
  save = (station: Station) => {
    this.saved.push(station.ownerId);
    this.byOwner.set(station.ownerId, station);
  };
  delete = (ownerId: string) => void this.byOwner.delete(ownerId);
}

const trainers = { byId: () => ({ name: 'Ana' }) } as unknown as TrainersService;

interface Frame {
  station: StationView | null;
}

function listener(): RadioListener & { frames: Frame[] } {
  const frames: Frame[] = [];
  return { frames, open: true, send: (frame) => frames.push(frame as Frame) };
}

beforeEach(() => mock.timers.enable({ apis: ['setTimeout', 'Date'], now: T0 }));
afterEach(() => mock.timers.reset());

test('a tuned listener hears the next song the moment the one on air ends, timed from its end', () => {
  const radio = new RadioService(new MemoryStations(), trainers);
  radio.open('ana', 'Radio');
  const playing = radio.setQueue('ana', [GYM, 'title'], null);
  const endsAt = playing.nowPlaying!.endsAt;
  const ear = listener();
  radio.tune(ear, 'ana');
  ear.frames.length = 0;

  mock.timers.tick(endsAt - T0 - 1);
  assert.equal(ear.frames.length, 0, 'nothing before the song ends');
  mock.timers.tick(1);
  assert.equal(ear.frames.length, 1);
  assert.equal(ear.frames[0].station?.nowPlaying?.track, 'title');
  assert.equal(ear.frames[0].station?.nowPlaying?.startedAt, endsAt);
  radio.onModuleDestroy();
});

test('at boot a station catches up with the time it spent off, and saves where it landed', () => {
  const stations = new MemoryStations();
  const startedAt = T0 - radioTrackDuration(GYM) - 1_000;
  stations.byOwner.set('ana', Station.restore({ ownerId: 'ana', name: 'Radio', openedAt: startedAt, queue: ['title', 'town'], nowPlaying: { track: GYM, startedAt, endsAt: startedAt + radioTrackDuration(GYM) } }));
  const radio = new RadioService(stations, trainers);

  radio.onModuleInit();
  const station = radio.byOwner('ana');
  assert.equal(station.nowPlaying?.track, 'title');
  assert.equal(station.nowPlaying?.startedAt, startedAt + radioTrackDuration(GYM));
  assert.deepEqual(station.queue, ['town']);
  assert.deepEqual(stations.saved, ['ana']);
  radio.onModuleDestroy();
});

test('renaming a station that fell behind sends its listeners one frame, caught up and renamed', () => {
  const radio = new RadioService(new MemoryStations(), trainers);
  radio.open('ana', 'Radio');
  const endsAt = radio.setQueue('ana', [GYM, 'title'], null).nowPlaying!.endsAt;
  const ear = listener();
  radio.tune(ear, 'ana');
  radio.onModuleDestroy();
  ear.frames.length = 0;

  mock.timers.tick(endsAt - T0 + 1_000);
  radio.open('ana', 'Radio Johto');
  assert.equal(ear.frames.length, 1);
  assert.equal(ear.frames[0].station?.name, 'Radio Johto');
  assert.equal(ear.frames[0].station?.nowPlaying?.track, 'title');
  radio.onModuleDestroy();
});

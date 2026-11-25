import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { radioTrackDuration, type RadioTrackId } from '../../catalog/domain/radio-tracks.js';
import { now } from '../../shared/domain/clock.js';
import { notFound } from '../../shared/domain/errors.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { Station } from '../domain/station.js';
import { StationRepository } from '../domain/station.repository.js';
import { RadioListeners, type RadioListener } from './radio-listeners.js';
import { stationView, type StationView } from './station-view.js';

const NO_STATION = 'No tienes una estación abierta.';

@Injectable()
export class RadioService implements OnModuleInit, OnModuleDestroy {
  private readonly listeners = new RadioListeners();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly stations: StationRepository,
    private readonly trainers: TrainersService,
  ) {}

  onModuleInit(): void {
    for (const station of this.stations.all()) {
      if (station.advance(now(), radioTrackDuration)) this.stations.save(station);
      this.schedule(station);
    }
  }

  onModuleDestroy(): void {
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
  }

  list(): StationView[] {
    const oldestFirst = this.stations.all().sort((a, b) => a.openedAt - b.openedAt);
    for (const station of oldestFirst) this.settle(station);
    return oldestFirst.map((station) => this.view(station)).sort((a, b) => b.listeners - a.listeners);
  }

  byOwner(ownerId: string): StationView {
    const station = this.stations.findByOwner(ownerId);
    if (!station) throw notFound('Esa estación no existe.');
    this.settle(station);
    return this.view(station);
  }

  open(ownerId: string, name: string): StationView {
    const existing = this.stations.findByOwner(ownerId);
    if (!existing) return this.changed(Station.open(ownerId, name, now()));
    existing.rename(name);
    existing.advance(now(), radioTrackDuration);
    return this.changed(existing);
  }

  close(ownerId: string): void {
    if (!this.stations.findByOwner(ownerId)) return;
    this.stations.delete(ownerId);
    clearTimeout(this.timers.get(ownerId));
    this.timers.delete(ownerId);
    for (const listener of this.listeners.drop(ownerId)) if (listener.open) listener.send(this.frame(ownerId, null));
  }

  setQueue(ownerId: string, queue: readonly RadioTrackId[], playing: number | null): StationView {
    const at = now();
    const station = this.owned(ownerId, at);
    station.setQueue(queue, playing, at, radioTrackDuration);
    return this.changed(station);
  }

  skip(ownerId: string): StationView {
    const at = now();
    const station = this.owned(ownerId, at);
    station.skip(at, radioTrackDuration);
    return this.changed(station);
  }

  tune(listener: RadioListener, stationId: string | null): void {
    const station = stationId ? this.stations.findByOwner(stationId) : undefined;
    if (station) this.listeners.tuneIn(listener, station.ownerId);
    else this.listeners.tuneOut(listener);
    if (station && this.settle(station)) return;
    listener.send(this.frame(stationId, station ? this.view(station) : null));
  }

  disconnected(listener: RadioListener): void {
    this.listeners.tuneOut(listener);
  }

  private owned(ownerId: string, at: number): Station {
    const station = this.stations.findByOwner(ownerId);
    if (!station) throw notFound(NO_STATION);
    this.settle(station, at);
    return station;
  }

  private settle(station: Station, at = now()): boolean {
    const advanced = station.advance(at, radioTrackDuration);
    if (advanced) this.changed(station);
    return advanced;
  }

  private changed(station: Station): StationView {
    this.stations.save(station);
    this.schedule(station);
    return this.broadcast(station);
  }

  private schedule(station: Station): void {
    clearTimeout(this.timers.get(station.ownerId));
    this.timers.delete(station.ownerId);
    const at = station.nextChangeAt;
    if (at == null) return;
    const timer = setTimeout(() => {
      this.timers.delete(station.ownerId);
      if (!this.settle(station)) this.schedule(station);
    }, Math.max(0, at - now()));
    timer.unref();
    this.timers.set(station.ownerId, timer);
  }

  private broadcast(station: Station): StationView {
    const view = this.view(station);
    const frame = this.frame(station.ownerId, view);
    for (const listener of this.listeners.of(station.ownerId)) if (listener.open) listener.send(frame);
    return view;
  }

  private view(station: Station): StationView {
    return stationView(station, this.trainers.byId(station.ownerId)?.name ?? 'Entrenador', this.listeners.count(station.ownerId));
  }

  private frame(stationId: string | null, station: StationView | null) {
    return { t: 'radio', stationId, station, now: now() };
  }
}

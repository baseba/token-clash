// The radio's use cases: a trainer opens, renames and closes their station and edits its queue;
// anyone lists the stations and tunes in to one. Every read and write first catches the station up
// with its clock (Station.advance), so what a client gets is right whether or not a timer fired.
// The timers only push the next song to the listeners the moment it starts.
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

  /** Every station on air, the most listened first. */
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

  /** Opens the owner's station, or renames it if it is already open. */
  open(ownerId: string, name: string): StationView {
    const existing = this.stations.findByOwner(ownerId);
    if (!existing) return this.changed(Station.open(ownerId, name, now()));
    this.settle(existing);
    existing.rename(name);
    return this.changed(existing);
  }

  /** Closes the owner's station, if open: it is deleted and its listeners hear silence. */
  close(ownerId: string): void {
    if (!this.stations.findByOwner(ownerId)) return;
    this.stations.delete(ownerId);
    clearTimeout(this.timers.get(ownerId));
    this.timers.delete(ownerId);
    for (const listener of this.listeners.drop(ownerId)) if (listener.open) listener.send(this.frame(null));
  }

  setQueue(ownerId: string, queue: readonly RadioTrackId[]): StationView {
    const station = this.owned(ownerId);
    station.setQueue(queue, now(), radioTrackDuration);
    return this.changed(station);
  }

  skip(ownerId: string): StationView {
    const station = this.owned(ownerId);
    station.skip(now(), radioTrackDuration);
    return this.changed(station);
  }

  /**
   * Tunes a client in to a station (leaving the one it heard), or out with null. It gets the
   * station's frame back, with `station: null` if that station doesn't exist.
   */
  tune(listener: RadioListener, stationId: string | null): void {
    const station = stationId ? this.stations.findByOwner(stationId) : undefined;
    const left = station ? this.listeners.tuneIn(listener, station.ownerId) : this.listeners.tuneOut(listener);
    if (left && left !== station?.ownerId) this.broadcastListeners(left);
    if (!station) listener.send(this.frame(null));
    else if (!this.settle(station)) this.broadcast(station);
  }

  /** A client went away. */
  disconnected(listener: RadioListener): void {
    const left = this.listeners.tuneOut(listener);
    if (left) this.broadcastListeners(left);
  }

  private owned(ownerId: string): Station {
    const station = this.stations.findByOwner(ownerId);
    if (!station) throw notFound(NO_STATION);
    this.settle(station);
    return station;
  }

  /** Catches the station up with its clock. If a song changed, saves it and tells its listeners. */
  private settle(station: Station): boolean {
    const advanced = station.advance(now(), radioTrackDuration);
    if (advanced) this.changed(station);
    return advanced;
  }

  private changed(station: Station): StationView {
    this.stations.save(station);
    this.schedule(station);
    return this.broadcast(station);
  }

  // One timer per station, set to its next song change. setTimeout can fire a little early, so
  // when it does nothing has ended yet and it sets itself again.
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

  private broadcastListeners(stationId: string): void {
    const station = this.stations.findByOwner(stationId);
    if (station) this.broadcast(station);
  }

  private broadcast(station: Station): StationView {
    const view = this.view(station);
    const frame = this.frame(view);
    for (const listener of this.listeners.of(station.ownerId)) if (listener.open) listener.send(frame);
    return view;
  }

  private view(station: Station): StationView {
    return stationView(station, this.trainers.byId(station.ownerId)?.name ?? 'Entrenador', this.listeners.count(station.ownerId));
  }

  private frame(station: StationView | null) {
    return { t: 'radio', station, now: now() };
  }
}

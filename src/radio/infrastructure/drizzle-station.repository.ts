// Adapter: StationRepository on SQLite through Drizzle. An identity map like the others: loaded
// once, the same object handed out afterwards (a station's timer holds on to it), writes go through.
import { Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { eq } from 'drizzle-orm';
import type { Database } from '../../shared/infrastructure/database/database.js';
import type { Station } from '../domain/station.js';
import { StationRepository } from '../domain/station.repository.js';
import { stationToDomain, stationToRow } from './radio.mapper.js';
import { radioStations } from './radio.schema.js';

@Injectable()
export class DrizzleStationRepository extends StationRepository {
  private readonly byOwner = new Map<string, Station>();

  constructor(@InjectDrizzle() private readonly db: Database) {
    super();
    for (const row of this.db.select().from(radioStations).all()) this.byOwner.set(row.ownerId, stationToDomain(row));
  }

  all(): Station[] {
    return [...this.byOwner.values()];
  }

  findByOwner(ownerId: string): Station | undefined {
    return this.byOwner.get(ownerId);
  }

  save(station: Station): void {
    const row = stationToRow(station);
    this.db.insert(radioStations).values(row).onConflictDoUpdate({ target: radioStations.ownerId, set: row }).run();
    this.byOwner.set(station.ownerId, station);
  }

  delete(ownerId: string): void {
    this.db.delete(radioStations).where(eq(radioStations.ownerId, ownerId)).run();
    this.byOwner.delete(ownerId);
  }
}

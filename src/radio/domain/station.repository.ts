import type { Station } from './station.js';

export abstract class StationRepository {
  abstract all(): Station[];
  abstract findByOwner(ownerId: string): Station | undefined;
  abstract save(station: Station): void;
  abstract delete(ownerId: string): void;
}

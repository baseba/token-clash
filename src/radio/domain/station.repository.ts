import type { Station } from './station.js';

/** Port for radio stations. Implemented in infrastructure with Drizzle. */
export abstract class StationRepository {
  abstract all(): Station[];
  abstract findByOwner(ownerId: string): Station | undefined;
  abstract save(station: Station): void;
  abstract delete(ownerId: string): void;
}

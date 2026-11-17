// One-off migration from the JSON-file era: until v0.2 everything lived in data/db.json. On the
// first start with SQLite, its trainers, challenges and tournaments are copied into the database in
// a single transaction, using each context's own mappers (so the rows are exactly what the
// repositories would write).
//
// data/db.json is left untouched: it stays as a backup, and if a deploy rolls back to the previous
// image, that image still finds its data there.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LoggerService } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import { Challenge, type ChallengeState } from '../arena/domain/challenge.js';
import { Tournament, type TournamentState } from '../arena/domain/tournament.js';
import { challengeToRow, tournamentToRows } from '../arena/infrastructure/arena.mapper.js';
import { challenges, tournamentMatches, tournaments, tournamentSeats } from '../arena/infrastructure/arena.schema.js';
import type { Database } from '../shared/infrastructure/database/database.js';
import { appMeta } from '../shared/infrastructure/database/meta.schema.js';
import { Trainer, type TrainerState } from '../trainers/domain/trainer.js';
import { entryToRow, toRow } from '../trainers/infrastructure/trainer.mapper.js';
import { rosterEntries, trainers } from '../trainers/infrastructure/trainer.schema.js';

export const LEGACY_FILE = 'db.json';
const META_KEY = 'legacy_json_import';

/** Rooms older than modes or visibility have neither. */
type LegacyChallenge = Omit<ChallengeState, 'mode' | 'visibility'> & Partial<Pick<ChallengeState, 'mode' | 'visibility'>>;

interface LegacyDb {
  trainers?: Record<string, TrainerState>;
  challenges?: Record<string, LegacyChallenge>;
  tournaments?: Record<string, TournamentState>;
}

/** Those rooms were team battles, and private (link only). */
const withDefaults = (challenge: LegacyChallenge): ChallengeState => ({ ...challenge, mode: challenge.mode ?? 'team', visibility: challenge.visibility ?? 'private' });

export interface LegacyImportResult {
  imported: boolean;
  reason: string;
  trainers?: number;
  pokemon?: number;
  challenges?: number;
  tournaments?: number;
}

const chunks = <T>(list: T[], size = 100) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

export function importLegacyJson(db: Database, dataDir: string, log?: Pick<LoggerService, 'log' | 'warn'>): LegacyImportResult {
  const done = db.select().from(appMeta).where(eq(appMeta.key, META_KEY)).get();
  if (done) return { imported: false, reason: 'already-imported' };

  const file = join(dataDir, LEGACY_FILE);
  const mark = (value: object) => db.insert(appMeta).values({ key: META_KEY, value: { ...value, at: Date.now() } }).run();

  if (!existsSync(file)) {
    mark({ result: 'no-file' });
    return { imported: false, reason: 'no-file' };
  }
  const [{ trainerCount }] = db.select({ trainerCount: count() }).from(trainers).all();
  if (trainerCount > 0) {
    // Someone already has data in SQLite: never mix an old JSON into it.
    log?.warn(`Hay ${LEGACY_FILE} pero la base ya tiene datos: no lo importo.`);
    mark({ result: 'skipped-db-not-empty' });
    return { imported: false, reason: 'db-not-empty' };
  }

  const legacy = JSON.parse(readFileSync(file, 'utf8')) as LegacyDb;
  const ts = Object.values(legacy.trainers ?? {}).map((t) => Trainer.restore(t));
  const cs = Object.values(legacy.challenges ?? {}).map((c) => Challenge.restore(withDefaults(c)));
  const tours = Object.values(legacy.tournaments ?? {}).map((t) => Tournament.restore(t));
  const entries = ts.flatMap((t) => (t.roster ?? []).map((e, i) => entryToRow(t.id, e, i)));

  db.transaction((tx) => {
    for (const rows of chunks(ts.map(toRow))) tx.insert(trainers).values(rows).run();
    for (const rows of chunks(entries)) tx.insert(rosterEntries).values(rows).run();
    for (const rows of chunks(cs.map(challengeToRow))) tx.insert(challenges).values(rows).run();
    for (const tournament of tours) {
      const rows = tournamentToRows(tournament);
      tx.insert(tournaments).values(rows.tournament).run();
      if (rows.seats.length) tx.insert(tournamentSeats).values(rows.seats).run();
      if (rows.matches.length) tx.insert(tournamentMatches).values(rows.matches).run();
    }
    tx.insert(appMeta).values({ key: META_KEY, value: { result: 'imported', file, trainers: ts.length, pokemon: entries.length, challenges: cs.length, tournaments: tours.length, at: Date.now() } }).run();
  });

  const result = { imported: true, reason: 'imported', trainers: ts.length, pokemon: entries.length, challenges: cs.length, tournaments: tours.length };
  log?.log(`Importé ${LEGACY_FILE}: ${result.trainers} entrenadores, ${result.pokemon} Pokémon, ${result.challenges} desafíos y ${result.tournaments} torneos. El archivo queda como respaldo.`);
  return result;
}

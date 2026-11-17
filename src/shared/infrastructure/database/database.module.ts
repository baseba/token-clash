import { Global, Logger, Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { join } from 'node:path';
import { importLegacyJson } from '../../../legacy/legacy-json-import.js';
import { AppConfig } from '../../config/app-config.js';
import { DATABASE_FILE, openDatabase } from './database.js';

/**
 * Registers the Drizzle database for the whole app (inject it with @InjectDrizzle()). Only the
 * repositories in each context's infrastructure/ folder inject it: use cases and domain never do.
 */
@Global()
@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const db = openDatabase(join(config.dataDir, DATABASE_FILE));
        // Before any repository loads: bring in data/db.json from the JSON-file era, once.
        importLegacyJson(db, config.dataDir, new Logger('LegacyImport'));
        return { db };
      },
    }),
  ],
})
export class DatabaseModule {}

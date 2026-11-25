import { Global, Logger, Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { join } from 'node:path';
import { importLegacyJson } from '../../../legacy/legacy-json-import.js';
import { AppConfig } from '../../config/app-config.js';
import { DATABASE_FILE, openDatabase } from './database.js';

@Global()
@Module({
  imports: [
    DrizzleModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const db = openDatabase(join(config.dataDir, DATABASE_FILE));
        importLegacyJson(db, config.dataDir, new Logger('LegacyImport'));
        return { db };
      },
    }),
  ],
})
export class DatabaseModule {}

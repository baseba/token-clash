import { type DynamicModule, Module } from '@nestjs/common';
import { DrizzleModule } from '@nestjs/drizzle';
import { join } from 'node:path';
import { AppConfig } from '../config/app-config.js';
import { DATABASE_FILE, openDatabase, type Database } from './database.js';

@Module({})
export class DatabaseModule {
  static forRoot({ afterOpen }: { afterOpen: (db: Database, dataDir: string) => void }): DynamicModule {
    return {
      module: DatabaseModule,
      global: true,
      imports: [
        DrizzleModule.forRootAsync({
          inject: [AppConfig],
          useFactory: (config: AppConfig) => {
            const db = openDatabase(join(config.dataDir, DATABASE_FILE));
            afterOpen(db, config.dataDir);
            return { db };
          },
        }),
      ],
    };
  }
}

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: ['./src/trainers/infrastructure/trainer.schema.ts', './src/arena/infrastructure/arena.schema.ts', './src/radio/infrastructure/radio.schema.ts', './src/tower/infrastructure/tower.schema.ts', './src/shared/infrastructure/database/meta.schema.ts'],
  out: './drizzle',
  dbCredentials: { url: './data/token-clash.db' },
});

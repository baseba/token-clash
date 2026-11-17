// drizzle-kit reads the schema of every context and writes the SQL migrations to drizzle/
// (npm run db:generate after changing a *.schema.ts). The app applies them on startup.
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: ['./src/trainers/infrastructure/trainer.schema.ts', './src/arena/infrastructure/arena.schema.ts', './src/shared/infrastructure/database/meta.schema.ts'],
  out: './drizzle',
  dbCredentials: { url: './data/token-clash.db' },
});

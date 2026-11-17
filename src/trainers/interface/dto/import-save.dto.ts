import { z } from 'zod';

/**
 * POST /api/import. `save` is the exported file's text; reading it is the domain's job (parseSave),
 * which has its own messages for a file that isn't a PokeTokenBar save. The name is required only
 * the first time, which the use case knows.
 */
export const ImportSaveDto = z.object({
  save: z.string({ error: 'Falta el archivo.' }),
  name: z.string().optional(),
});
export type ImportSaveDto = z.infer<typeof ImportSaveDto>;

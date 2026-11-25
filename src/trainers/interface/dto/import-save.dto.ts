import { z } from 'zod';

export const ImportSaveDto = z.object({
  save: z.string({ error: 'Falta el archivo.' }),
  name: z.string().optional(),
  password: z.string().max(200).optional(),
});
export type ImportSaveDto = z.infer<typeof ImportSaveDto>;

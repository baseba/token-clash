import { z } from 'zod';

/** PUT /api/me/mons/:id: its moveset and/or its ability. Whether it may use them is a domain rule. */
export const UpdateMonDto = z.object({
  moves: z.array(z.string()).optional(),
  ability: z.string().optional(),
});
export type UpdateMonDto = z.infer<typeof UpdateMonDto>;

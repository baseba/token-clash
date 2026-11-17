import { z } from 'zod';

/** POST /api/tournaments/:id/ready. Without a body it means "ready". */
export const SetReadyDto = z.object({ ready: z.boolean().default(true) });
export type SetReadyDto = z.infer<typeof SetReadyDto>;

/** POST /api/tournaments/:id/ai: the host fills seats with AIs. The level is checked by the use case (it depends on Skynet). */
export const AddAisDto = z.object({
  level: z.string(),
  count: z.int().min(1).default(1),
});
export type AddAisDto = z.infer<typeof AddAisDto>;

import { z } from 'zod';

export const SetReadyDto = z.object({ ready: z.boolean().default(true) });
export type SetReadyDto = z.infer<typeof SetReadyDto>;

export const AddAisDto = z.object({
  level: z.string(),
  count: z.int().min(1).default(1),
});
export type AddAisDto = z.infer<typeof AddAisDto>;

import { z } from 'zod';

export const HistoryQueryDto = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type HistoryQueryDto = z.infer<typeof HistoryQueryDto>;

import { z } from 'zod';

/** GET /api/me/challenges?offset=&limit=: one page of your history. Query values arrive as text. */
export const HistoryQueryDto = z.object({
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(30),
});
export type HistoryQueryDto = z.infer<typeof HistoryQueryDto>;

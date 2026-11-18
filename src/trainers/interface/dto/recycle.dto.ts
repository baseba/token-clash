import { z } from 'zod';

export const RecycleDto = z.object({ entry: z.string().min(1).max(100) });
export type RecycleDto = z.infer<typeof RecycleDto>;

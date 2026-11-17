import { z } from 'zod';

export const ChooseLookDto = z.object({ avatar: z.string() });
export type ChooseLookDto = z.infer<typeof ChooseLookDto>;

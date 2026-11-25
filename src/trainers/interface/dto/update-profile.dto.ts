import { z } from 'zod';

export const UpdateProfileDto = z.object({
  name: z.string().optional(),
  team: z.array(z.string()).optional(),
  nickname: z.object({ id: z.string(), name: z.string() }).nullish(),
});
export type UpdateProfileDto = z.infer<typeof UpdateProfileDto>;

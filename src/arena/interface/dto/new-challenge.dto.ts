import { z } from 'zod';
import { BATTLE_MODES, VISIBILITIES } from '../../domain/challenge.js';

export const NewChallengeDto = z.object({
  mode: z.enum(BATTLE_MODES).default('team'),
  visibility: z.enum(VISIBILITIES).default('public'),
  ai: z.string().optional(),
});
export type NewChallengeDto = z.infer<typeof NewChallengeDto>;

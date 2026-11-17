import { z } from 'zod';
import { BATTLE_MODES, LEVEL_CAP, VISIBILITIES } from '../../domain/challenge.js';

/** POST /api/challenges: "new battle". Whatever is missing takes the default the home screen starts with. */
export const NewChallengeDto = z.object({
  mode: z.enum(BATTLE_MODES).default('team'),
  levelCap: z.literal(LEVEL_CAP).nullable().default(null),
  visibility: z.enum(VISIBILITIES).default('public'),
  /** Against the AI: its difficulty. Which levels exist depends on the server (Skynet), so the use case checks it. */
  ai: z.string().optional(),
});
export type NewChallengeDto = z.infer<typeof NewChallengeDto>;

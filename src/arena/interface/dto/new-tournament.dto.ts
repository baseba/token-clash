import { z } from 'zod';
import { BATTLE_MODES, LEVEL_CAP, VISIBILITIES } from '../../domain/challenge.js';
import { TOURNAMENT_SIZES } from '../../domain/tournament.js';

/** POST /api/tournaments. */
export const NewTournamentDto = z.object({
  mode: z.enum(BATTLE_MODES).default('team'),
  levelCap: z.literal(LEVEL_CAP).nullable().default(null),
  size: z.literal(TOURNAMENT_SIZES).default(8),
  visibility: z.enum(VISIBILITIES).default('public'),
});
export type NewTournamentDto = z.infer<typeof NewTournamentDto>;

import { z } from 'zod';
import { BATTLE_MODES, VISIBILITIES } from '../../domain/challenge.js';
import { TOURNAMENT_SIZES } from '../../domain/tournament.js';

export const NewTournamentDto = z.object({
  mode: z.enum(BATTLE_MODES).default('team'),
  size: z.literal(TOURNAMENT_SIZES).default(8),
  visibility: z.enum(VISIBILITIES).default('public'),
});
export type NewTournamentDto = z.infer<typeof NewTournamentDto>;

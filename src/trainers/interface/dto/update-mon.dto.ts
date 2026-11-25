import { z } from 'zod';
import { NATURE_KEYS } from '../../../catalog/domain/creatures.js';
import { MAX_EV } from '../../../../public/stat-formula.js';

const statSpread = (max: number) => z.object({ hp: z.int().min(0).max(max), atk: z.int().min(0).max(max), def: z.int().min(0).max(max), satk: z.int().min(0).max(max), sdef: z.int().min(0).max(max), spd: z.int().min(0).max(max) });

export const UpdateMonDto = z.object({
  moves: z.array(z.string()).optional(),
  ability: z.string().optional(),
  nature: z.enum(NATURE_KEYS).optional(),
  evs: statSpread(MAX_EV).optional(),
});
export type UpdateMonDto = z.infer<typeof UpdateMonDto>;

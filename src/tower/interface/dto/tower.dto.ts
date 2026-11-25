import { z } from 'zod';
import { ROOM_KINDS, TOWER_LENGTHS } from '../../../catalog/domain/tower-cast.js';

const LENGTHS = TOWER_LENGTHS.filter((length): length is number => length !== null);

export const NewClimbDto = z.object({
  difficulty: z.string(),
  length: z
    .number()
    .int()
    .refine((length) => LENGTHS.includes(length), 'Ese largo de torre no existe.')
    .nullable()
    .default(null),
});
export type NewClimbDto = z.infer<typeof NewClimbDto>;

export const DraftDto = z.object({ offers: z.array(z.string().min(1)).min(1).max(6) });
export type DraftDto = z.infer<typeof DraftDto>;

export const RewardDto = z.object({
  reward: z.string().min(1),
  uid: z.string().min(1),
  replace: z.string().min(1).nullable().default(null),
  ability: z.string().min(1).nullable().default(null),
  nature: z.string().min(1).nullable().default(null),
});
export type RewardDto = z.infer<typeof RewardDto>;

export const RecruitDto = z.object({ offer: z.string().min(1), release: z.string().min(1).nullable().default(null) });
export type RecruitDto = z.infer<typeof RecruitDto>;

export const EditMonDto = z.object({ moves: z.array(z.string().min(1)).min(1).max(4).optional(), ability: z.string().min(1).nullable().optional() });
export type EditMonDto = z.infer<typeof EditMonDto>;

export const RoomDto = z.object({ room: z.enum(ROOM_KINDS), release: z.string().min(1).nullable().default(null) });
export type RoomDto = z.infer<typeof RoomDto>;

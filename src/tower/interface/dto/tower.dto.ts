import { z } from 'zod';
import { ROOM_KINDS, TOWER_LENGTHS } from '../../../catalog/domain/tower-cast.js';

const LENGTHS = TOWER_LENGTHS.filter((length): length is number => length !== null);

/** POST /api/tower: a new climb. No length means an endless one. */
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

/** POST /api/tower/draft: the offers taken as the first team. */
export const DraftDto = z.object({ offers: z.array(z.string().min(1)).min(1).max(6) });
export type DraftDto = z.infer<typeof DraftDto>;

/** POST /api/tower/reward: the reward kept, who takes it and what it changes. */
export const RewardDto = z.object({
  reward: z.string().min(1),
  uid: z.string().min(1),
  replace: z.string().min(1).nullable().default(null),
  ability: z.string().min(1).nullable().default(null),
  nature: z.string().min(1).nullable().default(null),
});
export type RewardDto = z.infer<typeof RewardDto>;

/** POST /api/tower/recruit: the offer taken and, with a full party, who leaves. */
export const RecruitDto = z.object({ offer: z.string().min(1), release: z.string().min(1).nullable().default(null) });
export type RecruitDto = z.infer<typeof RecruitDto>;

/** PUT /api/tower/party/:uid: the moves and ability it takes to battle. */
export const EditMonDto = z.object({ moves: z.array(z.string().min(1)).min(1).max(4).optional(), ability: z.string().min(1).nullable().optional() });
export type EditMonDto = z.infer<typeof EditMonDto>;

/** POST /api/tower/room: the way taken on a plain floor and, for a dark deal, who you give. */
export const RoomDto = z.object({ room: z.enum(ROOM_KINDS), release: z.string().min(1).nullable().default(null) });
export type RoomDto = z.infer<typeof RoomDto>;

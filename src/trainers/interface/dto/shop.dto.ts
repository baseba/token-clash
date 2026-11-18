import { z } from 'zod';
import { EQUIP_KINDS } from '../../domain/trainer.js';

export const BuyDto = z.object({ item: z.string() });
export type BuyDto = z.infer<typeof BuyDto>;

export const EquipDto = z.object({ kind: z.enum(EQUIP_KINDS), key: z.string().nullable() });
export type EquipDto = z.infer<typeof EquipDto>;

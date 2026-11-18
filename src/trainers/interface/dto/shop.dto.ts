import { z } from 'zod';

export const BuyDto = z.object({ item: z.string() });
export type BuyDto = z.infer<typeof BuyDto>;

export const EquipDto = z.object({ kind: z.enum(['ball', 'window', 'frame']), key: z.string().nullable() });
export type EquipDto = z.infer<typeof EquipDto>;

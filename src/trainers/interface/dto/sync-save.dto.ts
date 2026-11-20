import { z } from 'zod';

export const SyncSaveDto = z.record(z.string(), z.unknown(), { error: 'El cuerpo tiene que ser el archivo de PokeTokenBar.' });
export type SyncSaveDto = z.infer<typeof SyncSaveDto>;

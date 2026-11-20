import { z } from 'zod';

export const LogInDto = z.object({
  name: z.string({ error: 'Escribe tu nombre de entrenador.' }).max(100),
  password: z.string({ error: 'Escribe tu contraseña.' }).max(200),
});
export type LogInDto = z.infer<typeof LogInDto>;

export const SetPasswordDto = z.object({
  password: z.string({ error: 'Elige una contraseña.' }).max(200),
  currentPassword: z.string().max(200).optional(),
});
export type SetPasswordDto = z.infer<typeof SetPasswordDto>;

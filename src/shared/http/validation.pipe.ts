// Validation of what comes in over HTTP. Each controller declares the shape of its input with a
// Zod schema (the DTOs in */interface/dto/) and Nest's StandardSchemaValidationPipe checks it before
// the handler runs: the handler gets typed, already-defaulted values, or the request is answered
// with 400 and the first problem found. Shape only (types, allowed values, defaults): whether a
// Pokémon knows a move or a tournament has room is still decided by the domain.
import { StandardSchemaValidationPipe } from '@nestjs/common';
import { z } from 'zod';
import { invalid } from '../domain/errors.js';

// Zod's own messages, in Spanish and naming the field ("mode: Opción inválida…"). A schema that
// sets its own message (`{ error: 'Falta el archivo.' }`) is shown as written: it's for the player.
const spanish = z.locales.es().localeError;
z.config({
  localeError: (issue) => {
    const text = spanish(issue);
    const message = typeof text === 'string' ? text : text?.message;
    return issue.path?.length ? `${issue.path.join('.')}: ${message}` : message;
  },
});

export function validationPipe(): StandardSchemaValidationPipe {
  return new StandardSchemaValidationPipe({
    exceptionFactory: ([issue]) => invalid(issue?.message ?? 'Datos inválidos.'),
  });
}

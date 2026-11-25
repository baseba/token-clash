import { StandardSchemaValidationPipe } from '@nestjs/common';
import { z } from 'zod';
import { invalid } from '../domain/errors.js';

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

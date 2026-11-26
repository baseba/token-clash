import type { NextFunction, Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { HttpError } from './http-error.js';

const MAX_BODY_MB = 9;

function explainBodyErrors(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.too.large') return next(new HttpError(413, `El archivo es demasiado grande (máx. ${MAX_BODY_MB} MB).`));
  if (type === 'entity.parse.failed') return next(new HttpError(400, 'JSON inválido'));
  next(err);
}

export function useJsonBody(app: NestExpressApplication): void {
  app.useBodyParser('json', { limit: `${MAX_BODY_MB}mb`, type: () => true });
  app.use(explainBodyErrors);
  app.use((req: { body?: unknown }, _res: unknown, next: () => void) => {
    req.body ??= {};
    next();
  });
}

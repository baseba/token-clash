// Every request body is JSON. This file holds its size limit and how the parser's own failures
// read to the player. Nest 12 turns a parser error into a generic HttpException ("request entity
// too large", "Bad Request") before any filter sees it, so they are translated right after the
// parser, while the error still says what went wrong (`type`).
import type { NextFunction, Request, Response } from 'express';
import { HttpError } from './http-error.js';

/**
 * The largest body the API reads. A save export is a few hundred KB; the browser already refuses
 * files over 8 MB, and the extra MB covers the JSON escaping of the file's text.
 */
export const MAX_BODY_MB = 9;

/** Express error middleware: goes right after the JSON parser. */
export function explainBodyErrors(err: unknown, _req: Request, _res: Response, next: NextFunction): void {
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.too.large') return next(new HttpError(413, `El archivo es demasiado grande (máx. ${MAX_BODY_MB} MB).`));
  if (type === 'entity.parse.failed') return next(new HttpError(400, 'JSON inválido'));
  next(err);
}

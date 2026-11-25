import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger, NotFoundException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { DomainError, type DomainErrorKind } from '../domain/errors.js';

const STATUS: Record<DomainErrorKind, number> = { invalid: 400, forbidden: 403, 'not-found': 404, conflict: 409, gone: 410, unavailable: 503 };

@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger('HTTP');

  catch(err: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    if (res.headersSent) return;
    const api = req.path.startsWith('/api/');
    const reply = (status: number, error: string) => (api ? res.status(status).json({ error }) : res.status(status).type('text/plain; charset=utf-8').send(error));

    if (err instanceof DomainError) return void reply(STATUS[err.kind], err.message);
    if (err instanceof NotFoundException) {
      if (api) return void reply(404, 'No encontrado');
      return void reply(req.method === 'GET' || req.method === 'HEAD' ? 404 : 405, req.method === 'GET' || req.method === 'HEAD' ? 'not found' : 'method not allowed');
    }
    if (err instanceof HttpException) {
      const body = err.getResponse();
      return void reply(err.getStatus(), typeof body === 'object' && body && 'error' in body ? String((body as { error: unknown }).error) : err.message);
    }
    this.logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    reply(500, 'Error interno');
  }
}

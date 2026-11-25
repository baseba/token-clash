import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppConfig } from '../config/app-config.js';
import { clientIp } from './client-ip.js';
import { RateLimiter } from './rate-limiter.js';

@Injectable()
export class ApiProtectionMiddleware implements NestMiddleware {
  constructor(
    private readonly config: AppConfig,
    private readonly limiter: RateLimiter,
  ) {}

  use(req: Request, res: Response, next: NextFunction): void {
    if (req.method !== 'GET' && !this.originOk(req.headers.origin)) {
      res.status(403).json({ error: 'Origen no permitido' });
      return;
    }
    if (this.limiter.limited(`api:${clientIp(req, this.config.trustCfConnectingIp)}`, 300, 60_000)) {
      res.status(429).json({ error: 'Demasiadas solicitudes, espera un momento.' });
      return;
    }
    next();
  }

  originOk(origin: string | undefined): boolean {
    return !this.config.publicOrigin || !origin || origin === this.config.publicOrigin;
  }
}

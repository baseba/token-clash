// @RateLimit(): per-route limits on top of the global one (imports, creating rooms…). Counted by
// IP, or by trainer for routes that already have a session (put it after @Authenticated()).
import { applyDecorators, CanActivate, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AppConfig } from '../config/app-config.js';
import { clientIp } from './client-ip.js';
import { HttpError } from './http-error.js';
import { RateLimiter } from './rate-limiter.js';

interface Limit {
  bucket: string;
  by: 'ip' | 'trainer';
  max: number;
  windowMs: number;
  message: string;
}

const RATE_LIMIT = 'rate-limit';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly limiter: RateLimiter,
    private readonly config: AppConfig,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const limit = this.reflector.get<Limit>(RATE_LIMIT, context.getHandler());
    if (!limit) return true;
    const req = context.switchToHttp().getRequest<Request & { trainer?: { id: string } }>();
    const who = limit.by === 'trainer' ? req.trainer?.id : clientIp(req, this.config.trustCfConnectingIp);
    if (who && this.limiter.limited(`${limit.bucket}:${who}`, limit.max, limit.windowMs)) throw new HttpError(429, limit.message);
    return true;
  }
}

export const RateLimit = (limit: Limit) => applyDecorators(SetMetadata(RATE_LIMIT, limit), UseGuards(RateLimitGuard));

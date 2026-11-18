import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ASSET_ORIGINS } from '../../../public/upstream.js';

// The browser loads sprites, cries, sounds and music from upstream CDNs (public/upstream.js):
// images and fetches only, nothing that runs.
const UPSTREAM_ASSETS = ASSET_ORIGINS.join(' ');

export const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': `default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: ${UPSTREAM_ASSETS}; connect-src 'self' ${UPSTREAM_ASSETS}; font-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`,
};

/** Every response gets the security headers, and nothing is cached unless a handler says so. */
@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.set({ ...SECURITY_HEADERS, 'Cache-Control': 'no-store' });
    next();
  }
}

import { Global, Module } from '@nestjs/common';
import { RateLimiter } from './rate-limiter.js';

/** Shared HTTP plumbing (the rate limiter behind the API middleware and @RateLimit()). */
@Global()
@Module({ providers: [RateLimiter], exports: [RateLimiter] })
export class HttpModule {}

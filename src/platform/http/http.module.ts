import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ApiProtectionMiddleware } from './api-protection.middleware.js';
import { DeployVersion } from './deploy-version.js';
import { DomainErrorFilter } from './domain-error.filter.js';
import { RateLimiter } from './rate-limiter.js';
import { SecurityHeadersMiddleware } from './security-headers.middleware.js';
import { validationPipe } from './validation.pipe.js';

@Global()
@Module({
  providers: [RateLimiter, DeployVersion, { provide: APP_FILTER, useClass: DomainErrorFilter }, { provide: APP_PIPE, useFactory: validationPipe }],
  exports: [RateLimiter, DeployVersion],
})
export class HttpModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('{*path}');
    consumer.apply(ApiProtectionMiddleware).forRoutes('api/{*path}');
  }
}

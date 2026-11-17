import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { AppConfig } from '../config/app-config.js';
import { HttpError } from './http-error.js';
import { RateLimitGuard } from './rate-limit.guard.js';
import { RateLimiter } from './rate-limiter.js';

const byTrainer = { bucket: 'b', by: 'trainer' as const, max: 1, windowMs: 60_000, message: 'Para.' };

function guarded(req: object) {
  const reflector = { get: () => byTrainer } as unknown as Reflector;
  const limiter = new RateLimiter();
  const guard = new RateLimitGuard(reflector, limiter, AppConfig.fromEnv({}));
  class SomeController {
    route() {}
  }
  const context = { getHandler: () => SomeController.prototype.route, getClass: () => SomeController, switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext;
  return { check: () => guard.canActivate(context), stop: () => limiter.onModuleDestroy() };
}

test('a limit by trainer counts each trainer on their own', () => {
  const { check, stop } = guarded({ trainer: { id: 'ana' } });
  assert.equal(check(), true);
  assert.throws(check, (e) => e instanceof HttpError && e.getStatus() === 429);
  stop();
});

test('a limit by trainer without a session fails loudly instead of letting everyone through', () => {
  const { check, stop } = guarded({});
  assert.throws(check, /SomeController\.route ran without a session/);
  stop();
});

// Sessions: a trainer is whoever owns the Bearer token. Routes declare what they need with the
// @Authenticated() decorator; the guard resolves the trainer and leaves it on the request, where
// @CurrentTrainer() picks it up. Controllers never parse headers themselves.
import { applyDecorators, CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { HttpError } from '../../shared/http/http-error.js';
import { TrainersService } from '../application/trainers.service.js';
import type { Trainer } from '../domain/trainer.js';

const SESSION = 'session';

interface SessionOptions {
  /** Without a session: answer 401 with this message, or let it through when optional. */
  required?: string;
  optional?: boolean;
}

type WithTrainer = Request & { trainer?: Trainer };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly trainers: TrainersService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const opts = this.reflector.getAllAndOverride<SessionOptions>(SESSION, [context.getHandler(), context.getClass()]) ?? { required: 'Sin sesión' };
    const req = context.switchToHttp().getRequest<WithTrainer>();
    req.trainer = this.trainers.authenticateHeader(req.headers.authorization);
    if (!req.trainer && !opts.optional) throw new HttpError(401, opts.required ?? 'Sin sesión');
    return true;
  }
}

/** The route needs a session (401 with `message` without one). */
export const Authenticated = (message = 'Sin sesión') => applyDecorators(SetMetadata(SESSION, { required: message } satisfies SessionOptions), UseGuards(SessionGuard));

/** The route works without a session, but uses it when there is one. */
export const MaybeAuthenticated = () => applyDecorators(SetMetadata(SESSION, { optional: true } satisfies SessionOptions), UseGuards(SessionGuard));

/** The trainer of the session (undefined on @MaybeAuthenticated routes without one). */
export const CurrentTrainer = createParamDecorator((_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<WithTrainer>().trainer);

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

/** What a route needs: a session (401 with `message` without one), or nothing. */
type SessionRule = { required: true; message: string } | { required: false };

const NO_SESSION = 'Sin sesión';

type WithTrainer = Request & { trainer?: Trainer };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly trainers: TrainersService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<SessionRule>(SESSION, [context.getHandler(), context.getClass()]) ?? { required: true, message: NO_SESSION };
    const req = context.switchToHttp().getRequest<WithTrainer>();
    req.trainer = this.trainers.authenticateHeader(req.headers.authorization);
    if (!req.trainer && rule.required) throw new HttpError(401, rule.message);
    return true;
  }
}

/** The route needs a session (401 with `message` without one). */
export const Authenticated = (message = NO_SESSION) => applyDecorators(SetMetadata(SESSION, { required: true, message } satisfies SessionRule), UseGuards(SessionGuard));

/** The route works without a session, but uses it when there is one. */
export const MaybeAuthenticated = () => applyDecorators(SetMetadata(SESSION, { required: false } satisfies SessionRule), UseGuards(SessionGuard));

/** The trainer of the session (undefined on @MaybeAuthenticated routes without one). */
export const CurrentTrainer = createParamDecorator((_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<WithTrainer>().trainer);

import { applyDecorators, CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { HttpError } from '../../shared/http/http-error.js';
import { bearerToken } from '../application/auth-headers.js';
import { AccountsService } from '../application/accounts.service.js';
import type { Trainer } from '../domain/trainer.js';

const SESSION = 'session';

type SessionRule = { required: true; message: string } | { required: false };

const NO_SESSION = 'Sin sesión';

type WithTrainer = Request & { trainer?: Trainer; sessionToken?: string };

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly accounts: AccountsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const rule = this.reflector.getAllAndOverride<SessionRule>(SESSION, [context.getHandler(), context.getClass()]) ?? { required: true, message: NO_SESSION };
    const req = context.switchToHttp().getRequest<WithTrainer>();
    req.trainer = this.accounts.authenticateHeader(req.headers.authorization);
    req.sessionToken = req.trainer ? bearerToken(req.headers.authorization) : undefined;
    if (!req.trainer && rule.required) throw new HttpError(401, rule.message);
    return true;
  }
}

export const Authenticated = (message = NO_SESSION) => applyDecorators(SetMetadata(SESSION, { required: true, message } satisfies SessionRule), UseGuards(SessionGuard));

export const MaybeAuthenticated = () => applyDecorators(SetMetadata(SESSION, { required: false } satisfies SessionRule), UseGuards(SessionGuard));

export const CurrentTrainer = createParamDecorator((_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<WithTrainer>().trainer);

export const CurrentSessionToken = createParamDecorator((_: unknown, context: ExecutionContext) => context.switchToHttp().getRequest<WithTrainer>().sessionToken);

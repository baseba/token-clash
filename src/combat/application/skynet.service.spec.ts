import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppConfig } from '../../shared/config/app-config.js';
import { DomainError } from '../../shared/domain/errors.js';
import { SkynetService } from './skynet.service.js';

const kind = (k: string) => (e: unknown) => e instanceof DomainError && e.kind === k;

test('every AI difficulty is offered when Jev is reachable', () => {
  const skynet: SkynetService = new SkynetService(AppConfig.fromEnv({ JEV_API_URL: 'http://jev:8081/v1/systemone' }));
  for (const level of ['easy', 'mid', 'hard', 'veryhard', 'skynet']) skynet.assertOffered(level);
});

test('without Jev, Skynet is unavailable and an unknown level is invalid', () => {
  const skynet: SkynetService = new SkynetService(AppConfig.fromEnv({}));
  skynet.assertOffered('hard');
  assert.throws(() => skynet.assertOffered('skynet'), kind('unavailable'));
  assert.throws(() => skynet.assertOffered('godlike'), kind('invalid'));
});

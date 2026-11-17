import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppConfig } from './app-config.js';

test('without variables the server runs with the production defaults', () => {
  const config = AppConfig.fromEnv({});
  assert.equal(config.port, 8080);
  assert.equal(config.publicOrigin, '');
  assert.equal(config.trustCfConnectingIp, false);
  assert.equal(config.timings.turnLimitMs, 60_000);
  assert.equal(config.timings.countdownMs, 5_000);
});

test('an empty variable counts as unset', () => {
  const config = AppConfig.fromEnv({ PORT: '', TURN_MS: '', JEV_API_KEY: '' });
  assert.equal(config.port, 8080);
  assert.equal(config.timings.turnLimitMs, 60_000);
  assert.equal(config.jev.enabled, false);
});

test('each timing comes from its own variable', () => {
  const config = AppConfig.fromEnv({ TURN_MS: '1500', MATCH_MS: '300', ROLL_MS: '0', ARRIVAL_MS: '0' });
  assert.equal(config.timings.turnLimitMs, 1500);
  assert.equal(config.timings.countdownMs, 300);
  assert.equal(config.timings.diceRollBonusMs, 0);
  assert.equal(config.timings.arrivalWaitMs, 0);
});

test('Skynet is on with a key or a proxy URL, off with neither', () => {
  assert.equal(AppConfig.fromEnv({}).jev.enabled, false);
  assert.equal(AppConfig.fromEnv({ JEV_API_KEY: 'k' }).jev.enabled, true);
  assert.equal(AppConfig.fromEnv({ JEV_API_URL: 'http://token-clash-jev:8081/v1/systemone' }).jev.enabled, true);
});

test('a value that does not parse stops the server, naming the variable', () => {
  assert.throws(() => AppConfig.fromEnv({ TURN_MS: '60s' }), /TURN_MS="60s"/);
  assert.throws(() => AppConfig.fromEnv({ PORT: '-1' }), /PORT="-1"/);
  assert.throws(() => AppConfig.fromEnv({ TRUST_CF_CONNECTING_IP: 'yes' }), /TRUST_CF_CONNECTING_IP="yes"/);
  assert.throws(() => AppConfig.fromEnv({ PUBLIC_ORIGIN: 'https://clash.example.com/' }), /PUBLIC_ORIGIN/);
});

test('every wrong variable is reported at once', () => {
  assert.throws(() => AppConfig.fromEnv({ TURN_MS: 'x', MATCH_MS: 'y' }), (e: Error) => e.message.includes('TURN_MS') && e.message.includes('MATCH_MS'));
});

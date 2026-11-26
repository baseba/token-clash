import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeployVersion } from './deploy-version.js';

test('the deploy version is ten hex characters, the same for every reader of the same files', () => {
  const version = new DeployVersion().value;
  assert.match(version, /^[0-9a-f]{10}$/);
  assert.equal(new DeployVersion().value, version);
});

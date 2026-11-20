import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkPassword, hashPassword, passwordMatches, PASSWORD_MIN_LENGTH } from './credentials.js';

test('a password needs a minimum length', () => {
  assert.throws(() => checkPassword('x'.repeat(PASSWORD_MIN_LENGTH - 1)), /al menos/);
  assert.doesNotThrow(() => checkPassword('x'.repeat(PASSWORD_MIN_LENGTH)));
  assert.throws(() => checkPassword('x'.repeat(500)), /hasta/);
});

test('a stored password matches only the same password, and never stores it in clear', () => {
  const stored = hashPassword('pikachu-123');
  assert.ok(!stored.includes('pikachu'));
  assert.ok(passwordMatches('pikachu-123', stored));
  assert.ok(!passwordMatches('pikachu-124', stored));
  assert.notEqual(hashPassword('pikachu-123'), stored, 'each hash gets its own salt');
  assert.equal(hashPassword('pikachu-123', Buffer.alloc(16)), hashPassword('pikachu-123', Buffer.alloc(16)));
});

test('a malformed stored hash never matches', () => {
  assert.ok(!passwordMatches('pikachu-123', 'plain-text'));
  assert.ok(!passwordMatches('pikachu-123', 'scrypt$$'));
});

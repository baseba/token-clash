import { test } from 'node:test';
import assert from 'node:assert/strict';
import { basicCredentials, bearerToken } from './auth-headers.js';

const basic = (text: string) => `Basic ${Buffer.from(text, 'utf8').toString('base64')}`;

test('a session token comes only from a well-formed Bearer header', () => {
  assert.equal(bearerToken('Bearer pruebaPruebaPruebaPrueba1234'), 'pruebaPruebaPruebaPrueba1234');
  assert.equal(bearerToken('Bearer corto'), undefined);
  assert.equal(bearerToken(undefined), undefined);
});

test('Basic credentials split at the first colon, so the password may contain colons', () => {
  assert.deepEqual(basicCredentials(basic('Ñandú Ketchum:a:b:c')), { name: 'Ñandú Ketchum', password: 'a:b:c' });
  assert.equal(basicCredentials(basic(':sin-nombre')), undefined);
  assert.equal(basicCredentials(basic('sin-contraseña')), undefined);
  assert.equal(basicCredentials('Bearer pruebaPruebaPruebaPrueba1234'), undefined);
  assert.equal(basicCredentials(undefined), undefined);
});

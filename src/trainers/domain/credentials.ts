import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { invalid } from '../../shared/domain/errors.js';

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 128;
const KEY_LENGTH = 32;
const SALT_BYTES = 16;

/** @throws {DomainError} the password is too short or too long */
export function checkPassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) throw invalid(`La contraseña necesita al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  if (password.length > PASSWORD_MAX_LENGTH) throw invalid(`La contraseña puede tener hasta ${PASSWORD_MAX_LENGTH} caracteres.`);
}

export function hashPassword(password: string, salt: Buffer = randomBytes(SALT_BYTES)): string {
  return `scrypt$${salt.toString('base64url')}$${scryptSync(password, salt, KEY_LENGTH).toString('base64url')}`;
}

export function passwordMatches(password: string, stored: string): boolean {
  const [scheme, salt, key] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !key) return false;
  const expected = Buffer.from(key, 'base64url');
  const actual = scryptSync(password, Buffer.from(salt, 'base64url'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

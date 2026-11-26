import { randomBytes } from 'node:crypto';

export const now = () => Date.now();

export const newId = () => randomBytes(6).toString('base64url');

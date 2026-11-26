import { createHash, randomBytes } from 'node:crypto';

export const newToken = () => randomBytes(24).toString('base64url');

export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

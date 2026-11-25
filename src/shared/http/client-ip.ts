import type { IncomingMessage } from 'node:http';

export function clientIp(req: IncomingMessage, trustCf: boolean): string {
  const cf = req.headers['cf-connecting-ip'];
  if (trustCf && cf) return String(cf);
  return req.socket.remoteAddress || 'unknown';
}

export const isLoopback = (req: IncomingMessage) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress ?? '');

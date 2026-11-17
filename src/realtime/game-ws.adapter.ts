// The WebSocket adapter: Nest's WsAdapter (the `ws` library) with two additions for our protocol.
// - Messages are `{ "t": "<type>", ...fields }`, so the parser routes them by `t` to the gateway's
//   @SubscribeMessage('<type>') handlers. Anything that isn't such an object is dropped.
// - Before the handshake, ConnectionLimits checks the origin and the per-IP cap (403 otherwise).
import type { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import type { IncomingMessage } from 'node:http';
import { ConnectionLimits } from './connection-limits.js';

export class GameWsAdapter extends WsAdapter {
  private readonly limits: ConnectionLimits;

  constructor(app: INestApplicationContext) {
    super(app, {
      messageParser: (data: unknown) => {
        try {
          const msg = JSON.parse(String(data));
          return msg && typeof msg === 'object' && typeof msg.t === 'string' ? { event: msg.t, data: msg } : undefined;
        } catch {
          return undefined;
        }
      },
    });
    this.limits = app.get(ConnectionLimits);
  }

  override create(port: number, options?: Record<string, unknown>) {
    return super.create(port, {
      ...options,
      verifyClient: (info: { req: IncomingMessage }, done: (ok: boolean, code?: number) => void) => done(this.limits.allows(info.req), 403),
    });
  }
}

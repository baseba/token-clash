// The WebSocket adapter: Nest's WsAdapter (the `ws` library) with two additions for our protocol.
// - Each frame is parsed against ClientMessage (client-messages.ts) and routed by its `t` to the
//   gateway's @SubscribeMessage('<t>') handler. Anything else is dropped.
// - Before the handshake, ConnectionLimits checks the origin and the per-IP cap (403 otherwise).
import type { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import type { IncomingMessage } from 'node:http';
import { parseClientMessage } from './client-messages.js';
import { ConnectionLimits } from './connection-limits.js';

export class GameWsAdapter extends WsAdapter {
  private readonly limits: ConnectionLimits;

  constructor(app: INestApplicationContext) {
    super(app, { messageParser: (data: unknown) => parseClientMessage(String(data)) });
    this.limits = app.get(ConnectionLimits);
  }

  override create(port: number, options?: Record<string, unknown>) {
    return super.create(port, {
      ...options,
      verifyClient: (info: { req: IncomingMessage }, done: (ok: boolean, code?: number) => void) => done(this.limits.allows(info.req), 403),
    });
  }
}

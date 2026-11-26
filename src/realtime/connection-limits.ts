import { Injectable } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { AppConfig } from '../platform/config/app-config.js';
import { clientIp } from '../platform/http/client-ip.js';

export const MAX_SOCKETS_PER_IP = 30;

@Injectable()
export class ConnectionLimits {
  private readonly perIp = new Map<string, number>();

  constructor(private readonly config: AppConfig) {}

  ipOf(req: IncomingMessage): string {
    return clientIp(req, this.config.trustCfConnectingIp);
  }

  allows(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    const originOk = !this.config.publicOrigin || !origin || origin === this.config.publicOrigin;
    return originOk && (this.perIp.get(this.ipOf(req)) ?? 0) < MAX_SOCKETS_PER_IP;
  }

  opened(ip: string): void {
    this.perIp.set(ip, (this.perIp.get(ip) ?? 0) + 1);
  }

  closed(ip: string): void {
    const remaining = (this.perIp.get(ip) ?? 1) - 1;
    if (remaining <= 0) this.perIp.delete(ip);
    else this.perIp.set(ip, remaining);
  }
}

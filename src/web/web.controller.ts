import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ArenaQueries } from '../arena/application/arena-queries.js';
import { isLoopback } from '../shared/http/client-ip.js';
import { WebAssets } from './web-assets.js';

/** Pages of the single-page app: they all serve index.html and the app routes in the browser. */
const APP_PAGES = new Set(['/', '/equipo', '/coleccion', '/pokedex', '/stats']);
const SHARE_LINK = /^\/[bt]\/[A-Za-z0-9_-]{4,20}$/;

@Controller()
export class HealthController {
  constructor(private readonly arena: ArenaQueries) {}

  @Get('healthz')
  health(@Res() res: Response) {
    res.type('text/plain; charset=utf-8').send('ok');
  }

  /**
   * Live battle count for deploy/deploy.sh, which asks from inside the container (podman exec) so
   * it can wait until nobody is fighting. Loopback only: cloudflared reaches us from another container.
   */
  @Get('healthz/battles')
  battles(@Req() req: Request, @Res() res: Response) {
    if (!isLoopback(req)) return void res.status(404).type('text/plain; charset=utf-8').send('not found');
    res.type('text/plain; charset=utf-8').send(String(this.arena.busyRooms()));
  }
}

/** Everything else: the frontend's static files. Registered last so it never shadows the API. */
@Controller()
export class WebController {
  constructor(private readonly assets: WebAssets) {}

  @Get(['', '*path'])
  async serve(@Req() req: Request, @Res() res: Response) {
    if (req.path.startsWith('/api/')) return void res.status(404).json({ error: 'No encontrado' });
    const page = APP_PAGES.has(req.path) || SHARE_LINK.test(req.path);
    const asset = await this.assets.read(page ? 'index.html' : req.path);
    if (!asset) return void res.status(404).type('text/plain; charset=utf-8').send('not found');
    res.set({ 'Content-Type': asset.type, 'Cache-Control': asset.cache }).send(asset.body);
  }
}

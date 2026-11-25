import { Controller, Get, NotFoundException, Param, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ArenaQueries } from '../arena/application/arena-queries.js';
import { AppConfig } from '../shared/config/app-config.js';
import { isLoopback } from '../shared/http/client-ip.js';
import { cardVersion, duelPreview, tournamentPreview, withLinkPreview, type LinkPreview } from './link-preview.js';
import { CARD_HEIGHT, CARD_WIDTH } from './preview-card.js';
import { PreviewImages } from './preview-images.js';
import { WebAssets } from './web-assets.js';

const APP_PAGES = new Set(['/', '/equipo', '/coleccion', '/pokedex', '/stats', '/perfil', '/tienda', '/reciclaje', '/torre']);
const SHARE_LINK = /^\/([bt]|entrenador)\/[A-Za-z0-9_-]{4,20}$/;
const PREVIEWED_LINK = /^\/([bt])\/([A-Za-z0-9_-]{4,20})$/;
const FALLBACK_IMAGE = { path: '/icons/token-ball-512.png', width: 512, height: 512 };

type PreviewKind = 'b' | 't';

@Controller()
export class HealthController {
  constructor(private readonly arena: ArenaQueries) {}

  @Get('healthz')
  health(@Res() res: Response) {
    res.type('text/plain; charset=utf-8').send('ok');
  }

  @Get('healthz/battles')
  battles(@Req() req: Request, @Res() res: Response) {
    if (!isLoopback(req)) return void res.status(404).type('text/plain; charset=utf-8').send('not found');
    res.type('text/plain; charset=utf-8').send(String(this.arena.busyRooms()));
  }
}

@Controller()
export class WebController {
  constructor(
    private readonly assets: WebAssets,
    private readonly arena: ArenaQueries,
    private readonly images: PreviewImages,
    private readonly config: AppConfig,
  ) {}

  @Get('og/:kind/:file')
  previewImage(@Param('kind') kind: string, @Param('file') file: string, @Res() res: Response) {
    const id = /^([A-Za-z0-9_-]{4,20})\.png$/.exec(file)?.[1];
    const card = (kind === 'b' || kind === 't') && id ? this.preview(kind, id)?.card : null;
    if (!card) throw new NotFoundException('No encontrado');
    res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=300' }).send(this.images.render(card));
  }

  @Get(['', '*path'])
  async serve(@Req() req: Request, @Res() res: Response) {
    if (req.path.startsWith('/api/')) return void res.status(404).json({ error: 'No encontrado' });
    const page = APP_PAGES.has(req.path) || SHARE_LINK.test(req.path);
    const version = typeof req.query.v === 'string' ? req.query.v : undefined;
    const asset = await this.assets.read(page ? 'index.html' : req.path, version);
    if (!asset) return void res.status(404).type('text/plain; charset=utf-8').send('not found');
    const body = page ? this.withPreview(String(asset.body), req) : asset.body;
    res.set({ 'Content-Type': asset.type, 'Cache-Control': asset.cache }).send(body);
  }

  private preview(kind: PreviewKind, id: string): LinkPreview | null {
    if (kind === 'b') {
      const duel = this.arena.sharedDuel(id);
      return duel && duelPreview(duel);
    }
    const tournament = this.arena.sharedTournament(id);
    return tournament && tournamentPreview(tournament);
  }

  private withPreview(html: string, req: Request): string {
    const [, kind, id] = PREVIEWED_LINK.exec(req.path) ?? [];
    const preview = kind && id ? this.preview(kind as PreviewKind, id) : null;
    if (!preview) return html;
    const origin = this.config.publicOrigin || `${req.protocol}://${req.get('host')}`;
    const image = preview.card
      ? { url: `${origin}/og/${kind}/${id}.png?v=${cardVersion(preview.card)}`, width: CARD_WIDTH, height: CARD_HEIGHT }
      : { url: `${origin}${FALLBACK_IMAGE.path}`, width: FALLBACK_IMAGE.width, height: FALLBACK_IMAGE.height };
    return withLinkPreview(html, preview, `${origin}${req.path}`, image);
  }
}

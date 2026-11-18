// The frontend (public/) is plain JS modules with no build. To make each deploy bust caches,
// "?v=dev" in its .html and .js files is replaced by a hash of the code when served.
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { PUBLIC_DIR } from '../shared/paths.js';

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
// Code revalidates on every load so a deploy shows up at once (Cloudflare would stretch a short
// max-age to hours). Sprites and sounds can be cached, except the Poké Balls generated at install
// (anims/ui/): they change under the same name whenever their colors do, and weigh under 1 KB.
const CACHEABLE = new Set(['.png', '.gif', '.ogg', '.mp3', '.wav', '.m4a', '.ico']);

export interface Asset {
  body: Buffer | string;
  type: string;
  cache: string;
}

@Injectable()
export class WebAssets {
  readonly version: string = (() => {
    const hash = createHash('sha256');
    for (const file of readdirSync(PUBLIC_DIR).filter((f) => /\.(js|css|html)$/.test(f)).sort())
      hash.update(file).update(readFileSync(join(PUBLIC_DIR, file)));
    return hash.digest('hex').slice(0, 10);
  })();

  /** A file of public/, or null if there is none (or the path tries to leave public/). */
  async read(path: string): Promise<Asset | null> {
    const rel = normalize(path).replace(/^([/\\])+/, '');
    if (rel.includes('..')) return null;
    const file = join(PUBLIC_DIR, rel || 'index.html');
    try {
      let body: Buffer | string = await readFile(file);
      if (['.html', '.js'].includes(extname(file))) body = body.toString('utf8').replaceAll('?v=dev', `?v=${this.version}`);
      return { body, type: MIME[extname(file)] || 'application/octet-stream', cache: CACHEABLE.has(extname(file)) && !rel.startsWith(join('anims', 'ui')) ? 'public, max-age=86400' : 'no-cache' };
    } catch {
      return null;
    }
  }
}

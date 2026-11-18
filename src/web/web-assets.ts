// The frontend (public/) is plain JS modules with no build. To make each deploy bust caches,
// "?v=dev" in its .html and .js files is replaced by a hash of the code when served.
import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { PUBLIC_DIR } from '../shared/paths.js';
import { VARIANT_KEYS } from '../catalog/domain/trainer-sprites.js';

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
// Code revalidates on every load so a deploy shows up at once (Cloudflare would stretch a short
// max-age to hours). Images can be cached, except what install generates by recoloring (the Poké
// Balls in anims/ui/ and the trainer variants): it changes under the same name whenever its colors
// do. Sprites, cries, sounds and music aren't served from here (public/upstream.js).
const CACHEABLE = new Set(['.png', '.ico']);
const recolored = (rel: string): boolean => /^anims[/\\]ui[/\\]/.test(rel) || (/^trainers[/\\]/.test(rel) && VARIANT_KEYS.has(rel.slice('trainers/'.length, -'.png'.length)));

// The manifests of public/upstream/ are part of the version, and the page asks for them with it.
const cacheFor = (rel: string): string => {
  if (/^upstream[/\\]/.test(rel)) return 'public, max-age=31536000, immutable';
  return CACHEABLE.has(extname(rel)) && !recolored(rel) ? 'public, max-age=86400' : 'no-cache';
};

export interface Asset {
  body: Buffer | string;
  type: string;
  cache: string;
}

@Injectable()
export class WebAssets {
  readonly version: string = (() => {
    const hash = createHash('sha256');
    const code = readdirSync(PUBLIC_DIR).filter((f) => /\.(js|css|html)$/.test(f));
    const manifests = readdirSync(join(PUBLIC_DIR, 'upstream')).map((f) => join('upstream', f));
    for (const file of [...code, ...manifests].sort()) hash.update(file).update(readFileSync(join(PUBLIC_DIR, file)));
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
      return { body, type: MIME[extname(file)] || 'application/octet-stream', cache: cacheFor(rel) };
    } catch {
      return null;
    }
  }
}

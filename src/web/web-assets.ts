import { Injectable } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { DeployVersion } from '../platform/http/deploy-version.js';
import { PUBLIC_DIR } from '../shared/paths.js';
import { VARIANT_KEYS } from '../catalog/domain/trainer-sprites.js';

const MIME: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.gif': 'image/gif', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8' };
const CACHEABLE = new Set(['.png', '.ico']);
const recolored = (rel: string): boolean => /^anims[/\\]ui[/\\]/.test(rel) || (/^trainers[/\\]/.test(rel) && VARIANT_KEYS.has(rel.slice('trainers/'.length, -'.png'.length)));
const IMMUTABLE = 'public, max-age=31536000, immutable';

export const cacheFor = (rel: string, current: boolean): string => {
  if (/^upstream[/\\]/.test(rel)) return IMMUTABLE;
  if (/^(trainers|overworlds|tiles|animated)[/\\].+\.png$/.test(rel) && current) return IMMUTABLE;
  if (/^icons[/\\]/.test(rel) && current) return IMMUTABLE;
  return CACHEABLE.has(extname(rel)) && !recolored(rel) ? 'public, max-age=86400' : 'no-cache';
};

const VERSIONED = new Set(['.html', '.js', '.webmanifest']);

export interface Asset {
  body: Buffer | string;
  type: string;
  cache: string;
}

@Injectable()
export class WebAssets {
  constructor(private readonly deployVersion: DeployVersion) {}

  async read(path: string, version?: string): Promise<Asset | null> {
    const rel = normalize(path).replace(/^([/\\])+/, '');
    if (rel.includes('..')) return null;
    const file = join(PUBLIC_DIR, rel || 'index.html');
    try {
      let body: Buffer | string = await readFile(file);
      if (VERSIONED.has(extname(file))) body = body.toString('utf8').replaceAll('?v=dev', `?v=${this.deployVersion.value}`);
      return { body, type: MIME[extname(file)] || 'application/octet-stream', cache: cacheFor(rel, version === this.deployVersion.value) };
    } catch {
      return null;
    }
  }
}

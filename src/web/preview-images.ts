import { Injectable } from '@nestjs/common';
import { Resvg } from '@resvg/resvg-js';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_ROOT, PUBLIC_DIR } from '../shared/paths.js';
import type { PreviewCard } from './link-preview.js';
import { previewCardSvg, type CardArt, type CardPicture } from './preview-card.js';

const FONT_FILES = ['Nunito-Bold.ttf', 'Nunito-Black.ttf'].map((file) => join(PROJECT_ROOT, 'assets', 'fonts', file));
const AVATAR_KEY = /^[A-Za-z0-9_-]+$/;

export function pngPicture(png: Buffer): CardPicture {
  return { uri: `data:image/png;base64,${png.toString('base64')}`, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

function trainerPicture(avatar: string): CardPicture | null {
  if (!AVATAR_KEY.test(avatar)) return null;
  const file = join(PUBLIC_DIR, 'trainers', `${avatar}.png`);
  return existsSync(file) ? pngPicture(readFileSync(file)) : null;
}

@Injectable()
export class PreviewImages {
  private readonly trainers = new Map<string, CardPicture | null>();
  private readonly art: CardArt = {
    logo: pngPicture(readFileSync(join(PUBLIC_DIR, 'icons', 'token-ball-192.png'))),
    grass: pngPicture(readFileSync(join(PUBLIC_DIR, 'backgrounds', 'tall-grass.png'))),
    trainer: (avatar) => {
      if (!this.trainers.has(avatar)) this.trainers.set(avatar, trainerPicture(avatar));
      return this.trainers.get(avatar) ?? null;
    },
  };

  render(card: PreviewCard): Buffer {
    const svg = previewCardSvg(card, this.art);
    return new Resvg(svg, { font: { fontFiles: FONT_FILES, loadSystemFonts: false, defaultFontFamily: 'Nunito' } }).render().asPng();
  }
}

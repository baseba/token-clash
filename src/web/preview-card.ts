import type { PreviewCard } from './link-preview.js';

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

export interface CardPicture {
  uri: string;
  width: number;
  height: number;
}

export interface CardArt {
  logo: CardPicture;
  grass: CardPicture;
  trainer: (avatar: string) => CardPicture | null;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PAD = 56;
const INNER = CARD_WIDTH - 2 * PAD;
const COLORS = { text: '#f3f0ff', muted: '#a69fcf', accent: '#ffcf4a', card: '#241f45', line: '#3a3366', empty: '#5a5196' };
const GLYPH_WIDTH = 0.62;

const escapeXml = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');

export const textWidth = (text: string, size: number): number => [...text].length * size * GLYPH_WIDTH;

export const fittedSize = (lines: readonly string[], maxWidth: number, maxSize: number): number =>
  Math.floor(Math.min(maxSize, ...lines.map((line) => maxWidth / Math.max(1, [...line].length * GLYPH_WIDTH))));

const text = (content: string, x: number, y: number, size: number, weight: 700 | 900, fill: string, extra = ''): string =>
  `<text x="${x}" y="${y}" font-family="Nunito" font-size="${size}" font-weight="${weight}" fill="${fill}"${extra}>${escapeXml(content)}</text>`;

const image = (picture: CardPicture, box: Box, extra = ''): string =>
  `<image href="${picture.uri}" x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" image-rendering="optimizeSpeed"${extra}/>`;

export function spriteBox(picture: CardPicture, area: Box): Box {
  const fit = Math.min(area.width / picture.width, area.height / picture.height);
  const scale = fit >= 1 ? Math.floor(fit) : fit;
  const width = Math.round(picture.width * scale);
  const height = Math.round(picture.height * scale);
  return { x: Math.round(area.x + (area.width - width) / 2), y: area.y + area.height - height, width, height };
}

function background(): string {
  return [
    '<defs>',
    '<radialGradient id="glow-top" cx="85%" cy="-10%" r="75%"><stop offset="0" stop-color="#3a2a7a"/><stop offset="1" stop-color="#3a2a7a" stop-opacity="0"/></radialGradient>',
    '<radialGradient id="glow-bottom" cx="-10%" cy="110%" r="60%"><stop offset="0" stop-color="#1f3d6b"/><stop offset="1" stop-color="#1f3d6b" stop-opacity="0"/></radialGradient>',
    '</defs>',
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="#15122a"/>`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glow-top)"/>`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#glow-bottom)"/>`,
  ].join('');
}

function header(art: CardArt, badge: string): string {
  const badgeSize = 24;
  const badgeWidth = Math.round(textWidth(badge, badgeSize) * 0.9 + 44);
  const badgeX = CARD_WIDTH - PAD - badgeWidth;
  return [
    `<image href="${art.logo.uri}" x="${PAD}" y="44" width="52" height="52"/>`,
    text('TOKEN CLASH', PAD + 66, 82, 26, 900, COLORS.muted, ' letter-spacing="2"'),
    `<rect x="${badgeX}" y="44" width="${badgeWidth}" height="52" rx="26" fill="${COLORS.card}" stroke="${COLORS.line}" stroke-width="2"/>`,
    text(badge, badgeX + badgeWidth / 2, 79, badgeSize, 700, COLORS.accent, ' text-anchor="middle"'),
  ].join('');
}

function headlineBlock(card: PreviewCard, x: number, top: number, maxWidth: number, maxSize: number): { svg: string; bottom: number } {
  const size = fittedSize(card.headline, maxWidth, maxSize);
  const parts = [text(card.kicker, x, top + 30, 30, 700, COLORS.accent)];
  let baseline = top + 30 + 16;
  for (const line of card.headline) {
    baseline += size;
    parts.push(text(line, x, baseline, size, 900, COLORS.text));
  }
  baseline += 48;
  parts.push(text(card.subline, x, baseline, 28, 700, COLORS.muted));
  return { svg: parts.join(''), bottom: baseline };
}

function duelBody(card: Extract<PreviewCard, { kind: 'duel' }>, art: CardArt): string {
  const panel: Box = { x: PAD, y: 140, width: 300, height: CARD_HEIGHT - 140 - PAD };
  const trainer = art.trainer(card.avatar);
  const textX = panel.x + panel.width + 48;
  const headline = headlineBlock(card, textX, 0, CARD_WIDTH - PAD - textX, 104);
  const blockHeight = headline.bottom;
  const offset = Math.round(panel.y + (panel.height - blockHeight) / 2);
  return [
    `<clipPath id="panel"><rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" rx="24"/></clipPath>`,
    `<g clip-path="url(#panel)">`,
    `<rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" fill="${COLORS.card}"/>`,
    image(art.grass, panel, ' preserveAspectRatio="xMidYMax slice"'),
    trainer ? image(trainer, spriteBox(trainer, { x: panel.x + 20, y: panel.y + 40, width: panel.width - 40, height: panel.height - 56 })) : '',
    '</g>',
    `<rect x="${panel.x}" y="${panel.y}" width="${panel.width}" height="${panel.height}" rx="24" fill="none" stroke="${COLORS.line}" stroke-width="3"/>`,
    `<g transform="translate(0 ${offset})">${headline.svg}</g>`,
  ].join('');
}

export function seatGrid(size: number, area: Box): Box[] {
  const columns = Math.min(size, 8);
  const rows = Math.ceil(size / columns);
  const gap = 14;
  const width = (area.width - (columns - 1) * gap) / columns;
  const height = (area.height - (rows - 1) * gap) / rows;
  return Array.from({ length: size }, (_, i) => ({
    x: Math.round(area.x + (i % columns) * (width + gap)),
    y: Math.round(area.y + Math.floor(i / columns) * (height + gap)),
    width: Math.round(width),
    height: Math.round(height),
  }));
}

function tournamentBody(card: Extract<PreviewCard, { kind: 'tournament' }>, art: CardArt): string {
  const headline = headlineBlock(card, PAD, 120, INNER, 88);
  const seatsTop = headline.bottom + 34;
  const seats = seatGrid(card.size, { x: PAD, y: seatsTop, width: INNER, height: CARD_HEIGHT - PAD - seatsTop });
  const cells = seats.map((seat, i) => {
    const avatar = card.avatars[i];
    if (avatar === undefined) {
      return [
        `<rect x="${seat.x + 1}" y="${seat.y + 1}" width="${seat.width - 2}" height="${seat.height - 2}" rx="16" fill="none" stroke="${COLORS.empty}" stroke-width="2" stroke-dasharray="8 6"/>`,
        text('?', seat.x + seat.width / 2, seat.y + seat.height / 2 + seat.height * 0.16, Math.round(seat.height * 0.42), 900, COLORS.empty, ' text-anchor="middle"'),
      ].join('');
    }
    const trainer = art.trainer(avatar);
    const stroke = i === 0 ? COLORS.accent : COLORS.line;
    return [
      `<rect x="${seat.x + 1}" y="${seat.y + 1}" width="${seat.width - 2}" height="${seat.height - 2}" rx="16" fill="${COLORS.card}" stroke="${stroke}" stroke-width="2"/>`,
      trainer ? image(trainer, spriteBox(trainer, { x: seat.x + 8, y: seat.y + 8, width: seat.width - 16, height: seat.height - 14 })) : '',
    ].join('');
  });
  return headline.svg + cells.join('');
}

export function previewCardSvg(card: PreviewCard, art: CardArt): string {
  const body = card.kind === 'duel' ? duelBody(card, art) : tournamentBody(card, art);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">${background()}${header(art, card.badge)}${body}</svg>`;
}

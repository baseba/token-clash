import { createHash } from 'node:crypto';
import type { SharedDuel, SharedTournament } from '../arena/application/arena-queries.js';
import { PARTY_SIZE } from '../combat/domain/team-preview.js';

export interface DuelCard {
  kind: 'duel';
  badge: string;
  kicker: string;
  headline: string[];
  subline: string;
  avatar: string;
}

export interface TournamentCard {
  kind: 'tournament';
  badge: string;
  kicker: string;
  headline: string[];
  subline: string;
  size: number;
  avatars: string[];
}

export type PreviewCard = DuelCard | TournamentCard;

export interface LinkPreview {
  title: string;
  description: string;
  card: PreviewCard | null;
}

const NAME_MAX = 18;
const MODE_LABEL = { team: 'Batalla con tu equipo', random: 'Batalla aleatoria' } as const;
const VISIBILITY_LABEL = { public: 'Sala abierta', private: 'Sala privada' } as const;

export const shortName = (name: string): string => {
  const trimmed = name.trim() || 'Alguien';
  return trimmed.length > NAME_MAX ? `${trimmed.slice(0, NAME_MAX - 1).trimEnd()}…` : trimmed;
};

const players = (count: number): string => (count === 1 ? '1 jugador' : `${count} jugadores`);

export function duelPreview(duel: SharedDuel): LinkPreview {
  if (!duel.open) return { title: 'Esta sala ya no está abierta', description: 'La pelea ya empezó o la sala se cerró. Entra a Token Clash para buscar otra.', card: null };
  const host = shortName(duel.host.name);
  const random = duel.mode === 'random';
  const how = random ? `los dados sortean ${PARTY_SIZE} Pokémon de la colección de cada uno` : 'cada uno pelea con el equipo que armó';
  const who = duel.visibility === 'public' ? 'Sala abierta: el primero que entre pelea' : 'Sala privada: entra antes de que venza';
  return {
    title: `${host} te desafía a una batalla`,
    description: `${MODE_LABEL[duel.mode]}: ${how}. ${who}.`,
    card: {
      kind: 'duel',
      badge: VISIBILITY_LABEL[duel.visibility],
      kicker: MODE_LABEL[duel.mode],
      headline: [host, 'te desafía'],
      subline: random ? 'Los dados sortean los Pokémon de cada uno.' : 'Entra al link y elige tus Pokémon.',
      avatar: duel.host.avatar,
    },
  };
}

export function tournamentPreview(tournament: SharedTournament): LinkPreview {
  const host = shortName(tournament.host);
  const headline = `El torneo de ${host}`;
  if (tournament.status !== 'open') {
    const state = tournament.status === 'running' ? 'ya empezó' : 'ya terminó';
    return { title: `${headline} ${state}`, description: 'Entra a Token Clash para ver la llave o armar otro torneo.', card: null };
  }
  const missing = tournament.size - tournament.seats.length;
  const kicker = `Torneo de ${tournament.size} · ${MODE_LABEL[tournament.mode]}`;
  const seats = missing > 0 ? `Quedan ${missing} ${missing === 1 ? 'asiento' : 'asientos'}` : 'La sala está llena';
  return {
    title: missing > 0 ? `${headline} · faltan ${players(missing)}` : headline,
    description: `${kicker}. ${seats}: parte cuando la sala se llena y todos están listos.`,
    card: {
      kind: 'tournament',
      badge: missing > 0 ? `Faltan ${players(missing)}` : 'Sala llena',
      kicker,
      headline: [headline],
      subline: `${seats}. Parte cuando todos están listos.`,
      size: tournament.size,
      avatars: tournament.seats.map((seat) => seat.avatar),
    },
  };
}

export const cardVersion = (card: PreviewCard): string => createHash('sha256').update(JSON.stringify(card)).digest('hex').slice(0, 12);

const escapeHtml = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export interface PreviewImage {
  url: string;
  type: string;
  width: number;
  height: number;
}

export function withLinkPreview(html: string, preview: LinkPreview, pageUrl: string, image: PreviewImage): string {
  const title = escapeHtml(preview.title);
  const description = escapeHtml(preview.description);
  const page = escapeHtml(pageUrl);
  const imageUrl = escapeHtml(image.url);
  const tags = [
    `<link rel="canonical" href="${page}">`,
    `<link rel="image_src" href="${imageUrl}">`,
    `<meta itemprop="name" content="${title}">`,
    `<meta itemprop="description" content="${description}">`,
    `<meta itemprop="image" content="${imageUrl}">`,
    `<meta property="og:site_name" content="Token Clash">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="es_CL">`,
    `<meta property="og:url" content="${page}">`,
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${description}">`,
    `<meta property="og:image" content="${imageUrl}">`,
    ...(image.url.startsWith('https://') ? [`<meta property="og:image:secure_url" content="${imageUrl}">`] : []),
    `<meta property="og:image:type" content="${escapeHtml(image.type)}">`,
    `<meta property="og:image:width" content="${image.width}">`,
    `<meta property="og:image:height" content="${image.height}">`,
    `<meta property="og:image:alt" content="${title}">`,
    `<meta name="twitter:card" content="${preview.card ? 'summary_large_image' : 'summary'}">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${imageUrl}">`,
  ].map((tag) => `  ${tag}\n`).join('');
  return html
    .replace(/<html lang="es">/, () => '<html lang="es" itemscope itemtype="https://schema.org/WebPage">')
    .replace(/<title>[^<]*<\/title>/, () => `<title>${title} · Token Clash</title>`)
    .replace(/<meta name="description" content="[^"]*">\n/, () => `<meta name="description" content="${description}">\n${tags}`);
}

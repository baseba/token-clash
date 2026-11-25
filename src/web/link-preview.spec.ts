import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SharedDuel, SharedTournament } from '../arena/application/arena-queries.js';
import { cardVersion, duelPreview, shortName, tournamentPreview, withLinkPreview } from './link-preview.js';

const duel = (overrides: Partial<SharedDuel> = {}): SharedDuel => ({ open: true, mode: 'team', visibility: 'private', host: { name: 'Blue', avatar: 'blue' }, ...overrides });
const tournament = (overrides: Partial<SharedTournament> = {}): SharedTournament => ({
  status: 'open',
  mode: 'team',
  visibility: 'public',
  size: 8,
  host: 'Brock',
  seats: [{ name: 'Brock', avatar: 'brock' }, { name: 'Bea', avatar: 'bea' }],
  ...overrides,
});
const PAGE = `<head>\n  <title>Token Clash</title>\n  <meta name="description" content="Batallas.">\n  <link rel="icon" href="/icon.svg">\n</head>`;
const IMAGE = { url: 'https://clash.example.com/og/b/abcd.png?v=1', width: 1200, height: 630 };

test('an open room says who challenges and how the battle is fought, never which Pokémon the host brings', () => {
  const preview = duelPreview(duel());
  assert.equal(preview.title, 'Blue te desafía a una batalla');
  assert.match(preview.description, /^Batalla con tu equipo: .*Sala privada/);
  assert.deepEqual(preview.card && { ...preview.card }, { kind: 'duel', badge: 'Sala privada', kicker: 'Batalla con tu equipo', headline: ['Blue', 'te desafía'], subline: 'Entra al link y elige tus Pokémon.', avatar: 'blue' });
});

test('a random public room talks about the dice and the first one in', () => {
  const preview = duelPreview(duel({ mode: 'random', visibility: 'public' }));
  assert.match(preview.description, /los dados sortean 6 Pokémon/);
  assert.match(preview.description, /el primero que entre pelea/);
  assert.equal(preview.card?.badge, 'Sala abierta');
});

test('a room that is no longer open has no card, so the link shows the generic image', () => {
  const preview = duelPreview(duel({ open: false }));
  assert.equal(preview.title, 'Esta sala ya no está abierta');
  assert.equal(preview.card, null);
});

test('a long trainer name is cut so the card keeps its layout', () => {
  assert.equal(shortName('Nacho Juan el Grande de Ñuñoa'), 'Nacho Juan el Gra…');
  assert.equal(shortName('  Ana  '), 'Ana');
  assert.equal(shortName('   '), 'Alguien');
});

test('an open tournament counts the seats still free and shows who already sat', () => {
  const preview = tournamentPreview(tournament());
  assert.equal(preview.title, 'El torneo de Brock · faltan 6 jugadores');
  assert.match(preview.description, /^Torneo de 8 · Batalla con tu equipo\. Quedan 6 asientos/);
  assert.equal(preview.card?.kind, 'tournament');
  assert.deepEqual(preview.card?.kind === 'tournament' && preview.card.avatars, ['brock', 'bea']);
  assert.equal(tournamentPreview(tournament({ size: 4, seats: Array.from({ length: 3 }, () => ({ name: 'Ana', avatar: 'blue' })) })).card?.badge, 'Faltan 1 jugador');
});

test('a tournament already under way or over has no card', () => {
  assert.equal(tournamentPreview(tournament({ status: 'running' })).title, 'El torneo de Brock ya empezó');
  assert.equal(tournamentPreview(tournament({ status: 'finished' })).card, null);
});

test('the image version changes with what the card shows, so chats fetch it again', () => {
  const card = duelPreview(duel()).card!;
  assert.equal(cardVersion(card), cardVersion({ ...card }));
  assert.notEqual(cardVersion(card), cardVersion({ ...card, badge: 'Sala abierta' }));
});

test('the page gets its own title, description and Open Graph tags, escaped', () => {
  const html = withLinkPreview(PAGE, duelPreview(duel({ host: { name: 'Beto <b> & "co"', avatar: 'blue' } })), 'https://clash.example.com/b/abcd', IMAGE);
  assert.match(html, /<title>Beto &lt;b&gt; &amp; &quot;co&quot; te desafía a una batalla · Token Clash<\/title>/);
  assert.match(html, /<meta property="og:title" content="Beto &lt;b&gt; &amp; &quot;co&quot; te desafía a una batalla">/);
  assert.match(html, /<meta property="og:image" content="https:\/\/clash\.example\.com\/og\/b\/abcd\.png\?v=1">/);
  assert.match(html, /<meta name="twitter:card" content="summary_large_image">/);
  assert.equal(html.match(/name="description"/g)?.length, 1);
  assert.ok(html.includes('<link rel="icon" href="/icon.svg">'));
});

test('a dollar sign in a name is written as is', () => {
  const html = withLinkPreview(PAGE, duelPreview(duel({ host: { name: "$& $1 $'", avatar: 'blue' } })), 'https://x.example/b/abcd', IMAGE);
  assert.ok(html.includes("<title>$&amp; $1 $' te desafía a una batalla · Token Clash</title>"));
});

test('without a card the page asks for the small summary', () => {
  const html = withLinkPreview(PAGE, duelPreview(duel({ open: false })), 'https://x.example/b/abcd', { url: 'https://x.example/icon.png', width: 512, height: 512 });
  assert.match(html, /<meta name="twitter:card" content="summary">/);
  assert.match(html, /<meta property="og:image:width" content="512">/);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelInvite, seatBar, tournamentInvite } from '../../public/share-message.js';

const LINK = 'https://clash.example.com/b/abcd';
const room = (overrides = {}) => ({ host: { name: 'Cris' }, mode: 'team', visibility: 'private', ...overrides });
const tournament = (overrides = {}) => ({ size: 8, mode: 'random', visibility: 'public', seats: [{ name: 'Brock' }, { name: 'Bea' }], ...overrides });

test('a private room invite comes in spaced blocks: the game, the dare, the details and the link to accept', () => {
  const { text } = duelInvite(room(), LINK);
  assert.equal(text, [
    '⚔️ *TOKEN CLASH*',
    '',
    '🔥 *Cris tiró el guante.*',
    '¿Te la puedes?',
    '',
    '🎒 Cada uno pelea con su equipo',
    '🔒 Sala privada',
    '⏳ La sala vence si nadie entra',
    '',
    `👉 Aceptar el desafío: ${LINK}`,
  ].join('\n'));
});

test('the rich version hides the link behind the action and escapes the trainer name', () => {
  const { html, text } = duelInvite(room({ host: { name: 'Beto <b> & co' } }), LINK);
  assert.ok(html.startsWith('⚔️ <b>TOKEN CLASH</b><br><br>🔥 <b>Beto &lt;b&gt; &amp; co tiró el guante.</b><br>¿Te la puedes?'));
  assert.ok(html.endsWith(`👉 <a href="${LINK}">Aceptar el desafío</a>`));
  assert.ok(text.includes('*Beto <b> & co tiró el guante.*'));
});

test('a public random room talks about the dice and the first one in, without a deadline', () => {
  const { text, action } = duelInvite(room({ mode: 'random', visibility: 'public' }), LINK);
  assert.match(text, /🎲 Batalla aleatoria: los dados sortean los Pokémon\n🌍 Sala abierta: el primero que entre pelea\n\n👉 Entrar a la sala: /);
  assert.equal(action, 'Entrar a la sala');
});

test('the preview gets the same blocks, split into bold and plain pieces', () => {
  const { blocks } = duelInvite(room(), LINK);
  assert.deepEqual(blocks[1], [[{ text: '🔥 ', bold: false }, { text: 'Cris tiró el guante.', bold: true }], [{ text: '¿Te la puedes?', bold: false }]]);
});

test('the seat bar paints the taken seats and counts them', () => {
  assert.equal(seatBar(5, 8), '🟨🟨🟨🟨🟨⬜⬜⬜  5/8');
  assert.equal(seatBar(4, 4), '🟨🟨🟨🟨  4/4');
});

test('a tournament invite says how many are missing and asks to sit down', () => {
  const { text } = tournamentInvite(tournament(), 'https://clash.example.com/t/abcd');
  assert.match(text, /^🏆 \*TOKEN CLASH\*\n\n🔥 \*Brock armó un torneo de 8\.\*\nFaltan 6\. ¿Te sumas\?\n\n🟨🟨⬜⬜⬜⬜⬜⬜  2\/8\n🎲 Batalla aleatoria · 🌍 Público/);
  assert.match(text, /👉 Sentarse en el torneo: https:\/\/clash\.example\.com\/t\/abcd$/);
  assert.match(tournamentInvite(tournament({ size: 3 }), LINK).text, /Falta 1\. ¿Te sumas\?/);
});

test('a full tournament invite asks to watch instead', () => {
  const { text } = tournamentInvite(tournament({ size: 2 }), LINK);
  assert.match(text, /Ya está lleno, pero puedes mirarlo\./);
  assert.match(text, /👉 Ver el torneo: /);
});

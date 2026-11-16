import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendChat, chatChannel, chatText, createChatStore, tournamentChannel, CHAT_MAX_LENGTH } from '../server/chat.js';

test('a chat line is trimmed, keeps to one line and is capped in length', () => {
  assert.equal(chatText('  hola\n\n  mundo\t '), 'hola mundo');
  assert.equal([...chatText('🔥'.repeat(CHAT_MAX_LENGTH + 10))].length, CHAT_MAX_LENGTH);
});

test('empty or non-text messages are dropped', () => {
  for (const raw of ['', '   ', '\n\t', null, 42, { text: 'x' }]) assert.equal(chatText(raw), null);
});

test('the chat history keeps only the most recent messages', () => {
  const history = [1, 2, 3].reduce((h, n) => appendChat(h, n, 2), []);
  assert.deepEqual(history, [2, 3]);
});

test('every match of a tournament shares the tournament chat; a lone duel has its own', () => {
  assert.equal(chatChannel({ id: 'abc', tournamentId: 'T1' }), tournamentChannel('T1'));
  assert.equal(chatChannel({ id: 'abc' }), 'c:abc');
  assert.notEqual(chatChannel({ id: 'abc' }), chatChannel({ id: 'xyz' }));
});

test('the chat store numbers messages per channel and forgets the least recent channels', () => {
  const chats = createChatStore({ channels: 2, history: 3 });
  assert.equal(chats.post('a', { text: '1' }).id, 1);
  assert.equal(chats.post('a', { text: '2' }).id, 2);
  assert.equal(chats.post('b', { text: 'x' }).id, 1);
  chats.post('a', { text: '3' });
  chats.post('c', { text: 'y' });
  assert.deepEqual(chats.log('a').map((m) => m.text), ['1', '2', '3']);
  assert.deepEqual(chats.log('b'), []);
});

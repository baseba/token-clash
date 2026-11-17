import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendChat, chatText, createChatStore, CHAT_MAX_LENGTH } from './chat.js';

test('a chat line is trimmed, keeps to one line and is capped in length', () => {
  assert.equal(chatText('  hola\n\n  mundo\t '), 'hola mundo');
  assert.equal([...chatText('🔥'.repeat(CHAT_MAX_LENGTH + 10))].length, CHAT_MAX_LENGTH);
});

test('empty messages are dropped', () => {
  for (const raw of ['', '   ', '\n\t']) assert.equal(chatText(raw), null);
});

test('the chat history keeps only the most recent messages', () => {
  const history = [1, 2, 3].reduce((h, n) => appendChat(h, n, 2), []);
  assert.deepEqual(history, [2, 3]);
});

test('the chat store numbers messages per channel and forgets the least recent channels', () => {
  const chats = createChatStore({ channels: 2, history: 3 });
  assert.equal(chats.post('a', { text: '1' } as any).id, 1);
  assert.equal(chats.post('a', { text: '2' } as any).id, 2);
  assert.equal(chats.post('b', { text: 'x' } as any).id, 1);
  chats.post('a', { text: '3' } as any);
  chats.post('c', { text: 'y' } as any);
  assert.deepEqual(chats.log('a').map((m) => m.text), ['1', '2', '3']);
  assert.deepEqual(chats.log('b'), []);
});

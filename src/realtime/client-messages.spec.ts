import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseClientMessage } from './client-messages.js';

const parse = (frame: unknown) => parseClientMessage(typeof frame === 'string' ? frame : JSON.stringify(frame));

test('a well-formed frame is routed by its t, with typed fields', () => {
  assert.deepEqual(parse({ t: 'hello', room: 'abc123', token: 'tok' }), { event: 'hello', data: { t: 'hello', room: 'abc123', token: 'tok' } });
  assert.deepEqual(parse({ t: 'act', action: { type: 'switch', to: 2 } })?.data, { t: 'act', action: { type: 'switch', to: 2 } });
  assert.deepEqual(parse({ t: 'pick', picks: [0, 2, 1] })?.data, { t: 'pick', picks: [0, 2, 1] });
  assert.deepEqual(parse({ t: 'leave', extra: 1 })?.data, { t: 'leave' });
});

test('frames that are not a known message are dropped', () => {
  for (const frame of ['not json', '42', 'null', '[]', { t: 'nope' }, { t: 7 }, { room: 'abc' }]) assert.equal(parse(frame), undefined, JSON.stringify(frame));
});

test('a malformed field reads as the value its use case already turns down', () => {
  assert.deepEqual(parse({ t: 'hello', room: 42 })?.data, { t: 'hello', room: '' });
  assert.deepEqual(parse({ t: 'pick', picks: 'all' })?.data, { t: 'pick', picks: [] });
  assert.deepEqual(parse({ t: 'act', action: { type: 'move', move: 'x' } })?.data, { t: 'act', action: null });
  assert.deepEqual(parse({ t: 'chat', text: { html: 1 } })?.data, { t: 'chat', text: '' });
  assert.equal((parse({ t: 'lobby', token: null })?.data as { token?: string }).token, undefined);
});

test('the ready check reads anything but false as ready', () => {
  assert.deepEqual(parse({ t: 'set-ready', ready: false })?.data, { t: 'set-ready', ready: false });
  assert.deepEqual(parse({ t: 'set-ready' })?.data, { t: 'set-ready', ready: true });
  assert.deepEqual(parse({ t: 'set-ready', ready: 'no' })?.data, { t: 'set-ready', ready: true });
});

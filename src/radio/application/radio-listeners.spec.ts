import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RadioListeners, type RadioListener } from './radio-listeners.js';

const client = (): RadioListener => ({ open: true, send: () => {} });

test('tuning in to another station leaves the first one, and an emptied station keeps nobody', () => {
  const listeners = new RadioListeners();
  const ana = client();
  const beto = client();
  listeners.tuneIn(ana, 'a');
  listeners.tuneIn(beto, 'a');
  listeners.tuneIn(ana, 'b');
  assert.deepEqual(listeners.of('a'), [beto]);
  assert.deepEqual(listeners.of('b'), [ana]);
  listeners.tuneOut(beto);
  assert.equal(listeners.count('a'), 0);
  assert.deepEqual(listeners.of('a'), []);
  listeners.tuneIn(ana, 'b');
  assert.equal(listeners.count('b'), 1, 'tuning in again to the same station counts once');
});

test('a closed station drops its listeners, who then hear nothing until they tune in again', () => {
  const listeners = new RadioListeners();
  const ana = client();
  listeners.tuneIn(ana, 'a');
  assert.deepEqual(listeners.drop('a'), [ana]);
  assert.equal(listeners.count('a'), 0);
  const beto = client();
  listeners.tuneIn(beto, 'a');
  listeners.tuneOut(ana);
  assert.deepEqual(listeners.of('a'), [beto], 'a dropped listener no longer counts as one of the reopened station');
});

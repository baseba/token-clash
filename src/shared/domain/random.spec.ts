import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, shuffled } from './random.js';

test('shuffled keeps every item once and leaves the input alone', () => {
  const items = [1, 2, 3, 4, 5, 6, 7];
  const out = shuffled(items, rng('s'));
  assert.deepEqual([...out].sort(), items);
  assert.deepEqual(items, [1, 2, 3, 4, 5, 6, 7]);
});

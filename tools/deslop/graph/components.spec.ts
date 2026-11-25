import { test } from 'node:test';
import assert from 'node:assert/strict';
import { circles } from './components.js';

test('finds each circle and leaves out the rest', () => {
  const edges = [[1], [2], [0, 3], [4], [3], []];
  assert.deepEqual(circles(edges), [
    [0, 1, 2],
    [3, 4],
  ]);
});

test('a long chain that closes is one circle', () => {
  const size = 50_000;
  const edges = Array.from({ length: size }, (_unused, index) => [(index + 1) % size]);
  assert.equal(circles(edges)[0].length, size);
});

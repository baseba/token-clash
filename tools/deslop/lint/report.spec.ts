import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grouped, shortestCircle } from './report.js';

const tie = (user: string, used: string) => ({ user, used });

test('the circle drawn is the shortest through the first tie of the cheapest', () => {
  assert.deepEqual(shortestCircle([tie('a', 'b'), tie('b', 'c'), tie('c', 'a')]), [0, 1, 2]);
  assert.deepEqual(shortestCircle([tie('a', 'b'), tie('b', 'c'), tie('c', 'a'), tie('b', 'a')]), [0, 3]);
  assert.deepEqual(shortestCircle([tie('a', 'b'), tie('b', 'd'), tie('b', 'c'), tie('c', 'a'), tie('d', 'a')]), [0, 1, 4]);
});

test('names under one name are written once', () => {
  assert.equal(grouped(['LIMIT']), 'LIMIT');
  assert.equal(grouped(['Stream::new']), 'Stream::new');
  assert.equal(grouped(['Stream', 'LIMIT', 'Stream::new', 'Stream::Kind::Ready']), 'Stream::{self, new, Kind::Ready}, LIMIT');
});

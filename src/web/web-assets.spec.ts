import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cacheFor } from './web-assets.js';

const IMMUTABLE = 'public, max-age=31536000, immutable';

test('a trainer sprite asked for with the current version is cached for good, recolors too', () => {
  assert.equal(cacheFor('trainers/red.png', true), IMMUTABLE);
  assert.equal(cacheFor('trainers/red_charizard_shiny.png', true), IMMUTABLE);
});

test('a trainer sprite asked for with another version or none is not cached for good, since it may be stale', () => {
  assert.equal(cacheFor('trainers/red.png', false), 'public, max-age=86400');
  assert.equal(cacheFor('trainers/red_charizard.png', false), 'no-cache');
  assert.equal(cacheFor('trainers/faces.json', true), 'no-cache');
});

test('overworld sprites and the Tower tiles are cached for good with the current version, like trainers', () => {
  assert.equal(cacheFor('overworlds/red.png', true), IMMUTABLE);
  assert.equal(cacheFor('tiles/tower.png', true), IMMUTABLE);
  assert.equal(cacheFor('animated/658-front.png', true), IMMUTABLE);
  assert.equal(cacheFor('animated/658-front.png', false), 'public, max-age=86400');
  assert.equal(cacheFor('animated/index.json', true), 'no-cache');
  assert.equal(cacheFor('tiles/tower.png', false), 'public, max-age=86400');
});

test('code always revalidates and the upstream manifests are cached for good', () => {
  assert.equal(cacheFor('app.js', true), 'no-cache');
  assert.equal(cacheFor('upstream/sprites.json', false), IMMUTABLE);
});

test('an app icon is cached for good only when asked for with the current version', () => {
  assert.equal(cacheFor('icons/token-ball-192.png', true), IMMUTABLE);
  assert.equal(cacheFor('icons/token-ball-192.png', false), 'public, max-age=86400');
});

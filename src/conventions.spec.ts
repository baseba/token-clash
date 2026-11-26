import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readSources } from '../test/source-files.js';

const sources = readSources();
const isDomain = (file: string) => file.split('/')[1] === 'domain' || file.startsWith('shared/');

test('a domain/ folder never calls Math.random(): the randomness comes in as a parameter', () => {
  const bad = sources.filter(({ file, code }) => isDomain(file) && /Math\.random\s*\(/.test(code)).map(({ file }) => file);
  assert.deepEqual(bad, []);
});

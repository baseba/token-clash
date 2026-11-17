import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byRanking } from './ranking.js';

const t = (name: string, wins: number, losses: number) => ({ name, wins, losses });

test('more wins rank higher, then fewer losses, then the name', () => {
  const ranked = [t('Caro', 2, 1), t('Beto', 3, 4), t('Ana', 2, 1), t('Dani', 2, 0), t('Eva', 0, 0)].sort(byRanking);
  assert.deepEqual(ranked.map((x) => x.name), ['Beto', 'Dani', 'Ana', 'Caro', 'Eva']);
});

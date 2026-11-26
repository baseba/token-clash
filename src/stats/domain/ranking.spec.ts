import { test } from 'node:test';
import assert from 'node:assert/strict';
import { byRanking } from './ranking.js';

const row = (name: string, elo: number | null, wins: number, losses: number) => ({ name, elo, wins, losses });

test('a higher Elo ranks higher, whatever the wins say', () => {
  const ranked = [row('Ana', 1010, 9, 0), row('Beto', 1040, 1, 0), row('Caro', 990, 0, 3)].sort(byRanking);
  assert.deepEqual(ranked.map((trainer) => trainer.name), ['Beto', 'Ana', 'Caro']);
});

test('who has no Elo goes after everyone rated', () => {
  const ranked = [row('Ana', null, 5, 0), row('Beto', 900, 0, 4)].sort(byRanking);
  assert.deepEqual(ranked.map((trainer) => trainer.name), ['Beto', 'Ana']);
});

test('on the same Elo, more wins rank higher, then fewer losses, then the name', () => {
  const ranked = [row('Caro', 1000, 2, 1), row('Beto', 1000, 3, 4), row('Ana', 1000, 2, 1), row('Dani', 1000, 2, 0), row('Eva', null, 0, 0), row('Fede', null, 1, 0)].sort(byRanking);
  assert.deepEqual(ranked.map((trainer) => trainer.name), ['Beto', 'Dani', 'Ana', 'Caro', 'Fede', 'Eva']);
});

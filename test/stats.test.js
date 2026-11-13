import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serverStats, rankingOf } from '../server/stats.js';

const trainer = (id, name, wins, losses, roster, totalTokens = 0) => ({ id, name, wins, losses, roster, totalTokens });
const fighter = (speciesName, sprite) => ({ speciesName, sprite, types: ['normal'] });
const battle = (id, hostId, guestId, winnerSide, extra = {}) => ({
  id, hostId, guestId, status: 'finished', mode: 'team', turns: 10, createdAt: 1, finishedAt: Number(id.slice(1)),
  winnerId: winnerSide === 0 ? hostId : winnerSide === 1 ? guestId : undefined,
  final: { winner: winnerSide, sides: [{ team: [fighter('Pikachu', '25'), fighter('Eevee', '133')] }, { team: [fighter('Pikachu', '25')] }] },
  ...extra,
});

test('the ranking orders by wins, then fewer losses, with the win rate', () => {
  const ranking = rankingOf([trainer('a', 'Ana', 2, 2, []), trainer('b', 'Beto', 3, 1, [{ shiny: true }, {}]), trainer('c', 'Caro', 2, 0, [])]);
  assert.deepEqual(ranking.map((t) => t.name), ['Beto', 'Caro', 'Ana']);
  assert.equal(ranking[0].winRate, 0.75);
  assert.equal(ranking[0].shinies, 1);
  assert.equal(rankingOf([trainer('z', 'Zoe', 0, 0, [])])[0].winRate, null);
});

test('server stats count only battles between players and the Pokémon they used', () => {
  const db = {
    trainers: { a: trainer('a', 'Ana', 1, 1, [{ finalID: 25 }, { finalID: 133, shiny: true }], 100), b: trainer('b', 'Beto', 1, 1, [{ finalID: 25 }], 50) },
    challenges: {
      x1: battle('x1', 'a', 'b', 0),
      x2: battle('x2', 'b', 'a', 1, { mode: 'random', turns: 20 }),
      x3: battle('x3', 'a', 'ai:hard', 0, { ai: 'hard', guestName: 'IA Difícil' }),
      x4: { id: 'x4', hostId: 'a', status: 'open', createdAt: 5 },
    },
  };
  const s = serverStats(db);
  assert.deepEqual(s.totals, { trainers: 2, pokemon: 3, species: 2, shinies: 1, tokens: 150, battles: 2, aiBattles: 1, randomBattles: 1, avgTurns: 15 });
  assert.deepEqual(s.recent.map((c) => [c.id, c.winner]), [['x2', 'guest'], ['x1', 'host']]);
  assert.equal(s.recent[0].host, 'Beto');
  assert.deepEqual(s.topMons.map((m) => [m.name, m.uses, m.wins]), [['Pikachu', 4, 2], ['Eevee', 2, 1]]);
});

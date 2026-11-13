import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serverStats, rankingOf, playersOf, tournamentStats } from '../server/stats.js';

const trainer = (id, name, wins, losses, roster, totalTokens = 0) => ({ id, name, wins, losses, roster, totalTokens });
const fighter = (speciesName, sprite) => ({ speciesName, sprite, types: ['normal'] });
const battle = (id, hostId, guestId, winnerSide, extra = {}) => ({
  id, hostId, guestId, status: 'finished', mode: 'team', turns: 10, createdAt: 1, finishedAt: Number(id.slice(1)),
  winnerId: winnerSide === 0 ? hostId : winnerSide === 1 ? guestId : undefined,
  final: { winner: winnerSide, sides: [{ team: [fighter('Pikachu', '25'), fighter('Eevee', '133')] }, { team: [fighter('Pikachu', '25')] }] },
  ...extra,
});

test('the ranking orders by wins, then win rate, and leaves out who never fought', () => {
  const ranking = rankingOf([trainer('a', 'Ana', 2, 2, []), trainer('b', 'Beto', 3, 1, [{ shiny: true }, {}]), trainer('c', 'Caro', 2, 0, []), trainer('z', 'Zoe', 0, 0, [])]);
  assert.deepEqual(ranking.map((t) => t.name), ['Beto', 'Caro', 'Ana']);
  assert.equal(ranking[0].winRate, 0.75);
  assert.equal(ranking[0].shinies, 1);
});

test('accounts that imported the same save count as one player', () => {
  const groups = playersOf([trainer('a', 'Ana', 0, 0, [{ id: 'p1' }, { id: 'p2' }]), trainer('b', 'Beto', 0, 0, [{ id: 'p3' }]), trainer('c', 'Ana 2', 0, 0, [{ id: 'p2' }, { id: 'p9' }])]);
  assert.deepEqual(groups.map((g) => g.map((t) => t.id)), [['a', 'c'], ['b']]);
});

test('totals count each save once and activity by last visit', () => {
  const now = 10 * 24 * 60 * 60_000;
  const save = [{ id: 'p1', finalID: 25, shiny: true }, { id: 'p2', finalID: 133 }];
  const db = {
    trainers: {
      a: { ...trainer('a', 'Ana', 0, 0, save, 900), lastSeen: now - 60_000 },
      b: { ...trainer('b', 'Ana otra vez', 0, 0, [...save, { id: 'p3', finalID: 1 }], 1000), lastSeen: now - 2 * 60 * 60_000 },
      c: { ...trainer('c', 'Caro', 0, 0, [{ id: 'q1', finalID: 25 }], 50), lastSeen: now - 3 * 24 * 60 * 60_000 },
    },
    challenges: {},
  };
  const { totals } = serverStats(db, now);
  assert.equal(totals.trainers, 2);
  assert.equal(totals.accounts, 3);
  assert.equal(totals.pokemon, 4);
  assert.equal(totals.shinies, 1);
  assert.equal(totals.species, 3);
  assert.equal(totals.tokens, 1050);
  assert.equal(totals.activeNow, 1);
  assert.equal(totals.activeToday, 1);
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
  db.challenges.x5 = battle('x5', 'a', 'b', null, { turns: 101 });
  const s = serverStats(db);
  assert.deepEqual(s.totals, { trainers: 2, accounts: 2, pokemon: 3, species: 2, shinies: 1, tokens: 150, battles: 3, randomBattles: 1, draws: 1, avgTurns: 43.3, aiBattles: 1, aiWins: 1, activeNow: 0, activeToday: 0 });
  assert.deepEqual(s.recent.map((c) => [c.id, c.winner]), [['x5', null], ['x2', 'guest'], ['x1', 'host']]);
  assert.equal(s.recent[1].host, 'Beto');
  assert.deepEqual(s.topMons.map((m) => [m.name, m.uses, m.wins]), [['Pikachu', 6, 2], ['Eevee', 3, 1]]);
});

test('tournaments count apart from 1v1 and only when at least two people played', () => {
  const seats = (humans) => [...humans.map((id) => ({ id, name: id.toUpperCase() })), ...Array.from({ length: 4 - humans.length }, (_, i) => ({ id: `ai:easy#${i + 1}`, name: `bot ${i}`, ai: 'easy' }))];
  const bracket = (w1, w2, champ) => [[{ a: 0, b: 1, winner: w1 }, { a: 2, b: 3, winner: w2 }], [{ a: w1, b: w2, winner: champ }]];
  const db = {
    trainers: { a: trainer('a', 'Ana', 0, 0, []), b: trainer('b', 'Beto', 0, 0, []) },
    challenges: {
      m1: { ...battle('m1', 'a', 'b', 0), tournamentId: 't1' },
    },
    tournaments: {
      t1: { id: 't1', size: 4, mode: 'team', status: 'finished', createdAt: 1, finishedAt: 5, seats: seats(['a', 'b']), bracket: bracket(0, 2, 0), champion: 0 },
      t2: { id: 't2', size: 4, mode: 'random', status: 'finished', createdAt: 2, finishedAt: 6, seats: seats(['a']), bracket: bracket(0, 2, 0), champion: 0 },
      t3: { id: 't3', size: 4, mode: 'team', status: 'running', createdAt: 3, seats: seats(['a', 'b']), bracket: bracket(null, null, null) },
    },
  };
  const t = tournamentStats(db);
  assert.deepEqual(t.totals, { tournaments: 1, matches: 3, aiTitles: 0 });
  assert.deepEqual(t.ranking.map((r) => [r.name, r.titles, r.finals, r.wins, r.losses]), [['Ana', 1, 1, 2, 0], ['Beto', 0, 0, 0, 1]]);
  assert.deepEqual(t.recent.map((r) => [r.id, r.champion, r.humans]), [['t1', 'Ana', 2]]);
  assert.equal(serverStats(db).totals.battles, 0);
});

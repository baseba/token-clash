import { test } from 'node:test';
import assert from 'node:assert/strict';
import { trainerDirectory, trainerProfile } from './trainer-profile.js';

const trainer = (id: string, name: string, wins: number, losses: number, extra = {}) => ({ id, name, wins, losses, roster: [{ finalID: 25, shiny: true }, { finalID: 25 }, { finalID: 133 }], totalTokens: 500, ...extra });
const fighter = (speciesName: string, hidden = false) => ({ speciesName, sprite: speciesName, types: ['normal'], hidden });
const duel = (id: string, hostId: string, guestId: string, winnerId: string | null, at: number, extra = {}) => ({
  id, hostId, hostName: hostId, guestId, guestName: guestId, status: 'finished', mode: 'team', turns: 9, createdAt: at, finishedAt: at, winnerId,
  final: { winner: winnerId === hostId ? 0 : winnerId === guestId ? 1 : null, sides: [{ team: [fighter('Pikachu'), fighter('Eevee')] }, { team: [fighter('Mew'), fighter('Ditto', true)] }] },
  ...extra,
});

function source(): any {
  return {
    trainers: {
      ana: trainer('ana', 'Ana', 2, 1, { look: 'lass', equipped: { ball: 'ub', frame: 'gold' } }),
      beto: trainer('beto', 'Beto', 1, 2),
      zoe: trainer('zoe', 'Zoe', 0, 0),
    },
    challenges: {
      c1: duel('c1', 'ana', 'beto', 'ana', 1),
      c2: duel('c2', 'beto', 'ana', 'beto', 3),
      c3: duel('c3', 'ana', 'beto', 'ana', 2),
      ai: { ...duel('ai', 'ana', 'ai:hard', 'ana', 4), ai: 'hard' },
      tour: { ...duel('tour', 'ana', 'beto', 'beto', 5), tournamentId: 't1' },
      open: { ...duel('open', 'ana', 'beto', null, 6), status: 'open', final: undefined },
    },
    tournaments: {},
  };
}

test('a profile shows the record, the ranking place and Elo, the collection size and battles against players only', () => {
  const profile = trainerProfile(source(), 'ana')!;
  assert.deepEqual(profile.record, { wins: 2, losses: 1, games: 3, winRate: 2 / 3, rank: 1, elo: 1012 });
  assert.deepEqual(trainerProfile(source(), 'beto')!.record, { wins: 1, losses: 2, games: 3, winRate: 1 / 3, rank: 2, elo: 988 });
  assert.deepEqual(profile.collection, { pokemon: 3, species: 2, shinies: 1, tokens: 500 });
  assert.deepEqual(profile.vsAi, { wins: 1, losses: 0 });
  assert.deepEqual(profile.recent.map((battle) => [battle.id, battle.rival.name, battle.result]), [['c2', 'Beto', 'lost'], ['c3', 'Beto', 'won'], ['c1', 'Beto', 'won']]);
  assert.equal(trainerProfile(source(), 'zoe')!.record.rank, null, 'who never fought has no place');
  assert.equal(trainerProfile(source(), 'zoe')!.record.elo, null, 'nor an Elo');
  assert.equal(trainerProfile(source(), 'nadie'), null);
});

test('the favourite Pokémon are the ones the trainer brought to battles, on their own side, never a hidden one', () => {
  const ana = trainerProfile(source(), 'ana')!;
  assert.deepEqual(ana.favorites.map((mon) => [mon.name, mon.uses]), [['Eevee', 2], ['Pikachu', 2], ['Mew', 1]]);
  assert.ok(!ana.favorites.some((mon) => mon.name === 'Ditto'));
});

test('the shop items in use are named, and the Poké Ball falls back to the default one', () => {
  const ana = trainerProfile(source(), 'ana')!;
  assert.equal(ana.using.ball?.key, 'ub');
  assert.deepEqual(ana.using.frame, { key: 'gold', name: 'Marco de oro', rarity: 'epic' });
  assert.equal(ana.using.window, null);
  assert.equal(trainerProfile(source(), 'beto')!.using.ball?.key, 'pb');
});

test('the search lists every trainer by name, also who never fought, with only what the ranking already shows', () => {
  const list = trainerDirectory(Object.values(source().trainers));
  assert.deepEqual(list.map((row) => row.name), ['Ana', 'Beto', 'Zoe']);
  assert.deepEqual(list[0], { id: 'ana', name: 'Ana', avatar: 'lass', frame: 'gold', wins: 2, losses: 1 });
});

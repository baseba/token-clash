import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, speciesIdByName } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { baseStatTotal, evolutionPath, levelMovesUpTo } from './growth.js';
import { collectionLines, labOffers, natureOf, offerMoves, recruitOffers } from './lab.js';

const entry = (name: string, index: number): RosterEntry => {
  const finalID = speciesIdByName(name) as number;
  return { id: `e${index}`, finalID, baseID: finalID, rarity: 'common', shiny: false, level: 50, ivs: { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 } };
};
const roster = ['Charizard', 'Blastoise', 'Venusaur', 'Golem', 'Gengar', 'Dragonite', 'Lapras', 'Butterfree', 'Pidgeot', 'Mewtwo', 'Lugia', 'Snorlax', 'Onix', 'Alakazam', 'Arcanine', 'Charmeleon'].map(entry);

test('the guides only offer your own Pokémon, one per line, as the form of level 5', () => {
  const offers = labOffers(roster, 5, rng(1));
  assert.equal(offers.length, 6);
  const ids = new Set(roster.map((mon) => mon.id));
  assert.ok(offers.every((offer) => ids.has(offer.entry.id) && offer.level === 5));
  assert.ok(offers.every((offer) => offer.speciesId === evolutionPath(offer.entry.finalID)[0]));
  const lines = offers.map((offer) => evolutionPath(offer.entry.finalID)[0]);
  assert.equal(new Set(lines).size, lines.length);
});

test('the professor offers six, from the weaker, middle and stronger thirds of your collection, one legendary at most', () => {
  for (let seed = 0; seed < 20; seed++) {
    const offers = labOffers(roster, 5, rng(seed));
    assert.equal(offers.length, 6, `${seed}`);
    assert.equal(new Set(offers.map((offer) => offer.guide.key)).size, 1, `${seed}`);
    assert.ok(offers.filter((offer) => baseStatTotal(offer.entry.finalID) >= 580).length <= 1, `${seed}`);
    const totals = roster.map((mon) => baseStatTotal(mon.finalID)).sort((a, b) => a - b);
    const weakest = totals[Math.floor(totals.length / 3)];
    assert.ok(offers.filter((offer) => baseStatTotal(offer.entry.finalID) <= weakest).length >= 2, `${seed}`);
  }
});

test('a small collection still gets offers, all of it', () => {
  const offers = labOffers(roster.slice(0, 2), 5, rng(1));
  assert.equal(offers.length, 2);
});

test('the same line twice in the collection counts once', () => {
  assert.equal(collectionLines([entry('Charizard', 1), entry('Charmeleon', 2), entry('Pikachu', 3)], rng(1)).length, 2);
});

test('a leader offers Pokémon of your collection that are not in your party, of its type first', () => {
  const guide = { key: 'roark', title: 'Líder Roark', line: '', type: 'rock' };
  const party = [evolutionPath(roster[0].finalID)[0]];
  const offers = recruitOffers(roster, party, guide, 20, rng(3));
  assert.equal(offers.length, 3);
  assert.ok(offers.every((offer) => evolutionPath(offer.entry.finalID)[0] !== party[0]));
  const rocks = new Set(['Golem', 'Onix'].map((name) => speciesIdByName(name)));
  assert.ok(offers.some((offer) => rocks.has(offer.entry.finalID)));
});

test('an offer comes with the moves its form knows at its level and always a nature', () => {
  const bulbasaur = { ...entry('Venusaur', 99), moveset: ['double-edge', 'synthesis', 'seed-bomb', 'leech-seed'] };
  const [offer] = labOffers([bulbasaur], 5, rng(1));
  const moves = offerMoves(offer);
  assert.ok(moves.length && moves.every((id) => levelMovesUpTo(offer.speciesId, 5).includes(id)), moves.join());
  assert.ok(!moves.includes('double-edge'));
  assert.ok(natureOf(bulbasaur));
  assert.equal(natureOf(bulbasaur), natureOf(bulbasaur));
  assert.equal(natureOf({ ...bulbasaur, nature: 'bold' }), 'bold');
});

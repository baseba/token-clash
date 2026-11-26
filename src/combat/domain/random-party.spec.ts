import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseSave } from '../../trainers/domain/save-file.js';
import { learnedMoves, abilityOptions, abilityFor, usableAbility, NATURE_NAMES } from '../../catalog/domain/creatures.js';
import { rng } from '../../shared/domain/random.js';
import { hiddenPowerType, moveData } from './moves.js';
import { validMoveset, movesetFor, buildFighter, movepool, MOVES_PER_FIGHTER } from './fighter.js';
import { alwaysDamages, randomEvs, randomParty, randomize, randomAbility, reroll, GUARANTEED_ATTACKS } from './random-party.js';
import { canReroll, createPreview, pick, previewView } from './team-preview.js';
import { aiRerollCandidates, aiRerollIndex, buildAiRandomParty, buildAiTeam, AI_LEVELS } from './ai.js';
import { usableMovepool } from './fighter.js';
import { PARTY_SIZE } from './team-preview.js';
import { PROJECT_ROOT } from '../../shared/paths.js';
import { join } from 'node:path';

const { roster } = parseSave(readFileSync(join(PROJECT_ROOT, 'test', 'fixtures', 'export.json'), 'utf8'));

const bigRoster = [1, 4, 7, 25, 52, 68, 94, 122, 143, 6, 9, 3].map((finalID, i): any => ({ id: `mon-${i}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 } }));

test('a random party has six distinct mons from the roster', () => {
  const party = randomParty(bigRoster, rng('party'));
  assert.equal(party.length, PARTY_SIZE);
  assert.equal(new Set(party.map((e) => e.id)).size, PARTY_SIZE);
  const ids = new Set(bigRoster.map((e) => e.id));
  assert.ok(party.every((e) => ids.has(e.id)));
});

test('a random party never repeats a species', () => {
  const twins = [...roster, ...roster.map((e) => ({ ...e, id: `${e.id}-twin` }))];
  for (let seed = 0; seed < 20; seed++) {
    const party = randomParty(twins, rng(seed));
    assert.equal(new Set(party.map((e) => e.finalID)).size, party.length);
    assert.equal(party.length, roster.length);
  }
});

test('a random party takes the shiny or the plain one of a species, never both', () => {
  const both = [...roster, ...roster.map((e) => ({ ...e, id: `${e.id}-twin`, shiny: !e.shiny }))];
  const variants = new Set();
  for (let seed = 0; seed < 40; seed++) {
    const party = randomParty(both, rng(seed));
    assert.equal(new Set(party.map((e) => e.finalID)).size, party.length);
    for (const e of party) variants.add(`${e.finalID}:${!!e.shiny}`);
  }
  assert.equal(variants.size, roster.length * 2);
});

test('a small roster gives every mon it has, without repeats', () => {
  const party = randomParty(roster, rng('small'));
  assert.equal(party.length, roster.length);
  assert.equal(new Set(party.map((e) => e.id)).size, roster.length);
});

test('random moves and ability are legal for each species', () => {
  for (let seed = 0; seed < 20; seed++) {
    for (const e of randomParty(bigRoster, rng(seed))) {
      const usable = learnedMoves(e).filter((id) => moveData(id).supported);
      if (usable.length) {
        assert.ok(validMoveset(e, e.moveset));
        assert.equal(e.moveset.length, Math.min(MOVES_PER_FIGHTER, usable.length));
      }
      const options = abilityOptions(e).map((a) => a.key);
      if (options.length) {
        assert.ok(options.includes(e.abilityChoice));
        assert.equal(abilityFor(e), e.abilityChoice);
      }
    }
  }
});

test('randomize ignores the trainer edits and does not touch the original', () => {
  const original = { ...roster[0], moveset: ['not-a-move'], abilityChoice: 'not-an-ability' };
  const out = randomize(original, rng('r'));
  assert.notEqual(out.moveset?.[0], 'not-a-move');
  assert.notEqual(out.abilityChoice, 'not-an-ability');
  assert.deepEqual(original.moveset, ['not-a-move']);
});

const pikachu = (extra) => ({ id: 'pika', finalID: 25, baseID: 25, rarity: 'rare', level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 }, ...extra });

test('a saved move that does not work is swapped for another learned one at random', () => {
  const e = pikachu({ learned: ['fling'], moveset: ['thunderbolt', 'fling', 'quick-attack'] });
  const moves = movesetFor(e);
  assert.equal(moves.length, 3);
  assert.equal(moves[0], 'thunderbolt');
  assert.equal(moves[2], 'quick-attack');
  assert.ok(!moves.includes('fling'));
  assert.ok(validMoveset(e, moves));
  assert.deepEqual(movesetFor(e), moves);
});

test('with no other move to learn it is left with fewer moves', () => {
  const ditto: any = { id: 'ditto', finalID: 132, baseID: 132, rarity: 'common', level: 50, learned: ['fling'], moveset: ['transform', 'fling'] };
  assert.deepEqual(movesetFor(ditto), ['transform']);
});

test('valid saved moves are kept as they are', () => {
  const e = pikachu({ moveset: ['thunderbolt', 'agility'] });
  assert.deepEqual(movesetFor(e), ['thunderbolt', 'agility']);
});

test('a saved ability with no effect is swapped for another of the species that works', () => {
  const meowth: any = { id: 'm', finalID: 52, baseID: 52, rarity: 'common', level: 20, ivs: {}, ability: 'pickup' };
  assert.ok(!usableAbility('pickup'));
  const got = abilityFor(meowth);
  assert.ok(usableAbility(got));
  assert.ok(abilityOptions(meowth).some((a) => a.key === got));
});

test('a species whose abilities all lack an effect fights without ability', () => {
  const dedenne: any = { id: 'd', finalID: 702, baseID: 702, rarity: 'rare', level: 30, ivs: { hp: 1, atk: 1, def: 1, spd: 1 }, ability: 'cheek-pouch' };
  assert.equal(abilityFor(dedenne), null);
  assert.equal(buildFighter(dedenne).ability, null);
  assert.equal(randomAbility(dedenne, rng(1)), null);
});

test('random battles never roll a move or ability without effect', () => {
  for (let seed = 0; seed < 30; seed++) {
    for (const e of randomParty(bigRoster, rng(seed))) {
      const f = buildFighter(e);
      assert.ok(f.moves.every((m) => m.supported));
      assert.ok(f.ability === null || usableAbility(f.ability));
    }
  }
});

test('attacks that depend on the state of the battle are not sure damage', () => {
  for (const id of ['dream-eater', 'snore', 'fake-out', 'sucker-punch', 'counter', 'last-resort', 'fissure', 'burn-up'])
    assert.equal(alwaysDamages(id), false, id);
  for (const id of ['thunderbolt', 'tackle', 'seismic-toss', 'super-fang', 'low-kick'])
    assert.equal(alwaysDamages(id), true, id);
  for (const id of ['swords-dance', 'toxic'])
    assert.equal(alwaysDamages(id), false, id);
});

const sureAttacks = (entry) => entry.moveset.filter(alwaysDamages).length;
const canHaveTwo = (entry) => usableMovepool(entry).filter(alwaysDamages).length >= GUARANTEED_ATTACKS;

test('every rolled Pokémon gets at least two attacks that always do damage', () => {
  for (let seed = 0; seed < 40; seed++)
    for (const entry of randomParty(bigRoster, rng(seed)))
      if (canHaveTwo(entry)) assert.ok(sureAttacks(entry) >= GUARANTEED_ATTACKS, `${entry.finalID} ${entry.moveset}`);
});

test('the AI parties always roll two sure attacks per Pokémon', () => {
  for (let seed = 0; seed < 10; seed++) {
    for (const entry of buildAiRandomParty({ random: rng(`ai-${seed}`) })) assert.ok(sureAttacks(entry) >= GUARANTEED_ATTACKS, `${entry.finalID}`);
    for (const level of AI_LEVELS)
      for (const entry of buildAiTeam({ difficulty: level, random: rng(`${level}-${seed}`) })) assert.ok(sureAttacks(entry) >= GUARANTEED_ATTACKS, `${entry.finalID}`);
  }
});

const randomPreview = (entries = randomParty(bigRoster, rng('preview'))) =>
  createPreview({ mode: 'random', sides: [{ trainerId: 'a', name: 'A', entries }, { trainerId: 'b', name: 'B', entries: randomParty(bigRoster, rng('rival')) }] });

test('a reroll swaps the chosen Pokémon for another species of the collection, once', () => {
  const preview = randomPreview();
  const before = preview.sides[0].entries.map((entry) => entry.finalID);
  assert.ok(canReroll(preview, 0));
  reroll(preview, 0, 2, bigRoster, rng('swap'));
  const after = preview.sides[0].entries.map((entry) => entry.finalID);
  assert.ok(!before.includes(after[2]), 'a species it did not have');
  assert.deepEqual(after.filter((_, i) => i !== 2), before.filter((_, i) => i !== 2), 'the rest stays');
  assert.equal(new Set(after).size, after.length);
  assert.equal(canReroll(preview, 0), false);
  assert.equal(previewView(preview, 0).sides[0].rerolled, 2);
  assert.throws(() => reroll(preview, 0, 1, bigRoster), /Ya usaste/);
  assert.ok(canReroll(preview, 1), 'the rival keeps its own');
});

test('with nothing else in the collection the reroll gives the same Pokémon new dice', () => {
  const entries = randomParty(bigRoster.slice(0, 6), rng('six'));
  const preview = randomPreview(entries);
  reroll(preview, 0, 0, bigRoster.slice(0, 6), rng('again'));
  assert.equal(preview.sides[0].entries[0].finalID, entries[0].finalID);
});

test('no reroll in a team battle, after confirming the picks or out of the party', () => {
  const team = createPreview({ sides: [{ trainerId: 'a', name: 'A', entries: bigRoster.slice(0, 6) }, { trainerId: 'b', name: 'B', entries: bigRoster.slice(6) }] });
  assert.equal(canReroll(team, 0), false);
  assert.throws(() => reroll(team, 0, 0, bigRoster), /aleatorias/);
  const preview = randomPreview();
  assert.throws(() => reroll(preview, 0, 9, bigRoster), /no está/);
  pick(preview, 0, [0, 1, 2]);
  assert.equal(canReroll(preview, 0), false);
  assert.throws(() => reroll(preview, 0, 3, bigRoster), /Ya elegiste/);
});

test('a reroll drops the swapped slot from the draft', () => {
  const preview = randomPreview();
  preview.sides[0].draft = [1, 4];
  reroll(preview, 0, 4, bigRoster, rng('draft'));
  assert.deepEqual(preview.sides[0].draft, [1]);
});

test('the AI rerolls from its own dice, the hard ones their weakest Pokémon', () => {
  const own = buildAiRandomParty({ random: rng('ai-reroll') });
  const candidates = aiRerollCandidates(own);
  const taken = new Set(own.map((entry) => entry.finalID));
  assert.ok(candidates.length && candidates.every((entry) => !taken.has(entry.finalID)));
  const index = aiRerollIndex({ difficulty: 'veryhard', own });
  assert.ok(index >= 0 && index < own.length);
  for (let seed = 0; seed < 10; seed++) {
    const easy = aiRerollIndex({ difficulty: 'easy', own, random: rng(seed) });
    assert.ok(easy >= 0 && easy < own.length);
  }
});

test('the dice roll a nature too, and the stats follow it', () => {
  const rolled = new Set();
  for (let seed = 0; seed < 30; seed++)
    for (const entry of randomParty(bigRoster, rng(seed))) {
      assert.ok(NATURE_NAMES.has(entry.natureChoice));
      assert.equal(buildFighter(entry).nature, entry.natureChoice);
      rolled.add(entry.natureChoice);
    }
  assert.ok(rolled.size > 10);
});

test('Hidden Power takes its type from the nature, always with 60 power', () => {
  const quirky = buildFighter(pikachu({ nature: 'quirky', moveset: ['hidden-power'] })).moves[0];
  assert.equal(quirky.type, 'psychic');
  assert.equal(quirky.power, 60);
  assert.equal(buildFighter(pikachu({ nature: 'quirky', natureChoice: 'brave', moveset: ['hidden-power'] })).moves[0].type, 'fire', 'the chosen nature wins');
  const shown = movepool(pikachu({ nature: 'calm', learned: ['hidden-power'] })).find((move) => move.key === 'hidden-power');
  assert.equal(shown?.type, 'ice', 'the collection screen shows the same type the battle uses');
});

test('every nature gives Hidden Power a type, and every type but Normal has one or two natures', () => {
  const byType = new Map();
  for (const nature of NATURE_NAMES) {
    const type = hiddenPowerType(nature);
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }
  assert.equal(byType.size, 17);
  assert.ok(!byType.has('normal'));
  assert.ok([...byType.values()].every((count) => count >= 1 && count <= 2));
});

test('a nature raises one stat and lowers another by a tenth, and the choice beats the save', () => {
  const plain = buildFighter(pikachu({ nature: 'hardy' }));
  const timid = buildFighter(pikachu({ nature: 'hardy', natureChoice: 'timid' }));
  assert.equal(timid.nature, 'timid');
  assert.equal(timid.stats.spd, Math.floor(plain.stats.spd * 1.1));
  assert.equal(timid.stats.atk, Math.floor(plain.stats.atk * 0.9));
  assert.equal(timid.stats.hp, plain.stats.hp);
  assert.equal(timid.stats.def, plain.stats.def);
});

test('the dice spend every EV, never more than 252 on one stat', () => {
  for (let seed = 0; seed < 20; seed++) {
    const evs = randomEvs(rng(`evs-${seed}`));
    assert.equal(Object.values(evs).reduce((sum, value) => sum + value, 0), 510);
    assert.ok(Object.values(evs).every((value) => value >= 0 && value <= 252));
  }
  for (const entry of randomParty(bigRoster, rng('party-evs'))) assert.equal(Object.values(entry.evs).reduce((sum, value) => sum + value, 0), 510);
});

test('every Pokémon fights with perfect IVs, whatever its save says', () => {
  const weak = buildFighter(pikachu({ ivs: { hp: 0, atk: 0, def: 0, satk: 0, sdef: 0, spd: 0 } }));
  const strong = buildFighter(pikachu({ ivs: { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 } }));
  assert.deepEqual(weak.stats, strong.stats);
});

test('EVs add a point to the stat for every 4 invested', () => {
  const plain = buildFighter(pikachu({ nature: 'hardy' }));
  const trained = buildFighter(pikachu({ nature: 'hardy', evs: { hp: 4, atk: 252, def: 0, satk: 0, sdef: 0, spd: 254 } }));
  assert.equal(trained.stats.atk - plain.stats.atk, 63);
  assert.equal(trained.stats.hp - plain.stats.hp, 1);
  assert.equal(trained.stats.spd - plain.stats.spd, 63);
});

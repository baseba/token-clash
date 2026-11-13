import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit } from '../server/battle.js';
import { rng, genderFor, buildFighter, speciesData } from '../server/creatures.js';

test('gender follows the real ratio of each species', () => {
  assert.equal(speciesData(25).genderRate, 4);
  assert.equal(genderFor({ id: 'a', finalID: 81, gender: 'male' }), null);
  assert.equal(genderFor({ id: 'b', finalID: 113 }), 'female');
  assert.equal(genderFor({ id: 'c', finalID: 32, gender: 'female' }), 'male');
  assert.equal(genderFor({ id: 'd', finalID: 25, gender: 'female' }), 'female');
  const pikachus = Array.from({ length: 200 }, (_, i) => genderFor({ id: `p${i}`, finalID: 25 }));
  assert.ok(pikachus.includes('male') && pikachus.includes('female'));
  assert.deepEqual(pikachus, Array.from({ length: 200 }, (_, i) => genderFor({ id: `p${i}`, finalID: 25 })));
  assert.equal(buildFighter({ id: 'e', finalID: 29, level: 20, ivs: {} }).gender, 'female');
});

const mon = (id, finalID) => ({ id, finalID, baseID: finalID, rarity: 'common', level: 50, ivs: { hp: 15, atk: 15, def: 15, spd: 15 }, learned: ['attract', 'growl'], moveset: ['attract', 'growl'], abilityChoice: 'rivalry' });

function attract(user, target) {
  const b = createBattle({ id: 'x', random: rng(1), sides: [{ trainerId: 'a', name: 'A', entries: [user] }, { trainerId: 'b', name: 'B', entries: [target] }] });
  const idx = (s, key) => b.sides[s].team[0].moves.findIndex((m) => m.key === key);
  submit(b, 0, { type: 'move', move: idx(0, 'attract') });
  return submit(b, 1, { type: 'move', move: idx(1, 'growl') });
}

test('Atracción needs a male and a female, and says why when it fails', () => {
  const works = attract(mon('m', 32), mon('f', 29));
  assert.ok(works.some((e) => e.t === 'volatile' && e.kind === 'attract' && e.side === 1));
  const same = attract(mon('m1', 32), mon('m2', 32));
  assert.ok(same.some((e) => e.t === 'nothing' && e.reason === 'sameGender'));
  const none = attract({ ...mon('g', 81), abilityChoice: 'sturdy' }, mon('f', 29));
  assert.ok(none.some((e) => e.t === 'nothing' && e.reason === 'genderless'));
});

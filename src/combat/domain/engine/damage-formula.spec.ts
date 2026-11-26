import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseDamage, damageRoll, finishDamage, pokeRound } from './damage.js';

const plain = { weather: 1, crit: false, roll: 100, stab: 1, eff: 1, burned: false, final: 1 };

test('the base damage truncates each step like the games', () => {
  assert.equal(baseDamage(75, 65, 123, 163), 33);
  assert.equal(baseDamage(100, 90, 200, 200), 77);
});

test('a level 75 Glaceon biting a Garchomp with Ice Fang does 168 to 196, as in Bulbapedia', () => {
  const base = baseDamage(75, 65, 123, 163);
  const hit = (roll: number) => finishDamage(base, { ...plain, roll, stab: 1.5, eff: 4 });
  assert.equal(hit(85), 168);
  assert.equal(hit(100), 196);
});

test('the roll takes one of 16 whole values from 85 to 100', () => {
  assert.equal(damageRoll(0), 85);
  assert.equal(damageRoll(0.999), 100);
  assert.equal(new Set(Array.from({ length: 1000 }, (_, i) => damageRoll(i / 1000))).size, 16);
});

test('halves round down, a critical hit is 1.5 and a burn halves the physical damage', () => {
  assert.equal(pokeRound(10.5), 10);
  assert.equal(pokeRound(10.51), 11);
  assert.equal(finishDamage(40, { ...plain, crit: true }), 60);
  assert.equal(finishDamage(40, { ...plain, burned: true }), 20);
  assert.equal(finishDamage(40, { ...plain, final: 0.5 }), 20);
  assert.equal(finishDamage(1, { ...plain, roll: 85, eff: 0.25 }), 1, 'a hit always does at least 1');
});

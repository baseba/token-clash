import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recycledTokens, recycleReward, RECYCLE_TOKENS, SHINY_RECYCLE_MULTIPLIER } from './recycling.js';
import { Trainer } from './trainer.js';
import { DomainError } from '../../shared/domain/errors.js';

const duplicate = (id: string, rarity: 'common' | 'uncommon' | 'rare' | 'legendary' = 'common', shiny = false) => ({ id, finalID: 25, rarity, shiny, level: 50 });

const withDuplicates = (...duplicates: ReturnType<typeof duplicate>[]) => {
  const trainer = Trainer.register({ id: 't1', name: 'Ana', tokenHash: 'h', passwordHash: 'p', at: 0 });
  trainer.importSave({ roster: [], duplicates, totalTokens: 1_000_000_000 }, 1);
  return trainer;
};

test('a rarer repeat gives more tokens, and a shiny gives the triple', () => {
  assert.ok(RECYCLE_TOKENS.common < RECYCLE_TOKENS.uncommon && RECYCLE_TOKENS.uncommon < RECYCLE_TOKENS.rare && RECYCLE_TOKENS.rare < RECYCLE_TOKENS.legendary);
  assert.equal(recycleReward({ rarity: 'rare', shiny: false }), RECYCLE_TOKENS.rare);
  assert.equal(recycleReward({ rarity: 'rare', shiny: true }), RECYCLE_TOKENS.rare * SHINY_RECYCLE_MULTIPLIER);
  assert.equal(recycledTokens([{ id: 'a', finalID: 1, rarity: 'common', shiny: false, tokens: 5, at: 0 }, { id: 'b', finalID: 1, rarity: 'common', shiny: false, tokens: 7, at: 0 }]), 12);
});

test('recycling a repeat adds its tokens to the balance and logs it', () => {
  const trainer = withDuplicates(duplicate('a', 'legendary'), duplicate('b'));
  const before = trainer.balance;
  const record = trainer.recycle('a', 10);
  assert.deepEqual({ id: record.id, tokens: record.tokens, at: record.at }, { id: 'a', tokens: RECYCLE_TOKENS.legendary, at: 10 });
  assert.equal(trainer.balance, before + RECYCLE_TOKENS.legendary);
  assert.deepEqual(trainer.recyclable.map((d) => d.id), ['b']);
});

test('a repeat goes through the shredder only once, even after importing the save again', () => {
  const trainer = withDuplicates(duplicate('a'));
  trainer.recycle('a', 10);
  assert.throws(() => trainer.recycle('a', 11), DomainError);
  trainer.importSave({ roster: [], duplicates: [duplicate('a'), duplicate('c')], totalTokens: 1_000_000_000 }, 12);
  assert.deepEqual(trainer.recyclable.map((d) => d.id), ['c']);
  assert.throws(() => trainer.recycle('a', 13), DomainError);
});

test('only repeats of the last save can be recycled', () => {
  const trainer = withDuplicates(duplicate('a'));
  assert.throws(() => trainer.recycle('kept-in-roster', 10), DomainError);
});

test('what was recycled at the old rate is topped up to the current one, once', () => {
  const trainer = withDuplicates(duplicate('a', 'rare'), duplicate('b'));
  trainer.recycle('a', 10);
  trainer.recycle('b', 11);
  trainer.recycled = trainer.recycled!.map((record) => ({ ...record, tokens: record.tokens / 2 }));
  const before = trainer.balance;
  assert.equal(trainer.topUpRecycled(), (RECYCLE_TOKENS.rare + RECYCLE_TOKENS.common) / 2);
  assert.equal(trainer.balance, before + (RECYCLE_TOKENS.rare + RECYCLE_TOKENS.common) / 2);
  assert.equal(trainer.topUpRecycled(), 0);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trainer } from './trainer.js';
import { TRAINER_SPRITES } from '../../catalog/domain/trainer-sprites.js';

const fresh = (id = 't1') => Trainer.register({ id, name: 'Ana', tokenHash: 'h', at: 0 });

test('a trainer looks like one of the trainer sprites until they pick one, always the same', () => {
  const ana = fresh();
  assert.ok(TRAINER_SPRITES.includes(ana.look));
  assert.equal(fresh().look, ana.look);
  ana.chooseAvatar('cynthia');
  assert.equal(ana.look, 'cynthia');
});

test('only a trainer sprite can be picked', () => {
  const ana = fresh();
  for (const key of ['trainer_m_back', 'nadie', '../x']) assert.throws(() => ana.chooseAvatar(key), /no existe/);
  assert.equal(ana.avatar, undefined);
});

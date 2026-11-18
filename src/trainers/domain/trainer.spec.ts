import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Trainer } from './trainer.js';
import { STARTER_SPRITES, TRAINER_SPRITES } from '../../catalog/domain/trainer-sprites.js';

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

const withTokens = (total: number, baseline = 0) => Trainer.restore({ id: 't9', name: 'Ana', tokenHash: 'h', roster: [], team: [], wins: 0, losses: 0, totalTokens: total, createdAt: 0, shopBaseline: baseline });

test('the shop balance is what the save gained since the shop opened, minus what was spent', () => {
  const ana = withTokens(500_000_000, 300_000_000);
  assert.equal(ana.balance, 200_000_000);
  ana.buy('ball:gb');
  assert.equal(ana.balance, 100_000_000);
  assert.ok(ana.owns('ball:gb'));
  assert.throws(() => ana.buy('ball:gb'), /Ya lo tienes/);
  assert.throws(() => ana.buy('ball:mb'), /No te alcanzan/);
  assert.throws(() => ana.buy('ball:xx'), /no existe/);
});

test('the balance is every token the save has used, and a reset save keeps what was already there', () => {
  const fresh = Trainer.register({ id: 'n1', name: 'Nuevo', tokenHash: 'h', at: 0 });
  fresh.importSave({ roster: [], totalTokens: 900_000_000 } as any, 1);
  assert.equal(fresh.balance, 900_000_000);
  fresh.buy('ball:gb');
  assert.equal(fresh.balance, 800_000_000);
  fresh.importSave({ roster: [], totalTokens: 50_000_000 } as any, 2);
  assert.equal(fresh.balance, 800_000_000);
  fresh.importSave({ roster: [], totalTokens: 150_000_000 } as any, 3);
  assert.equal(fresh.balance, 900_000_000);
});

test('only bought items can be equipped, and taking one off goes back to the default', () => {
  const ana = withTokens(2_000_000_000);
  assert.equal(ana.ball, 'pb');
  assert.throws(() => ana.equip('ball', 'ub'), /cómpralo/);
  ana.buy('ball:ub');
  ana.equip('ball', 'ub');
  assert.equal(ana.ball, 'ub');
  ana.buy('frame:gold');
  ana.equip('frame', 'gold');
  ana.equip('ball', null);
  assert.equal(ana.ball, 'pb');
  assert.deepEqual(ana.equipped, { frame: 'gold' });
});

test('a shop trainer must be bought to be picked; one picked before it went on sale is swapped for a free one', () => {
  const ana = withTokens(2_000_000_000);
  assert.throws(() => ana.chooseAvatar('jacinthe_holo'), /se compra en tu perfil/);
  ana.buy('trainer:jacinthe_holo');
  ana.chooseAvatar('jacinthe_holo');
  assert.equal(ana.releaseShopLook(), false);
  const old = Trainer.restore({ id: 'o1', name: 'Beto', tokenHash: 'h', roster: [], team: [], wins: 0, losses: 0, totalTokens: 0, createdAt: 0, avatar: 'nate' });
  assert.equal(old.releaseShopLook(), true);
  assert.ok(STARTER_SPRITES.includes(old.look));
});

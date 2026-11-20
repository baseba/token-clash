import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SESSIONS, nameKey, Trainer } from './trainer.js';
import { STARTER_SPRITES, TRAINER_SPRITES } from '../../catalog/domain/trainer-sprites.js';

const fresh = (id = 't1') => Trainer.register({ id, name: 'Ana', tokenHash: 'h', passwordHash: 'p', at: 0 });

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
  const fresh = Trainer.register({ id: 'n1', name: 'Nuevo', tokenHash: 'h', passwordHash: 'p', at: 0 });
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

test('a recolor on sale must be bought to be picked; one worn without buying it is swapped for a default one', () => {
  const ana = withTokens(6_000_000_000);
  assert.throws(() => ana.chooseAvatar('leon_shadow'), /se compra en tu perfil/);
  ana.buy('trainer:leon_shadow');
  ana.chooseAvatar('leon_shadow');
  assert.equal(ana.releaseShopLook(), false);
  const old = Trainer.restore({ id: 'o1', name: 'Beto', tokenHash: 'h', roster: [], team: [], wins: 0, losses: 0, totalTokens: 0, createdAt: 0, avatar: 'leon_shadow' });
  assert.equal(old.releaseShopLook(), true);
  assert.ok(STARTER_SPRITES.includes(old.look));
});

test('a trainer that left the shop gives back what was paid for it, once', () => {
  const beto = Trainer.restore({ id: 'b1', name: 'Beto', tokenHash: 'h', roster: [], team: [], wins: 0, losses: 0, totalTokens: 2_000_000_000, createdAt: 0, shopSpent: 400_000_000, owned: ['trainer:nate', 'ball:gb'] });
  const before = beto.balance;
  assert.equal(beto.refundRetired({ nate: 300_000_000 }), 300_000_000);
  assert.equal(beto.balance, before + 300_000_000);
  assert.deepEqual(beto.owned, ['ball:gb']);
  assert.equal(beto.refundRetired({ nate: 300_000_000 }), 0);
});

test('a free Ball is owned by everyone and can be equipped without buying it', () => {
  const ana = Trainer.register({ id: 'f1', name: 'Ana', tokenHash: 'h', passwordHash: 'p', at: 0 });
  for (const key of ['mt', 'sk', 'oc', 'li', 'ma']) assert.ok(ana.owns(`ball:${key}`), key);
  assert.ok(!ana.owns('ball:gb'), 'a common one still has to be bought');
  ana.equip('ball', 'oc');
  assert.equal(ana.ball, 'oc');
});

test('each device logged in with the password gets its own session, up to a limit', () => {
  const ana = fresh();
  ana.openSession('phone', 1);
  ana.openSession('laptop', 2);
  assert.deepEqual(ana.sessionHashes, ['h', 'phone', 'laptop']);
  for (let i = 0; i < MAX_SESSIONS; i++) ana.openSession(`device-${i}`, 3 + i);
  assert.equal(ana.sessions!.length, MAX_SESSIONS);
  assert.ok(!ana.sessionHashes.includes('phone'), 'the oldest login is the one that expires');
  assert.ok(ana.sessionHashes.includes('h'), 'the device that created the account keeps its session');
});

test('logging out closes only that device, and the first device can log out too', () => {
  const ana = fresh();
  ana.openSession('phone', 1);
  ana.closeSession('phone', 'unused');
  assert.deepEqual(ana.sessionHashes, ['h']);
  ana.closeSession('h', 'replacement');
  assert.deepEqual(ana.sessionHashes, ['replacement']);
});

test('an account without a password cannot log out: it could never come back', () => {
  const old = Trainer.restore({ id: 'o2', name: 'Beto', tokenHash: 'h', roster: [], team: [], wins: 0, losses: 0, totalTokens: 0, createdAt: 0 });
  assert.equal(old.hasPassword, false);
  assert.throws(() => old.closeSession('h', 'replacement'), /contraseña/);
  old.setPassword('hash');
  assert.equal(old.hasPassword, true);
});

test('two names are the same name when they differ only in case or spacing', () => {
  assert.equal(nameKey('  Ana   Ketchum '), nameKey('ana ketchum'));
  assert.equal(nameKey('ÁNGEL'), nameKey('ángel'));
  assert.notEqual(nameKey('Ángel'), nameKey('Angel'), 'an accent makes another name');
  assert.equal(nameKey('Ana\u200f'), nameKey('Ana'), 'invisible characters do not make another name');
});

test('a renamed or merged trainer keeps whoever had it: the owned key and the worn one move to the new name', () => {
  const ana = Trainer.restore({ id: 'a1', name: 'Ana', tokenHash: 'h', roster: [], team: [], wins: 0, losses: 0, totalTokens: 0, createdAt: 0, avatar: 'snow_worker_f', owned: ['trainer:aether_grunt_f__lime', 'trainer:aether_grunt_f__peach', 'ball:gb'] });
  assert.equal(ana.renameTrainers({ snow_worker_f: 'worker_f', aether_grunt_f__lime: 'aether_grunt_f__peach' }), true);
  assert.equal(ana.look, 'worker_f');
  assert.deepEqual(ana.owned, ['trainer:aether_grunt_f__peach', 'ball:gb']);
  assert.equal(ana.renameTrainers({ snow_worker_f: 'worker_f' }), false);
});

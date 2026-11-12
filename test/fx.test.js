import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveShape, SHAPE_NAMES } from '../public/fx.js';
import { MOVE_INFO } from '../server/moves.js';
import { SUPPORT_MOVES } from '../server/creatures.js';

test('every move in the game has a known visual effect', () => {
  for (const [name, info] of Object.entries(MOVE_INFO)) {
    const support = Object.values(SUPPORT_MOVES).find((m) => m.name === name);
    const ev = { move: name, type: 'normal', kind: support?.kind ?? 'attack', category: info.category, flags: info.flags ?? [], multihit: !!info.multihit, drain: !!info.drain };
    assert.ok(SHAPE_NAMES.includes(moveShape(ev)), `${name} → ${moveShape(ev)}`);
  }
});

test('the effect follows the move: name first, then its flags', () => {
  const ev = (move, extra = {}) => ({ move, type: 'fire', kind: 'attack', category: 'physical', flags: [], ...extra });
  assert.equal(moveShape(ev('Lanzallamas')), 'stream');
  assert.equal(moveShape(ev('Trueno')), 'bolt');
  assert.equal(moveShape(ev('Terremoto')), 'quake');
  assert.equal(moveShape(ev('X', { flags: ['contact', 'bite'] })), 'bite');
  assert.equal(moveShape(ev('X', { flags: ['contact', 'punch'] })), 'punch');
  assert.equal(moveShape(ev('X', { flags: ['contact'] })), 'strike');
  assert.equal(moveShape(ev('X', { category: 'special' })), 'projectile');
  assert.equal(moveShape(ev('Danza Espada', { kind: 'boost' })), 'boost');
  assert.equal(moveShape(ev('Recuperación', { kind: 'heal' })), 'heal');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { moveShape, SHAPE_NAMES } from '../public/fx.js';
import { moveData } from '../server/creatures.js';

const MOVEDEX = JSON.parse(readFileSync(new URL('../server/movedex.json', import.meta.url), 'utf8'));

const eventFor = (m) => ({ move: m.name, key: m.key, type: m.type, kind: m.kind, category: m.category, flags: m.flags, multihit: !!m.multihit, drain: !!m.drain, effect: m.heal ? 'heal' : m.weather ? 'weather' : m.target === 'self' && m.boosts ? 'boost' : 'debuff', stat: m.boosts ? Object.keys(m.boosts)[0] : undefined });

test('every move in the movedex has a known visual effect', () => {
  for (const id of Object.keys(MOVEDEX)) {
    const ev = eventFor(moveData(id));
    assert.ok(SHAPE_NAMES.includes(moveShape(ev)), `${id} → ${moveShape(ev)}`);
  }
});

test('the effect follows the move: id first, then its flags', () => {
  const shape = (id) => moveShape(eventFor(moveData(id)));
  assert.equal(shape('flamethrower'), 'stream');
  assert.equal(shape('thunder'), 'bolt');
  assert.equal(shape('earthquake'), 'quake');
  assert.equal(shape('crunch'), 'bite');
  assert.equal(shape('thunder-punch'), 'punch');
  assert.equal(shape('tackle'), 'strike');
  assert.equal(shape('swords-dance'), 'boost');
  assert.equal(shape('recover'), 'heal');
  assert.equal(shape('rain-dance'), 'weather');
  assert.equal(shape('thunder-wave'), 'psywave');
  assert.equal(shape('growl'), 'sound');
});

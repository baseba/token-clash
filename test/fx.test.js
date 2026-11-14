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
  assert.equal(shape('toxic'), 'psywave');
  assert.equal(shape('growl'), 'sound');
});

test('status moves and special attacks get an effect that matches what they do', () => {
  const shape = (id) => moveShape(eventFor(moveData(id)));
  const expected = {
    attract: 'hearts', charm: 'hearts', 'sweet-kiss': 'hearts',
    'sleep-powder': 'powder', spore: 'powder', 'stun-spore': 'powder',
    defog: 'gust', 'poison-gas': 'gust', smokescreen: 'gust',
    flash: 'flash', 'confuse-ray': 'beam', 'will-o-wisp': 'projectile', 'leech-seed': 'drain', 'string-shot': 'stream',
    'dragon-claw': 'slash', 'shadow-claw': 'slash', 'photon-geyser': 'beam', 'dynamax-cannon': 'beam',
    'thunder-cage': 'bolt', 'volt-switch': 'bolt', 'sheer-cold': 'storm', 'sand-tomb': 'storm',
    'mind-blown': 'blast', 'water-spout': 'eruption', 'thousand-waves': 'quake', 'make-it-rain': 'rain',
  };
  for (const [id, want] of Object.entries(expected)) assert.equal(shape(id), want, id);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPreview, pick, previewView } from '../server/preview.js';

const IV = { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 };
const mon = (finalID, n) => ({ id: `m${finalID}-${n}`, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: IV });
const party = (n) => [25, 6, 9, 3, 143, 94].slice(0, n).map((id, i) => mon(id, i));
const preview = () => createPreview({ sides: [{ trainerId: 'a', name: 'Ana', entries: party(6) }, { trainerId: 'b', name: 'Beto', entries: party(6) }] });

test('players see only names and types of the rival party and never its picks before the reveal', () => {
  const p = preview();
  pick(p, 1, [2, 0, 1]);
  const ana = previewView(p, 0);
  assert.ok(ana.sides[1].party.every((f) => !f.moves && !f.stats));
  assert.equal(ana.sides[1].picks, null);
  assert.ok(ana.sides[0].party.every((f) => f.moves && f.stats));
});

test('spectators see both parties in full and the picks once revealed; players never see the rival picks', () => {
  const p = preview();
  pick(p, 0, [0, 1, 2]);
  const watcher = previewView(p, null);
  assert.ok(watcher.sides.every((side) => side.party.every((f) => f.moves && f.stats)));
  assert.deepEqual(watcher.sides.map((s) => s.picks), [null, null]);
  pick(p, 1, [5, 4, 3]);
  p.revealed = true;
  assert.deepEqual(previewView(p, null).sides.map((s) => s.picks), [[0, 1, 2], [5, 4, 3]]);
  assert.equal(previewView(p, 0).sides[1].picks, null);
  assert.deepEqual(previewView(p, 0).sides[0].picks, [0, 1, 2]);
});

test('only spectators see what each player is selecting before they confirm', () => {
  const p = preview();
  p.sides[0].draft = [3, 1];
  assert.deepEqual(previewView(p, null).sides[0].draft, [3, 1]);
  assert.equal(previewView(p, 1).sides[0].draft, null);
  pick(p, 0, [3, 1, 0]);
  assert.deepEqual(previewView(p, null).sides[0].locked, [3, 1, 0]);
  assert.equal(previewView(p, 1).sides[0].locked, null);
  assert.equal(previewView(p, 1).sides[0].picks, null);
});

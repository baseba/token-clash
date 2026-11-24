import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dropped, stepsOf, walkersOf, withSteps } from '../../scripts/overworld-steps.mjs';

const F = 32;
const blank = () => Buffer.alloc(F * F * 4);
const paint = (frame, x, y, rgb) => frame.set([...rgb, 255], (y * F + x) * 4);
const colour = (frame, x, y) => (frame[(y * F + x) * 4 + 3] ? [...frame.subarray((y * F + x) * 4, (y * F + x) * 4 + 3)] : null);

/** A small figure: a head, a body and two legs, standing on row `feet`, in the given colours. */
function figure({ head, body, leg }, { feet = 27, liftLeft = false } = {}) {
  const frame = blank();
  for (let y = feet - 15; y <= feet - 10; y++) for (let x = 12; x <= 19; x++) paint(frame, x, y, head);
  for (let y = feet - 9; y <= feet - 4; y++) for (let x = 11; x <= 20; x++) paint(frame, x, y, body);
  for (let y = feet - 3; y <= feet; y++) {
    if (!(liftLeft && y === feet)) for (let x = 12; x <= 14; x++) paint(frame, x, y, leg);
    for (let x = 17; x <= 19; x++) paint(frame, x, y, leg);
  }
  return frame;
}

const sheetOf = (frames) => {
  const sheet = { width: F, height: F * 16, rgba: Buffer.alloc(F * F * 16 * 4) };
  frames.forEach((frame, slot) => frame.copy(sheet.rgba, slot * F * F * 4));
  return sheet;
};

const WALKER = { head: [200, 160, 120], body: [40, 80, 200], leg: [30, 30, 60] };
/** An official walker: its steps are its standing frame a pixel lower, with the left foot lifted. */
const walker = () => {
  const idle = figure(WALKER);
  const step = figure(WALKER, { feet: 28, liftLeft: true });
  return sheetOf(Array.from({ length: 16 }, (_, slot) => (slot % 4 === 1 || slot % 4 === 2 ? step : idle)));
};

test('a step drops the whole frame one pixel, as every walking sheet does', () => {
  const frame = blank();
  paint(frame, 5, 10, [1, 2, 3]);
  const out = dropped(frame);
  assert.deepEqual(colour(out, 5, 11), [1, 2, 3]);
  assert.equal(colour(out, 5, 10), null);
});

test('a standing sprite takes the steps of the walker with legs like its own, in its own colours', () => {
  const walkers = walkersOf([walker()]);
  const mine = { head: [240, 200, 170], body: [200, 40, 60], leg: [90, 50, 20] };
  const [step] = stepsOf(figure(mine), walkers[1]);
  assert.deepEqual(colour(step, 15, 13), mine.head, 'the body dropped a pixel');
  assert.equal(colour(step, 13, 28), null, 'the left foot lifts like the walker’s');
  assert.deepEqual(colour(step, 18, 28), mine.leg, 'the right foot is planted, in its own leg colour');
});

test('a sheet that stands gets steps in every direction, the right ones mirroring the left, each frame made once', () => {
  const walkers = walkersOf([walker()]);
  const mine = { head: [240, 200, 170], body: [200, 40, 60], leg: [90, 50, 20] };
  const standing = sheetOf(Array.from({ length: 16 }, () => figure(mine)));
  const memo = new Map();
  const out = withSteps(standing, walkers, memo);
  const frameAt = (slot) => out.rgba.subarray(slot * F * F * 4, (slot + 1) * F * F * 4);
  assert.equal(colour(frameAt(5), 13, 28), null);
  assert.deepEqual(colour(frameAt(13), F - 1 - 13, 28), colour(frameAt(9), 13, 28));
  assert.equal(memo.size, 3);
  withSteps(standing, walkers, memo);
  assert.equal(memo.size, 3, 'the same standing frames are not made again');
});

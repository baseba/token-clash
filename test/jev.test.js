import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit, validActions } from '../server/battle.js';
import { rng } from '../server/creatures.js';
import { jevState, jevOptions, chooseJevAction, jevConfigured } from '../server/jev.js';

const mon = (id, finalID, moves, extra = {}) => ({ id, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 }, learned: moves, moveset: moves, ...extra });
const duel = (a, b) => createBattle({ id: 'j', random: rng(1), sides: [{ trainerId: 'u1', name: 'Ana Secreta', entries: a }, { trainerId: 'ai:skynet', name: 'IA Skynet', entries: b }] });

// A fake Jev: answers with whatever `pick` returns for the criteria it was sent.
function fakeJev(pick, { status = 200 } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const body = JSON.parse(init.body);
    calls.push({ url, headers: init.headers, body });
    const choice = pick(body.questions.action.criteria);
    return new Response(JSON.stringify({ model: body.model, answers: { action: { type: 'choice', choice, confidence: 0.8, probabilities: {} } }, usage: { input_tokens: 1, output_tokens: 1 } }), { status });
  };
  return { calls, fetchImpl };
}

const team = () => duel([mon('v', 3, ['vine-whip', 'sleep-powder']), mon('b', 9, ['surf']), mon('p', 25, ['thunderbolt'])], [mon('c', 6, ['flamethrower', 'air-slash']), mon('g', 130, ['waterfall'])]);

test('every valid action becomes one option, and the answer maps back to it', async () => {
  const b = team();
  const { criteria, actions } = jevOptions(b, 1);
  assert.deepEqual(Object.values(actions), validActions(b, 1));
  assert.deepEqual(Object.keys(criteria).sort(), ['move_0', 'move_1', 'switch_1']);
  assert.equal(criteria.move_0.effectivenessVsOpponent, 'x2');
  const jev = fakeJev(() => 'switch_1');
  assert.deepEqual(await chooseJevAction(b, 1, { apiKey: 'k', fetchImpl: jev.fetchImpl }), { type: 'switch', to: 1 });
  assert.equal(jev.calls[0].headers.Authorization, 'Bearer k');
  assert.equal(jev.calls[0].body.questions.action.type, 'choice');
  submit(b, 0, validActions(b, 0)[0]);
  assert.ok(submit(b, 1, await chooseJevAction(b, 1, { apiKey: 'k', fetchImpl: fakeJev(() => 'move_0').fetchImpl })));
});

test('Jev only sees what that side could see: no names, hidden Pokémon or rival stats', () => {
  const b = team();
  const json = JSON.stringify(jevState(b, 1));
  assert.ok(!json.includes('Ana Secreta') && !json.includes('u1'), 'trainer data leaked');
  const state = jevState(b, 1);
  assert.equal(state.rival.active.species, 'Venusaur');
  assert.equal(state.rival.active.stats, undefined);
  assert.equal(state.rival.active.revealedMoves, undefined);
  assert.deepEqual(state.rival.others, [{ unknown: true }, { unknown: true }]);
  assert.equal(state.mine.active.moves.length, 2);
  assert.ok(state.mine.active.stats.speed > 0);
});

test('when Jev fails, times out or answers nonsense, Skynet gets no answer and falls back', async () => {
  const b = team();
  const warn = console.warn;
  console.warn = () => {};
  try {
    assert.equal(await chooseJevAction(b, 1, { apiKey: 'k', fetchImpl: fakeJev(() => 'move_0', { status: 529 }).fetchImpl }), null);
    assert.equal(await chooseJevAction(b, 1, { apiKey: 'k', fetchImpl: fakeJev(() => 'move_9').fetchImpl }), null);
    assert.equal(await chooseJevAction(b, 1, { apiKey: 'k', fetchImpl: async () => { throw new TypeError('fetch failed'); } }), null);
    // Holds a timer so the test process stays alive until the (unref'd) abort fires.
    const slow = (url, init) => new Promise((_, reject) => {
      const hold = setTimeout(() => {}, 5_000);
      init.signal.addEventListener('abort', () => (clearTimeout(hold), reject(init.signal.reason)));
    });
    assert.equal(await chooseJevAction(b, 1, { apiKey: 'k', fetchImpl: slow, timeoutMs: 20 }), null);
  } finally {
    console.warn = warn;
  }
});

test('without a key (behind the proxy) no Authorization header is sent', async () => {
  const jev = fakeJev(() => 'move_0');
  assert.deepEqual(await chooseJevAction(team(), 1, { fetchImpl: jev.fetchImpl }), { type: 'move', move: 0 });
  assert.equal(jev.calls[0].headers.Authorization, undefined);
});

test('Skynet is on with a key or a proxy URL, off with neither', () => {
  assert.equal(jevConfigured({}), false);
  assert.equal(jevConfigured({ JEV_API_KEY: 'k' }), true);
  assert.equal(jevConfigured({ JEV_API_URL: 'http://token-clash-jev:8081/v1/systemone' }), true);
});

test('a forced choice does not ask Jev', async () => {
  const b = duel([mon('v', 3, ['vine-whip'])], [mon('c', 6, ['flamethrower'])]);
  const jev = fakeJev(() => 'move_0');
  assert.deepEqual(await chooseJevAction(b, 1, { apiKey: 'k', fetchImpl: jev.fetchImpl }), { type: 'move', move: 0 });
  assert.equal(jev.calls.length, 0);
});

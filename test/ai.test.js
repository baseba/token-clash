import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBattle, submit, validActions, needsAction } from '../server/battle.js';
import { rng, buildFighter, speciesData } from '../server/creatures.js';
import { AI_LEVELS, LAST_AI_SPECIES, buildAiTeam, buildAiRandomParty, aiPicks, chooseAction } from '../server/ai.js';

const fullyEvolved = (id) => {
  const d = speciesData(id);
  return d.chainLen == null || d.stage == null || d.stage >= d.chainLen - 1;
};

test('every difficulty builds six distinct Pokémon from generations 1 to 5 with moves that work', () => {
  for (const difficulty of AI_LEVELS) {
    for (let seed = 0; seed < 5; seed++) {
      const team = buildAiTeam({ difficulty, level: 50, random: rng(`${difficulty}:${seed}`) });
      assert.equal(team.length, 6, difficulty);
      assert.equal(new Set(team.map((e) => e.finalID)).size, 6, difficulty);
      for (const e of team) {
        assert.ok(e.finalID >= 1 && e.finalID <= LAST_AI_SPECIES, `${difficulty}: #${e.finalID}`);
        const f = buildFighter(e);
        assert.ok(f.moves.length >= 1 && f.moves.every((m) => m.supported), `${difficulty}: ${f.name}`);
        if (difficulty !== 'easy') assert.ok(fullyEvolved(e.finalID), `${difficulty}: ${f.name} no está evolucionado`);
      }
    }
  }
});

test('harder AIs give their Pokémon better IVs and attacks of more than one type', () => {
  const easy = buildAiTeam({ difficulty: 'easy', level: 50, random: rng(1) });
  const hard = buildAiTeam({ difficulty: 'veryhard', level: 50, random: rng(1) });
  assert.ok(hard[0].ivs.atk > easy[0].ivs.atk);
  for (const e of hard) {
    const attackTypes = new Set(buildFighter(e).moves.filter((m) => m.kind === 'attack').map((m) => m.type));
    assert.ok(attackTypes.size >= Math.min(2, buildFighter(e).moves.filter((m) => m.kind === 'attack').length), buildFighter(e).name);
  }
});

test('the AI builds its team and picks its three without looking at yours', () => {
  const water = [7, 8, 9, 54, 55, 60].map((finalID) => ({ finalID }));
  const fire = [4, 5, 6, 37, 38, 58].map((finalID) => ({ finalID }));
  for (const difficulty of AI_LEVELS) {
    const a = buildAiTeam({ difficulty, level: 50, foes: water, random: rng(`t:${difficulty}`) });
    const b = buildAiTeam({ difficulty, level: 50, foes: fire, random: rng(`t:${difficulty}`) });
    assert.deepEqual(a, b, difficulty);
    assert.deepEqual(aiPicks({ difficulty, own: a, foes: water, random: rng(9) }), aiPicks({ difficulty, own: a, foes: fire, random: rng(9) }), difficulty);
  }
});

test('the hard AIs still bring strong Pokémon, but not always the same ones', () => {
  const teams = [0, 1, 2, 3].map((seed) => buildAiTeam({ difficulty: 'veryhard', level: 50, random: rng(`v:${seed}`) }).map((e) => e.finalID).sort().join());
  assert.ok(new Set(teams).size > 1);
  for (const t of teams) for (const id of t.split(',')) assert.ok(speciesData(Number(id)).stats.reduce((a, x) => a + x, 0) >= 500);
});

test('the random party of the AI comes from generations 1 to 5 too', () => {
  const party = buildAiRandomParty({ level: 40, random: rng(3) });
  assert.equal(party.length, 6);
  assert.ok(party.every((e) => e.finalID <= LAST_AI_SPECIES && e.level === 40));
});

test('the AI always takes three distinct Pokémon to the battle', () => {
  const own = buildAiTeam({ difficulty: 'hard', level: 50, random: rng(5) });
  const foes = buildAiTeam({ difficulty: 'easy', level: 50, random: rng(6) });
  for (const difficulty of AI_LEVELS) {
    const picks = aiPicks({ difficulty, own, foes, random: rng(7) });
    assert.equal(picks.length, 3);
    assert.equal(new Set(picks).size, 3);
    assert.ok(picks.every((i) => i >= 0 && i < own.length));
  }
});

const mon = (id, finalID, moves, extra = {}) => ({ id, finalID, baseID: finalID, rarity: 'rare', level: 50, ivs: { hp: 20, atk: 20, def: 20, satk: 20, sdef: 20, spd: 20 }, learned: moves, moveset: moves, ...extra });
const duel = (a, b, seed = 1) => createBattle({ id: 'x', random: rng(seed), sides: [{ trainerId: 'ai:a', name: 'A', entries: a }, { trainerId: 'ai:b', name: 'B', entries: b }] });
const moveKey = (b, s, action) => b.sides[s].team[b.sides[s].active].moves[action.move]?.key;

test('from medium up, the AI never wastes a turn on a move the rival is immune to', () => {
  const pika = mon('p', 25, ['thunderbolt', 'quick-attack']);
  const sandslash = mon('s', 28, ['scratch'], { abilityChoice: 'sand-veil' });
  for (const difficulty of ['mid', 'hard', 'veryhard']) {
    for (let seed = 0; seed < 20; seed++) {
      const b = duel([pika], [sandslash], seed);
      assert.equal(moveKey(b, 0, chooseAction(b, 0, difficulty, rng(seed))), 'quick-attack', difficulty);
    }
  }
});

test('the hard AIs go for the knock out', () => {
  const machamp = mon('m', 68, ['cross-chop', 'bulk-up', 'leer']);
  const snorlax = mon('s', 143, ['body-slam']);
  const b = duel([machamp], [snorlax]);
  b.sides[1].team[0].hp = 20;
  assert.equal(moveKey(b, 0, chooseAction(b, 0, 'veryhard', rng(1))), 'cross-chop');
});

test('the very hard AI switches out of a fight it cannot win', () => {
  const venusaur = mon('v', 3, ['vine-whip']);
  const blastoise = mon('b', 9, ['surf']);
  const charizard = mon('c', 6, ['flamethrower'], { level: 70 });
  const b = duel([venusaur, blastoise], [charizard]);
  const action = chooseAction(b, 0, 'veryhard', rng(1));
  assert.deepEqual(action, { type: 'switch', to: 1 });
});

function aiVsAi(levelA, levelB, seed) {
  const random = rng(`fight:${seed}`);
  const a = buildAiTeam({ difficulty: levelA, level: 50, random }).slice(0, 3);
  const bTeam = buildAiTeam({ difficulty: levelB, level: 50, random }).slice(0, 3);
  const b = createBattle({ id: `f${seed}`, random, sides: [{ trainerId: `ai:${levelA}`, name: 'A', entries: a }, { trainerId: `ai:${levelB}`, name: 'B', entries: bTeam }] });
  const levels = [levelA, levelB];
  for (let guard = 0; guard < 500 && b.status === 'active'; guard++) {
    for (const s of [0, 1]) {
      if (!needsAction(b, s)) continue;
      const action = chooseAction(b, s, levels[s], random);
      assert.ok(validActions(b, s).some((v) => JSON.stringify(v) === JSON.stringify(action)), `${levels[s]}: ${JSON.stringify(action)}`);
      submit(b, s, action);
    }
  }
  assert.equal(b.status, 'finished');
  return b.winner;
}

test('battles between AIs always end, with legal actions only', () => {
  for (const x of AI_LEVELS) for (const y of AI_LEVELS) aiVsAi(x, y, `${x}-${y}`);
});

test('the very hard AI beats the easy one most of the time', () => {
  let wins = 0;
  const games = 20;
  for (let i = 0; i < games; i++) if (aiVsAi('veryhard', 'easy', i) === 0) wins++;
  assert.ok(wins >= games * 0.7, `${wins}/${games}`);
});

test("the AI decides on what it has seen, never on the rival's hidden moves, bench or choice", () => {
  const gengar = mon('g', 94, ['shadow-ball', 'sludge-bomb', 'hypnosis', 'thunderbolt']);
  const rivals = [
    [mon('a', 143, ['body-slam']), mon('b', 65, ['psychic'])],
    [mon('a', 143, ['earthquake', 'crunch', 'rest']), mon('b', 6, ['flamethrower'])],
  ];
  for (const difficulty of ['easy', 'mid', 'hard', 'veryhard']) {
    for (let seed = 0; seed < 5; seed++) {
      const picks = rivals.map((rival) => {
        const b = duel([gengar], rival, seed);
        return JSON.stringify(chooseAction(b, 0, difficulty, rng(seed)));
      });
      assert.equal(picks[0], picks[1], `${difficulty}:${seed}`);
      const b = duel([gengar], rivals[1], seed);
      const before = JSON.stringify(chooseAction(b, 0, difficulty, rng(seed)));
      submit(b, 1, validActions(b, 1)[0]);
      assert.equal(JSON.stringify(chooseAction(b, 0, difficulty, rng(seed))), before, `${difficulty}:${seed} con elección pendiente`);
    }
  }
});

test('a move the rival has used is known, and the AI plays around it', () => {
  const b = duel([mon('p', 25, ['thunderbolt', 'quick-attack'])], [mon('g', 130, ['bite', 'surf'])]);
  const gyarados = b.sides[1].team[0];
  gyarados.revealedMoves.add('surf');
  assert.ok(gyarados.moves.some((m) => m.key === 'surf'));
  assert.equal(moveKey(b, 0, chooseAction(b, 0, 'veryhard', rng(1))), 'thunderbolt');
});

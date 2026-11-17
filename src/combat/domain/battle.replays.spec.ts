// Characterization pin for the combat engine and the AI: seeded battles between AI teams, played to the end, whose
// full event log and client views must match battle.replays.snapshot.txt line for line. A change that only moves
// code around keeps it green. A change in behavior shows up as the first line that differs.
// To accept a deliberate change in behavior: UPDATE_SNAPSHOTS=1 npm test, then review the diff of the snapshot.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { rng } from '../../catalog/domain/creatures.js';
import { PROJECT_ROOT } from '../../shared/paths.js';
import { createBattle, needsAction, publicState, submit, viewEvents } from './battle.js';
import { aiPicks, buildAiTeam, buildAiRandomParty, chooseAction } from './ai.js';
import { createPreview, pick, previewView, chosenEntries } from './team-preview.js';

const SNAPSHOT = join(PROJECT_ROOT, 'src', 'combat', 'domain', 'battle.replays.snapshot.txt');
const LEVELS = ['easy', 'mid', 'hard', 'veryhard', 'skynet'];
const LEVEL_CAPS = [null, 50, 100, 30];

// Client views are large and mostly catalog data, so the snapshot keeps their hash. The event log stays readable.
const digest = (view: unknown): string => createHash('sha256').update(JSON.stringify(view)).digest('hex');

function replay(seed: number): string[] {
  const level = (side: number) => LEVELS[(seed + side * 2) % LEVELS.length];
  const levelCap = LEVEL_CAPS[seed % LEVEL_CAPS.length];
  const teamLevel = levelCap ?? 60;
  const teams = [0, 1].map((side) => (seed % 5 === 4 && side === 1 ? buildAiRandomParty({ level: teamLevel, random: rng(`party-${seed}`) }) : buildAiTeam({ difficulty: level(side), level: teamLevel, random: rng(`team-${seed}-${side}`) })));
  const sides = teams.map((entries, side) => ({ trainerId: `ai:${level(side)}`, name: `Side ${side}`, entries }));
  const preview = createPreview({ sides, levelCap });
  for (const side of [0, 1]) pick(preview, side, aiPicks({ difficulty: level(side), own: teams[side], random: rng(`picks-${seed}-${side}`) }));
  const battle = createBattle({
    id: `replay-${seed}`,
    levelCap,
    random: rng(seed),
    sides: sides.map((side, index) => ({ ...side, entries: chosenEntries(preview, index) })),
  });
  const choices = [0, 1].map((side) => rng(`choices-${seed}-${side}`));
  const lines = [`# battle ${seed}: ${level(0)} vs ${level(1)}, level cap ${levelCap}`, `preview ${digest(previewView(preview, 0))}`];
  for (const event of battle.intro) lines.push(`intro ${JSON.stringify(event)}`);
  let submits = 0;
  while (battle.status === 'active' && submits++ < 1000) {
    for (const side of [0, 1]) {
      if (!needsAction(battle, side)) continue;
      const action = chooseAction(battle, side, level(side), choices[side]);
      lines.push(`turn ${battle.turn} side ${side} ${JSON.stringify(action)}`);
      const events = submit(battle, side, action) ?? [];
      for (const event of events) lines.push(`event ${JSON.stringify(event)}`);
      if (events.length) lines.push(`seen by 1 ${digest(viewEvents(events, 1))}`);
    }
    if (battle.turn === 3) lines.push(`state for 0 ${digest(publicState(battle, 0))}`);
  }
  lines.push(`final ${digest(publicState(battle, null))}`);
  return lines;
}

test('seeded AI battles replay exactly as recorded', () => {
  const lines: string[] = [];
  for (let seed = 1; seed <= 40; seed++) lines.push(...replay(seed));
  const actual = lines.join('\n') + '\n';
  if (process.env.UPDATE_SNAPSHOTS) writeFileSync(SNAPSHOT, actual);
  const expected = readFileSync(SNAPSHOT, 'utf8');
  if (actual === expected) return;
  const actualLines = actual.split('\n');
  const expectedLines = expected.split('\n');
  let first = 0;
  while (actualLines[first] === expectedLines[first]) first++;
  assert.fail(
    `The replay differs from the snapshot at line ${first + 1}.\nexpected: ${expectedLines[first]}\nactual:   ${actualLines[first]}\n` +
      'If the engine changed on purpose, run UPDATE_SNAPSHOTS=1 npm test and review the diff of the snapshot.',
  );
});

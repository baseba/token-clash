// Characterization pin for the combat engine and the AI: 40 seeded battles between AI teams, played to the end.
// Each battle's full log (actions, events, and hashes of what each client sees) is reduced to one hash per battle
// in battle.replays.snapshot.txt. Moving code around keeps every hash; a change in behavior names the battles it
// changed. Objects are written with sorted keys, so building an event in another key order is not a change.
//
// To read the logs: REPLAY_LOGS=1 writes them to dist/replays/<seed>.txt (a failing run writes them too). Run it on
// main and on your branch and diff the two folders.
// To accept a deliberate change in behavior: UPDATE_SNAPSHOTS=1 npm test, and say why in the PR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { rng } from '../../catalog/domain/creatures.js';
import { PROJECT_ROOT } from '../../shared/paths.js';
import { createBattle, needsAction, publicState, submit, viewEvents } from './battle.js';
import { aiPicks, buildAiTeam, buildAiRandomParty, chooseAction } from './ai.js';
import { createPreview, pick, previewView, chosenEntries } from './team-preview.js';

const SNAPSHOT = join(PROJECT_ROOT, 'src', 'combat', 'domain', 'battle.replays.snapshot.txt');
const LEVELS = ['easy', 'mid', 'hard', 'veryhard', 'skynet'] as const;

const LOGS = join(PROJECT_ROOT, 'dist', 'replays');

const sortedKeys = (_key: string, value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
    : value;
const canonical = (value: unknown): string => JSON.stringify(value, sortedKeys);
const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');
const digest = (view: unknown): string => sha256(canonical(view));

function replay(seed: number): string[] {
  const level = (side: number) => LEVELS[(seed + side * 2) % LEVELS.length];
  const teams = [0, 1].map((side) => (seed % 5 === 4 && side === 1 ? buildAiRandomParty({ random: rng(`party-${seed}`) }) : buildAiTeam({ difficulty: level(side), random: rng(`team-${seed}-${side}`) })));
  const sides = teams.map((entries, side) => ({ trainerId: `ai:${level(side)}`, name: `Side ${side}`, entries }));
  const preview = createPreview({ sides });
  for (const side of [0, 1]) pick(preview, side, aiPicks({ difficulty: level(side), own: teams[side], random: rng(`picks-${seed}-${side}`) }));
  const battle = createBattle({
    id: `replay-${seed}`,
    random: rng(seed),
    sides: sides.map((side, index) => ({ ...side, entries: chosenEntries(preview, index) })),
  });
  const choices = [0, 1].map((side) => rng(`choices-${seed}-${side}`));
  const lines = [`# battle ${seed}: ${level(0)} vs ${level(1)}`, `preview ${digest(previewView(preview, 0))}`];
  for (const event of battle.intro) lines.push(`intro ${canonical(event)}`);
  let submits = 0;
  while (battle.status === 'active' && submits++ < 1000) {
    for (const side of [0, 1]) {
      if (!needsAction(battle, side)) continue;
      const action = chooseAction(battle, side, level(side), choices[side]);
      lines.push(`turn ${battle.turn} side ${side} ${canonical(action)}`);
      const events = submit(battle, side, action) ?? [];
      for (const event of events) lines.push(`event ${canonical(event)}`);
      if (events.length) lines.push(`seen by 1 ${digest(viewEvents(events, 1))}`);
    }
    if (battle.turn === 3) lines.push(`state for 0 ${digest(publicState(battle, 0))}`);
  }
  lines.push(`final ${digest(publicState(battle, null))}`);
  return lines;
}

function writeLogs(logs: Map<number, string[]>): void {
  mkdirSync(LOGS, { recursive: true });
  for (const [seed, lines] of logs) writeFileSync(join(LOGS, `${seed}.txt`), lines.join('\n') + '\n');
}

test('seeded AI battles replay exactly as recorded', () => {
  const logs = new Map<number, string[]>();
  for (let seed = 1; seed <= 40; seed++) logs.set(seed, replay(seed));
  const actual = [...logs].map(([seed, lines]) => `${seed} ${sha256(lines.join('\n'))} ${lines[0].slice(2)}`).join('\n') + '\n';
  if (process.env.UPDATE_SNAPSHOTS) writeFileSync(SNAPSHOT, actual);
  if (process.env.REPLAY_LOGS) writeLogs(logs);
  const expected = readFileSync(SNAPSHOT, 'utf8');
  if (actual === expected) return;
  writeLogs(logs);
  const before = new Set(expected.split('\n'));
  const changed = actual.split('\n').filter((line) => line && !before.has(line)).map((line) => line.split(' ')[0]);
  assert.fail(
    `Battles that replay differently: ${changed.join(', ')}. Their logs are in dist/replays/.\n` +
      'Compare with REPLAY_LOGS=1 on main. If the engine changed on purpose, run UPDATE_SNAPSHOTS=1 npm test.',
  );
});

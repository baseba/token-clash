import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Picture, SpreadModule, Step } from '../lint/report.js';
import { draw } from './picture.js';
import { painter } from './render.js';

const plain = (picture: Picture) => draw(picture, painter(false));

const step = (member: string, file: string, line: number, uses: string): Step => ({ member, site: { file, line }, uses });

test('a circle runs down its ties and back up from the last', () => {
  const picture: Picture = {
    kind: 'circle',
    steps: [step('kinds', 'src/kinds.ts', 10, 'Stream::new uses BACKLOG_MOST'), step('socket', 'src/net/socket.ts', 5, 'listen uses Stream')],
    rest: 'not drawn: 1 more module',
  };
  assert.deepEqual(plain(picture), [
    '    ┌─▶ kinds',
    '    │     ┃ kinds.ts:10      Stream::new uses BACKLOG_MOST',
    '    │     ▼',
    '    │   socket',
    '    │     │ net/socket.ts:5  listen uses Stream',
    '    └─────┘',
    '    not drawn: 1 more module',
  ]);
});

test('a spread draws an arm from each module into the field', () => {
  const spread = (modules: SpreadModule[]): Picture => ({ kind: 'spread', owner: 'q::RunQueue', field: 'items', modules, others: ['kept: limit'] });
  assert.deepEqual(plain(spread([{ places: 1, module: 'q::app' }])), ['    q::RunQueue', '      items ◀━━━ 1  q::app', '      kept: limit']);
  const modules = [
    { places: 12, module: 'q::sched' },
    { places: 3, module: 'q::app' },
    { places: 2, module: 'in 2 more modules' },
  ];
  assert.deepEqual(plain(spread(modules)), [
    '    q::RunQueue',
    '      items ◀━┳━ 12  q::sched',
    '              ┣━  3  q::app',
    '              ┗━  2  in 2 more modules',
    '      kept: limit',
  ]);
});

test('a bar crosses the line at seven and ends short of eighty columns', () => {
  const picture: Picture = { kind: 'lists', shown: 50, hidden: 3, lists: [{ name: 'Store', length: 9 }] };
  assert.deepEqual(plain(picture), [
    '                  7',
    '    shows  ███████│█████████████████████████████████⋯ 50',
    '    hides  ███    │ 3',
    '    Store  ███████│██ 9',
  ]);
});

test('a bar against a larger most puts its line halfway along', () => {
  const bar = (label: string, length: number, most: number): Picture => ({ kind: 'bar', label, length, most });
  assert.deepEqual(plain(bar('holds', 17, 15)), ['                         15', '    holds  ███████████████│██ 17']);
  const most = '                            2000';
  assert.deepEqual(plain(bar('lines', 2_001, 2_000)), [most, '    lines  ████████████████████│█ 2001']);
  assert.deepEqual(plain(bar('lines', 9_000, 2_000)), [most, '    lines  ████████████████████│████████████████████⋯ 9000']);
});

test('what a report is about is red when there is color', () => {
  const bar: Picture = { kind: 'bar', label: 'holds', length: 16, most: 15 };
  const past = '\x1b[1;31m█\x1b[0m';
  assert.deepEqual(draw(bar, painter(true)), ['                         15', `    holds  ███████████████│${past} 16`]);
});

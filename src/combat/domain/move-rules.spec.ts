import { test } from 'node:test';
import assert from 'node:assert/strict';
import { moveData } from './moves.js';
import { MOVE_RULES } from './move-rules.js';

test('useOn rules are for status moves aimed at the foe, use rules for the rest', () => {
  for (const [id, rule] of Object.entries(MOVE_RULES)) {
    const move = moveData(id);
    if (!move || !(rule.use || rule.useOn)) continue;
    assert.equal(move.kind, 'status', id);
    assert.equal(move.target === 'foe', !!rule.useOn, id);
  }
});

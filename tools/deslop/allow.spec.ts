import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AllowList } from './allow.js';
import type { Diagnostic, Lint } from './lint/report.js';
import { ToolError } from './tool.js';

const circle = (lint: Lint, key: string): Diagnostic => {
  return { lint, key, message: '', location: undefined, notes: [], picture: { kind: 'circle', steps: [], rest: undefined } };
};
const tangle = (key: string) => circle('tangle', key);
const cycle = (key: string) => circle('module-cycle', key);

test('shrinking an allowed tangle stays allowed', () => {
  const allow = AllowList.parse('tangle a::X,a::Y,b::Z\n', 'debt.allow');
  assert.ok(allow.isAllowed(tangle('a::X,b::Z')));
  assert.ok(!allow.isAllowed(tangle('a::W,a::X,a::Y,b::Z')));
  assert.equal(allow.fixedCount([tangle('a::X,a::Y')]), 0);
  assert.equal(allow.fixedCount([]), 1);
});

test('shrinking an allowed module cycle stays allowed', () => {
  const allow = AllowList.parse('module-cycle a::x,a::y,a::z\n', 'debt.allow');
  assert.ok(allow.isAllowed(cycle('a::x,a::z')));
  assert.ok(!allow.isAllowed(cycle('a::w,a::x')));
  assert.ok(!allow.isAllowed(tangle('a::x,a::z')));
});

test('a comma inside a member name splits nothing', () => {
  const allow = AllowList.parse('tangle a::<(A, B) as T>::run,a::X,a::Y\n', 'debt.allow');
  assert.ok(allow.isAllowed(tangle('a::<(A, B) as T>::run,a::Y')));
  assert.ok(!allow.isAllowed(tangle('a::<(A, C) as T>::run,a::Y')));
  assert.ok(!allow.isAllowed(tangle('a::Y,a::Z')));
});

test('a removed lint is an invalid entry, named by its line', () => {
  assert.throws(() => AllowList.parse('field-leak a::T::x\nchatty-seam a -> b\n', 'debt.allow'), new ToolError('debt.allow:2: invalid allowlist entry'));
  assert.throws(() => AllowList.parse('tangle\n', 'debt.allow'), new ToolError('debt.allow:1: invalid allowlist entry'));
});

test('the file lists each entry once, by lint in the order they are checked and then by key', () => {
  const allow = AllowList.fromDiagnostics([circle('long-file', 'src/b.ts'), tangle('a::Y'), tangle('a::X'), tangle('a::X'), cycle('a::z')]);
  assert.equal(
    allow.toText(),
    [
      '# Existing architectural debt suppressed by `deslop-please --allow`.',
      '# Fixing an entry here never fails CI; new issues not listed here fail.',
      'module-cycle a::z',
      'tangle a::X',
      'tangle a::Y',
      'long-file src/b.ts',
      '',
    ].join('\n'),
  );
  assert.deepEqual(AllowList.parse(`${allow.toText()}\n  # a note\n\n`, 'debt.allow'), allow);
});

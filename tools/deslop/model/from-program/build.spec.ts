import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modelOf } from '../../testing/models.js';

test('a file is a module, a directory its parent, and a file named as a directory is that directory', () => {
  const model = modelOf({
    'src/kernel.ts': 'export const TICK = 1;\n',
    'src/kernel/tasks/task-list.ts': 'export const MOST = 2;\n',
    'src/app.module.ts': 'export const NAME = 3;\n',
  });
  const homes = model.items.map((item) => `${model.tree.display(item.owner)}::${item.name}`);
  assert.deepEqual(homes, ['src::app.module::NAME', 'src::kernel::TICK', 'src::kernel::tasks::task-list::MOST']);
  assert.deepEqual(
    model.files.map((file) => [file.path, file.lines]),
    [
      ['src/app.module.ts', 1],
      ['src/kernel.ts', 1],
      ['src/kernel/tasks/task-list.ts', 1],
    ],
  );
});

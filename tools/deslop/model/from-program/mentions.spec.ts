import { test } from 'node:test';
import { GLOBALS, type Judged, assertVerdicts } from '../../testing/models.js';

const QUEUE = `export interface Deep {
  count: number;
  list: number[];
}

export interface Limit {
  most: number;
  deep: Deep;
}

export class Queue {
  items: number[] = [];
  marks: readonly number[] = [];
  head = 0;
  name = 'queue';
  limit: Limit = { most: 1, deep: { count: 0, list: [] } };
  spare: Limit | null = null;
  shape = { rows: 1 };
  onDone?: () => void;
  private taken = 0;

  next(): number {
    this.taken += 1;
    return this.taken;
  }
}
`;

const judge = (cases: Judged[]): void => assertVerdicts({ ...GLOBALS, 'src/queue.ts': QUEUE }, 'Queue', cases);

test('S1: a write to the field, or to a path of declared fields that starts at it, leaks', () => {
  judge([
    ['queue.head = 1;', 'leaks'],
    ['queue.head += 1;', 'leaks'],
    ['queue.head++;', 'leaks'],
    ['--queue.head;', 'leaks'],
    ['delete queue.onDone;', 'leaks'],
    ['[queue.head] = [1];', 'leaks'],
    ['({ head: queue.head } = other);', 'leaks'],
    ['for (queue.head of [1]) hold();', 'leaks'],
    ['for (queue.name in {}) hold();', 'leaks'],
    ["queue['head'] = 2;", 'leaks'],
    ['(queue.head) = 3;', 'leaks'],
    ['queue.limit.most = 1;', 'leaks'],
    ['queue.limit.deep.count += 1;', 'leaks'],
  ]);
});

test('S2: whatever else is done with a value reads it, but a cast of it to what is no value leaks, judged by the outermost cast', () => {
  judge([
    ['hold(queue.head, queue.head + 1, String(queue.head));', 'reads'],
    ['hold(queue.name.length, queue.name.toUpperCase());', 'reads'],
    ['hold(queue.marks.length, queue.marks[0], queue.marks.includes(1));', 'reads'],
    ['const marks = queue.marks;\n  hold(marks);', 'reads'],
    ['for (const mark of queue.marks) hold(mark);', 'reads'],
    ['hold([...queue.marks], queue.marks.slice());', 'reads'],
    ['const { head, marks } = queue;\n  hold(head, marks);', 'reads'],
    ['let head = 0;\n  ({ head } = queue);\n  hold(head);', 'reads'],
    ["hold(queue['head'], (queue.head)!);", 'reads'],
    ['hold(queue.marks satisfies readonly number[], queue.marks as readonly number[]);', 'reads'],
    ['hold(queue.marks as number[]);', 'leaks'],
    ['hold(<number[]>queue.marks);', 'leaks'],
    ['hold(queue.head as unknown);', 'leaks'],
    ['hold(queue.marks as readonly number[] as number[]);', 'leaks'],
    ['hold((queue.marks satisfies readonly number[]) as number[]);', 'leaks'],
    ['hold((queue.marks as readonly number[])! as number[]);', 'leaks'],
    ['hold(queue.marks as number[] as readonly number[]);', 'reads'],
  ]);
});

test('S3a: a path of declared fields that ends in a scalar reads, written with dots or as a pattern, and one that ends in anything else leaks', () => {
  judge([
    ['hold(queue.limit.most);', 'reads'],
    ['hold(queue.limit.deep.count);', 'reads'],
    ['hold(queue.spare?.most, queue.spare?.deep.count);', 'reads'],
    ['hold(queue.limit!.most, (queue.limit).most);', 'reads'],
    ['hold(queue.shape.rows);', 'reads'],
    ['hold(queue.limit.most.toFixed(1));', 'reads'],
    ['const {\n    limit: { most },\n  } = queue;\n  hold(most);', 'reads'],
    ['const {\n    limit: {\n      most,\n      deep: { count: deepCount },\n    },\n  } = queue;\n  hold(most, deepCount);', 'reads'],
    ['const {\n    limit: { deep },\n  } = queue;\n  hold(deep);', 'leaks'],
    ['const {\n    limit: { most, ...rest },\n  } = queue;\n  hold(most, rest);', 'leaks'],
    ['const {\n    items: { length },\n  } = queue;\n  hold(length);', 'leaks'],
    ['const {\n    items: [first],\n  } = queue;\n  hold(first);', 'leaks'],
    ['hold(queue.limit.deep);', 'leaks'],
    ['hold(queue.limit.deep.list);', 'leaks'],
    ['hold(queue.limit.deep.list.length);', 'leaks'],
    ['hold((queue.limit as { most: number }).most);', 'leaks'],
  ]);
});

test('S3b: a field that is only tested or compared, a case label too, is read, whatever it holds', () => {
  judge([
    ['if (queue.spare) hold();', 'reads'],
    ['while (queue.spare) break;', 'reads'],
    ['do hold();\n  while (queue.spare);', 'reads'],
    ['for (; queue.spare; ) break;', 'reads'],
    ['hold(queue.spare ? 1 : 2);', 'reads'],
    ['switch (queue.spare) {\n    default:\n      hold();\n  }', 'reads'],
    ['switch (other.spare) {\n    case queue.spare:\n      hold();\n  }', 'reads'],
    ['hold(!queue.spare, typeof queue.spare);', 'reads'],
    ['hold(queue.spare === other.spare, queue.spare !== null, queue.items == null, queue.items != null);', 'reads'],
    ['hold(queue.spare instanceof Object);', 'reads'],
    ['hold(queue.spare && 1);', 'reads'],
    ['if (ok && queue.spare) hold();', 'reads'],
    ['if (ok || (queue.spare ?? ok)) hold();', 'reads'],
  ]);
});

test('S4: anything else done with what is no value leaks, at the place that names the field', () => {
  judge([
    ['hold(queue.items);', 'leaks'],
    ['hold(queue.items.length);', 'leaks'],
    ['hold(queue.items[0]);', 'leaks'],
    ['queue.items.push(1);', 'leaks'],
    ['queue.items[0] = 1;', 'leaks'],
    ['queue.items.length = 0;', 'leaks'],
    ['const items = queue.items;\n  hold(ok);', 'leaks'],
    ['const { items } = queue;\n  hold(items);', 'leaks'],
    ['let items: number[] = [];\n  ({ items } = queue);\n  hold(items);', 'leaks'],
    ['hold([...queue.items], queue.items.slice(), structuredClone(queue.limit));', 'leaks'],
    ['for (const item of queue.items) hold(item);', 'leaks'],
    ['hold(queue.spare ?? ok);', 'leaks'],
    ['hold(queue.spare || ok);', 'leaks'],
    ['hold(ok && queue.spare);', 'leaks'],
    ['hold(queue.limit satisfies object);', 'leaks'],
    ['queue.onDone?.();', 'leaks'],
    ["hold(queue['items'].length);", 'leaks'],
    ['return queue.limit;', 'leaks'],
  ]);
});

test('a type that names a field does nothing to it', () => {
  judge([['const copy: typeof queue.items = [];\n  hold(copy);', 'reads']]);
});

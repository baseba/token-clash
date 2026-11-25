import { test } from 'node:test';
import assert from 'node:assert/strict';
import { type NodeId, Tree } from './tree.js';

function below(tree: Tree, path: string): NodeId {
  return path.split('/').reduce((parent, name) => tree.child(parent, name), tree.root());
}

test('the root is the package, and a module is made once for its name under its parent', () => {
  const tree = new Tree('src');
  assert.deepEqual(tree.node(tree.root()), { name: 'src', kind: 'package', parent: undefined, depth: 0 });
  const arena = tree.child(tree.root(), 'arena');
  assert.equal(tree.child(tree.root(), 'arena'), arena);
  assert.deepEqual(tree.node(arena), { name: 'arena', kind: 'module', parent: tree.root(), depth: 1 });
  const domain = tree.child(arena, 'domain');
  assert.notEqual(tree.child(tree.child(tree.root(), 'tower'), 'domain'), domain);
  assert.equal(tree.node(domain).depth, 2);
  assert.deepEqual(tree.ids(), [0, 1, 2, 3, 4]);
});

test('a module is named by the names from its package down, as its file names them', () => {
  const tree = new Tree('src');
  const run = below(tree, 'tower/domain/tower-run');
  assert.equal(tree.display(tree.root()), 'src');
  assert.equal(tree.directory(tree.root()), 'src');
  assert.equal(tree.display(run), 'src::tower::domain::tower-run');
  assert.equal(tree.directory(run), 'src/tower/domain/tower-run');
  assert.equal(tree.display(below(tree, 'app.module')), 'src::app.module');
  assert.equal(tree.display(below(tree, 'tower/Domain')), 'src::tower::Domain');
  assert.notEqual(below(tree, 'tower/Domain'), below(tree, 'tower/domain'));
});

test('a module is within itself and each module above it, and two modules meet at the nearest one above both', () => {
  const tree = new Tree('src');
  const run = below(tree, 'tower/domain/tower-run');
  const floors = below(tree, 'tower/domain/floors');
  const service = below(tree, 'tower/application/tower.service');
  const lobby = below(tree, 'arena/application/lobby');
  const [tower, domain] = [below(tree, 'tower'), below(tree, 'tower/domain')];
  assert.deepEqual(tree.ancestors(run), [run, domain, tower, tree.root()]);
  assert.equal(tree.parent(run), domain);
  assert.equal(tree.parent(tree.root()), undefined);
  assert.ok(tree.isWithin(run, run));
  assert.ok(tree.isWithin(run, tower));
  assert.ok(tree.isWithin(run, tree.root()));
  assert.ok(!tree.isWithin(tower, run));
  assert.ok(!tree.isWithin(run, below(tree, 'tower/application')));
  assert.equal(tree.commonAncestor(run, floors), domain);
  assert.equal(tree.commonAncestor(run, service), tower);
  assert.equal(tree.commonAncestor(run, domain), domain);
  assert.equal(tree.commonAncestor(run, lobby), tree.root());
});

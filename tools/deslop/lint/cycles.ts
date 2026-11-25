import { circles } from '../graph/components.js';
import type { Model } from '../model/model.js';
import type { NodeId, Tree } from '../model/tree.js';
import { type Diagnostic, type NamedTie, Tie, ascending, circleReport, compareText, counted, inScope, listed } from './report.js';

interface SiblingTie {
  user: NodeId;
  used: NodeId;
  tie: Tie;
}

interface Siblings {
  parent: NodeId;
  user: NodeId;
  used: NodeId;
}

function siblings(tree: Tree, from: NodeId, owner: NodeId): Siblings | undefined {
  const parent = tree.commonAncestor(from, owner);
  if (parent === from || parent === owner) return undefined;
  const childHolding = (node: NodeId) => tree.ancestors(node).find((ancestor) => tree.parent(ancestor) === parent);
  const user = childHolding(from);
  const used = childHolding(owner);
  return user === undefined || used === undefined ? undefined : { parent, user, used };
}

function diagnostic(model: Model, parent: NodeId, members: NodeId[], ties: SiblingTie[]): Diagnostic {
  const tree = model.tree;
  const name = (module: NodeId) => tree.node(module).name;
  const between = ties.filter(({ user, used }) => members.includes(user) && members.includes(used));
  const inside: NamedTie[] = between.map(({ user, used, tie }) => ({ user: name(user), used: name(used), tie }));
  const report = circleReport(model, 'uses', 'module', members.length, inside);
  return {
    lint: 'module-cycle',
    key: members
      .map((member) => tree.display(member))
      .sort(compareText)
      .join(','),
    message: `${counted(members.length, 'module')} in \`${tree.display(parent)}\` use each other in a circle`,
    location: report.location,
    notes: [`members: ${listed(members.map(name).sort(compareText))}`, ...report.notes],
    picture: report.picture,
  };
}

export function checkCycles(model: Model, scope: NodeId | undefined): Diagnostic[] {
  const tree = model.tree;
  const tiesByParent = new Map<NodeId, Map<string, SiblingTie>>();
  for (const reference of model.references) {
    const found = siblings(tree, reference.from, model.items[reference.item].owner);
    if (found === undefined) continue;
    const ties = tiesByParent.get(found.parent) ?? new Map<string, SiblingTie>();
    tiesByParent.set(found.parent, ties);
    const key = `${found.user}>${found.used}`;
    const known = ties.get(key) ?? { user: found.user, used: found.used, tie: new Tie() };
    ties.set(key, known);
    known.tie.add(model, reference.item, reference, found.user);
  }
  const diagnostics: Diagnostic[] = [];
  for (const parent of ascending(tiesByParent.keys())) {
    const ties = [...(tiesByParent.get(parent)?.values() ?? [])].sort((a, b) => a.user - b.user || a.used - b.used);
    const children = ascending(new Set(ties.flatMap(({ user, used }) => [user, used])));
    const uses: number[][] = children.map(() => []);
    for (const { user, used } of ties) uses[children.indexOf(user)].push(children.indexOf(used));
    for (const circle of circles(uses)) {
      const members = circle.map((place) => children[place]);
      if (members.some((member) => inScope(tree, scope, member))) diagnostics.push(diagnostic(model, parent, members, ties));
    }
  }
  return diagnostics;
}

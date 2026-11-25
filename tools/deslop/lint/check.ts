import { buildGraph } from '../graph/graph.js';
import type { Model } from '../model/model.js';
import type { NodeId } from '../model/tree.js';
import { checkCycles } from './cycles.js';
import { checkLayout } from './layout.js';
import { checkLeaks } from './leaks.js';
import { type Diagnostic, LINTS, compareText } from './report.js';
import { checkShallow } from './shallow.js';
import { checkTangles } from './tangles.js';

export function check(model: Model, scope: NodeId | undefined): Diagnostic[] {
  const graph = buildGraph(model);
  const diagnostics = [
    ...checkCycles(model, scope),
    ...checkTangles(model, graph, scope),
    ...checkLeaks(model, graph, scope),
    ...checkShallow(model, graph, scope),
    ...checkLayout(model, scope),
  ];
  return diagnostics.sort((a, b) => LINTS.indexOf(a.lint) - LINTS.indexOf(b.lint) || compareText(a.key, b.key));
}

export function resolveNode(model: Model, query: string): NodeId | undefined {
  return model.tree.ids().find((id) => model.tree.display(id) === query);
}

import type { Graph, ThingId } from '../graph/graph.js';
import type { Model } from '../model/model.js';
import type { NodeId } from '../model/tree.js';
import { type Diagnostic, HELD_IN_MIND, type NamedTie, Tie, circleReport, compareText, counted, fullName, inScope, listed } from './report.js';

interface ThingTie {
  user: ThingId;
  used: ThingId;
  tie: Tie;
}

interface Written {
  modules: Set<NodeId>;
  ties: Map<string, ThingTie>;
}

function diagnostic(model: Model, graph: Graph, members: ThingId[], written: Written): Diagnostic {
  const names = members.map((member) => fullName(model, graph, member)).sort(compareText);
  const sorted = [...written.ties.values()].sort((a, b) => a.user - b.user || a.used - b.used);
  const ties: NamedTie[] = sorted.map(({ user, used, tie }) => ({ user: fullName(model, graph, user), used: fullName(model, graph, used), tie }));
  const report = circleReport(model, 'knows', 'thing', members.length, ties);
  const modules = [...written.modules].map((module) => model.tree.display(module)).sort(compareText);
  const where = modules.length === 1 ? `all in \`${modules[0]}\`` : `across ${counted(modules.length, 'module')}`;
  return {
    lint: 'tangle',
    key: names.join(','),
    message: `${names.length} things know each other in a circle, ${where}`,
    location: report.location,
    notes: [`members: ${listed(names)}`, ...(modules.length > 1 ? [`written in: ${listed(modules)}`] : []), ...report.notes],
    picture: report.picture,
  };
}

export function checkTangles(model: Model, graph: Graph, scope: NodeId | undefined): Diagnostic[] {
  const homes = (members: ThingId[]) => new Set(members.map((member) => graph.things[member].home));
  const written: Written[] = graph.tangles.map((members) => ({ modules: homes(members), ties: new Map<string, ThingTie>() }));
  for (const use of graph.uses) {
    const used = graph.thingOf[use.item];
    if (use.user === undefined || used === undefined || use.user === used) continue;
    const tangle = graph.tangleOf[use.user];
    if (tangle === undefined || graph.tangleOf[used] !== tangle) continue;
    const reference = model.references[use.reference];
    written[tangle].modules.add(reference.from);
    const key = `${use.user}>${used}`;
    const known = written[tangle].ties.get(key) ?? { user: use.user, used, tie: new Tie() };
    written[tangle].ties.set(key, known);
    known.tie.add(model, use.item, reference, reference.from);
  }
  return graph.tangles.flatMap((members, index) => {
    const concerned = members.some((member) => inScope(model.tree, scope, graph.things[member].home));
    const reported = concerned && (written[index].modules.size > 1 || members.length > HELD_IN_MIND);
    return reported ? [diagnostic(model, graph, members, written[index])] : [];
  });
}

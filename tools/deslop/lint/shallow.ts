import type { Graph, ThingId } from '../graph/graph.js';
import type { ItemId, Model } from '../model/model.js';
import type { NodeId, Tree } from '../model/tree.js';
import { type Diagnostic, HELD_IN_MIND, type LongList, ascending, compareText, counted, inScope, listed, moduleLocation } from './report.js';

const BREAK_EVEN = 1;

const LAYERS = new Set(['domain', 'application', 'infrastructure', 'interface']);

interface List {
  name: string;
  functions: string[];
}

interface Shallow {
  module: NodeId;
  shown: Set<ItemId>;
  total: number;
  notes: string[];
  long: LongList[];
}

function showsTheSame(tree: Tree, below: Shallow, above: Shallow): boolean {
  if (below.module === above.module || !tree.isWithin(below.module, above.module)) return false;
  return below.total === above.total && below.shown.size === above.shown.size && [...below.shown].every((item) => above.shown.has(item));
}

function isLayer(tree: Tree, nestModuleHolders: Set<NodeId | undefined>, id: NodeId): boolean {
  const context = tree.parent(id);
  return context !== undefined && tree.parent(context) === tree.root() && nestModuleHolders.has(context) && LAYERS.has(tree.node(id).name);
}

function judgedModules(model: Model): Set<NodeId> {
  const tree = model.tree;
  const parents = new Set(tree.ids().map((id) => tree.parent(id)));
  const nestModuleHolders = new Set(model.files.filter((file) => file.path.endsWith('.module.ts')).map((file) => tree.parent(file.module)));
  return new Set(tree.ids().filter((id) => (tree.node(id).kind === 'package' || parents.has(id)) && !isLayer(tree, nestModuleHolders, id)));
}

function typesKnown(model: Model, graph: Graph): Map<ThingId, Set<ThingId>> {
  const kind = (thing: ThingId) => model.items[graph.things[thing].item].kind;
  const known = new Map<ThingId, Set<ThingId>>();
  for (const use of graph.uses) {
    const used = graph.thingOf[use.item];
    if (use.user === undefined || used === undefined || kind(use.user) !== 'function' || kind(used) !== 'type') continue;
    known.set(use.user, (known.get(use.user) ?? new Set<ThingId>()).add(used));
  }
  return known;
}

function listsOf(model: Model, graph: Graph, known: Map<ThingId, Set<ThingId>>, module: NodeId, shown: Set<ItemId>): List[] {
  const name = (item: ItemId) => model.items[item].name;
  const functionsOf = new Map<ThingId, string[]>();
  for (const shownFunction of ascending(shown)) {
    const thing = graph.thingOf[shownFunction];
    if (thing === undefined) continue;
    const free = graph.things[thing].item === shownFunction;
    const types = free ? ascending(known.get(thing) ?? []).filter((type) => model.tree.isWithin(graph.things[type].home, module)) : [];
    for (const list of types.length > 0 ? types : [thing]) functionsOf.set(list, [...(functionsOf.get(list) ?? []), name(shownFunction)]);
  }
  return ascending(functionsOf.keys())
    .map((thing) => ({ name: name(graph.things[thing].item), functions: [...(functionsOf.get(thing) ?? [])].sort(compareText) }))
    .sort((a, b) => compareText(a.name, b.name) || compareText(a.functions.join('\n'), b.functions.join('\n')))
    .sort((a, b) => b.functions.length - a.functions.length);
}

function tooLong(lists: List[]): { notes: string[]; long: LongList[] } {
  const notes: string[] = [];
  const long: LongList[] = [];
  if (lists.length > HELD_IN_MIND) {
    notes.push(`shows ${counted(lists.length, 'thing')}: ${listed(lists.map((list) => list.name))}`);
    long.push({ name: 'things', length: lists.length });
  }
  for (const { name, functions } of lists) {
    if (functions.length <= HELD_IN_MIND) continue;
    notes.push(`\`${name}\` shows ${counted(functions.length, 'function')}: ${listed(functions)}`);
    long.push({ name, length: functions.length });
  }
  return { notes, long };
}

export function checkShallow(model: Model, graph: Graph, scope: NodeId | undefined): Diagnostic[] {
  const tree = model.tree;
  const judged = judgedModules(model);
  const home = (item: ItemId) => {
    const thing = graph.thingOf[item];
    return thing === undefined ? undefined : graph.things[thing].home;
  };
  const working = (item: ItemId) => model.items[item].kind === 'function' && !model.items[item].traitImpl && !model.wrappers.has(item);
  const total = new Map<NodeId, number>();
  model.items.forEach((_item, index) => {
    const at = home(index as ItemId);
    if (at === undefined || !working(index as ItemId)) return;
    for (const module of tree.ancestors(at)) {
      if (judged.has(module)) total.set(module, (total.get(module) ?? 0) + 1);
    }
  });
  const shown = new Map<NodeId, Set<ItemId>>();
  for (const use of graph.uses) {
    const at = home(use.item);
    if (at === undefined || !working(use.item)) continue;
    const user = use.user === undefined ? model.references[use.reference].from : graph.things[use.user].home;
    for (const module of tree.ancestors(at)) {
      if (tree.isWithin(user, module)) break;
      if (judged.has(module)) shown.set(module, (shown.get(module) ?? new Set<ItemId>()).add(use.item));
    }
  }
  const known = typesKnown(model, graph);
  const found: Shallow[] = [];
  for (const module of ascending(judged)) {
    const shownHere = shown.get(module);
    if (shownHere === undefined) continue;
    const all = total.get(module) ?? 0;
    const { notes, long } = tooLong(listsOf(model, graph, known, module, shownHere));
    const hides = Math.max(0, all - shownHere.size) <= shownHere.size * BREAK_EVEN;
    if (shownHere.size > HELD_IN_MIND && notes.length > 0 && hides) found.push({ module, shown: shownHere, total: all, notes, long });
  }
  const narrowest = found.filter((above) => !found.some((below) => showsTheSame(tree, below, above)));
  return narrowest
    .filter(({ module }) => inScope(tree, scope, module))
    .map(({ module, shown: shownHere, total: all, notes, long }) => ({
      lint: 'shallow-module',
      key: tree.display(module),
      message: `\`${tree.display(module)}\` is shallow: it shows ${shownHere.size} of its ${counted(all, 'function')}`,
      location: moduleLocation(model, module),
      notes,
      picture: { kind: 'lists', shown: shownHere.size, hidden: Math.max(0, all - shownHere.size), lists: long },
    }));
}

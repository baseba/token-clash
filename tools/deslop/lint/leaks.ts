import type { Graph, ThingId, Use } from '../graph/graph.js';
import type { Flow, ItemId, Model } from '../model/model.js';
import type { NodeId } from '../model/tree.js';
import {
  type Diagnostic,
  HELD_IN_MIND,
  type Location,
  type SpreadModule,
  ascending,
  clickable,
  compareLocations,
  compareText,
  counted,
  inScope,
  listed,
  locationOf,
  sameLocation,
} from './report.js';

function works(model: Model, use: Use): boolean {
  const holder = model.references[use.reference].holder;
  return holder !== undefined && model.items[holder].kind === 'function' && model.items[holder].takesSelf;
}

function bareName(model: Model, field: ItemId): string {
  const name = model.items[field].name;
  return name.split('::').pop() ?? name;
}

export interface Outside {
  used: Set<ItemId>;
  leaks: Map<ItemId, Use[]>;
  working: Set<ThingId>;
}

function others(model: Model, field: ItemId, fields: ItemId[], outside: Outside): string[] {
  const rest = fields.filter((other) => other !== field);
  const known = rest.filter((other) => outside.leaks.has(other)).map((other) => bareName(model, other));
  const kept = rest.filter((other) => !outside.used.has(other)).map((other) => bareName(model, other));
  return [...(known.length > 0 ? [`also known outside: ${listed(known)}`] : []), ...(kept.length > 0 ? [`kept: ${listed(kept)}`] : [])];
}

interface Site {
  location: Location;
  label: string;
  module: NodeId;
}

function siteOf(model: Model, use: Use): Site {
  const tree = model.tree;
  const reference = model.references[use.reference];
  const holder = reference.holder === undefined ? undefined : model.items[reference.holder];
  const user = holder === undefined ? tree.display(reference.from) : `${tree.display(holder.owner)}::${holder.name}`;
  const through = use.through === undefined ? '' : `, through \`${model.items[use.through].name}\``;
  return { location: locationOf(model, reference), label: `\`${user}\`${through}`, module: reference.from };
}

function spreadModules(model: Model, sites: Site[]): SpreadModule[] {
  const places = new Map<NodeId, Location[]>();
  for (const site of sites) {
    const known = places.get(site.module) ?? [];
    places.set(site.module, known);
    if (!known.some((location) => sameLocation(location, site.location))) known.push(site.location);
  }
  return ascending(places.keys())
    .map((module) => ({ places: places.get(module)?.length ?? 0, module: model.tree.display(module) }))
    .sort((a, b) => b.places - a.places || compareText(a.module, b.module));
}

function diagnostic(model: Model, graph: Graph, thing: ThingId, field: ItemId, uses: Use[], otherFields: string[]): Diagnostic {
  const owner = graph.things[thing];
  const all = uses.map((use) => siteOf(model, use));
  const sorted = [...all].sort((a, b) => compareLocations(a.location, b.location));
  const sites = sorted.filter((site, index) => index === 0 || !sameLocation(site.location, sorted[index - 1].location));
  const notes = sites.slice(0, HELD_IN_MIND).map((site) => `${clickable(site.location)}: ${site.label}`);
  if (sites.length > HELD_IN_MIND) notes.push(`and ${counted(sites.length - HELD_IN_MIND, 'more place')}`);
  const everyModule = spreadModules(model, all);
  const more = everyModule.slice(HELD_IN_MIND);
  const rest = { places: more.reduce((sum, module) => sum + module.places, 0), module: `in ${counted(more.length, 'more module')}` };
  const modules = more.length === 0 ? everyModule : [...everyModule.slice(0, HELD_IN_MIND), rest];
  const typeName = model.items[owner.item].name;
  const fieldName = model.items[field].name;
  const home = model.tree.display(owner.home);
  return {
    lint: 'field-leak',
    key: `${home}::${fieldName}`,
    message: `\`${fieldName}\` is known outside \`${typeName}\`: ${counted(sites.length, 'place')} in ${counted(everyModule.length, 'module')}`,
    location: sites[0]?.location,
    notes,
    picture: { kind: 'spread', owner: `${home}::${typeName}`, field: bareName(model, field), modules, others: otherFields },
  };
}

function fieldsByThing(model: Model, graph: Graph): Map<ThingId, ItemId[]> {
  const fields = new Map<ThingId, ItemId[]>();
  model.items.forEach((item, index) => {
    const thing = graph.thingOf[index];
    const ofStruct = item.parent !== undefined && model.items[item.parent].kind === 'type';
    if (item.kind !== 'field' || !ofStruct || thing === undefined) return;
    fields.set(thing, [...(fields.get(thing) ?? []), index as ItemId]);
  });
  return fields;
}

function fieldsBehind(model: Model, member: ItemId, flow: Flow): ItemId[] {
  if (model.items[member].kind === 'field') return [member];
  const wrapper = model.wrappers.get(member);
  if (wrapper?.kind !== 'accessor') return [];
  return [...(flow === 'read' ? [] : wrapper.leaked), ...(flow === 'write' ? [] : wrapper.lent)];
}

function reachable(from: ItemId, next: Map<ItemId, ItemId[]>): ItemId[] {
  const found = new Set<ItemId>();
  const pending = [from];
  for (let at = pending.pop(); at !== undefined; at = pending.pop()) {
    for (const reached of next.get(at) ?? []) {
      if (found.has(reached)) continue;
      found.add(reached);
      pending.push(reached);
    }
  }
  return ascending(found);
}

function upward(links: Map<ItemId, ItemId[]>): Map<ItemId, ItemId[]> {
  const above = new Map<ItemId, ItemId[]>();
  for (const [upper, lower] of links) {
    for (const item of lower) above.set(item, [...(above.get(item) ?? []), upper]);
  }
  return above;
}

function classLines(model: Model, graph: Graph): Map<ThingId, Set<ThingId>> {
  const bases = upward(model.subclasses);
  const lines = new Map<ThingId, Set<ThingId>>();
  for (const type of new Set([...model.subclasses.keys(), ...bases.keys()])) {
    const thing = graph.thingOf[type];
    const line = [...reachable(type, bases), ...reachable(type, model.subclasses)].flatMap((other) => graph.thingOf[other] ?? []);
    if (thing !== undefined) lines.set(thing, new Set(line));
  }
  return lines;
}

export function knownOutside(model: Model, graph: Graph): Outside {
  const lines = classLines(model, graph);
  const outside: Outside = { used: new Set(), leaks: new Map(), working: new Set() };
  const isInsider = (user: ThingId | undefined, owner: ThingId | undefined): boolean => {
    if (user === undefined || owner === undefined) return false;
    const tangle = graph.tangleOf[owner];
    const tangled = tangle !== undefined && graph.tangleOf[user] === tangle;
    return user === owner || tangled || (lines.get(owner)?.has(user) ?? false);
  };
  const usedOutside = (use: Use): void => {
    outside.used.add(use.item);
    if (!use.copies) outside.leaks.set(use.item, [...(outside.leaks.get(use.item) ?? []), use]);
  };
  for (const use of graph.uses) {
    const owner = graph.thingOf[use.item];
    if (owner === undefined || model.items[use.item].kind !== 'field') continue;
    if (!isInsider(use.user, owner)) usedOutside(use);
    else if (use.user === owner && works(model, use)) outside.working.add(owner);
    if (use.copies) continue;
    const behind = reachable(use.item, model.implementations).flatMap((member) => fieldsBehind(model, member, model.references[use.reference].flow));
    for (const field of behind) {
      if (!isInsider(use.user, graph.thingOf[field])) usedOutside({ ...use, item: field, through: use.through ?? use.item });
    }
  }
  return outside;
}

export function checkLeaks(model: Model, graph: Graph, scope: NodeId | undefined): Diagnostic[] {
  const fields = fieldsByThing(model, graph);
  const outside = knownOutside(model, graph);
  const diagnostics: Diagnostic[] = [];
  for (const thing of ascending(fields.keys())) {
    const own = fields.get(thing) ?? [];
    const kept = own.some((field) => !outside.used.has(field));
    if (!kept || !outside.working.has(thing)) continue;
    for (const field of own) {
      const leaks = outside.leaks.get(field);
      if (leaks === undefined) continue;
      const written = leaks.some((use) => inScope(model.tree, scope, model.references[use.reference].from));
      const concerned = inScope(model.tree, scope, graph.things[thing].home) || written;
      if (concerned) diagnostics.push(diagnostic(model, graph, thing, field, leaks, others(model, field, own, outside)));
    }
  }
  return diagnostics;
}

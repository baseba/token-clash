import type { Graph, ThingId } from '../graph/graph.js';
import type { ItemId, Model, Reference } from '../model/model.js';
import type { NodeId, Tree } from '../model/tree.js';

export const HELD_IN_MIND = 7;

export const LINTS = ['module-cycle', 'tangle', 'field-leak', 'shallow-module', 'wide-directory', 'long-file'] as const;

export type Lint = (typeof LINTS)[number];

export interface Location {
  file: string;
  line: number;
}

export interface Step {
  member: string;
  site: Location;
  uses: string;
}

export interface Circle {
  kind: 'circle';
  steps: Step[];
  rest: string | undefined;
}

export interface SpreadModule {
  places: number;
  module: string;
}

export interface Spread {
  kind: 'spread';
  owner: string;
  field: string;
  modules: SpreadModule[];
  others: string[];
}

export interface LongList {
  name: string;
  length: number;
}

export interface Lists {
  kind: 'lists';
  shown: number;
  hidden: number;
  lists: LongList[];
}

export interface Bar {
  kind: 'bar';
  label: string;
  length: number;
  most: number;
}

export type Picture = Circle | Spread | Lists | Bar;

export interface Diagnostic {
  lint: Lint;
  key: string;
  message: string;
  location: Location | undefined;
  notes: string[];
  picture: Picture;
}

export const compareText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export const compareLocations = (a: Location, b: Location): number => compareText(a.file, b.file) || a.line - b.line;

export const sameLocation = (location: Location, other: Location): boolean => compareLocations(location, other) === 0;

export const ascending = <Id extends number>(ids: Iterable<Id>): Id[] => [...ids].sort((a, b) => a - b);

export function clickable(location: Location): string {
  return `${location.file}:${location.line}:1`;
}

export function counted(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

export function listed(names: string[]): string {
  const shown = names.slice(0, HELD_IN_MIND).join(', ');
  return names.length > HELD_IN_MIND ? `${shown}, +${names.length - HELD_IN_MIND} more` : shown;
}

export function grouped(names: string[]): string {
  const groups = new Map<string, string[]>();
  for (const name of names) {
    const cut = name.indexOf('::');
    const head = cut === -1 ? name : name.slice(0, cut);
    const tail = cut === -1 ? 'self' : name.slice(cut + 2);
    groups.set(head, [...(groups.get(head) ?? []), tail]);
  }
  const written = [...groups].map(([head, tails]) => {
    if (tails.length > 1) return `${head}::{${listed(tails)}}`;
    return tails[0] === 'self' ? head : `${head}::${tails[0]}`;
  });
  return listed(written);
}

function namesOf(model: Model, items: Iterable<ItemId>): string[] {
  return ascending(items).map((item) => model.items[item].name);
}

export function inScope(tree: Tree, scope: NodeId | undefined, node: NodeId): boolean {
  return scope === undefined || tree.isWithin(node, scope);
}

export function fullName(model: Model, graph: Graph, thing: ThingId): string {
  const { item, home } = graph.things[thing];
  return `${model.tree.display(home)}::${model.items[item].name}`;
}

export function locationOf(model: Model, reference: Reference): Location {
  return { file: model.files[reference.file].path, line: reference.line };
}

export function declaringFile(model: Model, directory: string): string | undefined {
  const within = directory === '' ? '' : `${directory}/`;
  const inside = model.files.map((file) => file.path).filter((path) => path.startsWith(within) && !path.slice(within.length).includes('/'));
  const nestModule = inside.filter((path) => path.endsWith('.module.ts')).sort(compareText)[0];
  return nestModule ?? inside.find((path) => path === `${within}index.ts`);
}

export function moduleLocation(model: Model, module: NodeId): Location | undefined {
  const own = model.files
    .filter((file) => file.module === module)
    .map((file) => file.path)
    .sort(compareText)[0];
  const file = own ?? declaringFile(model, model.tree.directory(module));
  return file === undefined ? undefined : { file, line: 1 };
}

export class Tie {
  private readonly items = new Set<ItemId>();
  private readonly holders = new Set<ItemId>();
  private readonly sites: Location[] = [];
  private readonly written = new Map<NodeId, Location>();

  add(model: Model, item: ItemId, reference: Reference, module: NodeId): void {
    this.items.add(item);
    if (reference.holder !== undefined) this.holders.add(reference.holder);
    const site = locationOf(model, reference);
    const first = this.written.get(module);
    if (first === undefined || compareLocations(site, first) < 0) this.written.set(module, site);
    this.sites.push(site);
  }

  cost(): number {
    return this.items.size;
  }

  site(): Location {
    return [...this.sites].sort(compareLocations)[0];
  }

  note(model: Model, verb: string, user: string, used: string): string {
    const site = this.site();
    const firsts = [...this.written.values()].sort(compareLocations);
    const elsewhere = firsts.filter((first, index) => !sameLocation(first, site) && (index === 0 || !sameLocation(first, firsts[index - 1]))).map(clickable);
    const also = elsewhere.length === 0 ? '' : `; also at ${listed(elsewhere)}`;
    return `${clickable(site)}: \`${user}\` ${verb} \`${used}\` by ${counted(this.items.size, 'item')}: ${listed(namesOf(model, this.items))}${also}`;
  }

  step(model: Model, member: string): Step {
    const items = grouped(namesOf(model, this.items));
    const holders = namesOf(model, this.holders);
    const uses = holders.length === 1 ? `${holders[0]} uses ${items}` : `uses ${items}`;
    return { member, site: this.site(), uses };
  }
}

export interface NamedTie {
  user: string;
  used: string;
  tie: Tie;
}

export interface Ends {
  user: string;
  used: string;
}

export function shortestCircle(ties: Ends[]): number[] {
  const start = ties[0].user;
  const end = ties[0].used;
  const reachedBy = new Map<string, number | undefined>([[end, undefined]]);
  const queue = [end];
  for (let member = queue.shift(); member !== undefined && member !== start; member = queue.shift()) {
    ties.forEach((tie, index) => {
      if (tie.user !== member || reachedBy.has(tie.used)) return;
      reachedBy.set(tie.used, index);
      queue.push(tie.used);
    });
  }
  const circle: number[] = [];
  for (let index = reachedBy.get(start); index !== undefined; index = reachedBy.get(ties[index].user)) circle.push(index);
  circle.push(0);
  return circle.reverse();
}

export interface CircleReport {
  location: Location | undefined;
  notes: string[];
  picture: Circle;
}

export function circleReport(model: Model, verb: string, noun: string, members: number, unsorted: NamedTie[]): CircleReport {
  const ties = [...unsorted].sort((a, b) => a.tie.cost() - b.tie.cost() || compareText(a.user, b.user) || compareText(a.used, b.used));
  const notes = ties.slice(0, HELD_IN_MIND).map(({ user, used, tie }) => tie.note(model, verb, user, used));
  if (ties.length > HELD_IN_MIND) notes.push(`and ${counted(ties.length - HELD_IN_MIND, 'more tie')}`);
  const circle = shortestCircle(ties);
  const steps = circle.map((index) => ties[index].tie.step(model, ties[index].user));
  const leftOut = [
    { count: members - circle.length, noun: `more ${noun}` },
    { count: ties.length - circle.length, noun: 'more tie' },
  ]
    .filter((left) => left.count > 0)
    .map((left) => counted(left.count, left.noun));
  const rest = leftOut.length === 0 ? undefined : `not drawn: ${leftOut.join(', ')}`;
  return { location: ties[0]?.tie.site(), notes, picture: { kind: 'circle', steps, rest } };
}

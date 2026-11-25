import type { ItemId, Model, Reference } from '../model/model.js';
import type { NodeId } from '../model/tree.js';
import { circles } from './components.js';

export type ThingId = number & { readonly brand: 'ThingId' };
export type TangleId = number & { readonly brand: 'TangleId' };

export interface Thing {
  item: ItemId;
  home: NodeId;
}

export interface Use {
  reference: number;
  user: ThingId | undefined;
  item: ItemId;
  through: ItemId | undefined;
  copies: boolean;
}

export interface Graph {
  things: Thing[];
  thingOf: (ThingId | undefined)[];
  uses: Use[];
  tangles: ThingId[][];
  tangleOf: (TangleId | undefined)[];
}

const THING_KINDS = new Set(['type', 'function', 'constant']);

function rootOf(model: Model, item: ItemId): ItemId {
  let root = item;
  for (let parent = model.items[root].parent; parent !== undefined; parent = model.items[root].parent) root = parent;
  return root;
}

function findThings(model: Model): Pick<Graph, 'things' | 'thingOf'> {
  const things: Thing[] = [];
  const ofRoot = new Map<ItemId, ThingId>();
  const thingOf = model.items.map((_item, index) => {
    const root = rootOf(model, index as ItemId);
    const rootItem = model.items[root];
    if (!THING_KINDS.has(rootItem.kind)) return undefined;
    const known = ofRoot.get(root);
    if (known !== undefined) return known;
    const thing = things.length as ThingId;
    things.push({ item: root, home: rootItem.owner });
    ofRoot.set(root, thing);
    return thing;
  });
  return { things, thingOf };
}

interface Used {
  item: ItemId;
  copies: boolean;
}

function behind(model: Model, reference: Reference): Used[] {
  const used: Used[] = [];
  let at = reference.item;
  for (;;) {
    const wrapper = model.wrappers.get(at);
    if (wrapper?.kind === 'forwarder') {
      used.push(...wrapper.fields.map((field) => ({ item: field, copies: true })));
      at = wrapper.target;
      continue;
    }
    if (wrapper === undefined) return [...used, { item: at, copies: at === reference.item && reference.copies }];
    const leaked = wrapper.leaked.map((field) => ({ item: field, copies: false }));
    const lent = wrapper.lent.map((field) => ({ item: field, copies: reference.copies }));
    return [...used, ...leaked, ...lent, ...wrapper.copied.map((field) => ({ item: field, copies: true }))];
  }
}

function findUses(model: Model, thingOf: (ThingId | undefined)[]): Use[] {
  const uses: Use[] = [];
  model.references.forEach((reference, index) => {
    if (reference.holder !== undefined && model.wrappers.has(reference.holder)) return;
    const user = reference.holder === undefined ? undefined : thingOf[reference.holder];
    for (const used of behind(model, reference)) {
      const through = used.item === reference.item ? undefined : reference.item;
      if (thingOf[used.item] !== undefined) uses.push({ reference: index, user, item: used.item, through, copies: used.copies });
    }
  });
  return uses;
}

export function buildGraph(model: Model): Graph {
  const { things, thingOf } = findThings(model);
  const uses = findUses(model, thingOf);
  const knows: number[][] = things.map(() => []);
  for (const use of uses) {
    const used = thingOf[use.item];
    if (use.user !== undefined && used !== undefined && use.user !== used) knows[use.user].push(used);
  }
  const tangles = circles(knows) as ThingId[][];
  const tangleOf = new Array<TangleId | undefined>(things.length).fill(undefined);
  tangles.forEach((members, index) => {
    for (const member of members) tangleOf[member] = index as TangleId;
  });
  return { things, thingOf, uses, tangles, tangleOf };
}

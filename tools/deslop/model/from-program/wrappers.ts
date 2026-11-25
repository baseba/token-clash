import ts from 'typescript';
import type { Accessor, Forwarder, ItemId, Wrapper } from '../model.js';
import { relayedBy } from './accessors.js';
import { Functions } from './forwarders.js';
import { type Catalog, bodyOf } from './items.js';
import type { Project } from './load.js';
import { Mentions, accessNamedBy, callOf } from './mentions.js';
import type { Occurrence } from './references.js';
import { Values } from './values.js';

interface Lender extends Accessor {
  toRead: boolean;
  alone: ItemId | undefined;
}

export class Wrappers {
  private readonly values: Values;
  private readonly mentions: Mentions;
  private readonly functions: Functions;
  private readonly forwarders = new Map<ItemId, Forwarder>();
  private readonly lenders = new Map<ItemId, Lender>();

  static findAndMarkReads(project: Project, catalog: Catalog, occurrences: Occurrence[]): Map<ItemId, Wrapper> {
    const wrappers = new Wrappers(project, catalog, occurrences);
    for (const occurrence of occurrences) wrappers.markRead(occurrence);
    const accessors = [...wrappers.lenders].map(([item, { lent, copied }]): [ItemId, Wrapper] => [item, { kind: 'accessor', lent, copied }]);
    return new Map<ItemId, Wrapper>([...wrappers.forwarders, ...accessors]);
  }

  private constructor(
    private readonly project: Project,
    private readonly catalog: Catalog,
    occurrences: Occurrence[],
  ) {
    this.values = new Values(project);
    this.mentions = new Mentions(project.checker, this.values);
    this.functions = new Functions(project.checker, catalog, occurrences);
    const items = catalog.items.map((_item, index) => index as ItemId);
    for (const item of items) {
      const forwarder = this.functions.forwarder(item);
      if (forwarder !== undefined && !this.reaches(forwarder.target, item)) this.forwarders.set(item, forwarder);
    }
    for (const item of items) {
      const lender = this.forwarders.has(item) ? undefined : this.lender(item);
      if (lender !== undefined) this.lenders.set(item, lender);
    }
  }

  private reaches(from: ItemId, to: ItemId): boolean {
    let at: ItemId | undefined = from;
    while (at !== undefined && at !== to) at = this.forwarders.get(at)?.target;
    return at === to;
  }

  private isInLine(above: ItemId | undefined, below: ItemId): boolean {
    if (above === undefined) return false;
    return above === below || (this.catalog.subclasses.get(above) ?? []).some((subclass) => this.isInLine(subclass, below));
  }

  private ownField(access: ts.Expression, own: ItemId): ItemId | undefined {
    if (!ts.isPropertyAccessExpression(access) || access.expression.kind !== ts.SyntaxKind.ThisKeyword) return undefined;
    const field = this.functions.only(access.name, 'field');
    return field !== undefined && this.isInLine(this.catalog.items[field].parent, own) ? field : undefined;
  }

  private holdsValue(field: ItemId): boolean {
    return this.values.holdsValue(this.catalog.declarations[field][0]);
  }

  private lender(item: ItemId): Lender | undefined {
    const { parent, takesSelf } = this.catalog.items[item];
    const body = bodyOf(this.catalog, item);
    if (body === undefined || parent === undefined || !takesSelf) return undefined;
    const relayed = relayedBy(this.project.checker, body, (access) => this.ownField(access, parent));
    if (relayed === undefined || relayed.fields.size === 0) return undefined;
    const toRead = relayed.written.size === 0 && !relayed.callsBack;
    const alone = toRead && relayed.fields.size === 1 ? relayed.alone : undefined;
    const fields = [...relayed.fields].sort((a, b) => a - b);
    const lent = fields.filter((field) => alone !== undefined || relayed.written.has(field) || !this.holdsValue(field));
    return { kind: 'accessor', lent, copied: fields.filter((field) => !lent.includes(field)), toRead, alone };
  }

  private lenderBehind(named: ItemId): Lender | undefined {
    let behind = named;
    for (let forwarder = this.forwarders.get(behind); forwarder !== undefined; forwarder = this.forwarders.get(behind)) behind = forwarder.target;
    return this.lenders.get(behind);
  }

  private readsLent({ toRead, alone }: Lender, name: ts.Node, isProperty: boolean): boolean {
    const mention = isProperty ? accessNamedBy(name) : callOf(name);
    if (!toRead || mention === undefined) return toRead && alone !== undefined && this.holdsValue(alone);
    return !this.mentions.leaks(mention, alone !== undefined);
  }

  private markRead({ node, notation, reference }: Occurrence): void {
    const named = reference.item;
    const lender = this.lenderBehind(named);
    if (lender !== undefined) reference.copies = this.readsLent(lender, node, this.catalog.declarations[named].some(ts.isAccessor));
    if (this.catalog.items[named].kind !== 'field') return;
    const mention = accessNamedBy(node);
    const taken = notation === 'destructuring' && this.holdsValue(named);
    reference.copies = notation === 'construction' || taken || (notation === 'name' && (mention === undefined || !this.mentions.leaks(mention, true)));
  }
}

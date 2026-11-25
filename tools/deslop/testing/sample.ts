import type { FileId, ItemId, ItemKind, Model } from '../model/model.js';
import { type NodeId, Tree } from '../model/tree.js';

export class Sample {
  readonly model: Model = {
    tree: new Tree('p'),
    files: [],
    items: [],
    references: [],
    wrappers: new Map(),
    implementations: new Map(),
    subclasses: new Map(),
  };

  module(path: string): NodeId {
    const tree = this.model.tree;
    const node = path
      .split('::')
      .filter((name) => name !== '')
      .reduce((parent, name) => tree.child(parent, name), tree.root());
    if (!this.model.files.some((file) => file.module === node)) this.file(node, `src/${path.replaceAll('::', '/')}.ts`, 1);
    return node;
  }

  file(module: NodeId, path: string, lines: number): void {
    this.model.files.push({ path, module, lines });
  }

  item(owner: NodeId, name: string, kind: ItemKind): ItemId {
    this.model.items.push({ name, owner, kind, parent: undefined, traitImpl: false, takesSelf: false });
    return (this.model.items.length - 1) as ItemId;
  }

  member(parent: ItemId, owner: NodeId, name: string, kind: ItemKind): ItemId {
    const id = this.item(owner, name, kind);
    this.model.items[id].parent = parent;
    return id;
  }

  extend(subclass: ItemId, base: ItemId): void {
    this.model.subclasses.set(base, [...(this.model.subclasses.get(base) ?? []), subclass]);
  }

  refer(holder: ItemId, item: ItemId): void {
    const from = this.model.items[holder].owner;
    const file = this.model.files.findIndex((candidate) => candidate.module === from) as FileId;
    this.model.references.push({ file, line: this.model.references.length + 1, from, holder, item, copies: false, writes: false });
  }

  read(holder: ItemId, item: ItemId): void {
    this.refer(holder, item);
    this.model.references[this.model.references.length - 1].copies = true;
  }
}

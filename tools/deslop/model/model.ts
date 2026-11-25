import type { NodeId, Tree } from './tree.js';

export type FileId = number & { readonly brand: 'FileId' };
export type ItemId = number & { readonly brand: 'ItemId' };

export interface CodeFile {
  path: string;
  module: NodeId;
  lines: number;
}

export type ItemKind = 'type' | 'function' | 'field' | 'variant' | 'constant';

export interface Item {
  name: string;
  owner: NodeId;
  kind: ItemKind;
  parent: ItemId | undefined;
  traitImpl: boolean;
  takesSelf: boolean;
}

export interface Reference {
  file: FileId;
  line: number;
  from: NodeId;
  holder: ItemId | undefined;
  item: ItemId;
  copies: boolean;
}

export interface Forwarder {
  kind: 'forwarder';
  target: ItemId;
  fields: ItemId[];
}

export interface Accessor {
  kind: 'accessor';
  lent: ItemId[];
  copied: ItemId[];
}

export type Wrapper = Forwarder | Accessor;

export interface Model {
  tree: Tree;
  files: CodeFile[];
  items: Item[];
  references: Reference[];
  wrappers: Map<ItemId, Wrapper>;
  implementations: Map<ItemId, ItemId[]>;
  subclasses: Map<ItemId, ItemId[]>;
}

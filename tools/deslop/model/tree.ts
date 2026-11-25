export type NodeId = number & { readonly brand: 'NodeId' };

export type NodeKind = 'package' | 'module';

export interface TreeNode {
  readonly name: string;
  readonly kind: NodeKind;
  readonly parent: NodeId | undefined;
  readonly depth: number;
}

export class Tree {
  private readonly nodes: TreeNode[];
  private readonly children = new Map<string, NodeId>();

  constructor(packageName: string) {
    this.nodes = [{ name: packageName, kind: 'package', parent: undefined, depth: 0 }];
  }

  root(): NodeId {
    return 0 as NodeId;
  }

  child(parent: NodeId, name: string): NodeId {
    const key = `${parent}/${name}`;
    const known = this.children.get(key);
    if (known !== undefined) return known;
    const id = this.nodes.length as NodeId;
    this.nodes.push({ name, kind: 'module', parent, depth: this.nodes[parent].depth + 1 });
    this.children.set(key, id);
    return id;
  }

  node(id: NodeId): TreeNode {
    return this.nodes[id];
  }

  ids(): NodeId[] {
    return this.nodes.map((_node, index) => index as NodeId);
  }

  parent(id: NodeId): NodeId | undefined {
    return this.nodes[id].parent;
  }

  ancestors(id: NodeId): NodeId[] {
    const chain: NodeId[] = [];
    for (let node: NodeId | undefined = id; node !== undefined; node = this.nodes[node].parent) chain.push(node);
    return chain;
  }

  commonAncestor(first: NodeId, second: NodeId): NodeId {
    const above = new Set(this.ancestors(first));
    const shared = this.ancestors(second).find((node) => above.has(node));
    return shared ?? this.root();
  }

  isWithin(id: NodeId, ancestor: NodeId): boolean {
    return this.ancestors(id).includes(ancestor);
  }

  display(id: NodeId): string {
    return this.names(id).join('::');
  }

  directory(id: NodeId): string {
    return this.names(id).join('/');
  }

  private names(id: NodeId): string[] {
    return this.ancestors(id)
      .reverse()
      .map((node) => this.nodes[node].name);
  }
}

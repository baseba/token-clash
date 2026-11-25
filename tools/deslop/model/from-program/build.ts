import type { CodeFile, Model } from '../model.js';
import { type NodeId, Tree } from '../tree.js';
import { collectItems } from './items.js';
import { PACKAGE, type Project } from './load.js';
import { collectReferences } from './references.js';
import { Wrappers } from './wrappers.js';

function countLines(text: string): number {
  if (text === '') return 0;
  return text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
}

function moduleOf(tree: Tree, path: string): NodeId {
  const names = path
    .replace(/\.[cm]?[jt]sx?$/, '')
    .split('/')
    .slice(1);
  return names.reduce((parent, name) => tree.child(parent, name), tree.root());
}

export function buildModel(project: Project): Model {
  const tree = new Tree(PACKAGE);
  const files: CodeFile[] = project.sources.map(({ path, syntax }) => ({ path, module: moduleOf(tree, path), lines: countLines(syntax.text) }));
  const modules = files.map((file) => file.module);
  const catalog = collectItems(project.checker, project.sources, modules);
  const occurrences = collectReferences(project.checker, project.sources, modules, catalog);
  const wrappers = Wrappers.findAndMarkReads(project, catalog, occurrences);
  const references = occurrences.map((occurrence) => occurrence.reference);
  const { items, implementations, subclasses } = catalog;
  return { tree, files, items, references, wrappers, implementations, subclasses };
}

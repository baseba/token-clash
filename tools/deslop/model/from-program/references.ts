import ts from 'typescript';
import type { FileId, ItemId, Reference } from '../model.js';
import type { NodeId } from '../tree.js';
import { type Catalog, itemsOfSymbol, memberName, namesNamespace } from './items.js';
import type { Source } from './load.js';

export type Notation = 'name' | 'construction' | 'destructuring' | 'call';

export interface Occurrence {
  node: ts.Node;
  notation: Notation;
  reference: Reference;
}

const DEFINING = new Set([
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.ClassExpression,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.EnumMember,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.TypeParameter,
  ts.SyntaxKind.ModuleDeclaration,
  ts.SyntaxKind.NamedTupleMember,
]);

type Name = ts.Identifier | ts.PrivateIdentifier | ts.StringLiteralLike;

const isImportOrExport = (node: ts.Node): boolean => ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node) || ts.isExportDeclaration(node);

const definesName = (parent: ts.Node, name: ts.Node): boolean => DEFINING.has(parent.kind) && (parent as ts.NamedDeclaration).name === name;

function namesMember(node: ts.Node): node is ts.StringLiteralLike {
  if (!ts.isStringLiteralLike(node)) return false;
  const parent = node.parent;
  if (ts.isElementAccessExpression(parent)) return parent.argumentExpression === node;
  if (ts.isPropertyAssignment(parent)) return parent.name === node;
  return ts.isBindingElement(parent) && parent.propertyName === node;
}

function isDestructured(pattern: ts.Node): boolean {
  const parent = pattern.parent;
  if (ts.isBinaryExpression(parent)) return parent.left === pattern && parent.operatorToken.kind === ts.SyntaxKind.EqualsToken;
  if (ts.isForOfStatement(parent)) return parent.initializer === pattern;
  if (ts.isPropertyAssignment(parent)) return parent.initializer === pattern && isDestructured(parent.parent);
  return ts.isArrayLiteralExpression(parent) && isDestructured(parent);
}

const isSuperCall = (node: ts.Node): node is ts.CallExpression => ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.SuperKeyword;

type Flow = 'read' | 'write' | 'both';

function flowOf(name: ts.Node): Flow {
  let place = name.parent;
  while (ts.isParenthesizedExpression(place.parent) || ts.isNonNullExpression(place.parent)) place = place.parent;
  const user = place.parent;
  if (ts.isPrefixUnaryExpression(user) || ts.isPostfixUnaryExpression(user)) {
    return user.operator === ts.SyntaxKind.PlusPlusToken || user.operator === ts.SyntaxKind.MinusMinusToken ? 'both' : 'read';
  }
  if (!ts.isBinaryExpression(user) || user.left !== place) return 'read';
  const operator = user.operatorToken.kind;
  if (operator === ts.SyntaxKind.EqualsToken) return 'write';
  return operator >= ts.SyntaxKind.FirstAssignment && operator <= ts.SyntaxKind.LastAssignment ? 'both' : 'read';
}

export function collectReferences(checker: ts.TypeChecker, sources: Source[], modules: NodeId[], catalog: Catalog): Occurrence[] {
  const occurrences: Occurrence[] = [];

  const exportsName = (node: ts.Node): boolean => {
    if (!ts.isExportAssignment(node)) return false;
    const exported = node.expression;
    return ts.isIdentifier(exported) || (ts.isPropertyAccessExpression(exported) && namesNamespace(checker, exported.expression));
  };

  const isClassHeader = (node: ts.Node): boolean => {
    return ts.isHeritageClause(node) && ts.isClassDeclaration(node.parent) && catalog.itemOfDeclaration.has(node.parent);
  };

  const holderOf = (node: ts.Node): ItemId | undefined => {
    for (let ancestor = node.parent; ancestor !== undefined && !isClassHeader(ancestor); ancestor = ancestor.parent) {
      const item = catalog.itemOfDeclaration.get(ancestor);
      if (item !== undefined) return item;
    }
    return undefined;
  };

  const called = (name: Name, items: ItemId[], destructured: boolean): ItemId[] => {
    const declared = (item: ItemId) => catalog.declarations[item][0];
    if (!items.some((item) => ts.isAccessor(declared(item)))) return items;
    const flow = destructured ? 'read' : flowOf(name);
    return items.filter((item) => {
      if (ts.isGetAccessorDeclaration(declared(item))) return flow !== 'write';
      return !ts.isSetAccessorDeclaration(declared(item)) || flow !== 'read';
    });
  };

  const propertiesOf = (type: ts.Type | undefined, name: string): ts.Symbol[] => {
    if (type === undefined) return [];
    const parts = type.isUnion() ? type.types : [type];
    return parts.flatMap((part) => part.getProperty(name) ?? []);
  };

  const elementsOf = (lists: ts.Type[]): ts.Type[] => lists.flatMap((list) => list.getNumberIndexType() ?? []);

  const takenFrom = (pattern: ts.Node): ts.Type[] => {
    const parent = pattern.parent;
    if (ts.isBinaryExpression(parent)) return [checker.getTypeAtLocation(parent.right)];
    if (ts.isVariableDeclaration(parent) || ts.isParameter(parent)) {
      if (parent.initializer !== undefined) return [checker.getTypeAtLocation(parent.initializer)];
      const list = parent.parent;
      if (ts.isVariableDeclaration(parent) && ts.isVariableDeclarationList(list) && ts.isForOfStatement(list.parent)) {
        return elementsOf([checker.getTypeAtLocation(list.parent.expression)]);
      }
      return [];
    }
    if (ts.isForOfStatement(parent)) return elementsOf([checker.getTypeAtLocation(parent.expression)]);
    if (ts.isArrayLiteralExpression(parent)) return elementsOf(takenFrom(parent));
    if (ts.isBindingElement(parent)) {
      const holders = takenFrom(parent.parent);
      if (ts.isArrayBindingPattern(parent.parent)) return elementsOf(holders);
      const raw = parent.propertyName ?? parent.name;
      const key = ts.isObjectBindingPattern(raw) || ts.isArrayBindingPattern(raw) ? undefined : memberName({ name: raw });
      if (key === undefined) return [];
      return holders.flatMap((holder) => propertiesOf(holder, key).map((property) => checker.getTypeOfSymbol(property)));
    }
    const key = ts.isPropertyAssignment(parent) ? memberName(parent) : undefined;
    if (key === undefined) return [];
    return takenFrom(parent.parent).flatMap((holder) => propertiesOf(holder, key).map((property) => checker.getTypeOfSymbol(property)));
  };

  const takenByAssignment = (name: Name, pattern: ts.Node): ts.Symbol[] => {
    if (ts.isIdentifier(name)) return [checker.getPropertySymbolOfDestructuringAssignment(name)].flatMap((taken) => taken ?? []);
    return takenFrom(pattern).flatMap((holder) => propertiesOf(holder, name.text));
  };

  const visitSource = (source: Source, file: FileId, from: NodeId): void => {
    const record = (node: ts.Node, notation: Notation, items: ItemId[]): void => {
      const line = source.syntax.getLineAndCharacterOfPosition(node.getStart(source.syntax)).line + 1;
      const holder = holderOf(node);
      for (const item of items) occurrences.push({ node, notation, reference: { file, line, from, holder, item, copies: false } });
    };
    const itemsNamed = (symbols: ts.Symbol[]): ItemId[] => [...new Set(symbols.flatMap((symbol) => itemsOfSymbol(checker, catalog, symbol)))];
    const visitName = (name: Name): void => {
      const parent = name.parent;
      if (ts.isBindingElement(parent) && (parent.name === name || parent.propertyName === name)) {
        const names = parent.propertyName === name || parent.propertyName === undefined;
        const taken = names && ts.isObjectBindingPattern(parent.parent) && parent.dotDotDotToken === undefined;
        const sources = taken ? [checker.getTypeAtLocation(parent.parent), ...takenFrom(parent.parent)] : [];
        const items = itemsNamed(sources.flatMap((source) => propertiesOf(source, name.text)));
        record(name, 'destructuring', called(name, items, true));
        return;
      }
      if ((ts.isPropertyAssignment(parent) || ts.isShorthandPropertyAssignment(parent)) && parent.name === name) {
        if (isDestructured(parent.parent)) {
          record(name, 'destructuring', called(name, itemsNamed(takenByAssignment(name, parent.parent)), true));
        } else {
          const given = itemsNamed(propertiesOf(checker.getContextualType(parent.parent), name.text));
          record(
            name,
            'construction',
            given.filter((item) => catalog.items[item].kind === 'field'),
          );
        }
        if (ts.isShorthandPropertyAssignment(parent)) record(name, 'name', itemsOfSymbol(checker, catalog, checker.getShorthandAssignmentValueSymbol(parent)));
        return;
      }
      if (!definesName(parent, name)) record(name, 'name', called(name, itemsOfSymbol(checker, catalog, checker.getSymbolAtLocation(name)), false));
    };
    const visit = (node: ts.Node): void => {
      if (isImportOrExport(node) || exportsName(node)) return;
      if (ts.isIdentifier(node) || ts.isPrivateIdentifier(node) || namesMember(node)) visitName(node);
      if (ts.isNewExpression(node) || isSuperCall(node)) {
        const constructor = checker.getResolvedSignature(node)?.declaration;
        const item = constructor === undefined ? undefined : catalog.itemOfDeclaration.get(constructor);
        if (item !== undefined) record(node.expression, 'call', [item]);
      }
      ts.forEachChild(node, visit);
    };
    visit(source.syntax);
  };

  sources.forEach((source, index) => visitSource(source, index as FileId, modules[index]));
  return occurrences;
}

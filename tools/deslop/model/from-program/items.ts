import ts from 'typescript';
import type { Item, ItemId, ItemKind } from '../model.js';
import type { NodeId } from '../tree.js';
import type { Source } from './load.js';

export interface Catalog {
  items: Item[];
  declarations: ts.Node[][];
  itemOfDeclaration: Map<ts.Node, ItemId>;
  implementations: Map<ItemId, ItemId[]>;
  subclasses: Map<ItemId, ItemId[]>;
}

interface Draft {
  name: string;
  kind: ItemKind;
  parent: ItemId | undefined;
  takesSelf: boolean;
  traitImpl: boolean;
}

const KIND_RANK: Record<ItemKind, number> = { type: 4, function: 3, constant: 2, field: 1, variant: 0 };

const DEFAULT_EXPORT = 'default';

const NAMESPACES = ts.SymbolFlags.Class | ts.SymbolFlags.Enum | ts.SymbolFlags.Module;

const KEEPS_ITS_VALUE = new Set([
  ts.SyntaxKind.ParenthesizedExpression,
  ts.SyntaxKind.NonNullExpression,
  ts.SyntaxKind.SatisfiesExpression,
  ts.SyntaxKind.AsExpression,
  ts.SyntaxKind.TypeAssertionExpression,
]);

export function unwrapped(expression: ts.Expression): ts.Expression {
  let inner = expression;
  while (KEEPS_ITS_VALUE.has(inner.kind)) inner = (inner as ts.ParenthesizedExpression).expression;
  return inner;
}

export function namesNamespace(checker: ts.TypeChecker, path: ts.Expression): boolean {
  const name = ts.isPropertyAccessExpression(path) ? path.name : path;
  const symbol = ts.isIdentifier(name) ? checker.getSymbolAtLocation(name) : undefined;
  const named = symbol !== undefined && (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
  return named !== undefined && (named.flags & NAMESPACES) !== 0;
}

function functionValue(initializer: ts.Expression | undefined): ts.ArrowFunction | ts.FunctionExpression | undefined {
  if (initializer === undefined) return undefined;
  const value = unwrapped(initializer);
  return ts.isArrowFunction(value) || ts.isFunctionExpression(value) ? value : undefined;
}

export type Body = ts.FunctionLikeDeclaration;

function bodyIn(declaration: ts.Node): Body | undefined {
  if (ts.isVariableDeclaration(declaration) || ts.isPropertyDeclaration(declaration)) return functionValue(declaration.initializer);
  const isFunction = ts.isFunctionDeclaration(declaration) || ts.isMethodDeclaration(declaration);
  const written = isFunction || ts.isConstructorDeclaration(declaration) || ts.isAccessor(declaration);
  return written && declaration.body !== undefined ? declaration : undefined;
}

export function bodyOf(catalog: Catalog, item: ItemId): Body | undefined {
  const bodies = catalog.declarations[item].flatMap((declaration) => bodyIn(declaration) ?? []);
  return bodies.length === 1 ? bodies[0] : undefined;
}

export function memberName(member: { readonly name?: ts.PropertyName }): string | undefined {
  const name = member.name;
  if (name === undefined) return undefined;
  return ts.isIdentifier(name) || ts.isPrivateIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name) ? name.text : undefined;
}

const isStatic = (member: ts.ClassElement): boolean => (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Static) !== 0;

const overrides = (member: ts.ClassElement): boolean => (ts.getCombinedModifierFlags(member) & ts.ModifierFlags.Override) !== 0;

const functionName = (member: ts.Node, bare: string): string => (ts.isSetAccessorDeclaration(member) ? `set ${bare}` : bare);

function link(links: Map<ItemId, ItemId[]>, above: ItemId, below: ItemId): void {
  const known = links.get(above) ?? [];
  if (above !== below && !known.includes(below)) links.set(above, [...known, below]);
}

export function collectItems(checker: ts.TypeChecker, sources: Source[], modules: NodeId[]): Catalog {
  const catalog: Catalog = { items: [], declarations: [], itemOfDeclaration: new Map(), implementations: new Map(), subclasses: new Map() };
  const itemOfKey = new Map<string, ItemId>();

  const declare = (declaration: ts.Node, key: string, owner: NodeId, draft: Draft): ItemId => {
    const known = itemOfKey.get(key);
    const id = known ?? (catalog.items.length as ItemId);
    if (known === undefined) {
      catalog.items.push({ ...draft, owner });
      catalog.declarations.push([]);
      itemOfKey.set(key, id);
    } else if (KIND_RANK[draft.kind] > KIND_RANK[catalog.items[id].kind]) {
      catalog.items[id].kind = draft.kind;
    }
    catalog.declarations[id].push(declaration);
    catalog.itemOfDeclaration.set(declaration, id);
    return id;
  };

  const free = (kind: ItemKind, name: string): Draft => ({ name, kind, parent: undefined, takesSelf: false, traitImpl: false });

  const declareLiterals = (node: ts.TypeNode | undefined, root: ItemId, prefix: string, owner: NodeId): void => {
    if (node === undefined || ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode(node)) return;
    if (ts.isTypeLiteralNode(node)) {
      declareSignatures(node.members, root, prefix, owner, true);
      return;
    }
    ts.forEachChild(node, (child) => {
      if (ts.isTypeNode(child)) declareLiterals(child, root, prefix, owner);
    });
  };

  const declareSignatures = (members: readonly ts.TypeElement[], root: ItemId, prefix: string, owner: NodeId, ofAlias: boolean): void => {
    for (const member of members) {
      const bare = memberName(member);
      if (bare === undefined) continue;
      const isField = ts.isPropertySignature(member);
      const name = `${prefix}::${isField ? bare : functionName(member, bare)}`;
      declare(member, `${root} ${name}`, owner, { name, kind: isField ? 'field' : 'function', parent: root, takesSelf: !isField, traitImpl: false });
      if (isField && ofAlias) declareLiterals(member.type, root, name, owner);
    }
  };

  const isPromised = (declaration: ts.ClassDeclaration, name: string): boolean => {
    const above = (declaration.heritageClauses ?? []).flatMap((clause) => clause.types);
    return above.some((type) => checker.getTypeFromTypeNode(type).getProperty(name) !== undefined);
  };

  const declareClassMembers = (declaration: ts.ClassDeclaration, type: ItemId, typeName: string, owner: NodeId): void => {
    const method = (name: string, takesSelf: boolean, traitImpl: boolean): Draft => {
      return { name: `${typeName}::${name}`, kind: 'function', parent: type, takesSelf, traitImpl };
    };
    const value = (node: ts.PropertyDeclaration | ts.ParameterDeclaration, bare: string, statics: string): void => {
      const name = `${typeName}::${bare}`;
      const kind = statics === '' ? 'field' : 'constant';
      declare(node, `${type} ${statics}${name}`, owner, { name, kind, parent: type, takesSelf: false, traitImpl: false });
    };
    for (const member of declaration.members) {
      if (ts.isConstructorDeclaration(member)) {
        declare(member, `${type} constructor`, owner, method('constructor', false, false));
        for (const parameter of member.parameters) {
          if (ts.isParameterPropertyDeclaration(parameter, member) && ts.isIdentifier(parameter.name)) value(parameter, parameter.name.text, '');
        }
        continue;
      }
      const bare = memberName(member);
      if (bare === undefined) continue;
      const statics = isStatic(member) ? 'static ' : '';
      if (ts.isPropertyDeclaration(member) && functionValue(member.initializer) === undefined) {
        value(member, bare, statics);
        continue;
      }
      if (!ts.isPropertyDeclaration(member) && !ts.isMethodDeclaration(member) && !ts.isAccessor(member)) continue;
      const traitImpl = statics === '' && (isPromised(declaration, bare) || overrides(member));
      const name = functionName(member, bare);
      declare(member, `${type} ${statics}${typeName}::${name}`, owner, method(name, statics === '', traitImpl));
    }
  };

  const declareStatement = (statement: ts.Statement, file: number, owner: NodeId): void => {
    const top = (declaration: ts.Node, name: string, kind: ItemKind) => declare(declaration, `${file}:${name}`, owner, free(kind, name));
    if (ts.isClassDeclaration(statement)) {
      const name = statement.name?.text ?? DEFAULT_EXPORT;
      declareClassMembers(statement, top(statement, name, 'type'), name, owner);
    } else if (ts.isInterfaceDeclaration(statement)) {
      declareSignatures(statement.members, top(statement, statement.name.text, 'type'), statement.name.text, owner, false);
    } else if (ts.isTypeAliasDeclaration(statement)) {
      declareLiterals(statement.type, top(statement, statement.name.text, 'type'), statement.name.text, owner);
    } else if (ts.isEnumDeclaration(statement)) {
      const type = top(statement, statement.name.text, 'type');
      for (const member of statement.members) {
        const bare = memberName(member);
        const name = `${statement.name.text}::${bare}`;
        if (bare !== undefined) declare(member, `${type} ${name}`, owner, { name, kind: 'variant', parent: type, takesSelf: false, traitImpl: false });
      }
    } else if (ts.isFunctionDeclaration(statement)) {
      top(statement, statement.name?.text ?? DEFAULT_EXPORT, 'function');
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const kind = functionValue(declaration.initializer) === undefined ? 'constant' : 'function';
        if (ts.isIdentifier(declaration.name)) top(declaration, declaration.name.text, kind);
      }
    }
  };

  sources.forEach((source, file) => {
    for (const statement of source.syntax.statements) declareStatement(statement, file, modules[file]);
  });
  catalog.declarations.forEach((declarations, item) => {
    for (const declaration of declarations) {
      if (ts.isClassDeclaration(declaration) || ts.isInterfaceDeclaration(declaration)) linkToHeritage(checker, catalog, declaration, item as ItemId);
    }
  });
  return catalog;
}

function linkToHeritage(checker: ts.TypeChecker, catalog: Catalog, declaration: ts.ClassDeclaration | ts.InterfaceDeclaration, type: ItemId): void {
  const named = (symbol: ts.Symbol | undefined, kind: ItemKind) => itemsOfSymbol(checker, catalog, symbol).filter((item) => catalog.items[item].kind === kind);
  const accessors = (symbol: ts.Symbol | undefined) => named(symbol, 'function').filter((item) => catalog.declarations[item].some(ts.isAccessor));
  const signatures = (symbol: ts.Symbol) => named(symbol, 'field').filter((item) => catalog.declarations[item].some(ts.isPropertySignature));
  const held = checker.getTypeAtLocation(declaration);
  for (const clause of declaration.heritageClauses ?? []) {
    const extendsClass = ts.isClassDeclaration(declaration) && clause.token === ts.SyntaxKind.ExtendsKeyword;
    for (const above of clause.types) {
      const bases = extendsClass ? named(checker.getSymbolAtLocation(above.expression), 'type') : [];
      for (const base of bases) link(catalog.subclasses, base, type);
      for (const declared of checker.getPropertiesOfType(checker.getTypeFromTypeNode(above))) {
        const property = held.getProperty(declared.name);
        const holding = [...named(property, 'field'), ...accessors(property)];
        for (const promised of signatures(declared)) holding.forEach((member) => link(catalog.implementations, promised, member));
      }
    }
  }
}

export function itemsOfSymbol(checker: ts.TypeChecker, catalog: Catalog, symbol: ts.Symbol | undefined): ItemId[] {
  if (symbol === undefined) return [];
  const target = (symbol.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(symbol) : symbol;
  const found = new Set<ItemId>();
  for (const declaration of target.declarations ?? []) {
    const item = catalog.itemOfDeclaration.get(declaration);
    const isLocalParameter = ts.isParameter(declaration) && (target.flags & ts.SymbolFlags.Property) === 0;
    if (item !== undefined && !isLocalParameter) found.add(item);
  }
  return [...found];
}

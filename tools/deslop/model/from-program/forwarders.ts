import ts from 'typescript';
import type { Forwarder, Item, ItemId } from '../model.js';
import { type Body, type Catalog, bodyOf, namesNamespace } from './items.js';
import type { Occurrence } from './references.js';

interface Receiver {
  isOperand: boolean;
  fields: ItemId[];
}

function onlyExpression(body: Body): ts.Expression | undefined {
  const written = body.body;
  if (written === undefined || !ts.isBlock(written)) return written;
  const [statement] = written.statements;
  const alone = written.statements.length === 1 && (ts.isReturnStatement(statement) || ts.isExpressionStatement(statement));
  return alone ? statement.expression : undefined;
}

function onlyCall(body: Body): ts.CallExpression | ts.NewExpression | undefined {
  let expression = onlyExpression(body);
  while (expression !== undefined && (ts.isParenthesizedExpression(expression) || ts.isAwaitExpression(expression))) expression = expression.expression;
  if (expression === undefined || ts.isOptionalChain(expression)) return undefined;
  return ts.isCallExpression(expression) || ts.isNewExpression(expression) ? expression : undefined;
}

const isSelf = (expression: ts.Expression): boolean => expression.kind === ts.SyntaxKind.ThisKeyword || expression.kind === ts.SyntaxKind.SuperKeyword;

export class Functions {
  private readonly occurrencesAt = new Map<ts.Node, Occurrence[]>();

  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly catalog: Catalog,
    occurrences: Occurrence[],
  ) {
    for (const occurrence of occurrences) this.occurrencesAt.set(occurrence.node, [...(this.occurrencesAt.get(occurrence.node) ?? []), occurrence]);
  }

  only(node: ts.Node, kind: 'function' | 'field'): ItemId | undefined {
    const items = (this.occurrencesAt.get(node) ?? []).map((occurrence) => occurrence.reference.item).filter((item) => this.catalog.items[item].kind === kind);
    return items.length === 1 ? items[0] : undefined;
  }

  forwarder(item: ItemId): Forwarder | undefined {
    const body = bodyOf(this.catalog, item);
    const caller = this.catalog.items[item];
    if (body === undefined || caller.traitImpl || ts.isConstructorDeclaration(body)) return undefined;
    const call = onlyCall(body);
    if (call === undefined) return undefined;
    const callee = call.expression;
    const calledOn = ts.isCallExpression(call) && ts.isPropertyAccessExpression(callee) ? callee : undefined;
    const target = this.only(calledOn?.name ?? callee, 'function');
    const receiver = calledOn === undefined ? { isOperand: false, fields: [] } : this.receiver(caller, body, calledOn.expression);
    if (target === undefined || target === item || receiver === undefined) return undefined;
    const passed = call.arguments ?? [];
    const fits = receiver.isOperand === this.catalog.items[target].takesSelf && passed.length === this.parameterCount(target);
    const forwards = fits && passed.every((argument) => this.passesOn(body, argument, caller.takesSelf));
    return forwards ? { kind: 'forwarder', target, fields: receiver.fields } : undefined;
  }

  private parameterCount(item: ItemId): number | undefined {
    const declarations = this.catalog.declarations[item];
    const signature = bodyOf(this.catalog, item) ?? (declarations.length === 1 && ts.isFunctionLike(declarations[0]) ? declarations[0] : undefined);
    return signature?.parameters.filter((parameter) => !ts.isIdentifier(parameter.name) || parameter.name.text !== 'this').length;
  }

  private given(body: Body, expression: ts.Node): ts.ParameterDeclaration | undefined {
    const declaration = ts.isIdentifier(expression) ? this.checker.getSymbolAtLocation(expression)?.valueDeclaration : undefined;
    const isOwn = declaration !== undefined && ts.isParameter(declaration) && declaration.parent === body && declaration.initializer === undefined;
    return isOwn ? declaration : undefined;
  }

  private receiver(caller: Item, body: Body, expression: ts.Expression): Receiver | undefined {
    const fields: ItemId[] = [];
    let root = expression;
    while (ts.isPropertyAccessExpression(root) && !ts.isOptionalChain(root)) {
      const field = this.only(root.name, 'field');
      if (field === undefined) return undefined;
      fields.unshift(field);
      root = root.expression;
    }
    if (isSelf(root) && caller.takesSelf) return { isOperand: true, fields };
    if (fields.length > 0) return undefined;
    if (this.given(body, root) !== undefined) return { isOperand: true, fields };
    const namesClass = isSelf(root) ? caller.parent !== undefined : ts.isIdentifier(root) && namesNamespace(this.checker, root);
    return namesClass ? { isOperand: false, fields } : undefined;
  }

  private passesOn(body: Body, argument: ts.Expression, takesSelf: boolean): boolean {
    if (argument.kind === ts.SyntaxKind.ThisKeyword) return takesSelf;
    if (ts.isSpreadElement(argument)) return this.given(body, argument.expression)?.dotDotDotToken !== undefined;
    return this.given(body, argument) !== undefined;
  }
}

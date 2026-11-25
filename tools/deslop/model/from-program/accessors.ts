import ts from 'typescript';
import type { ItemId } from '../model.js';
import { unwrapped } from './items.js';

interface Relayed {
  fields: Set<ItemId>;
  written: Set<ItemId>;
  callsBack: boolean;
  alone: ItemId | undefined;
}

type OwnField = (access: ts.Expression) => ItemId | undefined;

const LITERAL_KEYWORDS = new Set([ts.SyntaxKind.NullKeyword, ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword]);

export function relayedBy(checker: ts.TypeChecker, body: ts.FunctionLikeDeclaration, ownField: OwnField): Relayed | undefined {
  const relayed: Relayed = { fields: new Set(), written: new Set(), callsBack: false, alone: undefined };
  const given = new Set<ts.Symbol>();
  const constants = new Map<ts.Symbol, ItemId | undefined>();
  const localNamed = (expression: ts.Node): ts.Symbol | undefined => (ts.isIdentifier(expression) ? checker.getSymbolAtLocation(expression) : undefined);
  const isLocal = (symbol: ts.Symbol | undefined): boolean => symbol !== undefined && (given.has(symbol) || constants.has(symbol));

  const fieldAlone = (written: ts.Expression): ItemId | undefined => {
    const expression = unwrapped(written);
    const local = localNamed(expression);
    return local === undefined ? ownField(expression) : constants.get(local);
  };

  const relaysProperty = (property: ts.ObjectLiteralElementLike): boolean => {
    if (ts.isShorthandPropertyAssignment(property)) return isLocal(checker.getShorthandAssignmentValueSymbol(property));
    return ts.isPropertyAssignment(property) && !ts.isComputedPropertyName(property.name) && relays(property.initializer);
  };

  const relaysCall = (call: ts.CallExpression): boolean => {
    const callee = localNamed(call.expression);
    if (callee === undefined || !given.has(callee)) return false;
    relayed.callsBack = true;
    return call.arguments.every(relays);
  };

  const relaysWrite = (assignment: ts.BinaryExpression): boolean => {
    const field = assignment.operatorToken.kind === ts.SyntaxKind.EqualsToken ? ownField(assignment.left) : undefined;
    const value = localNamed(unwrapped(assignment.right));
    if (field === undefined || value === undefined || !given.has(value)) return false;
    relayed.fields.add(field);
    relayed.written.add(field);
    return true;
  };

  const relays = (written: ts.Expression): boolean => {
    const expression = unwrapped(written);
    if (ts.isLiteralExpression(expression) || LITERAL_KEYWORDS.has(expression.kind)) return true;
    if (ts.isIdentifier(expression)) return isLocal(localNamed(expression));
    const field = ownField(expression);
    if (field !== undefined) {
      relayed.fields.add(field);
      return true;
    }
    if (ts.isArrayLiteralExpression(expression)) return expression.elements.every(relays);
    if (ts.isObjectLiteralExpression(expression)) return expression.properties.every(relaysProperty);
    if (ts.isCallExpression(expression)) return relaysCall(expression);
    return ts.isBinaryExpression(expression) && relaysWrite(expression);
  };

  const relaysStatement = (statement: ts.Statement): boolean => {
    if (ts.isReturnStatement(statement)) return statement.expression === undefined || relays(statement.expression);
    if (ts.isExpressionStatement(statement)) return relays(statement.expression);
    if (!ts.isVariableStatement(statement) || (statement.declarationList.flags & ts.NodeFlags.Const) === 0) return false;
    return statement.declarationList.declarations.every((declaration) => {
      const local = localNamed(declaration.name);
      if (local === undefined || declaration.initializer === undefined || !relays(declaration.initializer)) return false;
      const held = localNamed(unwrapped(declaration.initializer));
      if (held !== undefined && given.has(held)) given.add(local);
      else constants.set(local, fieldAlone(declaration.initializer));
      return true;
    });
  };

  for (const parameter of body.parameters) {
    const local = parameter.initializer === undefined && parameter.dotDotDotToken === undefined ? localNamed(parameter.name) : undefined;
    if (local === undefined) return undefined;
    given.add(local);
  }
  const written = body.body;
  const isAsyncOrGenerator = body.asteriskToken !== undefined || (ts.getCombinedModifierFlags(body) & ts.ModifierFlags.Async) !== 0;
  if (written === undefined || isAsyncOrGenerator) return undefined;
  const relaysAll = ts.isBlock(written) ? written.statements.every(relaysStatement) : relays(written);
  const returned = ts.isBlock(written) ? written.statements.find(ts.isReturnStatement)?.expression : written;
  if (!relaysAll) return undefined;
  relayed.alone = returned === undefined ? undefined : fieldAlone(returned);
  return relayed;
}

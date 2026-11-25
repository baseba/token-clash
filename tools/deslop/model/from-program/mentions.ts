import ts from 'typescript';
import { outerCast } from './items.js';
import type { Values } from './values.js';

const Kind = ts.SyntaxKind;

const COMPARISONS = new Set([Kind.EqualsEqualsEqualsToken, Kind.ExclamationEqualsEqualsToken, Kind.EqualsEqualsToken, Kind.ExclamationEqualsToken]);

const CHOICES = new Set([Kind.AmpersandAmpersandToken, Kind.BarBarToken, Kind.QuestionQuestionToken]);

const TESTED_ON_THE_LEFT = new Set([Kind.InstanceOfKeyword, Kind.AmpersandAmpersandToken]);

const STEPS = new Set([Kind.PlusPlusToken, Kind.MinusMinusToken]);

const DECLARES_FIELD = new Set([Kind.PropertyDeclaration, Kind.PropertySignature, Kind.Parameter, Kind.PropertyAssignment, Kind.ShorthandPropertyAssignment]);

export function outermost(expression: ts.Expression): ts.Expression {
  let around = expression;
  while (ts.isParenthesizedExpression(around.parent) || ts.isNonNullExpression(around.parent)) around = around.parent;
  return around;
}

export function accessNamedBy(name: ts.Node): ts.Expression | undefined {
  const parent = name.parent;
  if (ts.isPropertyAccessExpression(parent)) return parent.name === name ? parent : undefined;
  return ts.isElementAccessExpression(parent) && parent.argumentExpression === name ? parent : undefined;
}

export function callOf(name: ts.Node): ts.CallExpression | undefined {
  const named = accessNamedBy(name) ?? (ts.isIdentifier(name) ? name : undefined);
  const callee = named === undefined ? undefined : outermost(named);
  const call = callee?.parent;
  return call !== undefined && ts.isCallExpression(call) && call.expression === callee ? call : undefined;
}

const isAssignment = (operator: ts.SyntaxKind): boolean => operator >= Kind.FirstAssignment && operator <= Kind.LastAssignment;

export function isWritten(place: ts.Node): boolean {
  const parent = place.parent;
  if (ts.isBinaryExpression(parent)) return parent.left === place && isAssignment(parent.operatorToken.kind);
  if (ts.isPrefixUnaryExpression(parent) || ts.isPostfixUnaryExpression(parent)) return STEPS.has(parent.operator);
  if (ts.isForOfStatement(parent) || ts.isForInStatement(parent)) return parent.initializer === place;
  if (ts.isPropertyAssignment(parent)) return parent.initializer === place && isWritten(parent.parent);
  const holds = ts.isSpreadElement(parent) || ts.isSpreadAssignment(parent) || ts.isArrayLiteralExpression(parent) || ts.isObjectLiteralExpression(parent);
  return ts.isDeleteExpression(parent) || (holds && isWritten(parent));
}

function isTested(expression: ts.Expression): boolean {
  const tested = outermost(expression);
  const parent = tested.parent;
  if (ts.isIfStatement(parent) || ts.isWhileStatement(parent) || ts.isDoStatement(parent) || ts.isSwitchStatement(parent)) return parent.expression === tested;
  if (ts.isForStatement(parent) || ts.isConditionalExpression(parent)) return parent.condition === tested;
  if (ts.isPrefixUnaryExpression(parent)) return parent.operator === Kind.ExclamationToken;
  if (!ts.isBinaryExpression(parent)) return ts.isTypeOfExpression(parent) || ts.isCaseClause(parent);
  const operator = parent.operatorToken.kind;
  if (COMPARISONS.has(operator) || (TESTED_ON_THE_LEFT.has(operator) && parent.left === tested)) return true;
  return CHOICES.has(operator) && isTested(parent);
}

export class Mentions {
  constructor(
    private readonly checker: ts.TypeChecker,
    private readonly values: Values,
  ) {}

  leaks(mention: ts.Expression, typed: boolean): boolean {
    const named = outermost(mention);
    if (isWritten(named)) return true;
    if (typed && this.values.holdsValue(mention)) return !this.values.holdsValue(outerCast(named));
    const end = this.endOfPath(named);
    if (end === named) return !isTested(named);
    return isWritten(end) || !this.values.isScalar(this.checker.getTypeAtLocation(end));
  }

  takesScalars(key: ts.Node): boolean {
    const pattern = ts.isBindingElement(key.parent) ? key.parent.name : key;
    if (!ts.isObjectBindingPattern(pattern)) return false;
    const taken = (name: ts.Node) => (ts.isIdentifier(name) ? this.checker.getTypeAtLocation(pattern).getProperty(name.text) : undefined);
    const ends = (name: ts.BindingName) => (ts.isIdentifier(name) ? this.values.isScalar(this.checker.getTypeAtLocation(name)) : this.takesScalars(name));
    return pattern.elements.every(({ propertyName, name }) => this.isDeclaredField(taken(propertyName ?? name)) && ends(name));
  }

  private endOfPath(named: ts.Expression): ts.Expression {
    let end = named;
    const isField = (name: ts.MemberName): boolean => this.isDeclaredField(this.checker.getSymbolAtLocation(name));
    for (let next = end.parent; ts.isPropertyAccessExpression(next) && next.expression === end && isField(next.name); next = end.parent) end = outermost(next);
    return end;
  }

  private isDeclaredField(property: ts.Symbol | undefined): boolean {
    const declarations = property?.declarations ?? [];
    const isOfProject = (declaration: ts.Declaration) => DECLARES_FIELD.has(declaration.kind) && !declaration.getSourceFile().isDeclarationFile;
    return declarations.length > 0 && declarations.every(isOfProject);
  }
}

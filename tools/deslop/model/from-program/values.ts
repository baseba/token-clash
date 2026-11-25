import ts from 'typescript';
import type { Project } from './load.js';

const { StringLike, NumberLike, BigIntLike, BooleanLike, EnumLike, ESSymbolLike, Void, Undefined, Null, Never } = ts.TypeFlags;

const SCALAR = StringLike | NumberLike | BigIntLike | BooleanLike | EnumLike | ESSymbolLike | Void | Undefined | Null | Never;

const READONLY_COLLECTIONS = new Set(['ReadonlyArray', 'ReadonlySet', 'ReadonlyMap']);

export class Values {
  constructor(private readonly project: Pick<Project, 'checker' | 'isLibrary'>) {}

  isScalar(type: ts.Type): boolean {
    if ((type.flags & SCALAR) !== 0) return true;
    if (type.isUnion()) return type.types.every((part) => this.isScalar(part));
    if (type.isIntersection()) return type.types.some((part) => this.isScalar(part));
    const constraint = (type.flags & ts.TypeFlags.Instantiable) === 0 ? undefined : this.project.checker.getBaseConstraintOfType(type);
    return constraint !== undefined && constraint !== type && this.isScalar(constraint);
  }

  isValue(type: ts.Type, around: ts.Type[] = []): boolean {
    if (this.isScalar(type) || around.includes(type)) return true;
    const parts = type.isUnion() ? type.types : this.readonlyParts(type);
    return parts !== undefined && parts.every((part) => this.isValue(part, [...around, type]));
  }

  holdsValue(typed: ts.Node): boolean {
    return this.isValue(this.project.checker.getTypeAtLocation(typed));
  }

  private readonlyParts(type: ts.Type): readonly ts.Type[] | undefined {
    const { checker, isLibrary } = this.project;
    if (checker.isTupleType(type)) return (type as ts.TupleTypeReference).target.readonly ? checker.getTypeArguments(type as ts.TupleTypeReference) : undefined;
    const fromLibrary = (type.symbol?.declarations ?? []).some((declaration) => isLibrary(declaration.getSourceFile()));
    const isCollection = fromLibrary && READONLY_COLLECTIONS.has(type.symbol.name);
    return isCollection ? checker.getTypeArguments(type as ts.TypeReference) : undefined;
  }
}

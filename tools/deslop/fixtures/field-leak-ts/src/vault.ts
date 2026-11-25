export interface Limit {
  most: number;
}

export interface Holder {
  held: number[];
}

export interface VaultState {
  tasks: number[];
}

export class ScalarRead {
  private secret = 0;
  count = 0;
  name = 'a';

  work(): number {
    return this.secret + 1;
  }
}

export class ScalarWrite {
  private secret = 0;
  assigned = 0;
  bumped = 0;
  stepped = 0;
  removed?: number;
  retaken = 0;
  castAssigned = 0;
  castStepped = 0;

  work(): number {
    return this.secret + 1;
  }
}

export class ValueRead {
  private secret = 0;
  readonly ids: readonly number[] = [];
  readonly tags: ReadonlySet<string> = new Set();
  readonly byId: ReadonlyMap<string, readonly number[]> = new Map();

  work(): number {
    return this.secret + 1;
  }
}

export class ValueCast {
  private secret = 0;
  readonly castIds: readonly number[] = [];
  readonly chainCast: readonly number[] = [];
  readonly checkedCast: readonly number[] = [];

  work(): number {
    return this.secret + 1;
  }
}

export class MutableList {
  private secret = 0;
  counted: number[] = [];
  passed: number[] = [];
  aliased: number[] = [];
  indexed: number[] = [];
  spread: number[] = [];
  taken: number[] = [];
  iterated: number[] = [];

  work(): number {
    return this.secret + 1;
  }
}

export class ObjectField {
  private secret = 0;
  read: Limit = { most: 1 };
  chained: Limit | null = null;
  written: Limit = { most: 1 };
  stored: Limit = { most: 1 };
  tested: Limit | null = null;
  compared: Limit | null = null;
  defaulted: Limit | null = null;
  chosen: Limit | null = null;
  typed: Limit | null = null;
  picked: Limit | null = null;
  nested: Limit = { most: 1 };
  unpacked: Limit = { most: 1 };
  reassigned: Limit = { most: 1 };
  keyed: Limit = { most: 1 };
  keyedInPattern: Limit = { most: 1 };

  work(): number {
    return this.secret + 1;
  }
}

export class Bracket {
  private secret = 0;
  private readonly hidden: number[] = [];

  work(): number {
    return this.secret + this.hidden.length;
  }
}

export class Getters {
  private secret = 0;
  private readonly viewed: number[] = [];
  private readonly lentOut: number[] = [];
  private level = 0;
  private readonly cap: Limit = { most: 1 };
  private readonly pathWritten: Limit = { most: 1 };
  private readonly referenced: number[] = [];
  private readonly relayed: number[] = [];
  private readonly widened: readonly number[] = [];
  private stamp = 0;
  private readonly stamped: Limit = { most: 1 };
  private readonly topped: Limit = { most: 1 };
  private readonly packed: Limit = { most: 1 };
  private readonly widenedByCall: readonly number[] = [];
  private readonly queried: number[] = [];

  work(): number {
    return this.secret + 1;
  }

  get view(): readonly number[] {
    return this.viewed;
  }

  get wide(): number[] {
    return this.widened as number[];
  }

  touch(stamp: number): Limit {
    this.stamp = stamp;
    return this.stamped;
  }

  get all(): number[] {
    return this.lentOut;
  }

  set depth(level: number) {
    this.level = level;
  }

  setLevel(level: number): void {
    this.level = level;
  }

  getCap(): Limit {
    return this.cap;
  }

  getPathWritten(): Limit {
    return this.pathWritten;
  }

  getReferenced(): number[] {
    return this.referenced;
  }

  getRelayed(): number[] {
    const relayed = this.relayed;
    return relayed;
  }

  get top(): Limit {
    return this.topped;
  }

  getPacked(): Limit {
    return this.packed;
  }

  getWide(): number[] {
    return this.widenedByCall as number[];
  }

  get query(): number[] {
    return this.queried;
  }
}

export class Setters {
  private secret = 0;
  private fromPattern = 0;
  private fromList = 0;
  private fromLoop = 0;
  private fromCast = 0;

  work(): number {
    return this.secret + 1;
  }

  set byPattern(value: number) {
    this.fromPattern = value;
  }

  set byList(value: number) {
    this.fromList = value;
  }

  set byLoop(value: number) {
    this.fromLoop = value;
  }

  set byCast(value: number) {
    this.fromCast = value;
  }
}

export class Literals {
  private secret = 0;
  private readonly inTuple: number[] = [];
  private readonly inObject: number[] = [];
  private readonly inState: number[] = [];
  private readonly toCallback: number[] = [];
  private readonly valueToCallback: readonly number[] = [];

  work(): number {
    return this.secret + 1;
  }

  parts(): [number[], number] {
    return [this.inTuple, 1];
  }

  snapshot() {
    return { list: this.inObject };
  }

  toState(): VaultState {
    return { tasks: this.inState };
  }

  withList<Result>(each: (list: number[]) => Result): Result {
    return each(this.toCallback);
  }

  withIds<Result>(each: (list: readonly number[]) => Result): Result {
    return each(this.valueToCallback);
  }
}

export class Working {
  private secret = 0;
  private readonly guardedReturn: number[] = [];
  private readonly partReturned: Limit[] = [];
  private total = 0;
  private promised = 0;

  work(): number {
    return this.secret + 1;
  }

  checked(): number[] {
    if (this.total > 0) this.total -= 1;
    return this.guardedReturn;
  }

  first(): Limit | undefined {
    return this.partReturned[0];
  }

  replace(total: number): void {
    this.total = total + 1;
  }

  async getPromised(): Promise<number> {
    return this.promised;
  }
}

export class Generic<Value> {
  private secret = 0;

  constructor(
    private readonly takenValue: Value,
    private readonly dottedValue: Value,
  ) {}

  work(): number {
    return this.secret + 1;
  }

  get taken(): Value {
    return this.takenValue;
  }

  get dotted(): Value {
    return this.dottedValue;
  }
}

export class Decides {
  private secret = 0;
  private state = 'open';
  private seat = '';

  work(): number {
    return this.secret + this.state.length + this.seat.length;
  }

  close(): void {
    this.state = 'closed';
  }

  take(seat: { readonly id: string }): void {
    this.seat = seat.id;
  }
}

export class Structural implements Holder {
  private secret = 0;
  held: number[] = [];
  shaped: number[] = [];
  anyTyped: number[] = [];

  work(): number {
    return this.secret + 1;
  }
}

export class Undeclared {
  private secret = 0;
  held: number[] = [];

  work(): number {
    return this.secret + 1;
  }
}

export class Insiders {
  private secret = 0;
  merged: number[] = [];
  viaStatic: number[] = [];

  work(): number {
    return this.secret + 1;
  }

  merge(other: Insiders): void {
    other.merged.push(1);
  }

  static of(other: Insiders): number[] {
    return other.viaStatic;
  }
}

export class Ledger {
  open: number[] = [];

  constructor(readonly label: string) {}
}

export class NoWork {
  private kept = 0;
  shown: number[] = [];

  getKept(): number {
    return this.kept;
  }
}

export class Versioned {
  static readonly VERSION = 1;
  listed: number[] = [];

  work(): number {
    return this.listed.length;
  }
}

export class Line {
  private secret = 0;
  inherited: number[] = [];

  work(): number {
    return this.secret + 1;
  }
}

export class Heir extends Line {
  fill(): void {
    this.inherited.push(1);
  }
}

export class Knot {
  private secret = 0;
  tied: number[] = [];

  work(): number {
    return this.secret + 1;
  }

  untie(): void {
    this.tied.length = 0;
    loosen(this);
  }
}

export function loosen(knot: Knot): void {
  knot.tied.push(1);
}

export class SpecOnly {
  private secret = 0;
  probed: number[] = [];

  work(): number {
    return this.secret + 1;
  }
}

export class Inner {
  private secret = 0;
  private readonly list: number[] = [];

  work(): number {
    return this.secret + 1;
  }

  getList(): number[] {
    return this.list;
  }
}

export class Outer {
  private secret = 0;

  constructor(private readonly inner: Inner) {}

  work(): number {
    return this.secret + 1;
  }

  getList(): number[] {
    return this.inner.getList();
  }
}

export namespace Crate {
  export class Boxed {
    kept = 0;
    open: number[] = [];

    work(): number {
      return this.kept + 1;
    }
  }
}

export const Lidded = class {
  kept = 0;
  open: number[] = [];

  work(): number {
    return this.kept + 1;
  }
};

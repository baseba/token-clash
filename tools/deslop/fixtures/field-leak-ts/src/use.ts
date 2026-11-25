import type { Desk, Port, WidePort } from './port.js';
import type { Bracket, Crate, Decides, Getters, Holder, Insiders, Ledger, Lidded, Limit, Literals, MutableList, NoWork, ObjectField } from './vault.js';
import type { Heir, Knot, Outer, ScalarRead, ScalarWrite, Setters, Structural, ValueCast, ValueRead, Versioned, Working } from './vault.js';

declare function send(...values: unknown[]): void;

export function scalarRead(vault: ScalarRead): void {
  send(vault.count + 1, String(vault.count), vault.name.length, vault.name.toUpperCase());
  const { count } = vault;
  send(count);
}

export function scalarWrite(vault: ScalarWrite, other: ScalarWrite): void {
  vault.assigned = 2;
  vault.bumped += 1;
  vault.stepped++;
  delete vault.removed;
  ({ retaken: vault.retaken } = other);
}

export function valueRead(vault: ValueRead): void {
  const ids = vault.ids;
  send(
    ids,
    vault.ids,
    vault.ids.length,
    vault.ids.map((id) => id + 1),
    vault.ids[0],
    [...vault.ids],
  );
  for (const id of vault.ids) send(id);
  send(vault.tags.has('a'), vault.tags.size, vault.byId.get('k')?.length);
}

export function valueCast(vault: ValueCast): void {
  (vault.castIds as number[]).push(1);
  (vault.chainCast as readonly number[] as number[]).push(1);
  ((vault.checkedCast satisfies readonly number[]) as number[]).push(1);
}

export function mutableList(vault: MutableList): void {
  send(vault.counted.length);
  send(vault.passed);
  const aliased = vault.aliased;
  aliased.push(1);
  vault.indexed[0] = 1;
  send([...vault.spread]);
  const { taken } = vault;
  send(taken);
  for (const item of vault.iterated) send(item);
}

export function objectField(vault: ObjectField, other: Limit): void {
  send(vault.read.most);
  send(vault.chained?.most);
  vault.written.most = 2;
  const stored = vault.stored;
  send(stored);
  if (vault.tested) send(1);
  if (!vault.tested && vault.tested === null) send(2);
  send(vault.compared === other, vault.compared !== null ? 1 : 2);
  send(vault.defaulted ?? other);
  send(vault.chosen || other);
  send(typeof vault.typed, vault.typed instanceof Object);
  switch (other) {
    case vault.picked:
      send(3);
  }
  const {
    nested: { most },
  } = vault;
  send(most);
}

export function bracket(vault: Bracket): void {
  vault['hidden'].push(1);
}

export function getters(vault: Getters): void {
  send(
    vault.view.length,
    vault.view.map((item) => item),
  );
  const { view } = vault;
  send(view.length, vault.all.length);
  const { wide } = vault;
  wide.push(1);
  send(vault.touch(3).most);
  vault.depth = 2;
  vault.setLevel(3);
  send(vault.getCap().most);
  vault.getPathWritten().most = 4;
  send(vault.getReferenced);
  send(vault.getRelayed());
}

export function setters(vault: Setters, other: Limit): void {
  ({ most: vault.byPattern } = other);
  [vault.byList] = [1];
  for (vault.byLoop of [1]) send(1);
}

export function literals(vault: Literals): void {
  const [list] = vault.parts();
  send(list, vault.snapshot(), vault.toState());
  vault.withList((items) => items.push(1));
  vault.withIds((items) => send(items));
}

export function working(vault: Working, decides: Decides): void {
  vault.checked().push(1);
  send(vault.first());
  vault.replace(2);
  decides.close();
}

function drain(holder: { shaped: number[] }): void {
  holder.shaped.push(1);
}

export function structural(vault: Structural, holder: Holder): void {
  holder.held.push(1);
  drain(vault);
  (vault as any).anyTyped.push(1);
}

export function insiders(vault: Insiders): void {
  vault.merge(vault);
}

export function records(ledger: Ledger, idle: NoWork, versioned: Versioned): void {
  ledger.open.push(1);
  send(ledger.label);
  idle.shown.push(1);
  versioned.listed.push(1);
}

export function lines(heir: Heir, knot: Knot): void {
  heir.fill();
  knot.untie();
}

export function forwarded(outer: Outer): void {
  outer.getList().push(1);
}

export function ported(port: Port, wide: WidePort): void {
  port.room = 'a';
  if (port.seat === 'a') send(1);
  port.queue.push(1);
  port.view.push(1);
  wide.wide.push(1);
}

export function desked(desk: Desk): void {
  desk.label = 'a';
  desk.papers.push(1);
  desk.stamp = 2;
}

export function unseen(boxed: Crate.Boxed, lidded: InstanceType<typeof Lidded>): void {
  boxed.open.push(1);
  lidded.open.push(1);
}

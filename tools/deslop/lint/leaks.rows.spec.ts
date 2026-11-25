import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGraph } from '../graph/graph.js';
import { buildModel } from '../model/from-program/build.js';
import { loadProject } from '../model/from-program/load.js';
import type { ItemId } from '../model/model.js';
import { keys, workspace } from '../testing/workspace.js';
import { knownOutside } from './leaks.js';

type Standing = 'leaks' | 'reads' | 'kept' | 'unguarded' | 'unseen';

type Row = [field: string, standing: Standing, outside: string, decidedBy: string];

const ROWS: Row[] = [
  ['ScalarRead::count', 'reads', 'vault.count + 1, String(vault.count), const { count } = vault', 'S2'],
  ['ScalarRead::name', 'reads', 'vault.name.length, vault.name.toUpperCase()', 'S2, D1'],
  ['ScalarWrite::assigned', 'leaks', 'vault.assigned = 2', 'S1'],
  ['ScalarWrite::bumped', 'leaks', 'vault.bumped += 1', 'S1'],
  ['ScalarWrite::stepped', 'leaks', 'vault.stepped++', 'S1'],
  ['ScalarWrite::removed', 'leaks', 'delete vault.removed', 'S1'],
  ['ScalarWrite::retaken', 'leaks', '({ retaken: vault.retaken } = other)', 'S1'],
  ['ValueRead::ids', 'reads', 'const ids = vault.ids, send(vault.ids), for of, [...vault.ids], .length, .map(), [0]', 'S2, D2'],
  ['ValueRead::tags', 'reads', "vault.tags.has('a'), vault.tags.size", 'S2, D2'],
  ['ValueRead::byId', 'reads', "vault.byId.get('k')?.length", 'S2, D2'],
  ['ValueCast::castIds', 'leaks', '(vault.castIds as number[]).push(1)', 'S2 cast, D8'],
  ['ValueCast::chainCast', 'leaks', '(vault.chainCast as readonly number[] as number[]).push(1)', 'S2 cast, D8, by the outermost cast'],
  ['ValueCast::checkedCast', 'leaks', '((vault.checkedCast satisfies readonly number[]) as number[]).push(1)', 'S2 cast, D8, past satisfies'],
  ['MutableList::counted', 'leaks', 'vault.counted.length', 'S4'],
  ['MutableList::passed', 'leaks', 'send(vault.passed)', 'S4, D3'],
  ['MutableList::aliased', 'leaks', 'const aliased = vault.aliased', 'S4, at the alias'],
  ['MutableList::indexed', 'leaks', 'vault.indexed[0] = 1', 'S4'],
  ['MutableList::spread', 'leaks', '[...vault.spread]', 'S4, D4'],
  ['MutableList::taken', 'leaks', 'const { taken } = vault', 'S4'],
  ['MutableList::iterated', 'leaks', 'for (const item of vault.iterated)', 'S4'],
  ['ObjectField::read', 'reads', 'vault.read.most', 'S3a'],
  ['ObjectField::chained', 'reads', 'vault.chained?.most', 'S3a'],
  ['ObjectField::written', 'leaks', 'vault.written.most = 2', 'S1'],
  ['ObjectField::stored', 'leaks', 'const stored = vault.stored', 'S4'],
  ['ObjectField::tested', 'reads', 'if (vault.tested), !vault.tested && vault.tested === null', 'S3b'],
  ['ObjectField::compared', 'reads', 'vault.compared === other, vault.compared !== null ? 1 : 2', 'S3b'],
  ['ObjectField::defaulted', 'leaks', 'vault.defaulted ?? other', 'S4'],
  ['ObjectField::chosen', 'leaks', 'vault.chosen || other', 'S4'],
  ['ObjectField::typed', 'reads', 'typeof vault.typed, vault.typed instanceof Object', 'S3b'],
  ['ObjectField::picked', 'reads', 'switch (other) { case vault.picked: }', 'S3b'],
  ['ObjectField::nested', 'reads', 'const { nested: { most } } = vault', 'S3a, the path vault.nested.most written as a pattern'],
  ['Bracket::hidden', 'leaks', "vault['hidden'].push(1)", 'S4, a private field named by a string'],
  ['Getters::viewed', 'reads', 'get view(): readonly number[]; vault.view.length, vault.view.map(), const { view } = vault', 'accessor, S2, D2'],
  ['Getters::widened', 'leaks', 'get wide(): number[] over a readonly number[]; const { wide } = vault', 'accessor, S4, by the type the getter gives'],
  ['Getters::stamp', 'leaks', 'touch(stamp) { this.stamp = stamp; return this.stamped; }; vault.touch(3).most', 'accessor writes'],
  ['Getters::stamped', 'reads', 'touch(stamp): Limit, beside the field it writes; vault.touch(3).most', 'accessor, S3a, each field by its own row'],
  ['Getters::lentOut', 'leaks', 'get all(): number[]; vault.all.length', 'accessor, S4'],
  ['Getters::level', 'leaks', 'set depth(level), setLevel(level); vault.depth = 2, vault.setLevel(3)', 'accessor writes'],
  ['Getters::cap', 'reads', 'getCap(): Limit; vault.getCap().most', 'accessor, S3a'],
  ['Getters::pathWritten', 'leaks', 'getPathWritten(): Limit; vault.getPathWritten().most = 4', 'accessor, S1'],
  ['Getters::referenced', 'leaks', 'getReferenced(): number[]; send(vault.getReferenced)', 'accessor, not called'],
  ['Getters::relayed', 'leaks', 'getRelayed() { const relayed = this.relayed; return relayed; }; send(vault.getRelayed())', 'accessor by a const, S4'],
  ['Setters::fromPattern', 'leaks', 'set byPattern(value); ({ most: vault.byPattern } = other)', 'accessor writes, S1'],
  ['Setters::fromList', 'leaks', 'set byList(value); [vault.byList] = [1]', 'accessor writes, S1'],
  ['Setters::fromLoop', 'leaks', 'set byLoop(value); for (vault.byLoop of [1])', 'accessor writes, S1'],
  ['Literals::inTuple', 'leaks', 'parts(): [number[], number]; const [list] = vault.parts()', 'accessor, literal'],
  ['Literals::inObject', 'leaks', 'snapshot() { return { list: this.inObject }; }; vault.snapshot()', 'accessor, literal'],
  ['Literals::inState', 'leaks', 'toState(): VaultState; vault.toState()', 'accessor, literal, D5'],
  ['Literals::toCallback', 'leaks', 'withList(each) { return each(this.toCallback); }', 'accessor, callback'],
  ['Literals::valueToCallback', 'reads', 'withIds(each) { return each(this.valueToCallback); }', 'accessor, callback of a value'],
  ['Working::guardedReturn', 'kept', 'checked() { if (…) …; return this.guardedReturn; }; vault.checked().push(1)', 'L1'],
  ['Working::partReturned', 'kept', 'first() { return this.partReturned[0]; }; vault.first()', 'L1'],
  ['Working::total', 'kept', 'replace(total) { this.total = total + 1; }; vault.replace(2)', 'L1'],
  ['Decides::state', 'kept', "close() { this.state = 'closed'; }; decides.close()", 'L1, the method decides what it writes: work of the class, as in Rust'],
  ['Structural::held', 'leaks', 'holder.held.push(1), holder: Holder, class implements Holder', 'interface, work'],
  ['Structural::shaped', 'kept', 'drain(vault), drain(holder: { shaped: number[] })', 'L3'],
  ['Structural::anyTyped', 'kept', '(vault as any).anyTyped.push(1)', 'L2'],
  ['Undeclared::held', 'kept', 'holder.held.push(1), class does not implement Holder', 'L3'],
  ['Insiders::merged', 'kept', 'other.merged.push(1) in merge(other: Insiders)', 'insider'],
  ['Insiders::viaStatic', 'kept', 'return other.viaStatic in a static method', 'insider'],
  ['Ledger::open', 'unguarded', 'ledger.open.push(1), class with no kept field and no method', 'no guard'],
  ['Ledger::label', 'reads', 'send(ledger.label)', 'S2'],
  ['NoWork::kept', 'kept', 'nothing', 'kept'],
  ['NoWork::shown', 'unguarded', 'idle.shown.push(1), class with a kept field and only an accessor', 'no guard'],
  ['Versioned::listed', 'unguarded', 'versioned.listed.push(1), class whose only unused property is static', 'a static is no field'],
  ['Line::inherited', 'kept', 'this.inherited.push(1) in a subclass', 'D7'],
  ['Knot::tied', 'kept', 'knot.tied.push(1) in a function of its tangle', 'insider'],
  ['SpecOnly::probed', 'kept', 'vault.probed.push(1) in use.spec.ts', 'test code is no evidence'],
  ['Inner::list', 'leaks', 'outer.getList().push(1), Outer::getList forwards to Inner::getList', 'forwarder to an accessor, S4'],
  ['Outer::inner', 'reads', 'outer.getList()', 'forwarder'],
  ['Ported::room', 'leaks', "port.room = 'a', port: Port, class implements WidePort extends Port", 'interface, write'],
  ['Ported::seat', 'kept', "port.seat === 'a'", 'interface, read'],
  ['Ported::queue', 'leaks', 'port.queue.push(1)', 'interface, work'],
  ['Ported::wide', 'leaks', 'wide.wide.push(1), wide: WidePort', 'interface, work'],
  ['Ported::viewList', 'leaks', 'get view(): number[]; port.view.push(1)', 'interface, accessor'],
  ['Unported::room', 'kept', "port.room = 'a', class does not implement Port", 'L3'],
  ['Unported::queue', 'kept', 'port.queue.push(1), class does not implement Port', 'L3'],
  ['Desked::labelText', 'kept', "get label() relays, set label(label) works; desk.label = 'a', desk: Desk", 'interface, a write goes to the setter, L1'],
  ['Desked::paperList', 'kept', 'get papers() works, set papers(papers) relays; desk.papers.push(1)', 'interface, work goes to the getter, L1'],
  ['Desked::stampValue', 'leaks', 'get stamp() works, set stamp(stamp) relays; desk.stamp = 2', 'interface, a write goes to the setter'],
  ['Rack::slotList', 'kept', 'tray.slots.push(1) in one subclass, get slots() in another, tray: Tray', 'interface, insider of the class of the field'],
  ['Boxed::open', 'unseen', 'boxed.open.push(1), class inside a namespace', 'limit, not modelled'],
  ['Lidded::open', 'unseen', 'lidded.open.push(1), class written as an expression', 'limit, not modelled'],
];

const INTERFACES = new Set(['Limit', 'Holder', 'VaultState', 'Port', 'WidePort', 'Desk', 'Tray']);

const DECLARED_IN_PORT = new Set(['Ported', 'Desked']);

const KEPT_BY_EVERY_CLASS = 'secret';

const KEY = /^field-leak src::(?:vault|port)::(.+)$/;

function standings(): Map<string, Standing> {
  const directory = workspace('field-leak-ts');
  const model = buildModel(loadProject(directory));
  const outside = knownOutside(model, buildGraph(model));
  const reported = new Set(keys(directory).map((key) => KEY.exec(key)?.[1]));
  const found = new Map<string, Standing>();
  model.items.forEach((item, index) => {
    const [owner, bare] = item.name.split('::');
    if (item.kind !== 'field' || INTERFACES.has(owner) || bare === KEPT_BY_EVERY_CLASS) return;
    const leaked = outside.leaks.has(index as ItemId);
    const read = outside.used.has(index as ItemId) ? 'reads' : 'kept';
    found.set(item.name, leaked ? (reported.has(item.name) ? 'leaks' : 'unguarded') : read);
  });
  return found;
}

test('each field of the cases only TypeScript has stands as its row says, none is left without a row, and a class the model does not see has none', () => {
  const found = standings();
  assert.deepEqual(
    ROWS.map(([field, , outside, decidedBy]) => [field, found.get(field) ?? 'unseen', outside, decidedBy]),
    ROWS,
  );
  const seen = ROWS.filter(([, standing]) => standing !== 'unseen');
  assert.deepEqual([...found.keys()].sort(), seen.map(([field]) => field).sort());
});

test('the cases only TypeScript has report the fields that leak from a class that guards, and nothing else', () => {
  const leaking = ROWS.filter(([, standing]) => standing === 'leaks').map(([field]) => field);
  const modules = new Map(leaking.map((field) => [field, DECLARED_IN_PORT.has(field.split('::')[0]) ? 'port' : 'vault']));
  assert.deepEqual(keys(workspace('field-leak-ts')), leaking.map((field) => `field-leak src::${modules.get(field)}::${field}`).sort());
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBattle, submit, autoAction, needsAction, validActions, publicState, viewEvents } from '../server/battle.js';
import { ABILITIES, INERT, abilityInfo } from '../server/abilities.js';
import { abilityFor, floats, rng, species, movepool, buildFighter } from '../server/creatures.js';

const CATALOG = JSON.parse(readFileSync(new URL('../server/abilities.json', import.meta.url), 'utf8'));
const SPECIES = JSON.parse(readFileSync(new URL('../server/pokeapi.json', import.meta.url), 'utf8')).species;
const IVS = { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 };

const plainAttack = (m) => m.kind === 'attack' && m.power > 0 && !m.flags.includes('charge') && !m.flags.includes('recharge') && !m.multihit && !m.fixedDamage && !m.ohko && !m.selfDestruct && (m.accuracy ?? 100) >= 70;
const selfBoost = (m) => m.kind === 'status' && m.target === 'self' && !!m.boosts;

function pickMoves(entry, wants = []) {
  const pool = movepool(entry).filter((m) => m.supported).reverse();
  const out = [];
  const add = (pred) => {
    const m = pool.find((x) => pred(x) && !out.includes(x.key));
    if (m && out.length < 4) out.push(m.key);
  };
  wants.forEach(add);
  for (const type of SPECIES[entry.finalID]?.types ?? []) add((m) => plainAttack(m) && m.type === type);
  add(selfBoost);
  add((m) => m.kind === 'status');
  add(plainAttack);
  return out.length ? out : undefined;
}

let n = 0;
const mon = (finalID, ability, extra = {}) => {
  const { want, ...rest } = extra;
  const e = { id: `t-${finalID}-${n++}`, finalID, baseID: finalID, rarity: 'common', shiny: false, level: 50, ivs: IVS, ability, ...rest };
  const moveset = pickMoves(e, want);
  return moveset ? { ...e, moveset } : e;
};

function duel(a, b, { random = () => 0.5, benchA = [], benchB = [] } = {}) {
  return createBattle({
    id: 'x',
    random,
    sides: [
      { trainerId: 'a', name: 'A', entries: [a, ...benchA] },
      { trainerId: 'b', name: 'B', entries: [b, ...benchB] },
    ],
  });
}

const moveIndex = (b, s, pred) => b.sides[s].team[b.sides[s].active].moves.findIndex(pred);
const fighter = (b, s) => b.sides[s].team[b.sides[s].active];

function turn(b, a0, a1) {
  submit(b, 0, a0);
  return submit(b, 1, a1);
}

const supportIdx = (b, s) => {
  const self = moveIndex(b, s, selfBoost);
  const i = self >= 0 ? self : moveIndex(b, s, (m) => m.kind === 'status');
  assert.ok(i >= 0, `no status move for side ${s}`);
  return i;
};
const idle = (b, s) => ({ type: 'move', move: supportIdx(b, s) });
const attackOfType = (b, s, type) => {
  const i = moveIndex(b, s, (m) => m.type === type && plainAttack(m));
  assert.ok(i >= 0, `no ${type} move for side ${s}`);
  return { type: 'move', move: i };
};

test('every ability is either implemented or explicitly has no battle effect', () => {
  for (const key of Object.keys(CATALOG)) {
    assert.ok(ABILITIES[key] || INERT[key], `${key} sin clasificar`);
    assert.ok(!(ABILITIES[key] && INERT[key]), `${key} en ambas listas`);
  }
  for (const d of Object.values(SPECIES)) {
    for (const key of [...d.abilities, d.hiddenAbility].filter(Boolean)) assert.ok(CATALOG[key], `${d.name}: ${key} no está en el catálogo`);
  }
  assert.equal(abilityInfo('levitate').name, 'Levitación');
  assert.ok(abilityInfo('pickup').inert);
});

test('the save ability is used when the species can have it, else the same slot', () => {
  assert.equal(abilityFor({ finalID: 405, ability: 'rivalry' }), 'rivalry');
  assert.equal(abilityFor({ finalID: 405, ability: 'levitate', abilitySlot: 3 }), SPECIES[405].hiddenAbility);
  assert.equal(abilityFor({ finalID: 405, ability: 'nope', abilitySlot: 2 }), SPECIES[405].abilities[1]);
  assert.ok(SPECIES[6].abilities.includes(abilityFor({ id: 'x', finalID: 6 })));
  assert.equal(abilityFor({ id: 'x', finalID: 4999 }), null);
});

test('Levitación: inmune a Tierra, salvo contra Rompemoldes', () => {
  const b = duel(mon(50, 'arena-trap'), mon(436, 'levitate'));
  const before = fighter(b, 1).hp;
  const ev = turn(b, attackOfType(b, 0, 'ground'), idle(b, 1));
  assert.ok(ev.some((e) => e.t === 'ability' && e.side === 1 && e.ability === 'Levitación'));
  assert.ok(ev.some((e) => e.t === 'immune' && e.side === 1));
  assert.equal(fighter(b, 1).hp, before);

  const mb = duel(mon(529, 'mold-breaker'), mon(436, 'levitate'));
  turn(mb, attackOfType(mb, 0, 'ground'), idle(mb, 1));
  assert.ok(fighter(mb, 1).hp < fighter(mb, 1).stats.hp);
});

test('Intimidación baja el ataque al entrar; Respondón lo invierte; Gas Reactivo lo anula', () => {
  const b = duel(mon(130, 'intimidate'), mon(25, 'static'));
  assert.equal(fighter(b, 1).boosts.atk, -1);
  assert.ok(publicState(b).intro.some((e) => e.t === 'ability' && e.ability === 'Intimidación'));

  const c = duel(mon(130, 'intimidate'), mon(497, 'contrary'));
  assert.equal(fighter(c, 1).boosts.atk, 1);

  const g = duel(mon(130, 'intimidate'), mon(110, 'neutralizing-gas'));
  assert.equal(fighter(g, 1).boosts.atk, 0);
});

test('Llovizna pone lluvia y Nado Rápido duplica la velocidad', () => {
  const b = duel(mon(279, 'drizzle'), mon(230, 'swift-swim'));
  assert.equal(b.field.weather, 'rain');
  const ev = turn(b, attackOfType(b, 0, 'water'), attackOfType(b, 1, 'water'));
  const movers = ev.filter((e) => e.t === 'move').map((e) => e.side);
  assert.equal(movers[0], 1);
});

test('Absorbe Agua cura en vez de recibir daño', () => {
  const b = duel(mon(9, 'torrent'), mon(131, 'water-absorb'));
  fighter(b, 1).hp = 10;
  const ev = turn(b, attackOfType(b, 0, 'water'), idle(b, 1));
  assert.ok(ev.some((e) => e.t === 'heal' && e.side === 1));
  assert.ok(!ev.some((e) => e.t === 'damage' && e.side === 1));
});

test('Robustez aguanta con 1 PV un golpe que lo debilitaría', () => {
  const b = duel(mon(9, 'torrent', { level: 100 }), mon(74, 'sturdy', { level: 5 }));
  turn(b, attackOfType(b, 0, 'water'), idle(b, 1));
  assert.equal(fighter(b, 1).hp, 1);
});

test('Elec. Estática paraliza a quien la golpea con contacto', () => {
  const b = duel(mon(19, 'run-away'), mon(25, 'static'), { random: () => 0.1 });
  turn(b, attackOfType(b, 0, 'normal'), idle(b, 1));
  assert.equal(fighter(b, 0).status, 'par');
});

test('Inmunidad evita el envenenamiento', () => {
  const poisons = (m) => m.kind === 'attack' && !!m.secondary?.some((s) => s.status === 'psn' || s.status === 'tox');
  const poisoning = (b) => ({ type: 'move', move: moveIndex(b, 0, poisons) });
  const b = duel(mon(89, 'stench', { want: [poisons] }), mon(143, 'immunity'), { random: () => 0.01 });
  turn(b, poisoning(b), idle(b, 1));
  assert.equal(fighter(b, 1).status, null);
  const c = duel(mon(89, 'stench', { want: [poisons] }), mon(143, 'thick-fat'), { random: () => 0.01 });
  turn(c, poisoning(c), idle(c, 1));
  assert.ok(['psn', 'tox'].includes(fighter(c, 1).status));
});

test('Sombratrampa impide cambiar', () => {
  const b = duel(mon(202, 'shadow-tag'), mon(25, 'static'), { benchB: [mon(26, 'static')] });
  assert.ok(!validActions(b, 1).some((a) => a.type === 'switch'));
  const free = duel(mon(202, 'telepathy'), mon(25, 'static'), { benchB: [mon(26, 'static')] });
  assert.ok(validActions(free, 1).some((a) => a.type === 'switch'));
});

test('Regeneración cura un tercio al retirarse', () => {
  const b = duel(mon(80, 'regenerator'), mon(25, 'static'), { benchA: [mon(26, 'static')] });
  const f = fighter(b, 0);
  f.hp = 10;
  turn(b, { type: 'switch', to: 1 }, idle(b, 1));
  assert.equal(f.hp, 10 + Math.floor(f.stats.hp / 3));
});

test('Impostor se transforma en el rival al entrar', () => {
  const b = duel(mon(132, 'imposter'), mon(6, 'blaze'));
  assert.deepEqual(fighter(b, 0).types, fighter(b, 1).types);
  assert.equal(fighter(b, 0).moves[0].name, fighter(b, 1).moves[0].name);
});

test('the rival ability and moves stay hidden until they show up in battle', () => {
  const b = duel(mon(9, 'torrent'), mon(436, 'levitate'));
  const seenBy = (viewer, s) => publicState(b, viewer).sides[s].team[0];
  assert.equal(seenBy(0, 0).abilityInfo.name, 'Torrente');
  assert.equal(seenBy(0, 0).moves.length, fighter(b, 0).moves.length);
  assert.equal(seenBy(0, 1).abilityInfo, null);
  assert.deepEqual(seenBy(0, 1).moves, []);
  assert.deepEqual(seenBy(0, 1).pp, {});
  assert.ok(Object.values(seenBy(0, 0).pp).every((n) => n > 0));
  assert.equal(seenBy(null, 0).abilityInfo, null);

  turn(b, attackOfType(b, 0, 'water'), idle(b, 1));
  assert.equal(seenBy(0, 1).abilityInfo, null);
  assert.deepEqual(seenBy(0, 1).moves.map((m) => m.key), [fighter(b, 1).moves[supportIdx(b, 1)].key]);
  assert.deepEqual(seenBy(1, 0).moves.map((m) => m.kind), ['attack']);

  const c = duel(mon(50, 'arena-trap'), mon(436, 'levitate'));
  turn(c, attackOfType(c, 0, 'ground'), idle(c, 1));
  assert.equal(publicState(c, 0).sides[1].team[0].abilityInfo.name, 'Levitación');

  const i = duel(mon(130, 'intimidate'), mon(25, 'static'));
  assert.equal(publicState(i, 1).sides[0].team[0].abilityInfo.name, 'Intimidación');
  i.status = 'finished';
  assert.equal(publicState(i, null).sides[1].team[0].abilityInfo.name, 'Electricidad Estática');
});

test('the rival HP is only seen as a percentage', () => {
  const b = duel(mon(9, 'torrent'), mon(436, 'levitate'));
  const ev = turn(b, attackOfType(b, 0, 'water'), idle(b, 1));
  const real = ev.find((e) => e.t === 'damage' && e.side === 1);
  const foe = fighter(b, 1);
  const pct = Math.round((real.hp / real.max) * 100);
  const now = Math.round((foe.hp / foe.stats.hp) * 100);

  const mine = viewEvents(ev, 1).find((e) => e.t === 'damage' && e.side === 1);
  assert.deepEqual([mine.hp, mine.amount, mine.pct], [real.hp, real.amount, undefined]);
  const theirs = viewEvents(ev, 0).find((e) => e.t === 'damage' && e.side === 1);
  assert.deepEqual([theirs.hp, theirs.max, theirs.pct], [pct, 100, true]);
  assert.equal(theirs.amount, 100 - pct);

  const seen = publicState(b, 0).sides[1].team[0];
  assert.deepEqual([seen.hp, seen.stats, seen.hpPercent], [now, { hp: 100 }, true]);
  assert.equal(publicState(b, 1).sides[1].team[0].hp, foe.hp);
});

test('only airborne Pokémon float: the Bulbapedia list up to #151, then Flying type or Levitate', () => {
  assert.equal(floats(92), true);
  assert.equal(floats(129), true);
  assert.equal(floats(6), false);
  assert.equal(floats(149), false);
  assert.equal(floats(4), false);
  assert.equal(floats(436), true);
  assert.equal(floats(398), true);
  assert.equal(floats(445), false);
  assert.equal(floats(4999), false);
});

test('physical moves use Attack/Defense and special moves Sp. Atk/Sp. Def', () => {
  const special = (tweak) => {
    const b = duel(mon(6, 'blaze'), mon(143, 'thick-fat'));
    tweak(fighter(b, 0), fighter(b, 1));
    const i = moveIndex(b, 0, (m) => m.category === 'special');
    return turn(b, { type: 'move', move: i }, idle(b, 1)).find((e) => e.t === 'damage' && e.side === 1).amount;
  };
  const base = special(() => {});
  assert.equal(special((me) => (me.stats.atk *= 10)), base);
  assert.equal(special((me, foe) => (foe.stats.def *= 10)), base);
  assert.ok(special((me) => (me.stats.satk *= 3)) > base);
  assert.ok(special((me, foe) => (foe.stats.sdef *= 3)) < base);

  const c = duel(mon(130, 'intimidate'), mon(350, 'competitive'));
  assert.deepEqual([fighter(c, 1).boosts.atk, fighter(c, 1).boosts.satk], [-1, 2]);
});

test('form changes swap stats, types and sprite to the real PokeAPI form', () => {
  const b = duel(mon(68, 'guts', { level: 70 }), mon(555, 'zen-mode'), { benchB: [mon(25, 'static')] });
  const darm = fighter(b, 1);
  darm.hp = Math.floor(darm.stats.hp / 2);
  turn(b, idle(b, 0), idle(b, 1));
  assert.deepEqual([darm.form, darm.sprite, darm.types], ['darmanitan-zen', 'darmanitan-zen', ['fire', 'psychic']]);
  assert.ok(darm.stats.satk > darm.stats.atk);
  turn(b, idle(b, 0), { type: 'switch', to: 1 });
  assert.deepEqual([darm.form, darm.sprite], [null, '555']);

  const m = duel(mon(130, 'intimidate'), mon(778, 'disguise'));
  turn(m, attackOfType(m, 0, 'water'), idle(m, 1));
  assert.equal(fighter(m, 1).sprite, 'mimikyu-busted');
});

test('the rival team stays hidden until each Pokémon is sent out', () => {
  const b = duel(mon(9, 'torrent'), mon(25, 'static'), { benchB: [mon(26, 'static'), mon(571, 'illusion')] });
  const foeTeam = () => publicState(b, 0).sides[1].team;
  assert.equal(foeTeam()[0].name, 'Pikachu');
  assert.deepEqual([foeTeam()[1].hidden, foeTeam()[1].name], [true, undefined]);
  assert.equal(publicState(b, 1).sides[1].team[1].name, 'Raichu');

  const ev = turn(b, idle(b, 0), { type: 'switch', to: 2 });
  const sw = viewEvents(ev, 0).find((e) => e.t === 'switch');
  assert.equal(sw.mon.name, 'Raichu');
  assert.equal(sw.card, undefined);
  assert.equal(foeTeam()[2].name, 'Raichu');
  assert.equal(foeTeam()[2].sprite, '26');
  assert.ok(foeTeam()[1].hidden);

  turn(b, idle(b, 0), { type: 'switch', to: 0 });
  assert.equal(foeTeam()[2].name, 'Raichu');
  assert.equal(publicState(b, 1).sides[1].team[2].name, 'Zoroark');
});

test('Nevada invoca granizo antiguo: daña 1/16 por turno a quien no es Hielo y Ventisca no falla', () => {
  const b = duel(mon(460, 'snow-warning'), mon(143, 'thick-fat'), { random: () => 0.99 });
  assert.equal(b.field.weather, 'hail');
  const snorlax = fighter(b, 1);
  const abomasnow = fighter(b, 0);
  const ev = turn(b, idle(b, 0), idle(b, 1));
  const hail = ev.filter((e) => e.t === 'hurt' && e.cause === 'hail');
  assert.deepEqual(hail.map((e) => e.side), [1]);
  assert.equal(hail[0].amount, Math.floor(snorlax.stats.hp / 16));
  assert.equal(abomasnow.hp, abomasnow.stats.hp);

  const c = duel(mon(460, 'snow-warning', { want: [(m) => m.key === 'blizzard'] }), mon(143, 'thick-fat'), { random: () => 0.99 });
  const blizzard = moveIndex(c, 0, (m) => m.key === 'blizzard');
  assert.ok(blizzard >= 0);
  const ev2 = turn(c, { type: 'move', move: blizzard }, idle(c, 1));
  assert.ok(ev2.some((e) => e.t === 'damage' && e.side === 1));
  assert.ok(!ev2.some((e) => e.t === 'miss'));
});

test('an ability with no battle effect changes nothing', () => {
  const a = duel(mon(52, 'pickup'), mon(25, 'static'), { random: rng(5) });
  const b = duel(mon(52, 'technician'), mon(25, 'static'), { random: rng(5) });
  assert.ok(a.sides[0].team[0].moves[0].power === b.sides[0].team[0].moves[0].power);
  assert.ok(!publicState(a).intro.length);
});

test('every species with every one of its abilities can fight to the end', () => {
  const ids = Object.keys(SPECIES).map(Number);
  let i = 0;
  for (const id of ids) {
    const d = SPECIES[id];
    for (const ability of [...d.abilities, d.hiddenAbility].filter(Boolean)) {
      i += 1;
      const foeId = ids[(i * 7919) % ids.length];
      const foe = SPECIES[foeId];
      const b = createBattle({
        id: `s${i}`,
        random: rng(i),
        sides: [
          { trainerId: 'a', name: 'A', entries: [mon(id, ability), mon(ids[(i * 31) % ids.length], null)] },
          { trainerId: 'b', name: 'B', entries: [mon(foeId, foe.abilities[i % foe.abilities.length]), mon(ids[(i * 17) % ids.length], null)] },
        ],
      });
      let guard = 0;
      while (b.status === 'active' && guard++ < 400) {
        for (const s of [0, 1]) if (needsAction(b, s)) submit(b, s, autoAction(b, s));
      }
      assert.equal(b.status, 'finished', `${d.name} (${ability}) vs ${foe.name}`);
      JSON.stringify(publicState(b));
    }
  }
  assert.ok(buildFighter(mon(1, 'overgrow')).moves.every((m) => m.category && m.pp > 0));
});

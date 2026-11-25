import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, speciesIdByName } from '../../catalog/domain/creatures.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { DomainError } from '../../shared/domain/errors.js';
import { levelCap } from './floors.js';
import { expForLevel } from './growth.js';
import { FEATHER_EVS, VITAMIN_EVS } from './rewards.js';
import { TowerRun } from './tower-run.js';

const entry = (name: string, index: number): RosterEntry => {
  const finalID = speciesIdByName(name) as number;
  return { id: `e${index}`, finalID, baseID: finalID, rarity: 'common', shiny: false, level: 50, ivs: { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 } };
};
const roster = ['Charizard', 'Blastoise', 'Venusaur', 'Golem', 'Gengar', 'Dragonite', 'Lapras', 'Butterfree', 'Pidgeot', 'Snorlax', 'Onix', 'Alakazam', 'Arcanine', 'Raichu'].map(entry);

function climbing(length: number | null = 25) {
  const run = TowerRun.start({ id: 'r1', trainerId: 't1', difficulty: 'mid', length, roster, at: 0, random: rng(1) });
  run.draft(run.offers.slice(0, run.starters).map((offer) => offer.id), 1);
  return run;
}

function win(run: TowerRun) {
  if (run.mustChooseRoom) run.chooseRoom('trainer', { at: 2, roster });
  run.enterBattle(`c${run.floor}`, 2);
  assert.ok(run.battleFinished(`c${run.floor}`, true, { at: 3, roster }));
}

test('a climb starts in the lab and takes exactly the starters offered', () => {
  const run = TowerRun.start({ id: 'r1', trainerId: 't1', difficulty: 'mid', length: 25, roster, at: 0, random: rng(1) });
  assert.equal(run.status, 'drafting');
  assert.throws(() => run.draft([run.offers[0].id], 1), DomainError);
  assert.throws(() => run.draft([run.offers[0].id, run.offers[0].id, run.offers[1].id], 1), DomainError);
  run.draft(run.offers.slice(0, 3).map((offer) => offer.id), 1);
  assert.equal(run.status, 'climbing');
  assert.equal(run.party.length, 3);
  assert.ok(run.party.every((mon) => mon.level === 5 && mon.moves.length && mon.moves.every((move) => mon.known.includes(move))));
});

test('without Pokémon there is no climb', () => {
  assert.throws(() => TowerRun.start({ id: 'r', trainerId: 't', difficulty: 'mid', length: 10, roster: [], at: 0 }), DomainError);
});

test('the battle team fights at the climb level, in its form, with its moves', () => {
  const run = climbing();
  const team = run.battleTeam();
  assert.deepEqual(team.map((mon) => mon.battleLevel), [5, 5, 5]);
  assert.deepEqual(team.map((mon) => mon.finalID), run.party.map((mon) => mon.speciesId));
  assert.deepEqual(team.map((mon) => mon.moveset), run.party.map((mon) => mon.moves));
});

test('a win gives experience, moves up a floor and opens a rest with rewards', () => {
  const run = climbing();
  win(run);
  assert.equal(run.status, 'resting');
  assert.equal(run.floor, 2);
  assert.equal(run.cleared, 1);
  assert.ok(run.rewards.length);
  assert.ok(run.party.every((mon) => mon.exp > expForLevel(5)));
  assert.ok(run.lastResult?.won);
  run.moveOn(4);
  assert.equal(run.status, 'climbing');
});

test('only the battle of this floor counts', () => {
  const run = climbing();
  run.chooseRoom('trainer', { at: 2, roster });
  run.enterBattle('c1', 2);
  assert.equal(run.battleFinished('other', true, { at: 3, roster }), false);
  assert.equal(run.floor, 1);
});

test('a lost battle ends the climb, keeping the floors cleared', () => {
  const run = climbing();
  win(run);
  run.moveOn(4);
  run.chooseRoom('trainer', { at: 5, roster });
  run.enterBattle('c2', 5);
  run.battleFinished('c2', false, { at: 6, roster });
  assert.equal(run.status, 'lost');
  assert.equal(run.cleared, 1);
  assert.equal(run.open, false);
});

test('beating a gym leader also offers Pokémon of your collection to recruit', () => {
  const run = climbing();
  for (let floor = 1; floor < 5; floor++) {
    win(run);
    run.moveOn(4);
  }
  win(run);
  assert.ok(run.offers.length);
  const inParty = new Set(run.party.map((mon) => mon.uid));
  assert.ok(run.offers.every((offer) => !inParty.has(offer.entry.id)));
  run.recruit(run.offers[0].id, null, 5);
  assert.equal(run.party.length, 4);
  assert.throws(() => run.recruit('x', null, 6), DomainError);
});

test('the last floor of a climb with an end clears it', () => {
  const run = climbing(10);
  for (let floor = 1; floor < 10; floor++) {
    win(run);
    if (run.offers.length) run.recruit(run.offers[0].id, run.party[0].uid, 4);
    run.moveOn(4);
  }
  win(run);
  assert.equal(run.status, 'cleared');
  assert.equal(run.cleared, 10);
});

test('a Rare Candy raises levels up to the level cap of the next floor, and can evolve', () => {
  const run = TowerRun.start({ id: 'r1', trainerId: 't1', difficulty: 'mid', length: 25, roster: [entry('Charizard', 1)], at: 0, random: rng(1) });
  run.draft([run.offers[0].id], 1);
  const charmander = run.party[0];
  win(run);
  run.floor = 7;
  charmander.exp = expForLevel(14);
  charmander.level = 14;
  run.rewards = [{ id: 'candy', kind: 'candy', tier: 'common', levels: 3, fits: [charmander.uid], reasons: {} }];
  run.takeReward('candy', { uid: charmander.uid }, { at: 5, roster });
  assert.equal(charmander.level, levelCap(7));
  assert.equal(charmander.speciesId, speciesIdByName('Charmeleon'));
  assert.deepEqual(run.rewards, []);
});

test('a win never takes the party past the level of the next floor', () => {
  const run = climbing();
  for (let floor = 1; floor <= 6; floor++) {
    win(run);
    assert.ok(run.party.every((mon) => mon.level <= levelCap(run.floor)), `${floor}`);
    run.moveOn(4);
  }
});

test('a machine teaches its move, replacing the one you say when the four slots are full', () => {
  const run = climbing();
  win(run);
  const mon = run.party[0];
  mon.moves = mon.known.slice(0, 4);
  while (mon.moves.length < 4) mon.moves.push(`filler-${mon.moves.length}`);
  run.rewards = [{ id: 'tm', kind: 'tm', tier: 'rare', move: 'protect', fits: [mon.uid], reasons: {} }];
  const replaced = mon.moves[1];
  run.takeReward('tm', { uid: mon.uid, replace: replaced }, { at: 5, roster });
  assert.ok(mon.known.includes('protect'));
  assert.ok(mon.moves.includes('protect') && !mon.moves.includes(replaced));
});

test('a reward only goes to a Pokémon it fits, and a Mint needs a real nature', () => {
  const run = climbing();
  win(run);
  const [first, second] = run.party;
  run.rewards = [{ id: 'mint', kind: 'mint', tier: 'rare', fits: [first.uid], reasons: {} }];
  assert.throws(() => run.takeReward('mint', { uid: second.uid, nature: 'jolly' }, { at: 5, roster }), DomainError);
  assert.throws(() => run.takeReward('mint', { uid: first.uid, nature: 'grumpy' }, { at: 5, roster }), DomainError);
  run.takeReward('mint', { uid: first.uid, nature: 'jolly' }, { at: 5, roster });
  assert.equal(first.nature, 'jolly');
  assert.equal(run.battleTeam()[0].natureChoice, 'jolly');
});

test('between battles you pick moves among the ones it knows and abilities it unlocked', () => {
  const run = climbing();
  const mon = run.party[0];
  run.edit(mon.uid, { moves: [mon.known[0]] }, 2);
  assert.deepEqual(mon.moves, [mon.known[0]]);
  assert.throws(() => run.edit(mon.uid, { moves: ['hyper-beam'] }, 2), DomainError);
  assert.throws(() => run.edit(mon.uid, { ability: 'wonder-guard' }, 2), DomainError);
});

test('you can let a Pokémon go for good, but never the last one', () => {
  const run = climbing();
  run.release(run.party[0].uid, 2);
  run.release(run.party[0].uid, 2);
  assert.equal(run.party.length, 1);
  assert.throws(() => run.release(run.party[0].uid, 2), DomainError);
});

test('an abandoned climb is closed and cannot be abandoned twice', () => {
  const run = climbing();
  run.abandon(2);
  assert.equal(run.status, 'abandoned');
  assert.throws(() => run.abandon(3), DomainError);
});

test('a plain floor offers a choice of ways, and you fight only after choosing one', () => {
  const run = climbing();
  assert.ok(run.rooms().includes('trainer') && run.rooms().length >= 2);
  assert.throws(() => run.enterBattle('c1', 2), DomainError);
  assert.throws(() => run.chooseRoom('deal', { at: 2, roster, releaseUid: null }), DomainError);
  run.chooseRoom('trainer', { at: 2, roster });
  assert.deepEqual(run.rooms(), []);
  assert.equal(run.currentFloor().room, 'trainer');
});

test('a rest stop has no battle: the floor is passed and you take two of its rewards', () => {
  const run = climbing();
  const floor = 1;
  for (let draw = 0; !run.rooms().includes('rest'); draw++) run.rolls = { ...run.rolls, [run.floor]: `draw${draw}` };
  run.chooseRoom('rest', { at: 5, roster });
  assert.equal(run.status, 'resting');
  assert.equal(run.cleared, floor);
  assert.equal(run.picks, 2);
  const first = run.rewards.find((reward) => reward.fits.length);
  if (first) {
    run.takeReward(first.id, { uid: first.fits[0], nature: 'jolly', ability: run.party.find((mon) => mon.uid === first.fits[0])?.abilities[0] ?? null }, { at: 6, roster });
    assert.equal(run.picks, 1);
  }
});

test('a dark deal takes one of your party', () => {
  const run = climbing(null);
  win(run);
  run.moveOn(4);
  win(run);
  run.moveOn(5);
  for (let draw = 0; !run.rooms().includes('deal'); draw++) run.rolls = { ...run.rolls, [run.floor]: `draw${draw}` };
  const given = run.party[0].uid;
  const size = run.party.length;
  run.chooseRoom('deal', { at: 5, roster, releaseUid: given });
  assert.equal(run.party.length, size - 1);
  assert.ok(!run.party.some((mon) => mon.uid === given));
  assert.ok(run.rewards.some((reward) => reward.tier === 'epic'));
});

test('the rewards of a rest can be changed once', () => {
  const run = climbing();
  win(run);
  const before = run.rewards.map((reward) => reward.id);
  run.reroll(5);
  assert.notDeepEqual(run.rewards.map((reward) => reward.id), before);
  assert.throws(() => run.reroll(6), DomainError);
});

test('a vitamin adds EVs that the battle team carries', () => {
  const run = climbing();
  win(run);
  const mon = run.party[0];
  run.rewards = [{ id: 'v', kind: 'vitamin', tier: 'common', stat: 'spd', fits: [mon.uid], reasons: {} }];
  run.takeReward('v', { uid: mon.uid }, { at: 5, roster });
  assert.equal(mon.evs.spd, VITAMIN_EVS);
  assert.equal(run.battleTeam()[0].evs?.spd, VITAMIN_EVS);
});

test('an evolution stone evolves now a Pokémon whose evolution has no level, and levels never undo it', () => {
  const run = TowerRun.start({ id: 'r1', trainerId: 't1', difficulty: 'mid', length: 50, roster: [entry('Alakazam', 1)], at: 0, random: rng(1) });
  run.draft([run.offers[0].id], 1);
  const abra = run.party[0];
  win(run);
  run.floor = 20;
  abra.speciesId = speciesIdByName('Kadabra') as number;
  abra.level = 30;
  abra.exp = expForLevel(30);
  run.rewards = [{ id: 's', kind: 'stone', tier: 'epic', fits: [abra.uid], reasons: {} }];
  run.picks = 1;
  run.takeReward('s', { uid: abra.uid }, { at: 5, roster });
  assert.equal(abra.speciesId, speciesIdByName('Alakazam'));
  run.rewards = [{ id: 'c', kind: 'candy', tier: 'common', levels: 1, fits: [abra.uid], reasons: {} }];
  run.picks = 1;
  run.takeReward('c', { uid: abra.uid }, { at: 6, roster });
  assert.equal(abra.speciesId, speciesIdByName('Alakazam'));
});

test('stopping an evolution keeps the old form until the next level', () => {
  const run = TowerRun.start({ id: 'r1', trainerId: 't1', difficulty: 'mid', length: 25, roster: [entry('Charizard', 1)], at: 0, random: rng(1) });
  run.draft([run.offers[0].id], 1);
  const mon = run.party[0];
  win(run);
  run.floor = 8;
  mon.level = 15;
  mon.exp = expForLevel(15);
  run.rewards = [{ id: 'c', kind: 'candy', tier: 'common', levels: 1, fits: [mon.uid], reasons: {} }];
  run.picks = 1;
  run.takeReward('c', { uid: mon.uid }, { at: 5, roster });
  assert.equal(mon.speciesId, speciesIdByName('Charmeleon'));
  run.holdEvolution(mon.uid, 6);
  assert.equal(mon.speciesId, speciesIdByName('Charmander'));
  assert.throws(() => run.holdEvolution(mon.uid, 7), DomainError);
  run.moveOn(8);
  win(run);
  assert.equal(mon.speciesId, speciesIdByName('Charmeleon'), 'it evolves again on its next level');
});

test('a floor is drawn when you reach it: before that its ways and rivals are unknown', () => {
  const run = climbing();
  assert.ok(run.rolls[1]);
  win(run);
  assert.equal(run.rolls[2], undefined, 'resting before floor 2, it is not drawn yet');
  run.moveOn(10);
  assert.ok(run.rolls[2]);
  const other = climbing();
  win(other);
  other.moveOn(99);
  assert.notEqual(other.rolls[2], run.rolls[2], 'reaching it at another moment draws it again');
});

test('every floor won is scored and the climb adds them up', () => {
  const run = climbing();
  win(run);
  assert.equal(run.log.length, 1);
  assert.equal(run.log[0].floor, 1);
  assert.equal(run.points, run.log[0].points);
  run.moveOn(4);
  win(run);
  assert.equal(run.log.length, 2);
  assert.ok(run.points > run.log[0].points);
});

test('a floor without a battle gives no experience: levels come from battles and the rewards you take', () => {
  const run = climbing();
  for (let draw = 0; !run.rooms().includes('rest'); draw++) run.rolls = { ...run.rolls, [run.floor]: `draw${draw}` };
  const before = run.party.map((mon) => [mon.level, mon.exp]);
  run.chooseRoom('rest', { at: 5, roster });
  assert.deepEqual(run.party.map((mon) => [mon.level, mon.exp]), before);
  assert.deepEqual(run.lastResult?.growth, []);
});

test('after a rest stop, the next two plain floors offer none, whatever their draw', () => {
  const run = climbing();
  for (let draw = 0; !run.rooms().includes('rest'); draw++) run.rolls = { ...run.rolls, [run.floor]: `draw${draw}` };
  run.chooseRoom('rest', { at: 5, roster });
  assert.equal(run.restedAt, 1);
  const offersRest = () => Array.from({ length: 40 }, (_, draw) => draw).some((draw) => {
    run.rolls = { ...run.rolls, [run.floor]: `draw${draw}` };
    return run.rooms().includes('rest');
  });
  for (const floor of [2, 3]) {
    run.moveOn(6);
    assert.equal(run.floor, floor);
    assert.ok(!offersRest(), `no rest stop on floor ${floor}`);
    win(run);
  }
  run.moveOn(7);
  assert.ok(offersRest(), 'the third plain floor may offer one again');
});

test('a Pokémon far below the cap catches up faster than one near it', () => {
  const run = climbing();
  run.party[0].level = 2;
  run.party[0].exp = expForLevel(2);
  win(run);
  const [behind, , other] = run.party;
  assert.ok(behind.level - 2 > other.level - 5, `${behind.level} ${other.level}`);
});

test('your party fights with its own IVs, and the rival is measured against them', () => {
  const run = climbing();
  assert.deepEqual(run.battleTeam().map((mon) => mon.battleIvs), run.party.map((mon) => mon.entry.ivs));
  run.chooseRoom('trainer', { at: 2, roster });
  assert.ok(run.foeTeam().every((mon) => Object.values(mon.battleIvs ?? {}).every((iv) => iv >= 31 - 3 - 3)));
});

test('the levels shown for a way are the ones its rival fights at', () => {
  const run = climbing();
  for (let floor = 1; floor <= 8; floor++) {
    for (const way of run.roomFloors()) {
      const team = run.foeTeamAt(way);
      if (!way.foe) continue;
      assert.ok(team.every((mon) => mon.battleLevel === way.level || mon.battleLevel === way.level + 1), `${floor} ${way.room}`);
    }
    win(run);
    run.offers = [];
    run.moveOn(10 + floor);
  }
});

test('after a boss you take two rewards', () => {
  const run = climbing();
  for (let floor = 1; floor < 5; floor++) {
    win(run);
    run.moveOn(10 + floor);
  }
  win(run);
  assert.equal(run.picks, 2);
});

test('party rewards work on everyone: an Exp. Share levels up all below the cap, a Wing gives EVs to all', () => {
  const run = climbing();
  win(run);
  for (const mon of run.party) {
    mon.level = 5;
    mon.exp = expForLevel(5);
  }
  const uids = run.party.map((mon) => mon.uid);
  run.rewards = [
    { id: 'x', kind: 'expShare', tier: 'common', levels: 1, fits: uids, reasons: {} },
    { id: 'w', kind: 'feather', tier: 'common', stat: 'def', fits: uids, reasons: {} },
  ];
  run.picks = 2;
  assert.equal(run.takeReward('x', { uid: uids[0] }, { at: 5, roster }).length, uids.length);
  assert.ok(run.party.every((mon) => mon.level === 6));
  run.takeReward('w', { uid: uids[0] }, { at: 6, roster });
  assert.ok(run.party.every((mon) => mon.evs.def === FEATHER_EVS));
});

test('a Golden Egg brings recruits at your best level, and a Shiny Charm makes the one you choose shiny', () => {
  const run = TowerRun.start({ id: 'r1', trainerId: 't1', difficulty: 'mid', length: 50, roster, at: 0, random: rng(1) });
  run.draft(run.offers.slice(0, run.starters).map((offer) => offer.id), 1);
  win(run);
  run.floor = 10;
  const [first] = run.party;
  first.level = 12;
  first.exp = expForLevel(12);
  run.rewards = [{ id: 'g', kind: 'goldenEgg', tier: 'epic', fits: [], reasons: {} }];
  run.picks = 1;
  run.takeReward('g', { uid: first.uid }, { at: 5, roster });
  assert.ok(run.offers.length && run.offers.every((offer) => offer.level === 12));
  run.rewards = [{ id: 's', kind: 'shinyCharm', tier: 'rare', fits: [first.uid], reasons: {} }];
  run.picks = 1;
  run.takeReward('s', { uid: first.uid }, { at: 6, roster });
  assert.equal(first.entry.shiny, true);
  assert.equal(run.battleTeam()[0].shiny, true);
});

test('a held item goes to the one you choose, replaces the one it had, and goes with it to battle', () => {
  const run = climbing();
  win(run);
  const mon = run.party[0];
  run.rewards = [{ id: 'i', kind: 'rareItem', tier: 'rare', item: 'leftovers', fits: [mon.uid], reasons: {} }, { id: 'j', kind: 'epicItem', tier: 'epic', item: 'life-orb', fits: [mon.uid], reasons: {} }];
  run.picks = 2;
  run.takeReward('i', { uid: mon.uid }, { at: 5, roster });
  assert.equal(run.battleTeam()[0].heldItem, 'leftovers');
  run.takeReward('j', { uid: mon.uid }, { at: 6, roster });
  assert.equal(mon.item, 'life-orb');
});

test('in a breeze a calm route may reward a rare offer; otherwise it only gives common ones', () => {
  const tiers = (twist: TowerRun['twist']) => {
    const seen = new Set<string>();
    for (let climb = 0; climb < 30; climb++) {
      const run = TowerRun.start({ id: `calm${climb}`, trainerId: 't1', difficulty: 'mid', length: 25, roster, at: 0, random: rng(climb) });
      run.draft(run.offers.slice(0, run.starters).map((offer) => offer.id), 1);
      run.twist = twist;
      for (let draw = 0; draw < 40 && !run.rooms().includes('calm'); draw++) run.rolls = { ...run.rolls, [run.floor]: `draw${draw}` };
      if (!run.rooms().includes('calm')) continue;
      run.chooseRoom('calm', { at: 2, roster });
      run.enterBattle('c1', 2);
      run.battleFinished('c1', true, { at: 3, roster });
      for (const reward of run.rewards) seen.add(reward.tier);
    }
    return seen;
  };
  assert.deepEqual([...tiers(null)], ['common']);
  assert.ok(tiers('breeze').has('rare'));
});

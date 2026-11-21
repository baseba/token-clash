// What the client sees of a climb (the JSON shapes the frontend reads). Presenters only read.
import { buildFighter, type Fighter } from '../../combat/domain/fighter.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { abilityOptions, natureInfo, NATURE_KEYS, speciesData } from '../../catalog/domain/creatures.js';
import { ROOMS } from '../../catalog/domain/tower-cast.js';
import { abilityInfo } from '../../catalog/domain/abilities.js';
import { moveData } from '../../combat/domain/moves.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { Injectable } from '@nestjs/common';
import { levelCap, type Floor } from '../domain/floors.js';
import { evolutionLevel, evolutionPath, expForLevel } from '../domain/growth.js';
import { natureOf, offerMoves, type Offer } from '../domain/lab.js';
import { lockedAbilities, stoneEvolution, type Reward } from '../domain/rewards.js';
import type { TowerRun } from '../domain/tower-run.js';
import type { TowerRecord } from './tower.service.js';

const TRAIL_AHEAD = 6;

const monView = (fighter: Fighter) => ({
  uid: fighter.uid,
  name: fighter.name,
  speciesName: fighter.speciesName,
  speciesId: fighter.speciesId,
  types: fighter.types,
  level: fighter.level,
  sprite: fighter.sprite,
  shiny: fighter.shiny,
  gender: fighter.gender,
  stats: fighter.stats,
  speciesBase: fighter.speciesBase,
  evs: fighter.evs,
  abilityInfo: fighter.abilityInfo,
  natureInfo: fighter.natureInfo,
  moves: fighter.moves.map((move) => moveInfo(move.key)),
});

const speciesName = (id: number): string => speciesData(id)?.name ?? `#${id}`;
const moveInfo = (id: string) => {
  const move = moveData(id);
  return move ? { ...move, key: id } : { key: id, name: id, type: null, power: 0, category: 'status', desc: '' };
};
const NATURES = NATURE_KEYS.map((key) => natureInfo(key));

@Injectable()
export class TowerViews {
  constructor(private readonly trainers: TrainersService) {}

  run(run: TowerRun) {
    const team = run.battleTeam();
    const floor = run.currentFloor();
    const lastFloor = run.length ?? Infinity;
    const trail = [];
    for (let number = Math.max(1, run.floor - 1); number <= Math.min(lastFloor, run.floor + TRAIL_AHEAD); number++) {
      const reached = number in run.rolls && (number < run.floor || run.status !== 'resting');
      const step = run.floorAt(number, number < run.floor && number === run.lastResult?.floor ? run.lastResult.room ?? null : number === run.floor ? run.room : null);
      trail.push(reached ? { number, kind: step.kind, scene: step.scene, foe: step.foe, level: step.level, type: step.type, types: step.types, known: true } : { number, kind: step.kind, known: false });
    }
    return {
      id: run.id,
      difficulty: run.difficulty,
      length: run.length,
      status: run.status,
      floor: run.floor,
      cleared: run.cleared,
      points: run.points,
      log: run.log,
      starters: run.starters,
      cap: levelCap(run.floor),
      picks: run.picks,
      rerolls: run.rerolls,
      rooms: run.roomFloors().map((option) => this.room(option)),
      room: run.room,
      challengeId: run.challengeId,
      party: run.party.map((mon, index) => ({
        ...monView(buildFighter(team[index])),
        exp: { now: mon.exp, from: expForLevel(mon.level), to: expForLevel(mon.level + 1) },
        known: mon.known.map(moveInfo),
        equipped: mon.moves,
        ability: mon.ability,
        abilities: mon.abilities.map((key) => abilityInfo(key)),
        abilityOptions: abilityOptions({ finalID: mon.speciesId }).map((option) => ({ ...abilityInfo(option.key), hidden: option.hidden })),
        finalId: mon.entry.finalID,
        finalName: speciesName(mon.entry.finalID),
        evolvesInto: this.nextForm(mon.entry.finalID, mon.speciesId),
        line: this.line(team[index], mon.entry.finalID),
        atCap: mon.level >= levelCap(run.floor),
        locked: { capsule: lockedAbilities(mon, false).map((key) => abilityInfo(key)), patch: lockedAbilities(mon, true).map((key) => abilityInfo(key)) },
        stone: (() => {
          const next = stoneEvolution({ speciesId: mon.speciesId, finalId: mon.entry.finalID, level: mon.level });
          return next ? { id: next, name: speciesName(next), sprite: buildFighter({ ...team[index], finalID: next }).sprite } : null;
        })(),
      })),
      offers: run.offers.map((offer) => this.offer(offer)),
      rewards: run.rewards.map((reward) => this.reward(reward)),
      natures: NATURES,
      current: { ...floor, foeTeamSize: floor.teamSize },
      trail,
      lastResult: run.lastResult && {
        ...run.lastResult,
        rival: (() => {
          const beaten = run.floorAt(run.lastResult.floor, run.lastResult.room ?? null);
          return beaten.foe ? { ...beaten.foe, lose: beaten.lines.lose, kind: beaten.kind } : null;
        })(),
        growth: run.lastResult.growth.map((growth) => {
          const entry = this.entryOf(run, growth.uid);
          const before = buildFighter({ ...entry, finalID: growth.fromSpecies, battleLevel: growth.fromLevel });
          const after = buildFighter({ ...entry, finalID: growth.toSpecies, battleLevel: growth.toLevel });
          return {
            ...growth,
            fromName: speciesName(growth.fromSpecies),
            toName: speciesName(growth.toSpecies),
            fromSprite: before.sprite,
            toSprite: after.sprite,
            statsBefore: before.stats,
            statsAfter: after.stats,
            learned: growth.learned.map(moveInfo),
          };
        }),
      },
      createdAt: run.createdAt,
      finishedAt: run.finishedAt,
    };
  }

  records(records: TowerRecord[]) {
    return records.map((record) => {
      const trainer = this.trainers.byId(record.trainerId);
      return { ...record, name: trainer?.name ?? 'Entrenador', avatar: trainer?.look ?? null };
    });
  }

  private room(floor: Floor) {
    const room = floor.room ?? 'trainer';
    return { kind: room, ...ROOMS[room], foe: floor.foe, level: floor.level, type: floor.type, types: floor.types, scene: floor.scene, teamSize: floor.teamSize, trained: floor.trained };
  }

  /** Its evolution line up to the form it was raised into, with the level each step comes at. */
  private line(entry: RosterEntry, finalId: number) {
    return evolutionPath(finalId).map((id, index) => ({ id, name: speciesName(id), sprite: buildFighter({ ...entry, finalID: id }).sprite, level: index ? evolutionLevel(id) : null }));
  }

  private nextForm(finalId: number, speciesId: number) {
    const path = evolutionPath(finalId);
    const next = path[path.indexOf(speciesId) + 1];
    return next ? { id: next, name: speciesName(next), level: evolutionLevel(next), byLevel: !!speciesData(next)?.evolvesAt } : null;
  }

  private reward(reward: Reward) {
    return { ...reward, ...(reward.move ? { moveInfo: moveInfo(reward.move) } : {}) };
  }

  private offer(offer: Offer) {
    const entry: RosterEntry = { ...offer.entry, finalID: offer.speciesId, level: offer.level, battleLevel: offer.level, moveset: offerMoves(offer), natureChoice: natureOf(offer.entry) };
    return { id: offer.id, guide: offer.guide, level: offer.level, finalId: offer.entry.finalID, finalName: speciesName(offer.entry.finalID), mon: monView(buildFighter(entry)), line: this.line(entry, offer.entry.finalID) };
  }

  private entryOf(run: TowerRun, uid: string): RosterEntry {
    return run.party.find((mon) => mon.uid === uid)?.entry ?? { id: uid, finalID: 1, baseID: 1, rarity: 'common', shiny: false, level: 1, ivs: { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 } };
  }
}

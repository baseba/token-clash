import { buildFighter, type Fighter } from '../../combat/domain/fighter.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { abilityOptions, natureInfo, NATURE_KEYS, speciesData } from '../../catalog/domain/creatures.js';
import { ROOMS, TWIST_HINTS, type TwistKey } from '../../catalog/domain/tower-cast.js';
import { HELD_ITEMS } from '../../catalog/domain/held-items.js';
import { abilityInfo } from '../../catalog/domain/abilities.js';
import { moveData } from '../../combat/domain/moves.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { Injectable } from '@nestjs/common';
import { levelCap, type Floor } from '../domain/floors.js';
import { evolutionLevel, evolutionPath, expForLevel } from '../domain/growth.js';
import { natureOf, offerMoves, type Offer } from '../domain/lab.js';
import { cordEvolution, lockedAbilities, statsWith, stoneEvolution, trainingAfter, type Reward } from '../domain/rewards.js';
import type { TowerRun } from '../domain/tower-run.js';
import type { TowerRecord } from './tower-records.js';

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
  ivs: fighter.ivs,
  abilityInfo: fighter.abilityInfo,
  natureInfo: fighter.natureInfo,
  moves: fighter.moves.map((move) => moveInfo(move.key)),
});

const speciesName = (id: number): string => speciesData(id)?.name ?? `#${id}`;
const moveInfo = (id: string) => {
  const move = moveData(id);
  return move ? { ...move, key: id } : { key: id, name: id, type: null, power: 0, category: 'status', desc: '' };
};
const levelRange = (team: readonly RosterEntry[]): { min: number; max: number } => {
  const levels = team.map((mon) => mon.battleLevel ?? mon.level);
  return { min: Math.min(...levels), max: Math.max(...levels) };
};
const NATURES = NATURE_KEYS.map((key) => natureInfo(key));
const heldItemView = (key: string) => ({ key, name: HELD_ITEMS[key]?.name ?? key, desc: HELD_ITEMS[key]?.desc ?? '', tier: HELD_ITEMS[key]?.tier ?? 'common' });

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
      twist: run.twist,
      points: run.points,
      log: run.log,
      starters: run.starters,
      cap: levelCap(run.floor),
      picks: run.picks,
      rerolls: run.rerolls,
      rooms: run.roomFloors().map((option) => this.room(option, option.foe ? run.foeTeamAt(option) : [], run.twist)),
      room: run.room,
      challengeId: run.challengeId,
      party: run.party.map((mon, index) => ({
        ...monView(buildFighter(team[index])),
        exp: { now: mon.exp, from: expForLevel(mon.level), to: expForLevel(mon.level + 1) },
        known: mon.known.map(moveInfo),
        equipped: mon.moves,
        item: mon.item ? heldItemView(mon.item) : null,
        ability: mon.ability,
        abilities: mon.abilities.map((key) => abilityInfo(key)),
        abilityOptions: abilityOptions({ finalID: mon.speciesId }).map((option) => ({ ...abilityInfo(option.key), hidden: option.hidden })),
        finalId: mon.entry.finalID,
        finalName: speciesName(mon.entry.finalID),
        evolvesInto: this.nextForm(mon.entry.finalID, mon.speciesId),
        line: this.line(team[index], mon.entry.finalID),
        atCap: mon.level >= levelCap(run.floor),
        locked: { capsule: lockedAbilities(mon, false).map((key) => abilityInfo(key)), patch: lockedAbilities(mon, true).map((key) => abilityInfo(key)) },
        stone: this.evolutionView(team[index], stoneEvolution({ speciesId: mon.speciesId, finalId: mon.entry.finalID, level: mon.level })),
        cord: this.evolutionView(team[index], cordEvolution({ speciesId: mon.speciesId, finalId: mon.entry.finalID, level: mon.level })),
      })),
      offers: run.offers.map((offer) => this.offer(offer)),
      rewards: run.rewards.map((reward) => this.reward(run, reward)),
      natures: NATURES,
      current: { ...floor, foeTeamSize: floor.teamSize, levels: floor.foe ? levelRange(run.foeTeam()) : null },
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

  private room(floor: Floor, team: readonly RosterEntry[], twist: TwistKey | null) {
    const room = floor.room ?? 'trainer';
    const hint = (twist && TWIST_HINTS[twist]?.[room]) ?? ROOMS[room].hint;
    return { kind: room, ...ROOMS[room], hint, foe: floor.foe, level: floor.level, levels: team.length ? levelRange(team) : null, type: floor.type, types: floor.types, scene: floor.scene, teamSize: floor.teamSize, trained: floor.trained };
  }

  private line(entry: RosterEntry, finalId: number) {
    return evolutionPath(finalId).map((id, index) => ({ id, name: speciesName(id), sprite: buildFighter({ ...entry, finalID: id }).sprite, level: index ? evolutionLevel(id) : null }));
  }

  private nextForm(finalId: number, speciesId: number) {
    const path = evolutionPath(finalId);
    const next = path[path.indexOf(speciesId) + 1];
    return next ? { id: next, name: speciesName(next), level: evolutionLevel(next), byLevel: !!speciesData(next)?.evolvesAt } : null;
  }

  private evolutionView(entry: RosterEntry, next: number | null) {
    return next ? { id: next, name: speciesName(next), sprite: buildFighter({ ...entry, finalID: next }).sprite } : null;
  }

  private reward(run: TowerRun, reward: Reward) {
    const statsAfter: Record<string, ReturnType<typeof statsWith>> = {};
    for (const mon of run.party.filter((member) => reward.fits.includes(member.uid))) {
      const target = { uid: mon.uid, speciesId: mon.speciesId, level: mon.level, ivs: mon.entry.ivs, evs: mon.evs, nature: mon.nature };
      const after = trainingAfter(reward, target);
      if (after) statsAfter[mon.uid] = statsWith(target, after);
    }
    return { ...reward, ...(reward.move ? { moveInfo: moveInfo(reward.move) } : {}), ...(reward.item ? { itemInfo: heldItemView(reward.item) } : {}), ...(Object.keys(statsAfter).length ? { statsAfter } : {}) };
  }

  private offer(offer: Offer) {
    const entry: RosterEntry = { ...offer.entry, finalID: offer.speciesId, level: offer.level, battleLevel: offer.level, moveset: offerMoves(offer), natureChoice: natureOf(offer.entry) };
    return { id: offer.id, guide: offer.guide, level: offer.level, finalId: offer.entry.finalID, finalName: speciesName(offer.entry.finalID), mon: monView(buildFighter(entry)), line: this.line(entry, offer.entry.finalID) };
  }

  private entryOf(run: TowerRun, uid: string): RosterEntry {
    return run.party.find((mon) => mon.uid === uid)?.entry ?? { id: uid, finalID: 1, baseID: 1, rarity: 'common', shiny: false, level: 1, ivs: { hp: 31, atk: 31, def: 31, satk: 31, sdef: 31, spd: 31 } };
  }
}

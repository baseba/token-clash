import type { AiLevel } from '../../combat/domain/ai.js';
import type { RoomKind, TwistKey } from '../../catalog/domain/tower-cast.js';
import type { Floor, FloorKind } from './floors.js';
import { baseStatTotal, evolutionPath } from './growth.js';

export const DIFFICULTY_MULTIPLIER: Readonly<Record<AiLevel, number>> = { easy: 0.5, mid: 1, hard: 1.5, veryhard: 2, skynet: 3 };
export const FLOOR_POINTS: Readonly<Record<FloorKind, number>> = { trainer: 100, gym: 300, elite: 450, champion: 800 };
export const TWIST_MULTIPLIER: Readonly<Partial<Record<TwistKey, number>>> = { wild: 1.2, veterans: 1.15 };
export const ROOM_MULTIPLIER: Readonly<Partial<Record<RoomKind, number>>> = { tough: 1.5, hideout: 1.3, calm: 0.6 };

export interface FloorScore {
  floor: number;
  kind: FloorKind;
  room: RoomKind | null;
  rival: string | null;
  base: number;
  team: number;
  multiplier: number;
  points: number;
  lines?: number[];
}

export const teamPoints = (team: readonly { finalID: number; battleLevel?: number; level: number }[]): number =>
  Math.round(team.reduce((sum, mon) => sum + ((mon.battleLevel ?? mon.level) * baseStatTotal(mon.finalID)) / 100, 0));

export function floorScore(floor: Floor, team: readonly { finalID: number; battleLevel?: number; level: number }[], difficulty: AiLevel, twist: TwistKey | null = null): FloorScore {
  const multiplier = Math.round((ROOM_MULTIPLIER[floor.room ?? 'trainer'] ?? 1) * DIFFICULTY_MULTIPLIER[difficulty] * ((twist && TWIST_MULTIPLIER[twist]) ?? 1) * 100) / 100;
  const base = FLOOR_POINTS[floor.kind];
  const value = teamPoints(team);
  return {
    floor: floor.number,
    kind: floor.kind,
    room: floor.room,
    rival: floor.foe ? `${floor.foe.title} ${floor.foe.name}` : null,
    base,
    team: value,
    multiplier,
    points: Math.round((base + value) * multiplier),
    lines: team.map((mon) => evolutionPath(mon.finalID)[0]),
  };
}

export const totalPoints = (log: readonly FloorScore[]): number => log.reduce((sum, entry) => sum + entry.points, 0);

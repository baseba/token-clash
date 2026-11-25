import { Injectable } from '@nestjs/common';
import { aiLevelOf } from '../../combat/domain/ai.js';
import type { BattleState } from '../../combat/domain/battle.js';
import type { PreviewState } from '../../combat/domain/team-preview.js';
import type { Challenge } from '../domain/challenge.js';
import type { TournamentLabel } from '../domain/tournament.js';
import type { ClientConnection } from './connection.js';

export interface CountdownPlayer {
  id: string;
  name: string;
  avatar: string;
  frame: string | null;
  ai: string | null;
  wins: number;
  losses: number;
  rosterSize: number;
  shinies: number;
}

export interface CountdownPhase {
  kind: 'countdown';
  startedAt: number;
  endsAt: number;
  players: CountdownPlayer[];
  tournament: TournamentLabel | null;
  waiting: string[] | null;
}

export interface PreviewPhase {
  kind: 'preview';
  preview: PreviewState;
  deadline: number | null;
  short: boolean;
}

export interface BattlePhase {
  kind: 'battle';
  battle: BattleState;
  startedAt: number;
  deadline: number | null;
  jevAsked: Set<string>;
}

export type RoomPhase =
  | { kind: 'waiting' }
  | { kind: 'readyCheck'; ready: Set<string>; players: CountdownPlayer[] }
  | CountdownPhase
  | PreviewPhase
  | BattlePhase;

export interface Room {
  readonly challenge: Challenge;
  readonly sockets: Set<ClientConnection>;
  phase: RoomPhase;
  timer: NodeJS.Timeout | null;
}

export const watchKey = (challenge: Pick<Challenge, 'id' | 'tournamentId'>): string => (challenge.tournamentId ? tournamentWatchKey(challenge.tournamentId) : `c:${challenge.id}`);

export const tournamentWatchKey = (tournamentId: string): string => `t:${tournamentId}`;

export function inRoom(room: Room, trainerId: string | null | undefined): boolean {
  return [...room.sockets].some((ws) => ws.trainerId === trainerId && ws.open);
}

export function someoneAbsent(room: Room, sides: { trainerId: string }[]): boolean {
  if (!room.challenge.tournamentId) return false;
  return sides.some((side) => !aiLevelOf(side.trainerId) && !inRoom(room, side.trainerId));
}

const playing = (phase: RoomPhase) =>
  phase.kind === 'countdown' || phase.kind === 'preview' || (phase.kind === 'battle' && phase.battle.status === 'active');

@Injectable()
export class Presence {
  readonly rooms = new Map<string, Room>();
  readonly lobby = new Set<ClientConnection>();
  private readonly tours = new Map<string, Set<ClientConnection>>();
  private readonly openToWatch = new Set<string>();

  watchable(key: string): boolean {
    return this.openToWatch.has(key);
  }

  allowWatchers(key: string): void {
    this.openToWatch.add(key);
  }

  room(challenge: Challenge): Room {
    let room = this.rooms.get(challenge.id);
    if (!room) {
      room = { challenge, sockets: new Set(), phase: { kind: 'waiting' }, timer: null };
      this.rooms.set(challenge.id, room);
    }
    return room;
  }

  roomOf(ws: ClientConnection): Room | undefined {
    return ws.roomId ? this.rooms.get(ws.roomId) : undefined;
  }

  hostWaiting = (challenge: { id: string; hostId: string }): boolean => {
    const room = this.rooms.get(challenge.id);
    return !!room && inRoom(room, challenge.hostId);
  };

  followTournament(id: string, ws: ClientConnection): void {
    const followers = this.tours.get(id) ?? new Set();
    followers.add(ws);
    this.tours.set(id, followers);
  }

  unfollowTournament(id: string, ws: ClientConnection): void {
    this.tours.get(id)?.delete(ws);
  }

  tournamentSockets(id: string): ReadonlySet<ClientConnection> {
    return this.tours.get(id) ?? new Set();
  }

  tournamentAudience(id: string): ClientConnection[] {
    const inMatches = [...this.rooms.values()].filter((room) => room.challenge.tournamentId === id).flatMap((room) => [...room.sockets]);
    return [...inMatches, ...this.tournamentSockets(id)];
  }

  inTournament(id: string, trainerId: string | null | undefined): boolean {
    return [...this.tournamentSockets(id)].some((ws) => ws.trainerId === trainerId && ws.open);
  }

  liveBattles(): number {
    return [...this.rooms.values()].filter((room) => room.sockets.size > 0 && playing(room.phase)).length;
  }

  busyRooms(): number {
    return [...this.rooms.values()].filter((room) => room.phase.kind === 'readyCheck' || playing(room.phase)).length;
  }
}

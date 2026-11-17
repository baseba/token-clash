// Who is connected where, right now: the live rooms with their sockets and in-memory battle, the
// tournament followers and the lobby. This is runtime state, not domain data: it is lost on restart
// on purpose (a battle can't be resumed), and it is never stored.
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
  ai: string | null;
  wins: number;
  losses: number;
  rosterSize: number;
  shinies: number;
}

/** The countdown before choosing teams. `waiting`: who a tournament match still waits for. */
export interface CountdownPhase {
  kind: 'countdown';
  startedAt: number;
  endsAt: number;
  players: CountdownPlayer[];
  tournament: TournamentLabel | null;
  waiting: string[] | null;
}

/** Each side picks 3 of its 6. `short`: a tournament player is away, so the clock runs short. */
export interface PreviewPhase {
  kind: 'preview';
  preview: PreviewState;
  deadline: number | null;
  short: boolean;
}

/** The battle, while it is played and afterwards for late viewers. */
export interface BattlePhase {
  kind: 'battle';
  battle: BattleState;
  deadline: number | null;
  /** Skynet questions in flight, by `turn:phase`. */
  jevAsked: Set<string>;
}

/**
 * Which step of the match a live room is in. It only moves forward:
 * waiting → readyCheck → countdown → preview → battle, and back to waiting when the ready check
 * breaks up. Rooms against the AI start at the preview; tournament matches at the countdown.
 */
export type RoomPhase =
  /** Nothing to play yet: an open room, or one whose battle ended before a restart. */
  | { kind: 'waiting' }
  /** Both players are in the room and press "ready". */
  | { kind: 'readyCheck'; ready: Set<string>; players: CountdownPlayer[] }
  | CountdownPhase
  | PreviewPhase
  | BattlePhase;

/** The live side of a challenge: its sockets and which step of the match it is in. */
export interface Room {
  readonly challenge: Challenge;
  readonly sockets: Set<ClientConnection>;
  phase: RoomPhase;
  /** The clock of the current step: preview, reveal or turn. */
  timer: NodeJS.Timeout | null;
}

export function inRoom(room: Room, trainerId: string | null | undefined): boolean {
  return [...room.sockets].some((ws) => ws.trainerId === trainerId && ws.open);
}

/** Is a tournament player missing from the room? Then clocks run short so nobody waits forever. */
export function someoneAbsent(room: Room, sides: { trainerId: string }[]): boolean {
  if (!room.challenge.tournamentId) return false;
  return sides.some((side) => !aiLevelOf(side.trainerId) && !inRoom(room, side.trainerId));
}

/** A match is under way: from the countdown until the battle ends. */
const playing = (phase: RoomPhase) =>
  phase.kind === 'countdown' || phase.kind === 'preview' || (phase.kind === 'battle' && phase.battle.status === 'active');

@Injectable()
export class Presence {
  readonly rooms = new Map<string, Room>();
  readonly lobby = new Set<ClientConnection>();
  private readonly tours = new Map<string, Set<ClientConnection>>();

  /** The live room of a challenge, created on first use. */
  room(challenge: Challenge): Room {
    let room = this.rooms.get(challenge.id);
    if (!room) {
      room = { challenge, sockets: new Set(), phase: { kind: 'waiting' }, timer: null };
      this.rooms.set(challenge.id, room);
    }
    return room;
  }

  /** The room a connection is in, if it is in one. */
  roomOf(ws: ClientConnection): Room | undefined {
    return ws.roomId ? this.rooms.get(ws.roomId) : undefined;
  }

  /** Is the host of this challenge connected to its room? */
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

  /** The connections on a tournament's page (read only: follow and unfollow change it). */
  tournamentSockets(id: string): ReadonlySet<ClientConnection> {
    return this.tours.get(id) ?? new Set();
  }

  /** Everyone following a tournament: on its page or in the room of one of its matches. */
  tournamentAudience(id: string): ClientConnection[] {
    const inMatches = [...this.rooms.values()].filter((room) => room.challenge.tournamentId === id).flatMap((room) => [...room.sockets]);
    return [...inMatches, ...this.tournamentSockets(id)];
  }

  inTournament(id: string, trainerId: string | null | undefined): boolean {
    return [...this.tournamentSockets(id)].some((ws) => ws.trainerId === trainerId && ws.open);
  }

  /** Rooms with a match going on (someone watching it). Shown in /stats. */
  liveBattles(): number {
    return [...this.rooms.values()].filter((room) => room.sockets.size > 0 && playing(room.phase)).length;
  }

  /** Rooms a restart would cut, watched or not. deploy/deploy.sh waits for this to be 0. */
  busyRooms(): number {
    return [...this.rooms.values()].filter((room) => room.phase.kind === 'readyCheck' || playing(room.phase)).length;
  }
}

// Who is connected where, right now: the live rooms with their sockets and in-memory battle, the
// tournament followers and the lobby. This is runtime state, not domain data: it is lost on restart
// on purpose (a battle can't be resumed), and it is never stored.
import { Injectable } from '@nestjs/common';
import type { BattleState } from '../../combat/domain/battle.js';
import type { PreviewState } from '../../combat/domain/team-preview.js';
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

/** The live side of a challenge: its sockets and which step of the match it is in. */
export interface Room {
  sockets: Set<ClientConnection>;
  /** Both players are in the room and press "ready". */
  readyCheck?: { ready: Set<string>; players: CountdownPlayer[] } | null;
  /** The countdown before choosing teams. */
  countdown?: { startedAt: number; endsAt: number; players: CountdownPlayer[]; tournament: TournamentLabel | null; waiting?: string[] } | null;
  /** Each side picks 3 of its 6. */
  preview?: PreviewState | null;
  /** The preview timer was shortened because a tournament player is away. */
  previewShort?: boolean;
  battle: BattleState | null;
  /** When the current step times out (shown to the clients). */
  deadline: number | null;
  timer: NodeJS.Timeout | null;
  /** Skynet questions in flight, by `turn:phase`. */
  jevAsked?: Set<string>;
}

@Injectable()
export class Presence {
  readonly rooms = new Map<string, Room>();
  readonly lobby = new Set<ClientConnection>();
  private readonly tours = new Map<string, Set<ClientConnection>>();

  /** The live room of a challenge, created on first use. */
  room(id: string): Room {
    let room = this.rooms.get(id);
    if (!room) {
      room = { battle: null, sockets: new Set(), deadline: null, timer: null };
      this.rooms.set(id, room);
    }
    return room;
  }

  inRoom(room: Room, trainerId: string | null | undefined): boolean {
    return [...room.sockets].some((ws) => ws.trainerId === trainerId && ws.open);
  }

  /** Is the host of this challenge connected to its room? */
  hostWaiting = (challenge: { id: string; hostId: string }): boolean => {
    const room = this.rooms.get(challenge.id);
    return !!room && this.inRoom(room, challenge.hostId);
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

  inTournament(id: string, trainerId: string | null | undefined): boolean {
    return [...this.tournamentSockets(id)].some((ws) => ws.trainerId === trainerId && ws.open);
  }

  /** Rooms with a match going on (someone watching it). Shown in /stats. */
  liveBattles(): number {
    return [...this.rooms.values()].filter((r) => r.sockets.size > 0 && (r.countdown || r.preview || r.battle?.status === 'active')).length;
  }

  /** Rooms a restart would cut, watched or not. deploy/deploy.sh waits for this to be 0. */
  busyRooms(): number {
    return [...this.rooms.values()].filter((r) => r.readyCheck || r.countdown || r.preview || r.battle?.status === 'active').length;
  }
}

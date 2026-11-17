// The Challenge aggregate: one room and the battle played in it. Its status only moves these
// ways, and each method refuses any other:
//
//   open   → active      join     a rival takes the free seat
//   active → open        reopen   the guest left the ready check
//   open   → cancelled   cancel   the host closes the room
//   active → cancelled   cancel   the host closes it during the ready check
//   active → finished    finish   the battle ended
//   active → abandoned   abandon  a restart cut the battle
//
// Rooms against the AI and tournament matches are created active. What it stores of each side is
// a *copy* of the team at the time (RosterEntry snapshots): later changes to a trainer's
// collection don't rewrite battles already played.

import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { conflict, type DomainError, forbidden, gone, invalid } from '../../shared/domain/errors.js';

export type ChallengeStatus = 'open' | 'active' | 'finished' | 'cancelled' | 'abandoned';
export const BATTLE_MODES = ['team', 'random'] as const;
export type BattleMode = (typeof BATTLE_MODES)[number];
export const VISIBILITIES = ['public', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
/** What we keep of a finished battle: its public state (who fought, who won). */
export interface FinalBattleState {
  winner: number | null;
  sides: { team: { uid?: string; hp?: number; speciesName?: string; sprite?: string; types?: string[]; hidden?: boolean }[] }[];
  [key: string]: unknown;
}

export interface ChallengeState {
  id: string;
  hostId: string;
  hostName: string;
  hostTeam: RosterEntry[];
  status: ChallengeStatus;
  createdAt: number;
  mode: BattleMode;
  visibility: Visibility;
  /** Difficulty when one side is the AI. */
  ai?: string | null;
  /** Both sides are AIs (a tournament match between two AI seats). */
  aiOnly?: boolean;
  guestId?: string;
  guestName?: string;
  guestTeam?: RosterEntry[];
  tournamentId?: string;
  round?: number;
  match?: number;
  winnerId?: string | null;
  turns?: number;
  final?: FinalBattleState;
  finishedAt?: number;
}

/**
 * A 1v1 between two people: not against the AI, not a tournament match. Only these count for the
 * ranking, the history and the stats.
 */
export const isHumanDuel = (challenge: Pick<ChallengeState, 'ai' | 'tournamentId'>): boolean => !challenge.ai && !challenge.tournamentId;

interface Player {
  id: string;
  name: string;
}

export class Challenge implements ChallengeState {
  id: string;
  hostId: string;
  hostName: string;
  hostTeam: RosterEntry[];
  status: ChallengeStatus;
  createdAt: number;
  mode: BattleMode;
  visibility: Visibility;
  ai?: string | null;
  aiOnly?: boolean;
  guestId?: string;
  guestName?: string;
  guestTeam?: RosterEntry[];
  tournamentId?: string;
  round?: number;
  match?: number;
  winnerId?: string | null;
  turns?: number;
  final?: FinalBattleState;
  finishedAt?: number;

  private constructor(state: ChallengeState) {
    Object.assign(this, state);
  }

  static restore(state: ChallengeState): Challenge {
    return new Challenge(state);
  }

  /** A room waiting for a rival. In a random battle the teams are rolled when someone joins. */
  static open(input: { id: string; host: Player; hostTeam: RosterEntry[]; mode: BattleMode; visibility: Visibility; at: number }): Challenge {
    return new Challenge({ id: input.id, hostId: input.host.id, hostName: input.host.name, hostTeam: input.hostTeam, mode: input.mode, visibility: input.visibility, status: 'open', createdAt: input.at });
  }

  /** A battle against the AI starts at once. Private: nobody else can take its seat. */
  static againstAi(input: { id: string; host: Player; hostTeam: RosterEntry[]; ai: Player & { level: string }; aiTeam: RosterEntry[]; mode: BattleMode; at: number }): Challenge {
    return new Challenge({
      id: input.id,
      hostId: input.host.id,
      hostName: input.host.name,
      hostTeam: input.hostTeam,
      guestId: input.ai.id,
      guestName: input.ai.name,
      guestTeam: input.aiTeam,
      mode: input.mode,
      visibility: 'private',
      ai: input.ai.level,
      status: 'active',
      createdAt: input.at,
    });
  }

  /** A match of a tournament bracket. Private: only people following the tournament get there. */
  static tournamentMatch(input: {
    id: string;
    host: Player & { team: RosterEntry[]; ai: string | null };
    guest: Player & { team: RosterEntry[]; ai: string | null };
    mode: BattleMode;
    tournamentId: string;
    round: number;
    match: number;
    at: number;
  }): Challenge {
    const { host, guest } = input;
    return new Challenge({
      id: input.id,
      hostId: host.id,
      hostName: host.name,
      hostTeam: host.team,
      guestId: guest.id,
      guestName: guest.name,
      guestTeam: guest.team,
      mode: input.mode,
      ai: guest.ai ?? host.ai ?? null,
      aiOnly: !!(host.ai && guest.ai),
      visibility: 'private',
      tournamentId: input.tournamentId,
      round: input.round,
      match: input.match,
      status: 'active',
      createdAt: input.at,
    });
  }

  isPlayer(trainerId: string | null | undefined): boolean {
    return !!trainerId && (trainerId === this.hostId || trainerId === this.guestId);
  }

  /** Why `trainerId` can't take the free seat, or null if they can. */
  joinBlocker(trainerId: string): DomainError | null {
    if (this.ai) return conflict('Esa pelea es contra la IA: no se puede entrar.');
    if (this.hostId === trainerId) return invalid('Es tu propia sala: espera a que entre alguien o mándale el link a otro jugador.');
    switch (this.status) {
      case 'open':
        return null;
      case 'active':
        return conflict(this.guestId === trainerId ? 'Ya estás en esta pelea.' : 'Llegaste tarde: otro jugador entró primero a esta sala.');
      case 'finished':
        return conflict('Esta sala ya terminó su pelea.');
      case 'cancelled':
        return gone('El anfitrión cerró esta sala.');
      case 'abandoned':
        return gone('Esta sala se cortó cuando se reinició el servidor.');
    }
  }

  /** Someone takes the free seat. In a random battle both teams are rolled now. */
  join(guest: Player, teams: { hostTeam?: RosterEntry[]; guestTeam: RosterEntry[] }): void {
    const blocked = this.joinBlocker(guest.id);
    if (blocked) throw blocked;
    if (teams.hostTeam) this.hostTeam = teams.hostTeam;
    this.guestTeam = teams.guestTeam;
    this.status = 'active';
    this.guestId = guest.id;
    this.guestName = guest.name;
  }

  /** The guest left before the battle started: the room waits for someone else. */
  reopen(): void {
    this.assertActive();
    this.status = 'open';
    if (this.mode === 'random') this.hostTeam = [];
    delete this.guestId;
    delete this.guestName;
    delete this.guestTeam;
  }

  /**
   * The host closes the room: while it waits for a rival, or during the ready check (both seated,
   * not both ready yet). Once the countdown starts it is too late, and a tournament match is never
   * theirs to close.
   */
  cancel(byTrainerId: string | undefined, { readyCheck }: { readyCheck: boolean }): void {
    const waiting = this.status === 'open' || (this.status === 'active' && readyCheck);
    if (byTrainerId !== this.hostId || !waiting || this.tournamentId) throw forbidden('No puedes cerrar esta sala.');
    this.status = 'cancelled';
  }

  /** Battles live in memory: one left mid-fight by a restart can't be resumed. */
  abandon(): void {
    this.assertActive();
    this.status = 'abandoned';
  }

  finish(result: { winnerId: string | null; turns: number; final: FinalBattleState; at: number }): void {
    this.assertActive();
    this.status = 'finished';
    this.finishedAt = result.at;
    this.turns = result.turns;
    this.final = result.final;
    if (result.winnerId !== null) this.winnerId = result.winnerId;
  }

  private assertActive(): void {
    if (this.status !== 'active') throw conflict('Esta pelea no está en curso.');
  }

  /** Older versions kept repeated species in teams: an open room keeps one of each. */
  dropRepeatedSpecies(unique: (team: RosterEntry[]) => RosterEntry[]): boolean {
    if (this.status !== 'open' || !Array.isArray(this.hostTeam)) return false;
    const team = unique(this.hostTeam);
    if (team.length === this.hostTeam.length) return false;
    this.hostTeam = team;
    return true;
  }
}

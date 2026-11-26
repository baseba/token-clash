import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { conflict, type DomainError, forbidden, gone, invalid } from '../../shared/domain/errors.js';

export type ChallengeStatus = 'open' | 'active' | 'finished' | 'cancelled' | 'abandoned' | 'expired';

export const ROOM_MAX_AGE_MS = 20 * 60_000;
export const AI_NAMES = ['crubio ai', 'andy ai', 'bryan ai', 'esteban ai', 'ferlo ai', 'gon ai', 'joa ai', 'nacho juan ai', 'nico santi ai', 'nora ai', 'valde ai', 'mirror ai', 'tom ai', 'yuwen ai', 'alvaro ai'];
const DIFFICULTY_NAMES: Record<string, string> = { easy: 'fácil', mid: 'media', hard: 'difícil', veryhard: 'muy difícil', skynet: 'skynet' };
export const BATTLE_MODES = ['team', 'random'] as const;
export type BattleMode = (typeof BATTLE_MODES)[number];
export const VISIBILITIES = ['public', 'private'] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export interface Staging {
  scene: string;
  music: string;
  guestAvatar: string;
  returnTo: string;
  label?: string;
  aiPicks?: number[];
  guestSays?: { lose: string; win: string };
}

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
  staging?: Staging;
}

export function aiName(level: string, taken: string[] = [], random = Math.random): { base: string; name: string } {
  const used = new Set(taken);
  const free = AI_NAMES.filter((n) => !used.has(n));
  const pool = free.length ? free : AI_NAMES;
  const base = pool[Math.floor(random() * pool.length)];
  return { base, name: `${base} - ${DIFFICULTY_NAMES[level] ?? level}` };
}

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
  staging?: Staging;

  private constructor(state: ChallengeState) {
    Object.assign(this, state);
  }

  static restore(state: ChallengeState): Challenge {
    return new Challenge(state);
  }

  static open(input: { id: string; host: Player; hostTeam: RosterEntry[]; mode: BattleMode; visibility: Visibility; at: number }): Challenge {
    return new Challenge({ id: input.id, hostId: input.host.id, hostName: input.host.name, hostTeam: input.hostTeam, mode: input.mode, visibility: input.visibility, status: 'open', createdAt: input.at });
  }

  static againstAi(input: { id: string; host: Player; hostTeam: RosterEntry[]; ai: { id: string; level: string; name?: string }; aiTeam: RosterEntry[]; mode: BattleMode; at: number; staging?: Staging }): Challenge {
    return new Challenge({
      id: input.id,
      hostId: input.host.id,
      hostName: input.host.name,
      hostTeam: input.hostTeam,
      guestId: input.ai.id,
      guestName: input.ai.name ?? aiName(input.ai.level).name,
      guestTeam: input.aiTeam,
      mode: input.mode,
      visibility: 'private',
      ai: input.ai.level,
      status: 'active',
      createdAt: input.at,
      ...(input.staging ? { staging: input.staging } : {}),
    });
  }

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
      case 'expired':
        return gone('Esta sala se cerró sola: pasaron 20 minutos sin que empezara la pelea.');
    }
  }

  join(guest: Player, teams: { hostTeam?: RosterEntry[]; guestTeam: RosterEntry[] }): void {
    const blocked = this.joinBlocker(guest.id);
    if (blocked) throw blocked;
    if (teams.hostTeam) this.hostTeam = teams.hostTeam;
    this.guestTeam = teams.guestTeam;
    this.status = 'active';
    this.guestId = guest.id;
    this.guestName = guest.name;
  }

  reopen(): void {
    this.assertActive();
    this.status = 'open';
    if (this.mode === 'random') this.hostTeam = [];
    delete this.guestId;
    delete this.guestName;
    delete this.guestTeam;
  }

  cancel(byTrainerId: string | undefined, { readyCheck }: { readyCheck: boolean }): void {
    const waiting = this.status === 'open' || (this.status === 'active' && readyCheck);
    if (byTrainerId !== this.hostId || !waiting || this.tournamentId) throw forbidden('No puedes cerrar esta sala.');
    this.status = 'cancelled';
  }

  expire(at: number, { readyCheck }: { readyCheck: boolean }): boolean {
    const waiting = this.status === 'open' || (this.status === 'active' && readyCheck);
    if (!waiting || this.tournamentId || this.ai || at - this.createdAt < ROOM_MAX_AGE_MS) return false;
    this.status = 'expired';
    return true;
  }

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

  dropRepeatedSpecies(unique: (team: RosterEntry[]) => RosterEntry[]): boolean {
    if (this.status !== 'open' || !Array.isArray(this.hostTeam)) return false;
    const team = unique(this.hostTeam);
    if (team.length === this.hostTeam.length) return false;
    this.hostTeam = team;
    return true;
  }
}

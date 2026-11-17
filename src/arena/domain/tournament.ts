// The Tournament aggregate: seats (people and AIs), the single-elimination bracket and its
// progress. The free functions are the rules (they work on any object with seats/bracket, which
// keeps them trivial to test); the Tournament class is the aggregate that uses them and is the
// only thing the use cases change.

import { aiSeatId, type AiLevel } from '../../combat/domain/ai.js';
import { conflict, forbidden } from '../../shared/domain/errors.js';
import type { BattleMode, Visibility } from './challenge.js';

export const TOURNAMENT_SIZES = [4, 8, 16] as const;
export type TournamentSize = (typeof TOURNAMENT_SIZES)[number];
export type TournamentStatus = 'open' | 'running' | 'finished' | 'cancelled' | 'abandoned';

export const AI_NAMES = ['crubio ai', 'andy ai', 'bryan ai', 'esteban ai', 'ferlo ai', 'gon ai', 'joa ai', 'nacho juan ai', 'nico santi ai', 'nora ai', 'valde ai', 'mirror ai', 'tom ai', 'yuwen ai', 'alvaro ai'];
const DIFFICULTY_NAMES: Record<string, string> = { easy: 'fácil', mid: 'media', hard: 'difícil', veryhard: 'muy difícil', skynet: 'skynet' };
const ROUND_NAMES: Record<number, string> = { 1: 'Final', 2: 'Semifinal', 4: 'Cuartos de final', 8: 'Octavos de final' };

export interface Seat {
  /** A trainer id, or `ai:<level>#<n>` for an AI seat. */
  id: string;
  name: string;
  ai: string | null;
  /** The AI's name without its difficulty, so two AIs in one tournament never share it. */
  aiBase?: string;
  ready: boolean;
}

/** Seats are numbered by their position in `seats`; null while the previous round is undecided. */
export interface BracketMatch {
  a: number | null;
  b: number | null;
  winner: number | null;
  challengeId: string | null;
  /** The match ended in a draw and the winner was drawn by lot. */
  coinFlip?: boolean;
}

export type Bracket = BracketMatch[][];

export interface MatchRef {
  round: number;
  index: number;
}

interface Seated {
  size: number;
  seats: Seat[];
}

export function aiName(level: string, taken: string[] = [], random = Math.random): { base: string; name: string } {
  const used = new Set(taken);
  const free = AI_NAMES.filter((n) => !used.has(n));
  const pool = free.length ? free : AI_NAMES;
  const base = pool[Math.floor(random() * pool.length)];
  return { base, name: `${base} - ${DIFFICULTY_NAMES[level] ?? level}` };
}

export const humanCount = (tournament: Pick<Seated, 'seats'>) => tournament.seats.filter((s) => !s.ai).length;

export const isAiSeat = (seat: Partial<Seat> | null | undefined) => !!seat?.ai;

/** Players and followers of a tournament who haven't reached the room of the next match yet. */
export function pendingArrivals({ players = [], followers = [], present = [] }: { players?: string[]; followers?: string[]; present?: (string | null)[] }): string[] {
  const here = new Set(present);
  return [...new Set([...players, ...followers])].filter((id) => !here.has(id));
}

/** Whether someone watching is still animating an earlier turn. */
export function viewersBehind(seenTurns: (number | undefined)[], turn: number): boolean {
  return seenTurns.some((seen) => (seen ?? 0) < turn);
}

export const isFull = (tournament: Seated) => tournament.seats.length >= tournament.size;
export const allReady = (tournament: Seated) => isFull(tournament) && tournament.seats.every((s) => s.ready);
export const seatOf = (tournament: Pick<Seated, 'seats'>, trainerId: string | null | undefined) =>
  tournament.seats.findIndex((s) => s.id === trainerId);

export function roundName(size: number, round: number): string {
  const matches = size / 2 ** (round + 1);
  return ROUND_NAMES[matches] ?? `Ronda ${round + 1}`;
}

export function addSeat(tournament: Seated, seat: Omit<Seat, 'ready'> & { ready?: boolean }): void {
  if (isFull(tournament)) throw conflict('El torneo ya está lleno.');
  if (seatOf(tournament, seat.id) !== -1) throw conflict('Ya estás en este torneo.');
  tournament.seats.push({ ...seat, ready: isAiSeat(seat) });
}

export function removeSeat(tournament: Seated, index: number): void {
  if (index <= 0 || index >= tournament.seats.length) throw conflict('Ese asiento no se puede quitar.');
  tournament.seats.splice(index, 1);
}

export function setReady(tournament: Seated, trainerId: string, ready: boolean): void {
  const seatIndex = seatOf(tournament, trainerId);
  if (seatIndex === -1) throw conflict('No estás en este torneo.');
  tournament.seats[seatIndex].ready = !!ready;
}

export function nextAiId(tournament: Pick<Seated, 'seats'>, level: AiLevel): { id: string; seatNumber: number } {
  let seatNumber = 1;
  while (tournament.seats.some((s) => s.id === aiSeatId(level, seatNumber))) seatNumber += 1;
  return { id: aiSeatId(level, seatNumber), seatNumber };
}

export function shuffledOrder(count: number, random = Math.random): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

export function createBracket(order: number[]): Bracket {
  const rounds: Bracket = [];
  let size = order.length;
  rounds.push(Array.from({ length: size / 2 }, (_, i) => ({ a: order[2 * i], b: order[2 * i + 1], winner: null, challengeId: null })));
  for (size /= 2; size > 1; size /= 2) rounds.push(Array.from({ length: size / 2 }, () => ({ a: null, b: null, winner: null, challengeId: null })));
  return rounds;
}

export function nextMatch(bracket: Bracket): MatchRef | null {
  for (let round = 0; round < bracket.length; round++) {
    const index = bracket[round].findIndex((m) => m.winner === null && m.a !== null && m.b !== null);
    if (index !== -1) return { round, index };
  }
  return null;
}

/** Records who won a match and moves them up. Returns the champion when it was the final. */
export function recordWinner(bracket: Bracket, { round, index }: MatchRef, winner: number): number | null {
  const match = bracket[round][index];
  if (winner !== match.a && winner !== match.b) throw conflict('Ese asiento no jugó esta pelea.');
  match.winner = winner;
  const next = bracket[round + 1]?.[Math.floor(index / 2)];
  if (next) next[index % 2 === 0 ? 'a' : 'b'] = winner;
  return next ? null : winner;
}

export function reachedRound(bracket: Bracket, seat: number): number {
  let reached = -1;
  bracket.forEach((round, r) => round.forEach((m) => (m.a === seat || m.b === seat) && (reached = r)));
  return reached;
}

export function matchNumber(bracket: Bracket, { round, index }: MatchRef): number {
  return bracket.slice(0, round).reduce((n, r) => n + r.length, 0) + index + 1;
}

export function totalMatches(bracket: Bracket): number {
  return bracket.reduce((n, r) => n + r.length, 0);
}

type Searchable = Seated & { hostId: string; mode: BattleMode; levelCap: number | null };

/** For a public search: your own open tournament, one you already sit in, or someone else's to join. */
export function tournamentMatchFor<T extends Searchable>(tournaments: T[], { trainerId, mode, levelCap, size }: { trainerId: string; mode: BattleMode; levelCap: number | null; size: number }) {
  const same = tournaments.filter((t) => t.mode === mode && (t.levelCap ?? null) === levelCap && t.size === size && !isFull(t));
  return { own: same.find((t) => t.hostId === trainerId) ?? null, rival: same.find((t) => t.hostId !== trainerId && seatOf(t, trainerId) === -1) ?? null, seated: same.find((t) => seatOf(t, trainerId) > 0) ?? null };
}

export interface TournamentState {
  id: string;
  hostId: string;
  mode: BattleMode;
  levelCap: number | null;
  size: number;
  visibility: Visibility;
  status: TournamentStatus;
  createdAt: number;
  seats: Seat[];
  startedAt?: number;
  bracket?: Bracket;
  drawAt?: number;
  /** Level of the AIs' teams: the cap, or the average level of the people's teams. */
  aiLevel?: number;
  /** When the next match starts (during the draw and between matches). */
  nextAt?: number | null;
  current?: (MatchRef & { challengeId: string }) | null;
  /** Seat index of the winner. */
  champion?: number;
  finishedAt?: number;
}

export class Tournament implements TournamentState {
  id: string;
  hostId: string;
  mode: BattleMode;
  levelCap: number | null;
  size: number;
  visibility: Visibility;
  status: TournamentStatus;
  createdAt: number;
  seats: Seat[];
  startedAt?: number;
  bracket?: Bracket;
  drawAt?: number;
  aiLevel?: number;
  nextAt?: number | null;
  current?: (MatchRef & { challengeId: string }) | null;
  champion?: number;
  finishedAt?: number;

  private constructor(state: TournamentState) {
    Object.assign(this, state);
  }

  static restore(state: TournamentState): Tournament {
    return new Tournament(state);
  }

  /** A new tournament, with its creator in the first seat (the host seat can't be removed). */
  static create(input: { id: string; host: { id: string; name: string }; mode: BattleMode; levelCap: number | null; size: number; visibility: Visibility; at: number }): Tournament {
    const tournament = new Tournament({
      id: input.id,
      hostId: input.host.id,
      mode: input.mode,
      levelCap: input.levelCap,
      size: input.size,
      visibility: input.visibility,
      status: 'open',
      createdAt: input.at,
      seats: [],
    });
    addSeat(tournament, { id: input.host.id, name: input.host.name, ai: null });
    return tournament;
  }

  get full(): boolean {
    return isFull(this);
  }

  get everyoneReady(): boolean {
    return allReady(this);
  }

  seatOf(trainerId: string | null | undefined): number {
    return seatOf(this, trainerId);
  }

  /** Only the host may `action` ("cerrar el torneo", "agregar IAs"…). */
  assertHost(trainerId: string, action: string): void {
    if (trainerId !== this.hostId) throw forbidden(`Solo el dueño puede ${action}.`);
  }

  /** Seat changes are only allowed before the tournament starts. */
  assertLobby(): void {
    if (this.status !== 'open') throw conflict(this.status === 'cancelled' ? 'Este torneo se cerró.' : 'El torneo ya partió.');
  }

  join(trainer: { id: string; name: string }): void {
    if (this.status !== 'open') throw conflict(this.status === 'running' || this.status === 'finished' ? 'Llegaste tarde: este torneo ya partió.' : 'Este torneo se cerró.');
    addSeat(this, { id: trainer.id, name: trainer.name, ai: null });
  }

  /** Removes a seat by trainer id (someone left or lost their seat). Returns whether they sat here. */
  leave(trainerId: string): boolean {
    const seatIndex = this.seatOf(trainerId);
    if (seatIndex <= 0) return false;
    this.seats.splice(seatIndex, 1);
    return true;
  }

  kick(index: number): void {
    removeSeat(this, index);
  }

  setReady(trainerId: string, ready: boolean): void {
    setReady(this, trainerId, ready);
  }

  /** Fills free seats with AIs of a difficulty, each with a name not yet used here. */
  addAis(level: AiLevel, count: number): void {
    if (this.full) throw conflict('El torneo ya está lleno.');
    const added = Math.max(1, Math.min(this.size - this.seats.length, count));
    for (let i = 0; i < added; i++) {
      const { id } = nextAiId(this, level);
      const { base, name } = aiName(level, this.seats.map((seat) => seat.aiBase).filter((b): b is string => !!b));
      addSeat(this, { id, name, aiBase: base, ai: level });
    }
  }

  close(): void {
    this.status = 'cancelled';
  }

  abandon(): void {
    this.status = 'abandoned';
  }

  /** Draws the bracket. The first match starts after the draw animation (`nextAt`). */
  start({ at, order, aiLevel, firstMatchAt }: { at: number; order: number[]; aiLevel: number; firstMatchAt: number }): void {
    this.status = 'running';
    this.startedAt = at;
    this.bracket = createBracket(order);
    this.drawAt = at;
    this.aiLevel = aiLevel;
    this.nextAt = firstMatchAt;
  }

  /** The next match to play, with both seats, or null. */
  nextMatch(): (MatchRef & { a: Seat; b: Seat }) | null {
    if (this.status !== 'running' || !this.bracket) return null;
    const at = nextMatch(this.bracket);
    if (!at) return null;
    const match = this.bracket[at.round][at.index];
    return { ...at, a: this.seats[match.a!], b: this.seats[match.b!] };
  }

  matchStarted(at: MatchRef, challengeId: string): void {
    this.bracket![at.round][at.index].challengeId = challengeId;
    this.current = { ...at, challengeId };
    this.nextAt = null;
  }

  /**
   * A match ended. A draw (or a winner who isn't seated) is decided by lot. Returns the champion
   * when it was the final; otherwise schedules the next match at `nextMatchAt`.
   */
  matchFinished(at: MatchRef, winnerId: string | null, { now, nextMatchAt, random = Math.random }: { now: number; nextMatchAt: number; random?: () => number }): number | null {
    const match = this.bracket![at.round][at.index];
    let winner = this.seats.findIndex((seat) => seat.id === winnerId);
    if (winnerId === null || winner === -1) {
      winner = (random() < 0.5 ? match.a : match.b)!;
      match.coinFlip = true;
    }
    const champion = recordWinner(this.bracket!, at, winner);
    this.current = null;
    if (champion !== null) {
      this.status = 'finished';
      this.champion = champion;
      this.finishedAt = now;
    } else this.nextAt = nextMatchAt;
    return champion;
  }

  played(): number {
    return this.bracket ? this.bracket.flat().filter((m) => m.winner !== null).length : 0;
  }

  total(): number {
    return this.bracket ? totalMatches(this.bracket) : this.size - 1;
  }

  /** "Semifinal, match 5 of 7" and friends, for a match of this tournament. */
  label(at: MatchRef) {
    const bracket = this.bracket!;
    const final = at.round === bracket.length - 1;
    return { id: this.id, size: this.size, round: roundName(this.size, at.round), next: final ? null : roundName(this.size, at.round + 1), final, number: matchNumber(bracket, at), total: totalMatches(bracket) };
  }
}

export type TournamentLabel = ReturnType<Tournament['label']>;

import { aiSeatId, type AiLevel } from '../../combat/domain/ai.js';
import { conflict, forbidden } from '../../shared/domain/errors.js';
import { aiName, type BattleMode, type Visibility } from './challenge.js';

export const TOURNAMENT_SIZES = [4, 8, 16] as const;
export type TournamentSize = (typeof TOURNAMENT_SIZES)[number];
export type TournamentStatus = 'open' | 'running' | 'finished' | 'cancelled' | 'abandoned';

const ROUND_NAMES: Record<number, string> = { 1: 'Final', 2: 'Semifinal', 4: 'Cuartos de final', 8: 'Octavos de final' };

export interface Seat {
  id: string;
  name: string;
  ai: string | null;
  aiBase?: string;
  ready: boolean;
}

export interface BracketMatch {
  a: number | null;
  b: number | null;
  winner: number | null;
  challengeId: string | null;
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

export const humanCount = (tournament: Pick<Seated, 'seats'>) => tournament.seats.filter((s) => !s.ai).length;

const isAiSeat = (seat: Partial<Seat> | null | undefined) => !!seat?.ai;

export function pendingArrivals({ players = [], followers = [], present = [] }: { players?: string[]; followers?: string[]; present?: (string | null)[] }): string[] {
  const here = new Set(present);
  return [...new Set([...players, ...followers])].filter((id) => !here.has(id));
}

export function viewersBehind(seenTurns: (number | undefined)[], turn: number): boolean {
  return seenTurns.some((seen) => (seen ?? 0) < turn);
}

export const isFull = (tournament: Seated) => tournament.seats.length >= tournament.size;
const allReady = (tournament: Seated) => isFull(tournament) && tournament.seats.every((s) => s.ready);

export function roundName(size: number, round: number): string {
  const matches = size / 2 ** (round + 1);
  return ROUND_NAMES[matches] ?? `Ronda ${round + 1}`;
}

function nextAiId(tournament: Pick<Seated, 'seats'>, level: AiLevel): string {
  let seatNumber = 1;
  while (tournament.seats.some((s) => s.id === aiSeatId(level, seatNumber))) seatNumber += 1;
  return aiSeatId(level, seatNumber);
}

function shuffledOrder(count: number, random = Math.random): number[] {
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

export function recordWinner(bracket: Bracket, { round, index }: MatchRef, winner: number): number | null {
  const match = bracket[round][index];
  if (winner !== match.a && winner !== match.b) throw conflict('Ese asiento no jugó esta pelea.');
  match.winner = winner;
  const next = bracket[round + 1]?.[Math.floor(index / 2)];
  if (next) next[index % 2 === 0 ? 'a' : 'b'] = winner;
  return next ? null : winner;
}

export function matchNumber(bracket: Bracket, { round, index }: MatchRef): number {
  return bracket.slice(0, round).reduce((n, r) => n + r.length, 0) + index + 1;
}

export function totalMatches(bracket: Bracket): number {
  return bracket.reduce((n, r) => n + r.length, 0);
}

export function tournamentMatchFor(tournaments: Tournament[], { trainerId, mode, size }: { trainerId: string; mode: BattleMode; size: number }) {
  const same = tournaments.filter((t) => t.mode === mode && t.size === size && !isFull(t));
  return { own: same.find((t) => t.hostId === trainerId) ?? null, rival: same.find((t) => t.hostId !== trainerId && t.seatOf(trainerId) === -1) ?? null, seated: same.find((t) => t.seatOf(trainerId) > 0) ?? null };
}

export interface TournamentState {
  id: string;
  hostId: string;
  mode: BattleMode;
  size: number;
  visibility: Visibility;
  status: TournamentStatus;
  createdAt: number;
  seats: Seat[];
  startedAt?: number;
  bracket?: Bracket;
  drawAt?: number;
  nextAt?: number | null;
  current?: (MatchRef & { challengeId: string }) | null;
  champion?: number;
  finishedAt?: number;
}

export class Tournament implements TournamentState {
  id: string;
  hostId: string;
  mode: BattleMode;
  size: number;
  visibility: Visibility;
  status: TournamentStatus;
  createdAt: number;
  seats: Seat[];
  startedAt?: number;
  bracket?: Bracket;
  drawAt?: number;
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

  static create(input: { id: string; host: { id: string; name: string }; mode: BattleMode; size: number; visibility: Visibility; at: number }): Tournament {
    const tournament = new Tournament({
      id: input.id,
      hostId: input.host.id,
      mode: input.mode,
      size: input.size,
      visibility: input.visibility,
      status: 'open',
      createdAt: input.at,
      seats: [],
    });
    tournament.addSeat({ id: input.host.id, name: input.host.name, ai: null });
    return tournament;
  }

  seatOf(trainerId: string | null | undefined): number {
    return this.seats.findIndex((seat) => seat.id === trainerId);
  }

  private addSeat(seat: Omit<Seat, 'ready'>): void {
    if (isFull(this)) throw conflict('El torneo ya está lleno.');
    if (this.seatOf(seat.id) !== -1) throw conflict('Ya estás en este torneo.');
    this.seats.push({ ...seat, ready: isAiSeat(seat) });
  }

  private assertHost(trainerId: string, action: string): void {
    if (trainerId !== this.hostId) throw forbidden(`Solo el dueño puede ${action}.`);
  }

  private assertLobby(): void {
    if (this.status !== 'open') throw conflict(this.status === 'cancelled' ? 'Este torneo se cerró.' : 'El torneo ya partió.');
  }

  join(trainer: { id: string; name: string }): void {
    if (this.status !== 'open') throw conflict(this.status === 'running' || this.status === 'finished' ? 'Llegaste tarde: este torneo ya partió.' : 'Este torneo se cerró.');
    this.addSeat({ id: trainer.id, name: trainer.name, ai: null });
  }

  leave(trainerId: string): boolean {
    this.assertLobby();
    const seatIndex = this.seatOf(trainerId);
    if (seatIndex <= 0) return false;
    this.seats.splice(seatIndex, 1);
    return true;
  }

  kick(trainerId: string, index: number): void {
    this.assertHost(trainerId, 'quitar jugadores');
    this.assertLobby();
    if (index <= 0 || index >= this.seats.length) throw conflict('Ese asiento no se puede quitar.');
    this.seats.splice(index, 1);
  }

  setReady(trainerId: string, ready: boolean): void {
    this.assertLobby();
    const seatIndex = this.seatOf(trainerId);
    if (seatIndex === -1) throw conflict('No estás en este torneo.');
    this.seats[seatIndex].ready = !!ready;
  }

  addAis(trainerId: string, level: AiLevel, count: number): void {
    this.assertHost(trainerId, 'agregar IAs');
    this.assertLobby();
    if (isFull(this)) throw conflict('El torneo ya está lleno.');
    const added = Math.max(1, Math.min(this.size - this.seats.length, count));
    for (let i = 0; i < added; i++) {
      const id = nextAiId(this, level);
      const { base, name } = aiName(level, this.seats.map((seat) => seat.aiBase).filter((b): b is string => !!b));
      this.addSeat({ id, name, aiBase: base, ai: level });
    }
  }

  close(trainerId: string): void {
    this.assertHost(trainerId, 'cerrar el torneo');
    this.assertLobby();
    this.status = 'cancelled';
  }

  abandon(): void {
    this.status = 'abandoned';
  }

  startIfReady({ at, firstMatchAt, random = Math.random }: { at: number; firstMatchAt: number; random?: () => number }): boolean {
    if (this.status !== 'open' || !allReady(this)) return false;
    this.status = 'running';
    this.startedAt = at;
    this.bracket = createBracket(shuffledOrder(this.size, random));
    this.drawAt = at;
    this.nextAt = firstMatchAt;
    return true;
  }

  startNextMatch(challengeId: string): (MatchRef & { a: Seat; b: Seat; challengeId: string }) | null {
    if (this.status !== 'running' || !this.bracket) return null;
    const at = nextMatch(this.bracket);
    if (!at) return null;
    const match = this.bracket[at.round][at.index];
    match.challengeId = challengeId;
    this.current = { ...at, challengeId };
    this.nextAt = null;
    return { ...at, a: this.seats[match.a!], b: this.seats[match.b!], challengeId };
  }

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

  progress(): { played: number; total: number } {
    if (!this.bracket) return { played: 0, total: this.size - 1 };
    return { played: this.bracket.flat().filter((m) => m.winner !== null).length, total: totalMatches(this.bracket) };
  }

  reachedBy(trainerId: string): string | null {
    const seat = this.seatOf(trainerId);
    let reached = -1;
    this.bracket?.forEach((round, roundIndex) => round.forEach((match) => (match.a === seat || match.b === seat) && (reached = roundIndex)));
    return reached === -1 ? null : roundName(this.size, reached);
  }

  label(at: MatchRef) {
    const bracket = this.bracket!;
    const final = at.round === bracket.length - 1;
    return { id: this.id, size: this.size, round: roundName(this.size, at.round), next: final ? null : roundName(this.size, at.round + 1), final, number: matchNumber(bracket, at), total: totalMatches(bracket) };
  }
}

export type TournamentLabel = ReturnType<Tournament['label']>;

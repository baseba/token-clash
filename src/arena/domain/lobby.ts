// Matchmaking rules for duel rooms: which open rooms are listed, which one a public search joins,
// and why a room can't be joined. Pure functions over challenges; "is the host still here?" comes
// in as a function because presence is live state the domain doesn't own.
import { conflict, DomainError, gone, invalid, notFound } from '../../shared/domain/errors.js';
import type { BattleMode, Challenge } from './challenge.js';

/** A public room stays listed this long after creation even if its host hasn't connected yet. */
export const HOST_GRACE_MS = 20_000;

type RoomLike = Pick<Challenge, 'status' | 'createdAt' | 'hostId' | 'guestId' | 'ai' | 'visibility' | 'mode' | 'levelCap'>;
type HostWaiting<T> = (c: T) => boolean;

export const visibilityOf = (c: Pick<Challenge, 'visibility'>) => c.visibility ?? 'private';

const hostPresent = <T extends RoomLike>(c: T, now: number, hostWaiting: HostWaiting<T>) => now - c.createdAt < HOST_GRACE_MS || hostWaiting(c);

export function openRooms<T extends RoomLike>(challenges: Record<string, T> | T[], { now = Date.now(), hostWaiting = (() => false) as HostWaiting<T> } = {}): T[] {
  return Object.values(challenges)
    .filter((c) => c.status === 'open' && !c.ai && visibilityOf(c) === 'public' && hostPresent(c, now, hostWaiting))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function matchFor<T extends RoomLike>(rooms: T[], { trainerId, mode, levelCap }: { trainerId: string; mode: BattleMode; levelCap: number | null }): { own: T | null; rival: T | null } {
  const same = rooms.filter((c) => (c.mode ?? 'team') === mode && (c.levelCap ?? null) === levelCap);
  return { own: same.find((c) => c.hostId === trainerId) ?? null, rival: same.find((c) => c.hostId !== trainerId) ?? null };
}

/** Why `trainerId` can't join this room, or null if they can. */
export function joinBlocker<T extends RoomLike>(c: T | null | undefined, { trainerId, now = Date.now(), hostWaiting = (() => false) as HostWaiting<T> }: { trainerId: string; now?: number; hostWaiting?: HostWaiting<T> }): DomainError | null {
  if (!c) return notFound('Esa sala ya no existe.');
  if (c.ai) return conflict('Esa pelea es contra la IA: no se puede entrar.');
  if (c.hostId === trainerId) return invalid('Es tu propia sala: espera a que entre alguien o mándale el link a otro jugador.');
  if (c.status === 'active') return conflict(c.guestId === trainerId ? 'Ya estás en esta pelea.' : 'Llegaste tarde: otro jugador entró primero a esta sala.');
  if (c.status === 'finished') return conflict('Esta sala ya terminó su pelea.');
  if (c.status === 'cancelled') return gone('El anfitrión cerró esta sala.');
  if (c.status !== 'open') return gone('Esta sala se cortó cuando se reinició el servidor.');
  if (visibilityOf(c) === 'public' && !hostPresent(c, now, hostWaiting)) return conflict('El anfitrión ya no está en la sala. Busca otra o abre la tuya.');
  return null;
}

// Matchmaking rules for duel rooms: which open rooms are listed, which one a public search joins,
// and why a room can't be joined. Pure functions over challenges; "is the host still here?" comes
// in as a function because presence is live state the domain doesn't own.
import { conflict, type DomainError, notFound } from '../../shared/domain/errors.js';
import type { BattleMode, Challenge } from './challenge.js';

/** A public room stays listed this long after creation even if its host hasn't connected yet. */
export const HOST_GRACE_MS = 20_000;

type RoomLike = Pick<Challenge, 'status' | 'createdAt' | 'hostId' | 'ai' | 'visibility' | 'mode'>;
type HostWaiting<T> = (room: T) => boolean;

const hostPresent = <T extends RoomLike>(room: T, now: number, hostWaiting: HostWaiting<T>) =>
  now - room.createdAt < HOST_GRACE_MS || hostWaiting(room);

export function openRooms<T extends RoomLike>(challenges: Record<string, T> | T[], { now = Date.now(), hostWaiting = (() => false) as HostWaiting<T> } = {}): T[] {
  return Object.values(challenges)
    .filter((c) => c.status === 'open' && !c.ai && c.visibility === 'public' && hostPresent(c, now, hostWaiting))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function matchFor<T extends RoomLike>(rooms: T[], { trainerId, mode }: { trainerId: string; mode: BattleMode }): { own: T | null; rival: T | null } {
  const same = rooms.filter((c) => c.mode === mode);
  return { own: same.find((c) => c.hostId === trainerId) ?? null, rival: same.find((c) => c.hostId !== trainerId) ?? null };
}

/** Why `trainerId` can't join this room, or null if they can: the room's own rules, then whether its host is still around. */
export function joinBlocker(
  room: Challenge | undefined,
  { trainerId, now = Date.now(), hostWaiting = () => false }: { trainerId: string; now?: number; hostWaiting?: HostWaiting<Challenge> },
): DomainError | null {
  if (!room) return notFound('Esa sala ya no existe.');
  const blocked = room.joinBlocker(trainerId);
  if (blocked) return blocked;
  if (room.visibility === 'public' && !hostPresent(room, now, hostWaiting))
    return conflict('El anfitrión ya no está en la sala. Busca otra o abre la tuya.');
  return null;
}

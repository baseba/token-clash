export const HOST_GRACE_MS = 20_000;

export const visibilityOf = (c) => c.visibility ?? 'private';

const hostPresent = (c, now, hostWaiting) => now - c.createdAt < HOST_GRACE_MS || hostWaiting(c);

export function openRooms(challenges, { now = Date.now(), hostWaiting = () => false } = {}) {
  return Object.values(challenges)
    .filter((c) => c.status === 'open' && !c.ai && visibilityOf(c) === 'public' && hostPresent(c, now, hostWaiting))
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function matchFor(rooms, { trainerId, mode, levelCap }) {
  const same = rooms.filter((c) => (c.mode ?? 'team') === mode && (c.levelCap ?? null) === levelCap);
  return { own: same.find((c) => c.hostId === trainerId) ?? null, rival: same.find((c) => c.hostId !== trainerId) ?? null };
}

export function joinBlocker(c, { trainerId, now = Date.now(), hostWaiting = () => false }) {
  if (!c) return { status: 404, error: 'Esa sala ya no existe.' };
  if (c.ai) return { status: 409, error: 'Esa pelea es contra la IA: no se puede entrar.' };
  if (c.hostId === trainerId) return { status: 400, error: 'Es tu propia sala: espera a que entre alguien o mándale el link a otro jugador.' };
  if (c.status === 'active') return { status: 409, error: c.guestId === trainerId ? 'Ya estás en esta pelea.' : 'Llegaste tarde: otro jugador entró primero a esta sala.' };
  if (c.status === 'finished') return { status: 409, error: 'Esta sala ya terminó su pelea.' };
  if (c.status === 'cancelled') return { status: 410, error: 'El anfitrión cerró esta sala.' };
  if (c.status !== 'open') return { status: 410, error: 'Esta sala se cortó cuando se reinició el servidor.' };
  if (visibilityOf(c) === 'public' && !hostPresent(c, now, hostWaiting)) return { status: 409, error: 'El anfitrión ya no está en la sala. Busca otra o abre la tuya.' };
  return null;
}

// What each client in a room sees: one frame per phase, built for that client (a player sees their
// own side, a viewer sees both as the public does). The `t` of a frame says why it was sent.
import type { Logger } from '@nestjs/common';
import { publicState, validActions, viewEvents, type BattleEvent } from '../../combat/domain/battle.js';
import { previewView, type PreviewState } from '../../combat/domain/team-preview.js';
import { now } from '../../shared/domain/clock.js';
import { DomainError } from '../../shared/domain/errors.js';
import type { ClientConnection } from './connection.js';
import { inRoom, type Room } from './presence.js';

/** Why a frame is sent. A battle frame after a turn also carries what happened in it. */
export type FrameCause =
  | { t: 'lobby' | 'countdown' | 'preview' | 'presence' | 'ready' | 'start' }
  | { t: 'events'; events: BattleEvent[]; timedOut: boolean };

/** The side a trainer plays in this battle or preview, or null for a viewer. */
export function sideIn(sides: { trainerId: string }[], trainerId: string | null | undefined): number | null {
  if (!trainerId) return null;
  const index = sides.findIndex((side) => side.trainerId === trainerId);
  return index === -1 ? null : index;
}

export function frameFor(room: Room, ws: ClientConnection, cause: FrameCause): Record<string, unknown> {
  const { phase } = room;
  switch (phase.kind) {
    case 'waiting':
      return { t: 'waiting', watchers: room.sockets.size };
    case 'readyCheck': {
      const you = phase.players.findIndex((player) => player.id === ws.trainerId);
      return {
        t: 'lobby',
        players: phase.players.map((player) => ({ ...player, ready: phase.ready.has(player.id), online: inRoom(room, player.id) })),
        you: you === -1 ? null : you,
      };
    }
    case 'countdown': {
      const you = phase.players.findIndex((player) => player.id === ws.trainerId);
      return {
        ...cause,
        t: 'countdown',
        ms: Math.max(0, phase.endsAt - now()),
        players: phase.players,
        you: you === -1 ? null : you,
        tournament: phase.tournament,
        waiting: phase.waiting,
      };
    }
    case 'preview': {
      const you = sideIn(phase.preview.sides, ws.trainerId);
      return {
        ...cause,
        t: cause.t === 'presence' || cause.t === 'ready' ? 'preview' : cause.t,
        preview: previewView(phase.preview, you),
        you,
        deadline: phase.deadline,
        watchers: room.sockets.size,
      };
    }
    case 'battle': {
      const { battle } = phase;
      const you = sideIn(battle.sides, ws.trainerId);
      return {
        ...cause,
        ...(cause.t === 'events' ? { events: viewEvents(cause.events, you) } : {}),
        state: publicState(battle, you),
        you,
        actions: you === null ? [] : validActions(battle, you),
        forced: you !== null && !!battle.sides[you].action?.auto,
        deadline: phase.deadline,
        watchers: room.sockets.size,
      };
    }
  }
}

export function broadcast(room: Room, cause: FrameCause): void {
  for (const ws of room.sockets) if (ws.open) ws.send(frameFor(room, ws, cause));
}

/** Viewers (not the players) see each side's draft as it is marked. */
export function broadcastToViewers(room: Room, preview: PreviewState): void {
  for (const ws of room.sockets) if (ws.open && sideIn(preview.sides, ws.trainerId) === null) ws.send(frameFor(room, ws, { t: 'preview' }));
}

/**
 * A rule said no: the player reads why. Anything else is an engine bug: it goes to the log, and the
 * player still gets an error frame (the client only shows frames with a `t`), never a stuck screen.
 */
export function refuse(ws: ClientConnection, error: unknown, logger: Pick<Logger, 'error'>): void {
  if (error instanceof DomainError) return ws.send({ t: 'error', error: error.message });
  logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
  ws.send({ t: 'error', error: 'Algo falló en el servidor. Intenta de nuevo.' });
}

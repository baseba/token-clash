// The chat of rooms and tournaments, as the arena routes it. The chat context keeps each channel's
// messages and knows nothing about rooms; the arena decides which channel a connection talks in,
// whether it talks as a player or a viewer, and who hears each message.
import { Injectable } from '@nestjs/common';
import { ChatService } from '../../chat/application/chat.service.js';
import type { ChatMessage } from '../../chat/domain/chat.js';
import { now } from '../../shared/domain/clock.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { TournamentRepository } from '../domain/arena.repositories.js';
import type { Challenge } from '../domain/challenge.js';
import type { ClientConnection } from './connection.js';
import { Presence } from './presence.js';
import { sideIn } from './room-frames.js';

/** Where a message goes. Every match of a tournament talks in the tournament's channel; a lone duel has its own. */
type ChatChannel = { kind: 'room'; challengeId: string } | { kind: 'tournament'; tournamentId: string };

interface Speaker {
  channel: ChatChannel;
  role: ChatMessage['role'];
  /** The side a player fights on, once the teams are out. */
  side: number | null;
}

const channelOf = (challenge: Challenge): ChatChannel =>
  challenge.tournamentId ? { kind: 'tournament', tournamentId: challenge.tournamentId } : { kind: 'room', challengeId: challenge.id };

/** The name the chat context keeps a channel's history under. */
const channelName = (channel: ChatChannel) => (channel.kind === 'room' ? `c:${channel.challengeId}` : `t:${channel.tournamentId}`);

@Injectable()
export class ArenaChatService {
  constructor(
    private readonly chat: ChatService,
    private readonly trainers: TrainersService,
    private readonly tournaments: TournamentRepository,
    private readonly presence: Presence,
  ) {}

  /** A connection just entered a room or a tournament page: it gets the conversation so far. */
  sendHistory(ws: ClientConnection): void {
    const channel = this.channelOf(ws);
    if (channel) ws.send({ t: 'chatLog', messages: this.chat.history(channelName(channel)) });
  }

  /** A trainer says something where they are. Anonymous viewers, empty lines and floods are dropped. */
  say(ws: ClientConnection, text: string): void {
    const trainer = this.trainers.byId(ws.trainerId);
    const speaker = trainer && this.speaker(ws, trainer.id);
    if (!trainer || !speaker) return;
    const at = now();
    const message = this.chat.post(channelName(speaker.channel), {
      trainerId: trainer.id,
      name: trainer.name,
      role: speaker.role,
      side: speaker.side,
      text,
      lastAt: ws.lastChatAt,
      at,
    });
    if (!message) return;
    ws.lastChatAt = at;
    const frame = JSON.stringify({ t: 'chat', message });
    for (const listener of this.audience(speaker.channel)) if (listener.open) listener.send(frame);
  }

  private channelOf(ws: ClientConnection): ChatChannel | null {
    const room = this.presence.roomOf(ws);
    if (room) return channelOf(room.challenge);
    return ws.tourId ? { kind: 'tournament', tournamentId: ws.tourId } : null;
  }

  /** In a room, a player is someone seated in the match (or, for a tournament match, in the tournament). */
  private speaker(ws: ClientConnection, trainerId: string): Speaker | null {
    const room = this.presence.roomOf(ws);
    if (room) {
      const { challenge, phase } = room;
      const player = challenge.tournamentId ? this.seated(challenge.tournamentId, trainerId) : challenge.isPlayer(trainerId);
      const side = phase.kind === 'battle' ? sideIn(phase.battle.sides, trainerId) : phase.kind === 'preview' ? sideIn(phase.preview.sides, trainerId) : null;
      return { channel: channelOf(challenge), role: player ? 'player' : 'watcher', side };
    }
    const tournament = ws.tourId ? this.tournaments.findById(ws.tourId) : undefined;
    if (!tournament) return null;
    return { channel: { kind: 'tournament', tournamentId: tournament.id }, role: this.seated(tournament.id, trainerId) ? 'player' : 'watcher', side: null };
  }

  private seated(tournamentId: string, trainerId: string): boolean {
    return (this.tournaments.findById(tournamentId)?.seatOf(trainerId) ?? -1) !== -1;
  }

  private audience(channel: ChatChannel): ClientConnection[] {
    if (channel.kind === 'tournament') return this.presence.tournamentAudience(channel.tournamentId);
    return [...(this.presence.rooms.get(channel.challengeId)?.sockets ?? [])];
  }
}

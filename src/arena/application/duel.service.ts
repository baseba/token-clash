// A duel room until its match starts: opening one against the AI, a rival taking the free seat,
// the host closing it, the ready check, and clients coming and going. Each step of a live room
// (RoomPhase in presence.ts) belongs to one service, which hands the room to the next:
//
//   DuelService          waiting → ready check (1v1 rooms only)
//   TeamPreviewService   countdown → preview (each side picks 3 of 6) → reveal
//   LiveBattleService    battle → result
//
// Nothing here is stored except the challenge, through its repository.
import { Injectable } from '@nestjs/common';
import { randomParty } from '../../combat/domain/random-party.js';
import { aiTrainerId, buildAiRandomParty, buildAiTeam, type AiLevel } from '../../combat/domain/ai.js';
import { AppConfig, type ArenaTimings } from '../../shared/config/app-config.js';
import { newId, now } from '../../shared/domain/clock.js';
import { conflict } from '../../shared/domain/errors.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { ChallengeRepository } from '../domain/arena.repositories.js';
import { Challenge, type BattleMode } from '../domain/challenge.js';
import { aiName } from '../domain/tournament.js';
import { ArenaViews } from './arena-views.js';
import type { ClientConnection } from './connection.js';
import { LobbyService } from './lobby.service.js';
import { inRoom, Presence, type Room } from './presence.js';
import { broadcast, frameFor } from './room-frames.js';
import { TeamPreviewService } from './team-preview.service.js';

@Injectable()
export class DuelService {
  private readonly timings: ArenaTimings;

  constructor(
    config: AppConfig,
    private readonly challenges: ChallengeRepository,
    private readonly trainers: TrainersService,
    private readonly presence: Presence,
    private readonly views: ArenaViews,
    private readonly lobby: LobbyService,
    private readonly previews: TeamPreviewService,
  ) {
    this.timings = config.timings;
  }

  /** A battle against the AI: no waiting room, straight to the preview. */
  startAgainstAi(trainer: Trainer, { mode, level }: { mode: BattleMode; level: AiLevel }): Challenge {
    const hostTeam = mode === 'random' ? randomParty(trainer.roster) : trainer.teamSnapshot();
    const aiTeam = mode === 'random' ? buildAiRandomParty() : buildAiTeam({ difficulty: level });
    const challenge = Challenge.againstAi({
      id: newId(),
      host: trainer,
      hostTeam,
      ai: { id: aiTrainerId(level), name: aiName(level).name, level },
      aiTeam,
      mode,
      at: now(),
    });
    this.challenges.save(challenge);
    this.previews.open(this.presence.room(challenge));
    return challenge;
  }

  /** A random battle rolls the host's party when someone joins: a host with no Pokémon left can't be joined. */
  joinable(challenge: Challenge): boolean {
    return challenge.mode !== 'random' || !!this.trainers.byId(challenge.hostId)?.roster.length;
  }

  /** Someone takes the free seat of an open room. */
  join(challenge: Challenge, guest: Trainer): void {
    if (!this.joinable(challenge)) throw conflict('El anfitrión ya no tiene Pokémon.');
    if (challenge.mode === 'random') {
      challenge.join(guest, { hostTeam: randomParty(this.trainers.byId(challenge.hostId)!.roster), guestTeam: randomParty(guest.roster) });
    } else challenge.join(guest, { guestTeam: guest.teamSnapshot() });
    this.challenges.save(challenge);
    const room = this.presence.room(challenge);
    room.phase = {
      kind: 'readyCheck',
      ready: new Set(),
      players: [this.views.countdownPlayer(challenge.hostId, challenge.hostName, challenge), this.views.countdownPlayer(guest.id, guest.name, challenge)],
    };
    broadcast(room, { t: 'lobby' });
    this.lobby.notify();
  }

  /** The host closes the room (or leaves it): everyone inside is told. */
  close(challenge: Challenge, byTrainerId: string | undefined): void {
    const room = this.presence.rooms.get(challenge.id);
    challenge.cancel(byTrainerId, { readyCheck: room?.phase.kind === 'readyCheck' });
    if (room) room.phase = { kind: 'waiting' };
    this.challenges.save(challenge);
    if (room) for (const ws of room.sockets) if (ws.open) ws.send({ t: 'closed' });
    this.lobby.notify();
  }

  expireStale(at: number): void {
    const expired = this.challenges.all().filter((challenge) => {
      const room = this.presence.rooms.get(challenge.id);
      return challenge.expire(at, { readyCheck: room?.phase.kind === 'readyCheck' });
    });
    for (const challenge of expired) {
      const room = this.presence.rooms.get(challenge.id);
      if (room) {
        clearTimeout(room.timer ?? undefined);
        room.phase = { kind: 'waiting' };
        for (const ws of room.sockets) if (ws.open) ws.send({ t: 'closed', reason: 'expired' });
      }
      this.challenges.save(challenge);
    }
    if (expired.length) this.lobby.notify();
  }

  /** A client opens a room page. Returns the challenge, or null if it doesn't exist. */
  enter(ws: ClientConnection, roomId: string, token: string | undefined): Challenge | null {
    if (token !== undefined) ws.trainerId = this.trainers.authenticate(token)?.id ?? null;
    const challenge = this.challenges.findById(roomId);
    if (!challenge) {
      ws.send({ t: 'error', error: 'Ese desafío no existe.' });
      return null;
    }
    ws.roomId = challenge.id;
    const room = this.presence.room(challenge);
    room.sockets.add(ws);
    if (ws.trainerId === challenge.hostId && challenge.status === 'open') this.lobby.notify();
    this.previews.playerArrived(room, ws.trainerId);
    if (room.phase.kind === 'waiting' || room.phase.kind === 'countdown') ws.send(frameFor(room, ws, { t: 'presence' }));
    else broadcast(room, { t: 'presence' });
    return challenge;
  }

  /** A client in a room disconnected. A player who drops out of the ready check has a while to come back. */
  left(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    if (!room) return;
    const { challenge, phase } = room;
    room.sockets.delete(ws);
    if (ws.trainerId === challenge.hostId) this.lobby.notify();
    if (phase.kind === 'readyCheck' && phase.players.some((p) => p.id === ws.trainerId)) {
      broadcast(room, { t: 'lobby' });
      setTimeout(() => {
        // This ready check only: after a reopen, a new guest starts another one.
        if (room.phase !== phase || inRoom(room, ws.trainerId)) return;
        if (ws.trainerId === challenge.hostId) this.close(challenge, challenge.hostId);
        else this.reopen(room);
      }, this.timings.seatGraceMs).unref();
    }
    if (phase.kind === 'battle' || phase.kind === 'preview') broadcast(room, { t: 'presence' });
    if (phase.kind === 'waiting' && room.sockets.size === 0) this.presence.rooms.delete(challenge.id);
  }

  /** A player presses (or releases) "ready". When both are ready, the countdown starts. */
  setReady(ws: ClientConnection, ready: boolean): void {
    const room = this.presence.roomOf(ws);
    const trainerId = ws.trainerId;
    if (room?.phase.kind !== 'readyCheck' || !trainerId || !room.phase.players.some((p) => p.id === trainerId)) return;
    const check = room.phase;
    if (ready) check.ready.add(trainerId);
    else check.ready.delete(trainerId);
    if (check.players.every((p) => check.ready.has(p.id))) this.previews.startCountdown(room);
    else broadcast(room, { t: 'lobby' });
  }

  /** The guest walks out of the ready check. */
  leaveReadyCheck(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    if (room?.phase.kind === 'readyCheck' && room.challenge.guestId === ws.trainerId) this.reopen(room);
  }

  /** The guest left during the ready check: the room goes back to waiting for a rival. */
  private reopen(room: Room): void {
    if (room.phase.kind !== 'readyCheck') return;
    const { challenge } = room;
    room.phase = { kind: 'waiting' };
    challenge.reopen();
    this.challenges.save(challenge);
    for (const ws of room.sockets) if (ws.open) ws.send({ t: 'reopened', host: ws.trainerId === challenge.hostId });
    this.lobby.notify();
  }
}

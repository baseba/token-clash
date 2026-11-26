import { Injectable } from '@nestjs/common';
import { randomParty } from '../../combat/domain/random-party.js';
import { aiTrainerId, buildAiRandomParty, buildAiTeam, type AiLevel } from '../../combat/domain/ai.js';
import { AppConfig, type ArenaTimings } from '../../platform/config/app-config.js';
import { newId, now } from '../../shared/domain/clock.js';
import { conflict } from '../../shared/domain/errors.js';
import { AccountsService } from '../../trainers/application/accounts.service.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { ChallengeRepository } from '../domain/arena.repositories.js';
import { Challenge, type BattleMode, type Staging } from '../domain/challenge.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
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
    private readonly accounts: AccountsService,
    private readonly presence: Presence,
    private readonly views: ArenaViews,
    private readonly lobby: LobbyService,
    private readonly previews: TeamPreviewService,
  ) {
    this.timings = config.timings;
  }

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

  startStaged(trainer: Trainer, input: { level: AiLevel; hostTeam: RosterEntry[]; aiName: string; aiTeam: RosterEntry[]; staging: Staging }): Challenge {
    const challenge = Challenge.againstAi({
      id: newId(),
      host: trainer,
      hostTeam: input.hostTeam,
      ai: { id: aiTrainerId(input.level), name: input.aiName, level: input.level },
      aiTeam: input.aiTeam,
      mode: 'team',
      at: now(),
      staging: input.staging,
    });
    this.challenges.save(challenge);
    this.previews.open(this.presence.room(challenge));
    return challenge;
  }

  joinable(challenge: Challenge): boolean {
    return challenge.mode !== 'random' || !!this.trainers.byId(challenge.hostId)?.roster.length;
  }

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

  close(challenge: Challenge, byTrainerId: string | undefined): void {
    const room = this.presence.findRoom(challenge.id);
    challenge.cancel(byTrainerId, { readyCheck: room?.phase.kind === 'readyCheck' });
    if (room) room.phase = { kind: 'waiting' };
    this.challenges.save(challenge);
    if (room) for (const ws of room.sockets) if (ws.open) ws.send({ t: 'closed' });
    this.lobby.notify();
  }

  expireStale(at: number): void {
    const expired = this.challenges.all().filter((challenge) => {
      const room = this.presence.findRoom(challenge.id);
      return challenge.expire(at, { readyCheck: room?.phase.kind === 'readyCheck' });
    });
    for (const challenge of expired) {
      const room = this.presence.findRoom(challenge.id);
      if (room) {
        clearTimeout(room.timer ?? undefined);
        room.phase = { kind: 'waiting' };
        for (const ws of room.sockets) if (ws.open) ws.send({ t: 'closed', reason: 'expired' });
      }
      this.challenges.save(challenge);
    }
    if (expired.length) this.lobby.notify();
  }

  enter(ws: ClientConnection, roomId: string, token: string | undefined): Challenge | null {
    const challenge = this.challenges.findById(roomId);
    if (!challenge) {
      ws.send({ t: 'error', error: 'Ese desafío no existe.' });
      return null;
    }
    if (token !== undefined) ws.signIn(this.accounts.authenticate(token));
    if (!ws.enterRoom(challenge.id)) return null;
    const room = this.presence.room(challenge);
    room.sockets.add(ws);
    if (ws.trainerId === challenge.hostId && challenge.status === 'open') this.lobby.notify();
    this.previews.playerArrived(room, ws.trainerId);
    if (room.phase.kind === 'waiting' || room.phase.kind === 'countdown') ws.send(frameFor(room, ws, { t: 'presence' }));
    else broadcast(room, { t: 'presence' });
    return challenge;
  }

  left(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    if (!room) return;
    const { challenge, phase } = room;
    room.sockets.delete(ws);
    if (ws.trainerId === challenge.hostId) this.lobby.notify();
    if (phase.kind === 'readyCheck' && phase.players.some((p) => p.id === ws.trainerId)) {
      broadcast(room, { t: 'lobby' });
      setTimeout(() => {
        if (room.phase !== phase || inRoom(room, ws.trainerId)) return;
        if (ws.trainerId === challenge.hostId) this.close(challenge, challenge.hostId);
        else this.reopen(room);
      }, this.timings.seatGraceMs).unref();
    }
    if (phase.kind === 'battle' || phase.kind === 'preview') broadcast(room, { t: 'presence' });
    if (phase.kind === 'waiting') this.presence.dropIfEmpty(room);
  }

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

  leaveReadyCheck(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    if (room?.phase.kind === 'readyCheck' && room.challenge.guestId === ws.trainerId) this.reopen(room);
  }

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

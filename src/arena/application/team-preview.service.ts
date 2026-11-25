import { Injectable, Logger } from '@nestjs/common';
import { aiLevelOf, aiPicks, aiRerollCandidates, aiRerollIndex, type AiLevel } from '../../combat/domain/ai.js';
import { reroll } from '../../combat/domain/random-party.js';
import { canReroll, createPreview, fillMissing, pick, picksNeeded, previewReady } from '../../combat/domain/team-preview.js';
import { AppConfig, type ArenaTimings } from '../../shared/config/app-config.js';
import { now } from '../../shared/domain/clock.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { pendingArrivals, type TournamentLabel } from '../domain/tournament.js';
import { ArenaViews } from './arena-views.js';
import type { ClientConnection } from './connection.js';
import { LiveBattleService } from './live-battle.service.js';
import { Presence, someoneAbsent, type CountdownPhase, type PreviewPhase, type Room } from './presence.js';
import { broadcast, broadcastToViewers, refuse, sideIn } from './room-frames.js';

@Injectable()
export class TeamPreviewService {
  private readonly logger = new Logger(TeamPreviewService.name);
  private readonly timings: ArenaTimings;

  constructor(
    config: AppConfig,
    private readonly trainers: TrainersService,
    private readonly presence: Presence,
    private readonly views: ArenaViews,
    private readonly battles: LiveBattleService,
  ) {
    this.timings = config.timings;
  }

  startCountdown(room: Room, tournament: TournamentLabel | null = null): void {
    const { challenge } = room;
    const phase: CountdownPhase = {
      kind: 'countdown',
      startedAt: now(),
      endsAt: now() + this.timings.countdownMs,
      players: [
        this.views.countdownPlayer(challenge.hostId, challenge.hostName, challenge),
        this.views.countdownPlayer(challenge.guestId!, challenge.guestName!, challenge),
      ],
      tournament,
      waiting: null,
    };
    room.phase = phase;
    setTimeout(() => this.openWhenArrived(room, phase), this.timings.countdownMs);
    broadcast(room, { t: 'countdown' });
  }

  open(room: Room): void {
    const { challenge } = room;
    const phase: PreviewPhase = {
      kind: 'preview',
      preview: createPreview({
        mode: challenge.mode,
        sides: [
          { trainerId: challenge.hostId, name: this.views.nameOf(challenge.hostId, challenge.hostName)!, avatar: this.views.avatarOf(challenge.hostId, challenge), frame: this.views.frameOf(challenge.hostId), entries: challenge.hostTeam },
          { trainerId: challenge.guestId!, name: this.views.nameOf(challenge.guestId, challenge.guestName)!, avatar: this.views.avatarOf(challenge.guestId!, challenge), frame: this.views.frameOf(challenge.guestId!), entries: challenge.guestTeam! },
        ],
      }),
      deadline: null,
      short: false,
    };
    room.phase = phase;
    this.armTimer(room, phase, challenge.mode === 'random' ? this.timings.diceRollBonusMs : 0);
    broadcast(room, { t: 'preview' });
    phase.preview.sides.forEach((side, sideIndex) => {
      const level = aiLevelOf(side.trainerId);
      if (level) this.scheduleAiPick(room, phase, sideIndex, level);
    });
  }

  playerArrived(room: Room, trainerId: string | null): void {
    const { phase } = room;
    if (phase.kind === 'preview'
      && !phase.preview.revealed
      && phase.short
      && sideIn(phase.preview.sides, trainerId) !== null
      && !someoneAbsent(room, phase.preview.sides))
      this.armTimer(room, phase);
  }

  choosing(ws: ClientConnection, picks: number[]): void {
    const room = this.presence.roomOf(ws);
    if (room?.phase.kind !== 'preview' || room.phase.preview.revealed) return;
    const { preview } = room.phase;
    const sideIndex = sideIn(preview.sides, ws.trainerId);
    if (sideIndex === null || preview.sides[sideIndex].picks) return;
    const side = preview.sides[sideIndex];
    side.draft = [...new Set(picks)].filter((i) => i >= 0 && i < side.entries.length).slice(0, picksNeeded(preview, sideIndex));
    broadcastToViewers(room, preview);
  }

  pick(ws: ClientConnection, picks: number[]): void {
    const room = this.presence.roomOf(ws);
    if (room?.phase.kind !== 'preview') return;
    const { phase } = room;
    const sideIndex = sideIn(phase.preview.sides, ws.trainerId);
    if (sideIndex === null) return;
    try {
      pick(phase.preview, sideIndex, picks);
    } catch (error) {
      return refuse(ws, error, this.logger);
    }
    if (previewReady(phase.preview)) this.reveal(room, phase);
    else broadcast(room, { t: 'preview' });
  }

  reroll(ws: ClientConnection, index: number): void {
    const room = this.presence.roomOf(ws);
    if (room?.phase.kind !== 'preview') return;
    const { preview } = room.phase;
    const sideIndex = sideIn(preview.sides, ws.trainerId);
    if (sideIndex === null) return;
    try {
      reroll(preview, sideIndex, index, this.trainers.byId(ws.trainerId!)?.roster ?? []);
    } catch (error) {
      return refuse(ws, error, this.logger);
    }
    broadcast(room, { t: 'preview' });
  }

  private tournamentFollowers(tournamentId: string): string[] {
    const ids = new Set<string>();
    for (const ws of this.presence.tournamentAudience(tournamentId)) if (ws.open && ws.trainerId) ids.add(ws.trainerId);
    return [...ids].filter((id) => !aiLevelOf(id));
  }

  private openWhenArrived(room: Room, countdown: CountdownPhase): void {
    if (room.phase !== countdown) return;
    const { challenge } = room;
    const pending = challenge.tournamentId
      ? pendingArrivals({
          players: [challenge.hostId, challenge.guestId!].filter((id) => !aiLevelOf(id)),
          followers: this.tournamentFollowers(challenge.tournamentId),
          present: [...room.sockets].filter((ws) => ws.open).map((ws) => ws.trainerId),
        })
      : [];
    if (pending.length && now() - countdown.startedAt < this.timings.countdownMs + this.timings.arrivalWaitMs) {
      const waiting = pending.map((id) => this.trainers.byId(id)?.name ?? '…');
      const changed = JSON.stringify(waiting) !== JSON.stringify(countdown.waiting);
      countdown.waiting = waiting;
      countdown.endsAt = now();
      if (changed) broadcast(room, { t: 'countdown' });
      setTimeout(() => this.openWhenArrived(room, countdown), 500);
      return;
    }
    if (challenge.status === 'active') this.open(room);
    else room.phase = { kind: 'waiting' };
  }

  private armTimer(room: Room, phase: PreviewPhase, extraMs = 0): void {
    clearTimeout(room.timer ?? undefined);
    phase.short = someoneAbsent(room, phase.preview.sides);
    const ms = (phase.short ? Math.min(this.timings.absentLimitMs, this.timings.pickLimitMs) : this.timings.pickLimitMs) + extraMs;
    phase.deadline = now() + ms;
    room.timer = setTimeout(() => {
      if (room.phase !== phase) return;
      fillMissing(phase.preview);
      this.reveal(room, phase);
    }, ms);
    room.timer.unref();
  }

  private scheduleAiPick(room: Room, phase: PreviewPhase, sideIndex: number, level: AiLevel): void {
    const { preview } = phase;
    const side = preview.sides[sideIndex];
    const still = () => room.phase === phase && !side.picks;
    const count = picksNeeded(preview, sideIndex);
    const step = this.timings.aiPickMs / (count + 2);
    const planned = room.challenge.staging?.aiPicks?.filter((index) => index >= 0 && index < side.entries.length).slice(0, count) ?? [];
    let choice: number[] = [];
    setTimeout(
      () => {
        if (!still()) return;
        if (planned.length === count) {
          choice = planned;
          return;
        }
        if (canReroll(preview, sideIndex)) {
          reroll(preview, sideIndex, aiRerollIndex({ difficulty: level, own: side.entries }), aiRerollCandidates(side.entries));
          broadcast(room, { t: 'preview' });
        }
        choice = aiPicks({ difficulty: level, own: side.entries });
      },
      this.timings.diceAnimationMs + step,
    ).unref();
    Array.from({ length: count }).forEach((_, i) => {
      setTimeout(
        () => {
          if (!still()) return;
          side.draft = choice.slice(0, i + 1);
          broadcastToViewers(room, preview);
        },
        this.timings.diceAnimationMs + step * (i + 2),
      ).unref();
    });
    setTimeout(() => {
      if (!still()) return;
      pick(preview, sideIndex, choice.length ? choice : aiPicks({ difficulty: level, own: side.entries }));
      if (previewReady(preview)) this.reveal(room, phase);
      else broadcast(room, { t: 'preview' });
    }, this.timings.diceAnimationMs + this.timings.aiPickMs).unref();
  }

  private reveal(room: Room, phase: PreviewPhase): void {
    if (phase.preview.revealed) return;
    if (this.timings.revealMs <= 0) return this.battles.start(room, phase.preview);
    clearTimeout(room.timer ?? undefined);
    phase.preview.revealed = true;
    phase.deadline = now() + this.timings.revealMs;
    broadcast(room, { t: 'preview' });
    room.timer = setTimeout(() => room.phase === phase && this.battles.start(room, phase.preview), this.timings.revealMs);
    room.timer.unref();
  }
}

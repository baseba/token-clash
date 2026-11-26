import { Injectable, Logger } from '@nestjs/common';
import { aiLevelOf, chooseAction, JEV_LEVEL } from '../../combat/domain/ai.js';
import { autoAction, createBattle, forcedAction, forfeit, needsAction, publicState, submit, type Action, type BattleEvent, type BattleState } from '../../combat/domain/battle.js';
import { chosenEntries, type PreviewState } from '../../combat/domain/team-preview.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { AppConfig, type ArenaTimings } from '../../platform/config/app-config.js';
import { now } from '../../shared/domain/clock.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import { ChallengeRepository } from '../domain/arena.repositories.js';
import { isHumanDuel } from '../domain/challenge.js';
import { viewersBehind } from '../domain/tournament.js';
import { ArenaEvents } from './arena-events.js';
import { ArenaViews } from './arena-views.js';
import type { ClientConnection } from './connection.js';
import { LobbyService } from './lobby.service.js';
import { Presence, someoneAbsent, type BattlePhase, type Room } from './presence.js';
import { broadcast, refuse, sideIn } from './room-frames.js';

const FINISHED_ROOM_MS = 10 * 60_000;

const aiOnly = (battle: BattleState) => battle.sides.every((side) => aiLevelOf(side.trainerId));

@Injectable()
export class LiveBattleService {
  private readonly logger = new Logger(LiveBattleService.name);
  private readonly timings: ArenaTimings;
  private readonly seenTurns = new WeakMap<ClientConnection, number>();

  constructor(
    config: AppConfig,
    private readonly challenges: ChallengeRepository,
    private readonly trainers: TrainersService,
    private readonly presence: Presence,
    private readonly events: ArenaEvents,
    private readonly skynet: SkynetService,
    private readonly lobby: LobbyService,
    private readonly views: ArenaViews,
  ) {
    this.timings = config.timings;
  }

  start(room: Room, preview: PreviewState): void {
    const phase: BattlePhase = {
      kind: 'battle',
      battle: createBattle({
        id: room.challenge.id,
        sides: preview.sides.map((side, sideIndex) => ({ trainerId: side.trainerId, name: side.name, avatar: side.avatar ?? this.views.avatarOf(side.trainerId, room.challenge), frame: side.frame ?? this.views.frameOf(side.trainerId), ball: this.views.ballOf(side.trainerId), entries: chosenEntries(preview, sideIndex) })),
      }),
      startedAt: now(),
      deadline: null,
      jevAsked: new Set(),
    };
    room.phase = phase;
    this.armTimer(room, phase);
    broadcast(room, { t: 'start' });
    this.lobby.notify();
    this.nextAiTurn(room, phase);
  }

  act(ws: ClientConnection, action: Action | null): void {
    const room = this.presence.roomOf(ws);
    if (room?.phase.kind !== 'battle' || room.phase.battle.status !== 'active') return;
    const { phase } = room;
    const sideIndex = sideIn(phase.battle.sides, ws.trainerId);
    if (sideIndex === null) return;
    let events: BattleEvent[] | null;
    try {
      events = submit(phase.battle, sideIndex, action);
    } catch (error) {
      return refuse(ws, error, this.logger);
    }
    if (events) this.afterResolve(room, phase, events);
    else broadcast(room, { t: 'ready' });
  }

  surrender(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    if (room?.phase.kind !== 'battle' || room.phase.battle.status !== 'active') return;
    const { phase } = room;
    const sideIndex = sideIn(phase.battle.sides, ws.trainerId);
    if (sideIndex === null) return;
    clearTimeout(room.timer ?? undefined);
    this.afterResolve(room, phase, forfeit(phase.battle, sideIndex));
  }

  seen(ws: ClientConnection, turn: number): void {
    this.seenTurns.set(ws, Math.max(this.seenTurns.get(ws) ?? 0, turn));
  }

  private nextAiTurn(room: Room, phase: BattlePhase): void {
    const { battle } = phase;
    if (!aiOnly(battle)) return this.aiTurn(room, phase);
    const turn = battle.turn;
    const since = now();
    const check = () => {
      if (room.phase !== phase) return;
      const waited = now() - since;
      const watching = [...room.sockets].filter((ws) => ws.open).map((ws) => this.seenTurns.get(ws));
      if (waited >= this.timings.aiVsAiPauseMs && (waited >= this.timings.aiVsAiViewerWaitMs || !viewersBehind(watching, turn)))
        return this.aiTurn(room, phase);
      setTimeout(check, 250).unref();
    };
    setTimeout(check, Math.min(this.timings.aiVsAiPauseMs, 250)).unref();
  }

  private aiTurn(room: Room, phase: BattlePhase): void {
    const { battle } = phase;
    if (battle.status !== 'active') return;
    let events: BattleEvent[] | null = null;
    let acted = false;
    battle.sides.forEach((side, sideIndex) => {
      const level = aiLevelOf(side.trainerId);
      if (!level || !needsAction(battle, sideIndex)) return;
      if (level === JEV_LEVEL) return void this.jevTurn(room, phase, sideIndex).catch((e) => this.logger.error(`Skynet: ${e}`));
      const action = chooseAction(battle, sideIndex, level) ?? autoAction(battle, sideIndex);
      if (!action) return;
      acted = true;
      events = submit(battle, sideIndex, action) || events;
    });
    if (events) this.afterResolve(room, phase, events);
    else if (acted) broadcast(room, { t: 'ready' });
  }

  private async jevTurn(room: Room, phase: BattlePhase, sideIndex: number): Promise<void> {
    const { battle, jevAsked } = phase;
    const at = `${battle.turn}:${battle.phase}`;
    if (jevAsked.has(at)) return;
    jevAsked.add(at);
    const picked = await this.skynet.choose(battle, sideIndex);
    jevAsked.delete(at);
    if (room.phase !== phase || battle.status !== 'active' || `${battle.turn}:${battle.phase}` !== at || !needsAction(battle, sideIndex)) return;
    const action = picked ?? chooseAction(battle, sideIndex, JEV_LEVEL) ?? autoAction(battle, sideIndex);
    if (!action) return;
    let events: BattleEvent[] | null;
    try {
      events = submit(battle, sideIndex, action);
    } catch (error) {
      this.logger.warn(`Skynet: no se pudo jugar su acción (${error}).`);
      return;
    }
    if (events) this.afterResolve(room, phase, events);
    else broadcast(room, { t: 'ready' });
  }

  private armTimer(room: Room, phase: BattlePhase): void {
    clearTimeout(room.timer ?? undefined);
    room.timer = null;
    phase.deadline = null;
    const { battle } = phase;
    if (battle.status !== 'active') return;
    const ms = someoneAbsent(room, battle.sides) ? Math.min(this.timings.absentLimitMs, this.timings.turnLimitMs) : this.timings.turnLimitMs;
    phase.deadline = now() + ms;
    room.timer = setTimeout(() => {
      let events: BattleEvent[] | null = null;
      battle.sides.forEach((_, sideIndex) => {
        if (needsAction(battle, sideIndex)) {
          const action = autoAction(battle, sideIndex);
          if (action) events = submit(battle, sideIndex, action) || events;
        }
      });
      this.afterResolve(room, phase, events ?? [], true);
    }, ms);
    room.timer.unref();
  }

  private afterResolve(room: Room, phase: BattlePhase, events: BattleEvent[], timedOut = false): void {
    if (phase.battle.status === 'finished') this.finish(room, phase);
    else this.armTimer(room, phase);
    broadcast(room, { t: 'events', events, timedOut });
    if (!aiOnly(phase.battle) && this.playForcedMoves(room, phase)) return;
    this.nextAiTurn(room, phase);
  }

  private playForcedMoves(room: Room, phase: BattlePhase): boolean {
    const { battle } = phase;
    let events: BattleEvent[] | null = null;
    let submitted = false;
    battle.sides.forEach((_, sideIndex) => {
      const action = forcedAction(battle, sideIndex);
      if (!action) return;
      submitted = true;
      events = submit(battle, sideIndex, action) || events;
      const chosen = battle.sides[sideIndex].action;
      if (chosen) chosen.auto = true;
    });
    if (events) this.afterResolve(room, phase, events);
    else if (submitted) broadcast(room, { t: 'ready' });
    return !!events;
  }

  private finish(room: Room, phase: BattlePhase): void {
    clearTimeout(room.timer ?? undefined);
    phase.deadline = null;
    const { battle } = phase;
    const { challenge } = room;
    const winnerId = battle.winner !== null ? battle.sides[battle.winner].trainerId : null;
    challenge.finish({ winnerId, turns: battle.turn, final: publicState(battle), at: now() });
    if (battle.winner !== null && isHumanDuel(challenge))
      this.trainers.recordRankedResult(battle.sides[battle.winner].trainerId, battle.sides[1 - battle.winner].trainerId);
    this.challenges.save(challenge);
    this.lobby.notify();
    this.events.matchFinished({ challenge, winnerSide: battle.winner });
    setTimeout(() => this.presence.dropIfEmpty(room), FINISHED_ROOM_MS).unref();
  }
}

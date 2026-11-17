// A battle in a room, from the first turn to the result. The rules live in the combat context
// (pure functions over a BattleState); this service drives them: the turn timer, AI and Skynet
// turns, moves a fighter is locked into, and the result, which is the only thing stored.
import { Injectable, Logger } from '@nestjs/common';
import { aiLevelOf, chooseAction, JEV_LEVEL } from '../../combat/domain/ai.js';
import { autoAction, createBattle, forcedAction, needsAction, publicState, submit, type Action, type BattleEvent, type BattleState } from '../../combat/domain/battle.js';
import { chosenEntries, type PreviewState } from '../../combat/domain/team-preview.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { AppConfig, type ArenaTimings } from '../../shared/config/app-config.js';
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

/** A finished room stays this long for late viewers before it is dropped from memory. */
const FINISHED_ROOM_MS = 10 * 60_000;

const aiOnly = (battle: BattleState) => battle.sides.every((side) => aiLevelOf(side.trainerId));

@Injectable()
export class LiveBattleService {
  private readonly logger = new Logger(LiveBattleService.name);
  private readonly timings: ArenaTimings;

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

  /** The picks are in: the battle starts with the 3 each side chose. */
  start(room: Room, preview: PreviewState): void {
    const phase: BattlePhase = {
      kind: 'battle',
      battle: createBattle({
        id: room.challenge.id,
        sides: preview.sides.map((side, sideIndex) => ({ trainerId: side.trainerId, name: side.name, avatar: side.avatar ?? this.views.avatarOf(side.trainerId, room.challenge), entries: chosenEntries(preview, sideIndex) })),
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

  /** The client finished animating this turn (AI vs AI waits for viewers). */
  seen(ws: ClientConnection, turn: number): void {
    ws.seenTurn = Math.max(ws.seenTurn ?? 0, turn);
  }

  /** AI vs AI plays at a watchable pace and waits (a while) for viewers still animating a turn. */
  private nextAiTurn(room: Room, phase: BattlePhase): void {
    const { battle } = phase;
    if (!aiOnly(battle)) return this.aiTurn(room, phase);
    const turn = battle.turn;
    const since = now();
    const check = () => {
      if (room.phase !== phase) return;
      const waited = now() - since;
      const watching = [...room.sockets].filter((ws) => ws.open).map((ws) => ws.seenTurn);
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
      // Never let a Skynet bug become an unhandled rejection: the turn timer still plays for it.
      if (level === JEV_LEVEL) return void this.jevTurn(room, phase, sideIndex).catch((e) => this.logger.error(`Skynet: ${e}`));
      const action = chooseAction(battle, sideIndex, level) ?? autoAction(battle, sideIndex);
      if (!action) return;
      acted = true;
      events = submit(battle, sideIndex, action) || events;
    });
    if (events) this.afterResolve(room, phase, events);
    else if (acted) broadcast(room, { t: 'ready' });
  }

  // Jev answers over the network, so this side acts later. Meanwhile the rival may act, the turn
  // timer may play for Skynet, or the room may close: the answer only counts if nothing moved.
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
      // The turn timer still plays for Skynet.
      this.logger.warn(`Skynet: no se pudo jugar su acción (${error}).`);
      return;
    }
    if (events) this.afterResolve(room, phase, events);
    else broadcast(room, { t: 'ready' });
  }

  /** Turn timer: whoever has not chosen gets an automatic move, so a battle always ends. */
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

  /** Moves a player is locked into (a charge, a rampage…) play themselves. */
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
    // Only 1v1 between people counts for the ranking, which belongs to the trainers context.
    if (battle.winner !== null && isHumanDuel(challenge))
      this.trainers.recordRankedResult(battle.sides[battle.winner].trainerId, battle.sides[1 - battle.winner].trainerId);
    this.challenges.save(challenge);
    this.lobby.notify();
    if (challenge.tournamentId) this.events.matchFinished({ challenge, winnerSide: battle.winner });
    // Keep the finished room a while for late viewers, then drop it.
    setTimeout(() => {
      if (this.presence.rooms.get(challenge.id) === room && room.sockets.size === 0) this.presence.rooms.delete(challenge.id);
    }, FINISHED_ROOM_MS).unref();
  }
}

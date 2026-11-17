// A live match, step by step. Each challenge that is being played has a Room (presence.ts) that
// goes through:
//
//   ready check  →  countdown  →  preview (each side picks 3 of 6)  →  reveal  →  battle  →  finished
//   (1v1 rooms)                    AIs pick on their own                           turn timer, AI turns
//
// The battle rules live in the combat context (pure functions over a BattleState); this service
// only drives them: timers, AI turns, who may act, and what each client is shown. Nothing here is
// stored except the challenge itself, through its repository.
import { Injectable, Logger } from '@nestjs/common';
import { randomParty } from '../../combat/domain/random-party.js';
import { aiLevelOf, aiPicks, aiTrainerId, buildAiRandomParty, buildAiTeam, chooseAction, JEV_LEVEL } from '../../combat/domain/ai.js';
import { autoAction, createBattle, forcedAction, needsAction, publicState, submit, type Action, type BattleEvent, type BattleState } from '../../combat/domain/battle.js';
import { chosenEntries, createPreview, fillMissing, pick, picksNeeded, previewReady, type PreviewState } from '../../combat/domain/team-preview.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { AppConfig, type ArenaTimings } from '../../shared/config/app-config.js';
import { newId, now } from '../../shared/domain/clock.js';
import { conflict } from '../../shared/domain/errors.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { ChallengeRepository } from '../domain/arena.repositories.js';
import { Challenge, isHumanDuel, type BattleMode, type FinalBattleState } from '../domain/challenge.js';
import { aiName, pendingArrivals, viewersBehind, type TournamentLabel } from '../domain/tournament.js';
import { ArenaEvents } from './arena-events.js';
import { ArenaViews } from './arena-views.js';
import type { ClientConnection } from './connection.js';
import { LobbyService } from './lobby.service.js';
import { inRoom, Presence, someoneAbsent, type BattlePhase, type CountdownPhase, type PreviewPhase, type Room } from './presence.js';
import { broadcast, broadcastToViewers, frameFor, refuse, sideIn } from './room-frames.js';

/** A finished room stays this long for late viewers before it is dropped from memory. */
const FINISHED_ROOM_MS = 10 * 60_000;

/** The level the AI plays at when nothing caps it: the average of the rival's team. */
export function averageLevel(entries: RosterEntry[]): number {
  if (!entries.length) return 50;
  return Math.max(1, Math.min(100, Math.round(entries.reduce((sum, e) => sum + e.level, 0) / entries.length)));
}

@Injectable()
export class DuelService {
  private readonly logger = new Logger(DuelService.name);
  private readonly timings: ArenaTimings;

  constructor(
    config: AppConfig,
    private readonly challenges: ChallengeRepository,
    private readonly trainers: TrainersService,
    private readonly presence: Presence,
    private readonly views: ArenaViews,
    private readonly lobby: LobbyService,
    private readonly events: ArenaEvents,
    private readonly skynet: SkynetService,
  ) {
    this.timings = config.timings;
  }

  // ---------- starting matches ----------

  /** A battle against the AI: no waiting room, straight to the preview. */
  startAgainstAi(trainer: Trainer, { mode, levelCap, level }: { mode: BattleMode; levelCap: number | null; level: string }): Challenge {
    const hostTeam = mode === 'random' ? randomParty(trainer.roster) : trainer.teamSnapshot();
    const aiLevel = levelCap ?? averageLevel(hostTeam);
    const aiTeam = mode === 'random' ? buildAiRandomParty({ level: aiLevel }) : buildAiTeam({ difficulty: level, level: aiLevel });
    const challenge = Challenge.againstAi({
      id: newId(),
      host: trainer,
      hostTeam,
      ai: { id: aiTrainerId(level), name: aiName(level).name, level },
      aiTeam,
      levelCap,
      mode,
      at: now(),
    });
    this.challenges.save(challenge);
    this.openPreview(this.presence.room(challenge));
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
      players: [this.views.countdownPlayer(challenge.hostId, challenge.hostName), this.views.countdownPlayer(guest.id, guest.name)],
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

  /** Both players are here and ready (or it's a tournament match): the countdown starts. */
  startCountdown(challenge: Challenge, tournament: TournamentLabel | null = null): void {
    const room = this.presence.room(challenge);
    const phase: CountdownPhase = {
      kind: 'countdown',
      startedAt: now(),
      endsAt: now() + this.timings.countdownMs,
      players: [
        this.views.countdownPlayer(challenge.hostId, challenge.hostName),
        this.views.countdownPlayer(challenge.guestId!, challenge.guestName!),
      ],
      tournament,
      waiting: null,
    };
    room.phase = phase;
    setTimeout(() => this.openWhenArrived(room, phase), this.timings.countdownMs);
    broadcast(room, { t: 'countdown' });
  }

  // ---------- ready check and countdown ----------

  private setRoomReady(room: Room, trainerId: string | null, ready: boolean): void {
    const check = room.phase;
    if (check.kind !== 'readyCheck' || !trainerId || !check.players.some((p) => p.id === trainerId)) return;
    if (ready) check.ready.add(trainerId);
    else check.ready.delete(trainerId);
    if (check.players.every((p) => check.ready.has(p.id))) this.startCountdown(room.challenge);
    else broadcast(room, { t: 'lobby' });
  }

  /** The guest left during the ready check: the room goes back to waiting for a rival. */
  private reopenRoom(room: Room): void {
    if (room.phase.kind !== 'readyCheck') return;
    const { challenge } = room;
    room.phase = { kind: 'waiting' };
    challenge.reopen();
    this.challenges.save(challenge);
    for (const ws of room.sockets) if (ws.open) ws.send({ t: 'reopened', host: ws.trainerId === challenge.hostId });
    this.lobby.notify();
  }

  /** People who follow a tournament: in its page or in the room of one of its matches. */
  private tournamentFollowers(tournamentId: string): string[] {
    const ids = new Set<string>();
    for (const ws of this.presence.tournamentAudience(tournamentId)) if (ws.open && ws.trainerId) ids.add(ws.trainerId);
    return [...ids].filter((id) => !aiLevelOf(id));
  }

  /** In a tournament, the preview waits (a while) until players and followers reach the room. */
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
    if (challenge.status === 'active') this.openPreview(room);
    else room.phase = { kind: 'waiting' };
  }

  // ---------- preview ----------

  /** Each side picks 3 of 6; an AI side picks on its own. */
  private openPreview(room: Room): void {
    const { challenge } = room;
    const phase: PreviewPhase = {
      kind: 'preview',
      preview: createPreview({
        levelCap: challenge.levelCap,
        mode: challenge.mode,
        sides: [
          { trainerId: challenge.hostId, name: this.views.nameOf(challenge.hostId, challenge.hostName)!, entries: challenge.hostTeam },
          { trainerId: challenge.guestId!, name: this.views.nameOf(challenge.guestId, challenge.guestName)!, entries: challenge.guestTeam! },
        ],
      }),
      deadline: null,
      short: false,
    };
    room.phase = phase;
    this.armPreviewTimer(room, phase, challenge.mode === 'random' ? this.timings.diceRollBonusMs : 0);
    broadcast(room, { t: 'preview' });
    phase.preview.sides.forEach((side, sideIndex) => {
      const level = aiLevelOf(side.trainerId);
      if (level) this.scheduleAiPick(room, phase, sideIndex, level);
    });
  }

  private armPreviewTimer(room: Room, phase: PreviewPhase, extraMs = 0): void {
    clearTimeout(room.timer ?? undefined);
    phase.short = someoneAbsent(room, phase.preview.sides);
    const ms = (phase.short ? Math.min(this.timings.absentLimitMs, this.timings.pickLimitMs) : this.timings.pickLimitMs) + extraMs;
    phase.deadline = now() + ms;
    room.timer = setTimeout(() => {
      if (room.phase !== phase) return;
      fillMissing(phase.preview);
      this.revealPicks(room, phase);
    }, ms);
    room.timer.unref();
  }

  /** The AI marks its picks one by one (viewers see them), then confirms. */
  private scheduleAiPick(room: Room, phase: PreviewPhase, sideIndex: number, level: string): void {
    const { preview } = phase;
    const choice = aiPicks({ difficulty: level, own: preview.sides[sideIndex].entries });
    const still = () => room.phase === phase && !preview.sides[sideIndex].picks;
    const step = this.timings.aiPickMs / (choice.length + 1);
    choice.forEach((_, i) => {
      setTimeout(
        () => {
          if (!still()) return;
          preview.sides[sideIndex].draft = choice.slice(0, i + 1);
          broadcastToViewers(room, preview);
        },
        this.timings.diceAnimationMs + step * (i + 1),
      ).unref();
    });
    setTimeout(() => {
      if (!still()) return;
      pick(preview, sideIndex, choice);
      if (previewReady(preview)) this.revealPicks(room, phase);
      else broadcast(room, { t: 'preview' });
    }, this.timings.diceAnimationMs + this.timings.aiPickMs).unref();
  }

  /** Both sides chose: everyone sees the 3 of each side for a moment, then the battle starts. */
  private revealPicks(room: Room, phase: PreviewPhase): void {
    if (phase.preview.revealed) return;
    if (this.timings.revealMs <= 0) return this.startBattle(room, phase.preview);
    clearTimeout(room.timer ?? undefined);
    phase.preview.revealed = true;
    phase.deadline = now() + this.timings.revealMs;
    broadcast(room, { t: 'preview' });
    room.timer = setTimeout(() => room.phase === phase && this.startBattle(room, phase.preview), this.timings.revealMs);
    room.timer.unref();
  }

  // ---------- battle ----------

  private startBattle(room: Room, preview: PreviewState): void {
    const phase: BattlePhase = {
      kind: 'battle',
      battle: createBattle({
        id: room.challenge.id,
        levelCap: preview.levelCap,
        sides: preview.sides.map((side, s) => ({ trainerId: side.trainerId, name: side.name, entries: chosenEntries(preview, s) })),
      }),
      deadline: null,
      jevAsked: new Set(),
    };
    room.phase = phase;
    this.armTimer(room, phase);
    broadcast(room, { t: 'start' });
    this.nextAiTurn(room, phase);
  }

  private aiOnly = (battle: BattleState) => battle.sides.every((side) => aiLevelOf(side.trainerId));

  /** AI vs AI plays at a watchable pace and waits (a while) for viewers still animating a turn. */
  private nextAiTurn(room: Room, phase: BattlePhase): void {
    const { battle } = phase;
    if (!this.aiOnly(battle)) return this.aiTurn(room, phase);
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
    if (phase.battle.status === 'finished') this.finishBattle(room, phase);
    else this.armTimer(room, phase);
    broadcast(room, { t: 'events', events, timedOut });
    if (!this.aiOnly(phase.battle) && this.playForcedMoves(room, phase)) return;
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

  private finishBattle(room: Room, phase: BattlePhase): void {
    clearTimeout(room.timer ?? undefined);
    phase.deadline = null;
    const { battle } = phase;
    const { challenge } = room;
    const winnerId = battle.winner !== null ? battle.sides[battle.winner].trainerId : null;
    challenge.finish({ winnerId, turns: battle.turn, final: publicState(battle) as unknown as FinalBattleState, at: now() });
    // Only 1v1 between people counts for the ranking, which belongs to the trainers context.
    if (battle.winner !== null && isHumanDuel(challenge))
      this.trainers.recordRankedResult(battle.sides[battle.winner].trainerId, battle.sides[1 - battle.winner].trainerId);
    this.challenges.save(challenge);
    if (challenge.tournamentId) this.events.matchFinished({ challenge, winnerSide: battle.winner });
    // Keep the finished room a while for late viewers, then drop it.
    setTimeout(() => {
      if (this.presence.rooms.get(challenge.id) === room && room.sockets.size === 0) this.presence.rooms.delete(challenge.id);
    }, FINISHED_ROOM_MS).unref();
  }

  // ---------- messages from a client in a room ----------

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
    const { phase } = room;
    if (phase.kind === 'preview'
      && !phase.preview.revealed
      && phase.short
      && sideIn(phase.preview.sides, ws.trainerId) !== null
      && !someoneAbsent(room, phase.preview.sides))
      this.armPreviewTimer(room, phase);
    if (phase.kind === 'waiting' || phase.kind === 'countdown') ws.send(frameFor(room, ws, { t: 'presence' }));
    else broadcast(room, { t: 'presence' });
    return challenge;
  }

  /** A client in a room disconnected. */
  left(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    if (!room) return;
    const { challenge } = room;
    room.sockets.delete(ws);
    if (ws.trainerId === challenge.hostId) this.lobby.notify();
    const { phase } = room;
    if (phase.kind === 'readyCheck' && phase.players.some((p) => p.id === ws.trainerId)) {
      broadcast(room, { t: 'lobby' });
      setTimeout(() => {
        if (room.phase.kind !== 'readyCheck' || inRoom(room, ws.trainerId)) return;
        if (ws.trainerId === challenge.hostId) this.close(challenge, challenge.hostId);
        else this.reopenRoom(room);
      }, this.timings.seatGraceMs).unref();
    }
    if (phase.kind === 'battle' || phase.kind === 'preview') broadcast(room, { t: 'presence' });
    if (phase.kind === 'waiting' && room.sockets.size === 0) this.presence.rooms.delete(challenge.id);
  }

  setReady(ws: ClientConnection, ready: boolean): void {
    const room = this.presence.roomOf(ws);
    if (room) this.setRoomReady(room, ws.trainerId, ready);
  }

  /** The guest walks out of the ready check. */
  leaveReadyCheck(ws: ClientConnection): void {
    const room = this.presence.roomOf(ws);
    if (room?.phase.kind === 'readyCheck' && room.challenge.guestId === ws.trainerId) this.reopenRoom(room);
  }

  seen(ws: ClientConnection, turn: number): void {
    ws.seenTurn = Math.max(ws.seenTurn ?? 0, turn);
  }

  /** A player is marking picks (not confirmed yet): viewers see the draft live. */
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
    if (previewReady(phase.preview)) this.revealPicks(room, phase);
    else broadcast(room, { t: 'preview' });
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

  /** Who is talking in a room's chat: a player (and which side) or a viewer. */
  chatRole(ws: ClientConnection, trainerId: string, isTournamentPlayer: (tournamentId: string) => boolean) {
    const room = this.presence.roomOf(ws);
    if (!room) return null;
    const { challenge, phase } = room;
    const side = phase.kind === 'battle' ? sideIn(phase.battle.sides, trainerId) : phase.kind === 'preview' ? sideIn(phase.preview.sides, trainerId) : null;
    const player = challenge.tournamentId ? isTournamentPlayer(challenge.tournamentId) : challenge.isPlayer(trainerId);
    return { challenge, role: player ? ('player' as const) : ('watcher' as const), side };
  }
}

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
import { autoAction, createBattle, forcedAction, needsAction, publicState, submit, validActions, viewEvents, type Action, type BattleEvent, type BattleState } from '../../combat/domain/battle.js';
import { chosenEntries, createPreview, fillMissing, pick, picksNeeded, previewReady, previewView } from '../../combat/domain/team-preview.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import type { RosterEntry } from '../../catalog/domain/roster-entry.js';
import { AppConfig, type ArenaTimings } from '../../shared/config/app-config.js';
import { newId, now } from '../../shared/domain/clock.js';
import { conflict, DomainError } from '../../shared/domain/errors.js';
import { TrainersService } from '../../trainers/application/trainers.service.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { ChallengeRepository } from '../domain/arena.repositories.js';
import { Challenge, type BattleMode, type FinalBattleState } from '../domain/challenge.js';
import { aiName, pendingArrivals, viewersBehind, type TournamentLabel } from '../domain/tournament.js';
import { ArenaEvents } from './arena-events.js';
import { ArenaViews } from './arena-views.js';
import type { ClientConnection } from './connection.js';
import { LobbyService } from './lobby.service.js';
import { Presence, type Room } from './presence.js';

type Frame = Record<string, unknown> & { t?: string; events?: BattleEvent[] };

/** A finished room stays this long for late viewers before it is dropped from memory. */
const FINISHED_ROOM_MS = 10 * 60_000;

function sideIn(sides: { trainerId: string }[], trainerId: string | null | undefined): number | null {
  if (!trainerId) return null;
  const index = sides.findIndex((s) => s.trainerId === trainerId);
  return index === -1 ? null : index;
}

const sideOf = (battle: BattleState | null, trainerId: string | null | undefined) => (battle ? sideIn(battle.sides, trainerId) : null);

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
    const room = this.presence.room(challenge.id);
    room.preview = createPreview({
      levelCap,
      mode,
      sides: [
        { trainerId: trainer.id, name: trainer.name, entries: hostTeam },
        { trainerId: challenge.guestId!, name: challenge.guestName!, entries: aiTeam },
      ],
    });
    this.armPreviewTimer(challenge.id, room, mode === 'random' ? this.timings.diceRollBonusMs : 0);
    this.scheduleAiPick(challenge.id, room, 1, level);
    return challenge;
  }

  /** A random battle rolls the host's party when someone joins: a host with no Pokémon left can't be joined. */
  joinable(challenge: Challenge): boolean {
    return challenge.battleMode !== 'random' || !!this.trainers.byId(challenge.hostId)?.roster.length;
  }

  /** Someone takes the free seat of an open room. */
  join(challenge: Challenge, guest: Trainer): void {
    if (!this.joinable(challenge)) throw conflict('El anfitrión ya no tiene Pokémon.');
    if (challenge.battleMode === 'random') {
      challenge.join(guest, { hostTeam: randomParty(this.trainers.byId(challenge.hostId)!.roster), guestTeam: randomParty(guest.roster) });
    } else challenge.join(guest, { guestTeam: guest.teamSnapshot() });
    this.challenges.save(challenge);
    const room = this.presence.room(challenge.id);
    room.readyCheck = {
      ready: new Set(),
      players: [this.views.countdownPlayer(challenge.hostId, challenge.hostName), this.views.countdownPlayer(guest.id, guest.name)],
    };
    this.broadcast(room, { t: 'lobby' });
    this.lobby.notify();
  }

  /** The host closes the room (or leaves it): everyone inside is told. */
  close(challenge: Challenge): void {
    const room = this.presence.rooms.get(challenge.id);
    if (room?.readyCheck) room.readyCheck = null;
    challenge.cancel();
    this.challenges.save(challenge);
    if (room) for (const ws of room.sockets) if (ws.open) ws.send({ t: 'closed' });
    this.lobby.notify();
  }

  /** Both players are here and ready (or it's a tournament match): the countdown starts. */
  startCountdown(challenge: Challenge, tournament: TournamentLabel | null = null): void {
    const room = this.presence.room(challenge.id);
    room.readyCheck = null;
    room.countdown = {
      startedAt: now(),
      endsAt: now() + this.timings.countdownMs,
      players: [
        this.views.countdownPlayer(challenge.hostId, challenge.hostName),
        this.views.countdownPlayer(challenge.guestId!, challenge.guestName!),
      ],
      tournament,
    };
    setTimeout(() => this.openWhenArrived(challenge, room), this.timings.countdownMs);
    this.broadcast(room, { t: 'countdown' });
  }

  // ---------- what each client sees ----------

  private previewFrame(room: Room, ws: ClientConnection, extra: Frame): Frame {
    const preview = room.preview!;
    const you = sideIn(preview.sides, ws.trainerId);
    return {
      ...extra,
      t: extra.t === 'presence' || extra.t === 'ready' ? 'preview' : extra.t,
      preview: previewView(preview, you),
      you,
      deadline: room.deadline,
      watchers: room.sockets.size,
    };
  }

  frameFor(room: Room, ws: ClientConnection, extra: Frame = {}): Frame {
    if (room.readyCheck) {
      const { players, ready } = room.readyCheck;
      const you = players.findIndex((p) => p.id === ws.trainerId);
      return {
        t: 'lobby',
        players: players.map((p) => ({ ...p, ready: ready.has(p.id), online: this.presence.inRoom(room, p.id) })),
        you: you === -1 ? null : you,
      };
    }
    if (room.countdown) {
      const you = room.countdown.players.findIndex((p) => p.id === ws.trainerId);
      return {
        ...extra,
        t: 'countdown',
        ms: Math.max(0, room.countdown.endsAt - now()),
        players: room.countdown.players,
        you: you === -1 ? null : you,
        tournament: room.countdown.tournament ?? null,
        waiting: room.countdown.waiting ?? null,
      };
    }
    if (room.preview) return this.previewFrame(room, ws, extra);
    const battle = room.battle!;
    const you = sideOf(battle, ws.trainerId);
    return {
      ...extra,
      ...(extra.events ? { events: viewEvents(extra.events, you) } : {}),
      state: publicState(battle, you),
      you,
      actions: you === null ? [] : validActions(battle, you),
      forced: you !== null && !!battle.sides[you].action?.auto,
      deadline: room.deadline,
      watchers: room.sockets.size,
    };
  }

  broadcast(room: Room, extra: Frame): void {
    for (const ws of room.sockets) if (ws.open) ws.send(this.frameFor(room, ws, extra));
  }

  /** Viewers (not the players) see each side's draft as it is marked. */
  private broadcastWatchers(room: Room): void {
    for (const ws of room.sockets)
      if (ws.open && (!room.preview || sideIn(room.preview.sides, ws.trainerId) === null)) ws.send(this.frameFor(room, ws, { t: 'preview' }));
  }

  // ---------- ready check and countdown ----------

  private setRoomReady(challenge: Challenge, room: Room, trainerId: string | null, ready: boolean): void {
    const check = room.readyCheck;
    if (!trainerId || !check?.players.some((p) => p.id === trainerId)) return;
    if (ready) check.ready.add(trainerId);
    else check.ready.delete(trainerId);
    if (check.players.every((p) => check.ready.has(p.id))) this.startCountdown(challenge);
    else this.broadcast(room, { t: 'lobby' });
  }

  /** The guest left during the ready check: the room goes back to waiting for a rival. */
  private reopenRoom(challenge: Challenge, room: Room): void {
    if (!room.readyCheck) return;
    room.readyCheck = null;
    challenge.reopen();
    this.challenges.save(challenge);
    for (const ws of room.sockets) if (ws.open) ws.send({ t: 'reopened', host: ws.trainerId === challenge.hostId });
    this.lobby.notify();
  }

  /** People who follow a tournament: in its page or in the room of one of its matches. */
  private tournamentFollowers(tournamentId: string): string[] {
    const ids = new Set<string>();
    for (const ws of this.presence.tournamentSockets(tournamentId)) if (ws.open && ws.trainerId) ids.add(ws.trainerId);
    for (const [id, room] of this.presence.rooms) {
      if (this.challenges.findById(id)?.tournamentId !== tournamentId) continue;
      for (const ws of room.sockets) if (ws.open && ws.trainerId) ids.add(ws.trainerId);
    }
    return [...ids].filter((id) => !aiLevelOf(id));
  }

  /** In a tournament, the preview waits (a while) until players and followers reach the room. */
  private openWhenArrived(challenge: Challenge, room: Room): void {
    if (!room.countdown) return;
    const pending = challenge.tournamentId
      ? pendingArrivals({
          players: [challenge.hostId, challenge.guestId!].filter((id) => !aiLevelOf(id)),
          followers: this.tournamentFollowers(challenge.tournamentId),
          present: [...room.sockets].filter((ws) => ws.open).map((ws) => ws.trainerId),
        })
      : [];
    if (pending.length && now() - room.countdown.startedAt < this.timings.countdownMs + this.timings.arrivalWaitMs) {
      const waiting = pending.map((id) => this.trainers.byId(id)?.name ?? '…');
      const changed = JSON.stringify(waiting) !== JSON.stringify(room.countdown.waiting);
      room.countdown.waiting = waiting;
      room.countdown.endsAt = now();
      if (changed) this.broadcast(room, { t: 'countdown' });
      setTimeout(() => this.openWhenArrived(challenge, room), 500);
      return;
    }
    this.openPreview(challenge, room);
  }

  // ---------- preview ----------

  private openPreview(challenge: Challenge, room: Room): void {
    room.countdown = null;
    if (challenge.status !== 'active') return;
    const preview = createPreview({
      levelCap: challenge.levelCap,
      mode: challenge.battleMode,
      sides: [
        { trainerId: challenge.hostId, name: this.views.nameOf(challenge.hostId, challenge.hostName)!, entries: challenge.hostTeam },
        { trainerId: challenge.guestId!, name: this.views.nameOf(challenge.guestId, challenge.guestName)!, entries: challenge.guestTeam! },
      ],
    });
    room.preview = preview;
    this.armPreviewTimer(challenge.id, room, challenge.battleMode === 'random' ? this.timings.diceRollBonusMs : 0);
    this.broadcast(room, { t: 'preview' });
    preview.sides.forEach((side, sideIndex) => {
      const level = aiLevelOf(side.trainerId);
      if (level) this.scheduleAiPick(challenge.id, room, sideIndex, level);
    });
  }

  /** Is a tournament player missing from the room? Then timers run short so nobody waits forever. */
  private someoneAbsent(id: string, room: Room, sides: { trainerId: string }[]): boolean {
    if (!this.challenges.findById(id)?.tournamentId) return false;
    return sides.some((side) => !aiLevelOf(side.trainerId) && ![...room.sockets].some((ws) => ws.trainerId === side.trainerId && ws.open));
  }

  private armPreviewTimer(id: string, room: Room, extraMs = 0): void {
    clearTimeout(room.timer ?? undefined);
    const preview = room.preview!;
    room.previewShort = this.someoneAbsent(id, room, preview.sides);
    const ms = (room.previewShort ? Math.min(this.timings.absentLimitMs, this.timings.pickLimitMs) : this.timings.pickLimitMs) + extraMs;
    room.deadline = now() + ms;
    room.timer = setTimeout(() => {
      if (!room.preview) return;
      fillMissing(room.preview);
      this.revealPicks(id, room);
    }, ms);
    room.timer.unref();
  }

  /** The AI marks its picks one by one (viewers see them), then confirms. */
  private scheduleAiPick(id: string, room: Room, sideIndex: number, level: string): void {
    const preview = room.preview!;
    const choice = aiPicks({ difficulty: level, own: preview.sides[sideIndex].entries });
    const still = () => room.preview === preview && !preview.sides[sideIndex].picks;
    const step = this.timings.aiPickMs / (choice.length + 1);
    choice.forEach((_, i) => {
      setTimeout(
        () => {
          if (!still()) return;
          preview.sides[sideIndex].draft = choice.slice(0, i + 1);
          this.broadcastWatchers(room);
        },
        this.timings.diceAnimationMs + step * (i + 1),
      ).unref();
    });
    setTimeout(() => {
      if (!still()) return;
      pick(preview, sideIndex, choice);
      if (previewReady(preview)) this.revealPicks(id, room);
      else this.broadcast(room, { t: 'preview' });
    }, this.timings.diceAnimationMs + this.timings.aiPickMs).unref();
  }

  /** Both sides chose: everyone sees the 3 of each side for a moment, then the battle starts. */
  private revealPicks(id: string, room: Room): void {
    if (!room.preview || room.preview.revealed) return;
    if (this.timings.revealMs <= 0) return this.startBattle(id, room);
    clearTimeout(room.timer ?? undefined);
    room.preview.revealed = true;
    room.deadline = now() + this.timings.revealMs;
    this.broadcast(room, { t: 'preview' });
    room.timer = setTimeout(() => room.preview && this.startBattle(id, room), this.timings.revealMs);
    room.timer.unref();
  }

  // ---------- battle ----------

  private startBattle(id: string, room: Room): void {
    const preview = room.preview!;
    room.preview = null;
    room.battle = createBattle({
      id,
      levelCap: preview.levelCap,
      sides: preview.sides.map((side, s) => ({ trainerId: side.trainerId, name: side.name, entries: chosenEntries(preview, s) })),
    });
    this.armTimer(id, room);
    this.broadcast(room, { t: 'start' });
    this.nextAiTurn(id, room);
  }

  private aiOnly = (battle: BattleState) => battle.sides.every((side) => aiLevelOf(side.trainerId));

  /** AI vs AI plays at a watchable pace and waits (a while) for viewers still animating a turn. */
  private nextAiTurn(id: string, room: Room): void {
    const battle = room.battle;
    if (!battle || !this.aiOnly(battle)) return this.aiTurn(id, room);
    const turn = battle.turn;
    const since = now();
    const check = () => {
      if (room.battle !== battle) return;
      const waited = now() - since;
      const watching = [...room.sockets].filter((ws) => ws.open).map((ws) => ws.seenTurn);
      if (waited >= this.timings.aiVsAiPauseMs && (waited >= this.timings.aiVsAiViewerWaitMs || !viewersBehind(watching, turn)))
        return this.aiTurn(id, room);
      setTimeout(check, 250).unref();
    };
    setTimeout(check, Math.min(this.timings.aiVsAiPauseMs, 250)).unref();
  }

  private aiTurn(id: string, room: Room): void {
    const battle = room.battle;
    if (!battle || battle.status !== 'active') return;
    let events: BattleEvent[] | null = null;
    let acted = false;
    battle.sides.forEach((side, sideIndex) => {
      const level = aiLevelOf(side.trainerId);
      if (!level || !needsAction(battle, sideIndex)) return;
      // Never let a Skynet bug become an unhandled rejection: the turn timer still plays for it.
      if (level === JEV_LEVEL) return void this.jevTurn(id, room, sideIndex).catch((e) => this.logger.error(`Skynet: ${e}`));
      const action = chooseAction(battle, sideIndex, level) ?? autoAction(battle, sideIndex);
      if (!action) return;
      acted = true;
      events = submit(battle, sideIndex, action) || events;
    });
    if (events) this.afterResolve(id, room, events);
    else if (acted) this.broadcast(room, { t: 'ready' });
  }

  // Jev answers over the network, so this side acts later. Meanwhile the rival may act, the turn
  // timer may play for Skynet, or the room may close: the answer only counts if nothing moved.
  private async jevTurn(id: string, room: Room, sideIndex: number): Promise<void> {
    const battle = room.battle!;
    const at = `${battle.turn}:${battle.phase}`;
    room.jevAsked ??= new Set();
    if (room.jevAsked.has(at)) return;
    room.jevAsked.add(at);
    const picked = await this.skynet.choose(battle, sideIndex);
    room.jevAsked.delete(at);
    if (room.battle !== battle || battle.status !== 'active' || `${battle.turn}:${battle.phase}` !== at || !needsAction(battle, sideIndex)) return;
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
    if (events) this.afterResolve(id, room, events);
    else this.broadcast(room, { t: 'ready' });
  }

  /** Turn timer: whoever has not chosen gets an automatic move, so a battle always ends. */
  private armTimer(id: string, room: Room): void {
    clearTimeout(room.timer ?? undefined);
    room.timer = null;
    room.deadline = null;
    const battle = room.battle;
    if (!battle || battle.status !== 'active') return;
    const ms = this.someoneAbsent(id, room, battle.sides) ? Math.min(this.timings.absentLimitMs, this.timings.turnLimitMs) : this.timings.turnLimitMs;
    room.deadline = now() + ms;
    room.timer = setTimeout(() => {
      let events: BattleEvent[] | null = null;
      battle.sides.forEach((_, sideIndex) => {
        if (needsAction(battle, sideIndex)) {
          const action = autoAction(battle, sideIndex);
          if (action) events = submit(battle, sideIndex, action) || events;
        }
      });
      this.afterResolve(id, room, events ?? [], true);
    }, ms);
    room.timer.unref();
  }

  private afterResolve(id: string, room: Room, events: BattleEvent[], timedOut = false): void {
    const battle = room.battle!;
    if (battle.status === 'finished') this.finishBattle(id, room);
    else this.armTimer(id, room);
    this.broadcast(room, { t: 'events', events, timedOut });
    if (!this.aiOnly(battle) && this.playForcedMoves(id, room)) return;
    this.nextAiTurn(id, room);
  }

  /** Moves a player is locked into (a charge, a rampage…) play themselves. */
  private playForcedMoves(id: string, room: Room): boolean {
    const battle = room.battle!;
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
    if (events) this.afterResolve(id, room, events);
    else if (submitted) this.broadcast(room, { t: 'ready' });
    return !!events;
  }

  private finishBattle(id: string, room: Room): void {
    clearTimeout(room.timer ?? undefined);
    room.deadline = null;
    const battle = room.battle!;
    const challenge = this.challenges.findById(id);
    if (!challenge || challenge.status !== 'active') return;
    const winnerId = battle.winner !== null ? battle.sides[battle.winner].trainerId : null;
    challenge.finish({ winnerId, turns: battle.turn, final: publicState(battle) as unknown as FinalBattleState, at: now() });
    // Only 1v1 between people counts for the ranking, which belongs to the trainers context.
    if (battle.winner !== null && challenge.ranked)
      this.trainers.recordRankedResult(battle.sides[battle.winner].trainerId, battle.sides[1 - battle.winner].trainerId);
    this.challenges.save(challenge);
    if (challenge.tournamentId) this.events.matchFinished({ challenge, winnerSide: battle.winner });
    // Keep the finished room a while for late viewers, then drop it.
    setTimeout(() => {
      const cur = this.presence.rooms.get(id);
      if (cur === room && room.sockets.size === 0) this.presence.rooms.delete(id);
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
    const room = this.presence.room(challenge.id);
    room.sockets.add(ws);
    if (ws.trainerId === challenge.hostId && challenge.status === 'open') this.lobby.notify();
    if (room.preview
      && !room.preview.revealed
      && room.previewShort
      && sideIn(room.preview.sides, ws.trainerId) !== null
      && !this.someoneAbsent(challenge.id, room, room.preview.sides))
      this.armPreviewTimer(challenge.id, room);
    if (room.battle || room.preview || room.readyCheck) this.broadcast(room, { t: 'presence' });
    else if (room.countdown) ws.send(this.frameFor(room, ws));
    else ws.send({ t: 'waiting', watchers: room.sockets.size });
    return challenge;
  }

  /** A client in a room disconnected. */
  left(ws: ClientConnection): void {
    const challenge = ws.roomId ? this.challenges.findById(ws.roomId) : undefined;
    const room = ws.roomId ? this.presence.rooms.get(ws.roomId) : undefined;
    if (!challenge || !room) return;
    room.sockets.delete(ws);
    if (ws.trainerId === challenge.hostId) this.lobby.notify();
    if (room.readyCheck && room.readyCheck.players.some((p) => p.id === ws.trainerId)) {
      this.broadcast(room, { t: 'lobby' });
      setTimeout(() => {
        if (!room.readyCheck || this.presence.inRoom(room, ws.trainerId)) return;
        if (ws.trainerId === challenge.hostId) this.close(challenge);
        else this.reopenRoom(challenge, room);
      }, this.timings.seatGraceMs).unref();
    }
    if (room.battle || room.preview) this.broadcast(room, { t: 'presence' });
    if (!room.battle && !room.preview && !room.countdown && !room.readyCheck && room.sockets.size === 0) this.presence.rooms.delete(challenge.id);
  }

  setReady(ws: ClientConnection, ready: boolean): void {
    const room = this.presence.rooms.get(ws.roomId!);
    const challenge = this.challenges.findById(ws.roomId!);
    if (room && challenge) this.setRoomReady(challenge, room, ws.trainerId, ready);
  }

  /** The guest walks out of the ready check. */
  leaveReadyCheck(ws: ClientConnection): void {
    const room = this.presence.rooms.get(ws.roomId!);
    const challenge = this.challenges.findById(ws.roomId!);
    if (room?.readyCheck && challenge?.guestId === ws.trainerId) this.reopenRoom(challenge!, room);
  }

  seen(ws: ClientConnection, turn: number): void {
    ws.seenTurn = Math.max(ws.seenTurn ?? 0, turn);
  }

  /** A player is marking picks (not confirmed yet): viewers see the draft live. */
  choosing(ws: ClientConnection, picks: number[]): void {
    const room = this.presence.rooms.get(ws.roomId!);
    if (!room?.preview || room.preview.revealed) return;
    const sideIndex = sideIn(room.preview.sides, ws.trainerId);
    if (sideIndex === null || room.preview.sides[sideIndex].picks) return;
    const side = room.preview.sides[sideIndex];
    side.draft = [...new Set(picks)].filter((i) => i >= 0 && i < side.entries.length).slice(0, picksNeeded(room.preview, sideIndex));
    this.broadcastWatchers(room);
  }

  pick(ws: ClientConnection, picks: number[]): void {
    const room = this.presence.rooms.get(ws.roomId!);
    if (!room?.preview) return;
    const sideIndex = sideIn(room.preview.sides, ws.trainerId);
    if (sideIndex === null) return;
    try {
      pick(room.preview, sideIndex, picks);
    } catch (error) {
      return this.refuse(ws, error);
    }
    if (previewReady(room.preview)) this.revealPicks(ws.roomId!, room);
    else this.broadcast(room, { t: 'preview' });
  }

  act(ws: ClientConnection, action: Action | null): void {
    const room = this.presence.rooms.get(ws.roomId!);
    if (!room?.battle || room.battle.status !== 'active') return;
    const sideIndex = sideOf(room.battle, ws.trainerId);
    if (sideIndex === null) return;
    let events: BattleEvent[] | null;
    try {
      events = submit(room.battle, sideIndex, action);
    } catch (error) {
      return this.refuse(ws, error);
    }
    if (events) this.afterResolve(ws.roomId!, room, events);
    else this.broadcast(room, { t: 'ready' });
  }

  /**
   * A rule said no: the player reads why. Anything else is an engine bug: it goes to the log, and the
   * player still gets an error frame (the client only shows frames with a `t`), never a stuck screen.
   */
  private refuse(ws: ClientConnection, error: unknown): void {
    if (error instanceof DomainError) return ws.send({ t: 'error', error: error.message });
    this.logger.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    ws.send({ t: 'error', error: 'Algo falló en el servidor. Intenta de nuevo.' });
  }

  /** Who is talking in a room's chat: a player (and which side) or a viewer. */
  chatRole(ws: ClientConnection, trainerId: string, isTournamentPlayer: (tournamentId: string) => boolean) {
    const challenge = this.challenges.findById(ws.roomId!);
    const room = this.presence.rooms.get(ws.roomId!);
    if (!challenge) return null;
    const side = room?.battle ? sideOf(room.battle, trainerId) : room?.preview ? sideIn(room.preview.sides, trainerId) : null;
    const player = challenge.tournamentId ? isTournamentPlayer(challenge.tournamentId) : challenge.isPlayer(trainerId);
    return { challenge, role: player ? ('player' as const) : ('watcher' as const), side };
  }
}

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
  const i = sides.findIndex((s) => s.trainerId === trainerId);
  return i === -1 ? null : i;
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
    const c = Challenge.againstAi({ id: newId(), host: trainer, hostTeam, ai: { id: aiTrainerId(level), name: aiName(level).name, level }, aiTeam, levelCap, mode, at: now() });
    this.challenges.save(c);
    const r = this.presence.room(c.id);
    r.preview = createPreview({
      levelCap,
      mode,
      sides: [
        { trainerId: trainer.id, name: trainer.name, entries: hostTeam },
        { trainerId: c.guestId!, name: c.guestName!, entries: aiTeam },
      ],
    });
    this.armPreviewTimer(c.id, r, mode === 'random' ? this.timings.diceRollBonusMs : 0);
    this.scheduleAiPick(c.id, r, 1, level);
    return c;
  }

  /** Someone takes the free seat of an open room. Returns why not, or null. */
  join(c: Challenge, guest: Trainer): string | null {
    const host = this.trainers.byId(c.hostId);
    if (c.mode === 'random') {
      if (!host?.roster.length) return 'El anfitrión ya no tiene Pokémon.';
      c.join(guest, { hostTeam: randomParty(host.roster), guestTeam: randomParty(guest.roster) });
    } else c.join(guest, { guestTeam: guest.teamSnapshot() });
    this.challenges.save(c);
    const r = this.presence.room(c.id);
    r.readyCheck = { ready: new Set(), players: [this.views.countdownPlayer(c.hostId, c.hostName), this.views.countdownPlayer(guest.id, guest.name)] };
    this.broadcast(r, { t: 'lobby' });
    this.lobby.notify();
    return null;
  }

  /** The host closes the room (or leaves it): everyone inside is told. */
  close(c: Challenge): void {
    const r = this.presence.rooms.get(c.id);
    if (r?.readyCheck) r.readyCheck = null;
    c.cancel();
    this.challenges.save(c);
    if (r) for (const ws of r.sockets) if (ws.open) ws.send({ t: 'closed' });
    this.lobby.notify();
  }

  /** Both players are here and ready (or it's a tournament match): the countdown starts. */
  startCountdown(c: Challenge, tournament: TournamentLabel | null = null): void {
    const r = this.presence.room(c.id);
    r.readyCheck = null;
    r.countdown = { startedAt: now(), endsAt: now() + this.timings.countdownMs, players: [this.views.countdownPlayer(c.hostId, c.hostName), this.views.countdownPlayer(c.guestId!, c.guestName!)], tournament };
    setTimeout(() => this.openWhenArrived(c, r), this.timings.countdownMs);
    this.broadcast(r, { t: 'countdown' });
  }

  // ---------- what each client sees ----------

  private previewFrame(r: Room, ws: ClientConnection, extra: Frame): Frame {
    const preview = r.preview!;
    const you = sideIn(preview.sides, ws.trainerId);
    return { ...extra, t: extra.t === 'presence' || extra.t === 'ready' ? 'preview' : extra.t, preview: previewView(preview, you), you, deadline: r.deadline, watchers: r.sockets.size };
  }

  frameFor(r: Room, ws: ClientConnection, extra: Frame = {}): Frame {
    if (r.readyCheck) {
      const { players, ready } = r.readyCheck;
      const you = players.findIndex((p) => p.id === ws.trainerId);
      return { t: 'lobby', players: players.map((p) => ({ ...p, ready: ready.has(p.id), online: this.presence.inRoom(r, p.id) })), you: you === -1 ? null : you };
    }
    if (r.countdown) {
      const you = r.countdown.players.findIndex((p) => p.id === ws.trainerId);
      return { ...extra, t: 'countdown', ms: Math.max(0, r.countdown.endsAt - now()), players: r.countdown.players, you: you === -1 ? null : you, tournament: r.countdown.tournament ?? null, waiting: r.countdown.waiting ?? null };
    }
    if (r.preview) return this.previewFrame(r, ws, extra);
    const battle = r.battle!;
    const you = sideOf(battle, ws.trainerId);
    return {
      ...extra,
      ...(extra.events ? { events: viewEvents(extra.events, you) } : {}),
      state: publicState(battle, you),
      you,
      actions: you === null ? [] : validActions(battle, you),
      forced: you !== null && !!battle.sides[you].action?.auto,
      deadline: r.deadline,
      watchers: r.sockets.size,
    };
  }

  broadcast(r: Room, extra: Frame): void {
    for (const ws of r.sockets) if (ws.open) ws.send(this.frameFor(r, ws, extra));
  }

  /** Viewers (not the players) see each side's draft as it is marked. */
  private broadcastWatchers(r: Room): void {
    for (const ws of r.sockets) if (ws.open && (!r.preview || sideIn(r.preview.sides, ws.trainerId) === null)) ws.send(this.frameFor(r, ws, { t: 'preview' }));
  }

  // ---------- ready check and countdown ----------

  private setRoomReady(c: Challenge, r: Room, trainerId: string | null, ready: boolean): void {
    const check = r.readyCheck;
    if (!trainerId || !check?.players.some((p) => p.id === trainerId)) return;
    if (ready) check.ready.add(trainerId);
    else check.ready.delete(trainerId);
    if (check.players.every((p) => check.ready.has(p.id))) this.startCountdown(c);
    else this.broadcast(r, { t: 'lobby' });
  }

  /** The guest left during the ready check: the room goes back to waiting for a rival. */
  private reopenRoom(c: Challenge, r: Room): void {
    if (!r.readyCheck) return;
    r.readyCheck = null;
    c.reopen();
    this.challenges.save(c);
    for (const ws of r.sockets) if (ws.open) ws.send({ t: 'reopened', host: ws.trainerId === c.hostId });
    this.lobby.notify();
  }

  /** People who follow a tournament: in its page or in the room of one of its matches. */
  private tournamentFollowers(tournamentId: string): string[] {
    const ids = new Set<string>();
    for (const ws of this.presence.tourSockets(tournamentId)) if (ws.open && ws.trainerId) ids.add(ws.trainerId);
    for (const [id, room] of this.presence.rooms) {
      if (this.challenges.findById(id)?.tournamentId !== tournamentId) continue;
      for (const ws of room.sockets) if (ws.open && ws.trainerId) ids.add(ws.trainerId);
    }
    return [...ids].filter((id) => !aiLevelOf(id));
  }

  /** In a tournament, the preview waits (a while) until players and followers reach the room. */
  private openWhenArrived(c: Challenge, r: Room): void {
    if (!r.countdown) return;
    const pending = c.tournamentId
      ? pendingArrivals({
          players: [c.hostId, c.guestId!].filter((id) => !aiLevelOf(id)),
          followers: this.tournamentFollowers(c.tournamentId),
          present: [...r.sockets].filter((ws) => ws.open).map((ws) => ws.trainerId),
        })
      : [];
    if (pending.length && now() - r.countdown.startedAt < this.timings.countdownMs + this.timings.arrivalWaitMs) {
      const waiting = pending.map((id) => this.trainers.byId(id)?.name ?? '…');
      const changed = JSON.stringify(waiting) !== JSON.stringify(r.countdown.waiting);
      r.countdown.waiting = waiting;
      r.countdown.endsAt = now();
      if (changed) this.broadcast(r, { t: 'countdown' });
      setTimeout(() => this.openWhenArrived(c, r), 500);
      return;
    }
    this.openPreview(c, r);
  }

  // ---------- preview ----------

  private openPreview(c: Challenge, r: Room): void {
    r.countdown = null;
    if (c.status !== 'active') return;
    const preview = createPreview({
      levelCap: c.levelCap,
      mode: c.battleMode,
      sides: [
        { trainerId: c.hostId, name: this.views.nameOf(c.hostId, c.hostName)!, entries: c.hostTeam },
        { trainerId: c.guestId!, name: this.views.nameOf(c.guestId, c.guestName)!, entries: c.guestTeam! },
      ],
    });
    r.preview = preview;
    this.armPreviewTimer(c.id, r, c.mode === 'random' ? this.timings.diceRollBonusMs : 0);
    this.broadcast(r, { t: 'preview' });
    preview.sides.forEach((side, s) => {
      const level = aiLevelOf(side.trainerId);
      if (level) this.scheduleAiPick(c.id, r, s, level);
    });
  }

  /** Is a tournament player missing from the room? Then timers run short so nobody waits forever. */
  private someoneAbsent(id: string, r: Room, sides: { trainerId: string }[]): boolean {
    if (!this.challenges.findById(id)?.tournamentId) return false;
    return sides.some((side) => !aiLevelOf(side.trainerId) && ![...r.sockets].some((ws) => ws.trainerId === side.trainerId && ws.open));
  }

  private armPreviewTimer(id: string, r: Room, extraMs = 0): void {
    clearTimeout(r.timer ?? undefined);
    const preview = r.preview!;
    r.previewShort = this.someoneAbsent(id, r, preview.sides);
    const ms = (r.previewShort ? Math.min(this.timings.absentLimitMs, this.timings.pickLimitMs) : this.timings.pickLimitMs) + extraMs;
    r.deadline = now() + ms;
    r.timer = setTimeout(() => {
      if (!r.preview) return;
      fillMissing(r.preview);
      this.revealPicks(id, r);
    }, ms);
    r.timer.unref?.();
  }

  /** The AI marks its picks one by one (viewers see them), then confirms. */
  private scheduleAiPick(id: string, r: Room, s: number, level: string): void {
    const preview = r.preview!;
    const choice = aiPicks({ difficulty: level, own: preview.sides[s].entries });
    const still = () => r.preview === preview && !preview.sides[s].picks;
    const step = this.timings.aiPickMs / (choice.length + 1);
    choice.forEach((_, i) => {
      setTimeout(
        () => {
          if (!still()) return;
          preview.sides[s].draft = choice.slice(0, i + 1);
          this.broadcastWatchers(r);
        },
        this.timings.diceAnimationMs + step * (i + 1),
      ).unref?.();
    });
    setTimeout(() => {
      if (!still()) return;
      pick(preview, s, choice);
      if (previewReady(preview)) this.revealPicks(id, r);
      else this.broadcast(r, { t: 'preview' });
    }, this.timings.diceAnimationMs + this.timings.aiPickMs).unref?.();
  }

  /** Both sides chose: everyone sees the 3 of each side for a moment, then the battle starts. */
  private revealPicks(id: string, r: Room): void {
    if (!r.preview || r.preview.revealed) return;
    if (this.timings.revealMs <= 0) return this.startBattle(id, r);
    clearTimeout(r.timer ?? undefined);
    r.preview.revealed = true;
    r.deadline = now() + this.timings.revealMs;
    this.broadcast(r, { t: 'preview' });
    r.timer = setTimeout(() => r.preview && this.startBattle(id, r), this.timings.revealMs);
    r.timer.unref?.();
  }

  // ---------- battle ----------

  private startBattle(id: string, r: Room): void {
    const p = r.preview!;
    r.preview = null;
    r.battle = createBattle({
      id,
      levelCap: p.levelCap,
      sides: p.sides.map((side, s) => ({ trainerId: side.trainerId, name: side.name, entries: chosenEntries(p, s) })),
    });
    this.armTimer(id, r);
    this.broadcast(r, { t: 'start' });
    this.nextAiTurn(id, r);
  }

  private aiOnly = (b: BattleState) => b.sides.every((side) => aiLevelOf(side.trainerId));

  /** AI vs AI plays at a watchable pace and waits (a while) for viewers still animating a turn. */
  private nextAiTurn(id: string, r: Room): void {
    const b = r.battle;
    if (!b || !this.aiOnly(b)) return this.aiTurn(id, r);
    const turn = b.turn;
    const since = now();
    const check = () => {
      if (r.battle !== b) return;
      const waited = now() - since;
      const watching = [...r.sockets].filter((ws) => ws.open).map((ws) => ws.seenTurn);
      if (waited >= this.timings.aiVsAiPauseMs && (waited >= this.timings.aiVsAiViewerWaitMs || !viewersBehind(watching, turn))) return this.aiTurn(id, r);
      setTimeout(check, 250).unref?.();
    };
    setTimeout(check, Math.min(this.timings.aiVsAiPauseMs, 250)).unref?.();
  }

  private aiTurn(id: string, r: Room): void {
    const b = r.battle;
    if (!b || b.status !== 'active') return;
    let events: BattleEvent[] | null = null;
    let acted = false;
    b.sides.forEach((side, s) => {
      const level = aiLevelOf(side.trainerId);
      if (!level || !needsAction(b, s)) return;
      // Never let a Skynet bug become an unhandled rejection: the turn timer still plays for it.
      if (level === JEV_LEVEL) return void this.jevTurn(id, r, s).catch((e) => this.logger.error(`Skynet: ${e}`));
      const action = chooseAction(b, s, level) ?? autoAction(b, s);
      if (!action) return;
      acted = true;
      events = submit(b, s, action) || events;
    });
    if (events) this.afterResolve(id, r, events);
    else if (acted) this.broadcast(r, { t: 'ready' });
  }

  // Jev answers over the network, so this side acts later. Meanwhile the rival may act, the turn
  // timer may play for Skynet, or the room may close: the answer only counts if nothing moved.
  private async jevTurn(id: string, r: Room, s: number): Promise<void> {
    const b = r.battle!;
    const at = `${b.turn}:${b.phase}`;
    r.jevAsked ??= new Set();
    if (r.jevAsked.has(at)) return;
    r.jevAsked.add(at);
    const picked = await this.skynet.choose(b, s);
    r.jevAsked.delete(at);
    if (r.battle !== b || b.status !== 'active' || `${b.turn}:${b.phase}` !== at || !needsAction(b, s)) return;
    const action = picked ?? chooseAction(b, s, JEV_LEVEL) ?? autoAction(b, s);
    if (!action) return;
    let events: BattleEvent[] | null;
    try {
      events = submit(b, s, action);
    } catch {
      return;
    }
    if (events) this.afterResolve(id, r, events);
    else this.broadcast(r, { t: 'ready' });
  }

  /** Turn timer: whoever has not chosen gets an automatic move, so a battle always ends. */
  private armTimer(id: string, r: Room): void {
    clearTimeout(r.timer ?? undefined);
    r.timer = null;
    r.deadline = null;
    const b = r.battle;
    if (!b || b.status !== 'active') return;
    const ms = this.someoneAbsent(id, r, b.sides) ? Math.min(this.timings.absentLimitMs, this.timings.turnLimitMs) : this.timings.turnLimitMs;
    r.deadline = now() + ms;
    r.timer = setTimeout(() => {
      let events: BattleEvent[] | null = null;
      b.sides.forEach((_, s) => {
        if (needsAction(b, s)) {
          const a = autoAction(b, s);
          if (a) events = submit(b, s, a) || events;
        }
      });
      this.afterResolve(id, r, events ?? [], true);
    }, ms);
    r.timer.unref?.();
  }

  private afterResolve(id: string, r: Room, events: BattleEvent[], timedOut = false): void {
    const b = r.battle!;
    if (b.status === 'finished') this.finishBattle(id, r);
    else this.armTimer(id, r);
    this.broadcast(r, { t: 'events', events, timedOut });
    if (!this.aiOnly(b) && this.playForcedMoves(id, r)) return;
    this.nextAiTurn(id, r);
  }

  /** Moves a player is locked into (a charge, a rampage…) play themselves. */
  private playForcedMoves(id: string, r: Room): boolean {
    const b = r.battle!;
    let events: BattleEvent[] | null = null;
    let submitted = false;
    b.sides.forEach((_, s) => {
      const action = forcedAction(b, s);
      if (!action) return;
      submitted = true;
      events = submit(b, s, action) || events;
      const chosen = b.sides[s].action;
      if (chosen) chosen.auto = true;
    });
    if (events) this.afterResolve(id, r, events);
    else if (submitted) this.broadcast(r, { t: 'ready' });
    return !!events;
  }

  private finishBattle(id: string, r: Room): void {
    clearTimeout(r.timer ?? undefined);
    r.deadline = null;
    const b = r.battle!;
    const c = this.challenges.findById(id);
    if (!c || c.status !== 'active') return;
    const winnerId = b.winner !== null ? b.sides[b.winner].trainerId : null;
    c.finish({ winnerId, turns: b.turn, final: publicState(b) as unknown as FinalBattleState, at: now() });
    // Only 1v1 between people counts for the ranking, which belongs to the trainers context.
    if (b.winner !== null && c.ranked) this.trainers.recordRankedResult(b.sides[b.winner].trainerId, b.sides[1 - b.winner].trainerId);
    this.challenges.save(c);
    if (c.tournamentId) this.events.matchFinished({ challenge: c, winnerSide: b.winner });
    // Keep the finished room a while for late viewers, then drop it.
    setTimeout(() => {
      const cur = this.presence.rooms.get(id);
      if (cur === r && r.sockets.size === 0) this.presence.rooms.delete(id);
    }, FINISHED_ROOM_MS).unref();
  }

  // ---------- messages from a client in a room ----------

  /** A client opens a room page. Returns the challenge, or null if it doesn't exist. */
  enter(ws: ClientConnection, room: string, token: string | undefined): Challenge | null {
    if (token !== undefined) ws.trainerId = this.trainers.authenticate(token)?.id ?? null;
    const c = this.challenges.findById(room);
    if (!c) {
      ws.send({ t: 'error', error: 'Ese desafío no existe.' });
      return null;
    }
    ws.roomId = c.id;
    const r = this.presence.room(c.id);
    r.sockets.add(ws);
    if (ws.trainerId === c.hostId && c.status === 'open') this.lobby.notify();
    if (r.preview && !r.preview.revealed && r.previewShort && sideIn(r.preview.sides, ws.trainerId) !== null && !this.someoneAbsent(c.id, r, r.preview.sides)) this.armPreviewTimer(c.id, r);
    if (r.battle || r.preview || r.readyCheck) this.broadcast(r, { t: 'presence' });
    else if (r.countdown) ws.send(this.frameFor(r, ws));
    else ws.send({ t: 'waiting', watchers: r.sockets.size });
    return c;
  }

  /** A client in a room disconnected. */
  left(ws: ClientConnection): void {
    const c = ws.roomId ? this.challenges.findById(ws.roomId) : undefined;
    const r = ws.roomId ? this.presence.rooms.get(ws.roomId) : undefined;
    if (!c || !r) return;
    r.sockets.delete(ws);
    if (ws.trainerId === c.hostId) this.lobby.notify();
    if (r.readyCheck && r.readyCheck.players.some((p) => p.id === ws.trainerId)) {
      this.broadcast(r, { t: 'lobby' });
      setTimeout(() => {
        if (!r.readyCheck || this.presence.inRoom(r, ws.trainerId)) return;
        if (ws.trainerId === c.hostId) this.close(c);
        else this.reopenRoom(c, r);
      }, this.timings.seatGraceMs).unref?.();
    }
    if (r.battle || r.preview) this.broadcast(r, { t: 'presence' });
    if (!r.battle && !r.preview && !r.countdown && !r.readyCheck && r.sockets.size === 0) this.presence.rooms.delete(c.id);
  }

  setReady(ws: ClientConnection, ready: boolean): void {
    const r = this.presence.rooms.get(ws.roomId!);
    const c = this.challenges.findById(ws.roomId!);
    if (r && c) this.setRoomReady(c, r, ws.trainerId, ready);
  }

  /** The guest walks out of the ready check. */
  leaveReadyCheck(ws: ClientConnection): void {
    const r = this.presence.rooms.get(ws.roomId!);
    const c = this.challenges.findById(ws.roomId!);
    if (r?.readyCheck && c?.guestId === ws.trainerId) this.reopenRoom(c!, r);
  }

  seen(ws: ClientConnection, turn: number): void {
    ws.seenTurn = Math.max(ws.seenTurn ?? 0, turn);
  }

  /** A player is marking picks (not confirmed yet): viewers see the draft live. */
  choosing(ws: ClientConnection, picks: number[]): void {
    const r = this.presence.rooms.get(ws.roomId!);
    if (!r?.preview || r.preview.revealed) return;
    const s = sideIn(r.preview.sides, ws.trainerId);
    if (s === null || r.preview.sides[s].picks) return;
    const side = r.preview.sides[s];
    side.draft = [...new Set(picks)].filter((i) => i >= 0 && i < side.entries.length).slice(0, picksNeeded(r.preview, s));
    this.broadcastWatchers(r);
  }

  pick(ws: ClientConnection, picks: number[]): void {
    const r = this.presence.rooms.get(ws.roomId!);
    if (!r?.preview) return;
    const s = sideIn(r.preview.sides, ws.trainerId);
    if (s === null) return;
    try {
      pick(r.preview, s, picks);
    } catch (e) {
      return ws.send({ t: 'error', error: (e as Error).message });
    }
    if (previewReady(r.preview)) this.revealPicks(ws.roomId!, r);
    else this.broadcast(r, { t: 'preview' });
  }

  act(ws: ClientConnection, action: Action | null): void {
    const r = this.presence.rooms.get(ws.roomId!);
    if (!r?.battle || r.battle.status !== 'active') return;
    const s = sideOf(r.battle, ws.trainerId);
    if (s === null) return;
    let events: BattleEvent[] | null;
    try {
      events = submit(r.battle, s, action);
    } catch (e) {
      return ws.send({ t: 'error', error: (e as Error).message });
    }
    if (events) this.afterResolve(ws.roomId!, r, events);
    else this.broadcast(r, { t: 'ready' });
  }

  /** Who is talking in a room's chat: a player (and which side) or a viewer. */
  chatRole(ws: ClientConnection, trainerId: string, isTournamentPlayer: (tournamentId: string) => boolean) {
    const c = this.challenges.findById(ws.roomId!);
    const r = this.presence.rooms.get(ws.roomId!);
    if (!c) return null;
    const side = r?.battle ? sideOf(r.battle, trainerId) : r?.preview ? sideIn(r.preview.sides, trainerId) : null;
    const player = c.tournamentId ? isTournamentPlayer(c.tournamentId) : c.isPlayer(trainerId);
    return { challenge: c, role: player ? ('player' as const) : ('watcher' as const), side };
  }
}

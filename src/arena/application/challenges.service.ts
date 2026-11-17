// Use cases for duel rooms, as the HTTP API offers them: open (or find) a room, look at it, close
// it, join it, and list your history.
import { Injectable, OnModuleInit } from '@nestjs/common';
import { uniqueSpecies } from '../../catalog/domain/roster-entry.js';
import { SkynetService } from '../../combat/application/skynet.service.js';
import { newId, now } from '../../shared/domain/clock.js';
import { forbidden, notFound } from '../../shared/domain/errors.js';
import type { Trainer } from '../../trainers/domain/trainer.js';
import { ChallengeRepository, TournamentRepository } from '../domain/arena.repositories.js';
import { Challenge, type BattleMode, type Visibility } from '../domain/challenge.js';
import { joinBlocker, matchFor } from '../domain/lobby.js';
import { humanCount } from '../domain/tournament.js';
import { ArenaViews } from './arena-views.js';
import { DuelService } from './duel.service.js';
import { LobbyService } from './lobby.service.js';
import { Presence } from './presence.js';

export interface NewChallenge {
  mode: BattleMode;
  levelCap: number | null;
  visibility: Visibility;
  /** AI difficulty, to play against the AI. */
  ai?: string;
}

@Injectable()
export class ChallengesService implements OnModuleInit {
  constructor(
    private readonly challenges: ChallengeRepository,
    private readonly tournaments: TournamentRepository,
    private readonly duels: DuelService,
    private readonly lobby: LobbyService,
    private readonly presence: Presence,
    private readonly views: ArenaViews,
    private readonly skynet: SkynetService,
  ) {}

  onModuleInit(): void {
    for (const c of this.challenges.all()) {
      // Battles live in memory: whatever a restart left mid-fight is closed for good.
      if (c.status === 'active') {
        c.abandon();
        this.challenges.save(c);
      }
      // Older versions allowed repeated species in a team.
      if (c.dropRepeatedSpecies(uniqueSpecies)) this.challenges.save(c);
    }
  }

  find(id: string): Challenge {
    const c = this.challenges.findById(id);
    if (!c) throw notFound('Ese desafío no existe.');
    return c;
  }

  /**
   * "New battle": against the AI it starts at once. A public search joins an open room with the
   * same mode and level (or returns your own); otherwise a new room is opened.
   */
  create(trainer: Trainer, input: NewChallenge): { challenge: Challenge; joined?: boolean } {
    if (input.ai !== undefined) {
      this.skynet.assertOffered(input.ai);
      return { challenge: this.duels.startAgainstAi(trainer, { mode: input.mode, levelCap: input.levelCap, level: input.ai }) };
    }
    if (input.visibility === 'public') {
      const { own, rival } = matchFor(this.lobby.publicRooms(), { trainerId: trainer.id, mode: input.mode, levelCap: input.levelCap });
      if (rival && this.duels.joinable(rival)) {
        this.duels.join(rival, trainer);
        if (own) this.duels.close(own);
        return { challenge: rival, joined: true };
      }
      if (own) return { challenge: own };
    }
    const c = Challenge.open({ id: newId(), host: trainer, hostTeam: input.mode === 'random' ? [] : trainer.teamSnapshot(), levelCap: input.levelCap, mode: input.mode, visibility: input.visibility, at: now() });
    this.challenges.save(c);
    if (input.visibility === 'public') {
      this.lobby.notify();
      this.lobby.notifyAfterGrace();
    }
    return { challenge: c };
  }

  /** The host closes their room (while it waits, or during the ready check). */
  close(trainer: Trainer | undefined, id: string): Challenge {
    const c = this.find(id);
    const checking = c.status === 'active' && !!this.presence.rooms.get(c.id)?.readyCheck;
    if (!trainer || c.hostId !== trainer.id || (c.status !== 'open' && !checking) || c.tournamentId) throw forbidden('No puedes cerrar esta sala.');
    this.duels.close(c);
    return c;
  }

  accept(trainer: Trainer, id: string): Challenge {
    const c = this.challenges.findById(id);
    const blocked = joinBlocker<Challenge>(c, { trainerId: trainer.id, hostWaiting: this.presence.hostWaiting });
    if (blocked) throw blocked;
    this.duels.join(c!, trainer);
    return c!;
  }

  /** Your 1v1 battles (newest first, paged) and your recent tournaments. */
  history(trainer: Trainer, { offset, limit }: { offset: number; limit: number }) {
    const mine = this.challenges
      .all()
      .filter((c) => !c.ai && !c.tournamentId && (c.hostId === trainer.id || c.guestId === trainer.id))
      .sort((a, b) => b.createdAt - a.createdAt);
    const tournaments = this.tournaments
      .all()
      .filter((T) => T.seatOf(trainer.id) !== -1 && (T.status === 'open' || T.status === 'running' || (T.status === 'finished' && humanCount(T) >= 2)))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15);
    return {
      challenges: mine.slice(offset, offset + limit).map((c) => this.views.pastChallenge(c, trainer.id)),
      hasMore: offset + limit < mine.length,
      tournaments: tournaments.map((T) => this.views.pastTournament(T, trainer.id)),
    };
  }
}

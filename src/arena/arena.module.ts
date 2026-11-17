import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module.js';
import { TrainersModule } from '../trainers/trainers.module.js';
import { ArenaEvents } from './application/arena-events.js';
import { ArenaQueries } from './application/arena-queries.js';
import { ArenaViews } from './application/arena-views.js';
import { ChallengesService } from './application/challenges.service.js';
import { DuelService } from './application/duel.service.js';
import { LiveBattleService } from './application/live-battle.service.js';
import { LobbyService } from './application/lobby.service.js';
import { Presence } from './application/presence.js';
import { TeamPreviewService } from './application/team-preview.service.js';
import { TournamentsService } from './application/tournaments.service.js';
import { ChallengeRepository, TournamentRepository } from './domain/arena.repositories.js';
import { DrizzleChallengeRepository, DrizzleTournamentRepository } from './infrastructure/drizzle-arena.repositories.js';
import { ChallengesController } from './interface/challenges.controller.js';
import { TournamentsController } from './interface/tournaments.controller.js';

/**
 * Arena context: where battles happen. Duel rooms (lobby, matchmaking, ready check, live match)
 * and tournaments (seats, bracket), which are a series of duel rooms. It uses trainers (teams,
 * names, the ranking) only through TrainersService, and the combat engine as plain functions.
 */
@Module({
  imports: [TrainersModule, CombatModule],
  controllers: [ChallengesController, TournamentsController],
  providers: [
    { provide: ChallengeRepository, useClass: DrizzleChallengeRepository },
    { provide: TournamentRepository, useClass: DrizzleTournamentRepository },
    Presence,
    ArenaEvents,
    ArenaViews,
    LobbyService,
    LiveBattleService,
    TeamPreviewService,
    DuelService,
    ChallengesService,
    TournamentsService,
    ArenaQueries,
  ],
  // For the realtime gateway (socket messages) and the read-only stats.
  exports: [LobbyService, DuelService, TeamPreviewService, LiveBattleService, TournamentsService, ArenaQueries],
})
export class ArenaModule {}

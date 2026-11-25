import { Module } from '@nestjs/common';
import { ChatModule } from '../chat/chat.module.js';
import { CombatModule } from '../combat/combat.module.js';
import { TrainersModule } from '../trainers/trainers.module.js';
import { ArenaChatService } from './application/arena-chat.service.js';
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

@Module({
  imports: [TrainersModule, CombatModule, ChatModule],
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
    ArenaChatService,
  ],
  exports: [LobbyService, DuelService, TeamPreviewService, LiveBattleService, TournamentsService, ArenaChatService, ArenaQueries, ArenaEvents],
})
export class ArenaModule {}

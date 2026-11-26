import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module.js';
import { TrainersModule } from '../trainers/trainers.module.js';
import { AchievementsService } from './application/achievements.service.js';
import { AchievementsController } from './interface/achievements.controller.js';
import { StatsController } from './interface/stats.controller.js';

@Module({ imports: [TrainersModule, ArenaModule], controllers: [StatsController, AchievementsController], providers: [AchievementsService] })
export class StatsModule {}

import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module.js';
import { TrainersModule } from '../trainers/trainers.module.js';
import { WebModule } from '../web/web.module.js';
import { AchievementsService } from './application/achievements.service.js';
import { AchievementsController } from './interface/achievements.controller.js';
import { StatsController } from './interface/stats.controller.js';

/**
 * Stats context: a read model (ranking, recent battles, totals, achievements). It keeps no data of
 * its own: in a bigger system it would keep a projection fed by events; here it computes from the
 * other contexts' read-only queries on each request, which is plenty for a few dozen players. The
 * one change it asks for, a look unlocked by achievements, is written by TrainersService.
 */
@Module({ imports: [TrainersModule, ArenaModule, WebModule], controllers: [StatsController, AchievementsController], providers: [AchievementsService] })
export class StatsModule {}

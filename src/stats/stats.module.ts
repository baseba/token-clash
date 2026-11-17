import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module.js';
import { TrainersModule } from '../trainers/trainers.module.js';
import { WebModule } from '../web/web.module.js';
import { StatsController } from './stats.controller.js';

/**
 * Stats context: a read model (ranking, recent battles, totals). It never writes. In a bigger
 * system it would keep its own projection fed by events; here it computes from the other
 * contexts' read-only queries on each request, which is plenty for a few dozen players.
 */
@Module({ imports: [TrainersModule, ArenaModule, WebModule], controllers: [StatsController] })
export class StatsModule {}

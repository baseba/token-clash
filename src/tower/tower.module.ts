import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module.js';
import { CombatModule } from '../combat/combat.module.js';
import { TrainersModule } from '../trainers/trainers.module.js';
import { TowerViews } from './application/tower-views.js';
import { TowerService } from './application/tower.service.js';
import { TowerRunRepository } from './domain/tower-run.repository.js';
import { DrizzleTowerRunRepository } from './infrastructure/drizzle-tower-run.repository.js';
import { TowerController } from './interface/tower.controller.js';

@Module({
  imports: [TrainersModule, CombatModule, ArenaModule],
  controllers: [TowerController],
  providers: [TowerService, TowerViews, { provide: TowerRunRepository, useClass: DrizzleTowerRunRepository }],
  exports: [TowerService],
})
export class TowerModule {}

import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module.js';
import { CombatModule } from '../combat/combat.module.js';
import { TrainersModule } from '../trainers/trainers.module.js';
import { TowerViews } from './application/tower-views.js';
import { TowerService } from './application/tower.service.js';
import { TowerRunRepository } from './domain/tower-run.repository.js';
import { DrizzleTowerRunRepository } from './infrastructure/drizzle-tower-run.repository.js';
import { TowerController } from './interface/tower.controller.js';

/**
 * Tower context: climbs of floors against trainers, gym leaders and leagues with Pokémon of your
 * collection that start low and grow. Each floor is a battle against the AI that the arena runs; the
 * arena announces its end and the climb reacts. Nobody else knows the Tower exists.
 */
@Module({
  imports: [TrainersModule, CombatModule, ArenaModule],
  controllers: [TowerController],
  providers: [TowerService, TowerViews, { provide: TowerRunRepository, useClass: DrizzleTowerRunRepository }],
  // For the read-only stats (records and achievements).
  exports: [TowerService],
})
export class TowerModule {}

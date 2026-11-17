import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module.js';
import { TrainersService } from './application/trainers.service.js';
import { TrainerRepository } from './domain/trainer.repository.js';
import { DrizzleTrainerRepository } from './infrastructure/drizzle-trainer.repository.js';
import { TrainersController } from './interface/trainers.controller.js';

/**
 * Trainers context: players, their collection and their team.
 * - domain/: Trainer aggregate, save parsing, repository port. No Nest, no SQL.
 * - application/: TrainersService, the use cases (and the only thing other contexts may use).
 * - infrastructure/: Drizzle tables, mapper and repository.
 * - interface/: HTTP controller, session guard, presenters.
 */
@Module({
  imports: [CombatModule],
  controllers: [TrainersController],
  providers: [TrainersService, { provide: TrainerRepository, useClass: DrizzleTrainerRepository }],
  // The repository is NOT exported: other contexts can't touch trainers' tables, only use cases.
  exports: [TrainersService],
})
export class TrainersModule {}

import { Module } from '@nestjs/common';
import { CombatModule } from '../combat/combat.module.js';
import { AccountsService } from './application/accounts.service.js';
import { ShopService } from './application/shop.service.js';
import { TrainersService } from './application/trainers.service.js';
import { TrainerRepository } from './domain/trainer.repository.js';
import { DrizzleTrainerRepository } from './infrastructure/drizzle-trainer.repository.js';
import { TrainersController } from './interface/trainers.controller.js';

@Module({
  imports: [CombatModule],
  controllers: [TrainersController],
  providers: [TrainersService, AccountsService, ShopService, { provide: TrainerRepository, useClass: DrizzleTrainerRepository }],
  exports: [TrainersService, AccountsService, ShopService],
})
export class TrainersModule {}

import { Module } from '@nestjs/common';
import { TrainersModule } from '../trainers/trainers.module.js';
import { RadioService } from './application/radio.service.js';
import { StationRepository } from './domain/station.repository.js';
import { DrizzleStationRepository } from './infrastructure/drizzle-station.repository.js';
import { RadioController } from './interface/radio.controller.js';

/**
 * Radio context: trainers' stations, each with the queue its owner picks, and who listens to each.
 * It reads the songs and their lengths from the catalog and the owners' names from TrainersService;
 * nothing else knows it exists.
 */
@Module({
  imports: [TrainersModule],
  controllers: [RadioController],
  providers: [RadioService, { provide: StationRepository, useClass: DrizzleStationRepository }],
  // For the realtime gateway (tuning in over the socket).
  exports: [RadioService],
})
export class RadioModule {}

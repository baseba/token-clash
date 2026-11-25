import { Module } from '@nestjs/common';
import { TrainersModule } from '../trainers/trainers.module.js';
import { RadioService } from './application/radio.service.js';
import { StationRepository } from './domain/station.repository.js';
import { DrizzleStationRepository } from './infrastructure/drizzle-station.repository.js';
import { RadioController } from './interface/radio.controller.js';

@Module({
  imports: [TrainersModule],
  controllers: [RadioController],
  providers: [RadioService, { provide: StationRepository, useClass: DrizzleStationRepository }],
  exports: [RadioService],
})
export class RadioModule {}

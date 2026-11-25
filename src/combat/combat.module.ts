import { Module } from '@nestjs/common';
import { SkynetService } from './application/skynet.service.js';

@Module({
  providers: [SkynetService],
  exports: [SkynetService],
})
export class CombatModule {}

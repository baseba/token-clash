import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module.js';
import { RadioModule } from '../radio/radio.module.js';
import { ConnectionLimits } from './connection-limits.js';
import { GameGateway } from './game.gateway.js';

@Module({
  imports: [ArenaModule, RadioModule],
  providers: [GameGateway, ConnectionLimits],
  exports: [ConnectionLimits],
})
export class RealtimeModule {}

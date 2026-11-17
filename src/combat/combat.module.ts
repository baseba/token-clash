import { Module } from '@nestjs/common';
import { SkynetService } from './application/skynet.service.js';

/**
 * Combat context: the battle engine, team preview, random parties and the AI (domain/, pure
 * functions with injected randomness), plus Skynet's client to Jev (infrastructure/jev/).
 * The engine needs no Nest at all; the module only exposes Skynet, which needs configuration.
 */
@Module({
  providers: [SkynetService],
  exports: [SkynetService],
})
export class CombatModule {}

import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module.js';
import { HealthController, WebController } from './web.controller.js';
import { WebModule } from './web.module.js';

/** Health checks and the static catch-all. Imported last in AppModule: Express matches in order. */
@Module({ imports: [WebModule, ArenaModule], controllers: [HealthController, WebController] })
export class WebRoutesModule {}

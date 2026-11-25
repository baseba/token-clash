import { Module } from '@nestjs/common';
import { ArenaModule } from '../arena/arena.module.js';
import { HealthController, WebController } from './web.controller.js';
import { WebModule } from './web.module.js';

@Module({ imports: [WebModule, ArenaModule], controllers: [HealthController, WebController] })
export class WebRoutesModule {}

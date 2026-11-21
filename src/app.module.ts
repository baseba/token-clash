// The application: one Nest module per bounded context, plus shared infrastructure.
//
//   catalog   species, moves, abilities, types (static data + pure rules; no module needed)
//   combat    battle engine, team preview, AI, Skynet
//   trainers  players, their collection and team          ← owns tables trainers, roster_entries
//   arena     duel rooms, live matches, tournaments        ← owns challenges, tournaments, seats, matches
//   chat      room and tournament chat (in memory)
//   radio     trainers' radio stations and their queues   ← owns radio_stations
//   tower     climbs of the Tower with your collection     ← owns tower_runs
//   stats     read model for /stats
//   realtime  the WebSocket protocol (/ws)
//   web       the static frontend and health checks
import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ArenaModule } from './arena/arena.module.js';
import { ChatModule } from './chat/chat.module.js';
import { CombatModule } from './combat/combat.module.js';
import { RadioModule } from './radio/radio.module.js';
import { RealtimeModule } from './realtime/realtime.module.js';
import { ConfigModule } from './shared/config/config.module.js';
import { ApiProtectionMiddleware } from './shared/http/api-protection.middleware.js';
import { DomainErrorFilter } from './shared/http/domain-error.filter.js';
import { HttpModule } from './shared/http/http.module.js';
import { SecurityHeadersMiddleware } from './shared/http/security-headers.middleware.js';
import { validationPipe } from './shared/http/validation.pipe.js';
import { DatabaseModule } from './shared/infrastructure/database/database.module.js';
import { StatsModule } from './stats/stats.module.js';
import { TowerModule } from './tower/tower.module.js';
import { TrainersModule } from './trainers/trainers.module.js';
import { WebRoutesModule } from './web/web-routes.module.js';

@Module({
  imports: [
    ConfigModule,
    HttpModule,
    DatabaseModule,
    CombatModule,
    TrainersModule,
    ArenaModule,
    ChatModule,
    RadioModule,
    TowerModule,
    StatsModule,
    RealtimeModule,
    // Last: its catch-all route serves the frontend and must not shadow anything above.
    WebRoutesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    // Checks every @Body/@Query/@Param that declares a schema (the DTOs in */interface/dto/).
    { provide: APP_PIPE, useFactory: validationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('{*path}');
    consumer.apply(ApiProtectionMiddleware).forRoutes('api/{*path}');
  }
}

import { Logger, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ArenaModule } from './arena/arena.module.js';
import { ChatModule } from './chat/chat.module.js';
import { CombatModule } from './combat/combat.module.js';
import { importLegacyJson } from './legacy/legacy-json-import.js';
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
    DatabaseModule.forRoot({ afterOpen: (db, dataDir) => importLegacyJson(db, dataDir, new Logger('LegacyImport')) }),
    CombatModule,
    TrainersModule,
    ArenaModule,
    ChatModule,
    RadioModule,
    TowerModule,
    StatsModule,
    RealtimeModule,
    WebRoutesModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    { provide: APP_PIPE, useFactory: validationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SecurityHeadersMiddleware).forRoutes('{*path}');
    consumer.apply(ApiProtectionMiddleware).forRoutes('api/{*path}');
  }
}
